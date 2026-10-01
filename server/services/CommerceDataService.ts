import { productRepository } from '../repositories/ProductRepository';
import { inventoryRepository } from '../repositories/InventoryRepository';
import { promotionRepository } from '../repositories/PromotionRepository';
import { Product, ProductVariant, Inventory, Promotion } from '../db/schema';

export type ProductAvailability = 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK' | 'UNAVAILABLE';

export interface EffectiveCommerceContext {
  product: Product | null;
  variant: ProductVariant | null;
  price: number;
  salePrice: number;
  priceFormatted: string;
  salePriceFormatted: string;
  promotion: Promotion | null;
  stock: number;
  availableStock: number;
  availability: ProductAvailability;
  verifiedAt: string;
  source: 'SUPABASE' | 'MEMORY_FALLBACK';
}

export class CommerceDataService {
  /**
   * Retrieves single verified commerce context for AI response grounding.
   * Authoritative source of truth: Supabase PostgreSQL.
   */
  public async getEffectiveCommerceData(
    skuOrProductId: string,
    variantIdOrSku?: string
  ): Promise<EffectiveCommerceContext> {
    const verifiedAt = new Date().toISOString();

    // 1. Resolve product by SKU or ID
    let product = await productRepository.getBySku(skuOrProductId);
    if (!product) {
      product = await productRepository.getById(skuOrProductId);
    }

    if (!product) {
      return {
        product: null,
        variant: null,
        price: 0,
        salePrice: 0,
        priceFormatted: 'Rp0',
        salePriceFormatted: 'Rp0',
        promotion: null,
        stock: 0,
        availableStock: 0,
        availability: 'UNAVAILABLE',
        verifiedAt,
        source: 'MEMORY_FALLBACK'
      };
    }

    // 2. Resolve variant if specified
    let variant: ProductVariant | null = null;
    if (variantIdOrSku) {
      variant = await productRepository.getVariantBySku(variantIdOrSku);
      if (!variant) {
        const variants = await productRepository.getVariants(product.id);
        variant = variants.find(v => v.id === variantIdOrSku || v.sku === variantIdOrSku) || null;
      }
    }

    // 3. Resolve inventory
    const inventory = await inventoryRepository.get(product.sku);
    const totalStock = inventory ? inventory.total_stock : 0;
    const availableStock = inventory ? inventory.available_stock : 0;

    // 4. Resolve promotion
    const promotion = await promotionRepository.getActive(product.sku);

    // 5. Calculate authoritative pricing
    const basePrice = variant ? variant.price : product.base_price;
    let salePrice = product.sale_price !== null ? product.sale_price : basePrice;

    if (promotion && promotion.active) {
      const discounted = Math.round((basePrice * (100 - promotion.discount_percent)) / 100);
      salePrice = Math.min(salePrice, discounted);
    }

    // 6. Determine availability
    let availability: ProductAvailability = 'IN_STOCK';
    if (availableStock <= 0) {
      availability = 'OUT_OF_STOCK';
    } else if (availableStock <= (inventory?.low_stock_threshold || 10)) {
      availability = 'LOW_STOCK';
    }

    return {
      product,
      variant,
      price: basePrice,
      salePrice,
      priceFormatted: `Rp${basePrice.toLocaleString('id-ID')}`,
      salePriceFormatted: `Rp${salePrice.toLocaleString('id-ID')}`,
      promotion,
      stock: totalStock,
      availableStock,
      availability,
      verifiedAt,
      source: 'SUPABASE'
    };
  }
}

export const commerceDataService = new CommerceDataService();
