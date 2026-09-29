import {
  PlatformAdapter,
  PlatformCapability,
  PlatformConnection,
  PlatformHealthResult,
  PlatformType
} from './PlatformTypes';
import { TikTokPlatformAdapter } from './TikTokPlatformAdapter';
import { ShopeePlatformAdapter } from './ShopeePlatformAdapter';
import { db } from '../../db';

export class PlatformManager {
  private static instance: PlatformManager;
  private adapters: Map<PlatformType, PlatformAdapter> = new Map();

  private constructor() {
    this.registerAdapter(new TikTokPlatformAdapter());
    this.registerAdapter(new ShopeePlatformAdapter());
  }

  public static getInstance(): PlatformManager {
    if (!PlatformManager.instance) {
      PlatformManager.instance = new PlatformManager();
    }
    return PlatformManager.instance;
  }

  public registerAdapter(adapter: PlatformAdapter): void {
    this.adapters.set(adapter.platform, adapter);
  }

  public getAdapter(platform: PlatformType): PlatformAdapter | undefined {
    return this.adapters.get(platform);
  }

  public getAllAdapters(): PlatformAdapter[] {
    return Array.from(this.adapters.values());
  }

  public getAllConnections(): PlatformConnection[] {
    return Array.from(this.adapters.values()).map(a => a.getConnection());
  }

  public getAllCapabilities(): Record<PlatformType, PlatformCapability[]> {
    const result: Record<string, PlatformCapability[]> = {};
    for (const [platform, adapter] of this.adapters.entries()) {
      result[platform] = adapter.getCapabilities();
    }
    return result as Record<PlatformType, PlatformCapability[]>;
  }

  public async initializeAll(): Promise<void> {
    for (const adapter of this.adapters.values()) {
      await adapter.initialize();
    }
    db.logAudit('PLATFORM_MANAGER', 'SYSTEM', 'All platform adapters initialized');
  }

  public async healthCheckAll(): Promise<Record<PlatformType, PlatformHealthResult>> {
    const results: Record<string, PlatformHealthResult> = {};
    for (const [platform, adapter] of this.adapters.entries()) {
      results[platform] = await adapter.healthCheck();
    }
    return results as Record<PlatformType, PlatformHealthResult>;
  }
}

export const platformManager = PlatformManager.getInstance();
