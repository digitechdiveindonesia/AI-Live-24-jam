import {
  PlatformType,
  PlatformResponseRouteResult
} from './PlatformTypes';
import { platformManager } from './PlatformManager';
import { platformConnectionService } from './PlatformConnectionService';
import { db } from '../../db';

export interface RouteResponseParams {
  platform: PlatformType;
  conversationId: string;
  commentId?: string;
  responseText: string;
  guardrailStatus: 'APPROVED' | 'MODIFIED' | 'BLOCKED';
  author?: string;
  handle?: string;
}

export class PlatformResponseRouter {
  private static instance: PlatformResponseRouter;

  // Queue of responses held for human operator review when platform write API is unavailable/unsupported
  private operatorQueue: Array<{
    id: string;
    platform: PlatformType;
    conversationId: string;
    commentId?: string;
    responseText: string;
    reason: string;
    createdAt: string;
    author?: string;
    handle?: string;
  }> = [];

  private constructor() {}

  public static getInstance(): PlatformResponseRouter {
    if (!PlatformResponseRouter.instance) {
      PlatformResponseRouter.instance = new PlatformResponseRouter();
    }
    return PlatformResponseRouter.instance;
  }

  /**
   * Routes AI generated and guardrail-checked responses back to the originating platform.
   * Strictly verifies connection status, capability approval, and safety clearance.
   */
  public async routeResponse(params: RouteResponseParams): Promise<PlatformResponseRouteResult> {
    const { platform, conversationId, commentId, responseText, guardrailStatus, author, handle } = params;
    const now = new Date().toISOString();

    // 1. Guardrail Safety Check
    if (guardrailStatus === 'BLOCKED') {
      this.holdForOperator(platform, conversationId, responseText, 'Guardrail blocked response due to BPOM or compliance policy', commentId, author, handle);
      return {
        sent: false,
        platform,
        target: 'OPERATOR_QUEUE',
        reason: 'BLOCKED_BY_GUARDRAIL',
        responseText,
        commentId,
        timestamp: now
      };
    }

    // 2. Connection Validity Check
    const conn = platformConnectionService.getStatus(platform);
    if (conn.connectionStatus !== 'CONNECTED') {
      this.holdForOperator(platform, conversationId, responseText, `Platform connection status is ${conn.connectionStatus}`, commentId, author, handle);
      return {
        sent: false,
        platform,
        target: 'OPERATOR_QUEUE',
        reason: `PLATFORM_NOT_CONNECTED_${conn.connectionStatus}`,
        responseText,
        commentId,
        timestamp: now
      };
    }

    // 3. Capability Verification Check
    const adapter = platformManager.getAdapter(platform);
    if (!adapter) {
      this.holdForOperator(platform, conversationId, responseText, `No adapter registered for ${platform}`, commentId, author, handle);
      return {
        sent: false,
        platform,
        target: 'OPERATOR_QUEUE',
        reason: 'ADAPTER_NOT_FOUND',
        responseText,
        commentId,
        timestamp: now
      };
    }

    const replyCap = adapter.getCapability('COMMENT_REPLY');
    if (replyCap.status !== 'CONNECTED' && replyCap.status !== 'SUPPORTED') {
      // E.g. Shopee Live (UNSUPPORTED) or TikTok Live (REQUIRES_APPROVAL)
      this.holdForOperator(
        platform,
        conversationId,
        responseText,
        `COMMENT_REPLY capability is ${replyCap.status} for ${platform}: ${replyCap.message}`,
        commentId,
        author,
        handle
      );
      return {
        sent: false,
        platform,
        target: 'OPERATOR_QUEUE',
        reason: `CAPABILITY_${replyCap.status}`,
        responseText,
        commentId,
        timestamp: now
      };
    }

    // 4. Send to Platform via Adapter
    try {
      if (commentId) {
        const sendResult = await adapter.sendCommentReply(commentId, responseText);
        if (!sendResult.success) {
          this.holdForOperator(platform, conversationId, responseText, sendResult.message, commentId, author, handle);
          return {
            sent: false,
            platform,
            target: 'OPERATOR_QUEUE',
            reason: sendResult.capabilityStatus || 'SEND_REPLY_FAILED',
            responseText,
            commentId,
            timestamp: now
          };
        }
      }

      db.logAudit(
        'PLATFORM_RESPONSE_SENT',
        'AI_HOST',
        `Response routed to ${platform} for comment ${commentId || 'N/A'}`
      );

      return {
        sent: true,
        platform,
        target: 'PLATFORM',
        responseText,
        commentId,
        timestamp: now
      };
    } catch (err: any) {
      this.holdForOperator(platform, conversationId, responseText, `Adapter send error: ${err.message}`, commentId, author, handle);
      return {
        sent: false,
        platform,
        target: 'OPERATOR_QUEUE',
        reason: 'ADAPTER_EXCEPTION',
        responseText,
        commentId,
        timestamp: now
      };
    }
  }

  private holdForOperator(
    platform: PlatformType,
    conversationId: string,
    responseText: string,
    reason: string,
    commentId?: string,
    author?: string,
    handle?: string
  ): void {
    this.operatorQueue.unshift({
      id: `op-msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      platform,
      conversationId,
      commentId,
      responseText,
      reason,
      createdAt: new Date().toISOString(),
      author,
      handle
    });

    db.logAudit(
      'RESPONSE_HELD_FOR_OPERATOR',
      'ROUTER',
      `Held response for ${platform} (${reason}): "${responseText.substring(0, 40)}..."`
    );
  }

  public getOperatorQueue(): Array<any> {
    return [...this.operatorQueue];
  }

  public clearOperatorQueue(): void {
    this.operatorQueue = [];
  }
}

export const platformResponseRouter = PlatformResponseRouter.getInstance();
