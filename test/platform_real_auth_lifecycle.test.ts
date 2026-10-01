import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  tikTokShopAuthProvider,
  shopeeAuthProvider,
  oAuthStateService,
  tokenEncryptionService,
  platformConnectionService,
  platformConfigService,
  tiktokTokenService
} from '../server/services/platform';
import { platformConnectionRepository } from '../server/repositories';
import { db } from '../server/db';
import app from '../server/index';

test('1. TikTok Authorization URL - Generates Partner Center OAuth URL with CSRF State', async () => {
  platformConfigService.setConfigOverride('TIKTOK_CLIENT_KEY', 'partner_app_key_12345');
  platformConfigService.setConfigOverride('TIKTOK_CLIENT_SECRET', 'partner_app_secret_abcde');
  platformConfigService.setConfigOverride('TIKTOK_REDIRECT_URI', 'https://example.com/api/platforms/tiktok-shop/callback');

  const customState = 'test_secure_state_token_7781';
  const urlString = await tikTokShopAuthProvider.getAuthorizationUrl(customState);
  const parsed = new URL(urlString);

  assert.equal(parsed.origin, 'https://services.tiktokshops.com');
  assert.equal(parsed.pathname, '/open/authorize');
  assert.equal(parsed.searchParams.get('app_key'), 'partner_app_key_12345');
  assert.equal(parsed.searchParams.get('state'), customState);
  assert.equal(parsed.searchParams.get('redirect_uri'), 'https://example.com/api/platforms/tiktok-shop/callback');

  platformConfigService.clearOverrides();
});

test('2. TikTok Callback State Validation - Rejects Missing or Untracked State', async () => {
  const result = await tikTokShopAuthProvider.handleCallback('some_code', 'unknown_state_parameter');
  assert.equal(result.success, false);
  assert.ok(result.message.includes('OAuth state validation failed'));

  const conn = await platformConnectionRepository.getByPlatform('TIKTOK');
  assert.equal(conn?.status, 'REQUIRES_REAUTH');
});

