import { promotionRepository } from '../repositories/PromotionRepository';
import { Promotion } from '../db/schema';
import { db } from '../db';

export class PromotionService {
  public async getActivePromotion(sku: string): Promise<Promotion | null> {
    return promotionRepository.getActive(sku);
  }

  public async getPromotions(): Promise<Promotion[]> {
    return promotionRepository.getAll();
  }

  public async validatePromotion(sku: string): Promise<{
    valid: boolean;
    discountPercent: number;
    promo: Promotion | null;
    reason?: string;
  }> {
    const promo = await promotionRepository.getActive(sku);
    if (!promo) {
      return {
        valid: false,
        discountPercent: 0,
        promo: null,
        reason: `No active promotion found for SKU ${sku}`
      };
    }

    const now = Date.now();
    const start = new Date(promo.start_time).getTime();
    const end = new Date(promo.end_time).getTime();

    if (now < start || now > end) {
      return {
        valid: false,
        discountPercent: 0,
        promo: null,
        reason: `Promotion ${promo.title} has expired or is not yet active`
      };
    }

    return {
      valid: true,
      discountPercent: promo.discount_percent,
      promo
    };
  }

  public async getEffectivePrice(sku: string, basePrice: number): Promise<{
    effectivePrice: number;
    discountPercent: number;
    isDiscounted: boolean;
    promoTitle?: string;
  }> {
    const validation = await this.validatePromotion(sku);
    if (validation.valid && validation.promo) {
      const discountAmount = Math.round((basePrice * validation.discountPercent) / 100);
      const effectivePrice = Math.max(0, basePrice - discountAmount);
      return {
        effectivePrice,
        discountPercent: validation.discountPercent,
        isDiscounted: true,
        promoTitle: validation.promo.title
      };
    }

    return {
      effectivePrice: basePrice,
      discountPercent: 0,
      isDiscounted: false
    };
  }

  public async createPromotion(promoData: Partial<Promotion>): Promise<Promotion> {
    return promotionRepository.create(promoData);
  }

  public async updatePromotion(id: string, updates: Partial<Promotion>): Promise<Promotion | null> {
    return promotionRepository.update(id, updates);
  }
}

export const promotionService = new PromotionService();
