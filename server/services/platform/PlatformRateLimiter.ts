import { PlatformType, RateLimitState } from './PlatformTypes';
import { db } from '../../db';

export class PlatformRateLimiter {
  private static instance: PlatformRateLimiter;

  private limits: Map<PlatformType, {
    throttledUntil: number;
    consecutiveThrottles: number;
    lastThrottledAt?: string;
    limitRemaining: number;
    resetAt?: string;
  }> = new Map();

  private constructor() {
    this.limits.set('TIKTOK', { throttledUntil: 0, consecutiveThrottles: 0, limitRemaining: 100 });
    this.limits.set('SHOPEE', { throttledUntil: 0, consecutiveThrottles: 0, limitRemaining: 100 });
  }

  public static getInstance(): PlatformRateLimiter {
    if (!PlatformRateLimiter.instance) {
      PlatformRateLimiter.instance = new PlatformRateLimiter();
    }
    return PlatformRateLimiter.instance;
  }

  public checkLimit(platform: PlatformType): { allowed: boolean; retryAfterMs: number } {
    const entry = this.limits.get(platform);
    if (!entry) return { allowed: true, retryAfterMs: 0 };

    const now = Date.now();
    if (now < entry.throttledUntil) {
      return {
        allowed: false,
        retryAfterMs: entry.throttledUntil - now
      };
    }

    return { allowed: true, retryAfterMs: 0 };
  }

  public recordSuccess(platform: PlatformType): void {
    const entry = this.limits.get(platform);
    if (entry && entry.consecutiveThrottles > 0) {
      entry.consecutiveThrottles = Math.max(0, entry.consecutiveThrottles - 1);
    }
  }

  public recordThrottled(platform: PlatformType, retryAfterSeconds?: number): void {
    let entry = this.limits.get(platform);
    if (!entry) {
      entry = { throttledUntil: 0, consecutiveThrottles: 0, limitRemaining: 0 };
      this.limits.set(platform, entry);
    }

    entry.consecutiveThrottles++;
    entry.lastThrottledAt = new Date().toISOString();

    // Calculate delay: either header retry-after or exponential backoff
    const baseDelaySec = retryAfterSeconds || Math.min(60, Math.pow(2, entry.consecutiveThrottles));
    const delayMs = baseDelaySec * 1000;
    entry.throttledUntil = Date.now() + delayMs;
    entry.resetAt = new Date(entry.throttledUntil).toISOString();

    db.logAudit(
      'RATE_LIMITED',
      'SYSTEM',
      `Platform ${platform} throttled (attempt #${entry.consecutiveThrottles}). Pausing requests for ${baseDelaySec}s.`
    );
  }

  public getState(platform: PlatformType): RateLimitState {
    const entry = this.limits.get(platform);
    const now = Date.now();
    const isLimited = entry ? now < entry.throttledUntil : false;

    return {
      platform,
      isRateLimited: isLimited,
      retryAfterMs: isLimited && entry ? Math.max(0, entry.throttledUntil - now) : 0,
      lastThrottledAt: entry?.lastThrottledAt,
      limitRemaining: entry?.limitRemaining,
      resetAt: entry?.resetAt
    };
  }

  public reset(platform: PlatformType): void {
    this.limits.set(platform, { throttledUntil: 0, consecutiveThrottles: 0, limitRemaining: 100 });
  }
}

export const platformRateLimiter = PlatformRateLimiter.getInstance();
