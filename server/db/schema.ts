export interface Product {
  id: string;
  sku: string;
  name: string;
  description: string;
  category: string;
  base_price: number;
  sale_price: number | null;
  currency: string;
  status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
  brand: string;
  metadata: {
    bpom_number: string;
    image_url: string;
    claims_approved: string[];
    claims_restricted: string[];
  };
  created_at: string;
  updated_at: string;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  sku: string;
  variant_name: string;
  price: number;
  stock: number;
  status: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';
}

export interface Inventory {
  sku: string;
  total_stock: number;
  reserved_stock: number;
  available_stock: number;
  low_stock_threshold: number;
  last_updated: string;
}

export interface Promotion {
  id: string;
  sku: string;
  title: string;
  discount_percent: number;
  active: boolean;
  start_time: string;
  end_time: string;
}

export interface ProductFaq {
  id: string;
  product_id: string;
  sku: string;
  question: string;
  answer: string;
  category: string;
}

export interface KnowledgeDocument {
  id: string;
  title: string;
  category: string;
  content: string;
  version: string;
  indexed_at: string;
}

export interface KnowledgeChunk {
  id: string;
  doc_id: string;
  chunk_text: string;
  keywords: string[];
  confidence: number;
}

export interface KnowledgeRule {
  id: string;
  rule_type: 'APPROVED_CLAIM' | 'RESTRICTED_CLAIM' | 'BRAND_POLICY';
  pattern: string;
  replacement?: string;
  reason: string;
}

export type LiveSessionStatus =
  | 'CREATED'
  | 'STARTING'
  | 'CONNECTING'
  | 'RUNNING'
  | 'PAUSED'
  | 'DEGRADED'
  | 'RECONNECTING'
  | 'STOPPING'
  | 'STOPPED'
  | 'FAILED'
  | 'LIVE'
  | 'STANDBY'
  | 'ENDED';

export type RecoveryLevel =
  | 'LEVEL_1_RETRY'
  | 'LEVEL_2_RESTART_COMPONENT'
  | 'LEVEL_3_RECONNECT'
  | 'LEVEL_4_DEGRADED_MODE'
  | 'LEVEL_5_OPERATOR_INTERVENTION';

export type DegradedMode =
  | 'NONE'
  | 'VOICE_ONLY'
  | 'TEXT_ONLY'
  | 'SAFE_FALLBACK'
  | 'READ_ONLY_COMMERCE';

export type StallType =
  | 'HOST_STALLED'
  | 'TTS_STALLED'
  | 'AVATAR_STALLED'
  | 'EVENT_LOOP_STALLED'
  | 'QUEUE_STALLED'
  | 'SESSION_STALLED';

export interface LiveSession {
  id: string;
  session_code: string;
  title: string;
  platform: 'TikTok' | 'Shopee' | 'Dual';
  status: LiveSessionStatus;
  started_at: string | null;
  ended_at: string | null;
  current_product_id: string;
  current_host_state: string;
  current_script_id: string;
  current_script_block_id: string;
  active_conversation_count: number;
  platform_status: string;
  last_heartbeat_at: string | null;
  last_successful_event_at: string | null;
  degraded_since: string | null;
  degraded_mode?: DegradedMode;
  created_at: string;
  updated_at: string;

  // Runtime operational controls (maintained for UI compatibility)
  is_ai_host_on: boolean;
  is_paused: boolean;
  is_muted: boolean;
  is_mic_takeover: boolean;
  current_sku: string;
  active_state: string;
}

export interface LiveProduct {
  id: string;
  session_id: string;
  sku: string;
  order_index: number;
  is_pinned: boolean;
}

export interface SellingScript {
  id: string;
  sku: string;
  title: string;
  target_duration_sec: number;
}

export interface ScriptBlock {
  id: string;
  script_id: string;
  step_name: 'HOOK' | 'PROBLEM' | 'SOLUTION' | 'DEMO' | 'PROMO' | 'CTA';
  content: string;
  duration_sec: number;
  is_active: boolean;
}

export type ConversationRole = 'CUSTOMER' | 'AI' | 'OPERATOR' | 'SYSTEM';
export type ConversationStatus = 'ACTIVE' | 'WAITING' | 'ESCALATED' | 'RESOLVED' | 'HUMAN_TAKEOVER';
export type MessagePriority = 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
export type QuestionStatus = 'QUEUED' | 'PROCESSING' | 'ANSWERED' | 'ESCALATED' | 'DISMISSED';