test('3. TikTok Token Exchange - Mocked HTTP Provider Success Path', async () => {
  platformConfigService.setConfigOverride('TIKTOK_CLIENT_KEY', 'partner_app_key_12345');
  platformConfigService.setConfigOverride('TIKTOK_CLIENT_SECRET', 'partner_app_secret_abcde');

  // Inject mocked HTTP fetch
  tikTokShopAuthProvider.setFetchFn(async (url: string) => {
    assert.ok(url.includes('auth.tiktok-shops.com/api/v2/token/get'));
    return new Response(JSON.stringify({
      code: 0,
      message: 'success',
      data: {
        access_token: 'live_tt_token_real_7761',
        refresh_token: 'live_tt_refresh_real_8892',
        access_token_expire_in: 86400,
        refresh_token_expire_in: 2592000,
        open_id: 'seller_open_id_indonesia_01',
        seller_name: 'PT Sari Glow Nusantara',
        scope: ['seller.shop.read', 'product.read', 'product.write', 'order.read']
      }
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  });

  const state = oAuthStateService.generateState('TIKTOK');
  const callbackRes = await tikTokShopAuthProvider.handleCallback('valid_oauth_code_xyz', state);

  assert.equal(callbackRes.success, true);
  assert.equal(callbackRes.accountId, 'seller_open_id_indonesia_01');

  // Verify tokens are stored encrypted and NOT in plaintext
  const conn = await platformConnectionRepository.getByPlatform('TIKTOK');
  assert.equal(conn?.status, 'CONNECTED');
  assert.ok(conn?.access_token_encrypted);
  assert.notEqual(conn?.access_token_encrypted, 'live_tt_token_real_7761', 'Access token must be encrypted in storage');

  // Decrypted tokens should match
  const decrypted = await platformConnectionRepository.getDecryptedTokens('TIKTOK');
  assert.equal(decrypted.accessToken, 'live_tt_token_real_7761');
  assert.equal(decrypted.refreshToken, 'live_tt_refresh_real_8892');

  tikTokShopAuthProvider.resetFetchFn();
  platformConfigService.clearOverrides();
});

test('4. TikTok Token Refresh - Successful Refresh Updates Vault', async () => {
  platformConfigService.setConfigOverride('TIKTOK_CLIENT_KEY', 'partner_app_key_12345');
  platformConfigService.setConfigOverride('TIKTOK_CLIENT_SECRET', 'partner_app_secret_abcde');

  await platformConnectionRepository.updateTokens('TIKTOK', 'old_access_token', 'active_refresh_token_77', 3600);

  tikTokShopAuthProvider.setFetchFn(async (url: string) => {
    assert.ok(url.includes('auth.tiktok-shops.com/api/v2/token/refresh'));
    return new Response(JSON.stringify({
      code: 0,
      message: 'success',
      data: {
        access_token: 'new_refreshed_access_token_99',
        refresh_token: 'new_refreshed_refresh_token_99',
        access_token_expire_in: 86400
      }
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  });

  const refreshRes = await tikTokShopAuthProvider.refreshAccessToken();
  assert.equal(refreshRes.success, true);

  const decrypted = await platformConnectionRepository.getDecryptedTokens('TIKTOK');
  assert.equal(decrypted.accessToken, 'new_refreshed_access_token_99');

  tikTokShopAuthProvider.resetFetchFn();
  platformConfigService.clearOverrides();
});

test('5. TikTok Token Refresh Failure - Transitions to REQUIRES_REAUTH', async () => {
  platformConfigService.setConfigOverride('TIKTOK_CLIENT_KEY', 'partner_app_key_12345');
  platformConfigService.setConfigOverride('TIKTOK_CLIENT_SECRET', 'partner_app_secret_abcde');

  await platformConnectionRepository.updateTokens('TIKTOK', 'old_access_token', 'revoked_refresh_token', 3600);

  tikTokShopAuthProvider.setFetchFn(async () => {
    return new Response(JSON.stringify({
      code: 10002,
      message: 'Refresh token expired or revoked by seller'
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  });

  const refreshRes = await tikTokShopAuthProvider.refreshAccessToken();
  assert.equal(refreshRes.success, false);

  const conn = await platformConnectionRepository.getByPlatform('TIKTOK');
  assert.equal(conn?.status, 'REQUIRES_REAUTH', 'Failed token refresh must transition to REQUIRES_REAUTH');

  tikTokShopAuthProvider.resetFetchFn();
  platformConfigService.clearOverrides();
});

test('6. TikTok Capability Detection - Scope-Driven Capability Mapping', async () => {
  // Scenario A: Full permissions
  const fullScopes = [
    'seller.shop.read',
    'product.read',
    'product.write',
    'inventory.read',
    'inventory.write',
    'order.read',
    'order.write',
    'promotion.read',
    'im.chat.read',
    'webhook.manage'
  ];
  const caps = tikTokShopAuthProvider.getCapabilities(fullScopes);
  assert.equal(caps.PRODUCT_READ, 'SUPPORTED');
  assert.equal(caps.PRODUCT_WRITE, 'SUPPORTED');
  assert.equal(caps.INVENTORY_READ, 'SUPPORTED');
  assert.equal(caps.ORDER_READ, 'SUPPORTED');
  assert.equal(caps.CHAT_READ, 'SUPPORTED');
  assert.equal(caps.CHAT_WRITE, 'REQUIRES_APPROVAL', 'TikTok Chat reply requires whitelisting');
  assert.equal(caps.LIVE_CONTROL, 'REQUIRES_APPROVAL');

  // Scenario B: Read-only permissions
  const readOnlyCaps = tikTokShopAuthProvider.getCapabilities(['product.read', 'order.read']);
  assert.equal(readOnlyCaps.PRODUCT_READ, 'SUPPORTED');
  assert.equal(readOnlyCaps.PRODUCT_WRITE, 'REQUIRES_APPROVAL', 'Missing write scope must require approval');
});

test('7. Shopee Authorization URL - Partner HMAC Signature and State', async () => {
  platformConfigService.setConfigOverride('SHOPEE_PARTNER_ID', 'partner_9981');
  platformConfigService.setConfigOverride('SHOPEE_PARTNER_KEY', 'partner_secret_key_shopee_88');
  platformConfigService.setConfigOverride('SHOPEE_REDIRECT_URI', 'https://example.com/api/platforms/shopee/callback');

  const customState = 'shopee_state_test_123';
  const urlString = await shopeeAuthProvider.getAuthorizationUrl(customState);
  const parsed = new URL(urlString);

  assert.equal(parsed.origin, 'https://partner.shopeemobile.com');
  assert.equal(parsed.pathname, '/api/v2/shop/auth_partner');
  assert.equal(parsed.searchParams.get('partner_id'), 'partner_9981');
  assert.equal(parsed.searchParams.get('state'), customState);
  assert.ok(parsed.searchParams.get('sign'), 'Must include cryptographic partner signature');
  assert.ok(parsed.searchParams.get('timestamp'));

  platformConfigService.clearOverrides();
});

test('8. Shopee Callback State Validation - Rejects Untracked State', async () => {
  const result = await shopeeAuthProvider.handleCallback('code_123', 'untracked_shopee_state', '12345');
  assert.equal(result.success, false);
  assert.ok(result.message.includes('OAuth state validation failed'));

  const conn = await platformConnectionRepository.getByPlatform('SHOPEE');
  assert.equal(conn?.status, 'REQUIRES_REAUTH');
});

test('9. Shopee Token Exchange - Mocked HTTP Provider Success Path', async () => {
  platformConfigService.setConfigOverride('SHOPEE_PARTNER_ID', 'partner_9981');
  platformConfigService.setConfigOverride('SHOPEE_PARTNER_KEY', 'partner_secret_key_shopee_88');

  shopeeAuthProvider.setFetchFn(async (url: string) => {
    assert.ok(url.includes('/api/v2/auth/token/get'));
    return new Response(JSON.stringify({
      error: '',
      message: 'success',
      response: {
        access_token: 'live_shopee_access_token_11',
        refresh_token: 'live_shopee_refresh_token_22',
        expire_in: 14400,
        shop_id: 29104,
        merchant_id: 7781
      }
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  });

  const state = oAuthStateService.generateState('SHOPEE');
  const callbackRes = await shopeeAuthProvider.handleCallback('valid_shopee_code', state, 29104);

  assert.equal(callbackRes.success, true);
  assert.equal(callbackRes.shopId, '29104');

  const conn = await platformConnectionRepository.getByPlatform('SHOPEE');
  assert.equal(conn?.status, 'CONNECTED');
  assert.ok(conn?.access_token_encrypted);
  assert.notEqual(conn?.access_token_encrypted, 'live_shopee_access_token_11');

  shopeeAuthProvider.resetFetchFn();
  platformConfigService.clearOverrides();
});

test('10. Shopee Token Refresh - Successful Refresh Cycle', async () => {
  platformConfigService.setConfigOverride('SHOPEE_PARTNER_ID', 'partner_9981');
  platformConfigService.setConfigOverride('SHOPEE_PARTNER_KEY', 'partner_secret_key_shopee_88');

  await platformConnectionRepository.updateTokens('SHOPEE', 'old_sp_access', 'active_sp_refresh', 7200);

  shopeeAuthProvider.setFetchFn(async (url: string) => {
    assert.ok(url.includes('/api/v2/auth/access_token/get'));
    return new Response(JSON.stringify({
      error: '',
      message: 'success',
      response: {
        access_token: 'new_sp_access_33',
        refresh_token: 'new_sp_refresh_44',
        expire_in: 14400,
        shop_id: 29104
      }
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  });

  const refreshRes = await shopeeAuthProvider.refreshAccessToken('29104');
  assert.equal(refreshRes.success, true);

  const decrypted = await platformConnectionRepository.getDecryptedTokens('SHOPEE');
  assert.equal(decrypted.accessToken, 'new_sp_access_33');

  shopeeAuthProvider.resetFetchFn();
  platformConfigService.clearOverrides();
});

test('11. Shopee Token Refresh Failure - Transitions to REQUIRES_REAUTH', async () => {
  platformConfigService.setConfigOverride('SHOPEE_PARTNER_ID', 'partner_9981');
  platformConfigService.setConfigOverride('SHOPEE_PARTNER_KEY', 'partner_secret_key_shopee_88');

  await platformConnectionRepository.updateTokens('SHOPEE', 'old_sp_access', 'expired_sp_refresh', 7200);

  shopeeAuthProvider.setFetchFn(async () => {
    return new Response(JSON.stringify({
      error: 'error_auth',
      message: 'Refresh token has expired'
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  });

  const refreshRes = await shopeeAuthProvider.refreshAccessToken('29104');
  assert.equal(refreshRes.success, false);

  const conn = await platformConnectionRepository.getByPlatform('SHOPEE');
  assert.equal(conn?.status, 'REQUIRES_REAUTH');

  shopeeAuthProvider.resetFetchFn();
  platformConfigService.clearOverrides();
});

test('12. Shopee Capability Detection - Non-Negotiable Unsupported Chat Reply and Live Control', async () => {
  const caps = shopeeAuthProvider.getCapabilities(['product', 'inventory', 'order']);
  assert.equal(caps.PRODUCT_READ, 'SUPPORTED');
  assert.equal(caps.INVENTORY_READ, 'SUPPORTED');
  assert.equal(caps.CHAT_READ, 'SUPPORTED');
  assert.equal(caps.CHAT_WRITE, 'UNSUPPORTED', 'Shopee live chat reply must be explicitly UNSUPPORTED');
  assert.equal(caps.LIVE_CONTROL, 'UNSUPPORTED', 'Shopee live broadcast control must be UNSUPPORTED');
});

test('13. Expired OAuth State Rejection', async () => {
  // Generate a state with immediate expiration (1ms TTL)
  const expiredState = oAuthStateService.generateState('TIKTOK', {}, -1000);
  const validation = oAuthStateService.validateAndConsumeState(expiredState, 'TIKTOK');
  assert.equal(validation.valid, false);
  assert.equal(validation.reason, 'STATE_EXPIRED');
});

test('14. Reused OAuth State Rejection (Replay Attack Prevention)', async () => {
  const state = oAuthStateService.generateState('TIKTOK');

  // First use: Valid
  const firstValidation = oAuthStateService.validateAndConsumeState(state, 'TIKTOK');
  assert.equal(firstValidation.valid, true);

  // Second use: Rejected immediately
  const secondValidation = oAuthStateService.validateAndConsumeState(state, 'TIKTOK');
  assert.equal(secondValidation.valid, false);
  assert.ok(secondValidation.reason === 'STATE_ALREADY_USED' || secondValidation.reason === 'INVALID_STATE');
});

test('15. Invalid OAuth State (Tampered or Mismatched Platform)', async () => {
  const tiktokState = oAuthStateService.generateState('TIKTOK');
  // Attempt to use TikTok state for Shopee callback
  const mismatchValidation = oAuthStateService.validateAndConsumeState(tiktokState, 'SHOPEE');
  assert.equal(mismatchValidation.valid, false);
  assert.equal(mismatchValidation.reason, 'PLATFORM_MISMATCH');
});

test('16. Duplicate Refresh Prevention (Concurrent Refresh Lock)', async () => {
  platformConfigService.setConfigOverride('TIKTOK_CLIENT_KEY', 'partner_app_key_12345');
  platformConfigService.setConfigOverride('TIKTOK_CLIENT_SECRET', 'partner_app_secret_abcde');

  await platformConnectionRepository.updateTokens('TIKTOK', 'access_tok', 'refresh_tok', 3600);

  let fetchCallCount = 0;
  tikTokShopAuthProvider.setFetchFn(async () => {
    fetchCallCount++;
    // Simulate network delay
    await new Promise(r => setTimeout(r, 50));
    return new Response(JSON.stringify({
      code: 0,
      message: 'success',
      data: {
        access_token: 'concurrent_refreshed_token',
        refresh_token: 'concurrent_refresh_token',
        access_token_expire_in: 86400
      }
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  });

  // Launch 3 simultaneous refresh calls
  const [res1, res2, res3] = await Promise.all([
    tikTokShopAuthProvider.refreshAccessToken(),
    tikTokShopAuthProvider.refreshAccessToken(),
    tikTokShopAuthProvider.refreshAccessToken()
  ]);

  assert.equal(res1.success, true);
  assert.equal(res2.success, true);
  assert.equal(res3.success, true);
  // Concurrency Lock Invariant: Only ONE actual HTTP fetch occurred
  assert.equal(fetchCallCount, 1, 'Concurrent refresh calls must share single execution lock');

  tikTokShopAuthProvider.resetFetchFn();
  platformConfigService.clearOverrides();
});

test('17. Secret Isolation - Zero Raw Token or Secret Leakage in Metadata or Repositories', async () => {
  const meta = tiktokTokenService.getTokenMetadata();
  const serialized = JSON.stringify(meta);
  assert.equal(serialized.includes('access_token'), false);
  assert.equal(serialized.includes('refresh_token'), false);

  const statuses = platformConnectionService.getAllStatuses();
  const serializedStatuses = JSON.stringify(statuses);
  assert.equal(serializedStatuses.includes('secret'), false);
  assert.equal(serializedStatuses.includes('accessToken'), false);
  assert.equal(serializedStatuses.includes('refreshToken'), false);
});

test('18. Connection Verification Workflow - Identity, Reachability, and Capabilities', async () => {
  platformConfigService.setConfigOverride('TIKTOK_CLIENT_KEY', 'test_key');
  platformConfigService.setConfigOverride('TIKTOK_CLIENT_SECRET', 'test_secret');

  await platformConnectionRepository.updateTokens('TIKTOK', 'valid_verified_token', 'valid_refresh', 86400);

  const report = await tikTokShopAuthProvider.verifyConnection();
  assert.equal(report.healthy, true);
  assert.equal(report.status, 'CONNECTED');
  assert.ok(report.capabilities.PRODUCT_READ);

  const auditLogs = db.getAuditLogs();
  assert.ok(auditLogs.some(a => a.action === 'PLATFORM_VERIFICATION_SUCCEEDED'));

  platformConfigService.clearOverrides();
});

test('19. Not-Configured Platform Behavior', async () => {
  platformConfigService.clearOverrides();

  const report = await tikTokShopAuthProvider.verifyConnection();
  assert.equal(report.healthy, false);
  assert.equal(report.status, 'NOT_CONFIGURED');
});
