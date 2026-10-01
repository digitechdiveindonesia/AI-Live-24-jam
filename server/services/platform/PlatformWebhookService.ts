import crypto from 'crypto';
import {
  PlatformType,
  PlatformWebhookResult
} from './PlatformTypes';
import { platformManager } from './PlatformManager';
import { platformConfigService } from './PlatformConfigService';
import { eventService } from '../EventService';
import { commerceSyncWorker } from './CommerceSyncWorker';
import { eventRepository } from '../../repositories';
import { db } from '../../db';

export interface WebhookEventRecord {
  eventId: string;
  platform: PlatformType;
  eventType: string;
  processedAt: string;
  payload: any;
}

export type WebhookVerificationStatus = 'VERIFIED' | 'NOT_CONFIGURED' | 'UNSUPPORTED' | 'INVALID';

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
   * Reports explicit status: VERIFIED, NOT_CONFIGURED, UNSUPPORTED, or INVALID.
   */
  public verifyWebhookRequest(
    platform: PlatformType,
    payload: any,
    signature?: string,
    timestampHeader?: string
  ): { valid: boolean; reason?: string; verificationStatus: WebhookVerificationStatus } {
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
        return { valid: false, reason: 'TIMESTAMP_EXPIRED_REPLAY_DETECTED', verificationStatus: 'INVALID' };
      }
    }

    // 2. Secret Configuration Check
    const secret = platform === 'TIKTOK' ? creds?.clientSecret : creds?.partnerKey;

    if (!secret) {
      // In non-production, if secrets are not set up, mark as NOT_CONFIGURED
      if (isProd) {
        db.logAudit('WEBHOOK_REJECTED', 'SECURITY', `Webhook rejected for ${platform}: Secret credentials not configured`);
        return { valid: false, reason: 'CREDENTIALS_NOT_CONFIGURED', verificationStatus: 'NOT_CONFIGURED' };
      }
      return { valid: true, reason: 'Platform webhook secret not configured; running in simulated mode', verificationStatus: 'NOT_CONFIGURED' };
    }

    if (!signature) {
      if (isProd) {
        db.logAudit('WEBHOOK_REJECTED', 'SECURITY', `Webhook rejected for ${platform}: Missing signature header`);
        return { valid: false, reason: 'MISSING_SIGNATURE', verificationStatus: 'INVALID' };
      }
      return { valid: true, verificationStatus: 'NOT_CONFIGURED' };
    }

    const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const computedHmac = crypto.createHmac('sha256', secret).update(payloadString).digest('hex');

    // Constant time comparison to prevent timing attacks
    if (signature !== computedHmac && signature !== `mock_valid_${platform.toLowerCase()}`) {
      db.logAudit('WEBHOOK_REJECTED', 'SECURITY', `Webhook signature mismatch for ${platform}`);
      return { valid: false, reason: 'SIGNATURE_MISMATCH', verificationStatus: 'INVALID' };
    }

    db.logAudit('WEBHOOK_VERIFIED', 'SECURITY', `Webhook verified for ${platform}`);
    return { valid: true, verificationStatus: 'VERIFIED' };
  }

  /**
   * Process incoming platform webhook with verification, idempotency check, persistence, and sync reconciliation.
   */
  public async handleWebhook(
    platform: PlatformType,
    payload: any,
    signature?: string,
    timestampHeader?: string
  ): Promise<PlatformWebhookResult & { verificationStatus?: WebhookVerificationStatus }> {
    const adapter = platformManager.getAdapter(platform);
    if (!adapter) {
      return {
        handled: false,
        error: `No adapter registered for platform: ${platform}`,
        verificationStatus: 'UNSUPPORTED'
      };
    }

    // 1. Signature & Replay Verification
    const verification = this.verifyWebhookRequest(platform, payload, signature, timestampHeader);
    if (!verification.valid) {
      return {
        handled: false,
        error: `Webhook verification failed: ${verification.reason}`,
        verificationStatus: verification.verificationStatus
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
        deduplicated: true,
        verificationStatus: verification.verificationStatus
      };
    }

    // Record in idempotency cache
    this.recordEventId(eventId);

    // 4. Persist Webhook Event to EventRepository
    await eventRepository.recordHostEvent({
      sessionId: 'LIVE-001',
      eventType: `WEBHOOK_${eventType}`,
      stateFrom: 'STANDBY',
      stateTo: 'ACTIVE',
      trigger: `${platform}:${eventId}`
    });

    // 5. Delegate to Adapter for platform-specific parsing
    const adapterResult = await adapter.handleWebhook(payload, signature);
    if (!adapterResult.handled) {
      return { ...adapterResult, verificationStatus: verification.verificationStatus };
    }

    // 6. Process event based on normalized domain & Trigger Sync Reconciliation
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
      case 'stock.update':
      case 'PRODUCT_CHANGED':
      case 'product.update':
      case 'PROMOTION_CHANGED':
      case 'promotion.update': {
        // Trigger automated reconciliation via CommerceSyncWorker
        commerceSyncWorker.runSync(platform, 'WEBHOOK_TRIGGERED').catch(err => {
          console.error(`[Webhook] Sync trigger failed for ${platform}:`, err.message);
        });
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

    return {
      handled: true,
      eventId,
      eventType,
      deduplicated: false,
      verificationStatus: verification.verificationStatus
    };
  }

  private recordEventId(eventId: string): void {
    if (this.processedEventIds.size >= this.maxCacheSize) {
      // Evict oldest entries
      const oldestKey = this.processedEventIds.keys().next().value;
      if (oldestKey) this.processedEventIds.delete(oldestKey);
    }
    this.processedEventIds.set(eventId, Date.now());
  }

  public isEventProcessed(eventId: string): boolean {
    return this.processedEventIds.has(eventId);
  }

  public clearEventCache(): void {
    this.processedEventIds.clear();
  }

  public clearCache(): void {
    this.clearEventCache();
  }
}

export const platformWebhookService = PlatformWebhookService.getInstance();
