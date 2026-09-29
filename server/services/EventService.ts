import { db } from '../db';
import { HostEvent, SystemEvent, AuditLog } from '../db/schema';

export type EventSubscriber = (eventType: string, payload: any) => void;

export class EventService {
  private subscribers: Map<string, EventSubscriber[]> = new Map();
  private globalSubscribers: EventSubscriber[] = [];

  public subscribe(eventTypeOrCallback: string | EventSubscriber, callback?: EventSubscriber): () => void {
    if (typeof eventTypeOrCallback === 'function') {
      this.globalSubscribers.push(eventTypeOrCallback);
      return () => {
        this.globalSubscribers = this.globalSubscribers.filter(cb => cb !== eventTypeOrCallback);
      };
    }

    const eventType = eventTypeOrCallback;
    const fn = callback!;
    if (eventType === '*') {
      this.globalSubscribers.push(fn);
      return () => {
        this.globalSubscribers = this.globalSubscribers.filter(cb => cb !== fn);
      };
    }

    const list = this.subscribers.get(eventType) || [];
    list.push(fn);
    this.subscribers.set(eventType, list);
    return () => {
      const updated = (this.subscribers.get(eventType) || []).filter(cb => cb !== fn);
      this.subscribers.set(eventType, updated);
    };
  }

  public emit(eventType: string, payload: any): void {
    // Notify global subscribers
    for (const cb of this.globalSubscribers) {
      try {
        cb(eventType, payload);
      } catch (err) {
        console.error(`[EventService] Error in global subscriber for ${eventType}:`, err);
      }
    }

    // Notify specific event subscribers
    const list = this.subscribers.get(eventType) || [];
    for (const cb of list) {
      try {
        cb(eventType, payload);
      } catch (err) {
        console.error(`[EventService] Error in subscriber for ${eventType}:`, err);
      }
    }
  }

  public getHostEvents(): HostEvent[] {
    return [...db.hostEvents];
  }

  public getSystemEvents(): SystemEvent[] {
    return [...db.systemEvents];
  }

  public getAuditLogs(): AuditLog[] {
    return [...db.auditLogs];
  }

  public logSystemEvent(serviceName: string, status: 'HEALTHY' | 'DEGRADED' | 'DOWN', latencyMs: number, details: string): void {
    const event: SystemEvent = {
      id: `sysevent-${Date.now()}`,
      service_name: serviceName,
      status,
      latency_ms: latencyMs,
      details,
      timestamp: new Date().toISOString()
    };
    db.systemEvents.unshift(event);
    this.emit('SYSTEM_EVENT', event);
  }
}

export const eventService = new EventService();
