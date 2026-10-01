import { createClient, SupabaseClient } from '@supabase/supabase-js';

export type DatabaseConnectionStatus = 'CONNECTED' | 'NOT_CONFIGURED' | 'ERROR';

export interface DatabaseStatusReport {
  configured: boolean;
  status: DatabaseConnectionStatus;
  url: string | null;
  latencyMs?: number;
  message: string;
  error?: string;
  keyType?: 'SECRET_KEY' | 'PUBLISHABLE_KEY';
}

class SupabaseClientManager {
  private static instance: SupabaseClientManager;
  private client: SupabaseClient | null = null;
  private initialized: boolean = false;
  private activeKeyType: 'SECRET_KEY' | 'PUBLISHABLE_KEY' | null = null;

  private constructor() {
    this.initClient();
  }

  public static getInstance(): SupabaseClientManager {
    if (!SupabaseClientManager.instance) {
      SupabaseClientManager.instance = new SupabaseClientManager();
    }
    return SupabaseClientManager.instance;
  }

  private isPlaceholderKey(val: string): boolean {
    const lower = val.toLowerCase();
    return (
      lower.includes('your_supabase') ||
      lower.includes('placeholder') ||
      lower.includes('your-secret-key') ||
      lower.includes('your-publishable-key') ||
      lower.includes('your-service-role') ||
      lower.includes('your-anon-key') ||
      val === 'YOUR_KEY_HERE'
    );
  }

  private initClient(): void {
    const url = process.env.SUPABASE_URL?.trim();

    // Current Supabase API Key model:
    // SUPABASE_SECRET_KEY (server-only) > SUPABASE_PUBLISHABLE_KEY > legacy fallbacks
    const secretKey = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)?.trim();
    const pubKey = (process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY)?.trim();

    let key: string | undefined;
    if (secretKey && !this.isPlaceholderKey(secretKey)) {
      key = secretKey;
      this.activeKeyType = 'SECRET_KEY';
    } else if (pubKey && !this.isPlaceholderKey(pubKey)) {
      key = pubKey;
      this.activeKeyType = 'PUBLISHABLE_KEY';
    }

    if (
      !url ||
      !key ||
      url.includes('your-project.supabase.co') ||
      url.includes('placeholder')
    ) {
      this.client = null;
      this.initialized = true;
      return;
    }

    try {
      this.client = createClient(url, key, {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      });
      this.initialized = true;
      console.log(`[SupabaseClientManager] Initialized client using ${this.activeKeyType}`);
    } catch (err: any) {
      console.warn('[SupabaseClientManager] Failed to create Supabase client:', err.message);
      this.client = null;
      this.initialized = true;
    }
  }

  public isConfigured(): boolean {
    if (!this.initialized) this.initClient();
    return this.client !== null;
  }

  public getClient(): SupabaseClient | null {
    if (!this.initialized) this.initClient();
    return this.client;
  }

  public getKeyType(): 'SECRET_KEY' | 'PUBLISHABLE_KEY' | null {
    if (!this.initialized) this.initClient();
    return this.activeKeyType;
  }

  /**
   * Diagnostic check for database reachability.
   * Strict Security Rule: Never leaks SUPABASE_SECRET_KEY or publishable keys in the response.
   */
  public async checkConnectivity(): Promise<DatabaseStatusReport> {
    const rawUrl = process.env.SUPABASE_URL?.trim() || null;
    const safeUrl = rawUrl && !rawUrl.includes('placeholder') ? rawUrl.replace(/^(https?:\/\/)([^.]+)(.*)$/, '$1***$3') : null;

    if (!this.isConfigured() || !this.client) {
      return {
        configured: false,
        status: 'NOT_CONFIGURED',
        url: safeUrl,
        message: 'Supabase PostgreSQL is not configured. Set SUPABASE_URL and SUPABASE_SECRET_KEY in .env.'
      };
    }

    const start = Date.now();
    try {
      // Diagnostic query to verify schema access
      const { error } = await this.client.from('products').select('id').limit(1);
      const latencyMs = Date.now() - start;

      if (error) {
        return {
          configured: true,
          status: 'ERROR',
          url: safeUrl,
          latencyMs,
          keyType: this.activeKeyType || undefined,
          message: `Supabase query error: ${error.message}`,
          error: error.message
        };
      }

      return {
        configured: true,
        status: 'CONNECTED',
        url: safeUrl,
        latencyMs,
        keyType: this.activeKeyType || undefined,
        message: 'Successfully connected to authoritative Supabase PostgreSQL database.'
      };
    } catch (err: any) {
      return {
        configured: true,
        status: 'ERROR',
        url: safeUrl,
        latencyMs: Date.now() - start,
        keyType: this.activeKeyType || undefined,
        message: `Network/connection error to Supabase: ${err.message}`,
        error: err.message
      };
    }
  }
}

export const supabaseManager = SupabaseClientManager.getInstance();
