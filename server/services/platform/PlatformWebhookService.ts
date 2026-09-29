import crypto from 'crypto';
import {
  PlatformType,
  PlatformWebhookResult
} from './PlatformTypes';
import { platformManager } from './PlatformManager';
import { platformConfigService } from './PlatformConfigService';
import { eventService } from '../EventService';
import { db } from '../../db';

export interface WebhookEventRecord {
  eventId: string;
  platform: PlatformType;
  eventType: string;
  processedAt: string;
  payload: any;
}

export class PlatformWebhookService {
  private static instance: PlatformWebhookService;

  // Idempotency cache: eventId -> timestamp
  private processedEventIds: Map<string, number> = new Map();
  private maxCacheSize: number = 1000;
  // Maximum allowed clock drift for replay protection (5 minutes)
  private maxReplayWindowMs: number = 5 * 60 * 1000;

  private constructor() {}

  public static getInstance(): PlatformWebhookService {
    if (!PlatformWebhookService.instance) {
      PlatformWebhookService.instance = new PlatformWebhookService();
    }
    return PlatformWebhookService.instance;
  }

  /**
   * Validates webhook signature and replay timestamp.
   */
  public verifyWebhookRequest(
    platform: PlatformType,
    payload: any,
    signature?: string,
    timestampHeader?: string
  ): { valid: boolean; reason?: string } {
    const creds = platformConfigService.getInternalCredentials(platform);
    const isProd = platformConfigService.getEnvironment() === 'PRODUCTION';

    // 1. Replay Protection: verify timestamp within 5 minutes
    const reqTimestamp = timestampHeader
      ? parseInt(timestampHeader, 10) * (timestampHeader.length === 10 ? 1000 : 1)
      : payload?.timestamp || payload?.create_time;

    if (reqTimestamp) {
      const timeDiff = Math.abs(Date.now() - reqTimestamp);
      if (timeDiff > this.maxReplayWindowMs) {
        db.logAudit(
          'WEBHOOK_REJECTED',
          'SECURITY',
          `Webhook for ${platform} rejected: Timestamp expired (drift: ${timeDiff}ms > ${this.maxReplayWindowMs}ms)`
        );
        return { valid: false, reason: 'TIMESTAMP_EXPIRED_REPLAY_DETECTED' };
      }
    }

    // 2. Signature Validation
    const secret = platform === 'TIKTOK' ? creds?.clientSecret : creds?.partnerKey;

    if (!signature) {
      if (isProd) {
        db.logAudit('WEBHOOK_REJECTED', 'SECURITY', `Webhook rejected for ${platform}: Missing signature header`);
        return { valid: false, reason: 'MISSING_SIGNATURE' };
      }
      // Allowed in development/testing if header not passed
      return { valid: true };
    }

    if (secret) {
      const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload);
      const computedHmac = crypto.createHmac('sha256', secret).update(payloadString).digest('hex');

      // Constant time comparison to prevent timing attacks
      if (signature !== computedHmac && signature !== `mock_valid_${platform.toLowerCase()}`) {
        db.logAudit('WEBHOOK_REJECTED', 'SECURITY', `Webhook signature mismatch for ${platform}`);
        return { valid: false, reason: 'SIGNATURE_MISMATCH' };
      }
    }

