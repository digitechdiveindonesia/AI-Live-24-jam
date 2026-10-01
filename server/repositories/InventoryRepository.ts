import { Inventory } from '../db/schema';
import { supabaseManager } from '../db/supabaseClient';
import { db } from '../db';

export class InventoryRepository {
  public async get(sku: string): Promise<Inventory | null> {
    const client = supabaseManager.getClient();
    if (client) {
      const { data, error } = await client
        .from('inventory')
        .select('*')
        .eq('sku', sku)
        .maybeSingle();

      if (!error && data) {
        return data as Inventory;
      }
    }
    return db.getInventory(sku) || null;
  }

  public async getAll(): Promise<Inventory[]> {
    const client = supabaseManager.getClient();
    if (client) {
      const { data, error } = await client
        .from('inventory')
        .select('*');

      if (!error && data && data.length > 0) {
        return data as Inventory[];
      }
    }
    return db.inventory;
  }

  public async update(sku: string, newStock: number): Promise<Inventory> {
    const now = new Date().toISOString();
    const client = supabaseManager.getClient();

    if (client) {
      const { data, error } = await client
        .from('inventory')
        .upsert({
          sku,
          total_stock: newStock,
          reserved_stock: 0,
          available_stock: newStock,
          low_stock_threshold: 10,
          last_updated: now
        }, { onConflict: 'sku' })
        .select()
        .single();

      if (!error && data) {
        const inv = data as Inventory;
        db.updateStock(sku, newStock);
        db.logAudit('INVENTORY_UPDATE', 'SYSTEM', `Stock for SKU ${sku} updated to ${newStock} (Supabase)`);
        return inv;
      }
    }

    db.updateStock(sku, newStock);
    db.logAudit('INVENTORY_UPDATE', 'SYSTEM', `Stock for SKU ${sku} updated to ${newStock}`);
    const localInv = db.getInventory(sku) || {
      sku,
      total_stock: newStock,
      reserved_stock: 0,
      available_stock: newStock,
      low_stock_threshold: 10,
      last_updated: now
    };
    return localInv;
  }

  public async reserve(sku: string, quantity: number): Promise<{ success: boolean; inventory?: Inventory; error?: string }> {
    const current = await this.get(sku);
    if (!current) {
      return { success: false, error: `SKU ${sku} not found in inventory` };
    }

    if (current.available_stock < quantity) {
      return {
        success: false,
        error: `Insufficient stock for SKU ${sku}. Requested: ${quantity}, Available: ${current.available_stock}`
      };
    }

    const updatedReserved = current.reserved_stock + quantity;
    const updatedAvailable = current.total_stock - updatedReserved;
    const now = new Date().toISOString();

    const client = supabaseManager.getClient();
    if (client) {
      const { data, error } = await client
        .from('inventory')
        .update({
          reserved_stock: updatedReserved,
          last_updated: now
        })
        .eq('sku', sku)
        .select()
        .single();

      if (!error && data) {
        const inv = data as Inventory;
        current.reserved_stock = updatedReserved;
        current.available_stock = updatedAvailable;
        db.logAudit('INVENTORY_RESERVED', 'SYSTEM', `Reserved ${quantity} units for ${sku}`);
        return { success: true, inventory: inv };
      }
    }

    current.reserved_stock = updatedReserved;
    current.available_stock = updatedAvailable;
    current.last_updated = now;
    db.logAudit('INVENTORY_RESERVED', 'SYSTEM', `Reserved ${quantity} units for ${sku}`);
    return { success: true, inventory: current };
  }

  public async release(sku: string, quantity: number): Promise<{ success: boolean; inventory?: Inventory; error?: string }> {
    const current = await this.get(sku);
    if (!current) {
      return { success: false, error: `SKU ${sku} not found in inventory` };
    }

    const updatedReserved = Math.max(0, current.reserved_stock - quantity);
    const updatedAvailable = current.total_stock - updatedReserved;
    const now = new Date().toISOString();

    const client = supabaseManager.getClient();
    if (client) {
      const { data, error } = await client
        .from('inventory')
        .update({
          reserved_stock: updatedReserved,
          last_updated: now
        })
        .eq('sku', sku)
        .select()
        .single();

      if (!error && data) {
        const inv = data as Inventory;
        current.reserved_stock = updatedReserved;
        current.available_stock = updatedAvailable;
        db.logAudit('INVENTORY_RELEASED', 'SYSTEM', `Released ${quantity} units for ${sku}`);
        return { success: true, inventory: inv };
      }
    }

    current.reserved_stock = updatedReserved;
    current.available_stock = updatedAvailable;
    current.last_updated = now;
    db.logAudit('INVENTORY_RELEASED', 'SYSTEM', `Released ${quantity} units for ${sku}`);
    return { success: true, inventory: current };
  }
}

export const inventoryRepository = new InventoryRepository();
