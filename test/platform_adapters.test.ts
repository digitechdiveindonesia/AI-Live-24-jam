import test from 'node:test';
import assert from 'node:assert';
import { db } from '../server/db/index.ts';
import {
  platformManager,
  platformAuthProvider,
  platformProductSyncService,
  platformWebhookService,
  TikTokPlatformAdapter,
  ShopeePlatformAdapter,
  PlatformCapabilityType
} from '../server/services/platform/index.ts';
import { eventService } from '../server/services/EventService.ts';

test('1. PlatformAdapter Interface & Universal Contract', async () => {
  const tiktok = platformManager.getAdapter('TIKTOK');
  const shopee = platformManager.getAdapter('SHOPEE');

  assert.ok(tiktok, 'TikTok adapter must be registered');
  assert.ok(shopee, 'Shopee adapter must be registered');

  assert.strictEqual(tiktok?.platform, 'TIKTOK');
  assert.strictEqual(shopee?.platform, 'SHOPEE');

  const ttConn = tiktok?.getConnection();
  assert.strictEqual(ttConn?.platform, 'TIKTOK');
  assert.strictEqual(ttConn?.status, 'CONNECTED');
  assert.strictEqual(ttConn?.environment, 'MOCK');

  const spConn = shopee?.getConnection();
  assert.strictEqual(spConn?.platform, 'SHOPEE');
  assert.strictEqual(spConn?.status, 'CONNECTED');
});

test('2. TikTokPlatformAdapter Capability Discovery and Restrictions', async () => {
  const adapter = new TikTokPlatformAdapter();
  await adapter.initialize();

  const caps = adapter.getCapabilities();
  assert.ok(caps.length >= 10, 'Must have at least 10 defined capabilities');

  // COMMENT_REPLY requires approval on TikTok Open API
  const commentReplyCap = adapter.getCapability('COMMENT_REPLY');
  assert.strictEqual(commentReplyCap.status, 'REQUIRES_APPROVAL');

  // Calling unsupported/unapproved method must return explicit capability status
  const replyResult = await adapter.sendCommentReply('msg-101', 'Halo Kak!');
  assert.strictEqual(replyResult.success, false);
  assert.strictEqual(replyResult.capabilityStatus, 'REQUIRES_APPROVAL');
  assert.ok(replyResult.message.includes('REQUIRES_APPROVAL'));

  // LIVE_STREAM requires approval by default
  const liveCap = adapter.getCapability('LIVE_STREAM');
  assert.strictEqual(liveCap.status, 'REQUIRES_APPROVAL');
  const startLiveRes = await adapter.startLive();
  assert.strictEqual(startLiveRes.success, false);
  assert.strictEqual(startLiveRes.capabilityStatus, 'REQUIRES_APPROVAL');
});

test('3. ShopeePlatformAdapter Explicit Capabilities & Unsupported Chat Reply', async () => {
  const adapter = new ShopeePlatformAdapter();
  await adapter.initialize();

  // Shopee Live does NOT support public chat reply via Open Platform API
  const replyCap = adapter.getCapability('COMMENT_REPLY');
  assert.strictEqual(replyCap.status, 'UNSUPPORTED');

  // Must explicitly reject reply attempts without simulating false success
  const replyResult = await adapter.sendCommentReply('msg-202', 'Terima kasih sudah nonton');
  assert.strictEqual(replyResult.success, false);
  assert.strictEqual(replyResult.capabilityStatus, 'UNSUPPORTED');
  assert.ok(replyResult.message.includes('UNSUPPORTED'));

  // Analytics is region-dependent
  const analyticsCap = adapter.getCapability('LIVE_ANALYTICS');
  assert.strictEqual(analyticsCap.status, 'REGION_DEPENDENT');
});

