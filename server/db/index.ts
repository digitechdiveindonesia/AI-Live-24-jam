import {
  Product,
  ProductVariant,
  Inventory,
  Promotion,
  ProductFaq,
  KnowledgeDocument,
  KnowledgeRule,
  LiveSession,
  SellingScript,
  ScriptBlock,
  CustomerMessage,
  CustomerConversation,
  ConversationMessage,
  QueuedQuestion,
  ConversationRole,
  ConversationStatus,
  MessagePriority,
  QuestionStatus,
  AiInteraction,
  HostEvent,
  SystemEvent,
  AuditLog,
  AvatarSession,
  SpeechResumeContext,
  VoiceTelemetry,
  SyncConflict,
  SyncConflictType,
  SyncConflictStatus,
  SyncResolutionType,
  ExternalProductMapping,
  SyncRun,
  PlatformType,
  PlatformConnection,
  LiveSchedule,
  ScheduleHistory,
  RuntimeLock,
  UsageTelemetry
} from './schema';
import {
  SEED_PRODUCTS,
  SEED_VARIANTS,
  SEED_INVENTORY,
  SEED_PROMOTIONS,
  SEED_FAQS,
  SEED_DOCUMENTS,
  SEED_RULES,
  SEED_SESSION,
  SEED_SCRIPTS,
  SEED_SCRIPT_BLOCKS,
  SEED_CHAT_MESSAGES
} from './seed';

export class LiveCommerceDatabase {
  private static instance: LiveCommerceDatabase;

