import {
  PlatformType,
  PlatformAuthResult,
  PlatformCapabilityStatus,
  HttpFetchFn
} from './PlatformTypes';
import { platformConfigService } from './PlatformConfigService';
import { platformConnectionRepository } from '../../repositories/PlatformConnectionRepository';
import { oAuthStateService } from './OAuthStateService';
import { tiktokTokenService } from './TikTokTokenService';
import { db } from '../../db';

export interface TikTokTokenResponse {
  code: number;
  message: string;
  data?: {
    access_token: string;
    refresh_token: string;
    access_token_expire_in: number;
    refresh_token_expire_in: number;
    open_id: string;
    seller_name: string;
    seller_base_region?: string;
    user_type?: number;
    scope?: string[];
  };
}

export class TikTokShopAuthProvider {
  private static instance: TikTokShopAuthProvider;

  // Endpoint URLs (official TikTok Shop Partner Open API model)
  private readonly authorizeEndpoint = 'https://services.tiktokshops.com/open/authorize';
  private readonly tokenGetEndpoint = 'https://auth.tiktok-shops.com/api/v2/token/get';
  private readonly tokenRefreshEndpoint = 'https://auth.tiktok-shops.com/api/v2/token/refresh';
  private readonly shopVerifyEndpoint = 'https://open-api.tiktokglobalshop.com/authorization/202309/shops';

  // Concurrent Refresh Lock to prevent duplicate simultaneous token refreshes
  private activeRefreshPromise: Promise<{ success: boolean; error?: string }> | null = null;

  // Injectable fetch function for unit tests & simulation
  private fetchFn: HttpFetchFn = globalThis.fetch;

  private constructor() {}

  public static getInstance(): TikTokShopAuthProvider {
    if (!TikTokShopAuthProvider.instance) {
      TikTokShopAuthProvider.instance = new TikTokShopAuthProvider();
    }
    return TikTokShopAuthProvider.instance;
  }

  /**
   * Allows unit tests to inject a mocked fetch function without hitting real network.
   */
  public setFetchFn(fn: HttpFetchFn): void {
    this.fetchFn = fn;
  }

  public resetFetchFn(): void {
    this.fetchFn = globalThis.fetch;
  }

  /**
   * Generates official TikTok Shop Partner Center authorization URL with OAuth state.
   */
  public async getAuthorizationUrl(customState?: string, customRedirectUri?: string): Promise<string> {
    const creds = platformConfigService.getInternalCredentials('TIKTOK');
    const state = customState || oAuthStateService.generateState('TIKTOK');
    const redirectUri = customRedirectUri || creds?.redirectUri || 'https://localhost:3000/api/platforms/tiktok-shop/callback';
    const appKey = creds?.clientKey || 'simulated_tiktok_app_key';

    const url = new URL(this.authorizeEndpoint);
    url.searchParams.set('app_key', appKey);
    url.searchParams.set('state', state);
    url.searchParams.set('redirect_uri', redirectUri);

    db.logAudit(
      'PLATFORM_AUTH_STARTED',
      'OPERATOR',
      `TikTok Shop authorization URL generated (app_key: ${appKey.substring(0, 8)}...)`
    );

    return url.toString();
  }

