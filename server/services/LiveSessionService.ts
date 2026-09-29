import { db } from '../db';
import { LiveSession, LiveSessionStatus, DegradedMode } from '../db/schema';
import { hostStateMachineService } from './HostStateMachineService';
import { ttsProviderFactory } from './TTSProvider';
import { avatarProviderFactory } from './AvatarProvider';
import { eventService } from './EventService';
import { scriptService } from './ScriptService';
import { productVerificationService } from './ProductService';
import { voiceOrchestrator } from './VoiceOrchestrator';
import { sessionHeartbeatService } from './SessionHeartbeatService';
import { liveSessionWatchdog } from './LiveSessionWatchdog';
import { recoveryService } from './RecoveryService';

export interface StartSessionOptions {
  sessionCode?: string;
  title?: string;
  sku?: string;
  allowMultiple?: boolean;
  heartbeatIntervalMs?: number;
}

export interface StopSessionOptions {
  reason?: string;
  cancelCurrentResponse?: boolean;
}

export class LiveSessionService {
  private isAutonomousSessionActive: boolean = false;
  private isAcceptingCustomers: boolean = true;
  private sellingLoopActive: boolean = false;

  constructor() {}

  public getSession(): LiveSession {
    return db.session;
  }

  public getStatus(): LiveSessionStatus {
    return db.session.status;
  }

  public isAcceptingNewCustomers(): boolean {
    return this.isAcceptingCustomers && db.session.status === 'RUNNING';
  }

  public isSellingLoopActive(): boolean {
    return this.sellingLoopActive;
  }

  /**
   * Safely transitions the live session through verified lifecycle states.
   */
  public transitionTo(nextState: LiveSessionStatus, reason: string): LiveSession {
    const prevState = db.session.status;
    db.session.status = nextState;
    db.session.updated_at = new Date().toISOString();

    if (nextState === 'DEGRADED') {
      db.session.degraded_since = db.session.degraded_since || new Date().toISOString();
    } else if (nextState === 'RUNNING') {
      db.session.degraded_since = null;
      db.session.degraded_mode = 'NONE';
    } else if (nextState === 'STOPPED' || nextState === 'FAILED') {
      db.session.ended_at = new Date().toISOString();
      this.isAutonomousSessionActive = false;
      this.sellingLoopActive = false;
    }

    eventService.emit('SESSION_STATE_TRANSITION', {
      from: prevState,
      to: nextState,
      reason,
      sessionCode: db.session.session_code,
      timestamp: new Date().toISOString()
    });

    db.logHostEvent(db.session.id, 'LIFECYCLE_TRANSITION', prevState, nextState, reason);
    db.logSystemEvent('SESSION_LIFECYCLE', nextState === 'FAILED' ? 'DOWN' : nextState === 'DEGRADED' ? 'DEGRADED' : 'HEALTHY', `Session transitioned to ${nextState}: ${reason}`);

    return db.session;
  }

