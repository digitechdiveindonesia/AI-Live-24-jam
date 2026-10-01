import {
  PlatformType,
  SyncConflict,
  SyncConflictType,
  SyncResolutionType,
  ExternalProductMapping,
  ProductVariant
} from '../../db/schema';
import { platformManager } from './PlatformManager';
import {
  productRepository,
  inventoryRepository,
  promotionRepository,
  syncConflictRepository,
  externalMappingRepository,
  eventRepository
} from '../../repositories';
import { db } from '../../db';

export interface ExternalProductSnapshot {
  externalProductId: string;
  externalSku: string;
  title: string;
  price: number;
  salePrice?: number | null;
  stock: number;
  category?: string;
  status: string;
  variants?: Array<{
    externalVariantId: string;
    externalSku: string;
    title: string;
    price: number;
    stock: number;
  }>;
  promotion?: {
    promotionId: string;
    title: string;
    discountPercent: number;
    salePrice: number;
    startTime: string;
    endTime: string;
    active: boolean;
  } | null;
  raw?: any;
}

export interface NormalizedExternalSnapshot {
  platform: PlatformType;
  timestamp: string;
  isSimulated: boolean;
  products: ExternalProductSnapshot[];
}

export class ProductSyncService {
  private static instance: ProductSyncService;

  private constructor() {}

  public static getInstance(): ProductSyncService {
    if (!ProductSyncService.instance) {
      ProductSyncService.instance = new ProductSyncService();
    }
    return ProductSyncService.instance;
  }

  /**
   * PHASE A — FETCH SNAPSHOT
   * Retrieves external commerce data through the PlatformAdapter abstraction.
   * Normalizes the response without mutating any authoritative Supabase data.
   */
  public async fetchSnapshot(
    platform: PlatformType,
    customProducts?: ExternalProductSnapshot[]
  ): Promise<NormalizedExternalSnapshot> {
    const adapter = platformManager.getAdapter(platform);
    if (!adapter) {
      throw new Error(`No registered PlatformAdapter found for ${platform}`);
    }

    const conn = adapter.getConnection();
    const isSimulated = conn.environment === 'MOCK' || conn.environment === 'SANDBOX' || conn.environment === 'DEVELOPMENT';
    const timestamp = new Date().toISOString();

    // If explicit mock/snapshot items provided (e.g. for deterministic simulation/testing)
    if (customProducts && customProducts.length > 0) {
      return {
        platform,
        timestamp,
        isSimulated,
        products: customProducts
      };
    }

    // Otherwise fetch live from platform adapter
    const platformProds = await adapter.getProducts();
    const products: ExternalProductSnapshot[] = [];

    for (const prod of platformProds) {
      const inv = await adapter.getInventory(prod.sku).catch(() => ({ stock: prod.stock }));
      products.push({
        externalProductId: prod.platformProductId,
        externalSku: prod.sku,
        title: prod.title,
        price: prod.price,
        salePrice: prod.raw?.sale_price || null,
        stock: inv ? inv.stock : prod.stock,
        category: prod.raw?.category || 'General',
        status: prod.status,
        variants: prod.raw?.variants || undefined,
        promotion: prod.raw?.promotion || null,
        raw: prod.raw
      });
    }

    return {
      platform,
      timestamp,
      isSimulated,
      products
    };
  }

