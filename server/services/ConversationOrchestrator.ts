import { db } from '../db';
import { intentService } from './IntentService';
import { productIdentificationService, productVerificationService } from './ProductService';
import { retrievalService } from './RetrievalService';
import { guardrailService } from './GuardrailService';
import { geminiService, GeminiStructuredResponse } from './GeminiService';
import { questionQueue } from './QuestionQueue';
import { interruptionEngine } from './InterruptionEngine';
import { ttsAdapter } from './TTSAdapter';
import { conversationContextService } from './ConversationContextService';
import { eventService } from './EventService';
import { MessagePriority, CustomerConversation, ConversationMessage } from '../db/schema';

export interface CustomerMessageInput {
  text: string;
  author?: string;
  handle?: string;
  customerId?: string;
  platform?: string;
  sku?: string;
  skipTtsDelay?: boolean; // For fast automated tests
}

export interface OrchestrationResult {
  messageId: string;
  conversationId: string;
  priority: MessagePriority;
  detectedIntent: string;
  intentConfidence: number;
  matchedSku: string;
  verifiedProductName: string;
  verifiedPrice: string;
  verifiedStock: number;
  retrievedRules: string[];
  guardrailStatus: 'APPROVED' | 'MODIFIED' | 'BLOCKED';
  violationsDetected: string[];
  generatedResponse: string;
  tone: string;
  requiresHumanReview: boolean;
  shouldContinueSelling: boolean;
  interruptionAction: 'INTERRUPTED' | 'QUEUED' | 'PASSED';
  resumeStep: string;
  transitionBridge: string;
  executionLatencyMs: number;
  audioDurationMs: number;
}

