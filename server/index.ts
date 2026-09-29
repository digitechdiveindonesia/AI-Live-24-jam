import express, { Request, Response } from 'express';
import cors from 'cors';
import { db } from './db';
import { responseService } from './services/ResponseService';
import { hostStateMachineService } from './services/HostStateMachineService';
import { productVerificationService } from './services/ProductService';
import { retrievalService } from './services/RetrievalService';
import { eventService } from './services/EventService';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// 1. Health check & System Topology
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ONLINE',
    version: '2.4.0',
    timestamp: new Date().toISOString(),
    session: db.session,
    aiHost: {
      state: hostStateMachineService.getState(),
      isOnline: db.session.is_ai_host_on
    }
  });
});

import { conversationOrchestrator } from './services/ConversationOrchestrator';
import { questionQueue } from './services/QuestionQueue';
import { interruptionEngine } from './services/InterruptionEngine';
import { conversationContextService } from './services/ConversationContextService';

// 2. Chat Ingestion & Real-Time Conversation Orchestrator
app.post('/api/chat', async (req: Request, res: Response) => {
  try {
    const { message, author, handle, platform, sku, customerId, skipTtsDelay } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'message is required' });
    }

    const result = await conversationOrchestrator.handleCustomerMessage(
      db.session.id,
      {
        text: message,
        author: author || 'Viewer',
        handle: handle || '@viewer',
        customerId: customerId || `cust-${(handle || 'viewer').replace('@', '')}`,
        platform: platform || 'TikTok',
        sku: sku || db.session.current_sku,
        skipTtsDelay: skipTtsDelay ?? true
      }
    );

    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 2.1 Customer Conversations & History
app.get('/api/conversations', (req: Request, res: Response) => {
  const conversations = db.conversations.map(c => ({
    ...c,
    recentMessages: db.getRecentConversationMessages(c.conversation_id, 4)
  }));
  res.json({ success: true, conversations });
});

app.get('/api/conversations/:id/messages', (req: Request, res: Response) => {
  const { id } = req.params;
  const messages = db.getRecentConversationMessages(id, 20);
  res.json({ success: true, conversationId: id, messages });
});

// 2.2 Question Queue Management
app.get('/api/queue', (req: Request, res: Response) => {
  res.json({
    success: true,
    total: questionQueue.getAll().length,
    queued: questionQueue.peek(),
    items: questionQueue.getAll()
  });
});

app.post('/api/queue/dequeue', (req: Request, res: Response) => {
  const item = questionQueue.dequeue();
  res.json({ success: true, item: item || null });
});

app.post('/api/queue/clear', (req: Request, res: Response) => {
  questionQueue.clear();
  res.json({ success: true, message: 'Question queue cleared' });
});

// 2.3 Interruption & Script Engine State
app.get('/api/interruption/state', (req: Request, res: Response) => {
  res.json({
    success: true,
    engineState: interruptionEngine.getState(),
    hostState: hostStateMachineService.getState(),
    preservedPosition: interruptionEngine.getPreservedPosition()
  });
});

// 3. Products
app.get('/api/products', (req: Request, res: Response) => {
  const products = db.getAllProducts().map(p => {
    const verified = productVerificationService.verifyProductData(p.sku);
    return verified;
  });
  res.json({ success: true, products });
});

app.post('/api/products/:sku/stock', (req: Request, res: Response) => {
  const { sku } = req.params;
  const { newStock } = req.body;
  if (typeof newStock !== 'number') {
    return res.status(400).json({ error: 'newStock must be a number' });
  }
  db.updateStock(sku, newStock);
  res.json({ success: true, sku, updatedStock: newStock });
});

// 4. Host Controls
app.get('/api/host/state', (req: Request, res: Response) => {
  res.json({
    state: hostStateMachineService.getState(),
    previousSellingState: hostStateMachineService.getPreviousSellingState(),
    currentSku: db.session.current_sku,
    session: db.session
  });
});

