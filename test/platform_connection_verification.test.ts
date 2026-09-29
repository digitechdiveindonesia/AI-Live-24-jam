import test from 'node:test';
import assert from 'node:assert';
import { db } from '../server/db/index.ts';
import {
  platformConfigService,
  tiktokTokenService,
  tiktokCapabilityDiscoveryService,
  shopeeCapabilityDiscoveryService,
  platformRateLimiter,
  connectionVerificationService,
  platformConnectionService,
  platformResponseRouter,
  platformAuthProvider,
  platformWebhookService
} from '../server/services/platform/index.ts';

test('1. TikTok Authorization URL Generation & Official Scopes', async () => {
  platformConfigService.clearOverrides();
  platformConfigService.setConfigOverride('TIKTOK_CLIENT_KEY', 'test_client_key_123');
  platformConfigService.setConfigOverride('TIKTOK_CLIENT_SECRET', 'test_secret_456');
  platformConfigService.setConfigOverride('TIKTOK_REDIRECT_URI', 'https://example.com/oauth/callback');

  const authUrl = await platformAuthProvider.getAuthorizationUrl('TIKTOK', 'valid_csrf_state');
  assert.ok(authUrl.includes('services.tiktokshops.com/open/authorize'), 'Must use official authorization endpoint');
  assert.ok(authUrl.includes('app_key=test_client_key_123'), 'Must pass configured client key');
  assert.ok(authUrl.includes('state=valid_csrf_state'), 'Must preserve CSRF state parameter');

  platformConfigService.clearOverrides();
});

test('2. OAuth Callback & CSRF State Protection', async () => {
  // Test invalid / expired OAuth state
  const badResult = await platformAuthProvider.handleCallback('TIKTOK', 'auth_code_xyz', 'unregistered_state_999');
  assert.strictEqual(badResult.success, false);
  assert.ok(badResult.message.includes('CSRF'));

  // Test valid simulation state
  const validResult = await platformAuthProvider.handleCallback('TIKTOK', 'mock_code_valid', 'sim_state_123');
  assert.strictEqual(validResult.success, true);
  assert.strictEqual(validResult.isSimulated, true);
  assert.ok(validResult.accountId);
});

test('3. TikTok Token Management: Expiration, Refresh & Revocation', async () => {
  // Store initial tokens with short expiry
  tiktokTokenService.storeTokens({
    accessToken: 'test_token_live',
    refreshToken: 'test_refresh_live',
    expiresInSec: 2, // 2 seconds
    openId: 'seller_rina_01',
    shopId: 'ID_SHOP_991',
    scopes: ['seller.info.read', 'product.read']
  });

  const meta = tiktokTokenService.getTokenMetadata();
  assert.strictEqual(meta.accountId, 'seller_rina_01');
  assert.strictEqual(meta.hasRefreshToken, true);

  // Raw token should not be exposed in metadata
  assert.strictEqual((meta as any).accessToken, undefined);

  // Refresh while refreshToken is valid
  const refreshOk = await tiktokTokenService.refreshAccessToken();
  assert.strictEqual(refreshOk, true);
  assert.strictEqual(tiktokTokenService.getTokenState(), 'TOKEN_AVAILABLE');

  // Invalidate / revoke tokens
  tiktokTokenService.invalidateToken('Testing operator logout');
  assert.strictEqual(tiktokTokenService.getTokenState(), 'TOKEN_INVALID');
  assert.strictEqual(tiktokTokenService.hasValidToken(), false);

  // Refresh after revocation must fail
  const refreshAfterRevoke = await tiktokTokenService.refreshAccessToken();
  assert.strictEqual(refreshAfterRevoke, false);
  assert.strictEqual(tiktokTokenService.getTokenState(), 'TOKEN_INVALID');
});

