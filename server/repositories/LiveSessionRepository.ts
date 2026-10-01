import { LiveSession } from '../db/schema';
import { supabaseManager } from '../db/supabaseClient';
import { db } from '../db';

export class LiveSessionRepository {
  public async getSession(id?: string): Promise<LiveSession | null> {
    const client = supabaseManager.getClient();
    if (client) {
      const query = client.from('live_sessions').select('*');
      const { data, error } = id ? await query.eq('id', id).maybeSingle() : await query.order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (!error && data) {
        return data as LiveSession;
      }
    }
    return id ? (db.session.id === id ? db.session : null) : db.session;
  }

  public async getAllSessions(): Promise<LiveSession[]> {
    const client = supabaseManager.getClient();
    if (client) {
      const { data, error } = await client
        .from('live_sessions')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        return data as LiveSession[];
      }
    }
    return [db.session];
  }

  public async createSession(data: Partial<LiveSession>): Promise<LiveSession> {
    const newSession = db.resetLiveSession(data);
    const client = supabaseManager.getClient();
    if (client) {
      const { data: inserted, error } = await client
        .from('live_sessions')
        .insert(newSession)
        .select()
        .single();

      if (!error && inserted) {
        return inserted as LiveSession;
      }
    }
    return newSession;
  }

  public async updateSession(id: string, updates: Partial<LiveSession>): Promise<LiveSession | null> {
    const updated = db.updateLiveSession(updates);
    const client = supabaseManager.getClient();
    if (client) {
      const { data, error } = await client
        .from('live_sessions')
        .update(updates)
        .eq('id', id)
        .select()
        .maybeSingle();

      if (!error && data) {
        return data as LiveSession;
      }
    }
    return updated;
  }
}

export const liveSessionRepository = new LiveSessionRepository();
