import { PlatformType, PlatformConnection, PlatformConnectionStatus, PlatformCapabilityStatus } from '../db/schema';
import { supabaseManager } from '../db/supabaseClient';
import { tokenEncryptionService } from '../services/platform/TokenEncryptionService';
import { db } from '../db';

export class PlatformConnectionRepository {
  private inMemoryConnections: Map<PlatformType, PlatformConnection> = new Map();

  constructor() {
    this.initDefaultConnections();
  }

  private initDefaultConnections(): void {
    const now = new Date().toISOString();
    // TikTok Connection Record
    this.inMemoryConnections.set('TIKTOK', {
      id: 'conn-tiktok-default',
      platform: 'TIKTOK',
      account_type: 'SELLER',
      external_account_id: 'sari_glow_official_tt',
      external_shop_id: 'ID_TIKTOK_SHOP_88921',
      external_merchant_id: null,
      display_name: 'Sari Glow Official TikTok Shop',
      region: 'ID',
      status: 'NOT_CONFIGURED',
      scopes: ['seller.info.read', 'seller.shop.read', 'product.read', 'product.write', 'order.read'],
      capabilities: {},
      access_token_encrypted: null,
      refresh_token_encrypted: null,
      access_token_expires_at: null,
      refresh_token_expires_at: null,
      last_verified_at: null,
      last_error: null,
      created_at: now,
      updated_at: now
    });

    // Shopee Connection Record
    this.inMemoryConnections.set('SHOPEE', {
      id: 'conn-shopee-default',
      platform: 'SHOPEE',
      account_type: 'SELLER',
      external_account_id: 'sari_glow_shopee_mall',
      external_shop_id: 'SHOPEE_SHOP_29104',
      external_merchant_id: 'MERCHANT_ID_7781',
      display_name: 'Sari Glow Shopee Mall Official',
      region: 'ID',
      status: 'NOT_CONFIGURED',
      scopes: ['product', 'inventory', 'order'],
      capabilities: {},
      access_token_encrypted: null,
      refresh_token_encrypted: null,
      access_token_expires_at: null,
      refresh_token_expires_at: null,
      last_verified_at: null,
      last_error: null,
      created_at: now,
      updated_at: now
    });
  }

  public async getByPlatform(platform: PlatformType): Promise<PlatformConnection | null> {
    const client = supabaseManager.getClient();
    if (client) {
      const { data, error } = await client
        .from('platform_connections')
        .select('*')
        .eq('platform', platform)
        .maybeSingle();

      if (!error && data) {
        return data as PlatformConnection;
      }
    }
    return this.inMemoryConnections.get(platform) || null;
  }

  public async getAll(): Promise<PlatformConnection[]> {
    const client = supabaseManager.getClient();
    if (client) {
      const { data, error } = await client
        .from('platform_connections')
        .select('*');

      if (!error && data && data.length > 0) {
        return data as PlatformConnection[];
      }
    }
    return Array.from(this.inMemoryConnections.values());
  }

  public async upsert(
    connectionData: Partial<PlatformConnection> & { platform: PlatformType }
  ): Promise<PlatformConnection> {
    const now = new Date().toISOString();
    const existing = await this.getByPlatform(connectionData.platform);

    const merged: PlatformConnection = {
      id: existing?.id || `conn-${connectionData.platform.toLowerCase()}-${Date.now()}`,
      platform: connectionData.platform,
      account_type: connectionData.account_type || existing?.account_type || 'SELLER',
      external_account_id: connectionData.external_account_id ?? existing?.external_account_id ?? null,
      external_shop_id: connectionData.external_shop_id ?? existing?.external_shop_id ?? null,
      external_merchant_id: connectionData.external_merchant_id ?? existing?.external_merchant_id ?? null,
      display_name: connectionData.display_name ?? existing?.display_name ?? null,
      region: connectionData.region || existing?.region || 'ID',
      status: connectionData.status || existing?.status || 'NOT_CONFIGURED',
      scopes: connectionData.scopes || existing?.scopes || [],
      capabilities: connectionData.capabilities || existing?.capabilities || {},
      access_token_encrypted: connectionData.access_token_encrypted ?? existing?.access_token_encrypted ?? null,
      refresh_token_encrypted: connectionData.refresh_token_encrypted ?? existing?.refresh_token_encrypted ?? null,
      access_token_expires_at: connectionData.access_token_expires_at ?? existing?.access_token_expires_at ?? null,
      refresh_token_expires_at: connectionData.refresh_token_expires_at ?? existing?.refresh_token_expires_at ?? null,
      last_verified_at: connectionData.last_verified_at ?? existing?.last_verified_at ?? null,
      last_error: connectionData.last_error ?? existing?.last_error ?? null,
      created_at: existing?.created_at || now,
      updated_at: now
    };

    const client = supabaseManager.getClient();
    if (client) {
      await client
        .from('platform_connections')
        .upsert(merged, { onConflict: 'platform' });
    }

    this.inMemoryConnections.set(connectionData.platform, merged);
    return merged;
  }

  public async updateTokens(
    platform: PlatformType,
    accessToken: string,
    refreshToken?: string,
    accessExpiresInSec: number = 86400,
    refreshExpiresInSec: number = 2592000 // 30 days
  ): Promise<PlatformConnection> {
    const now = Date.now();
    const accessExpiresAt = new Date(now + accessExpiresInSec * 1000).toISOString();
    const refreshExpiresAt = new Date(now + refreshExpiresInSec * 1000).toISOString();

    const encryptedAccess = tokenEncryptionService.encryptToken(accessToken);
    const encryptedRefresh = refreshToken ? tokenEncryptionService.encryptToken(refreshToken) : null;

    return this.upsert({
      platform,
      access_token_encrypted: encryptedAccess,
      refresh_token_encrypted: encryptedRefresh,
      access_token_expires_at: accessExpiresAt,
      refresh_token_expires_at: refreshExpiresAt,
      status: 'CONNECTED',
      last_error: null
    });
  }

  public async updateStatus(
    platform: PlatformType,
    status: PlatformConnectionStatus,
    lastError?: string | null
  ): Promise<PlatformConnection> {
    return this.upsert({
      platform,
      status,
      last_error: lastError ?? null
    });
  }

  public async updateVerification(
    platform: PlatformType,
    verifiedAt: string,
    capabilities: Record<string, PlatformCapabilityStatus>
  ): Promise<PlatformConnection> {
    return this.upsert({
      platform,
      last_verified_at: verifiedAt,
      capabilities,
      status: 'CONNECTED',
      last_error: null
    });
  }

  public async getDecryptedTokens(
    platform: PlatformType
  ): Promise<{ accessToken: string | null; refreshToken: string | null; expiresAt?: string | null }> {
    const conn = await this.getByPlatform(platform);
    if (!conn) {
      return { accessToken: null, refreshToken: null, expiresAt: null };
    }

    const accessToken = conn.access_token_encrypted
      ? tokenEncryptionService.decryptToken(conn.access_token_encrypted)
      : null;

    const refreshToken = conn.refresh_token_encrypted
      ? tokenEncryptionService.decryptToken(conn.refresh_token_encrypted)
      : null;

    return {
      accessToken,
      refreshToken,
      expiresAt: conn.access_token_expires_at
    };
  }

  public async revoke(platform: PlatformType): Promise<boolean> {
    await this.upsert({
      platform,
      status: 'DISCONNECTED',
      access_token_encrypted: null,
      refresh_token_encrypted: null,
      access_token_expires_at: null,
      refresh_token_expires_at: null,
      last_error: null
    });
    return true;
  }
}

export const platformConnectionRepository = new PlatformConnectionRepository();
