import { Promotion } from '../db/schema';
import { supabaseManager } from '../db/supabaseClient';
import { db } from '../db';

export class PromotionRepository {
  public async getActive(sku: string): Promise<Promotion | null> {
    const client = supabaseManager.getClient();
    if (client) {
      const now = new Date().toISOString();
      const { data, error } = await client
        .from('promotions')
        .select('*')
        .eq('sku', sku)
        .eq('active', true)
        .lte('start_time', now)
        .gte('end_time', now)
        .maybeSingle();

      if (!error && data) {
        return data as Promotion;
      }
    }
    return db.getActivePromotion(sku) || null;
  }

  public async getActiveBySku(sku: string): Promise<Promotion | null> {
    return this.getActive(sku);
  }


  public async getAll(): Promise<Promotion[]> {
    const client = supabaseManager.getClient();
    if (client) {
      const { data, error } = await client
        .from('promotions')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        return data as Promotion[];
      }
    }
    return db.promotions;
  }

  public async create(promoData: Partial<Promotion>): Promise<Promotion> {
    const now = new Date().toISOString();
    const promotion: Promotion = {
      id: promoData.id || `promo-${Date.now()}`,
      sku: promoData.sku || 'SKU-001',
      title: promoData.title || 'Flash Sale Promo',
      discount_percent: promoData.discount_percent ?? 10,
      active: promoData.active ?? true,
      start_time: promoData.start_time || now,
      end_time: promoData.end_time || new Date(Date.now() + 86400000).toISOString()
    };

    const client = supabaseManager.getClient();
    if (client) {
      const { data, error } = await client
        .from('promotions')
        .insert(promotion)
        .select()
        .single();

      if (!error && data) {
        db.promotions.push(data as Promotion);
        db.logAudit('PROMOTION_CREATED', 'SYSTEM', `Created promotion ${promotion.title} for ${promotion.sku}`);
        return data as Promotion;
      }
    }

    db.promotions.push(promotion);
    db.logAudit('PROMOTION_CREATED', 'SYSTEM', `Created promotion ${promotion.title} for ${promotion.sku}`);
    return promotion;
  }

  public async update(id: string, updates: Partial<Promotion>): Promise<Promotion | null> {
    const client = supabaseManager.getClient();
    if (client) {
      const { data, error } = await client
        .from('promotions')
        .update(updates)
        .eq('id', id)
        .select()
        .maybeSingle();

      if (!error && data) {
        const promo = data as Promotion;
        const idx = db.promotions.findIndex(p => p.id === id);
        if (idx !== -1) db.promotions[idx] = promo;
        db.logAudit('PROMOTION_UPDATED', 'SYSTEM', `Updated promotion ${id}`);
        return promo;
      }
    }

    const target = db.promotions.find(p => p.id === id);
    if (!target) return null;
    Object.assign(target, updates);
    db.logAudit('PROMOTION_UPDATED', 'SYSTEM', `Updated promotion ${id}`);
    return target;
  }
}

export const promotionRepository = new PromotionRepository();