  public products: Product[] = [...SEED_PRODUCTS];
  public variants: ProductVariant[] = [...SEED_VARIANTS];
  public inventory: Inventory[] = [...SEED_INVENTORY];
  public promotions: Promotion[] = [...SEED_PROMOTIONS];
  public faqs: ProductFaq[] = [...SEED_FAQS];
  public documents: KnowledgeDocument[] = [...SEED_DOCUMENTS];
  public rules: KnowledgeRule[] = [...SEED_RULES];
  public session: LiveSession = { ...SEED_SESSION };
  public scripts: SellingScript[] = [...SEED_SCRIPTS];
  public scriptBlocks: ScriptBlock[] = [...SEED_SCRIPT_BLOCKS];
  public chatMessages: CustomerMessage[] = [...SEED_CHAT_MESSAGES];
  public conversations: CustomerConversation[] = [
    {
      conversation_id: 'conv-001',
      session_id: 'LIVE-001',
      customer_id: 'cust-rina',
      customer_name: 'Rina Sasmita',
      handle: '@rina_beauty',
      platform: 'TikTok',
      started_at: new Date(Date.now() - 300000).toISOString(),
      last_message_at: new Date(Date.now() - 60000).toISOString(),
      status: 'ACTIVE'
    },
    {
      conversation_id: 'conv-002',
      session_id: 'LIVE-001',
      customer_id: 'cust-budi',
      customer_name: 'Budi Santoso',
      handle: '@budisantoso88',
      platform: 'Shopee',
      started_at: new Date(Date.now() - 200000).toISOString(),
      last_message_at: new Date(Date.now() - 50000).toISOString(),
      status: 'RESOLVED'
    }
  ];
  public conversationMessages: ConversationMessage[] = [
    {
      message_id: 'cmsg-001',
      conversation_id: 'conv-001',
      role: 'CUSTOMER',
      content: 'Kak ini harganya berapa dan promonya sampai jam berapa ya?',
      timestamp: new Date(Date.now() - 60000).toISOString(),
      metadata: { intent: 'PRICE_QUESTION', priority: 'NORMAL', productId: 'SKU-001' }
    },
    {
      message_id: 'cmsg-002',
      conversation_id: 'conv-001',
      role: 'AI',
      content: 'Halo Kak Rina! Serum X Brightening Booster khusus promo live ini diskon 20%, dari Rp99.000 jadi Rp79.000 aja sampai live berakhir kak!',
      timestamp: new Date(Date.now() - 58000).toISOString(),
      metadata: { intent: 'PRICE_QUESTION', latencyMs: 380, guardrailStatus: 'APPROVED' }
    }
  ];
  public queuedQuestions: QueuedQuestion[] = [];
  public aiInteractions: AiInteraction[] = [];
  public hostEvents: HostEvent[] = [];
  public systemEvents: SystemEvent[] = [];
  public auditLogs: AuditLog[] = [];
  public avatarSession: AvatarSession | null = {
    sessionId: 'LIVE-001',
    provider: 'MOCK',
    avatarId: 'avatar-sari-01',
    voiceId: 'id-ID-SariLiveNeural',
    state: 'READY',
    currentAudioId: null,
    startedAt: new Date().toISOString(),
    lastActivityAt: new Date().toISOString(),
    metadata: { isSimulated: true, displayName: 'Sari Host Avatar' }
  };
  public speechResumeContext: SpeechResumeContext | null = null;
  public voiceTelemetries: VoiceTelemetry[] = [];
  public syncConflicts: SyncConflict[] = [
    {
      id: 'conflict-init-01',
      platform: 'TIKTOK',
      entity_type: 'INVENTORY',
      entity_id: 'SKU-001',
      external_id: 'tt-prod-001',
      conflict_type: 'INVENTORY_CONFLICT',
      local_value: { available_stock: 23, total_stock: 25, reserved_stock: 2 },
      external_value: { stock: 25 },
      status: 'RESOLVED',
      resolution: 'LOCAL_AUTHORITATIVE',
      resolved_by: 'OPERATOR',
      resolved_at: new Date(Date.now() - 3500000).toISOString(),
      fingerprint: 'TIKTOK:INVENTORY:SKU-001:INVENTORY_CONFLICT:23:25',
      notes: 'Internal stock (23) authoritative over platform buffer.',
      created_at: new Date(Date.now() - 3600000).toISOString(),
      updated_at: new Date(Date.now() - 3500000).toISOString(),
      sku: 'SKU-001',
      conflictType: 'INVENTORY_MISMATCH',
      internalValue: { availableStock: 23, totalStock: 25 },
      platformValue: { availableStock: 25, totalStock: 25 },
      detectedAt: new Date(Date.now() - 3600000).toISOString()
    }
  ];
  public externalMappings: ExternalProductMapping[] = [
    {
      id: 'map-tt-001',
      product_id: 'prod-001',
      variant_id: null,
      platform: 'TIKTOK',
      external_product_id: 'tt-prod-001',
      external_variant_id: null,
      external_sku: 'SKU-001',
      last_synced_at: new Date(Date.now() - 3600000).toISOString(),
      metadata: { platform: 'TIKTOK', mapped_by: 'SYSTEM' },
      created_at: new Date(Date.now() - 7200000).toISOString(),
      updated_at: new Date(Date.now() - 3600000).toISOString()
    },
    {
      id: 'map-sp-001',
      product_id: 'prod-001',
      variant_id: null,
      platform: 'SHOPEE',
      external_product_id: 'sp-prod-001',
      external_variant_id: null,
      external_sku: 'SKU-001',
      last_synced_at: new Date(Date.now() - 3600000).toISOString(),
      metadata: { platform: 'SHOPEE', mapped_by: 'SYSTEM' },
      created_at: new Date(Date.now() - 7200000).toISOString(),
      updated_at: new Date(Date.now() - 3600000).toISOString()
    },
    {
      id: 'map-tt-002',
      product_id: 'prod-002',
      variant_id: null,
      platform: 'TIKTOK',
      external_product_id: 'tt-prod-002',
      external_variant_id: null,
      external_sku: 'SKU-002',
      last_synced_at: new Date(Date.now() - 3600000).toISOString(),
      metadata: { platform: 'TIKTOK', mapped_by: 'SYSTEM' },
      created_at: new Date(Date.now() - 7200000).toISOString(),
      updated_at: new Date(Date.now() - 3600000).toISOString()
    }
  ];
  public syncRuns: SyncRun[] = [];
  public schedules: LiveSchedule[] = [
    {
      id: 'sched-daily-01',
      name: 'Daily AI Live',
      enabled: true,
      timezone: 'Asia/Jakarta',
      daysOfWeek: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
      startTime: '10:00',
      endTime: '20:00',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];
  public scheduleHistory: ScheduleHistory[] = [];
  public runtimeLock: RuntimeLock | null = null;
  public usageTelemetry: UsageTelemetry = {
    runtimeStartCount: 1,
    runtimeDurationSec: 7200,
    sessionDurationSec: 7200,
    estimatedComputeHours: 2.0,
    apiCalls: 48,
    geminiRequests: 18,
    ttsRequests: 24,
    platformRequests: 6,
    isSimulated: true,
    billingStatus: 'USAGE_DATA_AVAILABLE'
  };

  private constructor() {
    this.logAudit('INIT_DATABASE', 'SYSTEM', 'All commerce tables initialized and seeded with Indonesian catalog');
  }

  public static getInstance(): LiveCommerceDatabase {
    if (!LiveCommerceDatabase.instance) {
      LiveCommerceDatabase.instance = new LiveCommerceDatabase();
    }
    return LiveCommerceDatabase.instance;
  }

  // Authoritative Product Queries
  public getProductBySku(sku: string): Product | undefined {
    return this.products.find(p => p.sku.toLowerCase() === sku.toLowerCase());
  }

  public getProductById(id: string): Product | undefined {
    return this.products.find(p => p.id === id);
  }

  public getAllProducts(): Product[] {
    return [...this.products];
  }

  public getVariantsForProduct(productId: string): ProductVariant[] {
    return this.variants.filter(v => v.product_id === productId);
  }

  public getInventory(sku: string): Inventory | undefined {
    return this.inventory.find(i => i.sku.toLowerCase() === sku.toLowerCase());
  }

  public getActivePromotion(sku: string): Promotion | undefined {
    return this.promotions.find(p => p.sku.toLowerCase() === sku.toLowerCase() && p.active);
  }

  public getFaqsForSku(sku: string): ProductFaq[] {
    return this.faqs.filter(f => f.sku.toLowerCase() === sku.toLowerCase());
  }

  public updateStock(sku: string, newStock: number): void {
    const inv = this.getInventory(sku);
    if (inv) {
      inv.total_stock = newStock;
      inv.available_stock = Math.max(0, newStock - inv.reserved_stock);
      inv.last_updated = new Date().toISOString();
      this.logAudit('UPDATE_STOCK', 'OPERATOR', `${sku} stock adjusted to ${newStock}`);
    } else {
      const newInv: Inventory = {
        sku,
        total_stock: newStock,
        reserved_stock: 0,
        available_stock: newStock,
        low_stock_threshold: 10,
        last_updated: new Date().toISOString()
      };
      this.inventory.push(newInv);
      this.logAudit('UPDATE_STOCK', 'OPERATOR', `${sku} initialized with stock ${newStock}`);
    }
  }

  public getAuditLogs(): AuditLog[] {
    return [...this.auditLogs];
  }

  public logAudit(action: string, operator: string, target: string, status: string = 'SUCCESS'): void {
    this.auditLogs.unshift({
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      action,
      operator,
      target,
      status,
      timestamp: new Date().toISOString()
    });
  }

  public logHostEvent(session_id: string, event_type: string, state_from: string, state_to: string, trigger: string): void {
    this.hostEvents.unshift({
      id: `hevent-${Date.now()}`,
      session_id,
      event_type,
      state_from,
      state_to,
      trigger,
      timestamp: new Date().toISOString()
    });
  }

  public logSystemEvent(service_name: string, status: 'HEALTHY' | 'DEGRADED' | 'DOWN', details: string, latency_ms: number = 0): void {
    this.systemEvents.unshift({
      id: `sys-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      service_name,
      status,
      latency_ms,
      details,
      timestamp: new Date().toISOString()
    });
  }

  public updateLiveSession(updates: Partial<LiveSession>): LiveSession {
    this.session = {
      ...this.session,
      ...updates,
      updated_at: new Date().toISOString()
    };
    return this.session;
  }

  public resetLiveSession(custom: Partial<LiveSession> = {}): LiveSession {
    const now = new Date().toISOString();
    const newSessionCode = custom.session_code || `LIVE-${Date.now().toString(36).toUpperCase()}`;
    this.session = {
      id: custom.id || `live-${Date.now()}`,
      session_code: newSessionCode,
      title: custom.title || 'Live Streaming Broadcast',
      platform: custom.platform || 'Dual',
      status: custom.status || 'CREATED',
      started_at: custom.started_at || null,
      ended_at: null,
      current_product_id: custom.current_product_id || 'prod-001',
      current_host_state: custom.current_host_state || 'INTRO',
      current_script_id: custom.current_script_id || 'script-001',
      current_script_block_id: custom.current_script_block_id || 'sb-1',
      active_conversation_count: 0,
      platform_status: 'INITIALIZING',
      last_heartbeat_at: null,
      last_successful_event_at: now,
      degraded_since: null,
      degraded_mode: 'NONE',
      created_at: now,
      updated_at: now,
      is_ai_host_on: custom.is_ai_host_on ?? false,
      is_paused: custom.is_paused ?? false,
      is_muted: custom.is_muted ?? false,
      is_mic_takeover: custom.is_mic_takeover ?? false,
      current_sku: custom.current_sku || 'SKU-001',
      active_state: custom.active_state || 'INTRO'
    };
    return this.session;
  }

  // Customer Conversation Management
  public getOrCreateConversation(
    sessionId: string,
    customerId: string,
    customerName: string = 'Viewer',
    handle: string = '@viewer',
    platform: string = 'TikTok'
  ): CustomerConversation {
    let conv = this.conversations.find(
      c => c.session_id === sessionId && c.customer_id === customerId && c.status !== 'RESOLVED'
    );
    if (!conv) {
      conv = {
        conversation_id: `conv-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        session_id: sessionId,
        customer_id: customerId,
        customer_name: customerName,
        handle,
        platform,
        started_at: new Date().toISOString(),
        last_message_at: new Date().toISOString(),
        status: 'ACTIVE'
      };
      this.conversations.unshift(conv);
    } else {
      conv.last_message_at = new Date().toISOString();
      if (customerName && customerName !== 'Viewer') conv.customer_name = customerName;
      if (handle && handle !== '@viewer') conv.handle = handle;
    }
    return conv;
  }

  public getConversationById(conversationId: string): CustomerConversation | undefined {
    return this.conversations.find(c => c.conversation_id === conversationId);
  }

  public updateConversationStatus(conversationId: string, status: ConversationStatus): void {
    const conv = this.getConversationById(conversationId);
    if (conv) {
      conv.status = status;
      conv.last_message_at = new Date().toISOString();
      this.logAudit('CONVERSATION_STATUS', 'SYSTEM', `Conv ${conversationId} status set to ${status}`);
    }
  }

  public addConversationMessage(
    conversationId: string,
    role: ConversationRole,
    content: string,
    metadata?: Record<string, any>
  ): ConversationMessage {
    const msg: ConversationMessage = {
      message_id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      conversation_id: conversationId,
      role,
      content,
      timestamp: new Date().toISOString(),
      metadata
    };
    this.conversationMessages.unshift(msg);

    const conv = this.getConversationById(conversationId);
    if (conv) {
      conv.last_message_at = msg.timestamp;
      if (role === 'CUSTOMER' && conv.status === 'RESOLVED') {
        conv.status = 'ACTIVE';
      }
    }

    return msg;
  }

  public getRecentConversationMessages(conversationId: string, limit: number = 6): ConversationMessage[] {
    return this.conversationMessages
      .filter(m => m.conversation_id === conversationId)
      .slice(0, limit)
      .reverse(); // chronological order
  }

  // Sync Conflict Management
  public addSyncConflict(conflict: Partial<SyncConflict>): SyncConflict {
    const platform = conflict.platform || 'TIKTOK';
    const entityType = conflict.entity_type || 'INVENTORY';
    const entityId = conflict.entity_id || conflict.sku || 'UNKNOWN';
    const externalId = conflict.external_id || 'UNKNOWN';
    const conflictType = (conflict.conflict_type || conflict.conflictType || 'UNKNOWN_CONFLICT') as SyncConflictType;
    const localVal = conflict.local_value || conflict.internalValue || {};
    const extVal = conflict.external_value || conflict.platformValue || {};

    const fingerprint = conflict.fingerprint || `${platform}:${entityType}:${entityId}:${conflictType}:${JSON.stringify(localVal)}:${JSON.stringify(extVal)}`;

    // Idempotency: Check if an OPEN conflict with the same fingerprint already exists
    const existing = this.syncConflicts.find(c => c.fingerprint === fingerprint && (c.status === 'OPEN' || c.status as any === 'OPEN'));
    if (existing) {
      return existing;
    }

    const now = new Date().toISOString();
    const newConflict: SyncConflict = {
      id: conflict.id || `conflict-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      platform,
      entity_type: entityType as any,
      entity_id: entityId,
      external_id: externalId,
      conflict_type: conflictType,
      local_value: localVal,
      external_value: extVal,
      status: conflict.status || 'OPEN',
      resolution: conflict.resolution || null,
      resolved_by: conflict.resolved_by || null,
      resolved_at: conflict.resolved_at || null,
      fingerprint,
      notes: conflict.notes || null,
      created_at: conflict.created_at || now,
      updated_at: conflict.updated_at || now,
      sku: entityId,
      conflictType: String(conflictType),
      internalValue: localVal,
      platformValue: extVal,
      detectedAt: now
    };

    this.syncConflicts.unshift(newConflict);
    this.logAudit('SYNC_CONFLICT_DETECTED', 'SYSTEM', `Conflict on ${entityId} (${platform}): ${conflictType}`);
    return newConflict;
  }

  public getSyncConflicts(status?: string): SyncConflict[] {
    if (!status) return [...this.syncConflicts];
    return this.syncConflicts.filter(c => c.status === status);
  }

  public getSyncConflictById(id: string): SyncConflict | undefined {
    return this.syncConflicts.find(c => c.id === id);
  }

  public resolveSyncConflict(
    conflictId: string,
    resolution: SyncResolutionType | 'RESOLVED_INTERNAL' | 'RESOLVED_MANUAL',
    resolvedBy: string = 'OPERATOR',
    notes?: string
  ): SyncConflict | undefined {
    const conflict = this.syncConflicts.find(c => c.id === conflictId);
    if (conflict) {
      const now = new Date().toISOString();
      let resType: SyncResolutionType = 'LOCAL_AUTHORITATIVE';
      let status: SyncConflictStatus = 'RESOLVED';

      if (resolution === 'EXTERNAL_OVERWRITE') {
        resType = 'EXTERNAL_OVERWRITE';
        status = 'RESOLVED';
      } else if (resolution === 'MANUAL_VALUE') {
        resType = 'MANUAL_VALUE';
        status = 'RESOLVED';
      } else if (resolution === 'RESOLVED_MANUAL') {
        resType = 'MANUAL_VALUE';
        status = 'RESOLVED_MANUAL';
      } else if (resolution === 'RESOLVED_INTERNAL') {
        resType = 'LOCAL_AUTHORITATIVE';
        status = 'RESOLVED_INTERNAL';
      } else if (resolution === 'LOCAL_AUTHORITATIVE') {
        resType = 'LOCAL_AUTHORITATIVE';
        status = 'RESOLVED';
      }

      conflict.status = status;
      conflict.resolution = resType;
      conflict.resolved_by = resolvedBy;
      conflict.resolved_at = now;
      conflict.updated_at = now;
      if (notes) conflict.notes = notes;
      this.logAudit('SYNC_CONFLICT_RESOLVED', resolvedBy, `Conflict ${conflictId} resolved via ${resType}`);
    }
    return conflict;
  }

  // External Product Mapping Methods
  public getExternalMappings(filter?: { platform?: PlatformType; productId?: string; externalSku?: string }): ExternalProductMapping[] {
    let result = [...this.externalMappings];
    if (filter?.platform) result = result.filter(m => m.platform === filter.platform);
    if (filter?.productId) result = result.filter(m => m.product_id === filter.productId);
    if (filter?.externalSku) result = result.filter(m => m.external_sku === filter.externalSku);
    return result;
  }

  public getExternalMappingBySku(platform: PlatformType, sku: string): ExternalProductMapping | undefined {
    return this.externalMappings.find(m => m.platform === platform && (m.external_sku === sku || m.product_id === sku));
  }

  public saveExternalMapping(mapping: Omit<ExternalProductMapping, 'id' | 'created_at' | 'updated_at'> & { id?: string }): ExternalProductMapping {
    const now = new Date().toISOString();
    const existingIndex = this.externalMappings.findIndex(
      m => m.platform === mapping.platform && (m.external_product_id === mapping.external_product_id || m.external_sku === mapping.external_sku)
    );

    if (existingIndex >= 0) {
      const updated: ExternalProductMapping = {
        ...this.externalMappings[existingIndex],
        ...mapping,
        updated_at: now
      };
      this.externalMappings[existingIndex] = updated;
      return updated;
    }

    const newMapping: ExternalProductMapping = {
      id: mapping.id || `map-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      product_id: mapping.product_id,
      variant_id: mapping.variant_id || null,
      platform: mapping.platform,
      external_product_id: mapping.external_product_id,
      external_variant_id: mapping.external_variant_id || null,
      external_sku: mapping.external_sku,
      last_synced_at: mapping.last_synced_at || now,
      metadata: mapping.metadata || {},
      created_at: now,
      updated_at: now
    };
    this.externalMappings.push(newMapping);
    return newMapping;
  }

  // Sync Run Records (Observability)
  public recordSyncRun(run: Omit<SyncRun, 'id' | 'started_at'> & { id?: string }): SyncRun {
    const newRun: SyncRun = {
      id: run.id || `sync-run-${Date.now()}`,
      started_at: new Date().toISOString(),
      ...run
    };
    this.syncRuns.unshift(newRun);
    if (this.syncRuns.length > 100) this.syncRuns.pop();
    return newRun;
  }

  public getSyncRuns(platform?: PlatformType): SyncRun[] {
    if (!platform) return [...this.syncRuns];
    return this.syncRuns.filter(r => r.platform === platform);
  }


  // Schedule Management Methods
  public getSchedules(): LiveSchedule[] {
    return [...this.schedules];
  }

  public getScheduleById(id: string): LiveSchedule | undefined {
    return this.schedules.find(s => s.id === id);
  }

  public saveSchedule(schedule: LiveSchedule): LiveSchedule {
    const idx = this.schedules.findIndex(s => s.id === schedule.id);
    if (idx >= 0) {
      this.schedules[idx] = { ...schedule, updatedAt: new Date().toISOString() };
    } else {
      this.schedules.push({ ...schedule, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    }
    this.logAudit('SCHEDULE_SAVED', 'OPERATOR', `Schedule ${schedule.id} (${schedule.name}) saved`);
    return schedule;
  }

  public deleteSchedule(id: string): boolean {
    const initLen = this.schedules.length;
    this.schedules = this.schedules.filter(s => s.id !== id);
    if (this.schedules.length < initLen) {
      this.logAudit('SCHEDULE_DELETED', 'OPERATOR', `Schedule ${id} deleted`);
      return true;
    }
    return false;
  }

  // Schedule History
  public recordScheduleHistory(entry: ScheduleHistory): void {
    this.scheduleHistory.unshift(entry);
    if (this.scheduleHistory.length > 50) {
      this.scheduleHistory.pop();
    }
  }

  public getScheduleHistory(): ScheduleHistory[] {
    return [...this.scheduleHistory];
  }

  // Runtime Distributed Lock (Single Instance Enforcement)
  public acquireRuntimeLock(sessionId: string, instanceId: string, ttlMs: number = 300000): boolean {
    const now = Date.now();
    if (this.runtimeLock) {
      const lockExpiry = new Date(this.runtimeLock.expiresAt || this.runtimeLock.expires_at || 0).getTime();
      if (now < lockExpiry && (this.runtimeLock.acquiredBy !== instanceId && this.runtimeLock.owner !== instanceId)) {
        // Locked by another active instance
        return false;
      }
      if (now >= lockExpiry && this.runtimeLock.status !== 'RELEASED') {
        this.logAudit('EXPIRED_LOCK_RECOVERED', 'SYSTEM', `Recovered expired lock for session ${sessionId} previously owned by ${this.runtimeLock.owner || this.runtimeLock.acquiredBy}`);
      }
    }

    const acquiredAt = new Date(now).toISOString();
    const expiresAt = new Date(now + ttlMs).toISOString();

    this.runtimeLock = {
      lockId: `lock-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      sessionId,
      acquiredBy: instanceId,
      owner: instanceId,
      acquiredAt,
      acquired_at: acquiredAt,
      expiresAt,
      expires_at: expiresAt,
      status: 'ACQUIRED'
    };
    this.logAudit('RUNTIME_LOCK_ACQUIRED', 'SYSTEM', `Lock for session ${sessionId} acquired by ${instanceId}`);
    return true;
  }

  public releaseRuntimeLock(sessionId: string, instanceId: string): boolean {
    if (this.runtimeLock && (this.runtimeLock.sessionId === sessionId || this.runtimeLock.acquiredBy === instanceId || this.runtimeLock.owner === instanceId)) {
      this.runtimeLock.status = 'RELEASED';
      const prevOwner = this.runtimeLock.owner || this.runtimeLock.acquiredBy;
      this.runtimeLock = null;
      this.logAudit('RUNTIME_LOCK_RELEASED', 'SYSTEM', `Lock for session ${sessionId} released by ${prevOwner}`);
      return true;
    }
    return false;
  }

  public recoverExpiredLock(sessionId?: string): boolean {
    if (!this.runtimeLock) return false;
    const now = Date.now();
    const lockExpiry = new Date(this.runtimeLock.expiresAt || this.runtimeLock.expires_at || 0).getTime();
    if (now >= lockExpiry) {
      const prev = this.runtimeLock;
      this.runtimeLock = null;
      this.logAudit('EXPIRED_LOCK_RECOVERED', 'SYSTEM', `Explicitly recovered expired lock for session ${sessionId || prev.sessionId}`);
      return true;
    }
    return false;
  }

  public isRuntimeLocked(sessionId: string): boolean {
    if (!this.runtimeLock) return false;
    if (this.runtimeLock.sessionId !== sessionId) return false;
    if (this.runtimeLock.status === 'RELEASED') return false;
    return Date.now() < new Date(this.runtimeLock.expiresAt || this.runtimeLock.expires_at || 0).getTime();
  }

  // Telemetry Recording
  public recordUsage(updates: Partial<UsageTelemetry>): UsageTelemetry {
    this.usageTelemetry = {
      ...this.usageTelemetry,
      ...updates,
      runtimeDurationSec: (this.usageTelemetry.runtimeDurationSec || 0) + (updates.runtimeDurationSec || 0),
      sessionDurationSec: (this.usageTelemetry.sessionDurationSec || 0) + (updates.sessionDurationSec || 0),
      apiCalls: (this.usageTelemetry.apiCalls || 0) + (updates.apiCalls || 0),
      geminiRequests: (this.usageTelemetry.geminiRequests || 0) + (updates.geminiRequests || 0),
      ttsRequests: (this.usageTelemetry.ttsRequests || 0) + (updates.ttsRequests || 0),
      platformRequests: (this.usageTelemetry.platformRequests || 0) + (updates.platformRequests || 0)
    };
    this.usageTelemetry.estimatedComputeHours = Number((this.usageTelemetry.runtimeDurationSec / 3600).toFixed(2));
    return this.usageTelemetry;
  }
}

export const db = LiveCommerceDatabase.getInstance();