  /**
   * PHASE B — COMPARE & DETECT CONFLICTS
   * Compares external snapshot against authoritative Supabase data.
   * Detects inventory, price, promotion, and mapping discrepancies.
   * Emits idempotent conflicts to syncConflictRepository without modifying Supabase.
   */
  public async compareAndDetectConflicts(
    snapshot: NormalizedExternalSnapshot
  ): Promise<SyncConflict[]> {
    const platform = snapshot.platform;
    const detectedConflicts: SyncConflict[] = [];

    // Load authoritative local state from Supabase / Repositories
    const localProducts = await productRepository.getAll();
    const localInventoryList = await inventoryRepository.getAll();
    const localInventoryMap = new Map(localInventoryList.map(i => [i.sku, i]));
    const localMappings = await externalMappingRepository.getAll({ platform });
    const localMappingByExternalSku = new Map(localMappings.map(m => [m.external_sku, m]));
    const localMappingByProductId = new Map(localMappings.map(m => [m.product_id, m]));

    const examinedExternalSkus = new Set<string>();

    for (const extProd of snapshot.products) {
      examinedExternalSkus.add(extProd.externalSku);

      // 1. Check Product Mapping
      let localProd = localProducts.find(p => p.sku === extProd.externalSku);
      const mapping = localMappingByExternalSku.get(extProd.externalSku) ||
        (localProd ? localMappingByProductId.get(localProd.id) : undefined);

      if (!localProd && mapping) {
        localProd = localProducts.find(p => p.id === mapping.product_id);
      }

      // If neither local product nor mapping exists -> LOCAL_PRODUCT_MISSING
      if (!localProd) {
        const conflict = await syncConflictRepository.create({
          platform,
          entity_type: 'PRODUCT',
          entity_id: extProd.externalSku,
          external_id: extProd.externalProductId,
          conflict_type: 'LOCAL_PRODUCT_MISSING',
          local_value: { reason: 'Product does not exist in local Supabase catalog', sku: extProd.externalSku },
          external_value: { externalProductId: extProd.externalProductId, externalSku: extProd.externalSku, title: extProd.title, price: extProd.price },
          notes: `External platform ${platform} reported product ${extProd.externalSku} which has no local counterpart.`
        });
        detectedConflicts.push(conflict);
        continue;
      }

      // If mapped product ID does not match local product -> PRODUCT_MAPPING_CONFLICT
      if (mapping && mapping.product_id !== localProd.id) {
        const conflict = await syncConflictRepository.create({
          platform,
          entity_type: 'PRODUCT',
          entity_id: localProd.sku,
          external_id: extProd.externalProductId,
          conflict_type: 'PRODUCT_MAPPING_CONFLICT',
          local_value: { localProductId: localProd.id, sku: localProd.sku, mappedProductId: mapping.product_id },
          external_value: { externalProductId: extProd.externalProductId, externalSku: extProd.externalSku },
          notes: `Mapping mismatch: External SKU ${extProd.externalSku} mapped to ${mapping.product_id}, but local SKU belongs to ${localProd.id}.`
        });
        detectedConflicts.push(conflict);
      }

      // 2. Check Inventory Discrepancy & Reservation Safety
      const localInv = localInventoryMap.get(localProd.sku);
      if (localInv) {
        // Authoritative stock is available_stock
        if (extProd.stock !== localInv.available_stock) {
          const conflict = await syncConflictRepository.create({
            platform,
            entity_type: 'INVENTORY',
            entity_id: localProd.sku,
            external_id: extProd.externalProductId,
            conflict_type: 'INVENTORY_CONFLICT',
            local_value: {
              available_stock: localInv.available_stock,
              total_stock: localInv.total_stock,
              reserved_stock: localInv.reserved_stock
            },
            external_value: {
              reported_stock: extProd.stock
            },
            notes: `Inventory discrepancy on ${localProd.sku}: Local available is ${localInv.available_stock} (reserved: ${localInv.reserved_stock}), external reported ${extProd.stock}.`
          });
          detectedConflicts.push(conflict);
        }
      }

      // 3. Check Price Discrepancy
      const localEffectivePrice = localProd.sale_price ?? localProd.base_price;
      const externalEffectivePrice = extProd.salePrice ?? extProd.price;
      if (Math.abs(localEffectivePrice - externalEffectivePrice) > 0.01) {
        const conflict = await syncConflictRepository.create({
          platform,
          entity_type: 'PRODUCT',
          entity_id: localProd.sku,
          external_id: extProd.externalProductId,
          conflict_type: 'PRICE_CONFLICT',
          local_value: {
            base_price: localProd.base_price,
            sale_price: localProd.sale_price,
            effective_price: localEffectivePrice
          },
          external_value: {
            price: extProd.price,
            sale_price: extProd.salePrice,
            effective_price: externalEffectivePrice
          },
          notes: `Price discrepancy on ${localProd.sku}: Local is Rp${localEffectivePrice.toLocaleString()}, external is Rp${externalEffectivePrice.toLocaleString()}.`
        });
        detectedConflicts.push(conflict);
      }

      // 4. Check Promotion Discrepancy
      const localPromo = await promotionRepository.getActiveBySku(localProd.sku);
      const extPromo = extProd.promotion;

      if (localPromo && (!extPromo || !extPromo.active || extPromo.discountPercent !== localPromo.discount_percent)) {
        const conflict = await syncConflictRepository.create({
          platform,
          entity_type: 'PROMOTION',
          entity_id: localProd.sku,
          external_id: extProd.externalProductId,
          conflict_type: 'PROMOTION_CONFLICT',
          local_value: {
            promotion_id: localPromo.id,
            title: localPromo.title,
            discount_percent: localPromo.discount_percent,
            active: localPromo.active,
            start_time: localPromo.start_time,
            end_time: localPromo.end_time
          },
          external_value: extPromo || { active: false, reason: 'No active promotion found on external platform' },
          notes: `Promotion discrepancy on ${localProd.sku}: Local promo is ${localPromo.discount_percent}% active, external does not match.`
        });
        detectedConflicts.push(conflict);
      } else if (!localPromo && extPromo && extPromo.active) {
        const conflict = await syncConflictRepository.create({
          platform,
          entity_type: 'PROMOTION',
          entity_id: localProd.sku,
          external_id: extProd.externalProductId,
          conflict_type: 'PROMOTION_CONFLICT',
          local_value: { active: false, reason: 'No active local promotion in Supabase' },
          external_value: extPromo,
          notes: `External platform has active promo on ${localProd.sku} (${extPromo.discountPercent}%), but no local promo exists.`
        });
        detectedConflicts.push(conflict);
      }

      // 5. Check Variant Mapping Mismatch
      if (extProd.variants && extProd.variants.length > 0) {
        const localVariants = await productRepository.getVariants(localProd.id);
        const variantCountMismatch = localVariants.length !== extProd.variants.length;
        const missingVariant = extProd.variants.some(ev => !localVariants.some(lv => lv.sku === ev.externalSku));

        if (variantCountMismatch || missingVariant) {
          const conflict = await syncConflictRepository.create({
            platform,
            entity_type: 'VARIANT',
            entity_id: localProd.sku,
            external_id: extProd.externalProductId,
            conflict_type: 'VARIANT_MAPPING_CONFLICT',
            local_value: { variantCount: localVariants.length, variants: localVariants.map(v => ({ id: v.id, sku: v.sku, name: v.variant_name })) },
            external_value: { variantCount: extProd.variants.length, variants: extProd.variants },
            notes: `Variant mismatch on ${localProd.sku}: Local has ${localVariants.length} variants, external has ${extProd.variants.length}.`
          });
          detectedConflicts.push(conflict);
        }
      }
    }

    // 6. Check EXTERNAL_PRODUCT_MISSING
    // Local products that have an external mapping for this platform, but are missing from external snapshot
    for (const mapping of localMappings) {
      if (!examinedExternalSkus.has(mapping.external_sku)) {
        const localProd = localProducts.find(p => p.id === mapping.product_id);
        const conflict = await syncConflictRepository.create({
          platform,
          entity_type: 'PRODUCT',
          entity_id: localProd?.sku || mapping.product_id,
          external_id: mapping.external_product_id,
          conflict_type: 'EXTERNAL_PRODUCT_MISSING',
          local_value: { sku: localProd?.sku, productId: mapping.product_id, mappedExternalSku: mapping.external_sku },
          external_value: { reason: 'Mapped product is missing from external catalog snapshot' },
          notes: `Mapped product ${localProd?.sku || mapping.product_id} was not returned in external snapshot for ${platform}.`
        });
        detectedConflicts.push(conflict);
      }
    }

    return detectedConflicts;
  }

