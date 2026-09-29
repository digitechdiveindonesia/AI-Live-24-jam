import {
  PlatformType,
  SafePlatformConnection,
  PlatformConnectionStatus
} from './PlatformTypes';
import { platformConfigService } from './PlatformConfigService';
import { tiktokTokenService } from './TikTokTokenService';
import { platformAuthProvider } from './PlatformAuthProvider';
import { connectionVerificationService } from './ConnectionVerificationService';
import { db } from '../../db';

export class PlatformConnectionService {
  private static instance: PlatformConnectionService;

  // Safe connection states stored strictly without tokens or secrets
  private connections: Map<PlatformType, SafePlatformConnection> = new Map();

  private constructor() {
    this.initDefaultConnections();
  }

  public static getInstance(): PlatformConnectionService {
    if (!PlatformConnectionService.instance) {
      PlatformConnectionService.instance = new PlatformConnectionService();
    }
    return PlatformConnectionService.instance;
  }

  private initDefaultConnections(): void {
    const now = new Date().toISOString();
    const env = platformConfigService.getEnvironment();

    // In demo sandbox mode by default, clearly marked isSimulated: true
    this.connections.set('TIKTOK', {
      platform: 'TIKTOK',
      connectionStatus: 'CONNECTED',
      accountReference: 'sari_glow_official_tt',
      shopReference: 'ID_TIKTOK_SHOP_88921',
      region: 'ID',
      environment: env,
      connectedAt: now,
      lastHealthCheck: now,
      lastError: null,
      isSimulated: true
    });

    this.connections.set('SHOPEE', {
      platform: 'SHOPEE',
      connectionStatus: 'CONNECTED',
      accountReference: 'sari_glow_shopee_mall',
      shopReference: 'SHOPEE_SHOP_29104',
      region: 'ID',
      environment: env,
      connectedAt: now,
      lastHealthCheck: now,
      lastError: null,
      isSimulated: true
    });
  }

  /**
   * Retrieves safe connection information for a platform.
   * NEVER returns client secrets or access tokens.
   */
  public getStatus(platform: PlatformType): SafePlatformConnection {
    let conn = this.connections.get(platform);
    if (!conn) {
      conn = {
        platform,
        connectionStatus: 'NOT_CONFIGURED',
        accountReference: null,
        shopReference: null,
        region: null,
        environment: platformConfigService.getEnvironment(),
        connectedAt: null,
        lastHealthCheck: null,
        lastError: null,
        isSimulated: false,
        missingConfig: platformConfigService.getMissingFields(platform)
      };
      this.connections.set(platform, conn);
    }

    // Refresh dynamic missing config
    conn.missingConfig = platformConfigService.getMissingFields(platform);
    return { ...conn };
  }

  public getAllStatuses(): SafePlatformConnection[] {
    return [this.getStatus('TIKTOK'), this.getStatus('SHOPEE')];
  }

  /**
   * Initiates connection or OAuth authorization.
   */
  public async connect(platform: PlatformType, isDemo: boolean = false): Promise<SafePlatformConnection> {
    const missing = platformConfigService.getMissingFields(platform);
    const now = new Date().toISOString();

    db.logAudit('CONNECT_STARTED', 'OPERATOR', `Initiating connection to ${platform} (Demo: ${isDemo})`);

    // If real configuration is missing and not demo mode
    if (missing.length > 0 && !isDemo) {
      const conn: SafePlatformConnection = {
        platform,
        connectionStatus: 'NOT_CONFIGURED',
        accountReference: null,
        shopReference: null,
        region: null,
        environment: platformConfigService.getEnvironment(),
        connectedAt: null,
        lastHealthCheck: now,
        lastError: `Missing configuration: ${missing.join(', ')}`,
        isSimulated: false,
        missingConfig: missing
      };
      this.connections.set(platform, conn);
      db.logAudit('CONNECT_FAILED', 'SYSTEM', `Connection failed for ${platform}: Missing env config`);
      return conn;
    }

    // Perform connection verification
    const verification = await connectionVerificationService.verifyConnection(platform, isDemo);

    if (verification.result === 'PASS' || isDemo) {
      const accountRef =
        platform === 'TIKTOK'
          ? tiktokTokenService.getTokenMetadata().accountId || 'sari_glow_official_tt'
          : 'sari_glow_shopee_mall';
      const shopRef =
        platform === 'TIKTOK'
          ? tiktokTokenService.getTokenMetadata().shopId || 'ID_TIKTOK_SHOP_88921'
          : 'SHOPEE_SHOP_29104';

      const conn: SafePlatformConnection = {
        platform,
        connectionStatus: 'CONNECTED',
        accountReference: accountRef,
        shopReference: shopRef,
        region: 'ID',
        environment: platformConfigService.getEnvironment(),
        connectedAt: now,
        lastHealthCheck: now,
        lastError: null,
        isSimulated: isDemo
      };
      this.connections.set(platform, conn);
      db.logAudit('CONNECT_SUCCESS', 'SYSTEM', `Platform ${platform} connected successfully [${isDemo ? 'DEMO' : 'REAL'}]`);
      return conn;
    } else {
      const conn: SafePlatformConnection = {
        platform,
        connectionStatus: 'ERROR',
        accountReference: null,
        shopReference: null,
        region: null,
        environment: platformConfigService.getEnvironment(),
        connectedAt: null,
        lastHealthCheck: now,
        lastError: verification.error || 'Connection verification failed',
        isSimulated: isDemo
      };
      this.connections.set(platform, conn);
      db.logAudit('CONNECT_FAILED', 'SYSTEM', `Platform ${platform} verification failed: ${verification.error}`);
      return conn;
    }
  }

