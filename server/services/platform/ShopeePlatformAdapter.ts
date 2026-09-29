import {
  PlatformAdapter,
  PlatformCapability,
  PlatformCapabilityType,
  PlatformCapabilityStatus,
  PlatformConnection,
  PlatformConnectionStatus,
  PlatformLiveStatus,
  PlatformComment,
  PlatformProduct,
  PlatformInventoryResult,
  PlatformSyncResult,
  PlatformOrder,
  PlatformOperationResult,
  PlatformHealthResult,
  PlatformWebhookResult
} from './PlatformTypes';
import { platformAuthProvider } from './PlatformAuthProvider';
import { db } from '../../db';

export class ShopeePlatformAdapter implements PlatformAdapter {
  public readonly platform = 'SHOPEE' as const;
  public readonly name = 'Shopee Live';

  private connection: PlatformConnection;
  private capabilities: Map<PlatformCapabilityType, PlatformCapability> = new Map();
  private isSimulatedSandbox: boolean = true;
  private streamKeyConfigured: boolean = false;

  constructor() {
    const now = new Date().toISOString();
    this.connection = {
      id: 'conn-sp-002',
      platform: 'SHOPEE',
      status: 'CONNECTED',
      accountId: 'sari_glow_shopee_mall',
      shopId: 'SHOPEE_SHOP_29104',
      region: 'ID',
      environment: 'MOCK',
      connectedAt: now,
      lastHealthCheck: now,
      lastError: null,
      createdAt: now,
      updatedAt: now
    };

    this.discoverCapabilities();
  }

  private discoverCapabilities(): void {
    const now = new Date().toISOString();
    const source = this.isSimulatedSandbox ? 'SHOPEE_OPEN_PLATFORM_SANDBOX' : 'SHOPEE_OPEN_PLATFORM_PROD';

    const defs: { type: PlatformCapabilityType; status: PlatformCapabilityStatus; message: string }[] = [
      {
        type: 'ACCOUNT_ACCESS',
        status: platformAuthProvider.hasCredentials('SHOPEE') ? 'CONNECTED' : 'NOT_CONFIGURED',
        message: 'Shopee Partner API v2 shop authorization active'
      },
      {
        type: 'LIVE_STREAM',
        status: this.streamKeyConfigured ? 'CONNECTED' : 'REQUIRES_APPROVAL',
        message: 'Shopee Live RTMP stream key requires Shopee Live Host partner authorization'
      },
      {
        type: 'LIVE_COMMENTS',
        status: 'CONNECTED',
        message: 'Shopee Live chat streaming polling (500ms cycle) active'
      },
      {
        type: 'COMMENT_REPLY',
        status: 'UNSUPPORTED',
        message: 'COMMENT_REPLY is UNSUPPORTED by Shopee Live Open API v2. Public chat reply API not offered by Shopee.'
      },
      {
        type: 'PRODUCT_CATALOG',
        status: 'CONNECTED',
        message: 'Shopee Open Platform Product v2 catalog active (4 SKUs synced)'
      },
      {
        type: 'PRODUCT_SYNC',
        status: 'CONNECTED',
        message: 'Shopee v2 item price and attributes sync active'
      },
      {
        type: 'INVENTORY_SYNC',
        status: 'CONNECTED',
        message: 'Shopee 2-way stock adjustment webhook enabled'
      },
      {
        type: 'ORDER_DATA',
        status: 'CONNECTED',
        message: 'Shopee Order v2 order webhook and escrow status connected'
      },
      {
        type: 'WEBHOOKS',
        status: 'CONNECTED',
        message: 'Shopee Push Notification Service configured and verified'
      },
      {
        type: 'LIVE_ANALYTICS',
        status: 'REGION_DEPENDENT',
        message: 'Shopee Live real-time viewership metrics restricted to ID/SG enterprise seller accounts'
      }
    ];

    defs.forEach(d => {
      this.capabilities.set(d.type, {
        platform: 'SHOPEE',
        capability: d.type,
        status: d.status,
        lastCheckedAt: now,
        source,
        message: d.message
      });
    });
  }

  public async initialize(): Promise<void> {
    this.discoverCapabilities();
    this.connection.lastHealthCheck = new Date().toISOString();
    db.logAudit('PLATFORM_INIT', 'SYSTEM', 'ShopeePlatformAdapter initialized and capabilities discovered');
  }

