-- ==============================================================================
-- AI LIVE COMMERCE - SUPABASE POSTGRESQL PRODUCTION SCHEMA
-- Authoritative schema for products, inventory, promotions, knowledge, live sessions,
-- conversations, AI interactions, and operational observability.
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------------------------
-- 1. PRODUCTS TABLE (Authoritative Product Catalog)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sku VARCHAR(64) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100) NOT NULL,
    brand VARCHAR(100) NOT NULL DEFAULT 'Sari Glow Official',
    base_price NUMERIC(12, 2) NOT NULL CHECK (base_price >= 0),
    sale_price NUMERIC(12, 2) CHECK (sale_price >= 0),
    currency VARCHAR(10) NOT NULL DEFAULT 'IDR',
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'ARCHIVED')),
    metadata JSONB NOT NULL DEFAULT '{
        "bpom_number": "",
        "image_url": "",
        "claims_approved": [],
        "claims_restricted": []
    }'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);

-- ------------------------------------------------------------------------------
-- 2. PRODUCT VARIANTS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS product_variants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    sku VARCHAR(64) UNIQUE NOT NULL,
    variant_name VARCHAR(100) NOT NULL,
    price NUMERIC(12, 2) NOT NULL CHECK (price >= 0),
    stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
    status VARCHAR(20) NOT NULL DEFAULT 'IN_STOCK' CHECK (status IN ('IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_variants_product_id ON product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_sku ON product_variants(sku);

-- ------------------------------------------------------------------------------
-- 3. INVENTORY TABLE (Authoritative Real-Time Stock)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sku VARCHAR(64) UNIQUE NOT NULL REFERENCES products(sku) ON DELETE CASCADE,
    total_stock INTEGER NOT NULL DEFAULT 0 CHECK (total_stock >= 0),
    reserved_stock INTEGER NOT NULL DEFAULT 0 CHECK (reserved_stock >= 0),
    available_stock INTEGER GENERATED ALWAYS AS (total_stock - reserved_stock) STORED,
    low_stock_threshold INTEGER NOT NULL DEFAULT 10 CHECK (low_stock_threshold >= 0),
    last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_sku ON inventory(sku);

-- ------------------------------------------------------------------------------
-- 4. PROMOTIONS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS promotions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sku VARCHAR(64) NOT NULL REFERENCES products(sku) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    discount_percent NUMERIC(5, 2) NOT NULL DEFAULT 0 CHECK (discount_percent >= 0 AND discount_percent <= 100),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    start_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    end_time TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_promotions_sku ON promotions(sku);
CREATE INDEX IF NOT EXISTS idx_promotions_active ON promotions(active);

-- ------------------------------------------------------------------------------
-- 5. PRODUCT FAQ TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS product_faq (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    sku VARCHAR(64) NOT NULL REFERENCES products(sku) ON DELETE CASCADE,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    category VARCHAR(100) NOT NULL DEFAULT 'GENERAL',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_faq_sku ON product_faq(sku);

-- ------------------------------------------------------------------------------
-- 6. KNOWLEDGE DOCUMENTS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS knowledge_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    content TEXT NOT NULL,
    version VARCHAR(50) NOT NULL DEFAULT '1.0',
    indexed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_documents_category ON knowledge_documents(category);

-- ------------------------------------------------------------------------------
-- 7. KNOWLEDGE CHUNKS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS knowledge_chunks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    doc_id UUID NOT NULL REFERENCES knowledge_documents(id) ON DELETE CASCADE,
    chunk_text TEXT NOT NULL,
    keywords TEXT[] NOT NULL DEFAULT '{}',
    confidence NUMERIC(4, 3) NOT NULL DEFAULT 1.0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_doc_id ON knowledge_chunks(doc_id);

-- ------------------------------------------------------------------------------
-- 8. KNOWLEDGE RULES TABLE (Approved/Restricted Claims, Brand Policies)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS knowledge_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rule_type VARCHAR(50) NOT NULL CHECK (rule_type IN ('APPROVED_CLAIM', 'RESTRICTED_CLAIM', 'BRAND_POLICY')),
    pattern TEXT NOT NULL,
    replacement TEXT,
    reason TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_rules_type ON knowledge_rules(rule_type);

-- ------------------------------------------------------------------------------
-- 9. LIVE SESSIONS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS live_sessions (
    id VARCHAR(64) PRIMARY KEY, -- e.g. LIVE-001 or UUID
    session_code VARCHAR(100) UNIQUE NOT NULL,
    title VARCHAR(255) NOT NULL,
    platform VARCHAR(50) NOT NULL DEFAULT 'Dual' CHECK (platform IN ('TikTok', 'Shopee', 'Dual')),
    status VARCHAR(30) NOT NULL DEFAULT 'CREATED' CHECK (status IN (
        'CREATED', 'STARTING', 'CONNECTING', 'RUNNING', 'PAUSED',
        'DEGRADED', 'RECONNECTING', 'STOPPING', 'STOPPED', 'FAILED', 'LIVE', 'STANDBY', 'ENDED'
    )),
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    current_product_id VARCHAR(64) DEFAULT 'prod-001',
    current_host_state VARCHAR(50) DEFAULT 'INTRO',
    current_script_id VARCHAR(64) DEFAULT 'script-001',
    current_script_block_id VARCHAR(64) DEFAULT 'sb-1',
    active_conversation_count INTEGER NOT NULL DEFAULT 0,
    platform_status VARCHAR(50) NOT NULL DEFAULT 'INITIALIZING',
    last_heartbeat_at TIMESTAMPTZ,
    last_successful_event_at TIMESTAMPTZ,
    degraded_since TIMESTAMPTZ,
    degraded_mode VARCHAR(50) DEFAULT 'NONE',
    is_ai_host_on BOOLEAN NOT NULL DEFAULT FALSE,
    is_paused BOOLEAN NOT NULL DEFAULT FALSE,
    is_muted BOOLEAN NOT NULL DEFAULT FALSE,
    is_mic_takeover BOOLEAN NOT NULL DEFAULT FALSE,
    current_sku VARCHAR(64) DEFAULT 'SKU-001',
    active_state VARCHAR(50) DEFAULT 'INTRO',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_live_sessions_status ON live_sessions(status);

-- ------------------------------------------------------------------------------
-- 10. LIVE PRODUCTS TABLE (Products featured in specific session)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS live_products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id VARCHAR(64) NOT NULL REFERENCES live_sessions(id) ON DELETE CASCADE,
    sku VARCHAR(64) NOT NULL REFERENCES products(sku) ON DELETE CASCADE,
    order_index INTEGER NOT NULL DEFAULT 0,
    is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_live_products_session_id ON live_products(session_id);

-- ------------------------------------------------------------------------------
-- 11. SELLING SCRIPTS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS selling_scripts (
    id VARCHAR(64) PRIMARY KEY,
    sku VARCHAR(64) NOT NULL REFERENCES products(sku) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    target_duration_sec INTEGER NOT NULL DEFAULT 120,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 12. SCRIPT BLOCKS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS script_blocks (
    id VARCHAR(64) PRIMARY KEY,
    script_id VARCHAR(64) NOT NULL REFERENCES selling_scripts(id) ON DELETE CASCADE,
    step_name VARCHAR(50) NOT NULL CHECK (step_name IN ('HOOK', 'PROBLEM', 'SOLUTION', 'DEMO', 'PROMO', 'CTA')),
    content TEXT NOT NULL,
    duration_sec INTEGER NOT NULL DEFAULT 20,
    is_active BOOLEAN NOT NULL DEFAULT FALSE,
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_script_blocks_script_id ON script_blocks(script_id);

-- ------------------------------------------------------------------------------
-- 13. CUSTOMER CONVERSATIONS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customer_conversations (
    conversation_id VARCHAR(64) PRIMARY KEY,
    session_id VARCHAR(64) NOT NULL REFERENCES live_sessions(id) ON DELETE CASCADE,
    customer_id VARCHAR(100) NOT NULL,
    customer_name VARCHAR(255) NOT NULL,
    handle VARCHAR(100) NOT NULL,
    platform VARCHAR(50) NOT NULL DEFAULT 'TikTok',
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN (
        'ACTIVE', 'WAITING', 'ESCALATED', 'RESOLVED', 'HUMAN_TAKEOVER'
    ))
);

CREATE INDEX IF NOT EXISTS idx_conversations_session_id ON customer_conversations(session_id);
CREATE INDEX IF NOT EXISTS idx_conversations_status ON customer_conversations(status);

-- ------------------------------------------------------------------------------
-- 14. CUSTOMER MESSAGES TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customer_messages (
    message_id VARCHAR(64) PRIMARY KEY,
    conversation_id VARCHAR(64) NOT NULL REFERENCES customer_conversations(conversation_id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('CUSTOMER', 'AI', 'OPERATOR', 'SYSTEM')),
    content TEXT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_customer_messages_conversation ON customer_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_customer_messages_timestamp ON customer_messages(timestamp);

-- ------------------------------------------------------------------------------
-- 15. AI INTERACTIONS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ai_interactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id VARCHAR(64) REFERENCES customer_messages(message_id) ON DELETE SET NULL,
    intent VARCHAR(100) NOT NULL,
    matched_sku VARCHAR(64) REFERENCES products(sku) ON DELETE SET NULL,
    verified_facts JSONB NOT NULL DEFAULT '{}'::jsonb,
    guardrail_status VARCHAR(20) NOT NULL CHECK (guardrail_status IN ('APPROVED', 'MODIFIED', 'BLOCKED')),
    generated_response TEXT NOT NULL,
    response_time_ms INTEGER NOT NULL DEFAULT 0,
    host_state_before VARCHAR(50),
    host_state_after VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_interactions_sku ON ai_interactions(matched_sku);

-- ------------------------------------------------------------------------------
-- 16. HOST EVENTS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS host_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id VARCHAR(64) REFERENCES live_sessions(id) ON DELETE CASCADE,
    event_type VARCHAR(100) NOT NULL,
    state_from VARCHAR(50),
    state_to VARCHAR(50),
    trigger VARCHAR(100),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_host_events_session ON host_events(session_id);

-- ------------------------------------------------------------------------------
-- 17. SYSTEM EVENTS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS system_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_name VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('HEALTHY', 'DEGRADED', 'DOWN')),
    latency_ms INTEGER NOT NULL DEFAULT 0,
    details TEXT,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_events_service ON system_events(service_name);

-- ------------------------------------------------------------------------------
-- 18. AUDIT LOGS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    action VARCHAR(100) NOT NULL,
    operator VARCHAR(100) NOT NULL DEFAULT 'SYSTEM',
    target VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'SUCCESS',
    details TEXT,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);

-- ------------------------------------------------------------------------------
-- 19. SYNC CONFLICTS TABLE (Phase 3D.2 - Conflict Resolution & Safety)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sync_conflicts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    platform VARCHAR(50) NOT NULL CHECK (platform IN ('TIKTOK', 'SHOPEE', 'OTHER')),
    entity_type VARCHAR(50) NOT NULL CHECK (entity_type IN ('PRODUCT', 'VARIANT', 'INVENTORY', 'PROMOTION')),
    entity_id VARCHAR(100) NOT NULL,
    external_id VARCHAR(100) NOT NULL,
    conflict_type VARCHAR(50) NOT NULL CHECK (conflict_type IN (
        'INVENTORY_CONFLICT', 'PRICE_CONFLICT', 'PROMOTION_CONFLICT',
        'PRODUCT_MAPPING_CONFLICT', 'VARIANT_MAPPING_CONFLICT',
        'EXTERNAL_PRODUCT_MISSING', 'LOCAL_PRODUCT_MISSING', 'UNKNOWN_CONFLICT'
    )),
    local_value JSONB NOT NULL DEFAULT '{}'::jsonb,
    external_value JSONB NOT NULL DEFAULT '{}'::jsonb,
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'RESOLVED', 'IGNORED', 'FAILED')),
    resolution VARCHAR(50) CHECK (resolution IN ('LOCAL_AUTHORITATIVE', 'EXTERNAL_OVERWRITE', 'MANUAL_VALUE')),
    resolved_by VARCHAR(100),
    resolved_at TIMESTAMPTZ,
    fingerprint VARCHAR(255) NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sync_conflicts_platform ON sync_conflicts(platform);
CREATE INDEX IF NOT EXISTS idx_sync_conflicts_status ON sync_conflicts(status);
CREATE INDEX IF NOT EXISTS idx_sync_conflicts_fingerprint ON sync_conflicts(fingerprint);
CREATE INDEX IF NOT EXISTS idx_sync_conflicts_entity ON sync_conflicts(entity_id);

-- ------------------------------------------------------------------------------
-- 20. EXTERNAL PRODUCT MAPPINGS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS external_product_mappings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id VARCHAR(100) NOT NULL,
    variant_id VARCHAR(100),
    platform VARCHAR(50) NOT NULL CHECK (platform IN ('TIKTOK', 'SHOPEE', 'OTHER')),
    external_product_id VARCHAR(100) NOT NULL,
    external_variant_id VARCHAR(100),
    external_sku VARCHAR(100) NOT NULL,
    last_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ext_mappings_platform ON external_product_mappings(platform);
CREATE INDEX IF NOT EXISTS idx_ext_mappings_external_sku ON external_product_mappings(external_sku);
CREATE INDEX IF NOT EXISTS idx_ext_mappings_product_id ON external_product_mappings(product_id);

-- ------------------------------------------------------------------------------
-- 21. SYNC RUNS TABLE (Observability & Audit)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sync_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    platform VARCHAR(50) NOT NULL,
    mode VARCHAR(50) NOT NULL CHECK (mode IN ('MANUAL', 'SCHEDULED', 'WEBHOOK_TRIGGERED')),
    status VARCHAR(50) NOT NULL CHECK (status IN ('IN_PROGRESS', 'COMPLETED', 'FAILED', 'PARTIAL')),
    is_simulated BOOLEAN NOT NULL DEFAULT TRUE,
    records_examined INTEGER NOT NULL DEFAULT 0,
    conflicts_detected INTEGER NOT NULL DEFAULT 0,
    conflicts_created INTEGER NOT NULL DEFAULT 0,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    duration_ms INTEGER,
    errors JSONB DEFAULT '[]'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_sync_runs_platform ON sync_runs(platform);
CREATE INDEX IF NOT EXISTS idx_sync_runs_started_at ON sync_runs(started_at);

-- ------------------------------------------------------------------------------
-- 22. PLATFORM CONNECTIONS TABLE (Phase 3D.3 - Real Platform Auth & Token Lifecycle)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS platform_connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    platform VARCHAR(50) NOT NULL CHECK (platform IN ('TIKTOK', 'SHOPEE', 'OTHER')),
    account_type VARCHAR(50) NOT NULL DEFAULT 'SELLER',
    external_account_id VARCHAR(100),
    external_shop_id VARCHAR(100),
    external_merchant_id VARCHAR(100),
    display_name VARCHAR(255),
    region VARCHAR(20) DEFAULT 'ID',
    status VARCHAR(50) NOT NULL DEFAULT 'NOT_CONFIGURED' CHECK (status IN (
        'NOT_CONFIGURED', 'AUTHORIZATION_REQUIRED', 'AUTHORIZING', 'CONNECTED',
        'TOKEN_EXPIRING', 'REFRESHING', 'REQUIRES_REAUTH', 'DEGRADED', 'ERROR', 'DISCONNECTED',
        'CONNECTING', 'UNKNOWN'
    )),
    scopes JSONB NOT NULL DEFAULT '[]'::jsonb,
    capabilities JSONB NOT NULL DEFAULT '{}'::jsonb,
    access_token_encrypted TEXT,
    refresh_token_encrypted TEXT,
    access_token_expires_at TIMESTAMPTZ,
    refresh_token_expires_at TIMESTAMPTZ,
    last_verified_at TIMESTAMPTZ,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_conn_platform ON platform_connections(platform);
CREATE INDEX IF NOT EXISTS idx_platform_conn_status ON platform_connections(status);

-- ------------------------------------------------------------------------------
-- 23. LIVE SCHEDULES TABLE (Phase 3D.4 - Scheduled Cloud Execution)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS live_schedules (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    timezone VARCHAR(100) NOT NULL DEFAULT 'Asia/Jakarta',
    days_of_week JSONB NOT NULL DEFAULT '["MON","TUE","WED","THU","FRI"]'::jsonb,
    start_time VARCHAR(10) NOT NULL,
    end_time VARCHAR(10) NOT NULL,
    grace_period_minutes INTEGER NOT NULL DEFAULT 5,
    auto_start BOOLEAN NOT NULL DEFAULT TRUE,
    auto_stop BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_live_schedules_enabled ON live_schedules(enabled);
CREATE INDEX IF NOT EXISTS idx_live_schedules_timezone ON live_schedules(timezone);

-- ------------------------------------------------------------------------------
-- 24. RUNTIME LOCKS TABLE (Phase 3D.4 - Distributed Cloud Runtime Locking)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS runtime_locks (
    lock_id VARCHAR(100) PRIMARY KEY,
    session_id VARCHAR(100) NOT NULL,
    owner VARCHAR(255) NOT NULL,
    acquired_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'ACQUIRED' CHECK (status IN ('ACQUIRED', 'RELEASED', 'EXPIRED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_runtime_locks_session ON runtime_locks(session_id);
CREATE INDEX IF NOT EXISTS idx_runtime_locks_status ON runtime_locks(status);
CREATE INDEX IF NOT EXISTS idx_runtime_locks_expires ON runtime_locks(expires_at);

-- ------------------------------------------------------------------------------
-- 25. SCHEDULE HISTORY TABLE (Phase 3D.4 - Cloud Execution Auditing)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS schedule_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    schedule_id VARCHAR(100),
    session_id VARCHAR(100),
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    actual_start_time TIMESTAMPTZ,
    actual_end_time TIMESTAMPTZ,
    runtime_status VARCHAR(50),
    stop_reason VARCHAR(50),
    recovery_count INTEGER DEFAULT 0,
    incident_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_schedule_history_schedule ON schedule_history(schedule_id);
CREATE INDEX IF NOT EXISTS idx_schedule_history_session ON schedule_history(session_id);