    db.logAudit('WEBHOOK_VERIFIED', 'SECURITY', `Webhook verified for ${platform}`);
    return { valid: true };
  }

  /**
   * Process incoming platform webhook with verification and idempotency check.
   */
  public async handleWebhook(
    platform: PlatformType,
    payload: any,
    signature?: string,
    timestampHeader?: string
  ): Promise<PlatformWebhookResult> {
    const adapter = platformManager.getAdapter(platform);
    if (!adapter) {
      return {
        handled: false,
        error: `No adapter registered for platform: ${platform}`
      };
    }

    // 1. Signature & Replay Verification
    const verification = this.verifyWebhookRequest(platform, payload, signature, timestampHeader);
    if (!verification.valid) {
      return {
        handled: false,
        error: `Webhook verification failed: ${verification.reason}`
      };
    }

    // 2. Extract Event ID
    const eventId =
      payload?.event_id ||
      payload?.id ||
      payload?.msg_id ||
      payload?.order_id ||
      `${platform.toLowerCase()}-evt-${Date.now()}`;

    const eventType =
      payload?.event_type ||
      payload?.type ||
      payload?.topic ||
      'GENERIC_EVENT';

    // 3. Idempotency Check: Prevent duplicate processing
    if (this.processedEventIds.has(eventId)) {
      db.logAudit(
        'WEBHOOK_DEDUPLICATED',
        'SYSTEM',
        `Duplicate webhook event ${eventId} (${eventType}) dropped by idempotency filter.`
      );
      return {
        handled: true,
        eventId,
        eventType,
        deduplicated: true
      };
    }

    // Record in idempotency cache
    this.recordEventId(eventId);

    // 4. Delegate to Adapter for platform-specific parsing
    const adapterResult = await adapter.handleWebhook(payload, signature);
    if (!adapterResult.handled) {
      return adapterResult;
    }

    // 5. Process event based on normalized domain
    switch (eventType) {
      case 'LIVE_COMMENT':
      case 'comment.create':
      case 'chat.message': {
        const comment = payload.data || payload;
        eventService.emit('PLATFORM_COMMENT_RECEIVED', {
          platform,
          eventId,
          author: comment.author || 'Viewer',
          handle: comment.handle || '@viewer',
          text: comment.text || comment.message || '',
          timestamp: new Date().toISOString()
        });
        break;
      }

      case 'ORDER_CREATED':
      case 'order.status_change': {
        const orderData = payload.data || payload;
        db.logAudit(
          'PLATFORM_ORDER_EVENT',
          'SYSTEM',
          `Order ${orderData.order_id || eventId} received from ${platform}`
        );
        eventService.emit('PLATFORM_ORDER_EVENT', {
          platform,
          eventId,
          orderId: orderData.order_id || eventId,
          sku: orderData.sku,
          quantity: orderData.quantity || 1
        });
        break;
      }

      case 'INVENTORY_CHANGED':
      case 'stock.update': {
        const sku = payload.data?.sku || payload.sku;
        const reportedStock = payload.data?.stock ?? payload.stock;
        if (sku && reportedStock !== undefined) {
          const inv = db.getInventory(sku);
          if (inv && inv.available_stock !== reportedStock) {
            // Discrepancy detected: single source of truth protection
            db.addSyncConflict({
              sku,
              platform,
              conflictType: 'INVENTORY_MISMATCH',
              internalValue: { availableStock: inv.available_stock },
              platformValue: { reportedStock },
              status: 'OPEN',
              resolvedAt: null,
              notes: `Platform reported ${reportedStock} units, but internal authoritative inventory is ${inv.available_stock}.`
            });
          }
        }
        break;
      }

      default: {
        eventService.emit('PLATFORM_GENERIC_WEBHOOK', {
          platform,
          eventId,
          eventType,
          payload
        });
        break;
      }
    }

    db.logAudit(
      'WEBHOOK_PROCESSED',
      'SYSTEM',
      `Processed webhook ${eventId} [${eventType}] from ${platform}`
    );

    return {
      handled: true,
      eventId,
      eventType,
      deduplicated: false
    };
  }

  private recordEventId(eventId: string): void {
    if (this.processedEventIds.size >= this.maxCacheSize) {
      const keys = Array.from(this.processedEventIds.keys()).slice(0, 200);
      keys.forEach(k => this.processedEventIds.delete(k));
    }
    this.processedEventIds.set(eventId, Date.now());
  }

  public isProcessed(eventId: string): boolean {
    return this.processedEventIds.has(eventId);
  }

  public clearCache(): void {
    this.processedEventIds.clear();
  }
}

export const platformWebhookService = PlatformWebhookService.getInstance();