  /**
   * Starts a new autonomous live session following the 11-step resilient startup sequence.
   */
  public async startLiveSession(options: StartSessionOptions = {}): Promise<LiveSession> {
    const sku = options.sku || db.session.current_sku || 'SKU-001';

    // Enforcement: Only one active autonomous session allowed
    if (this.isAutonomousSessionActive && !options.allowMultiple && ['RUNNING', 'STARTING', 'CONNECTING'].includes(db.session.status)) {
      throw new Error(`Cannot start new session: Active autonomous session [${db.session.session_code}] is already controlling the host.`);
    }

    const now = new Date().toISOString();
    const sessionCode = options.sessionCode || `LIVE-${Date.now().toString(36).toUpperCase()}`;

    // 1. CREATE SESSION
    db.resetLiveSession({
      session_code: sessionCode,
      title: options.title || 'Live Streaming Broadcast',
      current_sku: sku,
      status: 'CREATED'
    });
    this.isAutonomousSessionActive = true;
    this.isAcceptingCustomers = true;

    eventService.emit('SESSION_CREATED', {
      sessionId: db.session.id,
      sessionCode,
      timestamp: now
    });

    // STARTING
    this.transitionTo('STARTING', 'Beginning subsystem initialization');
    eventService.emit('SESSION_STARTING', { sessionCode, timestamp: new Date().toISOString() });

    eventService.emit('SERVICE_INITIALIZATION_STARTED', {
      services: ['HOST', 'TTS', 'AVATAR', 'EVENT_SYSTEM', 'PRODUCT_DB', 'SCRIPT_ENGINE'],
      timestamp: new Date().toISOString()
    });

    // 2. INITIALIZE HOST
    hostStateMachineService.reset();
    hostStateMachineService.transitionTo('INTRO', 'Session started');
    db.session.current_host_state = 'INTRO';
    db.session.active_state = 'INTRO';
    db.session.is_ai_host_on = true;
    db.session.is_paused = false;

    // 3. INITIALIZE TTS
    let ttsOk = true;
    try {
      await ttsProviderFactory.getProvider().initialize();
    } catch (err: any) {
      ttsOk = false;
      db.logSystemEvent('TTS_INIT', 'DEGRADED', `TTS init warning: ${err.message}`);
    }

    // 4. INITIALIZE AVATAR
    let avatarOk = true;
    try {
      await avatarProviderFactory.getProvider().initialize();
    } catch (err: any) {
      avatarOk = false;
      db.logSystemEvent('AVATAR_INIT', 'DEGRADED', `Avatar init warning: ${err.message}`);
    }

    // 5. INITIALIZE EVENT SYSTEM
    eventService.emit('SERVICE_INITIALIZATION_COMPLETED', {
      tts: ttsOk ? 'OK' : 'DEGRADED',
      avatar: avatarOk ? 'OK' : 'DEGRADED',
      timestamp: new Date().toISOString()
    });

    // 6. LOAD CURRENT PRODUCT (Critical check)
    const verifiedProduct = productVerificationService.verifyProductData(sku);
    if (!verifiedProduct || !verifiedProduct.basePrice) {
      this.transitionTo('FAILED', `Critical dependency error: SKU '${sku}' cannot be verified in authoritative product database`);
      throw new Error(`Startup aborted: SKU '${sku}' failed authoritative verification`);
    }
    db.session.current_product_id = verifiedProduct.sku;

    // 7. LOAD SELLING SCRIPT (Critical check)
    const script = scriptService.getScriptForSku(sku);
    if (!script) {
      this.transitionTo('FAILED', `Critical dependency error: No selling script found for SKU '${sku}'`);
      throw new Error(`Startup aborted: No selling script available for SKU '${sku}'`);
    }
    const activeBlock = scriptService.getActiveBlock();
    db.session.current_script_id = script.id;
    db.session.current_script_block_id = activeBlock?.id || 'sb-1';

    // CONNECTING
    this.transitionTo('CONNECTING', 'Verifying connectivity and health checks');

    // 8. RUN HEALTH CHECK
    const hb = await sessionHeartbeatService.checkHeartbeat();
    eventService.emit('SESSION_HEALTH_CHECK', {
      isHealthy: hb.isHealthy,
      consecutiveFailures: hb.consecutiveFailures,
      timestamp: new Date().toISOString()
    });

    if (!hb.isHealthy) {
      // If critical DB is failing
      if (!hb.components.database.isHealthy) {
        this.transitionTo('FAILED', 'Critical database failure during startup health check');
        throw new Error('Startup aborted: Database health check failed');
      }
    }

    // 9. START HEARTBEAT & WATCHDOG
    sessionHeartbeatService.start(options.heartbeatIntervalMs || 5000);
    liveSessionWatchdog.start();

    // 10. START SELLING LOOP
    this.sellingLoopActive = true;
    db.session.started_at = new Date().toISOString();
    db.session.platform_status = 'BROADCASTING';

    // 11. Final state determination:
    // If non-critical services (TTS or Avatar) failed initialization, start in DEGRADED mode
    if (!ttsOk) {
      recoveryService.setDegradedMode('TEXT_ONLY', 'TTS provider failed during startup');
      this.transitionTo('DEGRADED', 'Started in DEGRADED (TEXT_ONLY) mode due to TTS failure');
    } else if (!avatarOk) {
      recoveryService.setDegradedMode('VOICE_ONLY', 'Avatar provider failed during startup');
      this.transitionTo('DEGRADED', 'Started in DEGRADED (VOICE_ONLY) mode due to Avatar failure');
    } else {
      this.transitionTo('RUNNING', 'All startup checks passed, autonomous broadcast live');
    }

    eventService.emit('LIVE_STARTED', {
      sessionId: db.session.id,
      sessionCode: db.session.session_code,
      sku: db.session.current_sku,
      mode: db.session.degraded_mode || 'NONE',
      status: db.session.status,
      timestamp: new Date().toISOString()
    });

    return db.session;
  }

