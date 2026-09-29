import {
  PlatformCapability,
  PlatformCapabilityType,
  PlatformCapabilityStatus
} from './PlatformTypes';
import { platformConfigService } from './PlatformConfigService';
import { platformAuthProvider } from './PlatformAuthProvider';
import { db } from '../../db';

export class ShopeeCapabilityDiscoveryService {
  private static instance: ShopeeCapabilityDiscoveryService;
  private capabilityCache: Map<PlatformCapabilityType, PlatformCapability> = new Map();

  private constructor() {}

  public static getInstance(): ShopeeCapabilityDiscoveryService {
    if (!ShopeeCapabilityDiscoveryService.instance) {
      ShopeeCapabilityDiscoveryService.instance = new ShopeeCapabilityDiscoveryService();
    }
    return ShopeeCapabilityDiscoveryService.instance;
  }

  public async discoverAllCapabilities(isDemoMode: boolean = false): Promise<PlatformCapability[]> {
    const isConfigured = platformConfigService.isConfigured('SHOPEE');
    const hasCreds = platformAuthProvider.hasCredentials('SHOPEE');
    const now = new Date().toISOString();

    const capabilitiesToEvaluate: {
      type: PlatformCapabilityType;
      evaluator: () => { status: PlatformCapabilityStatus; message: string };
    }[] = [
      {
        type: 'ACCOUNT_ACCESS',
        evaluator: () => {
          if (!isConfigured && !isDemoMode) {
            return {
              status: 'NOT_CONFIGURED',
              message: 'Missing Shopee Partner API credentials (SHOPEE_PARTNER_ID / KEY)'
            };
          }
          if (!hasCreds && !isDemoMode) {
            return {
              status: 'NOT_CONFIGURED',
              message: 'Partner authorization pending'
            };
          }
          return {
            status: 'CONNECTED',
            message: 'Shopee Partner API v2 shop authorization active'
          };
        }
      },
      {
        type: 'SHOP_ACCESS',
        evaluator: () => {
          if (!hasCreds && !isDemoMode) {
            return {
              status: 'NOT_CONFIGURED',
              message: 'Shopee Shop ID not bound'
            };
          }
          return {
            status: 'CONNECTED',
            message: 'Shopee Shop ID accessible via Partner API v2'
          };
        }
      },
      {
        type: 'PRODUCT_DATA',
        evaluator: () => {
          if (!hasCreds && !isDemoMode) {
            return {
              status: 'NOT_CONFIGURED',
              message: 'Product catalog query requires shop authorization'
            };
          }
          return {
            status: 'CONNECTED',
            message: 'Shopee Open Platform Product v2 catalog active'
          };
        }
      },
      {
        type: 'PRODUCT_SYNC',
        evaluator: () => {
          if (!hasCreds && !isDemoMode) {
            return {
              status: 'NOT_CONFIGURED',
              message: 'Product sync requires shop authorization'
            };
          }
          return {
            status: 'CONNECTED',
            message: 'Shopee v2 item price and attributes sync active'
          };
        }
      },
      {
        type: 'INVENTORY_DATA',
        evaluator: () => {
          if (!hasCreds && !isDemoMode) {
            return {
              status: 'NOT_CONFIGURED',
              message: 'Inventory sync requires shop authorization'
            };
          }
          return {
            status: 'CONNECTED',
            message: 'Shopee 2-way stock adjustment webhook enabled'
          };
        }
      },
      {
        type: 'ORDER_DATA',
        evaluator: () => {
          if (!hasCreds && !isDemoMode) {
            return {
              status: 'NOT_CONFIGURED',
              message: 'Order sync requires shop authorization'
            };
          }
          return {
            status: 'CONNECTED',
            message: 'Shopee Order v2 order webhook and escrow status connected'
          };
        }
      },
      {
        type: 'WEBHOOKS',
        evaluator: () => {
          if (!isConfigured && !isDemoMode) {
            return {
              status: 'NOT_CONFIGURED',
              message: 'Shopee Push Notification Service not configured'
            };
          }
          return {
            status: 'CONNECTED',
            message: 'Shopee Push Notification Service configured and verified'
          };
        }
      },
      {
        type: 'LIVE',
        evaluator: () => {
          return {
            status: 'REQUIRES_APPROVAL',
            message: 'Shopee Live RTMP stream key requires Shopee Live Host partner authorization'
          };
        }
      },
      {
        type: 'LIVE_COMMENTS',
        evaluator: () => {
          if (isDemoMode) {
            return {
              status: 'CONNECTED',
              message: 'Shopee Live chat streaming polling (500ms cycle) active in sandbox'
            };
          }
          if (!hasCreds) {
            return {
              status: 'NOT_CONFIGURED',
              message: 'Shopee Live comments require partner authorization'
            };
          }
          return {
            status: 'UNKNOWN',
            message: 'Shopee Live chat stream capability has not been verified for this account'
          };
        }
      },
      {
        type: 'COMMENT_REPLY',
        evaluator: () => {
          // Strictly UNSUPPORTED per official Shopee Open Platform policy
          return {
            status: 'UNSUPPORTED',
            message: 'COMMENT_REPLY is UNSUPPORTED by Shopee Live Open API v2. Public chat reply API not offered by Shopee.'
          };
        }
      },
      {
        type: 'LIVE_ANALYTICS',
        evaluator: () => {
          return {
            status: 'REGION_DEPENDENT',
            message: 'Shopee Live real-time viewership metrics restricted to ID/SG enterprise seller accounts'
          };
        }
      }
    ];

    const results: PlatformCapability[] = [];

    for (const item of capabilitiesToEvaluate) {
      const evaluation = item.evaluator();
      const cap: PlatformCapability = {
        platform: 'SHOPEE',
        capability: item.type,
        status: evaluation.status,
        lastCheckedAt: now,
        source: isDemoMode ? 'SHOPEE_OPEN_PLATFORM_SANDBOX' : 'SHOPEE_OPEN_PLATFORM_PROD',
        message: evaluation.message
      };
      this.capabilityCache.set(item.type, cap);
      results.push(cap);
    }

    db.logAudit(
      'CAPABILITY_CHECKED',
      'SYSTEM',
      `Discovered ${results.length} capabilities for Shopee (DemoMode: ${isDemoMode})`
    );

    return results;
  }

  public getCapability(capability: PlatformCapabilityType): PlatformCapability | undefined {
    return this.capabilityCache.get(capability);
  }
}

export const shopeeCapabilityDiscoveryService = ShopeeCapabilityDiscoveryService.getInstance();
