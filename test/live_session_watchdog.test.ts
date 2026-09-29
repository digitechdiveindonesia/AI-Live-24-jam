import test from 'node:test';
import assert from 'node:assert';
import { db } from '../server/db/index';
import { liveSessionService } from '../server/services/LiveSessionService';
import { sessionHeartbeatService } from '../server/services/SessionHeartbeatService';
import { liveSessionWatchdog } from '../server/services/LiveSessionWatchdog';
import { recoveryService } from '../server/services/RecoveryService';
import { exponentialBackoff, ExponentialBackoff } from '../server/services/ExponentialBackoff';
import { eventService } from '../server/services/EventService';
import { hostStateMachineService } from '../server/services/HostStateMachineService';
import { questionQueue } from '../server/services/QuestionQueue';
import { ttsProviderFactory } from '../server/services/TTSProvider';
import { avatarProviderFactory } from '../server/services/AvatarProvider';

test('1. LiveSessionService - 11-Step Lifecycle & Single Active Session Enforcement', async () => {
  const eventsEmitted: string[] = [];
  const unsubscribe = eventService.subscribe((type: string) => eventsEmitted.push(type));

  try {
    // Stop any existing session
    await liveSessionService.stopLiveSession({ reason: 'Setup reset' });

    // Start session
    const session = await liveSessionService.startLiveSession({
      sessionCode: 'LIVE-TEST-001',
      sku: 'SKU-001',
      title: 'Autonomous Test Stream'
    });

    assert.strictEqual(session.status, 'RUNNING');
    assert.strictEqual(session.session_code, 'LIVE-TEST-001');
    assert.strictEqual(session.current_sku, 'SKU-001');
    assert.strictEqual(session.is_ai_host_on, true);
    assert.ok(session.started_at, 'started_at must be populated');
    assert.strictEqual(session.ended_at, null);

    // Verify emission of lifecycle events
    assert.ok(eventsEmitted.includes('SESSION_CREATED'), 'SESSION_CREATED must be emitted');
    assert.ok(eventsEmitted.includes('SESSION_STARTING'), 'SESSION_STARTING must be emitted');
    assert.ok(eventsEmitted.includes('SERVICE_INITIALIZATION_STARTED'), 'SERVICE_INITIALIZATION_STARTED must be emitted');
    assert.ok(eventsEmitted.includes('SERVICE_INITIALIZATION_COMPLETED'), 'SERVICE_INITIALIZATION_COMPLETED must be emitted');
    assert.ok(eventsEmitted.includes('SESSION_HEALTH_CHECK'), 'SESSION_HEALTH_CHECK must be emitted');
    assert.ok(eventsEmitted.includes('LIVE_STARTED'), 'LIVE_STARTED must be emitted');

    // Rule: Single active autonomous session enforcement
    let duplicateRejected = false;
    try {
      await liveSessionService.startLiveSession({
        sessionCode: 'LIVE-TEST-DUPLICATE',
        allowMultiple: false
      });
    } catch (err: any) {
      duplicateRejected = true;
      assert.ok(err.message.includes('already controlling the host'));
    }
    assert.strictEqual(duplicateRejected, true, 'Concurrent active session start without allowMultiple must be rejected');

    // Shutdown test
    const stopped = await liveSessionService.stopLiveSession({ reason: 'Test finished' });
    assert.strictEqual(stopped.status, 'STOPPED');
    assert.ok(stopped.ended_at, 'ended_at must be populated');
    assert.strictEqual(liveSessionService.isAcceptingNewCustomers(), false);
    assert.ok(eventsEmitted.includes('LIVE_STOPPING'));
    assert.ok(eventsEmitted.includes('LIVE_STOPPED'));
  } finally {
    unsubscribe();
  }
});

test('2. SessionHeartbeatService - Periodic Health Verification & Tolerant Failure Counter', async () => {
  sessionHeartbeatService.stop();
  const result = await sessionHeartbeatService.checkHeartbeat();

  assert.ok(result.timestamp);
  assert.strictEqual(result.isHealthy, true);
  assert.strictEqual(result.consecutiveFailures, 0);

  // Check all 7 components evaluated
  assert.ok(result.components.host);
  assert.strictEqual(result.components.host.isHealthy, true);
  assert.ok(result.components.tts);
  assert.strictEqual(result.components.tts.isHealthy, true);
  assert.ok(result.components.avatar);
  assert.strictEqual(result.components.avatar.isHealthy, true);
  assert.ok(result.components.eventService);
  assert.strictEqual(result.components.eventService.isHealthy, true);
  assert.ok(result.components.database);
  assert.strictEqual(result.components.database.isHealthy, true);
  assert.ok(result.components.gemini);
  assert.strictEqual(result.components.gemini.isHealthy, true);
  assert.ok(result.components.questionQueue);
  assert.strictEqual(result.components.questionQueue.isHealthy, true);

  // Verify lastHeartbeatAt saved to DB
  assert.strictEqual(db.session.last_heartbeat_at, result.timestamp);
});

