import express, { Request, Response } from 'express';
import cors from 'cors';
import { db } from './db';
import { responseService } from './services/ResponseService';
import { hostStateMachineService } from './services/HostStateMachineService';
import { productVerificationService } from './services/ProductService';
import { retrievalService } from './services/RetrievalService';
import { eventService } from './services/EventService';
import { supabaseManager } from './db/supabaseClient';
import {
  productRepository,
  inventoryRepository,
  promotionRepository,
  knowledgeRepository,
  liveSessionRepository,
  conversationRepository
} from './repositories';
import { inventoryService } from './services/InventoryService';
import { promotionService } from './services/PromotionService';
import { commerceDataService } from './services/CommerceDataService';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// 0. Database Status & Connectivity Diagnostic (Never leaks secrets)
app.get('/api/db/status', async (req: Request, res: Response) => {
  const status = await supabaseManager.checkConnectivity();
  res.json({ success: true, ...status });
});

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

app.get('/api/conversations/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const conversation = await conversationRepository.getConversation(id);
  if (!conversation) {
    return res.status(404).json({ success: false, error: `Conversation ${id} not found` });
  }
  const messages = await conversationRepository.getMessages(id, 20);
  res.json({ success: true, conversation: { ...conversation, messages } });
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

// 3. Authoritative Products, Inventory & Promotions (Supabase PostgreSQL backed)
app.get('/api/products', async (req: Request, res: Response) => {
  try {
    const rawProducts = await productRepository.getAll();
    const products = rawProducts.map(p => {
      const verified = productVerificationService.verifyProductData(p.sku);
      return verified || {
        sku: p.sku,
        name: p.name,
        category: p.category,
        brand: p.brand,
        basePrice: p.base_price,
        salePrice: p.sale_price || p.base_price,
        currency: p.currency,
        basePriceFormatted: `Rp${p.base_price.toLocaleString('id-ID')}`,
        salePriceFormatted: `Rp${(p.sale_price || p.base_price).toLocaleString('id-ID')}`,
        discountPercent: 0,
        totalStock: 0,
        availableStock: 0,
        isLowStock: false,
        isOutOfStock: true,
        promoTitle: 'Standard Price',
        variants: [],
        bpomNumber: p.metadata?.bpom_number || '',
        approvedClaims: p.metadata?.claims_approved || [],
        restrictedClaims: p.metadata?.claims_restricted || []
      };
    });
    res.json({ success: true, products, isConfigured: supabaseManager.isConfigured() });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/products/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const product = (await productRepository.getBySku(id)) || (await productRepository.getById(id));
    if (!product) {
      return res.status(404).json({ success: false, error: `Product ${id} not found` });
    }
    const verified = productVerificationService.verifyProductData(product.sku);
    res.json({ success: true, product, verifiedFacts: verified });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/products', async (req: Request, res: Response) => {
  try {
    const { name, sku, base_price, category } = req.body;
    if (!name || !sku || base_price === undefined) {
      return res.status(400).json({ success: false, error: 'name, sku, and base_price are required' });
    }
    const created = await productRepository.create(req.body);
    const initialStock = req.body.initial_stock ?? req.body.total_stock ?? 0;
    await inventoryRepository.update(created.sku, initialStock);
    res.status(201).json({ success: true, product: created });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.patch('/api/products/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updated = await productRepository.update(id, req.body);
    if (!updated) {
      return res.status(404).json({ success: false, error: `Product ${id} not found` });
    }
    res.json({ success: true, product: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Legacy and convenience stock update endpoint
app.post('/api/products/:sku/stock', async (req: Request, res: Response) => {
  const { sku } = req.params;
  const { newStock } = req.body;
  if (typeof newStock !== 'number') {
    return res.status(400).json({ error: 'newStock must be a number' });
  }
  const updated = await inventoryService.updateStock(sku, newStock);
  res.json({ success: true, sku, updatedStock: updated.total_stock });
});

// 3.1 Inventory Endpoints
app.get('/api/inventory', async (req: Request, res: Response) => {
  try {
    const inventory = await inventoryService.getAllStock();
    res.json({ success: true, inventory });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.patch('/api/inventory/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { total_stock, newStock } = req.body;
    const stockToSet = typeof newStock === 'number' ? newStock : (typeof total_stock === 'number' ? total_stock : null);
    if (stockToSet === null) {
      return res.status(400).json({ success: false, error: 'total_stock or newStock must be a number' });
    }
    const updated = await inventoryService.updateStock(id, stockToSet);
    res.json({ success: true, inventory: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3.2 Promotions Endpoints
app.get('/api/promotions', async (req: Request, res: Response) => {
  try {
    const promotions = await promotionService.getPromotions();
    res.json({ success: true, promotions });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/promotions', async (req: Request, res: Response) => {
  try {
    const { sku, title, discount_percent } = req.body;
    if (!sku || !title || discount_percent === undefined) {
      return res.status(400).json({ success: false, error: 'sku, title, and discount_percent are required' });
    }
    const created = await promotionService.createPromotion(req.body);
    res.status(201).json({ success: true, promotion: created });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.patch('/api/promotions/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updated = await promotionService.updatePromotion(id, req.body);
    if (!updated) {
      return res.status(404).json({ success: false, error: `Promotion ${id} not found` });
    }
    res.json({ success: true, promotion: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3.3 Effective Commerce Context (Single Authoritative Context for AI)
app.get('/api/commerce/effective/:sku', async (req: Request, res: Response) => {
  try {
    const { sku } = req.params;
    const { variantId } = req.query;
    const context = await commerceDataService.getEffectiveCommerceData(sku, variantId as string);
    res.json({ success: true, context });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
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
  res.json({ success: true, currentTtsProvider: ttsProviderFactory.getCurrentProviderMode(), requestedProvider: mode });
});

app.post('/api/providers/avatar', (req: Request, res: Response) => {
  const { mode } = req.body;
  if (!['MOCK', 'EXTERNAL'].includes(mode)) {
    return res.status(400).json({ error: 'mode must be MOCK or EXTERNAL' });
  }
  avatarProviderFactory.setProvider(mode);
  res.json({ success: true, currentAvatarProvider: avatarProviderFactory.getCurrentProviderMode(), requestedProvider: mode });
});

// 5. Knowledge & Grounding Engine (Supabase backed)
app.get('/api/knowledge', async (req: Request, res: Response) => {
  try {
    const docs = await knowledgeRepository.getDocuments();
    const faqs = await knowledgeRepository.getFaqs();
    const rules = await knowledgeRepository.getRules();
    res.json({
      success: true,
      documents: docs,
      faqs,
      rules,
      searchEngine: 'LEXICAL_SEARCH',
      isConfigured: supabaseManager.isConfigured()
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/scripts', (req: Request, res: Response) => {
  res.json({
    success: true,
    scripts: db.scripts,
    scriptBlocks: db.scriptBlocks
  });
});

app.post('/api/knowledge/retrieve', async (req: Request, res: Response) => {
  const { query, sku } = req.body;
  const result = await retrievalService.retrieveContextAsync(query || '', sku || 'SKU-001');
  res.json({ success: true, result });
});

// 5.1 Live Sessions REST Endpoints
app.get('/api/live-sessions', async (req: Request, res: Response) => {
  try {
    const sessions = await liveSessionRepository.getAllSessions();
    res.json({ success: true, sessions });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/live-sessions', async (req: Request, res: Response) => {
  try {
    const session = await liveSessionRepository.createSession(req.body);
    res.status(201).json({ success: true, session });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/live-sessions/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const session = await liveSessionRepository.getSession(id);
    if (!session) {
      return res.status(404).json({ success: false, error: `Live session ${id} not found` });
    }
    res.json({ success: true, session });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
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
  tikTokShopAuthProvider,
  shopeeAuthProvider,
  oAuthStateService,
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

// ==========================================
// Phase 3D.3: Real Platform Authorization & Token Lifecycle Routes
// ==========================================

// TikTok Shop Connect & Callback
app.get('/api/platforms/tiktok-shop/connect', async (req: Request, res: Response) => {
  const customRedirectUri = req.query.redirect_uri as string | undefined;
  const state = oAuthStateService.generateState('TIKTOK');
  const url = await tikTokShopAuthProvider.getAuthorizationUrl(state, customRedirectUri);
  if (req.query.redirect === 'true') {
    return res.redirect(url);
  }
  res.json({ success: true, platform: 'TIKTOK', url, state });
});

app.get('/api/platforms/tiktok-shop/callback', async (req: Request, res: Response) => {
  const code = (req.query.code || req.query.auth_code) as string;
  const state = req.query.state as string;
  const result = await tikTokShopAuthProvider.handleCallback(code, state);
  res.json({
    success: result.success,
    platform: 'TIKTOK',
    message: result.message,
    accountId: result.accountId,
    shopId: result.shopId
  });
});

// Shopee Open Platform Connect & Callback
app.get('/api/platforms/shopee/connect', async (req: Request, res: Response) => {
  const customRedirectUri = req.query.redirect_uri as string | undefined;
  const state = oAuthStateService.generateState('SHOPEE');
  const url = await shopeeAuthProvider.getAuthorizationUrl(state, customRedirectUri);
  if (req.query.redirect === 'true') {
    return res.redirect(url);
  }
  res.json({ success: true, platform: 'SHOPEE', url, state });
});

app.get('/api/platforms/shopee/callback', async (req: Request, res: Response) => {
  const code = req.query.code as string;
  const state = req.query.state as string;
  const shopId = (req.query.shop_id || req.query.shopId) as string;
  const result = await shopeeAuthProvider.handleCallback(code, state, shopId);
  res.json({
    success: result.success,
    platform: 'SHOPEE',
    message: result.message,
    accountId: result.accountId,
    shopId: result.shopId
  });
});

// Plural platform endpoints (Phase 3D.3 Section 11)
app.get('/api/platforms/connections', (req: Request, res: Response) => {
  const connections = platformConnectionService.getAllStatuses();
  res.json({ success: true, connections });
});

app.post('/api/platforms/:platform/disconnect', async (req: Request, res: Response) => {
  const platform = req.params.platform.toUpperCase() as PlatformType;
  const connection = await platformConnectionService.disconnect(platform);
  res.json({ success: true, platform, connection });
});

app.post('/api/platforms/:platform/verify', async (req: Request, res: Response) => {
  const platform = req.params.platform.toUpperCase() as PlatformType;
  let report: any;
  if (platform === 'TIKTOK') {
    report = await tikTokShopAuthProvider.verifyConnection();
  } else if (platform === 'SHOPEE') {
    report = await shopeeAuthProvider.verifyConnection();
  } else {
    report = await connectionVerificationService.verifyConnection(platform, false);
  }
  res.json({ success: report.healthy ?? (report.result === 'PASS'), platform, report });
});

app.post('/api/platforms/:platform/refresh', async (req: Request, res: Response) => {
  const platform = req.params.platform.toUpperCase() as PlatformType;
  const connection = await platformConnectionService.refresh(platform);
  res.json({
    success: connection.connectionStatus === 'CONNECTED',
    platform,
    status: connection.connectionStatus,
    lastHealthCheck: connection.lastHealthCheck,
    error: connection.lastError
  });
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

// Standardized Webhook Ingestion endpoint (Phase 3D.2 Section 12)
app.post('/api/webhooks/:platform', async (req: Request, res: Response) => {
  const platform = req.params.platform.toUpperCase() as PlatformType;
  const signature = (req.headers['x-platform-signature'] || req.headers['x-signature'] || req.headers['authorization']) as string | undefined;
  const timestampHeader = (req.headers['x-platform-timestamp'] || req.headers['x-timestamp']) as string | undefined;
  const result = await platformWebhookService.handleWebhook(platform, req.body, signature, timestampHeader);
  res.json(result);
});

// ==========================================
// Phase 3D.2: External Commerce Sync & Conflict Resolution APIs
// ==========================================
import {
  productSyncService,
  commerceSyncWorker
} from './services/platform';
import {
  syncConflictRepository,
  externalMappingRepository
} from './repositories';

// 1. Get conflicts (with optional filter by status, platform, entityId)
app.get('/api/sync/conflicts', async (req: Request, res: Response) => {
  const { status, platform, entityId } = req.query;
  const conflicts = await syncConflictRepository.getAll({
    status: status as any,
    platform: platform ? (String(platform).toUpperCase() as PlatformType) : undefined,
    entityId: entityId as string
  });
  res.json({ success: true, count: conflicts.length, conflicts });
});

// 2. Get conflict by ID
app.get('/api/sync/conflicts/:id', async (req: Request, res: Response) => {
  const conflict = await syncConflictRepository.getById(req.params.id);
  if (!conflict) {
    return res.status(404).json({ success: false, error: 'Sync conflict not found' });
  }
  res.json({ success: true, conflict });
});

// 3. Resolve conflict - Local Authoritative
app.post('/api/sync/conflicts/:id/resolve-local', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { operator, notes } = req.body;
  try {
    const result = await productSyncService.resolveLocal(id, operator || 'OPERATOR', notes);
    res.json({ success: true, message: 'Conflict resolved keeping local authoritative data', conflict: result.conflict });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// 4. Resolve conflict - External Overwrite
app.post('/api/sync/conflicts/:id/resolve-external', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { operator, notes } = req.body;
  try {
    const result = await productSyncService.resolveExternal(id, operator || 'OPERATOR', notes);
    res.json({
      success: true,
      message: 'Conflict resolved by explicitly applying external snapshot to Supabase',
      conflict: result.conflict,
      updatedEntity: result.updatedEntity
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// 5. Resolve conflict - Manual Value
app.post('/api/sync/conflicts/:id/resolve-manual', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { value, operator, notes } = req.body;
  if (value === undefined) {
    return res.status(400).json({ success: false, error: 'Manual resolution requires approved "value"' });
  }
  try {
    const result = await productSyncService.resolveManual(id, value, operator || 'OPERATOR', notes);
    res.json({
      success: true,
      message: 'Conflict resolved with operator approved manual value',
      conflict: result.conflict,
      updatedEntity: result.updatedEntity
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// 6. Trigger sync run
app.post('/api/sync/run/:platform', async (req: Request, res: Response) => {
  const platformParam = req.params.platform.toUpperCase();
  const { mode, snapshotOverrides } = req.body;

  try {
    if (platformParam === 'ALL') {
      const ttReport = await commerceSyncWorker.runSync('TIKTOK', mode || 'MANUAL', snapshotOverrides);
      const spReport = await commerceSyncWorker.runSync('SHOPEE', mode || 'MANUAL', snapshotOverrides);
      return res.json({ success: true, reports: [ttReport, spReport] });
    }

    const platform = platformParam as PlatformType;
    const report = await commerceSyncWorker.runSync(platform, mode || 'MANUAL', snapshotOverrides);
    res.json({ success: true, report });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 7. Get sync runs history & status
app.get('/api/sync/runs', (req: Request, res: Response) => {
  const { platform } = req.query;
  const runs = db.getSyncRuns(platform ? (String(platform).toUpperCase() as PlatformType) : undefined);
  res.json({ success: true, count: runs.length, runs });
});

// 8. External product mappings
app.get('/api/sync/mappings', async (req: Request, res: Response) => {
  const { platform, productId, externalSku } = req.query;
  const mappings = await externalMappingRepository.getAll({
    platform: platform ? (String(platform).toUpperCase() as PlatformType) : undefined,
    productId: productId as string,
    externalSku: externalSku as string
  });
  res.json({ success: true, count: mappings.length, mappings });
});

app.post('/api/sync/mappings', async (req: Request, res: Response) => {
  const { platform, productId, externalProductId, externalSku, externalVariantId, metadata } = req.body;
  if (!platform || !productId || !externalProductId || !externalSku) {
    return res.status(400).json({ success: false, error: 'platform, productId, externalProductId, externalSku are required' });
  }

  const mapping = await externalMappingRepository.upsert({
    platform: String(platform).toUpperCase() as PlatformType,
    product_id: productId,
    external_product_id: externalProductId,
    external_sku: externalSku,
    external_variant_id: externalVariantId || null,
    metadata: metadata || {},
    last_synced_at: new Date().toISOString()
  });

  res.json({ success: true, mapping });
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

app.patch('/api/schedules/:id', (req: Request, res: Response) => {
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
  const isManual = req.body?.isManual ?? true;
  const result = await cloudRuntimeController.startRuntime({ ...req.body, isManual });
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

// 3. Cloud Scheduler Webhook/Trigger Ingress with Authorization Validation (Section 19)
app.post('/api/scheduler/trigger', async (req: Request, res: Response) => {
  const schedulerSecret = process.env.SCHEDULER_SECRET_TOKEN;
  const headerToken = req.headers['x-scheduler-token'] || (req.headers['authorization']?.startsWith('Bearer ') ? req.headers['authorization'].substring(7) : null);
  const timestampHeader = req.headers['x-scheduler-timestamp'] as string | undefined;

  // Verify secret if configured
  if (schedulerSecret && headerToken !== schedulerSecret) {
    return res.status(401).json({ success: false, error: 'UNAUTHORIZED_SCHEDULER_REQUEST: Invalid or missing scheduler token' });
  }

  // Verify replay window if timestamp provided (max 5 minutes)
  if (timestampHeader) {
    const reqTime = parseInt(timestampHeader, 10);
    if (!isNaN(reqTime) && Math.abs(Date.now() - reqTime) > 300000) {
      return res.status(403).json({ success: false, error: 'EXPIRED_SCHEDULER_REQUEST: Replay window exceeded' });
    }
  }

  const { scheduleId, action } = req.body;
  if (action === 'START') {
    const result = await cloudRuntimeController.startRuntime({ scheduleId, isManual: false });
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


if (process.env.NODE_ENV !== 'test' && !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`[AI Live Commerce Server] Running at http://localhost:${PORT}`);
  });
}

export default app;
