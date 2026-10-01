import { Product, ProductVariant } from '../db/schema';
import { supabaseManager } from '../db/supabaseClient';
import { db } from '../db';

export class ProductRepository {
  public async getAll(): Promise<Product[]> {
    const client = supabaseManager.getClient();
    if (client) {
      const { data, error } = await client
        .from('products')
        .select('*')
        .order('created_at', { ascending: true });

      if (!error && data && data.length > 0) {
        return data as Product[];
      }
    }
    // Fallback to local store if Supabase not configured or table empty in dev
    return db.getAllProducts();
  }

  public async getBySku(sku: string): Promise<Product | null> {
    const client = supabaseManager.getClient();
    if (client) {
      const { data, error } = await client
        .from('products')
        .select('*')
        .eq('sku', sku)
        .maybeSingle();

      if (!error && data) {
        return data as Product;
      }
    }
    return db.getProductBySku(sku) || null;
  }

  public async getById(id: string): Promise<Product | null> {
    const client = supabaseManager.getClient();
    if (client) {
      const { data, error } = await client
        .from('products')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (!error && data) {
        return data as Product;
      }
    }
    return db.getProductById(id) || null;
  }

  public async getVariants(productId: string): Promise<ProductVariant[]> {
    const client = supabaseManager.getClient();
    if (client) {
      const { data, error } = await client
        .from('product_variants')
        .select('*')
        .eq('product_id', productId);

      if (!error && data && data.length > 0) {
        return data as ProductVariant[];
      }
    }
    return db.getVariantsForProduct(productId);
  }

  public async getVariantBySku(sku: string): Promise<ProductVariant | null> {
    const client = supabaseManager.getClient();
    if (client) {
      const { data, error } = await client
        .from('product_variants')
        .select('*')
        .eq('sku', sku)
        .maybeSingle();

      if (!error && data) {
        return data as ProductVariant;
      }
    }
    const allVariants = db.variants;
    return allVariants.find(v => v.sku === sku) || null;
  }

  public async create(productData: Partial<Product>): Promise<Product> {
    const now = new Date().toISOString();
    const product: Product = {
      id: productData.id || `prod-${Date.now()}`,
      sku: productData.sku || `SKU-${Date.now().toString(36).toUpperCase()}`,
      name: productData.name || 'Unnamed Product',
      description: productData.description || '',
      category: productData.category || 'General',
      base_price: productData.base_price ?? 0,
      sale_price: productData.sale_price ?? null,
      currency: productData.currency || 'IDR',
      status: productData.status || 'ACTIVE',
      brand: productData.brand || 'Sari Glow Official',
      metadata: productData.metadata || {
        bpom_number: '',
        image_url: '',
        claims_approved: [],
        claims_restricted: []
      },
      created_at: now,
      updated_at: now
    };

    const client = supabaseManager.getClient();
    if (client) {
      const { data, error } = await client
        .from('products')
        .insert(product)
        .select()
        .single();

      if (!error && data) {
        db.products.push(data as Product);
        return data as Product;
      }
    }

    db.products.push(product);
    return product;
  }

  public async update(idOrSku: string, updates: Partial<Product>): Promise<Product | null> {
    const now = new Date().toISOString();
    const client = supabaseManager.getClient();

    if (client) {
      const { data, error } = await client
        .from('products')
        .update({ ...updates, updated_at: now })
        .or(`id.eq.${idOrSku},sku.eq.${idOrSku}`)
        .select()
        .maybeSingle();

      if (!error && data) {
        const prod = data as Product;
        const idx = db.products.findIndex(p => p.id === prod.id || p.sku === prod.sku);
        if (idx !== -1) db.products[idx] = prod;
        return prod;
      }
    }

    const target = db.products.find(p => p.id === idOrSku || p.sku === idOrSku);
    if (!target) return null;

    Object.assign(target, updates, { updated_at: now });
    return target;
  }
}

export const productRepository = new ProductRepository();
