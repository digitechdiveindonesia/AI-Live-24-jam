package com.example.model

enum class NavScreen(val label: String, val badge: String? = null) {
    OVERVIEW("Overview"),
    LIVE_CONTROL("Live Control", "LIVE"),
    LIVE_CHAT("Live Chat", "14"),
    PRODUCTS("Products", "128"),
    AI_HOST("AI Host", "ACTIVE"),
    KNOWLEDGE("Knowledge"),
    PLATFORM("Platform", "2"),
    ANALYTICS("Analytics"),
    SYSTEM("System", "HEALTHY")
}

data class BroadcastSession(
    val id: String = "LIVE-001",
    val duration: String = "02:14:37",
    val isLive: Boolean = true,
    val isAiHostOn: Boolean = true,
    val tiktokConnected: Boolean = true,
    val shopeeConnected: Boolean = true,
    val latencyMs: Int = 42,
    val rtmpBitrate: Double = 5.8,
    val fps: Int = 30,
    val lipSyncAccuracy: Double = 99.4,
    val viewersCount: Int = 1284,
    val viewersChange: String = "+8.2%",
    val chatVelocity: Int = 42,
    val totalQuestions: Int = 187,
    val aiSolved: Int = 176,
    val flaggedEscalations: Int = 11,
    val basketClicks: Int = 324,
    val conversionRate: String = "14.8%",
    val ordersCount: Int = 48,
    val gmvFormatted: String = "Rp3.792.000",
    val activeState: String = "SELLING",
    val activeBlock: String = "PROMO_03",
    val nextBlock: String = "CTA_01",
    val activeSku: String = "Serum X (SKU-001)",
    val activeSpeaker: String = "Indonesian Natural Female (Sari Neural v4)",
    val liveTranscript: String = "Sedang menjelaskan promo Serum X: \"Dapatkan diskon 20% khusus checkout keranjang kuning sekarang juga ya kak!\"",
    val isMuted: Boolean = false,
    val isPaused: Boolean = false,
    val isMicTakeover: Boolean = false
)

data class ProductVariant(
    val name: String,
    val stock: Int,
    val colorHex: Long? = null
)

data class SyncConflict(
    val internalStock: Int,
    val shopeeStock: Int,
    val safeFloor: Int
)

data class ProductItem(
    val id: String,
    val sku: String,
    val title: String,
    val brand: String,
    val category: String,
    val basePrice: Long,
    val strikePrice: Long? = null,
    val promoBadge: String? = null,
    val totalStock: Int,
    val isLowStock: Boolean = false,
    val isOutOfStock: Boolean = false,
    val isOnAir: Boolean = false,
    val variants: List<ProductVariant>,
    val bpomNumber: String,
    val imageUrl: String,
    val syncStatus: String = "SYNCED",
    val conflict: SyncConflict? = null
)

enum class ScriptStatus {
    DONE, ACTIVE, UPCOMING
}

data class ScriptBlock(
    val id: String,
    val code: String,
    val title: String,
    val durationText: String,
    val status: ScriptStatus,
    val currentProgress: Float = 0f,
    val timeLabel: String = ""
)

data class LiveChatMessage(
    val id: String,
    val author: String,
    val handle: String,
    val platform: String, // TikTok, Shopee
    val time: String,
    val message: String,
    val aiResponse: String? = null,
    val intentTag: String? = null,
    val intentConfidence: Int? = null,
    val isFlagged: Boolean = false,
    val isAudited: Boolean = true,
    val spokenLiveSeconds: Double? = null
)

data class KnowledgeDoc(
    val id: String,
    val title: String,
    val type: String, // Product, FAQ, Voice, Logistics, Safety
    val sku: String,
    val chunksCount: Int,
    val tokensCount: Int,
    val statusText: String,
    val timeAgo: String,
    val isEnforced: Boolean = false
)

data class SystemServiceNode(
    val name: String,
    val category: String,
    val status: String, // HEALTHY, STREAMING, CONNECTED, UNKNOWN
    val latency: String,
    val metric1: String,
    val metric2: String,
    val note: String
)

data class IncidentLog(
    val id: String,
    val timestamp: String,
    val service: String,
    val description: String,
    val severity: String,
    val resolution: String
)
