import { conversationOrchestrator, OrchestrationResult } from './ConversationOrchestrator';

export interface PipelineExecutionResult {
  messageId: string;
  detectedIntent: string;
  intentConfidence: number;
  matchedProductSku: string;
  verifiedProductName: string;
  verifiedPrice: string;
  verifiedStock: number;
  retrievedRules: string[];
  guardrailStatus: 'APPROVED' | 'MODIFIED' | 'BLOCKED';
  violationsDetected: string[];
  generatedResponse: string;
  executionLatencyMs: number;
  hostStateTransition: {
    before: string;
    interruptedTo: string;
    answering: string;
    returningTo: string;
  };
}

export class ResponseService {
  public async handleCustomerMessage(
    messageText: string,
    author: string = 'Penonton Live',
    handle: string = '@penonton',
    platform: string = 'TikTok',
    sessionId: string = 'LIVE-001',
    currentOnAirSku: string = 'SKU-001',
    skipTtsDelay: boolean = true
  ): Promise<PipelineExecutionResult> {
    const result: OrchestrationResult = await conversationOrchestrator.handleCustomerMessage(
      sessionId,
      {
        text: messageText,
        author,
        handle,
        platform,
        sku: currentOnAirSku,
        skipTtsDelay
      }
    );

    return {
      messageId: result.messageId,
      detectedIntent: result.detectedIntent,
      intentConfidence: result.intentConfidence,
      matchedProductSku: result.matchedSku,
      verifiedProductName: result.verifiedProductName,
      verifiedPrice: result.verifiedPrice,
      verifiedStock: result.verifiedStock,
      retrievedRules: result.retrievedRules,
      guardrailStatus: result.guardrailStatus,
      violationsDetected: result.violationsDetected,
      generatedResponse: result.generatedResponse,
      executionLatencyMs: result.executionLatencyMs,
      hostStateTransition: {
        before: 'PROMO',
        interruptedTo: 'CUSTOMER_INTERRUPTION',
        answering: 'ANSWERING',
        returningTo: result.resumeStep
      }
    };
  }
}

export const responseService = new ResponseService();
