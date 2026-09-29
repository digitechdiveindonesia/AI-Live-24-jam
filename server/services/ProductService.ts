import { db } from '../db';
import { Product, ProductVariant, Inventory, Promotion } from '../db/schema';

export interface VerifiedProductFacts {
  sku: string;
  name: string;
  category: string;
  brand: string;
  basePrice: number;
  salePrice: number;
  currency: string;
  basePriceFormatted: string;
  salePriceFormatted: string;
  discountPercent: number;
  totalStock: number;
  availableStock: number;
  isLowStock: boolean;
  isOutOfStock: boolean;
  promoTitle: string;
  variants: ProductVariant[];
  bpomNumber: string;
  approvedClaims: string[];
  restrictedClaims: string[];
}

export class ProductService {
  public getAllProducts(): Product[] {
    return db.getAllProducts();
  }

  public getProductBySku(sku: string): Product | undefined {
    return db.getProductBySku(sku);
  }

  public getVariants(productId: string): ProductVariant[] {
    return db.getVariantsForProduct(productId);
  }

  public getInventory(sku: string): Inventory | undefined {
    return db.getInventory(sku);
  }

  public getActivePromotion(sku: string): Promotion | undefined {
    return db.getActivePromotion(sku);
  }

  public updateStock(sku: string, newStock: number): void {
    db.updateStock(sku, newStock);
  }
}

export class ProductIdentificationService {
  public identifyProduct(message: string, currentOnAirSku: string = 'SKU-001'): { identifiedSku: string; confidence: number; method: string } {
    const lower = message.toLowerCase();

    if (lower.includes('serum') || lower.includes('brightening') || lower.includes('booster') || lower.includes('sku-001')) {
      return { identifiedSku: 'SKU-001', confidence: 0.98, method: 'EXACT_ENTITY_MATCH' };
    }
    if (lower.includes('barrier') || lower.includes('ceramide') || lower.includes('cream') || lower.includes('sku-002')) {
      return { identifiedSku: 'SKU-002', confidence: 0.97, method: 'EXACT_ENTITY_MATCH' };
    }
    if (lower.includes('micellar') || lower.includes('cleanser') || lower.includes('makeup') || lower.includes('sku-003')) {
      return { identifiedSku: 'SKU-003', confidence: 0.96, method: 'EXACT_ENTITY_MATCH' };
    }
    if (lower.includes('sunscreen') || lower.includes('spf') || lower.includes('uv') || lower.includes('aqua') || lower.includes('sku-004')) {
      return { identifiedSku: 'SKU-004', confidence: 0.95, method: 'EXACT_ENTITY_MATCH' };
    }

    // Default to the currently featured on-air product in live broadcast context
    return { identifiedSku: currentOnAirSku, confidence: 0.85, method: 'CURRENT_ON_AIR_CONTEXT' };
  }
}

export class ProductVerificationService {
  public verifyProductData(sku: string): VerifiedProductFacts | null {
    const product = db.getProductBySku(sku);
    if (!product) return null;

    const inventory = db.getInventory(sku) || { total_stock: 0, reserved_stock: 0, available_stock: 0, low_stock_threshold: 10, sku, last_updated: '' };
    const promo = db.getActivePromotion(sku);
    const variants = db.getVariantsForProduct(product.id);

    const salePrice = product.sale_price !== null ? product.sale_price : product.base_price;
    const discountPercent = promo ? promo.discount_percent : (product.sale_price ? Math.round(((product.base_price - product.sale_price) / product.base_price) * 100) : 0);

    return {
      sku: product.sku,
      name: product.name,
      category: product.category,
      brand: product.brand,
      basePrice: product.base_price,
      salePrice: salePrice,
      currency: product.currency,
      basePriceFormatted: `Rp${product.base_price.toLocaleString('id-ID')}`,
      salePriceFormatted: `Rp${salePrice.toLocaleString('id-ID')}`,
      discountPercent: discountPercent,
      totalStock: inventory.total_stock,
      availableStock: inventory.available_stock,
      isLowStock: inventory.total_stock <= 10,
      isOutOfStock: inventory.total_stock <= 0,
      promoTitle: promo ? promo.title : `${discountPercent}% OFF Live Special`,
      variants,
      bpomNumber: product.metadata.bpom_number,
      approvedClaims: product.metadata.claims_approved || [],
      restrictedClaims: product.metadata.claims_restricted || []
    };
  }
}

export const productService = new ProductService();
export const productIdentificationService = new ProductIdentificationService();
export const productVerificationService = new ProductVerificationService();