test('4. TikTok Capability Discovery & Scope Discrimination', async () => {
  // Scenario A: Missing required scopes
  tiktokTokenService.storeTokens({
    accessToken: 'test_token_limited',
    expiresInSec: 3600,
    scopes: ['seller.info.read'] // Missing product.read, live.interactive.read, etc.
  });

  const capsA = await tiktokCapabilityDiscoveryService.discoverAllCapabilities(false);
  const prodCap = capsA.find(c => c.capability === 'PRODUCT_DATA');
  assert.strictEqual(prodCap?.status, 'REQUIRES_APPROVAL', 'Missing scope must yield REQUIRES_APPROVAL');

  const commentCap = capsA.find(c => c.capability === 'LIVE_COMMENTS');
  assert.strictEqual(commentCap?.status, 'UNKNOWN', 'Unverified live comments must yield UNKNOWN');

  const replyCap = capsA.find(c => c.capability === 'COMMENT_REPLY');
  assert.strictEqual(replyCap?.status, 'REQUIRES_APPROVAL', 'Elevated write permission must yield REQUIRES_APPROVAL');

  // Scenario B: Sandbox Demo Mode
  const capsDemo = await tiktokCapabilityDiscoveryService.discoverAllCapabilities(true);
  const liveCapDemo = capsDemo.find(c => c.capability === 'LIVE');
  assert.strictEqual(liveCapDemo?.status, 'REQUIRES_APPROVAL', 'Live stream broadcast requires explicit ingest key');
});

test('5. Shopee Capability Discovery & Non-Negotiable Unsupported APIs', async () => {
  const caps = await shopeeCapabilityDiscoveryService.discoverAllCapabilities(true);

  // Shopee Live does NOT support public chat reply API
  const replyCap = caps.find(c => c.capability === 'COMMENT_REPLY');
  assert.strictEqual(replyCap?.status, 'UNSUPPORTED', 'Shopee comment reply must be UNSUPPORTED');

  const analyticsCap = caps.find(c => c.capability === 'LIVE_ANALYTICS');
  assert.strictEqual(analyticsCap?.status, 'REGION_DEPENDENT');
});

test('6. ConnectionVerificationService: Multi-Point Verification', async () => {
  // Test NOT_CONFIGURED when environment keys are absent
  platformConfigService.clearOverrides();
  const unconfiguredReport = await connectionVerificationService.verifyConnection('TIKTOK', false);
  assert.strictEqual(unconfiguredReport.result, 'NOT_CONFIGURED');
  assert.strictEqual(unconfiguredReport.authentication, false);

  // Test PASS in verified demo sandbox
  const demoReport = await connectionVerificationService.verifyConnection('TIKTOK', true);
  assert.strictEqual(demoReport.result, 'PASS');
  assert.strictEqual(demoReport.apiReachability, true);
  assert.ok(demoReport.latencyMs !== null && demoReport.latencyMs > 0);

  // Telemetry tracking
  const telem = connectionVerificationService.getTelemetry('TIKTOK');
  assert.ok(telem.lastSuccessfulRequest);
  assert.ok(telem.latencyDisplay.includes('ms'));
});

test('7. Webhook HMAC Signature & Replay Window Verification', async () => {
  platformConfigService.setConfigOverride('TIKTOK_CLIENT_KEY', 'client_123');
  platformConfigService.setConfigOverride('TIKTOK_CLIENT_SECRET', 'super_secret_webhook_key_778');
  platformConfigService.setConfigOverride('TIKTOK_REDIRECT_URI', 'https://example.com/callback');

  // 1. Replay attack with expired timestamp (drift > 5 mins)
  const staleTimestamp = Date.now() - 600000; // 10 minutes ago
  const replayResult = platformWebhookService.verifyWebhookRequest(
    'TIKTOK',
    { event_id: 'evt-stale-1', text: 'Stale' },
    'some_sig',
    staleTimestamp.toString()
  );
  assert.strictEqual(replayResult.valid, false);
  assert.strictEqual(replayResult.reason, 'TIMESTAMP_EXPIRED_REPLAY_DETECTED');

  // 2. Signature verification
  const validPayload = { event_id: `evt-fresh-${Date.now()}`, type: 'ORDER_CREATED', sku: 'SKU-001' };
  const hmacRes = await platformWebhookService.handleWebhook('TIKTOK', validPayload, 'mock_valid_tiktok');
  assert.strictEqual(hmacRes.handled, true);
  assert.strictEqual(hmacRes.deduplicated, false);

  // 3. Duplicate event rejected by idempotency filter
  const dupRes = await platformWebhookService.handleWebhook('TIKTOK', validPayload, 'mock_valid_tiktok');
  assert.strictEqual(dupRes.handled, true);
  assert.strictEqual(dupRes.deduplicated, true);

  platformConfigService.clearOverrides();
});