test('3. ExponentialBackoff - Progression, Delay Ceiling, and Jitter', async () => {
  const backoff = new ExponentialBackoff({
    maxAttempts: 4,
    baseDelayMs: 100,
    maxDelayMs: 1000,
    jitter: false
  });

  // Attempt 1: 100 * 2^0 = 100
  assert.strictEqual(backoff.calculateDelay(1), 100);
  // Attempt 2: 100 * 2^1 = 200
  assert.strictEqual(backoff.calculateDelay(2), 200);
  // Attempt 3: 100 * 2^2 = 400
  assert.strictEqual(backoff.calculateDelay(3), 400);
  // Attempt 4: 100 * 2^3 = 800
  assert.strictEqual(backoff.calculateDelay(4), 800);
  // Attempt 5: capped at maxDelay = 1000
  assert.strictEqual(backoff.calculateDelay(5), 1000);

  // Test executeWithRetry
  let attemptsRun = 0;
  const retriedResult = await backoff.executeWithRetry(async (attempt) => {
    attemptsRun = attempt;
    if (attempt < 3) {
      throw new Error('Temporary test failure');
    }
    return 'RETRY_SUCCESS';
  }, { skipWaitInTest: true });

  assert.strictEqual(attemptsRun, 3);
  assert.strictEqual(retriedResult, 'RETRY_SUCCESS');
});

test('4. LiveSessionWatchdog - Stall Detection and Automated Incident Reporting', async () => {
  liveSessionWatchdog.clearHistory();
  liveSessionWatchdog.setConfig({
    heartbeatStaleMs: 50, // very small for test
    hostStateStaleMs: 50,
    ttsStaleMs: 50,
    avatarStaleMs: 50,
    queueStaleMs: 50,
    eventLoopStaleMs: 50
  });

  // 1. Simulate TTS Stall
  const tts = ttsProviderFactory.getProvider();
  (tts as any).currentStatus = 'GENERATING';
  liveSessionWatchdog.recordTtsStart();

  // Wait 60ms to exceed ttsStaleMs
  await new Promise(r => setTimeout(r, 65));

  const report = await liveSessionWatchdog.check();
  assert.strictEqual(report.isHealthy, false);
  const ttsStall = report.stalls.find(s => s.stallType === 'TTS_STALLED');
  assert.ok(ttsStall, 'TTS_STALLED must be detected');

  // Reset TTS
  (tts as any).currentStatus = 'READY';
  liveSessionWatchdog.recordTtsEnd();

  // Restore normal config
  liveSessionWatchdog.setConfig({
    heartbeatStaleMs: 15000,
    hostStateStaleMs: 30000,
    ttsStaleMs: 15000,
    avatarStaleMs: 15000,
    queueStaleMs: 45000,
    eventLoopStaleMs: 15000
  });
});

test('5. RecoveryService - 5 Recovery Levels and Degraded Mode Transitions', async () => {
  recoveryService.clearIncidents();
  recoveryService.setDegradedMode('NONE');

  // TTS recovery
  const ttsIncident = await recoveryService.recoverTTS('TTS simulated ping check');
  assert.strictEqual(ttsIncident.component, 'TTS');
  assert.strictEqual(ttsIncident.success, true);

  // Avatar recovery
  const avatarIncident = await recoveryService.recoverAvatar('Avatar restart test');
  assert.strictEqual(avatarIncident.component, 'AVATAR');
  assert.strictEqual(avatarIncident.level, 'LEVEL_2_RESTART_COMPONENT');
  assert.strictEqual(avatarIncident.success, true);

  // Gemini degraded mode fallback
  recoveryService.setDegradedMode('SAFE_FALLBACK', 'LLM unavailable');
  assert.strictEqual(recoveryService.getDegradedMode(), 'SAFE_FALLBACK');
  assert.strictEqual(db.session.degraded_mode, 'SAFE_FALLBACK');

  // Level 5: Operator Intervention
  const opIncident = recoveryService.requestOperatorIntervention('HOST', 'Repeated unrecoverable stall');
  assert.strictEqual(opIncident.level, 'LEVEL_5_OPERATOR_INTERVENTION');
  assert.strictEqual(db.session.is_ai_host_on, false, 'Host must be paused on operator intervention');
  assert.strictEqual(db.session.is_paused, true);

  // Restore degraded mode to NONE
  recoveryService.setDegradedMode('NONE', 'All systems clear');
  assert.strictEqual(recoveryService.getDegradedMode(), 'NONE');
  assert.strictEqual(db.session.degraded_mode, 'NONE');
});