  public async connect(): Promise<PlatformConnection> {
    this.connection.status = 'CONNECTING';
    const authResult = await platformAuthProvider.handleCallback('SHOPEE', 'mock_code_shopee');
    this.connection.status = 'CONNECTED';
    this.connection.connectedAt = new Date().toISOString();
    this.connection.lastHealthCheck = new Date().toISOString();
    this.connection.updatedAt = new Date().toISOString();
    this.connection.accountId = authResult.accountId || this.connection.accountId;
    this.connection.shopId = authResult.shopId || this.connection.shopId;
    this.discoverCapabilities();
    return { ...this.connection };
  }

  public async disconnect(): Promise<void> {
    this.connection.status = 'DISCONNECTED';
    this.connection.updatedAt = new Date().toISOString();
    await platformAuthProvider.revokeCredentials('SHOPEE');
    this.discoverCapabilities();
    db.logAudit('PLATFORM_DISCONNECT', 'OPERATOR', 'ShopeePlatformAdapter disconnected');
  }

  public getConnectionStatus(): PlatformConnectionStatus {
    return this.connection.status;
  }

  public getConnection(): PlatformConnection {
    return { ...this.connection };
  }

  public getCapabilities(): PlatformCapability[] {
    return Array.from(this.capabilities.values());
  }

  public getCapability(capability: PlatformCapabilityType): PlatformCapability {
    const cap = this.capabilities.get(capability);
    if (!cap) {
      return {
        platform: 'SHOPEE',
        capability,
        status: 'UNKNOWN',
        lastCheckedAt: new Date().toISOString(),
        source: 'DISCOVERY_FALLBACK',
        message: `Capability ${capability} has not been verified or configured.`
      };
    }
    return { ...cap };
  }

  public async getLiveStatus(): Promise<PlatformLiveStatus> {
    const liveCap = this.getCapability('LIVE_STREAM');
    return {
      isLive: liveCap.status === 'CONNECTED',
      streamUrl: liveCap.status === 'CONNECTED' ? 'rtmp://live-upload.shopee.co.id/live/sari_glow' : undefined,
      viewerCount: 980,
      title: 'Mega Flash Sale Sari Glow Official - Special Payday',
      startedAt: new Date(Date.now() - 7200000).toISOString(),
      raw: { platform: 'SHOPEE', environment: this.connection.environment }
    };
  }

  public async startLive(options?: any): Promise<PlatformOperationResult> {
    const cap = this.getCapability('LIVE_STREAM');
    if (cap.status === 'REQUIRES_APPROVAL' && !options?.forceSimulated) {
      return {
        success: false,
        capabilityStatus: 'REQUIRES_APPROVAL',
        message: 'LIVE_STREAM requires official Shopee Live Host partner authorization.'
      };
    }
    this.streamKeyConfigured = true;
    this.discoverCapabilities();
    return {
      success: true,
      message: 'DEMO / SIMULATED: Shopee Live stream initialized with test stream key.',
      capabilityStatus: 'CONNECTED'
    };
  }

  public async stopLive(): Promise<PlatformOperationResult> {
    this.streamKeyConfigured = false;
    this.discoverCapabilities();
    return {
      success: true,
      message: 'Shopee Live stream broadcast ended.'
    };
  }

  public async getLiveComments(limit: number = 10): Promise<PlatformComment[]> {
    const cap = this.getCapability('LIVE_COMMENTS');
    if (cap.status === 'NOT_CONFIGURED' || cap.status === 'UNSUPPORTED') {
      return [];
    }

    return db.chatMessages.slice(0, limit).map(m => ({
      id: m.id,
      author: m.author,
      handle: m.handle,
      text: m.text,
      timestamp: m.timestamp,
      platform: 'SHOPEE',
      raw: { conv_id: m.conv_id }
    }));
  }

  /**
   * Shopee Live does NOT support comment reply via public API.
   * Explicitly returns UNSUPPORTED status without faking success.
   */
  public async sendCommentReply(commentId: string, message: string): Promise<PlatformOperationResult> {
    return {
      success: false,
      capabilityStatus: 'UNSUPPORTED',
      message: 'COMMENT_REPLY is UNSUPPORTED by Shopee Live Open API v2. Live host cannot send chat replies via public API.'
    };
  }