test('8. Platform Rate Limiting & Throttling Circuit Breaker', async () => {
  platformRateLimiter.reset('TIKTOK');

  // Initial state: allowed
  assert.strictEqual(platformRateLimiter.checkLimit('TIKTOK').allowed, true);

  // Trigger 429 throttling with 2-second retry
  platformRateLimiter.recordThrottled('TIKTOK', 2);
  const limited = platformRateLimiter.checkLimit('TIKTOK');
  assert.strictEqual(limited.allowed, false);
  assert.ok(limited.retryAfterMs > 0);

  const state = platformRateLimiter.getState('TIKTOK');
  assert.strictEqual(state.isRateLimited, true);

  // Reset recovers
  platformRateLimiter.reset('TIKTOK');
  assert.strictEqual(platformRateLimiter.checkLimit('TIKTOK').allowed, true);
});

test('9. Safe Platform Response Routing & Operator Queue Isolation', async () => {
  platformResponseRouter.clearOperatorQueue();

  // Scenario A: Guardrail blocked -> MUST hold in operator queue
  const resBlocked = await platformResponseRouter.routeResponse({
    platform: 'TIKTOK',
    conversationId: 'conv-01',
    responseText: 'Produk ini pasti menyembuhkan jerawat permanen semalam!',
    guardrailStatus: 'BLOCKED'
  });
  assert.strictEqual(resBlocked.sent, false);
  assert.strictEqual(resBlocked.target, 'OPERATOR_QUEUE');
  assert.strictEqual(resBlocked.reason, 'BLOCKED_BY_GUARDRAIL');

  // Scenario B: Shopee comment reply is UNSUPPORTED -> MUST hold in operator queue without throwing
  const resShopee = await platformResponseRouter.routeResponse({
    platform: 'SHOPEE',
    conversationId: 'conv-02',
    commentId: 'comment-sp-99',
    responseText: 'Halo kak, stok ready ya!',
    guardrailStatus: 'APPROVED'
  });
  assert.strictEqual(resShopee.sent, false);
  assert.strictEqual(resShopee.target, 'OPERATOR_QUEUE');
  assert.strictEqual(resShopee.reason, 'CAPABILITY_UNSUPPORTED');

  // Verify held items in queue
  const queue = platformResponseRouter.getOperatorQueue();
  assert.strictEqual(queue.length, 2);
});

test('10. Multi-Platform Isolation: Failure on One Platform Does Not Affect the Other', async () => {
  // Disconnect TikTok
  await platformConnectionService.disconnect('TIKTOK');
  assert.strictEqual(platformConnectionService.getStatus('TIKTOK').connectionStatus, 'DISCONNECTED');

  // Shopee remains CONNECTED
  assert.strictEqual(platformConnectionService.getStatus('SHOPEE').connectionStatus, 'CONNECTED');

  // Internal catalog remains intact
  const serum = db.getProductBySku('SKU-001');
  assert.ok(serum);
  assert.strictEqual(serum.sku, 'SKU-001');

  // Reconnect TikTok in Demo mode
  await platformConnectionService.connect('TIKTOK', true);
  assert.strictEqual(platformConnectionService.getStatus('TIKTOK').connectionStatus, 'CONNECTED');
});

test('11. Secret Protection: Zero Secrets Returned in Safe Metadata', async () => {
  const configs = platformConfigService.getAllSafeConfigs();
  const configStr = JSON.stringify(configs);
  assert.strictEqual(configStr.includes('clientSecret'), false);
  assert.strictEqual(configStr.includes('partnerKey'), false);

  const conns = platformConnectionService.getAllStatuses();
  const connStr = JSON.stringify(conns);
  assert.strictEqual(connStr.includes('accessToken'), false);
  assert.strictEqual(connStr.includes('refreshToken'), false);
});