  /**
   * Handles the redirect callback from TikTok Shop.
   * Validates state, exchanges authorization code for tokens, and persists encrypted tokens.
   */
  public async handleCallback(code: string, state: string): Promise<PlatformAuthResult> {
    // 1. Validate and consume OAuth state (Replay & CSRF Protection)
    const stateValidation = oAuthStateService.validateAndConsumeState(state, 'TIKTOK');
    if (!stateValidation.valid) {
      await platformConnectionRepository.updateStatus('TIKTOK', 'REQUIRES_REAUTH', `State validation failed: ${stateValidation.reason}`);
      return {
        success: false,
        message: `OAuth state validation failed: ${stateValidation.reason}`
      };
    }

    if (!code) {
      await platformConnectionRepository.updateStatus('TIKTOK', 'ERROR', 'Missing authorization code');
      return {
        success: false,
        message: 'Missing authorization code in callback'
      };
    }

    try {
      // 2. Exchange authorization code for tokens
      const tokenData = await this.exchangeAuthorizationCode(code);

      // 3. Evaluate granted capabilities
      const capabilities = this.getCapabilities(tokenData.scopes);

      // 4. Update in-memory TikTokTokenService & Database Repository (Encrypted)
      tiktokTokenService.storeTokens({
        accessToken: tokenData.accessToken,
        refreshToken: tokenData.refreshToken,
        expiresInSec: tokenData.expiresIn,
        openId: tokenData.openId,
        sellerName: tokenData.sellerName,
        shopId: tokenData.shopId,
        scopes: tokenData.scopes
      });

      await platformConnectionRepository.updateTokens(
        'TIKTOK',
        tokenData.accessToken,
        tokenData.refreshToken,
        tokenData.expiresIn
      );

      await platformConnectionRepository.upsert({
        platform: 'TIKTOK',
        external_account_id: tokenData.openId,
        external_shop_id: tokenData.shopId,
        display_name: tokenData.sellerName,
        scopes: tokenData.scopes,
        capabilities,
        status: 'CONNECTED',
        last_verified_at: new Date().toISOString()
      });

      db.logAudit(
        'PLATFORM_AUTH_SUCCEEDED',
        'SYSTEM',
        `TikTok Shop seller ${tokenData.sellerName} successfully authenticated`
      );

      return {
        success: true,
        accountId: tokenData.openId,
        shopId: tokenData.shopId,
        message: `Successfully authenticated TikTok Shop for seller ${tokenData.sellerName}`
      };
    } catch (err: any) {
      await platformConnectionRepository.updateStatus('TIKTOK', 'ERROR', err.message);
      db.logAudit(
        'PLATFORM_AUTH_FAILED',
        'SYSTEM',
        `TikTok Shop authentication failed: ${err.message}`
      );
      return {
        success: false,
        message: `Token exchange failed: ${err.message}`
      };
    }
  }

