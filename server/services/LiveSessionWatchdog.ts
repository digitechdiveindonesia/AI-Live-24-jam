import { db } from '../db';
import { StallType } from '../db/schema';
import { hostStateMachineService } from './HostStateMachineService';
import { ttsProviderFactory } from './TTSProvider';
import { avatarProviderFactory } from './AvatarProvider';
import { questionQueue } from './QuestionQueue';
import { eventService } from './EventService';
import { recoveryService } from './RecoveryService';
import { sessionHeartbeatService } from './SessionHeartbeatService';

export interface WatchdogConfig {
  heartbeatStaleMs: number;
  hostStateStaleMs: number;
  ttsStaleMs: number;
  avatarStaleMs: number;
  queueStaleMs: number;
  eventLoopStaleMs: number;
  checkIntervalMs: number;
}

export const DEFAULT_WATCHDOG_CONFIG: WatchdogConfig = {
  heartbeatStaleMs: 15000,
  hostStateStaleMs: 30000,
  ttsStaleMs: 15000,
  avatarStaleMs: 15000,
  queueStaleMs: 45000,
  eventLoopStaleMs: 15000,
  checkIntervalMs: 5000
};

export interface WatchdogStallDetail {
  stallType: StallType;
  message: string;
  detectedAt: string;
  durationMs: number;
}

export interface WatchdogReport {
  timestamp: string;
  isHealthy: boolean;
  stalls: WatchdogStallDetail[];
  metrics: {
    lastHeartbeatAgeMs: number;
    lastHostActivityAgeMs: number;
    lastEventLoopAgeMs: number;
    queueAgeMs: number;
    ttsStatus: string;
    avatarStatus: string;
  };
}

export class LiveSessionWatchdog {
  private config: WatchdogConfig;
  private timer: NodeJS.Timeout | null = null;
  private lastHostActivityAt: number = Date.now();
  private lastEventLoopActivityAt: number = Date.now();
  private lastSellingProgressAt: number = Date.now();
  private ttsActiveSince: number | null = null;
  private avatarActiveSince: number | null = null;
  private oldestQueuedItemAt: number | null = null;
  private stallHistory: WatchdogStallDetail[] = [];

  constructor(config: Partial<WatchdogConfig> = {}) {
    this.config = { ...DEFAULT_WATCHDOG_CONFIG, ...config };
  }

  public getConfig(): WatchdogConfig {
    return { ...this.config };
  }