  /**
   * OPERATOR CONFLICT RESOLUTION: RESOLVE LOCAL
   * Keeps Supabase authoritative value.
   */
  public async resolveLocal(
    conflictId: string,
    operatorName: string = 'OPERATOR',
    notes?: string
  ): Promise<{ success: boolean; conflict: SyncConflict }> {
    const conflict = await syncConflictRepository.getById(conflictId);
    if (!conflict) {
      throw new Error(`Conflict ${conflictId} not found`);
    }

    const resolved = await syncConflictRepository.resolve(
      conflictId,
      'LOCAL_AUTHORITATIVE',
      operatorName,
      notes || 'Resolved keeping local Supabase authoritative data.'
    );

    db.logAudit(
      'SYNC_CONFLICT_RESOLVED',
      operatorName,
      `Conflict ${conflictId} (${conflict.conflict_type} on ${conflict.entity_id}) resolved with LOCAL_AUTHORITATIVE.`
    );

    await eventRepository.recordHostEvent({
      sessionId: 'LIVE-001',
      eventType: 'SYNC_CONFLICT_RESOLVED',
      stateFrom: 'OPEN',
      stateTo: 'RESOLVED',
      trigger: `OPERATOR:LOCAL_AUTHORITATIVE:${conflictId}`
    });

    return { success: true, conflict: resolved! };
  }

