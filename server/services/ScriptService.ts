import { db } from '../db';
import { ScriptBlock, SellingScript } from '../db/schema';

export class ScriptService {
  public getActiveScript(sku: string = 'SKU-001'): SellingScript | undefined {
    return db.scripts.find(s => s.sku.toLowerCase() === sku.toLowerCase()) || db.scripts[0];
  }

  public getScriptForSku(sku: string = 'SKU-001'): SellingScript | undefined {
    return this.getActiveScript(sku);
  }

  public getScriptBlocks(scriptId?: string): ScriptBlock[] {
    if (scriptId) {
      return db.scriptBlocks.filter(b => b.script_id === scriptId);
    }
    return db.scriptBlocks;
  }

  public getActiveBlock(): ScriptBlock {
    return db.scriptBlocks.find(b => b.is_active) || db.scriptBlocks[4]; // Default PROMO
  }

  public advanceToBlock(blockId: string): ScriptBlock | undefined {
    let target: ScriptBlock | undefined;
    for (const b of db.scriptBlocks) {
      if (b.id === blockId) {
        b.is_active = true;
        target = b;
      } else {
        b.is_active = false;
      }
    }
    if (target) {
      db.logAudit('SCRIPT_ADVANCE', 'HOST_ENGINE', `Active script block set to ${target.step_name}`);
    }
    return target;
  }
}

export const scriptService = new ScriptService();