  public setConfig(updates: Partial<WatchdogConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  public getStallHistory(): WatchdogStallDetail[] {
    return [...this.stallHistory];
  }

  public clearHistory(): void {
    this.stallHistory = [];
  }

  // Activity Recorders
  public recordHostActivity(): void {
    this.lastHostActivityAt = Date.now();
  }

  public recordEventLoopActivity(): void {
    this.lastEventLoopActivityAt = Date.now();
  }

  public recordSellingProgress(): void {
    this.lastSellingProgressAt = Date.now();
    this.recordHostActivity();
  }

  public recordTtsStart(): void {
    this.ttsActiveSince = Date.now();
  }

  public recordTtsEnd(): void {
    this.ttsActiveSince = null;
  }

  public recordAvatarStart(): void {
    this.avatarActiveSince = Date.now();
  }

  public recordAvatarEnd(): void {
    this.avatarActiveSince = null;
  }

  public recordQueueActivity(hasItems: boolean): void {
    if (hasItems) {
      if (!this.oldestQueuedItemAt) this.oldestQueuedItemAt = Date.now();
    } else {
      this.oldestQueuedItemAt = null;
    }
  }

  public start(checkIntervalMs?: number): void {
    if (checkIntervalMs) this.config.checkIntervalMs = checkIntervalMs;
    if (this.timer) return;

    this.timer = setInterval(async () => {
      await this.check();
    }, this.config.checkIntervalMs);

    if (this.timer.unref) {
      this.timer.unref();
    }
  }

  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Evaluates all watchdog subsystems for stalls or hangs.
   */
  public async check(): Promise<WatchdogReport> {
    const now = Date.now();
    const isoNow = new Date(now).toISOString();
    const stalls: WatchdogStallDetail[] = [];

    this.recordEventLoopActivity();

    // 1. Heartbeat Freshness
    const lastHb = sessionHeartbeatService.getStatus().lastHeartbeatAt;
    const lastHbTime = lastHb ? new Date(lastHb).getTime() : now;
    const hbAge = now - lastHbTime;
    if (lastHb && hbAge > this.config.heartbeatStaleMs) {
      stalls.push({
        stallType: 'SESSION_STALLED',
        message: `Heartbeat stale for ${Math.round(hbAge / 1000)}s (threshold ${this.config.heartbeatStaleMs / 1000}s)`,
        detectedAt: isoNow,
        durationMs: hbAge
      });
    }

    // 2. Host State Freshness
    const hostState = hostStateMachineService.getState();
    const hostAge = now - this.lastHostActivityAt;
    // Host in transient answering/transition states for too long is stalled
    const transientStates = ['THINKING', 'TRANSITION', 'RESUMING', 'INTERRUPTED'];
    if (transientStates.includes(hostState) && hostAge > this.config.hostStateStaleMs) {
      stalls.push({
        stallType: 'HOST_STALLED',
        message: `Host stuck in transient state '${hostState}' for ${Math.round(hostAge / 1000)}s`,
        detectedAt: isoNow,
        durationMs: hostAge
      });
    }

    // 3. TTS Provider Activity
    const ttsStatus = ttsProviderFactory.getProvider().getStatus();
    if (ttsStatus === 'GENERATING' || ttsStatus === 'PLAYING') {
      const activeAge = this.ttsActiveSince ? now - this.ttsActiveSince : this.config.ttsStaleMs + 1000;
      if (activeAge > this.config.ttsStaleMs) {
        stalls.push({
          stallType: 'TTS_STALLED',
          message: `TTS audio stuck in state '${ttsStatus}' for ${Math.round(activeAge / 1000)}s`,
          detectedAt: isoNow,
          durationMs: activeAge
        });
      }
    }

    // 4. Avatar Provider Activity
    const avatarStatus = avatarProviderFactory.getProvider().getStatus();
    if (avatarStatus === 'SPEAKING') {
      const activeAge = this.avatarActiveSince ? now - this.avatarActiveSince : this.config.avatarStaleMs + 1000;
      if (activeAge > this.config.avatarStaleMs) {
        stalls.push({
          stallType: 'AVATAR_STALLED',
          message: `Avatar animation stuck in state 'SPEAKING' for ${Math.round(activeAge / 1000)}s`,
          detectedAt: isoNow,
          durationMs: activeAge
        });
      }
    }

    // 5. Question Queue Stall
    const queue = questionQueue.getAll();
    if (queue.length > 0 && this.oldestQueuedItemAt) {
      const queueAge = now - this.oldestQueuedItemAt;
      if (queueAge > this.config.queueStaleMs) {
        stalls.push({
          stallType: 'QUEUE_STALLED',
          message: `Queue has ${queue.length} unserviced items older than ${Math.round(queueAge / 1000)}s`,
          detectedAt: isoNow,
          durationMs: queueAge
        });
      }
    }

    // Record stalls and trigger automated recovery
    for (const stall of stalls) {
      this.stallHistory.unshift(stall);
      eventService.emit('WATCHDOG_STALL_DETECTED', stall);
      db.logSystemEvent('WATCHDOG', 'DEGRADED', `${stall.stallType}: ${stall.message}`);

      // Automated targeted recovery based on stall type
      if (stall.stallType === 'TTS_STALLED') {
        await recoveryService.recoverTTS(stall.message);
        this.recordTtsEnd();
      } else if (stall.stallType === 'AVATAR_STALLED') {
        await recoveryService.recoverAvatar(stall.message);
        this.recordAvatarEnd();
      } else if (stall.stallType === 'HOST_STALLED') {
        await recoveryService.recoverHostStall(stall.message);
        this.recordHostActivity();
      } else if (stall.stallType === 'QUEUE_STALLED') {
        await recoveryService.recoverQueueStall(stall.message);
        this.oldestQueuedItemAt = null;
      }
    }

    const report: WatchdogReport = {
      timestamp: isoNow,
      isHealthy: stalls.length === 0,
      stalls,
      metrics: {
        lastHeartbeatAgeMs: hbAge,
        lastHostActivityAgeMs: hostAge,
        lastEventLoopAgeMs: now - this.lastEventLoopActivityAt,
        queueAgeMs: this.oldestQueuedItemAt ? now - this.oldestQueuedItemAt : 0,
        ttsStatus,
        avatarStatus
      }
    };

    return report;
  }
}

export const liveSessionWatchdog = new LiveSessionWatchdog();