export class ConversationOrchestrator {
  /**
   * Primary pipeline method executing the complete 17-stage observable real-time interaction.
   */
  public async handleCustomerMessage(
    sessionId: string = 'LIVE-001',
    message: CustomerMessageInput
  ): Promise<OrchestrationResult> {
    const startTime = Date.now();
    const customerId = message.customerId || `cust-${(message.handle || 'viewer').replace('@', '')}`;
    const author = message.author || 'Penonton Live';
    const handle = message.handle || '@penonton';
    const platform = message.platform || 'TikTok';
    const currentSku = message.sku || db.session.current_sku || 'SKU-001';

    // Stage 1: Persist customer message in conversation model
    const conversation = db.getOrCreateConversation(sessionId, customerId, author, handle, platform);
    const persistedMsg = conversationContextService.recordCustomerTurn(
      conversation.conversation_id,
      message.text,
      { author, handle, platform }
    );
    const messageId = persistedMsg.message_id;

    // Stage 2: Emit CUSTOMER_MESSAGE
    eventService.emit('CUSTOMER_MESSAGE', {
      messageId,
      conversationId: conversation.conversation_id,
      sessionId,
      author,
      handle,
      platform,
      text: message.text,
      timestamp: persistedMsg.timestamp
    });

    // Stage 3: Determine Intent & Priority
    const intentResult = await intentService.analyzeIntent(message.text, currentSku);
    const priority = questionQueue.determinePriority(message.text, intentResult.intent);

    // Stage 4: Identify Product
    const idResult = productIdentificationService.identifyProduct(message.text, currentSku);
    const targetSku = idResult.identifiedSku;

    // Stage 5 & 7: Retrieve and verify authoritative commerce data
    const verifiedFacts = productVerificationService.verifyProductData(targetSku);
    if (!verifiedFacts) {
      throw new Error(`Product SKU ${targetSku} not found in authoritative commerce catalog`);
    }

    // Stage 6: Retrieve relevant knowledge & brand policy rules
    const retrievalResult = retrievalService.retrieveContext(message.text, targetSku);
    const rulesList = retrievalResult.matchedRules.map(r => `Rule (${r.rule_type}): ${r.reason}`);

    // Stage 11: Emit AI_RESPONSE_STARTED
    eventService.emit('AI_RESPONSE_STARTED', {
      messageId,
      conversationId: conversation.conversation_id,
      intent: intentResult.intent,
      priority,
      sku: targetSku
    });

    // Short-term context formatting
    const contextSummary = conversationContextService.formatContextForPrompt(
      conversation.conversation_id,
      targetSku
    );

    // Stage 9: Generate AI response (server-side Gemini structured contract)
    const structuredAi: GeminiStructuredResponse = await geminiService.generateStructuredResponse(
      message.text,
      {
        sku: verifiedFacts.sku,
        name: verifiedFacts.name,
        price: verifiedFacts.salePriceFormatted,
        normalPrice: `Rp${verifiedFacts.basePrice.toLocaleString('id-ID')}`,
        stock: verifiedFacts.totalStock,
        promo: verifiedFacts.promoTitle,
        usage: verifiedFacts.approvedClaims.join('. '),
        shipping: 'Pengiriman setiap hari, ready COD ke seluruh Indonesia'
      },
      rulesList,
      contextSummary
    );

    // Stage 8: Run Guardrails
    const guardrailResult = guardrailService.auditResponse(structuredAi.response, verifiedFacts);
    const finalAnswer = guardrailResult.sanitizedText;

    // Stage 10: Persist AI interaction
    const latency = Date.now() - startTime;
    conversationContextService.recordAiTurn(conversation.conversation_id, finalAnswer, {
      intent: intentResult.intent,
      latencyMs: latency,
      guardrailStatus: guardrailResult.status
    });

    db.aiInteractions.unshift({
      id: `ai-interact-${Date.now()}`,
      message_id: messageId,
      intent: intentResult.intent,
      matched_sku: targetSku,
      verified_facts: {
        price: verifiedFacts.basePrice,
        sale_price: verifiedFacts.salePrice,
        stock: verifiedFacts.totalStock,
        promo: verifiedFacts.promoTitle
      },
      guardrail_status: guardrailResult.status,
      generated_response: finalAnswer,
      response_time_ms: latency,
      host_state_before: interruptionEngine.getState(),
      host_state_after: 'SELLING'
    });

    // Stage 12: Emit AI_RESPONSE_COMPLETED
    eventService.emit('AI_RESPONSE_COMPLETED', {
      messageId,
      conversationId: conversation.conversation_id,
      finalAnswer,
      latencyMs: latency,
      guardrailStatus: guardrailResult.status
    });

    // Stage 13: Trigger Host Interruption Decision
    const decision = interruptionEngine.evaluateInterruption(
      message.text,
      priority,
      intentResult.intent
    );

    let interruptionAction: 'INTERRUPTED' | 'QUEUED' | 'PASSED' = 'PASSED';
    let resumeStep = 'PROMO';
    let transitionBridge = '';
    let audioDurationMs = 0;

    if (decision.action === 'INTERRUPT_NOW' && decision.preservedPosition) {
      interruptionAction = 'INTERRUPTED';

      // Safe stop current speech & preserve script position
      interruptionEngine.beginInterruption(message.text, decision.preservedPosition);

      // Start host answer
      interruptionEngine.startAnswering(finalAnswer);

      // Stage 14: Deliver response through TTS adapter
      const ttsResult = await ttsAdapter.synthesizeAndPlay(finalAnswer, {
        priority,
        skipDelay: message.skipTtsDelay ?? false
      });
      audioDurationMs = ttsResult.audioDurationMs;

      // Stage 15 & 16: Complete host response and transition back to selling without restarting script
      const completion = interruptionEngine.completeAnswerAndResume(intentResult.intent, targetSku);
      resumeStep = completion.resumeStep;
      transitionBridge = completion.transitionBridge;

      // Stage 17: Emit RETURN_TO_SELLING
      eventService.emit('RETURN_TO_SELLING', {
        messageId,
        resumeStep,
        transitionBridge
      });
    } else if (decision.action === 'QUEUE') {
      interruptionAction = 'QUEUED';
      questionQueue.enqueue({
        id: `queue-${Date.now()}`,
        message: message.text,
        conversationId: conversation.conversation_id,
        priority,
        intent: intentResult.intent,
        productId: targetSku,
        createdAt: new Date().toISOString(),
        status: 'QUEUED'
      });
    }

    return {
      messageId,
      conversationId: conversation.conversation_id,
      priority,
      detectedIntent: intentResult.intent,
      intentConfidence: intentResult.confidence,
      matchedSku: targetSku,
      verifiedProductName: verifiedFacts.name,
      verifiedPrice: verifiedFacts.salePriceFormatted,
      verifiedStock: verifiedFacts.totalStock,
      retrievedRules: rulesList,
      guardrailStatus: guardrailResult.status,
      violationsDetected: guardrailResult.violationsDetected,
      generatedResponse: finalAnswer,
      tone: structuredAi.tone,
      requiresHumanReview: structuredAi.requiresHumanReview,
      shouldContinueSelling: structuredAi.shouldContinueSelling,
      interruptionAction,
      resumeStep,
      transitionBridge,
      executionLatencyMs: latency,
      audioDurationMs
    };
  }
}

export const conversationOrchestrator = new ConversationOrchestrator();
