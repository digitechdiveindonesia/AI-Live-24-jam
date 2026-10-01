import { PlatformType, SyncConflict, SyncRun } from '../../db/schema';
import { productSyncService, ExternalProductSnapshot, NormalizedExternalSnapshot } from './ProductSyncService';
import { eventRepository, syncConflictRepository } from '../../repositories';
import { db } from '../../db';

export interface SyncRunReport {
  runId: string;
  platform: PlatformType;
  mode: 'MANUAL' | 'SCHEDULED' | 'WEBHOOK_TRIGGERED';
  status: 'COMPLETED' | 'FAILED' | 'PARTIAL';
  isSimulated: boolean;
  recordsExamined: number;
  conflictsDetected: number;
  conflictsCreated: number;
  conflicts: SyncConflict[];
  durationMs: number;
  timestamp: string;
  error?: string;
}

export class CommerceSyncWorker {
  private static instance: CommerceSyncWorker;

  private constructor() {}

  public static getInstance(): CommerceSyncWorker {
    if (!CommerceSyncWorker.instance) {
      CommerceSyncWorker.instance = new CommerceSyncWorker();
    }
    return CommerceSyncWorker.instance;
  }

  /**
   * Execute synchronization cycle for a platform.
   * Mode: MANUAL, SCHEDULED, or WEBHOOK_TRIGGERED.
   */
  public async runSync(
    platform: PlatformType,
    mode: 'MANUAL' | 'SCHEDULED' | 'WEBHOOK_TRIGGERED' = 'MANUAL',
    snapshotOverrides?: ExternalProductSnapshot[]
  ): Promise<SyncRunReport> {
    const runId = `sync-run-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const startMs = Date.now();

    // 1. Telemetry: SYNC_STARTED
    await eventRepository.recordHostEvent({
      sessionId: 'LIVE-001',
      eventType: 'SYNC_STARTED',
      stateFrom: 'STANDBY',
      stateTo: 'SYNCING',
      trigger: `COMMERCE_SYNC_WORKER:${mode}:${platform}`
    });

    db.logAudit(
      'SYNC_STARTED',
      'SYNC_WORKER',
      `Sync cycle initiated for ${platform} [Mode: ${mode}, RunID: ${runId}]`
    );

    try {
      // 2. Phase A: Fetch Snapshot
      const snapshot: NormalizedExternalSnapshot = await productSyncService.fetchSnapshot(
        platform,
        snapshotOverrides
      );

      await eventRepository.recordHostEvent({
        sessionId: 'LIVE-001',
        eventType: 'SYNC_FETCHED',
        stateFrom: 'SYNCING',
        stateTo: 'SYNCING',
        trigger: `FETCHED:${snapshot.products.length}_PRODUCTS`
      });

      // 3. Phase B: Compare against authoritative Supabase data
      const beforeConflicts = await syncConflictRepository.getAll({ platform, status: 'OPEN' });
      const detectedConflicts = await productSyncService.compareAndDetectConflicts(snapshot);
      const afterConflicts = await syncConflictRepository.getAll({ platform, status: 'OPEN' });
      const newlyCreatedCount = Math.max(0, afterConflicts.length - beforeConflicts.length);

      await eventRepository.recordHostEvent({
        sessionId: 'LIVE-001',
        eventType: 'SYNC_COMPARISON_COMPLETED',
        stateFrom: 'SYNCING',
        stateTo: 'COMPLETED',
        trigger: `EXAMINED:${snapshot.products.length}:CONFLICTS:${detectedConflicts.length}`
      });

      if (detectedConflicts.length > 0) {
        await eventRepository.recordHostEvent({
          sessionId: 'LIVE-001',
          eventType: 'SYNC_CONFLICT_CREATED',
          stateFrom: 'COMPLETED',
          stateTo: 'COMPLETED',
          trigger: `NEW_CONFLICTS:${newlyCreatedCount}`
        });
      }

      const durationMs = Date.now() - startMs;

      // 4. Record SyncRun in Database
      const runRecord: SyncRun = {
        id: runId,
        platform,
        mode,
        status: 'COMPLETED',
        is_simulated: snapshot.isSimulated,
        records_examined: snapshot.products.length,
        conflicts_detected: detectedConflicts.length,
        conflicts_created: newlyCreatedCount,
        started_at: new Date(startMs).toISOString(),
        completed_at: new Date().toISOString(),
        duration_ms: durationMs,
        errors: []
      };

      db.recordSyncRun(runRecord);

      db.logAudit(
        'SYNC_COMPLETED',
        'SYNC_WORKER',
        `Sync completed for ${platform}: ${snapshot.products.length} examined, ${detectedConflicts.length} conflicts (${newlyCreatedCount} new) in ${durationMs}ms [Simulated: ${snapshot.isSimulated}]`
      );

      return {
        runId,
        platform,
        mode,
        status: 'COMPLETED',
        isSimulated: snapshot.isSimulated,
        recordsExamined: snapshot.products.length,
        conflictsDetected: detectedConflicts.length,
        conflictsCreated: newlyCreatedCount,
        conflicts: detectedConflicts,
        durationMs,
        timestamp: new Date().toISOString()
      };
    } catch (err: any) {
      const durationMs = Date.now() - startMs;

      await eventRepository.recordHostEvent({
        sessionId: 'LIVE-001',
        eventType: 'SYNC_FAILED',
        stateFrom: 'SYNCING',
        stateTo: 'ERROR',
        trigger: `ERROR:${err.message}`
      });

      db.logAudit(
        'SYNC_FAILED',
        'SYNC_WORKER',
        `Sync cycle failed for ${platform}: ${err.message}`
      );

      const failedRun: SyncRun = {
        id: runId,
        platform,
        mode,
        status: 'FAILED',
        is_simulated: true,
        records_examined: 0,
        conflicts_detected: 0,
        conflicts_created: 0,
        started_at: new Date(startMs).toISOString(),
        completed_at: new Date().toISOString(),
        duration_ms: durationMs,
        errors: [err.message]
      };

      db.recordSyncRun(failedRun);

      return {
        runId,
        platform,
        mode,
        status: 'FAILED',
        isSimulated: true,
        recordsExamined: 0,
        conflictsDetected: 0,
        conflictsCreated: 0,
        conflicts: [],
        durationMs,
        timestamp: new Date().toISOString(),
        error: err.message
      };
    }
  }
}

export const commerceSyncWorker = CommerceSyncWorker.getInstance();