export interface CustomerConversation {
  conversation_id: string;
  session_id: string;
  customer_id: string;
  customer_name: string;
  handle: string;
  platform: string;
  started_at: string;
  last_message_at: string;
  status: ConversationStatus;
}

export interface ConversationMessage {
  message_id: string;
  conversation_id: string;
  role: ConversationRole;
  content: string;
  timestamp: string;
  metadata?: {
    intent?: string;
    priority?: MessagePriority;
    productId?: string;
    latencyMs?: number;
    guardrailStatus?: string;
    audioDurationMs?: number;
  };
}

export interface QueuedQuestion {
  id: string;
  message: string;
  conversationId: string;
  priority: MessagePriority;
  intent: string;
  productId: string;
  createdAt: string;
  status: QuestionStatus;
}

export interface CustomerMessage {
  id: string;
  conv_id: string;
  author: string;
  handle: string;
  text: string;
  timestamp: string;
}

export interface AiInteraction {
  id: string;
  message_id: string;
  intent: string;
  matched_sku: string | null;
  verified_facts: {
    price: number | null;
    sale_price: number | null;
    stock: number | null;
    promo: string | null;
  };
  guardrail_status: 'APPROVED' | 'MODIFIED' | 'BLOCKED';
  generated_response: string;
  response_time_ms: number;
  host_state_before: string;
  host_state_after: string;
}

export interface HostEvent {
  id: string;
  session_id: string;
  event_type: string;
  state_from: string;
  state_to: string;
  trigger: string;
  timestamp: string;
}

export interface SystemEvent {
  id: string;
  service_name: string;
  status: 'HEALTHY' | 'DEGRADED' | 'DOWN';
  latency_ms: number;
  details: string;
  timestamp: string;
}

export interface AuditLog {
  id: string;
  action: string;
  operator: string;
  target: string;
  status: string;
  timestamp: string;
}

export type TTSStatus = 'IDLE' | 'GENERATING' | 'READY' | 'PLAYING' | 'PAUSED' | 'STOPPED' | 'COMPLETED' | 'ERROR';
export type AvatarStatus = 'OFFLINE' | 'READY' | 'SPEAKING' | 'PAUSED' | 'INTERRUPTED' | 'STOPPED' | 'ERROR';

export interface AvatarSession {
  sessionId: string;
  provider: string;
  avatarId: string;
  voiceId: string;
  state: AvatarStatus;
  currentAudioId: string | null;
  startedAt: string;
  lastActivityAt: string;
  metadata?: Record<string, any>;
}

export interface SpeechResumeContext {
  scriptId: string;
  scriptBlockId: string;
  productId: string;
  currentState: string;
  currentText: string;
  spokenProgress: number;
  nextBlockId: string;
  interruptedAt: string;
}

export interface VoiceTelemetry {
  id: string;
  sessionId: string;
  audioId: string;
  text: string;
  voiceLatencyMs: number;
  ttsGenerationMs: number;
  ttsDurationMs: number;
  avatarStartLatencyMs: number;
  avatarDurationMs: number;
  interruptionLatencyMs?: number;
  answerDurationMs: number;
  status: 'SUCCESS' | 'DEGRADED' | 'INTERRUPTED' | 'FALLBACK';
  provider: string;
  isSimulated: boolean;
  timestamp: string;
}

// ==========================================
// Phase 3A: Platform Adapter Foundation Types
// ==========================================

export type PlatformType = 'TIKTOK' | 'SHOPEE' | 'OTHER';

export type PlatformCapabilityType =
  | 'PRODUCT_READ'
  | 'PRODUCT_WRITE'
  | 'INVENTORY_READ'
  | 'INVENTORY_WRITE'
  | 'ORDER_READ'
  | 'ORDER_WRITE'
  | 'PROMOTION_READ'
  | 'PROMOTION_WRITE'
  | 'CHAT_READ'
  | 'CHAT_WRITE'
  | 'LIVE_READ'
  | 'LIVE_CREATE'
  | 'LIVE_CONTROL'
  | 'WEBHOOKS'
  | 'AFFILIATE'
  | 'OTHER'
  | 'ACCOUNT_ACCESS'
  | 'SHOP_ACCESS'
  | 'LIVE'
  | 'LIVE_STREAM'
  | 'LIVE_COMMENTS'
  | 'COMMENT_REPLY'
  | 'PRODUCT_CATALOG'
  | 'PRODUCT_DATA'
  | 'PRODUCT_SYNC'
  | 'INVENTORY_DATA'
  | 'INVENTORY_SYNC'
  | 'ORDER_DATA'
  | 'LIVE_ANALYTICS';