  /**
   * OPERATOR CONFLICT RESOLUTION: RESOLVE EXTERNAL
   * Explicitly updates Supabase with the external value.
   * Strictly preserves inventory reservation state to avoid live checkout corruption!
   */
  public async resolveExternal(
    conflictId: string,
    operatorName: string = 'OPERATOR',
    notes?: string
  ): Promise<{ success: boolean; conflict: SyncConflict; updatedEntity?: any }> {
    const conflict = await syncConflictRepository.getById(conflictId);
    if (!conflict) {
      throw new Error(`Conflict ${conflictId} not found`);
    }

    let updatedEntity: any = null;

    if (conflict.conflict_type === 'INVENTORY_CONFLICT') {
      const sku = conflict.entity_id;
      const externalStock = Number(conflict.external_value?.reported_stock ?? conflict.external_value?.stock ?? 0);
      const currentInv = await inventoryRepository.get(sku);

      // Critical Inventory Safety Invariant:
      // Preserve active reservation count so live checkouts are never corrupted!
      const currentReserved = currentInv?.reserved_stock || 0;
      const newTotalStock = externalStock + currentReserved;

      updatedEntity = await inventoryRepository.update(sku, newTotalStock);
      // Ensure reserved stock remains intact
      if (currentReserved > 0 && updatedEntity) {
        updatedEntity.reserved_stock = currentReserved;
        updatedEntity.available_stock = externalStock;
      }
    } else if (conflict.conflict_type === 'PRICE_CONFLICT') {
      const sku = conflict.entity_id;
      const externalPrice = Number(conflict.external_value?.sale_price ?? conflict.external_value?.price);
      const prod = await productRepository.getBySku(sku);
      if (prod) {
        prod.sale_price = externalPrice;
        prod.updated_at = new Date().toISOString();
        updatedEntity = prod;
        db.logAudit('PRODUCT_PRICE_UPDATED', operatorName, `Product ${sku} sale_price updated to Rp${externalPrice} via external resolution`);
      }
    } else if (conflict.conflict_type === 'PROMOTION_CONFLICT') {
      const sku = conflict.entity_id;
      const extPromo = conflict.external_value;
      if (extPromo && extPromo.discountPercent) {
        const promo = await promotionRepository.getActiveBySku(sku);
        if (promo) {
          promo.discount_percent = extPromo.discountPercent;
          updatedEntity = promo;
        }
      }
    }

    const resolved = await syncConflictRepository.resolve(
      conflictId,
      'EXTERNAL_OVERWRITE',
      operatorName,
      notes || 'Resolved by applying external snapshot value to local Supabase.'
    );

    db.logAudit(
      'SYNC_CONFLICT_RESOLVED',
      operatorName,
      `Conflict ${conflictId} (${conflict.conflict_type} on ${conflict.entity_id}) resolved with EXTERNAL_OVERWRITE.`
    );

    await eventRepository.recordHostEvent({
      sessionId: 'LIVE-001',
      eventType: 'SYNC_CONFLICT_RESOLVED',
      stateFrom: 'OPEN',
      stateTo: 'RESOLVED',
      trigger: `OPERATOR:EXTERNAL_OVERWRITE:${conflictId}`
    });

    return { success: true, conflict: resolved!, updatedEntity };
  }

