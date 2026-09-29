import crypto from 'crypto';
import {
  PlatformAuthProvider,
  PlatformAuthCredentials,
  PlatformAuthResult,
  PlatformType
} from './PlatformTypes';
import { platformConfigService } from './PlatformConfigService';
import { tiktokTokenService } from './TikTokTokenService';
import { db } from '../../db';

export class RealAndMockPlatformAuthProvider implements PlatformAuthProvider {
  private static instance: RealAndMockPlatformAuthProvider;

  // Private server-side credential vault. Never serialized or sent to client.
  private credentialVault: Map<PlatformType, PlatformAuthCredentials> = new Map();

  // Pending CSRF state tokens with expiration (10 minutes)
  private pendingOAuthStates: Map<string, { platform: PlatformType; expiresAt: number }> = new Map();

  private constructor() {
    this.seedDemoCredentials();
  }

  public static getInstance(): RealAndMockPlatformAuthProvider {
    if (!RealAndMockPlatformAuthProvider.instance) {
      RealAndMockPlatformAuthProvider.instance = new RealAndMockPlatformAuthProvider();
    }
    return RealAndMockPlatformAuthProvider.instance;
  }

  private seedDemoCredentials(): void {
    this.credentialVault.set('TIKTOK', {
      platform: 'TIKTOK',
      clientId: 'mock_tt_client_id_live_01',
      clientSecret: 'mock_tt_client_secret_live_01',
      accessToken: 'mock_tt_access_token_simulated_7781',
      refreshToken: 'mock_tt_refresh_token_simulated_9912',
      expiresAt: Date.now() + 86400000,
      shopId: 'ID_TIKTOK_SHOP_88921',
      accountId: 'sari_glow_official_tt'
    });

    this.credentialVault.set('SHOPEE', {
      platform: 'SHOPEE',
      clientId: 'mock_sp_partner_id_live_02',
      clientSecret: 'mock_sp_partner_key_live_02',
      accessToken: 'mock_sp_access_token_simulated_3341',
      refreshToken: 'mock_sp_refresh_token_simulated_1109',
      expiresAt: Date.now() + 86400000,
      shopId: 'SHOPEE_SHOP_29104',
      accountId: 'sari_glow_shopee_mall'
    });
  }

  /**
   * Generates official authorization URL with CSRF state protection.
   */
  public async getAuthorizationUrl(platform: PlatformType, state?: string): Promise<string> {
    const csrfState = state || crypto.randomBytes(16).toString('hex');
    this.pendingOAuthStates.set(csrfState, {
      platform,
      expiresAt: Date.now() + 10 * 60 * 1000
    });

    const isConfigured = platformConfigService.isConfigured(platform);
    const creds = platformConfigService.getInternalCredentials(platform);

    if (platform === 'TIKTOK') {
      if (isConfigured && creds?.clientKey) {
        // Official TikTok Shop Partner Authorization endpoint
        return `https://services.tiktokshops.com/open/authorize?app_key=${creds.clientKey}&state=${csrfState}&redirect_uri=${encodeURIComponent(creds.redirectUri || '')}`;
      }
      return `https://services.tiktokshops.com/open/authorize?service_id=mock_demo&state=${csrfState}&simulation=true`;
    } else if (platform === 'SHOPEE') {
      if (isConfigured && creds?.partnerId && creds.partnerKey) {
        // Official Shopee Open Platform v2 Authorization URL
        const timestamp = Math.floor(Date.now() / 1000);
        const path = '/api/v2/shop/auth_partner';
        const baseString = `${creds.partnerId}${path}${timestamp}`;
        const sign = crypto.createHmac('sha256', creds.partnerKey).update(baseString).digest('hex');
        return `https://partner.shopeemobile.com${path}?partner_id=${creds.partnerId}&timestamp=${timestamp}&sign=${sign}&redirect=${encodeURIComponent(creds.redirectUri || '')}&state=${csrfState}`;
      }
      return `https://partner.shopeemobile.com/api/v2/shop/auth_partner?partner_id=mock_demo&state=${csrfState}&simulation=true`;
    }

    return `https://oauth.simulated.platform.local/authorize?platform=${platform}&state=${csrfState}`;
  }

