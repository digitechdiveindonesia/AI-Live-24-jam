import { inventoryRepository } from '../repositories/InventoryRepository';
import { Inventory } from '../db/schema';
import { db } from '../db';

export class InventoryService {
  public async getStock(sku: string): Promise<Inventory | null> {
    return inventoryRepository.get(sku);
  }

  public async getAllStock(): Promise<Inventory[]> {
    return inventoryRepository.getAll();
  }

  public async reserveStock(sku: string, quantity: number, customerId?: string): Promise<{ success: boolean; inventory?: Inventory; error?: string }> {
    if (quantity <= 0) {
      return { success: false, error: 'Reservation quantity must be greater than zero' };
    }
    const result = await inventoryRepository.reserve(sku, quantity);
    if (result.success) {
      db.logAudit('INVENTORY_RESERVE_SUCCESS', customerId || 'COMMERCE_ENGINE', `Reserved ${quantity} units of ${sku}`);
    } else {
      db.logAudit('INVENTORY_RESERVE_FAILED', customerId || 'COMMERCE_ENGINE', `Failed to reserve ${quantity} units of ${sku}: ${result.error}`);
    }
    return result;
  }

  public async releaseStock(sku: string, quantity: number, reason?: string): Promise<{ success: boolean; inventory?: Inventory; error?: string }> {
    if (quantity <= 0) {
      return { success: false, error: 'Release quantity must be greater than zero' };
    }
    const result = await inventoryRepository.release(sku, quantity);
    db.logAudit('INVENTORY_RELEASE', 'COMMERCE_ENGINE', `Released ${quantity} units of ${sku}. Reason: ${reason || 'Cart expiry'}`);
    return result;
  }

  public async updateStock(sku: string, newStock: number, operator: string = 'OPERATOR'): Promise<Inventory> {
    if (newStock < 0) {
      throw new Error('Stock cannot be negative');
    }
    const updated = await inventoryRepository.update(sku, newStock);
    db.logAudit('INVENTORY_MANUAL_UPDATE', operator, `Updated ${sku} stock to ${newStock}`);
    return updated;
  }

  public async syncExternalInventory(sku: string, platformStock: number, platform: string): Promise<{
    synced: boolean;
    conflict: boolean;
    internalStock: number;
    platformStock: number;
  }> {
    const internal = await this.getStock(sku);
    const internalStock = internal ? internal.total_stock : 0;

    if (internalStock !== platformStock) {
      db.logAudit(
        'INVENTORY_SYNC_CONFLICT',
        'SYNC_ENGINE',
        `Discrepancy detected for ${sku} on ${platform}: Internal=${internalStock}, Platform=${platformStock}`
      );
      return {
        synced: false,
        conflict: true,
        internalStock,
        platformStock
      };
    }

    return {
      synced: true,
      conflict: false,
      internalStock,
      platformStock
    };
  }
}

export const inventoryService = new InventoryService();