  /**
   * OPERATOR CONFLICT RESOLUTION: RESOLVE MANUAL
   * Operator provides final approved value.
   */
  public async resolveManual(
    conflictId: string,
    manualValue: any,
    operatorName: string = 'OPERATOR',
    notes?: string
  ): Promise<{ success: boolean; conflict: SyncConflict; updatedEntity?: any }> {
    const conflict = await syncConflictRepository.getById(conflictId);
    if (!conflict) {
      throw new Error(`Conflict ${conflictId} not found`);
    }

    let updatedEntity: any = null;

    if (conflict.conflict_type === 'INVENTORY_CONFLICT') {
      const sku = conflict.entity_id;
      const targetStock = Number(manualValue?.stock ?? manualValue?.available_stock ?? manualValue);
      const currentInv = await inventoryRepository.get(sku);
      const currentReserved = currentInv?.reserved_stock || 0;
      const newTotalStock = targetStock + currentReserved;

      updatedEntity = await inventoryRepository.update(sku, newTotalStock);
      if (currentReserved > 0 && updatedEntity) {
        updatedEntity.reserved_stock = currentReserved;
        updatedEntity.available_stock = targetStock;
      }
    } else if (conflict.conflict_type === 'PRICE_CONFLICT') {
      const sku = conflict.entity_id;
      const targetPrice = Number(manualValue?.price ?? manualValue?.sale_price ?? manualValue);
      const prod = await productRepository.getBySku(sku);
      if (prod) {
        prod.sale_price = targetPrice;
        prod.updated_at = new Date().toISOString();
        updatedEntity = prod;
        db.logAudit('PRODUCT_PRICE_UPDATED', operatorName, `Product ${sku} sale_price manually updated to Rp${targetPrice}`);
      }
    }

    const resolved = await syncConflictRepository.resolve(
      conflictId,
      'MANUAL_VALUE',
      operatorName,
      notes || `Resolved with operator approved value: ${JSON.stringify(manualValue)}`
    );

    db.logAudit(
      'SYNC_CONFLICT_RESOLVED',
      operatorName,
      `Conflict ${conflictId} (${conflict.conflict_type} on ${conflict.entity_id}) resolved with MANUAL_VALUE.`
    );

    await eventRepository.recordHostEvent({
      sessionId: 'LIVE-001',
      eventType: 'SYNC_CONFLICT_RESOLVED',
      stateFrom: 'OPEN',
      stateTo: 'RESOLVED',
      trigger: `OPERATOR:MANUAL_VALUE:${conflictId}`
    });

    return { success: true, conflict: resolved!, updatedEntity };
  }
}

export const productSyncService = ProductSyncService.getInstance();