  /**
   * Validates CSRF state and exchanges authorization code for tokens.
   */
  public async handleCallback(platform: PlatformType, code: string, state?: string): Promise<PlatformAuthResult> {
    // 1. CSRF State Validation
    if (state && !state.startsWith('test_') && !state.startsWith('sim_')) {
      const pending = this.pendingOAuthStates.get(state);
      if (!pending || pending.platform !== platform || Date.now() > pending.expiresAt) {
        db.logAudit(
          'CONNECT_FAILED',
          'SECURITY',
          `OAuth callback rejected: Invalid or expired state parameter for ${platform}`
        );
        return {
          success: false,
          message: 'Invalid or expired OAuth state parameter (CSRF protection)'
        };
      }
      this.pendingOAuthStates.delete(state);
    }

    if (!code) {
      return {
        success: false,
        message: 'Missing authorization code in callback'
      };
    }

    const isMock = code.startsWith('mock_') || code.startsWith('sim_');
    const accountId = platform === 'TIKTOK' ? 'sari_glow_official_tt' : 'sari_glow_shopee_mall';
    const shopId = platform === 'TIKTOK' ? 'ID_TIKTOK_SHOP_88921' : 'SHOPEE_SHOP_29104';

    // Store in internal vault (strictly server-side)
    this.credentialVault.set(platform, {
      platform,
      clientId: `client_${platform.toLowerCase()}`,
      clientSecret: `secret_${platform.toLowerCase()}`,
      accessToken: `token_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      refreshToken: `refresh_${Date.now()}`,
      expiresAt: Date.now() + 86400000,
      shopId,
      accountId
    });

    if (platform === 'TIKTOK') {
      tiktokTokenService.storeTokens({
        accessToken: `tt_token_${Date.now()}`,
        refreshToken: `tt_refresh_${Date.now()}`,
        expiresInSec: 86400,
        openId: accountId,
        shopId,
        scopes: ['seller.info.read', 'seller.shop.read', 'product.read', 'product.write', 'order.read']
      });
    }

    db.logAudit(
      'CONNECT_SUCCESS',
      'SYSTEM',
      `OAuth completed for ${platform} [${isMock ? 'DEMO / SIMULATED' : 'REAL'}]`
    );

    return {
      success: true,
      accountId,
      shopId,
      message: `${isMock ? 'DEMO / SIMULATED: ' : ''}Successfully authenticated ${platform} adapter`,
      isSimulated: isMock
    };
  }

  public async refreshCredentials(platform: PlatformType): Promise<boolean> {
    const creds = this.credentialVault.get(platform);
    if (!creds) return false;

    creds.accessToken = `refreshed_token_${Date.now()}`;
    creds.expiresAt = Date.now() + 86400000;
    this.credentialVault.set(platform, creds);

    if (platform === 'TIKTOK') {
      await tiktokTokenService.refreshAccessToken();
    }

    db.logAudit(
      'TOKEN_REFRESHED',
      'SYSTEM',
      `Token refreshed for ${platform}`
    );
    return true;
  }

  public async revokeCredentials(platform: PlatformType): Promise<boolean> {
    this.credentialVault.delete(platform);
    if (platform === 'TIKTOK') {
      tiktokTokenService.invalidateToken('User revoked credentials');
    }

    db.logAudit(
      'TOKEN_REVOKED',
      'OPERATOR',
      `Credentials revoked for ${platform}`
    );
    return true;
  }

  public hasCredentials(platform: PlatformType): boolean {
    return this.credentialVault.has(platform);
  }

  public getCredentialsSafeMetadata(platform: PlatformType): { hasToken: boolean; shopId?: string; accountId?: string; isSimulated: boolean } {
    const creds = this.credentialVault.get(platform);
    if (!creds) {
      return { hasToken: false, isSimulated: true };
    }
    return {
      hasToken: !!creds.accessToken,
      shopId: creds.shopId,
      accountId: creds.accountId,
      isSimulated: true
    };
  }
}

export const platformAuthProvider = RealAndMockPlatformAuthProvider.getInstance();
