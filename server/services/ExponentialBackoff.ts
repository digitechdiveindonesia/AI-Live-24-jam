export interface BackoffConfig {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  jitter: boolean;
}

export const DEFAULT_BACKOFF_CONFIG: BackoffConfig = {
  maxAttempts: 3,
  baseDelayMs: 200,
  maxDelayMs: 2000,
  jitter: true
};

export class ExponentialBackoff {
  private config: BackoffConfig;

  constructor(config: Partial<BackoffConfig> = {}) {
    this.config = { ...DEFAULT_BACKOFF_CONFIG, ...config };
  }

  public getConfig(): BackoffConfig {
    return { ...this.config };
  }

  public setConfig(updates: Partial<BackoffConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  /**
   * Calculates the delay for a given attempt number (1-indexed).
   */
  public calculateDelay(attempt: number, customConfig?: Partial<BackoffConfig>): number {
    const cfg = { ...this.config, ...customConfig };
    const exponent = Math.max(0, attempt - 1);
    let delay = Math.min(cfg.maxDelayMs, cfg.baseDelayMs * Math.pow(2, exponent));

    if (cfg.jitter) {
      // Add +/- 20% randomized jitter
      const jitterFactor = 0.8 + Math.random() * 0.4;
      delay = Math.round(delay * jitterFactor);
    }

    return Math.min(cfg.maxDelayMs, Math.max(0, delay));
  }

  /**
   * Executes an asynchronous operation with retry logic and exponential backoff.
   */
  public async executeWithRetry<T>(
    operation: (attempt: number) => Promise<T>,
    options?: {
      config?: Partial<BackoffConfig>;
      onRetry?: (error: any, attempt: number, nextDelayMs: number) => void;
      shouldRetry?: (error: any) => boolean;
      skipWaitInTest?: boolean;
    }
  ): Promise<T> {
    const cfg = { ...this.config, ...options?.config };
    let lastError: any;

    for (let attempt = 1; attempt <= cfg.maxAttempts; attempt++) {
      try {
        return await operation(attempt);
      } catch (err: any) {
        lastError = err;

        if (attempt >= cfg.maxAttempts) {
          break;
        }

        if (options?.shouldRetry && !options.shouldRetry(err)) {
          break;
        }

        const delayMs = this.calculateDelay(attempt, cfg);
        if (options?.onRetry) {
          options.onRetry(err, attempt, delayMs);
        }

        const isTest = process.env.NODE_ENV === 'test' || options?.skipWaitInTest;
        if (!isTest && delayMs > 0) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }
    }

    throw lastError;
  }
}

export const exponentialBackoff = new ExponentialBackoff();