test('4. Credential Security & MockPlatformAuthProvider', async () => {
  // Authorization URL generator clearly marks simulation
  const authUrl = await platformAuthProvider.getAuthorizationUrl('TIKTOK', 'test_state_123');
  assert.ok(authUrl.includes('simulation=true') || authUrl.includes('mock'));

  // OAuth callback handles tokens securely on server
  const callbackRes = await platformAuthProvider.handleCallback('TIKTOK', 'mock_code_alpha');
  assert.strictEqual(callbackRes.success, true);
  assert.strictEqual(callbackRes.isSimulated, true);
  assert.strictEqual(callbackRes.accountId, 'sari_glow_official_tt');

  // Safe metadata does NOT expose raw access tokens
  const safeMeta = (platformAuthProvider as any).getCredentialsSafeMetadata('TIKTOK');
  assert.strictEqual(safeMeta.hasToken, true);
  assert.strictEqual((safeMeta as any).accessToken, undefined);

  // Refresh credentials
  const refreshOk = await platformAuthProvider.refreshCredentials('TIKTOK');
  assert.strictEqual(refreshOk, true);
});

test('5. PlatformProductSyncService - Internal Catalog as Single Source of Truth', async () => {
  // Sync products to both platforms
  const syncResults = await platformProductSyncService.syncCatalog();
  assert.ok(syncResults.length > 0);
  assert.ok(syncResults.every(r => r.status === 'SYNCED'));

  // Sync specific SKU inventory
  const invResults = await platformProductSyncService.syncInventory('SKU-001', 'TIKTOK');
  assert.strictEqual(invResults[0].sku, 'SKU-001');
  assert.strictEqual(invResults[0].status, 'SYNCED');

  // Conflict detection and auto-resolution via RESOLVED_INTERNAL
  const initialStock = db.getInventory('SKU-001')?.available_stock;
  assert.ok(initialStock !== undefined);

  const conflicts = await platformProductSyncService.detectAndResolveConflicts();
  assert.ok(Array.isArray(conflicts));

  // Retrieve conflict list
  const allConflicts = platformProductSyncService.getConflicts();
  assert.ok(allConflicts.length > 0);

  // Resolve conflict
  const resolved = platformProductSyncService.resolveConflict(
    allConflicts[0].id,
    'RESOLVED_INTERNAL',
    'Verified with warehouse physically'
  );
  assert.ok(resolved);
  assert.strictEqual(resolved.status, 'RESOLVED_INTERNAL');
});

test('6. PlatformWebhookService - Idempotency and Event Deduplication', async () => {
  platformWebhookService.clearCache();

  let commentReceived = false;
  const unsub = eventService.subscribe('PLATFORM_COMMENT_RECEIVED', () => {
    commentReceived = true;
  });

  const uniqueEventId = `tt-webhook-${Date.now()}-test`;
  const webhookPayload = {
    event_id: uniqueEventId,
    event_type: 'LIVE_COMMENT',
    data: {
      author: 'Dewi Sandra',
      handle: '@dewisandra',
      text: 'Kak apakah ready stock?'
    }
  };

  // First ingestion: processed
  const res1 = await platformWebhookService.handleWebhook('TIKTOK', webhookPayload);
  assert.strictEqual(res1.handled, true);
  assert.strictEqual(res1.deduplicated, false);
  assert.strictEqual(commentReceived, true);

  // Second ingestion with same event_id: dropped by idempotency filter
  commentReceived = false;
  const res2 = await platformWebhookService.handleWebhook('TIKTOK', webhookPayload);
  assert.strictEqual(res2.handled, true);
  assert.strictEqual(res2.deduplicated, true);
  assert.strictEqual(commentReceived, false, 'Duplicate webhook must not trigger second event');

  unsub();
});

test('7. Multi-Platform Health Check and Management', async () => {
  const healthResults = await platformManager.healthCheckAll();
  assert.ok(healthResults.TIKTOK, 'TikTok health check must be present');
  assert.ok(healthResults.SHOPEE, 'Shopee health check must be present');

  assert.strictEqual(healthResults.TIKTOK.healthy, true);
  assert.strictEqual(healthResults.SHOPEE.healthy, true);
  assert.ok(healthResults.TIKTOK.latencyMs > 0);

  const allConnections = platformManager.getAllConnections();
  assert.strictEqual(allConnections.length, 2);

  const allCapabilities = platformManager.getAllCapabilities();
  assert.ok(allCapabilities.TIKTOK);
  assert.ok(allCapabilities.SHOPEE);
});