  /**
   * Disconnects platform, invalidates tokens, preserves internal catalog.
   */
  public async disconnect(platform: PlatformType): Promise<SafePlatformConnection> {
    const now = new Date().toISOString();

    if (platform === 'TIKTOK') {
      tiktokTokenService.invalidateToken('Platform disconnected by operator');
    } else if (platform === 'SHOPEE') {
      await platformAuthProvider.revokeCredentials('SHOPEE');
    }

    const conn: SafePlatformConnection = {
      platform,
      connectionStatus: 'DISCONNECTED',
      accountReference: null,
      shopReference: null,
      region: null,
      environment: platformConfigService.getEnvironment(),
      connectedAt: null,
      lastHealthCheck: now,
      lastError: null,
      isSimulated: false,
      missingConfig: platformConfigService.getMissingFields(platform)
    };
    this.connections.set(platform, conn);

    db.logAudit(
      'PLATFORM_DISCONNECTED',
      'OPERATOR',
      `Disconnected ${platform}. Token invalidated. Internal catalog preserved intact.`
    );

    return conn;
  }

  /**
   * Refreshes credentials and connection status.
   */
  public async refresh(platform: PlatformType): Promise<SafePlatformConnection> {
    const now = new Date().toISOString();
    let success = false;

    if (platform === 'TIKTOK') {
      success = await tiktokTokenService.refreshAccessToken();
    } else if (platform === 'SHOPEE') {
      success = await platformAuthProvider.refreshCredentials('SHOPEE');
    }

    const current = this.getStatus(platform);
    if (success) {
      current.connectionStatus = 'CONNECTED';
      current.lastHealthCheck = now;
      current.lastError = null;
      db.logAudit('TOKEN_REFRESHED', 'SYSTEM', `Refreshed connection for ${platform}`);
    } else {
      current.connectionStatus = 'ERROR';
      current.lastHealthCheck = now;
      current.lastError = 'Token refresh failed or token revoked';
      db.logAudit('PLATFORM_HEALTH_CHANGED', 'SYSTEM', `${platform} switched to ERROR due to refresh failure`);
    }

    this.connections.set(platform, current);
    return current;
  }

  /**
   * Health check for platform. Isolated so failure does not cascade to other platforms or core.
   */
  public async healthCheck(platform: PlatformType): Promise<{
    healthy: boolean;
    connection: SafePlatformConnection;
    latency: string;
    telemetry: any;
  }> {
    const current = this.getStatus(platform);
    const verification = await connectionVerificationService.verifyConnection(platform, current.isSimulated);
    const telem = connectionVerificationService.getTelemetry(platform);
    const now = new Date().toISOString();

    current.lastHealthCheck = now;
    if (verification.result === 'PASS') {
      current.connectionStatus = 'CONNECTED';
      current.lastError = null;
    } else if (verification.result === 'NOT_CONFIGURED') {
      current.connectionStatus = 'NOT_CONFIGURED';
      current.lastError = verification.error || null;
    } else {
      current.connectionStatus = 'ERROR';
      current.lastError = verification.error || 'Health check verification failed';
    }

    this.connections.set(platform, current);

    return {
      healthy: current.connectionStatus === 'CONNECTED',
      connection: current,
      latency: telem.latencyDisplay,
      telemetry: telem
    };
  }

  /**
   * Safe mode: switches a failing platform to DEGRADED without crashing Core AI session.
   */
  public setDegradedMode(platform: PlatformType, errorReason: string): void {
    const current = this.getStatus(platform);
    current.connectionStatus = 'ERROR';
    current.lastError = errorReason;
    this.connections.set(platform, current);

    db.logAudit(
      'PLATFORM_HEALTH_CHANGED',
      'SYSTEM',
      `Platform ${platform} switched to SAFE MODE / DEGRADED: ${errorReason}`
    );
  }
}

export const platformConnectionService = PlatformConnectionService.getInstance();
