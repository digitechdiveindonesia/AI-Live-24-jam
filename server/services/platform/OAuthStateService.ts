import crypto from 'crypto';
import { PlatformType } from '../../db/schema';
import { db } from '../../db';

export interface OAuthStateRecord {
  state: string;
  platform: PlatformType;
  createdAt: number;
  expiresAt: number;
  used: boolean;
  metadata?: Record<string, any>;
}

export class OAuthStateService {
  private static instance: OAuthStateService;

  // In-memory server-side state registry
  private states: Map<string, OAuthStateRecord> = new Map();
  // State TTL: 10 minutes (600,000 ms)
  private readonly defaultTtlMs = 10 * 60 * 1000;

  private constructor() {
    // Periodic sweep for expired states every 5 minutes
    setInterval(() => this.cleanupExpiredStates(), 5 * 60 * 1000).unref();
  }

  public static getInstance(): OAuthStateService {
    if (!OAuthStateService.instance) {
      OAuthStateService.instance = new OAuthStateService();
    }
    return OAuthStateService.instance;
  }

  /**
   * Generates a cryptographically secure random state (32 bytes hex).
   * Associates state with platform, timestamps, and single-use flag.
   */
  public generateState(platform: PlatformType, metadata?: Record<string, any>, customTtlMs?: number): string {
    const state = crypto.randomBytes(32).toString('hex');
    const now = Date.now();
    const ttl = customTtlMs ?? this.defaultTtlMs;

    this.states.set(state, {
      state,
      platform,
      createdAt: now,
      expiresAt: now + ttl,
      used: false,
      metadata: metadata || {}
    });

    db.logAudit(
      'PLATFORM_AUTH_STARTED',
      'SYSTEM',
      `OAuth state generated for ${platform}`
    );

    return state;
  }

  /**
   * Validates state on callback:
   * 1. Existence check
   * 2. Reused state rejection (single-use)
   * 3. Expiration check (TTL)
   * 4. Platform mismatch check
   * Once validated, marks state as used immediately to prevent replay attacks.
   */
  public validateAndConsumeState(
    state: string,
    expectedPlatform: PlatformType
  ): { valid: boolean; reason?: string; metadata?: Record<string, any> } {
    if (!state) {
      db.logAudit('PLATFORM_AUTH_FAILED', 'SECURITY', `OAuth callback rejected: Missing state parameter`);
      return { valid: false, reason: 'MISSING_STATE' };
    }

    const record = this.states.get(state);

    // 1. Check existence
    if (!record) {
      db.logAudit('PLATFORM_AUTH_FAILED', 'SECURITY', `OAuth callback rejected: Unknown state parameter`);
      return { valid: false, reason: 'INVALID_STATE' };
    }

    // 2. Reject reused state (Replay Protection)
    if (record.used) {
      db.logAudit(
        'PLATFORM_AUTH_FAILED',
        'SECURITY',
        `OAuth callback rejected: Reused state detected for ${expectedPlatform}`
      );
      return { valid: false, reason: 'STATE_ALREADY_USED' };
    }

    // 3. Reject expired state
    if (Date.now() > record.expiresAt) {
      this.states.delete(state);
      db.logAudit(
        'PLATFORM_AUTH_FAILED',
        'SECURITY',
        `OAuth callback rejected: Expired state parameter for ${expectedPlatform}`
      );
      return { valid: false, reason: 'STATE_EXPIRED' };
    }

    // 4. Reject platform mismatch
    if (record.platform !== expectedPlatform) {
      db.logAudit(
        'PLATFORM_AUTH_FAILED',
        'SECURITY',
        `OAuth callback rejected: Platform mismatch. Expected ${expectedPlatform}, got ${record.platform}`
      );
      return { valid: false, reason: 'PLATFORM_MISMATCH' };
    }

    // Mark as used immediately
    record.used = true;
    this.states.delete(state);

    return { valid: true, metadata: record.metadata };
  }

  public cleanupExpiredStates(): void {
    const now = Date.now();
    for (const [key, record] of this.states.entries()) {
      if (now > record.expiresAt || record.used) {
        this.states.delete(key);
      }
    }
  }

  public clearAll(): void {
    this.states.clear();
  }
}

export const oAuthStateService = OAuthStateService.getInstance();
