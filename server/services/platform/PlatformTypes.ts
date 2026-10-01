import {
  PlatformType,
  PlatformCapabilityType,
  PlatformCapabilityStatus,
  PlatformCapability,
  PlatformConnectionStatus,
  PlatformConnection,
  SyncConflict,
  TokenState,
  VerificationResult,
  SafePlatformConnection,
  ConnectionVerificationReport,
  PlatformResponseRouteResult
} from '../../db/schema';

export type {
  PlatformType,
  PlatformCapabilityType,
  PlatformCapabilityStatus,
  PlatformCapability,
  PlatformConnectionStatus,
  PlatformConnection,
  SyncConflict,
  TokenState,
  VerificationResult,
  SafePlatformConnection,
  ConnectionVerificationReport,
  PlatformResponseRouteResult
};

export interface TokenMetadata {
  platform: PlatformType;
  state: TokenState;
  accountId?: string;
  shopId?: string;
  expiresAt?: number;
  lastRefreshedAt?: string;
  hasRefreshToken: boolean;
  scopes: string[];
}

export type HttpFetchFn = (url: string, init?: RequestInit) => Promise<Response>;

export interface RateLimitState {
  platform: PlatformType;
  isRateLimited: boolean;
  retryAfterMs: number;
  lastThrottledAt?: string;
  limitRemaining?: number;
  resetAt?: string;
}

export interface PlatformConfig {
  platform: PlatformType;
  environment: 'DEVELOPMENT' | 'STAGING' | 'PRODUCTION';
  configured: boolean;
  missingFields: string[];
  redirectUri?: string;
  // Note: secrets (clientSecret, partnerKey) are never returned in public config
}


export interface PlatformLiveStatus {
  isLive: boolean;
  streamUrl?: string;
  viewerCount?: number;
  title?: string;
  startedAt?: string;
  raw?: any;
}

export interface PlatformComment {
  id: string;
  author: string;
  handle: string;
  text: string;
  timestamp: string;
  platform: PlatformType;
  raw?: any;
}

export interface PlatformProduct {
  platformProductId: string;
  sku: string;
  title: string;
  price: number;
  stock: number;
  status: string;
  currency?: string;
  raw?: any;
}

export interface PlatformInventoryResult {
  sku: string;
  stock: number;
  reservedStock?: number;
  lastSyncedAt: string;
  platform: PlatformType;
}

export interface PlatformSyncResult {
  success: boolean;
  sku: string;
  platform: PlatformType;
  status: 'SYNCED' | 'FAILED' | 'CONFLICT' | 'SKIPPED';
  message: string;
  timestamp: string;
  details?: any;
}

export interface PlatformOrder {
  orderId: string;
  platform: PlatformType;
  sku: string;
  quantity: number;
  amount: number;
  buyerName: string;
  status: string;
  createdAt: string;
  raw?: any;
}

export interface PlatformOperationResult<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
  capabilityStatus?: PlatformCapabilityStatus;
}

export interface PlatformHealthResult {
  healthy: boolean;
  latencyMs: number;
  message: string;
  capabilities: Record<string, PlatformCapabilityStatus>;
}

export interface PlatformWebhookResult {
  handled: boolean;
  eventId?: string;
  eventType?: string;
  error?: string;
  deduplicated?: boolean;
}

/**
 * Universal Platform Adapter Interface
 * All platform integrations (TikTok, Shopee, etc.) must implement this contract.
 * Unsupported methods MUST return explicit capability status rather than pretending success.
 */
export interface PlatformAdapter {
  readonly platform: PlatformType;
  readonly name: string;

  initialize(): Promise<void>;
  connect(): Promise<PlatformConnection>;
  disconnect(): Promise<void>;
  getConnectionStatus(): PlatformConnectionStatus;
  getConnection(): PlatformConnection;

  getCapabilities(): PlatformCapability[];
  getCapability(capability: PlatformCapabilityType): PlatformCapability;

  // Live stream control
  getLiveStatus(): Promise<PlatformLiveStatus>;
  startLive(options?: any): Promise<PlatformOperationResult>;
  stopLive(): Promise<PlatformOperationResult>;

  // Interactive Live Chat
  getLiveComments(limit?: number): Promise<PlatformComment[]>;
  sendCommentReply(commentId: string, message: string): Promise<PlatformOperationResult>;

  // Product Catalog
  getProducts(): Promise<PlatformProduct[]>;
  getProduct(platformProductId: string): Promise<PlatformProduct | null>;
  syncProduct(sku: string, data: any): Promise<PlatformSyncResult>;

  // Inventory
  getInventory(sku: string): Promise<PlatformInventoryResult>;
  syncInventory(sku: string, availableStock: number): Promise<PlatformSyncResult>;

  // Orders
  getOrders(limit?: number): Promise<PlatformOrder[]>;

  // Webhooks
  registerWebhooks(webhookUrl: string): Promise<PlatformOperationResult>;
  handleWebhook(payload: any, signature?: string): Promise<PlatformWebhookResult>;

  // Diagnostics
  healthCheck(): Promise<PlatformHealthResult>;
}

/**
 * Authentication and OAuth Abstraction
 * Keeps all raw secrets and tokens strictly server-side.
 */
export interface PlatformAuthCredentials {
  platform: PlatformType;
  clientId?: string;
  clientSecret?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  shopId?: string;
  accountId?: string;
}

export interface PlatformAuthResult {
  success: boolean;
  accountId?: string;
  shopId?: string;
  message: string;
  isSimulated?: boolean;
}

export interface PlatformAuthProvider {
  getAuthorizationUrl(platform: PlatformType, state?: string): Promise<string>;
  handleCallback(platform: PlatformType, code: string, state?: string): Promise<PlatformAuthResult>;
  refreshCredentials(platform: PlatformType): Promise<boolean>;
  revokeCredentials(platform: PlatformType): Promise<boolean>;
  hasCredentials(platform: PlatformType): boolean;
}
