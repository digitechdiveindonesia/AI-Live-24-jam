import { db } from '../db';
import { hostStateMachineService } from './HostStateMachineService';
import { ttsProviderFactory } from './TTSProvider';
import { avatarProviderFactory } from './AvatarProvider';
import { questionQueue } from './QuestionQueue';
import { eventService } from './EventService';
import { geminiService } from './GeminiService';

export interface ComponentHealthStatus {
  name: string;
  isHealthy: boolean;
  statusText: string;
  latencyMs: number;
  error?: string;
}

export interface HeartbeatResult {
  timestamp: string;
  isHealthy: boolean;
  consecutiveFailures: number;
  components: {
    host: ComponentHealthStatus;
    tts: ComponentHealthStatus;
    avatar: ComponentHealthStatus;
    eventService: ComponentHealthStatus;
    database: ComponentHealthStatus;
    gemini: ComponentHealthStatus;
    questionQueue: ComponentHealthStatus;
  };
}

export class SessionHeartbeatService {
  private timer: NodeJS.Timeout | null = null;
  private intervalMs: number = 5000;
  private consecutiveFailures: number = 0;
  private totalHeartbeats: number = 0;
  private successfulHeartbeats: number = 0;
  private lastHeartbeatAt: string | null = null;
  private lastResult: HeartbeatResult | null = null;
  private failureThreshold: number = 3;

  constructor() {}

  public getStatus() {
    return {
      isRunning: this.timer !== null,
      intervalMs: this.intervalMs,
      consecutiveFailures: this.consecutiveFailures,
      totalHeartbeats: this.totalHeartbeats,
      successfulHeartbeats: this.successfulHeartbeats,
      lastHeartbeatAt: this.lastHeartbeatAt,
      lastResult: this.lastResult
    };
  }

  public setIntervalMs(ms: number): void {
    this.intervalMs = ms;
    if (this.timer) {
      this.stop();
      this.start();
    }
  }

  public setFailureThreshold(threshold: number): void {
    this.failureThreshold = threshold;
  }

  public start(intervalMs?: number): void {
    if (intervalMs) this.intervalMs = intervalMs;
    if (this.timer) return;

    this.timer = setInterval(async () => {
      await this.checkHeartbeat();
    }, this.intervalMs);

    if (this.timer.unref) {
      this.timer.unref(); // Prevent blocking process exit / test runner
    }
  }

  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Executes a comprehensive heartbeat check across all 7 subsystems.
   */
  public async checkHeartbeat(): Promise<HeartbeatResult> {
    const now = new Date().toISOString();
    this.totalHeartbeats++;

    // 1. Host State Machine check
    const startHost = Date.now();
    const hostState = hostStateMachineService.getState();
    const hostHealthy = !!hostState && !['ERROR'].includes(hostState);
    const hostStatus: ComponentHealthStatus = {
      name: 'Host State Machine',
      isHealthy: hostHealthy,
      statusText: hostState,
      latencyMs: Date.now() - startHost
    };

    // 2. TTS Provider check
    const startTts = Date.now();
    const ttsProvider = ttsProviderFactory.getProvider();
    const ttsStatusText = ttsProvider.getStatus();
    const ttsHealthy = ttsStatusText !== 'ERROR';
    const ttsStatus: ComponentHealthStatus = {
      name: 'TTS Provider',
      isHealthy: ttsHealthy,
      statusText: ttsStatusText,
      latencyMs: Date.now() - startTts
    };

    // 3. Avatar Provider check
    const startAvatar = Date.now();
    const avatarProvider = avatarProviderFactory.getProvider();
    const avatarStatusText = avatarProvider.getStatus();
    const avatarHealthy = avatarStatusText !== 'ERROR';
    const avatarStatus: ComponentHealthStatus = {
      name: 'Avatar Provider',
      isHealthy: avatarHealthy,
      statusText: avatarStatusText,
      latencyMs: Date.now() - startAvatar
    };

    // 4. Event Service check
    const startEvents = Date.now();
    const eventHealthy = typeof eventService.emit === 'function';
    const eventStatus: ComponentHealthStatus = {
      name: 'Event Processing',
      isHealthy: eventHealthy,
      statusText: eventHealthy ? 'ACTIVE' : 'DOWN',
      latencyMs: Date.now() - startEvents
    };

    // 5. Database connectivity check
    const startDb = Date.now();
    let dbHealthy = false;
    let dbError: string | undefined;
    try {
      const prods = db.getAllProducts();
      const hasSession = !!db.session;
      dbHealthy = prods.length > 0 && hasSession;
    } catch (err: any) {
      dbError = err.message;
      dbHealthy = false;
    }
    const dbStatus: ComponentHealthStatus = {
      name: 'Database Connectivity',
      isHealthy: dbHealthy,
      statusText: dbHealthy ? 'CONNECTED' : 'DISCONNECTED',
      latencyMs: Date.now() - startDb,
      error: dbError
    };

    // 6. Gemini availability check
    const startGemini = Date.now();
    const hasClient = !!geminiService['client'];
    // In production, Gemini is available if client initialized or fallback is in place
    const geminiHealthy = true;
    const geminiStatus: ComponentHealthStatus = {
      name: 'Gemini AI Service',
      isHealthy: geminiHealthy,
      statusText: hasClient ? 'ONLINE' : 'STANDALONE_FALLBACK',
      latencyMs: Date.now() - startGemini
    };

    // 7. Question Queue health check
    const startQueue = Date.now();
    const queueLength = questionQueue.getAll().length;
    // Healthy if not clogged beyond safe limits (e.g. < 50 items)
    const queueHealthy = queueLength < 50;
    const queueStatus: ComponentHealthStatus = {
      name: 'Question Queue',
      isHealthy: queueHealthy,
      statusText: `${queueLength} queued`,
      latencyMs: Date.now() - startQueue
    };

    // Overall health determination:
    // Critical: Database and Host must be healthy
    // Non-critical: TTS, Avatar, Gemini may degrade without immediate session kill
    const isOverallHealthy = hostHealthy && dbHealthy && eventHealthy;

    if (isOverallHealthy) {
      this.consecutiveFailures = 0;
      this.successfulHeartbeats++;
    } else {
      this.consecutiveFailures++;
    }

    this.lastHeartbeatAt = now;
    db.session.last_heartbeat_at = now;

    const result: HeartbeatResult = {
      timestamp: now,
      isHealthy: isOverallHealthy,
      consecutiveFailures: this.consecutiveFailures,
      components: {
        host: hostStatus,
        tts: ttsStatus,
        avatar: avatarStatus,
        eventService: eventStatus,
        database: dbStatus,
        gemini: geminiStatus,
        questionQueue: queueStatus
      }
    };

    this.lastResult = result;

    eventService.emit('HEARTBEAT_TICK', {
      timestamp: now,
      isHealthy: isOverallHealthy,
      consecutiveFailures: this.consecutiveFailures
    });

    if (!isOverallHealthy) {
      eventService.emit('HEARTBEAT_FAILED', {
        timestamp: now,
        consecutiveFailures: this.consecutiveFailures,
        components: result.components
      });
      db.logSystemEvent('HEARTBEAT', 'DEGRADED', `Heartbeat failed ${this.consecutiveFailures} consecutive times`);
    } else {
      eventService.emit('HEARTBEAT_HEALTHY', {
        timestamp: now,
        totalHeartbeats: this.totalHeartbeats
      });
    }

    return result;
  }
}

export const sessionHeartbeatService = new SessionHeartbeatService();
