import {
  PlatformType,
  PlatformSyncResult,
  SyncConflict
} from './PlatformTypes';
import { platformManager } from './PlatformManager';
import { productVerificationService } from '../ProductService';
import { db } from '../../db';

export class PlatformProductSyncService {
  private static instance: PlatformProductSyncService;

  private constructor() {}

  public static getInstance(): PlatformProductSyncService {
    if (!PlatformProductSyncService.instance) {
      PlatformProductSyncService.instance = new PlatformProductSyncService();
    }
    return PlatformProductSyncService.instance;
  }

  /**
   * Synchronize authoritative product catalog to platform(s).
   */
  public async syncCatalog(targetPlatform?: PlatformType): Promise<PlatformSyncResult[]> {
    const products = db.getAllProducts();
    const adapters = targetPlatform
      ? [platformManager.getAdapter(targetPlatform)].filter(Boolean)
      : platformManager.getAllAdapters();

    const results: PlatformSyncResult[] = [];

    for (const adapter of adapters) {
      if (!adapter) continue;
      for (const prod of products) {
        const verified = productVerificationService.verifyProductData(prod.sku);
        if (!verified) continue;

        const res = await adapter.syncProduct(prod.sku, {
          title: prod.name,
          price: verified.salePrice ?? verified.basePrice,
          stock: verified.availableStock,
          category: prod.category
        });
        results.push(res);
      }
    }

    db.logAudit(
      'PLATFORM_CATALOG_SYNC',
      'SYSTEM',
      `Synchronized ${products.length} products across ${adapters.length} platform adapters`
    );

    return results;
  }

  /**
   * Synchronize authoritative inventory for a specific SKU.
   */
  public async syncInventory(sku: string, targetPlatform?: PlatformType): Promise<PlatformSyncResult[]> {
    const inv = db.getInventory(sku);
    if (!inv) {
      return [
        {
          success: false,
          sku,
          platform: targetPlatform || 'TIKTOK',
          status: 'FAILED',
          message: `SKU ${sku} not found in authoritative inventory`,
          timestamp: new Date().toISOString()
        }
      ];
    }

    const adapters = targetPlatform
      ? [platformManager.getAdapter(targetPlatform)].filter(Boolean)
      : platformManager.getAllAdapters();

    const results: PlatformSyncResult[] = [];

    for (const adapter of adapters) {
      if (!adapter) continue;
      const res = await adapter.syncInventory(sku, inv.available_stock);
      results.push(res);
    }

    return results;
  }

  /**
   * Checks for inventory or pricing discrepancies between platform and internal database.
   * Enforces internal database as authoritative source of truth.
   */
  public async detectAndResolveConflicts(): Promise<SyncConflict[]> {
    const products = db.getAllProducts();
    const adapters = platformManager.getAllAdapters();
    const conflicts: SyncConflict[] = [];

    for (const adapter of adapters) {
      for (const prod of products) {
        const inv = db.getInventory(prod.sku);
        if (!inv) continue;

        try {
          const platformInv = await adapter.getInventory(prod.sku);
          // Check stock discrepancy
          if (platformInv.stock !== inv.available_stock) {
            const conflict = db.addSyncConflict({
              sku: prod.sku,
              platform: adapter.platform,
              conflictType: 'INVENTORY_MISMATCH',
              internalValue: { availableStock: inv.available_stock, totalStock: inv.total_stock },
              platformValue: { stock: platformInv.stock },
              status: 'RESOLVED_INTERNAL',
              resolvedAt: new Date().toISOString(),
              notes: `Auto-resolved with internal authority: ${inv.available_stock} units enforced.`
            });
            conflicts.push(conflict);

            // Re-sync authoritative stock down to platform
            await adapter.syncInventory(prod.sku, inv.available_stock);
          }
        } catch (e: any) {
          // If query fails, continue gracefully
        }
      }
    }

    return conflicts;
  }

  public getConflicts(status?: string): SyncConflict[] {
    return db.getSyncConflicts(status);
  }

  public resolveConflict(
    conflictId: string,
    resolution: 'RESOLVED_INTERNAL' | 'RESOLVED_MANUAL',
    notes?: string
  ): SyncConflict | undefined {
    return db.resolveSyncConflict(conflictId, resolution, notes);
  }
}

export const platformProductSyncService = PlatformProductSyncService.getInstance();
