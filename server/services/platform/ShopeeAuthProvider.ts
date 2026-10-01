import crypto from 'crypto';
import {
  PlatformType,
  PlatformAuthResult,
  PlatformCapabilityStatus,
  HttpFetchFn
} from './PlatformTypes';
import { platformConfigService } from './PlatformConfigService';
import { platformConnectionRepository } from '../../repositories/PlatformConnectionRepository';
import { oAuthStateService } from './OAuthStateService';
import { db } from '../../db';

export interface ShopeeTokenResponse {
  error: string;
  message: string;
  response?: {
    access_token: string;
    refresh_token: string;
    expire_in: number;
    shop_id?: number | string;
    merchant_id?: number | string;
  };
}

export class ShopeeAuthProvider {
  private static instance: ShopeeAuthProvider;

  // Official Shopee Open Platform v2 endpoints
  private readonly baseUrl = 'https://partner.shopeemobile.com';
  private readonly authPartnerPath = '/api/v2/shop/auth_partner';
  private readonly tokenGetPath = '/api/v2/auth/token/get';
  private readonly tokenRefreshPath = '/api/v2/auth/access_token/get';
  private readonly shopInfoPath = '/api/v2/shop/get_shop_info';

  // Concurrent Refresh Lock
  private activeRefreshPromise: Promise<{ success: boolean; error?: string }> | null = null;

  // Injectable fetch function for unit tests
  private fetchFn: HttpFetchFn = globalThis.fetch;

  private constructor() {}

  public static getInstance(): ShopeeAuthProvider {
    if (!ShopeeAuthProvider.instance) {
      ShopeeAuthProvider.instance = new ShopeeAuthProvider();
    }
    return ShopeeAuthProvider.instance;
  }

  public setFetchFn(fn: HttpFetchFn): void {
    this.fetchFn = fn;
  }

  public resetFetchFn(): void {
    this.fetchFn = globalThis.fetch;
  }

  /**
   * Generates Shopee Open Platform v2 partner signature for a given API path and timestamp.
   * Isolates Shopee cryptographic signing strictly inside this provider.
   */
  public generatePartnerSignature(partnerId: string, partnerKey: string, path: string, timestamp: number): string {
    const baseString = `${partnerId}${path}${timestamp}`;
    return crypto.createHmac('sha256', partnerKey).update(baseString).digest('hex');
  }

  /**
   * Generates official Shopee Open Platform v2 authorization URL with HMAC signature and state.
   */
  public async getAuthorizationUrl(customState?: string, customRedirectUri?: string): Promise<string> {
    const creds = platformConfigService.getInternalCredentials('SHOPEE');
    const state = customState || oAuthStateService.generateState('SHOPEE');
    const redirectUri = customRedirectUri || creds?.redirectUri || 'https://localhost:3000/api/platforms/shopee/callback';
    const partnerId = creds?.partnerId || 'simulated_shopee_partner_id';
    const partnerKey = creds?.partnerKey || 'simulated_shopee_partner_key';

    const timestamp = Math.floor(Date.now() / 1000);
    const sign = this.generatePartnerSignature(partnerId, partnerKey, this.authPartnerPath, timestamp);

    const url = new URL(`${this.baseUrl}${this.authPartnerPath}`);
    url.searchParams.set('partner_id', partnerId);
    url.searchParams.set('timestamp', timestamp.toString());
    url.searchParams.set('sign', sign);
    url.searchParams.set('redirect', redirectUri);
    url.searchParams.set('state', state);

    db.logAudit(
      'PLATFORM_AUTH_STARTED',
      'OPERATOR',
      `Shopee authorization URL generated (partner_id: ${partnerId.substring(0, 8)}...)`
    );

    return url.toString();
  }

