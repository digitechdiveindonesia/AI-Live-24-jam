import { ExternalProductMapping, PlatformType } from '../db/schema';
import { supabaseManager } from '../db/supabaseClient';
import { db } from '../db';

export class ExternalMappingRepository {
  public async getAll(filter?: { platform?: PlatformType; productId?: string; externalSku?: string }): Promise<ExternalProductMapping[]> {
    const client = supabaseManager.getClient();
    if (client) {
      try {
        let query = client.from('external_product_mappings').select('*');
        if (filter?.platform) query = query.eq('platform', filter.platform);
        if (filter?.productId) query = query.eq('product_id', filter.productId);
        if (filter?.externalSku) query = query.eq('external_sku', filter.externalSku);

        const { data, error } = await query;
        if (!error && data && data.length > 0) {
          return data as ExternalProductMapping[];
        }
      } catch (err: any) {
        console.warn('[ExternalMappingRepository] Supabase query failed:', err.message);
      }
    }
    return db.getExternalMappings(filter);
  }

  public async getByExternalSku(platform: PlatformType, externalSku: string): Promise<ExternalProductMapping | null> {
    const client = supabaseManager.getClient();
    if (client) {
      try {
        const { data, error } = await client
          .from('external_product_mappings')
          .select('*')
          .eq('platform', platform)
          .eq('external_sku', externalSku)
          .maybeSingle();

        if (!error && data) {
          return data as ExternalProductMapping;
        }
      } catch (err: any) {
        console.warn('[ExternalMappingRepository] Supabase getByExternalSku failed:', err.message);
      }
    }
    const mapping = db.getExternalMappingBySku(platform, externalSku);
    return mapping || null;
  }

  public async getByProductId(platform: PlatformType, productId: string): Promise<ExternalProductMapping | null> {
    const client = supabaseManager.getClient();
    if (client) {
      try {
        const { data, error } = await client
          .from('external_product_mappings')
          .select('*')
          .eq('platform', platform)
          .eq('product_id', productId)
          .maybeSingle();

        if (!error && data) {
          return data as ExternalProductMapping;
        }
      } catch (err: any) {
        console.warn('[ExternalMappingRepository] Supabase getByProductId failed:', err.message);
      }
    }
    const mapping = db.externalMappings.find(m => m.platform === platform && m.product_id === productId);
    return mapping || null;
  }

  public async upsert(mapping: Omit<ExternalProductMapping, 'id' | 'created_at' | 'updated_at'> & { id?: string }): Promise<ExternalProductMapping> {
    const now = new Date().toISOString();
    const client = supabaseManager.getClient();

    if (client) {
      try {
        const { data, error } = await client
          .from('external_product_mappings')
          .upsert({
            ...mapping,
            updated_at: now
          }, { onConflict: 'platform,external_sku' })
          .select()
          .single();

        if (!error && data) {
          const res = data as ExternalProductMapping;
          db.saveExternalMapping(res);
          return res;
        }
      } catch (err: any) {
        console.warn('[ExternalMappingRepository] Supabase upsert failed:', err.message);
      }
    }

    return db.saveExternalMapping(mapping);
  }
}

export const externalMappingRepository = new ExternalMappingRepository();
