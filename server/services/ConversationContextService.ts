import { db } from '../db';
import { CustomerConversation, ConversationMessage } from '../db/schema';
import { hostStateMachineService } from './HostStateMachineService';

export interface ShortTermContext {
  conversationId: string;
  customerId: string;
  customerName: string;
  recentMessages: { role: string; content: string; timestamp: string }[];
  currentSku: string;
  currentVariant?: string;
  currentIntent?: string;
  lastAiResponse?: string;
  hostState: string;
}

export class ConversationContextService {
  private maxHistoryWindow: number = 4; // Controlled short-term context window

  /**
   * Retrieves bounded context window for a given conversation.
   */
  public getContext(conversationId: string, currentSku: string = 'SKU-001'): ShortTermContext {
    const conv = db.getConversationById(conversationId);
    const messages = db.getRecentConversationMessages(conversationId, this.maxHistoryWindow);

    let lastAiMsg: ConversationMessage | undefined;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'AI') {
        lastAiMsg = messages[i];
        break;
      }
    }

    return {
      conversationId,
      customerId: conv?.customer_id || 'unknown',
      customerName: conv?.customer_name || 'Penonton Live',
      recentMessages: messages.map(m => ({
        role: m.role,
        content: m.content,
        timestamp: m.timestamp
      })),
      currentSku,
      lastAiResponse: lastAiMsg?.content,
      hostState: hostStateMachineService.getState()
    };
  }

  /**
   * Formats the controlled context window into a concise text block for Gemini prompts.
   */
  public formatContextForPrompt(conversationId: string, currentSku: string): string {
    const ctx = this.getContext(conversationId, currentSku);
    if (!ctx.recentMessages || ctx.recentMessages.length === 0) {
      return 'Percakapan baru dimulai.';
    }

    const formattedLines = ctx.recentMessages.map(m => {
      const speaker = m.role === 'CUSTOMER' ? ctx.customerName : 'Sari (Host)';
      return `${speaker}: "${m.content}"`;
    });

    return formattedLines.join('\n');
  }

  public recordCustomerTurn(
    conversationId: string,
    customerText: string,
    metadata?: Record<string, any>
  ): ConversationMessage {
    return db.addConversationMessage(conversationId, 'CUSTOMER', customerText, metadata);
  }

  public recordAiTurn(
    conversationId: string,
    aiText: string,
    metadata?: Record<string, any>
  ): ConversationMessage {
    return db.addConversationMessage(conversationId, 'AI', aiText, metadata);
  }
}

export const conversationContextService = new ConversationContextService();
