import { PlatformType, PlatformConfig } from './PlatformTypes';

export interface InternalPlatformCredentials {
  platform: PlatformType;
  clientKey?: string;
  clientSecret?: string;
  redirectUri?: string;
  partnerId?: string;
  partnerKey?: string;
  environment: 'DEVELOPMENT' | 'STAGING' | 'PRODUCTION';
}

export class PlatformConfigService {
  private static instance: PlatformConfigService;

  // In-memory test/runtime override store for configuration
  private configOverrides: Map<string, string> = new Map();

  private constructor() {}

  public static getInstance(): PlatformConfigService {
    if (!PlatformConfigService.instance) {
      PlatformConfigService.instance = new PlatformConfigService();
    }
    return PlatformConfigService.instance;
  }

  public getEnvironment(): 'DEVELOPMENT' | 'STAGING' | 'PRODUCTION' {
    const env = (process.env.PLATFORM_ENV || process.env.NODE_ENV || 'DEVELOPMENT').toUpperCase();
    if (env.includes('PROD')) return 'PRODUCTION';
    if (env.includes('STAG')) return 'STAGING';
    return 'DEVELOPMENT';
  }

  private getEnvValue(key: string): string | undefined {
    return this.configOverrides.get(key) || process.env[key];
  }

  public isConfigured(platform: PlatformType): boolean {
    return this.getMissingFields(platform).length === 0;
  }

  public getMissingFields(platform: PlatformType): string[] {
    const missing: string[] = [];
    if (platform === 'TIKTOK') {
      if (!this.getEnvValue('TIKTOK_CLIENT_KEY')) missing.push('TIKTOK_CLIENT_KEY');
      if (!this.getEnvValue('TIKTOK_CLIENT_SECRET')) missing.push('TIKTOK_CLIENT_SECRET');
    } else if (platform === 'SHOPEE') {
      if (!this.getEnvValue('SHOPEE_PARTNER_ID')) missing.push('SHOPEE_PARTNER_ID');
      if (!this.getEnvValue('SHOPEE_PARTNER_KEY')) missing.push('SHOPEE_PARTNER_KEY');
    }
    return missing;
  }

  /**
   * Safe public configuration metadata.
   * NEVER returns client secrets or partner keys.
   */
  public getSafeConfig(platform: PlatformType): PlatformConfig {
    const missing = this.getMissingFields(platform);
    const redirectUri =
      platform === 'TIKTOK'
        ? (this.getEnvValue('TIKTOK_REDIRECT_URI') || '/api/platforms/tiktok-shop/callback')
        : (this.getEnvValue('SHOPEE_REDIRECT_URI') || '/api/platforms/shopee/callback');

    return {
      platform,
      environment: this.getEnvironment(),
      configured: missing.length === 0,
      missingFields: missing,
      redirectUri
    };
  }

  public getAllSafeConfigs(): Record<PlatformType, PlatformConfig> {
    return {
      TIKTOK: this.getSafeConfig('TIKTOK'),
      SHOPEE: this.getSafeConfig('SHOPEE'),
      OTHER: this.getSafeConfig('OTHER')
    };
  }

  /**
   * Strictly internal credential accessor.
   * Must never be returned over HTTP or logged.
   */
  public getInternalCredentials(platform: PlatformType): InternalPlatformCredentials | null {
    if (!this.isConfigured(platform)) {
      return null;
    }

    if (platform === 'TIKTOK') {
      return {
        platform: 'TIKTOK',
        clientKey: this.getEnvValue('TIKTOK_CLIENT_KEY'),
        clientSecret: this.getEnvValue('TIKTOK_CLIENT_SECRET'),
        redirectUri: this.getEnvValue('TIKTOK_REDIRECT_URI'),
        environment: this.getEnvironment()
      };
    }

    if (platform === 'SHOPEE') {
      return {
        platform: 'SHOPEE',
        partnerId: this.getEnvValue('SHOPEE_PARTNER_ID'),
        partnerKey: this.getEnvValue('SHOPEE_PARTNER_KEY'),
        redirectUri: this.getEnvValue('SHOPEE_REDIRECT_URI'),
        environment: this.getEnvironment()
      };
    }

    return null;
  }

  /**
   * Sets temporary test/runtime config override (e.g. for testing real auth flows or sandbox).
   */
  public setConfigOverride(key: string, value: string): void {
    this.configOverrides.set(key, value);
  }

  public clearOverrides(): void {
    this.configOverrides.clear();
  }
}

export const platformConfigService = PlatformConfigService.getInstance();