export type PlatformCapabilityStatus =
  | 'SUPPORTED'
  | 'CONNECTED'
  | 'NOT_CONFIGURED'
  | 'REQUIRES_APPROVAL'
  | 'REGION_DEPENDENT'
  | 'UNSUPPORTED'
  | 'UNKNOWN'
  | 'ERROR';

export type PlatformErrorCode =
  | 'AUTH_FAILED'
  | 'TOKEN_EXPIRED'
  | 'TOKEN_REFRESH_FAILED'
  | 'PERMISSION_DENIED'
  | 'RATE_LIMITED'
  | 'NOT_FOUND'
  | 'PLATFORM_UNAVAILABLE'
  | 'UNSUPPORTED_CAPABILITY'
  | 'INVALID_REQUEST'
  | 'UNKNOWN_PLATFORM_ERROR';

export interface PlatformCapability {
  platform: PlatformType;
  capability: PlatformCapabilityType;
  status: PlatformCapabilityStatus;
  lastCheckedAt: string;
  source: string;
  message: string;
}

export type PlatformConnectionStatus =
  | 'NOT_CONFIGURED'
  | 'AUTHORIZATION_REQUIRED'
  | 'AUTHORIZING'
  | 'CONNECTED'
  | 'TOKEN_EXPIRING'
  | 'REFRESHING'
  | 'REQUIRES_REAUTH'
  | 'DEGRADED'
  | 'ERROR'
  | 'DISCONNECTED'
  | 'CONNECTING'
  | 'UNKNOWN';

export interface PlatformConnection {
  id: string;
  platform: PlatformType;
  account_type?: string;
  external_account_id?: string | null;
  external_shop_id?: string | null;
  external_merchant_id?: string | null;
  display_name?: string | null;
  region?: string | null;
  status: PlatformConnectionStatus;
  scopes?: string[];
  capabilities?: Record<string, PlatformCapabilityStatus> | PlatformCapability[];
  access_token_encrypted?: string | null;
  refresh_token_encrypted?: string | null;
  access_token_expires_at?: string | null;
  refresh_token_expires_at?: string | null;
  last_verified_at?: string | null;
  last_error?: string | null;
  created_at?: string;
  updated_at?: string;

  // Backward compatibility fields
  accountId?: string | null;
  shopId?: string | null;
  environment?: 'SANDBOX' | 'PRODUCTION' | 'MOCK' | 'DEVELOPMENT' | 'STAGING';
  connectedAt?: string | null;
  lastHealthCheck?: string | null;
  lastError?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export type SyncConflictType =
  | 'INVENTORY_CONFLICT'
  | 'PRICE_CONFLICT'
  | 'PROMOTION_CONFLICT'
  | 'PRODUCT_MAPPING_CONFLICT'
  | 'VARIANT_MAPPING_CONFLICT'
  | 'EXTERNAL_PRODUCT_MISSING'
  | 'LOCAL_PRODUCT_MISSING'
  | 'UNKNOWN_CONFLICT'
  | 'INVENTORY_MISMATCH'
  | 'PRICE_DISCREPANCY'
  | 'STATUS_MISMATCH';

export type SyncConflictStatus =
  | 'OPEN'
  | 'RESOLVED'
  | 'IGNORED'
  | 'FAILED'
  | 'RESOLVED_INTERNAL'
  | 'RESOLVED_MANUAL';

export type SyncResolutionType =
  | 'LOCAL_AUTHORITATIVE'
  | 'EXTERNAL_OVERWRITE'
  | 'MANUAL_VALUE';

export interface SyncConflict {
  id: string;
  platform: PlatformType;
  entity_type: 'PRODUCT' | 'VARIANT' | 'INVENTORY' | 'PROMOTION';
  entity_id: string;
  external_id: string;
  conflict_type: SyncConflictType;
  local_value: any;
  external_value: any;
  status: SyncConflictStatus;
  resolution?: SyncResolutionType | null;
  resolved_by?: string | null;
  resolved_at?: string | null;
  fingerprint: string;
  notes?: string | null;
  created_at: string;
  updated_at: string;

