import { SyncConflict, SyncConflictStatus, SyncResolutionType, PlatformType } from '../db/schema';
import { supabaseManager } from '../db/supabaseClient';
import { db } from '../db';

export interface ConflictFilter {
  platform?: PlatformType;
  status?: SyncConflictStatus;
  entityId?: string;
}

export class SyncConflictRepository {
  public async getAll(filter?: ConflictFilter): Promise<SyncConflict[]> {
    const client = supabaseManager.getClient();
    if (client) {
      try {
        let query = client.from('sync_conflicts').select('*').order('created_at', { ascending: false });
        if (filter?.platform) query = query.eq('platform', filter.platform);
        if (filter?.status) query = query.eq('status', filter.status);
        if (filter?.entityId) query = query.eq('entity_id', filter.entityId);

        const { data, error } = await query;
        if (!error && data && data.length > 0) {
          return data as SyncConflict[];
        }
      } catch (err: any) {
        console.warn('[SyncConflictRepository] Supabase query failed, falling back to memory:', err.message);
      }
    }

    let conflicts = db.getSyncConflicts();
    if (filter?.platform) conflicts = conflicts.filter(c => c.platform === filter.platform);
    if (filter?.status) conflicts = conflicts.filter(c => c.status === filter.status);
    if (filter?.entityId) conflicts = conflicts.filter(c => c.entity_id === filter.entityId || c.sku === filter.entityId);
    return conflicts;
  }

  public async getById(id: string): Promise<SyncConflict | null> {
    const client = supabaseManager.getClient();
    if (client) {
      try {
        const { data, error } = await client
          .from('sync_conflicts')
          .select('*')
          .eq('id', id)
          .maybeSingle();

        if (!error && data) {
          return data as SyncConflict;
        }
      } catch (err: any) {
        console.warn('[SyncConflictRepository] Supabase getById failed:', err.message);
      }
    }
    return db.getSyncConflictById(id) || null;
  }

  public async getByFingerprint(fingerprint: string): Promise<SyncConflict | null> {
    const client = supabaseManager.getClient();
    if (client) {
      try {
        const { data, error } = await client
          .from('sync_conflicts')
          .select('*')
          .eq('fingerprint', fingerprint)
          .maybeSingle();

        if (!error && data) {
          return data as SyncConflict;
        }
      } catch (err: any) {
        console.warn('[SyncConflictRepository] Supabase getByFingerprint failed:', err.message);
      }
    }
    return db.syncConflicts.find(c => c.fingerprint === fingerprint) || null;
  }

  public async create(conflict: Partial<SyncConflict>): Promise<SyncConflict> {
    const platform = conflict.platform || 'TIKTOK';
    const entityType = conflict.entity_type || 'INVENTORY';
    const entityId = conflict.entity_id || conflict.sku || 'UNKNOWN';
    const externalId = conflict.external_id || 'UNKNOWN';
    const conflictType = conflict.conflict_type || (conflict.conflictType as any) || 'UNKNOWN_CONFLICT';
    const localVal = conflict.local_value || conflict.internalValue || {};
    const extVal = conflict.external_value || conflict.platformValue || {};

    const fingerprint = conflict.fingerprint || `${platform}:${entityType}:${entityId}:${conflictType}:${JSON.stringify(localVal)}:${JSON.stringify(extVal)}`;

    // Idempotency: Check if an open conflict with this fingerprint already exists
    const existing = await this.getByFingerprint(fingerprint);
    if (existing && existing.status === 'OPEN') {
      return existing;
    }

    const now = new Date().toISOString();
    const conflictPayload: Partial<SyncConflict> = {
      platform,
      entity_type: entityType,
      entity_id: entityId,
      external_id: externalId,
      conflict_type: conflictType,
      local_value: localVal,
      external_value: extVal,
      status: 'OPEN',
      resolution: null,
      resolved_by: null,
      resolved_at: null,
      fingerprint,
      notes: conflict.notes || null,
      created_at: now,
      updated_at: now
    };

    const client = supabaseManager.getClient();
    if (client) {
      try {
        const { data, error } = await client
          .from('sync_conflicts')
          .insert(conflictPayload)
          .select()
          .single();

        if (!error && data) {
          const created = data as SyncConflict;
          db.addSyncConflict(created);
          return created;
        }
      } catch (err: any) {
        console.warn('[SyncConflictRepository] Supabase insert failed, falling back to memory:', err.message);
      }
    }

    return db.addSyncConflict(conflictPayload);
  }

  public async resolve(
    id: string,
    resolution: SyncResolutionType,
    resolvedBy: string = 'OPERATOR',
    notes?: string
  ): Promise<SyncConflict | null> {
    const now = new Date().toISOString();
    const client = supabaseManager.getClient();

    if (client) {
      try {
        const { data, error } = await client
          .from('sync_conflicts')
          .update({
            status: 'RESOLVED',
            resolution,
            resolved_by: resolvedBy,
            resolved_at: now,
            updated_at: now,
            notes: notes || null
          })
          .eq('id', id)
          .select()
          .single();

        if (!error && data) {
          const resolved = data as SyncConflict;
          db.resolveSyncConflict(id, resolution, resolvedBy, notes);
          return resolved;
        }
      } catch (err: any) {
        console.warn('[SyncConflictRepository] Supabase resolve failed:', err.message);
      }
    }

    return db.resolveSyncConflict(id, resolution, resolvedBy, notes) || null;
  }
}

export const syncConflictRepository = new SyncConflictRepository();