  /**
   * Handles the redirect callback from Shopee Open Platform.
   */
  public async handleCallback(
    code: string,
    state: string,
    shopId?: string | number
  ): Promise<PlatformAuthResult> {
    // 1. Validate and consume OAuth state (Replay & CSRF Protection)
    const stateValidation = oAuthStateService.validateAndConsumeState(state, 'SHOPEE');
    if (!stateValidation.valid) {
      await platformConnectionRepository.updateStatus('SHOPEE', 'REQUIRES_REAUTH', `State validation failed: ${stateValidation.reason}`);
      return {
        success: false,
        message: `OAuth state validation failed: ${stateValidation.reason}`
      };
    }

    if (!code) {
      await platformConnectionRepository.updateStatus('SHOPEE', 'ERROR', 'Missing authorization code');
      return {
        success: false,
        message: 'Missing authorization code in callback'
      };
    }

    try {
      // 2. Exchange authorization code for tokens
      const finalShopId = shopId ? String(shopId) : 'SHOPEE_SHOP_29104';
      const tokenData = await this.exchangeAuthorizationCode(code, finalShopId);

      // 3. Evaluate granted capabilities
      const capabilities = this.getCapabilities(['product', 'inventory', 'order']);

      // 4. Update Database Repository (Encrypted)
      await platformConnectionRepository.updateTokens(
        'SHOPEE',
        tokenData.accessToken,
        tokenData.refreshToken,
        tokenData.expiresIn
      );

      await platformConnectionRepository.upsert({
        platform: 'SHOPEE',
        external_account_id: 'sari_glow_shopee_mall',
        external_shop_id: tokenData.shopId,
        external_merchant_id: tokenData.merchantId || null,
        display_name: 'Sari Glow Shopee Mall Official',
        region: 'ID',
        scopes: ['product', 'inventory', 'order'],
        capabilities,
        status: 'CONNECTED',
        last_verified_at: new Date().toISOString()
      });

      db.logAudit(
        'PLATFORM_AUTH_SUCCEEDED',
        'SYSTEM',
        `Shopee shop ${tokenData.shopId} successfully authenticated`
      );

      return {
        success: true,
        accountId: 'sari_glow_shopee_mall',
        shopId: tokenData.shopId,
        message: `Successfully authenticated Shopee shop ${tokenData.shopId}`
      };
    } catch (err: any) {
      await platformConnectionRepository.updateStatus('SHOPEE', 'ERROR', err.message);
      db.logAudit(
        'PLATFORM_AUTH_FAILED',
        'SYSTEM',
        `Shopee authentication failed: ${err.message}`
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
  public async exchangeAuthorizationCode(
    code: string,
    shopId: string
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    shopId: string;
    merchantId?: string;
  }> {
    const creds = platformConfigService.getInternalCredentials('SHOPEE');
    const isMock = (code.startsWith('mock_') || code.startsWith('sim_') || !platformConfigService.isConfigured('SHOPEE')) && this.fetchFn === globalThis.fetch;

    if (isMock) {
      // Deterministic simulation
      return {
        accessToken: `sp_act_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        refreshToken: `sp_rft_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        expiresIn: 14400, // 4 hours in Shopee v2
        shopId: shopId || 'SHOPEE_SHOP_29104',
        merchantId: 'MERCHANT_ID_7781'
      };
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const partnerId = creds?.partnerId || '';
    const partnerKey = creds?.partnerKey || '';
    const sign = this.generatePartnerSignature(partnerId, partnerKey, this.tokenGetPath, timestamp);

    const url = new URL(`${this.baseUrl}${this.tokenGetPath}`);
    url.searchParams.set('partner_id', partnerId);
    url.searchParams.set('timestamp', timestamp.toString());
    url.searchParams.set('sign', sign);

    const body = {
      code,
      partner_id: parseInt(partnerId, 10) || partnerId,
      shop_id: parseInt(shopId, 10) || shopId
    };

    const res = await this.fetchFn(url.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      throw new Error(`HTTP_${res.status}: Failed to reach Shopee token service`);
    }

    const data: ShopeeTokenResponse = await res.json();
    if (data.error && data.error !== '') {
      throw new Error(data.message || data.error);
    }

    if (!data.response) {
      throw new Error('Shopee response payload empty');
    }

    return {
      accessToken: data.response.access_token,
      refreshToken: data.response.refresh_token,
      expiresIn: data.response.expire_in || 14400,
      shopId: String(data.response.shop_id || shopId),
      merchantId: data.response.merchant_id ? String(data.response.merchant_id) : undefined
    };
  }

  /**
   * Refreshes access token using Shopee Open Platform refresh endpoint.
   * Implements Concurrent Refresh Lock.
   */
  public async refreshAccessToken(shopId?: string): Promise<{ success: boolean; error?: string }> {
    if (this.activeRefreshPromise) {
      return this.activeRefreshPromise;
    }

    this.activeRefreshPromise = this.executeTokenRefresh(shopId)
      .finally(() => {
        this.activeRefreshPromise = null;
      });

    return this.activeRefreshPromise;
  }

  private async executeTokenRefresh(customShopId?: string): Promise<{ success: boolean; error?: string }> {
    await platformConnectionRepository.updateStatus('SHOPEE', 'REFRESHING');

    const creds = platformConfigService.getInternalCredentials('SHOPEE');
    const stored = await platformConnectionRepository.getDecryptedTokens('SHOPEE');
    const conn = await platformConnectionRepository.getByPlatform('SHOPEE');
    const refreshToken = stored.refreshToken;
    const shopId = customShopId || conn?.external_shop_id || 'SHOPEE_SHOP_29104';

    if (!refreshToken) {
      await platformConnectionRepository.updateStatus('SHOPEE', 'REQUIRES_REAUTH', 'Missing refresh token');
      db.logAudit(
        'PLATFORM_TOKEN_REFRESH_FAILED',
        'SYSTEM',
        'Shopee token refresh aborted: No refresh token available'
      );
      return { success: false, error: 'NO_REFRESH_TOKEN' };
    }

    const isMock = (refreshToken.startsWith('sim_') || !platformConfigService.isConfigured('SHOPEE')) && this.fetchFn === globalThis.fetch;

    if (isMock) {
      const newAccess = `sp_act_refreshed_${Date.now()}`;
      const newRefresh = `sp_rft_refreshed_${Date.now()}`;

      await platformConnectionRepository.updateTokens('SHOPEE', newAccess, newRefresh, 14400);
      await platformConnectionRepository.updateStatus('SHOPEE', 'CONNECTED');

      db.logAudit('PLATFORM_TOKEN_REFRESHED', 'SYSTEM', 'Shopee token refreshed successfully (simulated)');
      return { success: true };
    }

    try {
      const timestamp = Math.floor(Date.now() / 1000);
      const partnerId = creds?.partnerId || '';
      const partnerKey = creds?.partnerKey || '';
      const sign = this.generatePartnerSignature(partnerId, partnerKey, this.tokenRefreshPath, timestamp);

      const url = new URL(`${this.baseUrl}${this.tokenRefreshPath}`);
      url.searchParams.set('partner_id', partnerId);
      url.searchParams.set('timestamp', timestamp.toString());
      url.searchParams.set('sign', sign);

      const body = {
        refresh_token: refreshToken,
        partner_id: parseInt(partnerId, 10) || partnerId,
        shop_id: parseInt(shopId, 10) || shopId
      };

      const res = await this.fetchFn(url.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        throw new Error(`HTTP_${res.status}: Refresh request failed`);
      }

      const data: ShopeeTokenResponse = await res.json();
      if (data.error && data.error !== '') {
        throw new Error(data.message || data.error);
      }

      if (!data.response) {
        throw new Error('Shopee refresh response empty');
      }

      const newAccess = data.response.access_token;
      const newRefresh = data.response.refresh_token;
      const expiresIn = data.response.expire_in || 14400;

      await platformConnectionRepository.updateTokens('SHOPEE', newAccess, newRefresh, expiresIn);
      await platformConnectionRepository.updateStatus('SHOPEE', 'CONNECTED');

      db.logAudit('PLATFORM_TOKEN_REFRESHED', 'SYSTEM', 'Shopee token refreshed successfully');
      return { success: true };
    } catch (err: any) {
      await platformConnectionRepository.updateStatus('SHOPEE', 'REQUIRES_REAUTH', err.message);
      db.logAudit(
        'PLATFORM_TOKEN_REFRESH_FAILED',
        'SYSTEM',
        `Shopee token refresh failed: ${err.message}`
      );
      return { success: false, error: err.message };
    }
  }

  /**
   * Revokes credentials and marks connection as DISCONNECTED.
   */
  public async revokeConnection(): Promise<boolean> {
    await platformConnectionRepository.revoke('SHOPEE');
    db.logAudit('PLATFORM_DISCONNECTED', 'OPERATOR', 'Shopee connection revoked');
    return true;
  }

  /**
   * Verifies connection health, token validity, and capabilities.
   */
  public async verifyConnection(): Promise<{
    healthy: boolean;
    status: string;
    details: string;
    capabilities: Record<string, PlatformCapabilityStatus>;
  }> {
    const conn = await platformConnectionRepository.getByPlatform('SHOPEE');
    const isConfigured = platformConfigService.isConfigured('SHOPEE');

    if (!isConfigured) {
      await platformConnectionRepository.updateStatus('SHOPEE', 'NOT_CONFIGURED');
      return {
        healthy: false,
        status: 'NOT_CONFIGURED',
        details: 'Shopee Open Platform partner credentials not configured',
        capabilities: this.getCapabilities([])
      };
    }

    const tokens = await platformConnectionRepository.getDecryptedTokens('SHOPEE');
    if (!tokens.accessToken) {
      await platformConnectionRepository.updateStatus('SHOPEE', 'AUTHORIZATION_REQUIRED');
      return {
        healthy: false,
        status: 'AUTHORIZATION_REQUIRED',
        details: 'No access token available. Authorization required.',
        capabilities: this.getCapabilities([])
      };
    }

    // Check expiration
    if (conn?.access_token_expires_at && new Date(conn.access_token_expires_at).getTime() < Date.now()) {
      await platformConnectionRepository.updateStatus('SHOPEE', 'TOKEN_EXPIRING');
      const refreshResult = await this.refreshAccessToken();
      if (!refreshResult.success) {
        return {
          healthy: false,
          status: 'REQUIRES_REAUTH',
          details: 'Shopee token expired and refresh failed. Re-authorization required.',
          capabilities: this.getCapabilities([])
        };
      }
    }

    const caps = this.getCapabilities(conn?.scopes || []);
    await platformConnectionRepository.updateVerification('SHOPEE', new Date().toISOString(), caps);

    db.logAudit('PLATFORM_VERIFICATION_SUCCEEDED', 'SYSTEM', 'Shopee connection verified');
    return {
      healthy: true,
      status: 'CONNECTED',
      details: 'Shopee connection verified and active',
      capabilities: caps
    };
  }

  /**
   * Maps permissions/scopes to explicit Shopee capabilities.
   * In Shopee Open Platform:
   * Chat reply is strictly UNSUPPORTED (or REQUIRES_APPROVAL).
   * Live control is strictly UNSUPPORTED.
   */
  public getCapabilities(scopes: string[] = []): Record<string, PlatformCapabilityStatus> {
    const hasScopes = scopes.length > 0;
    return {
      PRODUCT_READ: hasScopes ? 'SUPPORTED' : 'REQUIRES_APPROVAL',
      PRODUCT_WRITE: hasScopes ? 'SUPPORTED' : 'REQUIRES_APPROVAL',
      INVENTORY_READ: hasScopes ? 'SUPPORTED' : 'REQUIRES_APPROVAL',
      INVENTORY_WRITE: hasScopes ? 'SUPPORTED' : 'REQUIRES_APPROVAL',
      ORDER_READ: hasScopes ? 'SUPPORTED' : 'REQUIRES_APPROVAL',
      ORDER_WRITE: 'REQUIRES_APPROVAL',
      PROMOTION_READ: hasScopes ? 'SUPPORTED' : 'REQUIRES_APPROVAL',
      PROMOTION_WRITE: 'REQUIRES_APPROVAL',
      CHAT_READ: hasScopes ? 'SUPPORTED' : 'REQUIRES_APPROVAL',
      CHAT_WRITE: 'UNSUPPORTED', // Non-negotiable Shopee restriction
      LIVE_READ: 'REQUIRES_APPROVAL',
      LIVE_CREATE: 'UNSUPPORTED',
      LIVE_CONTROL: 'UNSUPPORTED', // Non-negotiable Shopee restriction
      WEBHOOKS: 'SUPPORTED',
      AFFILIATE: 'NOT_CONFIGURED',
      OTHER: 'SUPPORTED'
    };
  }
}

export const shopeeAuthProvider = ShopeeAuthProvider.getInstance();