  // Backward compatibility fields for legacy Phase 3A tests/code
  sku?: string;
  conflictType?: string;
  internalValue?: any;
  platformValue?: any;
  detectedAt?: string;
  resolvedAt?: string | null;
}

export interface ExternalProductMapping {
  id: string;
  product_id: string;
  variant_id?: string | null;
  platform: PlatformType;
  external_product_id: string;
  external_variant_id?: string | null;
  external_sku: string;
  last_synced_at: string;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface SyncRun {
  id: string;
  platform: PlatformType;
  mode: 'MANUAL' | 'SCHEDULED' | 'WEBHOOK_TRIGGERED';
  status: 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'PARTIAL';
  is_simulated: boolean;
  records_examined: number;
  conflicts_detected: number;
  conflicts_created: number;
  started_at: string;
  completed_at?: string | null;
  duration_ms?: number;
  errors?: string[];
}


// Phase 3B Additions
export type TokenState =
  | 'TOKEN_AVAILABLE'
  | 'TOKEN_EXPIRED'
  | 'TOKEN_REFRESHING'
  | 'TOKEN_INVALID'
  | 'NOT_CONFIGURED';

export type VerificationResult = 'PASS' | 'FAIL' | 'UNKNOWN' | 'NOT_CONFIGURED';

export interface SafePlatformConnection {
  platform: PlatformType;
  connectionStatus: PlatformConnectionStatus;
  accountReference: string | null;
  shopReference: string | null;
  region: string | null;
  environment: 'DEVELOPMENT' | 'STAGING' | 'PRODUCTION' | 'MOCK';
  connectedAt: string | null;
  lastHealthCheck: string | null;
  lastError: string | null;
  isSimulated: boolean;
  missingConfig?: string[];
}

export interface ConnectionVerificationReport {
  platform: PlatformType;
  result: VerificationResult;
  authentication: boolean;
  credentialValidity: boolean;
  apiReachability: boolean;
  authorizedResources: string[];
  capabilitiesVerified: Record<string, PlatformCapabilityStatus>;
  error?: string;
  latencyMs: number | null;
  timestamp: string;
}

export interface PlatformResponseRouteResult {
  sent: boolean;
  platform: PlatformType;
  target: 'PLATFORM' | 'OPERATOR_QUEUE';
  reason?: string;
  responseText: string;
  commentId?: string;
  timestamp: string;
}

// ==========================================
// Phase 3C: Free Scheduled Cloud Runtime Types
// ==========================================

export type CloudRuntimeStatus =
  | 'NOT_CONFIGURED'
  | 'STARTING'
  | 'RUNNING'
  | 'STOPPING'
  | 'STOPPED'
  | 'DEGRADED'
  | 'FAILED'
  | 'UNKNOWN'
  | 'OFF';

export interface LiveSchedule {
  id: string;
  name: string;
  enabled: boolean;
  timezone: string; // IANA timezone e.g. "Asia/Jakarta"
  daysOfWeek: string[]; // ["MON","TUE","WED","THU","FRI"]
  days_of_week?: string[];
  startTime: string; // "10:00"
  start_time?: string;
  endTime: string; // "20:00"
  end_time?: string;
  grace_period_minutes?: number;
  gracePeriodMinutes?: number;
  auto_start?: boolean;
  autoStart?: boolean;
  auto_stop?: boolean;
  autoStop?: boolean;
  sessionConfigId?: string;
  createdAt: string;
  created_at?: string;
  updatedAt: string;
  updated_at?: string;
}

export type ScheduleStopReason =
  | 'SCHEDULE_END'
  | 'MANUAL_STOP'
  | 'ERROR'
  | 'PLATFORM_ERROR'
  | 'OPERATOR_STOP'
  | 'SYSTEM_SHUTDOWN';

export interface ScheduleHistory {
  id: string;
  scheduleId: string;
  sessionId: string;
  startTime: string;
  endTime: string;
  actualStartTime: string | null;
  actualEndTime: string | null;
  runtimeStatus: CloudRuntimeStatus;
  stopReason: ScheduleStopReason;
  recoveryCount: number;
  incidentCount: number;
}

export interface RuntimeLock {
  lockId: string;
  sessionId: string;
  acquiredBy: string; // instance-id or owner
  owner?: string;
  acquiredAt: string;
  acquired_at?: string;
  expiresAt: string;
  expires_at?: string;
  status?: 'ACQUIRED' | 'RELEASED' | 'EXPIRED';
}

export interface UsageTelemetry {
  runtimeStartCount: number;
  runtimeDurationSec: number;
  sessionDurationSec: number;
  estimatedComputeHours: number;
  apiCalls: number;
  geminiRequests: number;
  ttsRequests: number;
  platformRequests: number;
  isSimulated: boolean;
  billingStatus: 'USAGE_DATA_AVAILABLE' | 'USAGE_DATA_UNAVAILABLE';
}