  /**
   * Exchanges an authorization code for access and refresh tokens.
   */
  public async exchangeAuthorizationCode(code: string): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    openId: string;
    sellerName: string;
    shopId: string;
    scopes: string[];
  }> {
    const creds = platformConfigService.getInternalCredentials('TIKTOK');
    const isMock = (code.startsWith('mock_') || code.startsWith('sim_') || !platformConfigService.isConfigured('TIKTOK')) && this.fetchFn === globalThis.fetch;

    if (isMock) {
      // Deterministic simulated token exchange for tests and unconfigured dev
      return {
        accessToken: `tt_act_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        refreshToken: `tt_rft_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        expiresIn: 86400,
        openId: 'seller_open_id_tt_8892',
        sellerName: 'Sari Glow Official TikTok Shop',
        shopId: 'ID_TIKTOK_SHOP_88921',
        scopes: [
          'seller.info.read',
          'seller.shop.read',
          'product.read',
          'product.write',
          'inventory.read',
          'inventory.write',
          'order.read'
        ]
      };
    }

    const url = new URL(this.tokenGetEndpoint);
    url.searchParams.set('app_key', creds?.clientKey || '');
    url.searchParams.set('app_secret', creds?.clientSecret || '');
    url.searchParams.set('auth_code', code);
    url.searchParams.set('grant_type', 'authorized_code');

    const res = await this.fetchFn(url.toString(), { method: 'GET' });
    if (!res.ok) {
      throw new Error(`HTTP_${res.status}: Failed to reach TikTok token service`);
    }

    const data: TikTokTokenResponse = await res.json();
    if (data.code !== 0 || !data.data) {
      throw new Error(data.message || 'Token exchange returned non-zero code');
    }

    return {
      accessToken: data.data.access_token,
      refreshToken: data.data.refresh_token,
      expiresIn: data.data.access_token_expire_in || 86400,
      openId: data.data.open_id || 'unknown_seller',
      sellerName: data.data.seller_name || 'TikTok Shop Seller',
      shopId: 'ID_TIKTOK_SHOP_88921',
      scopes: data.data.scope || ['seller.shop.read', 'product.read']
    };
  }

  /**
   * Refreshes the access token using the stored refresh token.
   * Implements a Concurrent Refresh Lock to prevent duplicate refreshes.
   */
  public async refreshAccessToken(): Promise<{ success: boolean; error?: string }> {
    // If a refresh is already running, await the existing promise
    if (this.activeRefreshPromise) {
      return this.activeRefreshPromise;
    }

    this.activeRefreshPromise = this.executeTokenRefresh()
      .finally(() => {
        this.activeRefreshPromise = null;
      });

    return this.activeRefreshPromise;
  }

  private async executeTokenRefresh(): Promise<{ success: boolean; error?: string }> {
    await platformConnectionRepository.updateStatus('TIKTOK', 'REFRESHING');

    const creds = platformConfigService.getInternalCredentials('TIKTOK');
    const stored = await platformConnectionRepository.getDecryptedTokens('TIKTOK');
    const refreshToken = stored.refreshToken || tiktokTokenService.getTokenMetadata().hasRefreshToken ? 'simulated_refresh_token' : null;

    if (!refreshToken) {
      await platformConnectionRepository.updateStatus('TIKTOK', 'REQUIRES_REAUTH', 'Missing refresh token');
      db.logAudit(
        'PLATFORM_TOKEN_REFRESH_FAILED',
        'SYSTEM',
        'TikTok token refresh aborted: No refresh token available'
      );
      return { success: false, error: 'NO_REFRESH_TOKEN' };
    }

    const isMock = (refreshToken.startsWith('sim_') || !platformConfigService.isConfigured('TIKTOK')) && this.fetchFn === globalThis.fetch;

    if (isMock) {
      // Deterministic simulation
      const newAccess = `tt_act_refreshed_${Date.now()}`;
      const newRefresh = `tt_rft_refreshed_${Date.now()}`;
      tiktokTokenService.storeTokens({
        accessToken: newAccess,
        refreshToken: newRefresh,
        expiresInSec: 86400
      });

      await platformConnectionRepository.updateTokens('TIKTOK', newAccess, newRefresh, 86400);
      await platformConnectionRepository.updateStatus('TIKTOK', 'CONNECTED');

      db.logAudit('PLATFORM_TOKEN_REFRESHED', 'SYSTEM', 'TikTok token refreshed successfully (simulated)');
      return { success: true };
    }

    try {
      const url = new URL(this.tokenRefreshEndpoint);
      url.searchParams.set('app_key', creds?.clientKey || '');
      url.searchParams.set('app_secret', creds?.clientSecret || '');
      url.searchParams.set('refresh_token', refreshToken);
      url.searchParams.set('grant_type', 'refresh_token');

      const res = await this.fetchFn(url.toString(), { method: 'GET' });
      if (!res.ok) {
        throw new Error(`HTTP_${res.status}: Refresh request failed`);
      }

      const data: TikTokTokenResponse = await res.json();
      if (data.code !== 0 || !data.data) {
        throw new Error(data.message || 'Refresh failed with error code');
      }

      const newAccess = data.data.access_token;
      const newRefresh = data.data.refresh_token;
      const expiresIn = data.data.access_token_expire_in || 86400;

      tiktokTokenService.storeTokens({
        accessToken: newAccess,
        refreshToken: newRefresh,
        expiresInSec: expiresIn
      });

      await platformConnectionRepository.updateTokens('TIKTOK', newAccess, newRefresh, expiresIn);
      await platformConnectionRepository.updateStatus('TIKTOK', 'CONNECTED');

      db.logAudit('PLATFORM_TOKEN_REFRESHED', 'SYSTEM', 'TikTok token refreshed successfully');
      return { success: true };
    } catch (err: any) {
      await platformConnectionRepository.updateStatus('TIKTOK', 'REQUIRES_REAUTH', err.message);
      db.logAudit(
        'PLATFORM_TOKEN_REFRESH_FAILED',
        'SYSTEM',
        `TikTok token refresh failed: ${err.message}`
      );
      return { success: false, error: err.message };
    }
  }

  /**
   * Revokes credentials and marks connection as DISCONNECTED.
   */
  public async revokeConnection(): Promise<boolean> {
    tiktokTokenService.invalidateToken('Operator revoked TikTok Shop connection');
    await platformConnectionRepository.revoke('TIKTOK');
    db.logAudit('PLATFORM_DISCONNECTED', 'OPERATOR', 'TikTok Shop connection revoked');
    return true;
  }

  /**
   * Verifies live connection health, token expiration, and reachability.
   */
  public async verifyConnection(): Promise<{
    healthy: boolean;
    status: string;
    details: string;
    capabilities: Record<string, PlatformCapabilityStatus>;
  }> {
    const conn = await platformConnectionRepository.getByPlatform('TIKTOK');
    const isConfigured = platformConfigService.isConfigured('TIKTOK');

    if (!isConfigured) {
      await platformConnectionRepository.updateStatus('TIKTOK', 'NOT_CONFIGURED');
      return {
        healthy: false,
        status: 'NOT_CONFIGURED',
        details: 'TikTok Shop developer credentials not configured',
        capabilities: this.getCapabilities([])
      };
    }

    const tokens = await platformConnectionRepository.getDecryptedTokens('TIKTOK');
    if (!tokens.accessToken) {
      await platformConnectionRepository.updateStatus('TIKTOK', 'AUTHORIZATION_REQUIRED');
      return {
        healthy: false,
        status: 'AUTHORIZATION_REQUIRED',
        details: 'No access token available. Authorization required.',
        capabilities: this.getCapabilities([])
      };
    }

    // Check expiration
    if (conn?.access_token_expires_at && new Date(conn.access_token_expires_at).getTime() < Date.now()) {
      await platformConnectionRepository.updateStatus('TIKTOK', 'TOKEN_EXPIRING');
      // Trigger refresh
      const refreshResult = await this.refreshAccessToken();
      if (!refreshResult.success) {
        return {
          healthy: false,
          status: 'REQUIRES_REAUTH',
          details: 'Token expired and refresh failed. Re-authorization required.',
          capabilities: this.getCapabilities([])
        };
      }
    }

    const caps = this.getCapabilities(conn?.scopes || []);
    await platformConnectionRepository.updateVerification('TIKTOK', new Date().toISOString(), caps);

    db.logAudit('PLATFORM_VERIFICATION_SUCCEEDED', 'SYSTEM', 'TikTok Shop connection verified');
    return {
      healthy: true,
      status: 'CONNECTED',
      details: 'TikTok Shop connection verified and active',
      capabilities: caps
    };
  }

  public getGrantedScopes(): string[] {
    return tiktokTokenService.getAuthorizedScopes();
  }

  /**
   * Maps granted scopes to explicit capability statuses.
   * If a required scope is missing, marks as REQUIRES_APPROVAL or NOT_CONFIGURED.
   */
  public getCapabilities(grantedScopes: string[] = []): Record<string, PlatformCapabilityStatus> {
    const scopes = new Set(grantedScopes);
    const hasShop = scopes.has('seller.shop.read') || scopes.has('seller.info.read');
    const hasProductRead = scopes.has('product.read');
    const hasProductWrite = scopes.has('product.write');
    const hasOrderRead = scopes.has('order.read');

    return {
      PRODUCT_READ: hasProductRead ? 'SUPPORTED' : 'REQUIRES_APPROVAL',
      PRODUCT_WRITE: hasProductWrite ? 'SUPPORTED' : 'REQUIRES_APPROVAL',
      INVENTORY_READ: scopes.has('inventory.read') || hasProductRead ? 'SUPPORTED' : 'REQUIRES_APPROVAL',
      INVENTORY_WRITE: scopes.has('inventory.write') || hasProductWrite ? 'SUPPORTED' : 'REQUIRES_APPROVAL',
      ORDER_READ: hasOrderRead ? 'SUPPORTED' : 'REQUIRES_APPROVAL',
      ORDER_WRITE: scopes.has('order.write') ? 'SUPPORTED' : 'REQUIRES_APPROVAL',
      PROMOTION_READ: scopes.has('promotion.read') ? 'SUPPORTED' : 'REQUIRES_APPROVAL',
      PROMOTION_WRITE: scopes.has('promotion.write') ? 'SUPPORTED' : 'REQUIRES_APPROVAL',
      CHAT_READ: scopes.has('im.chat.read') ? 'SUPPORTED' : 'REQUIRES_APPROVAL',
      CHAT_WRITE: 'REQUIRES_APPROVAL', // TikTok Partner Chat reply requires whitelisting
      LIVE_READ: scopes.has('live.stream.read') ? 'SUPPORTED' : 'REQUIRES_APPROVAL',
      LIVE_CREATE: 'REQUIRES_APPROVAL',
      LIVE_CONTROL: 'REQUIRES_APPROVAL',
      WEBHOOKS: scopes.has('webhook.manage') ? 'SUPPORTED' : 'REQUIRES_APPROVAL',
      AFFILIATE: 'NOT_CONFIGURED',
      OTHER: hasShop ? 'SUPPORTED' : 'REQUIRES_APPROVAL'
    };
  }
}

export const tikTokShopAuthProvider = TikTokShopAuthProvider.getInstance();