import { voiceOrchestrator } from './services/VoiceOrchestrator';
import { liveSessionOrchestrator } from './services/LiveSessionOrchestrator';
import { ttsProviderFactory } from './services/TTSProvider';
import { avatarProviderFactory } from './services/AvatarProvider';
import { speechScriptService } from './services/SpeechScriptService';

app.post('/api/host/toggle', async (req: Request, res: Response) => {
  if (db.session.is_ai_host_on) {
    await liveSessionOrchestrator.pauseAi();
  } else {
    await liveSessionOrchestrator.resumeAi();
  }
  res.json({ success: true, isAiHostOn: db.session.is_ai_host_on, state: hostStateMachineService.getState() });
});

app.post('/api/host/takeover', async (req: Request, res: Response) => {
  if (db.session.is_mic_takeover) {
    await liveSessionOrchestrator.releaseMic();
  } else {
    await liveSessionOrchestrator.takeoverMic();
  }
  res.json({ success: true, isMicTakeover: db.session.is_mic_takeover, state: hostStateMachineService.getState() });
});

// 4.1 Autonomous Selling Step Execution
app.post('/api/host/step', async (req: Request, res: Response) => {
  try {
    const { sku, forceStep, skipDelay } = req.body;
    const result = await liveSessionOrchestrator.executeAutonomousStep(sku || db.session.current_sku, {
      skipDelay: skipDelay ?? true,
      forceStep
    });
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4.2 Voice & Avatar Testing Endpoints
app.post('/api/voice/speak', async (req: Request, res: Response) => {
  try {
    const { text, sku, priority, skipDelay } = req.body;
    if (!text) return res.status(400).json({ error: 'text is required' });

    const result = await voiceOrchestrator.speakResponse(text, {
      sku: sku || db.session.current_sku,
      priority,
      skipDelay: skipDelay ?? true
    });
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/voice/interrupt', async (req: Request, res: Response) => {
  const { reason } = req.body;
  const resumeContext = await voiceOrchestrator.interrupt(reason || 'MANUAL_INTERRUPT');
  res.json({ success: true, interrupted: true, resumeContext });
});

app.get('/api/voice/telemetry', (req: Request, res: Response) => {
  res.json({
    success: true,
    telemetries: db.voiceTelemetries.slice(0, 15),
    ttsProvider: ttsProviderFactory.getCurrentProviderMode(),
    avatarProvider: avatarProviderFactory.getCurrentProviderMode(),
    avatarSession: avatarProviderFactory.getProvider().getSession()
  });
});

app.get('/api/avatar/session', (req: Request, res: Response) => {
  const session = avatarProviderFactory.getProvider().getSession();
  res.json({ success: true, session });
});

// 4.3 Configuration-Driven Provider Switching
app.post('/api/providers/tts', (req: Request, res: Response) => {
  const { mode } = req.body;
  if (!['MOCK', 'GEMINI', 'EXTERNAL'].includes(mode)) {
    return res.status(400).json({ error: 'mode must be MOCK, GEMINI, or EXTERNAL' });
  }
  ttsProviderFactory.setProvider(mode);
  res.json({ success: true, currentTtsProvider: mode });
});

app.post('/api/providers/avatar', (req: Request, res: Response) => {
  const { mode } = req.body;
  if (!['MOCK', 'EXTERNAL'].includes(mode)) {
    return res.status(400).json({ error: 'mode must be MOCK or EXTERNAL' });
  }
  avatarProviderFactory.setProvider(mode);
  res.json({ success: true, currentAvatarProvider: mode });
});

// 5. Knowledge & RAG Tester
app.post('/api/knowledge/retrieve', (req: Request, res: Response) => {
  const { query, sku } = req.body;
  const result = retrievalService.retrieveContext(query || '', sku || 'SKU-001');
  res.json({ success: true, result });
});

// 6. Audit & Telemetry Events
app.get('/api/events', (req: Request, res: Response) => {
  res.json({
    hostEvents: eventService.getHostEvents().slice(0, 10),
    systemEvents: eventService.getSystemEvents().slice(0, 10),
    auditLogs: eventService.getAuditLogs().slice(0, 10),
    voiceTelemetries: db.voiceTelemetries.slice(0, 10)
  });
});

// 7. Live Session Lifecycle, Heartbeat & Watchdog (Phase 2D)
import { liveSessionService } from './services/LiveSessionService';
import { sessionHeartbeatService } from './services/SessionHeartbeatService';
import { liveSessionWatchdog } from './services/LiveSessionWatchdog';
import { recoveryService } from './services/RecoveryService';

app.post('/api/session/start', async (req: Request, res: Response) => {
  try {
    const { sessionCode, title, sku, allowMultiple, heartbeatIntervalMs } = req.body;
    const session = await liveSessionService.startLiveSession({
      sessionCode,
      title,
      sku,
      allowMultiple,
      heartbeatIntervalMs
    });
    res.json({ success: true, session });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.post('/api/session/stop', async (req: Request, res: Response) => {
  try {
    const { reason, cancelCurrentResponse } = req.body;
    const session = await liveSessionService.stopLiveSession({
      reason,
      cancelCurrentResponse
    });
    res.json({ success: true, session });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/session/pause', async (req: Request, res: Response) => {
  const session = await liveSessionService.pauseLiveSession();
  res.json({ success: true, session });
});

app.post('/api/session/resume', async (req: Request, res: Response) => {
  const session = await liveSessionService.resumeLiveSession();
  res.json({ success: true, session });
});

app.get('/api/session/status', async (req: Request, res: Response) => {
  const watchdogReport = await liveSessionWatchdog.check();
  res.json({
    success: true,
    session: liveSessionService.getSession(),
    heartbeat: sessionHeartbeatService.getStatus(),
    watchdog: watchdogReport,
    degradedMode: recoveryService.getDegradedMode(),
    recentIncidents: recoveryService.getIncidents().slice(0, 10)
  });
});

app.post('/api/session/heartbeat', async (req: Request, res: Response) => {
  const result = await sessionHeartbeatService.checkHeartbeat();
  res.json({ success: true, result });
});

app.post('/api/session/watchdog/check', async (req: Request, res: Response) => {
  const report = await liveSessionWatchdog.check();
  res.json({ success: true, report });
});

app.post('/api/session/recover', async (req: Request, res: Response) => {
  try {
    const { component, reason } = req.body;
    let incident;
    if (component === 'TTS') {
      incident = await recoveryService.recoverTTS(reason);
    } else if (component === 'AVATAR') {
      incident = await recoveryService.recoverAvatar(reason);
    } else if (component === 'GEMINI') {
      incident = await recoveryService.recoverGemini(reason);
    } else if (component === 'DATABASE') {
      incident = await recoveryService.recoverDatabase(reason);
    } else if (component === 'HOST') {
      incident = await recoveryService.recoverHostStall(reason);
    } else if (component === 'QUEUE') {
      incident = await recoveryService.recoverQueueStall(reason);
    } else {
      incident = recoveryService.requestOperatorIntervention(component || 'SYSTEM', reason || 'Manual intervention request');
    }
    res.json({ success: true, incident });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/session/degraded', (req: Request, res: Response) => {
  const { mode, reason } = req.body;
  if (!['NONE', 'VOICE_ONLY', 'TEXT_ONLY', 'SAFE_FALLBACK', 'READ_ONLY_COMMERCE'].includes(mode)) {
    return res.status(400).json({ error: 'Invalid degraded mode' });
  }
  recoveryService.setDegradedMode(mode, reason);
  res.json({ success: true, currentDegradedMode: mode, session: db.session });
});

// ==========================================
// Phase 3A & 3B: Platform Adapter & Real Connection APIs
// ==========================================
import {
  platformManager,
  platformAuthProvider,
  platformProductSyncService,
  platformWebhookService,
  platformConfigService,
  platformConnectionService,
  connectionVerificationService,
  platformResponseRouter,
  tiktokTokenService,
  PlatformType
} from './services/platform';

// 1. Safe connection metadata (strictly no tokens or secrets)
app.get('/api/platform/connections', (req: Request, res: Response) => {
  const connections = platformConnectionService.getAllStatuses();
  res.json({ success: true, connections });
});

// 1.1 Safe configuration metadata
app.get('/api/platform/configs', (req: Request, res: Response) => {
  const configs = platformConfigService.getAllSafeConfigs();
  res.json({ success: true, configs });
});

// 2. Capabilities matrix
app.get('/api/platform/capabilities', (req: Request, res: Response) => {
  const capabilities = platformManager.getAllCapabilities();
  res.json({ success: true, capabilities });
});

// 3. Platform Status, Health & Verification
app.get('/api/platform/:platform/status', async (req: Request, res: Response) => {
  const platform = req.params.platform.toUpperCase() as PlatformType;
  const adapter = platformManager.getAdapter(platform);
  if (!adapter) {
    return res.status(404).json({ success: false, error: `Platform ${platform} not supported` });
  }

  const connection = platformConnectionService.getStatus(platform);
  const capabilities = adapter.getCapabilities();
  const health = await adapter.healthCheck();
  const liveStatus = await adapter.getLiveStatus();
  const telemetry = connectionVerificationService.getTelemetry(platform);

  res.json({
    success: true,
    platform,
    connection,
    capabilities,
    health,
    liveStatus,
    telemetry
  });
});

// 3.1 Strict Connection Verification Test
app.get('/api/platform/:platform/verify', async (req: Request, res: Response) => {
  const platform = req.params.platform.toUpperCase() as PlatformType;
  const isDemo = req.query.demo === 'true';
  const report = await connectionVerificationService.verifyConnection(platform, isDemo);
  res.json({ success: true, report });
});

// 4. Connect & Disconnect (Real & Demo mode aware)
app.post('/api/platform/:platform/connect', async (req: Request, res: Response) => {
  const platform = req.params.platform.toUpperCase() as PlatformType;
  const isDemo = req.body?.isDemo ?? true; // defaults to demo/sandbox if not specified
  const connection = await platformConnectionService.connect(platform, isDemo);
  res.json({ success: connection.connectionStatus === 'CONNECTED', connection });
});

app.post('/api/platform/:platform/disconnect', async (req: Request, res: Response) => {
  const platform = req.params.platform.toUpperCase() as PlatformType;
  const connection = await platformConnectionService.disconnect(platform);
  res.json({ success: true, connection });
});

// 5. Auth abstraction
app.get('/api/platform/:platform/auth/url', async (req: Request, res: Response) => {
  const platform = req.params.platform.toUpperCase() as PlatformType;
  const state = req.query.state as string | undefined;
  const url = await platformAuthProvider.getAuthorizationUrl(platform, state);
  const isConfigured = platformConfigService.isConfigured(platform);
  res.json({ success: true, platform, authUrl: url, isSimulated: !isConfigured });
});

app.post('/api/platform/:platform/auth/callback', async (req: Request, res: Response) => {
  const platform = req.params.platform.toUpperCase() as PlatformType;
  const { code, state } = req.body;
  const result = await platformAuthProvider.handleCallback(platform, code, state);
  if (result.success) {
    await platformConnectionService.connect(platform, result.isSimulated ?? false);
  }
  res.json({ success: result.success, result });
});

// 5.1 Safe Token Metadata
app.get('/api/platform/:platform/tokens', (req: Request, res: Response) => {
  const platform = req.params.platform.toUpperCase() as PlatformType;
  if (platform === 'TIKTOK') {
    res.json({ success: true, tokens: tiktokTokenService.getTokenMetadata() });
  } else {
    res.json({ success: true, tokens: platformAuthProvider.getCredentialsSafeMetadata(platform) });
  }
});

// 6. Product & Inventory Sync
app.post('/api/platform/:platform/sync/inventory', async (req: Request, res: Response) => {
  const platform = req.params.platform.toUpperCase() as PlatformType;
  const { sku } = req.body;
  if (!sku) {
    return res.status(400).json({ error: 'sku is required' });
  }
  const results = await platformProductSyncService.syncInventory(sku, platform);
  res.json({ success: true, results });
});

app.post('/api/platform/:platform/sync/products', async (req: Request, res: Response) => {
  const platform = req.params.platform.toUpperCase() as PlatformType;
  const results = await platformProductSyncService.syncCatalog(platform);
  res.json({ success: true, results });
});

// 7. Conflict Resolution
app.get('/api/platform/sync/conflicts', (req: Request, res: Response) => {
  const { status } = req.query;
  const conflicts = platformProductSyncService.getConflicts(status as string);
  res.json({ success: true, conflicts });
});

app.post('/api/platform/sync/conflicts/:id/resolve', (req: Request, res: Response) => {
  const { id } = req.params;
  const { resolution, notes } = req.body;
  const resolved = platformProductSyncService.resolveConflict(
    id,
    resolution || 'RESOLVED_INTERNAL',
    notes
  );
  if (!resolved) {
    return res.status(404).json({ error: 'Conflict not found' });
  }
  res.json({ success: true, conflict: resolved });
});

// 8. Platform Response Routing & Operator Queue
app.post('/api/platform/:platform/route-response', async (req: Request, res: Response) => {
  const platform = req.params.platform.toUpperCase() as PlatformType;
  const { conversationId, commentId, responseText, guardrailStatus, author, handle } = req.body;

  const result = await platformResponseRouter.routeResponse({
    platform,
    conversationId,
    commentId,
    responseText,
    guardrailStatus: guardrailStatus || 'APPROVED',
    author,
    handle
  });
  res.json({ success: true, result });
});

app.get('/api/platform/operator-queue', (req: Request, res: Response) => {
  res.json({ success: true, queue: platformResponseRouter.getOperatorQueue() });
});

// 9. Webhooks Receiver with HMAC Verification and Idempotency
app.post('/api/platform/webhook/:platform', async (req: Request, res: Response) => {
  const platform = req.params.platform.toUpperCase() as PlatformType;
  const signature = req.headers['x-platform-signature'] as string | undefined;
  const timestampHeader = req.headers['x-platform-timestamp'] as string | undefined;
  const result = await platformWebhookService.handleWebhook(platform, req.body, signature, timestampHeader);
  res.json(result);
});

// ==========================================
// Phase 3C: Free Scheduled Cloud Runtime APIs
// ==========================================
import {
  scheduleService,
  cloudRuntimeController,
  usageTelemetryService
} from './services/schedule';

// 1. Schedules Management
app.get('/api/schedules', (req: Request, res: Response) => {
  const schedules = scheduleService.getSchedules();
  const schedulesWithRuns = schedules.map(s => ({
    ...s,
    nextRun: scheduleService.getNextRun(s)
  }));
  res.json({ success: true, schedules: schedulesWithRuns });
});

app.get('/api/schedules/:id', (req: Request, res: Response) => {
  const schedule = scheduleService.getScheduleById(req.params.id);
  if (!schedule) {
    return res.status(404).json({ error: 'Schedule not found' });
  }
  res.json({
    success: true,
    schedule: {
      ...schedule,
      nextRun: scheduleService.getNextRun(schedule)
    }
  });
});

app.post('/api/schedules', (req: Request, res: Response) => {
  const result = scheduleService.createSchedule(req.body);
  if (result.errors) {
    return res.status(400).json({ success: false, errors: result.errors });
  }
  res.status(201).json({ success: true, schedule: result.schedule });
});

app.put('/api/schedules/:id', (req: Request, res: Response) => {
  const result = scheduleService.updateSchedule(req.params.id, req.body);
  if (result.errors) {
    return res.status(400).json({ success: false, errors: result.errors });
  }
  res.json({ success: true, schedule: result.schedule });
});

app.delete('/api/schedules/:id', (req: Request, res: Response) => {
  const deleted = scheduleService.deleteSchedule(req.params.id);
  if (!deleted) {
    return res.status(404).json({ error: 'Schedule not found' });
  }
  res.json({ success: true, message: 'Schedule deleted' });
});

app.post('/api/schedules/:id/enable', (req: Request, res: Response) => {
  const updated = scheduleService.enableSchedule(req.params.id);
  if (!updated) {
    return res.status(404).json({ error: 'Schedule not found' });
  }
  res.json({ success: true, schedule: updated });
});

app.post('/api/schedules/:id/disable', (req: Request, res: Response) => {
  const updated = scheduleService.disableSchedule(req.params.id);
  if (!updated) {
    return res.status(404).json({ error: 'Schedule not found' });
  }
  res.json({ success: true, schedule: updated });
});

app.post('/api/schedules/validate', (req: Request, res: Response) => {
  const result = scheduleService.validateSchedule(req.body, req.body.id);
  res.json({ success: result.valid, result });
});

app.get('/api/schedules/:id/next-run', (req: Request, res: Response) => {
  const schedule = scheduleService.getScheduleById(req.params.id);
  if (!schedule) {
    return res.status(404).json({ error: 'Schedule not found' });
  }
  const nextRun = scheduleService.getNextRun(schedule);
  res.json({ success: true, nextRun });
});

// 2. Cloud Runtime Controller
app.get('/api/runtime/status', (req: Request, res: Response) => {
  const status = cloudRuntimeController.getRuntimeStatus();
  res.json({ success: true, status });
});

app.post('/api/runtime/start', async (req: Request, res: Response) => {
  const result = await cloudRuntimeController.startRuntime(req.body);
  res.json(result);
});

app.post('/api/runtime/stop', async (req: Request, res: Response) => {
  const result = await cloudRuntimeController.stopRuntime(req.body);
  res.json(result);
});

app.post('/api/runtime/restart', async (req: Request, res: Response) => {
  const result = await cloudRuntimeController.requestRestart(req.body?.reason);
  res.json(result);
});

app.post('/api/runtime/recover', async (req: Request, res: Response) => {
  const result = await cloudRuntimeController.recoverRuntime();
  res.json(result);
});

app.get('/api/runtime/health', async (req: Request, res: Response) => {
  const health = await cloudRuntimeController.getRuntimeHealth();
  res.json({ success: true, health });
});

app.post('/api/runtime/simulate-day', async (req: Request, res: Response) => {
  const simulation = await cloudRuntimeController.simulateAcceleratedDay();
  res.json(simulation);
});

// 3. Cloud Scheduler Webhook/Trigger Ingress
app.post('/api/scheduler/trigger', async (req: Request, res: Response) => {
  const { scheduleId, action } = req.body;
  if (action === 'START') {
    const result = await cloudRuntimeController.startRuntime({ scheduleId });
    return res.json({ success: result.success, result });
  } else if (action === 'STOP') {
    const result = await cloudRuntimeController.stopRuntime({ scheduleId, reason: 'SCHEDULE_END' });
    return res.json({ success: result.success, result });
  }
  res.status(400).json({ error: 'Invalid scheduler action. Must be START or STOP.' });
});

// 4. Usage & Free-Tier Budget Telemetry
app.get('/api/runtime/telemetry', (req: Request, res: Response) => {
  const telemetry = usageTelemetryService.getUsage();
  res.json({ success: true, telemetry });
});

app.post('/api/runtime/telemetry/reset', (req: Request, res: Response) => {
  usageTelemetryService.resetUsage();
  res.json({ success: true, message: 'Usage telemetry reset' });
});


if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`[AI Live Commerce Server] Running at http://localhost:${PORT}`);
  });
}

export default app;
