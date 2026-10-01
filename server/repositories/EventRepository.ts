import { AuditLog, HostEvent, SystemEvent } from '../db/schema';
import { supabaseManager } from '../db/supabaseClient';
import { db } from '../db';

export class EventRepository {
  public async logAudit(
    action: string,
    operator: string = 'SYSTEM',
    target: string,
    status: string = 'SUCCESS',
    details?: string
  ): Promise<AuditLog> {
    const log: AuditLog = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      action,
      operator,
      target,
      status,
      timestamp: new Date().toISOString()
    };

    const client = supabaseManager.getClient();
    if (client) {
      await client.from('audit_logs').insert({
        ...log,
        details: details || null
      });
    }

    db.logAudit(action, operator, target, status);
    return log;
  }

  public async getAuditLogs(limit: number = 20): Promise<AuditLog[]> {
    const client = supabaseManager.getClient();
    if (client) {
      const { data, error } = await client
        .from('audit_logs')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(limit);

      if (!error && data && data.length > 0) {
        return data as AuditLog[];
      }
    }
    return db.auditLogs.slice(0, limit);
  }

  public async logHostEvent(event: Partial<HostEvent>): Promise<HostEvent> {
    const hostEvent: HostEvent = {
      id: event.id || `he-${Date.now()}`,
      session_id: event.session_id || db.session.id,
      event_type: event.event_type || 'STATE_TRANSITION',
      state_from: event.state_from || 'INTRO',
      state_to: event.state_to || 'PROMO',
      trigger: event.trigger || 'SYSTEM',
      timestamp: event.timestamp || new Date().toISOString()
    };

    const client = supabaseManager.getClient();
    if (client) {
      await client.from('host_events').insert(hostEvent);
    }

    db.hostEvents.unshift(hostEvent);
    return hostEvent;
  }

  public async recordHostEvent(event: { sessionId?: string; eventType: string; stateFrom?: string; stateTo?: string; trigger?: string }): Promise<HostEvent> {
    return this.logHostEvent({
      session_id: event.sessionId,
      event_type: event.eventType,
      state_from: event.stateFrom,
      state_to: event.stateTo,
      trigger: event.trigger
    });
  }

  public async logSystemEvent(event: Partial<SystemEvent>): Promise<SystemEvent> {
    const systemEvent: SystemEvent = {
      id: event.id || `se-${Date.now()}`,
      service_name: event.service_name || 'SYSTEM',
      status: event.status || 'HEALTHY',
      latency_ms: event.latency_ms ?? 10,
      details: event.details || '',
      timestamp: event.timestamp || new Date().toISOString()
    };

    const client = supabaseManager.getClient();
    if (client) {
      await client.from('system_events').insert(systemEvent);
    }

    db.systemEvents.unshift(systemEvent);
    return systemEvent;
  }
}

export const eventRepository = new EventRepository();
