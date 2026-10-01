import { CustomerConversation, ConversationMessage } from '../db/schema';
import { supabaseManager } from '../db/supabaseClient';
import { db } from '../db';

export class ConversationRepository {
  public async getConversations(sessionId?: string): Promise<CustomerConversation[]> {
    const client = supabaseManager.getClient();
    if (client) {
      let query = client.from('customer_conversations').select('*');
      if (sessionId) query = query.eq('session_id', sessionId);
      const { data, error } = await query.order('last_message_at', { ascending: false });

      if (!error && data && data.length > 0) {
        return data as CustomerConversation[];
      }
    }
    return sessionId ? db.conversations.filter(c => c.session_id === sessionId) : db.conversations;
  }

  public async getConversation(conversationId: string): Promise<CustomerConversation | null> {
    const client = supabaseManager.getClient();
    if (client) {
      const { data, error } = await client
        .from('customer_conversations')
        .select('*')
        .eq('conversation_id', conversationId)
        .maybeSingle();

      if (!error && data) {
        return data as CustomerConversation;
      }
    }
    return db.conversations.find(c => c.conversation_id === conversationId) || null;
  }

  public async getMessages(conversationId: string, limit: number = 20): Promise<ConversationMessage[]> {
    const client = supabaseManager.getClient();
    if (client) {
      const { data, error } = await client
        .from('customer_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('timestamp', { ascending: true })
        .limit(limit);

      if (!error && data && data.length > 0) {
        return data as ConversationMessage[];
      }
    }
    return db.getRecentConversationMessages(conversationId, limit);
  }

  public async addMessage(msg: Partial<ConversationMessage>): Promise<ConversationMessage> {
    const conversationId = msg.conversation_id || 'conv-001';
    const role = msg.role || 'CUSTOMER';
    const content = msg.content || '';
    const metadata = msg.metadata || {};

    const message: ConversationMessage = {
      message_id: msg.message_id || `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      conversation_id: conversationId,
      role,
      content,
      timestamp: msg.timestamp || new Date().toISOString(),
      metadata
    };

    const client = supabaseManager.getClient();
    if (client) {
      await client.from('customer_messages').insert(message);
    }

    db.addConversationMessage(conversationId, role, content, metadata);
    return message;
  }
}

export const conversationRepository = new ConversationRepository();