  /**
   * Gracefully shuts down the active live session.
   */
  public async stopLiveSession(options: StopSessionOptions = {}): Promise<LiveSession> {
    if (db.session.status === 'STOPPED' || db.session.status === 'STOPPING') {
      return db.session;
    }

    this.transitionTo('STOPPING', options.reason || 'Normal shutdown requested');
    eventService.emit('LIVE_STOPPING', {
      sessionCode: db.session.session_code,
      reason: options.reason || 'Manual stop',
      timestamp: new Date().toISOString()
    });

    // 1. STOP NEW CUSTOMER PROCESSING
    this.isAcceptingCustomers = false;

    // 2. FINISH OR CANCEL CURRENT RESPONSE SAFELY
    if (options.cancelCurrentResponse ?? true) {
      await voiceOrchestrator.stop();
    }

    // 3. STOP TTS
    try {
      await ttsProviderFactory.getProvider().stop();
      eventService.emit('TTS_STOPPED', { timestamp: new Date().toISOString() });
    } catch (e) {}

    // 4. STOP AVATAR
    try {
      await avatarProviderFactory.getProvider().stop();
      eventService.emit('AVATAR_STOPPED', { timestamp: new Date().toISOString() });
    } catch (e) {}

    // 5. STOP SELLING LOOP
    this.sellingLoopActive = false;
    db.session.is_ai_host_on = false;
    hostStateMachineService.pauseHost();
    eventService.emit('SELLING_LOOP_STOPPED', { timestamp: new Date().toISOString() });

    // 6. FLUSH IMPORTANT EVENTS
    eventService.emit('EVENTS_FLUSHED', {
      auditLogsCount: db.auditLogs.length,
      timestamp: new Date().toISOString()
    });

    // 7. STOP HEARTBEAT & WATCHDOG
    sessionHeartbeatService.stop();
    liveSessionWatchdog.stop();

    // 8. SESSION STOPPED
    this.transitionTo('STOPPED', 'All subsystems gracefully unmounted');
    db.session.platform_status = 'OFFLINE';

    eventService.emit('LIVE_STOPPED', {
      sessionId: db.session.id,
      sessionCode: db.session.session_code,
      startedAt: db.session.started_at,
      endedAt: db.session.ended_at,
      timestamp: new Date().toISOString()
    });

    return db.session;
  }

  /**
   * Pauses autonomous live session (operator pause).
   */
  public async pauseLiveSession(): Promise<LiveSession> {
    db.session.is_paused = true;
    db.session.is_ai_host_on = false;
    await voiceOrchestrator.stop();
    hostStateMachineService.pauseHost();
    this.transitionTo('PAUSED', 'Operator paused live session');
    return db.session;
  }

  /**
   * Resumes autonomous live session from pause.
   */
  public async resumeLiveSession(): Promise<LiveSession> {
    db.session.is_paused = false;
    db.session.is_ai_host_on = true;
    hostStateMachineService.resumeHost();
    this.transitionTo('RUNNING', 'Operator resumed live session');
    return db.session;
  }

  /**
   * Handles unexpected runtime degradation or failure with auto-reconnection.
   */
  public async handleSessionIncident(reason: string, isUnrecoverable: boolean = false): Promise<void> {
    if (isUnrecoverable) {
      this.transitionTo('FAILED', `Unrecoverable failure: ${reason}`);
      await this.stopLiveSession({ reason: `Unrecoverable: ${reason}` });
      return;
    }

    // Temporary failure: RUNNING -> DEGRADED -> RECONNECTING -> RUNNING
    this.transitionTo('DEGRADED', `Incident detected: ${reason}`);
    this.transitionTo('RECONNECTING', `Attempting reconnection after: ${reason}`);

    try {
      const hb = await sessionHeartbeatService.checkHeartbeat();
      if (hb.isHealthy) {
        this.transitionTo('RUNNING', 'Subsystems reconnected and verified healthy');
      } else {
        this.transitionTo('DEGRADED', 'Subsystems recovered partially; running in degraded mode');
      }
    } catch (err: any) {
      this.transitionTo('FAILED', `Failed to reconnect after incident: ${err.message}`);
    }
  }
}

export const liveSessionService = new LiveSessionService();
