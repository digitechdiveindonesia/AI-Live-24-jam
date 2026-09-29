import { db } from '../db';
import { QueuedQuestion, MessagePriority, QuestionStatus } from '../db/schema';
import { eventService } from './EventService';

export class QuestionQueue {
  private queue: QueuedQuestion[] = [];

  constructor() {
    this.queue = db.queuedQuestions;
  }

  public enqueue(question: QueuedQuestion): void {
    // Avoid exact duplicate active questions
    const existing = this.queue.find(
      q => q.conversationId === question.conversationId &&
           q.message.toLowerCase() === question.message.toLowerCase() &&
           (q.status === 'QUEUED' || q.status === 'PROCESSING')
    );
    if (existing) {
      return;
    }

    this.queue.push(question);
    this.prioritize();
    eventService.emit('QUESTION_ENQUEUED', {
      id: question.id,
      priority: question.priority,
      intent: question.intent,
      message: question.message
    });
  }

  public dequeue(): QueuedQuestion | undefined {
    this.prioritize();
    const item = this.queue.find(q => q.status === 'QUEUED');
    if (item) {
      item.status = 'PROCESSING';
      eventService.emit('QUESTION_DEQUEUED', { id: item.id, message: item.message });
    }
    return item;
  }

  public peek(): QueuedQuestion | undefined {
    this.prioritize();
    return this.queue.find(q => q.status === 'QUEUED');
  }

  public prioritize(): QueuedQuestion[] {
    const priorityWeight: Record<MessagePriority, number> = {
      CRITICAL: 4,
      HIGH: 3,
      NORMAL: 2,
      LOW: 1
    };

    this.queue.sort((a, b) => {
      // Unprocessed first
      if (a.status === 'QUEUED' && b.status !== 'QUEUED') return -1;
      if (a.status !== 'QUEUED' && b.status === 'QUEUED') return 1;

      // Higher priority first
      const weightDiff = (priorityWeight[b.priority] || 0) - (priorityWeight[a.priority] || 0);
      if (weightDiff !== 0) return weightDiff;

      // Older timestamp first (FIFO within same priority)
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

    return [...this.queue];
  }

  public clear(): void {
    this.queue = [];
    db.queuedQuestions = [];
    eventService.emit('QUESTION_QUEUE_CLEARED', {});
  }

  public getAll(): QueuedQuestion[] {
    return [...this.queue];
  }

  public updateStatus(id: string, status: QuestionStatus): void {
    const item = this.queue.find(q => q.id === id);
    if (item) {
      item.status = status;
      eventService.emit('QUESTION_STATUS_UPDATED', { id, status });
    }
  }

  public determinePriority(text: string, intent?: string): MessagePriority {
    const lower = text.toLowerCase();

    // 1. CRITICAL: Logistics failures, complaints, order damage, refunds, escalation
    if (
      intent === 'COMPLAINT' ||
      intent === 'ESCALATION' ||
      lower.includes('belum sampai') ||
      lower.includes('rusak') ||
      lower.includes('pecah') ||
      lower.includes('bocor') ||
      lower.includes('salah kirim') ||
      lower.includes('penipuan') ||
      lower.includes('refund') ||
      lower.includes('komplain') ||
      lower.includes('uang kepotong') ||
      lower.includes('batal')
    ) {
      return 'CRITICAL';
    }

    // 2. HIGH: High purchase intent blockers, clinical safety, variant doubts, remaining inventory
    if (
      intent === 'VARIANT_QUESTION' ||
      lower.includes('ukuran') ||
      lower.includes('size') ||
      lower.includes('varian') ||
      lower.includes('shade') ||
      lower.includes('sensitif') ||
      lower.includes('bumil') ||
      lower.includes('jerawat') ||
      lower.includes('alergi') ||
      lower.includes('sisa berapa') ||
      lower.includes('stok tinggal') ||
      lower.includes('expired') ||
      lower.includes('kadaluarsa')
    ) {
      return 'HIGH';
    }

    // 3. NORMAL: Core buying inquiries, price, promotions, COD
    if (
      intent === 'PRICE_QUESTION' ||
      intent === 'PROMOTION_QUESTION' ||
      intent === 'SHIPPING_QUESTION' ||
      intent === 'STOCK_QUESTION' ||
      lower.includes('harga') ||
      lower.includes('berapa') ||
      lower.includes('promo') ||
      lower.includes('diskon') ||
      lower.includes('cod') ||
      lower.includes('ongkir') ||
      lower.includes('voucher') ||
      lower.includes('checkout')
    ) {
      return 'NORMAL';
    }

    // 4. LOW: Casual commentary, cheer, greetings
    return 'LOW';
  }
}

export const questionQueue = new QuestionQueue();