  public async getProducts(): Promise<PlatformProduct[]> {
    return db.products.map(p => {
      const inv = db.getInventory(p.sku);
      return {
        platformProductId: `sp-item-${p.id}`,
        sku: p.sku,
        title: p.name,
        price: p.sale_price ?? p.base_price,
        stock: inv ? inv.available_stock : 0,
        status: p.status,
        currency: p.currency
      };
    });
  }

  public async getProduct(platformProductId: string): Promise<PlatformProduct | null> {
    const all = await this.getProducts();
    return all.find(p => p.platformProductId === platformProductId || p.sku === platformProductId) || null;
  }

  public async syncProduct(sku: string, data: any): Promise<PlatformSyncResult> {
    const p = db.getProductBySku(sku);
    if (!p) {
      return {
        success: false,
        sku,
        platform: 'SHOPEE',
        status: 'FAILED',
        message: `Product with SKU ${sku} does not exist in authoritative catalog.`,
        timestamp: new Date().toISOString()
      };
    }

    return {
      success: true,
      sku,
      platform: 'SHOPEE',
      status: 'SYNCED',
      message: `Successfully synchronized ${sku} to Shopee Live catalog.`,
      timestamp: new Date().toISOString(),
      details: { platformProductId: `sp-item-${p.id}`, syncedPrice: p.sale_price ?? p.base_price }
    };
  }

  public async getInventory(sku: string): Promise<PlatformInventoryResult> {
    const inv = db.getInventory(sku);
    return {
      sku,
      stock: inv ? inv.available_stock : 0,
      reservedStock: inv ? inv.reserved_stock : 0,
      lastSyncedAt: new Date().toISOString(),
      platform: 'SHOPEE'
    };
  }

  public async syncInventory(sku: string, availableStock: number): Promise<PlatformSyncResult> {
    const inv = db.getInventory(sku);
    if (!inv) {
      return {
        success: false,
        sku,
        platform: 'SHOPEE',
        status: 'FAILED',
        message: `Inventory record for SKU ${sku} not found.`,
        timestamp: new Date().toISOString()
      };
    }

    return {
      success: true,
      sku,
      platform: 'SHOPEE',
      status: 'SYNCED',
      message: `Shopee inventory for ${sku} updated to ${availableStock} units.`,
      timestamp: new Date().toISOString(),
      details: { availableStock, reservedStock: inv.reserved_stock }
    };
  }

  public async getOrders(limit: number = 10): Promise<PlatformOrder[]> {
    const orders: PlatformOrder[] = [
      {
        orderId: 'SP-ORD-44910',
        platform: 'SHOPEE',
        sku: 'SKU-001',
        quantity: 1,
        amount: 79000,
        buyerName: 'Hendra Gunawan',
        status: 'SHIPPED',
        createdAt: new Date(Date.now() - 720000).toISOString()
      }
    ];
    return orders.slice(0, limit);
  }

  public async registerWebhooks(webhookUrl: string): Promise<PlatformOperationResult> {
    return {
      success: true,
      message: `Shopee Push Notification Service configured for endpoint: ${webhookUrl}`,
      data: { webhookUrl, events: ['ITEM_UPDATE', 'ORDER_STATUS_UPDATE', 'STOCK_OUT'] }
    };
  }

  public async handleWebhook(payload: any, signature?: string): Promise<PlatformWebhookResult> {
    const eventId = payload?.event_id || payload?.id || `sp-evt-${Date.now()}`;
    const eventType = payload?.type || payload?.code || 'UNKNOWN';

    return {
      handled: true,
      eventId,
      eventType
    };
  }

  public async healthCheck(): Promise<PlatformHealthResult> {
    const { platformRateLimiter } = await import('./PlatformRateLimiter');
    const rateLimit = platformRateLimiter.checkLimit('SHOPEE');
    const caps: Record<string, PlatformCapabilityStatus> = {};
    this.capabilities.forEach((val, key) => {
      caps[key] = val.status;
    });

    if (!rateLimit.allowed) {
      return {
        healthy: false,
        latencyMs: 0,
        message: `RATE_LIMITED: Throttled by Shopee Open Platform API. Paused for ${Math.ceil(rateLimit.retryAfterMs / 1000)}s`,
        capabilities: caps
      };
    }

    const isHealthy = this.connection.status === 'CONNECTED';
    return {
      healthy: isHealthy,
      latencyMs: 38,
      message: isHealthy ? 'Shopee Open Platform API v2 responsive (38ms latency)' : 'Shopee connection offline',
      capabilities: caps
    };
  }
}
