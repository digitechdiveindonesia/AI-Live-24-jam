package com.example.data

import com.example.model.*

object MockLiveRepository {

    const val PRESENTER_IMAGE_URL =
        "https://lh3.googleusercontent.com/aida-public/AB6AXuBYEjJrsnmP-cZBMjI7qgFgVGRoikegmah7CKYNAXuaxixm-_NtU7zS9f-brDTvekYQtJHyxSVnR935pDvEnAUWRSt9qhVrrCHNQvvfmUzZzlP1WEOUqfZHGfbPHfTWAikD9yNoDM-OF-7UeLxzUMS8CVanpttLzV16IJ5LO-wRUepqwzGK-0znl1EngocVL3BLqvZGv_siMmJzEbkD45ig745ID9rQ7ApBti2xSbfmBGhHXcHp7Al4Fw"

    const val PROFILE_AVATAR_URL =
        "https://lh3.googleusercontent.com/aida-public/AB6AXuBUlnECE7CypptQNKIuBVZKPD3y9WByAiS3IuMbBnGMcBWLcMjh0_nNU0VnWOQ1fvIwac-EqgAv-rNXX5io56MFJ6SP1Lp9h1OPCG-MqMinsT4L1i3qxJq7-kIVmfLk75TIHVAdLDno5wsJl3Tw1_qEmeQa4NbC8WOcZ5gL8wdV8HljxAqMcM0y9ccV9cV2uUUmt3ZBOnO9vNWonovvXWBTxm1cpClNWcDFRBpi6qEhupaloz4ETF-zZg"

    const val LOGO_URL =
        "https://lh3.googleusercontent.com/aida/AEtjO1XikYR5S2Fk_z6xe70ewSEYQm6uew1uw2DYqEMCwpqYMOvR0Y7gm7kZ6xExgKXR12ArUJwx-aaeiPa_Uu8UEQlhu3JpzXH51VD4RfR_FzBW3zJeGdqMPnET_R0xUuADjriL_wfin26mY8VY8havorD2M3XemuXtoLPQh0NqKprL1iRlLiyTaten1_N_EMTG8PxbHCJKp5pGeVZN2ZOhdHaU1O4JQSWLQNLlBVlOle4LiXlxGpRfANYvIOb4"

    val initialSession = BroadcastSession()

    val initialProducts = listOf(
        ProductItem(
            id = "prod-1",
            sku = "SKU-001",
            title = "Serum X — Brightening Booster",
            brand = "Lumin Skin",
            category = "Skincare / Face Care Routine",
            basePrice = 79000L,
            strikePrice = 99000L,
            promoBadge = "20% FLASH",
            totalStock = 23,
            isLowStock = true,
            isOnAir = true,
            variants = listOf(
                ProductVariant("Black Edition (30ml)", 4, 0xFF1E293B),
                ProductVariant("White Glow (30ml)", 12, 0xFFFFFFFF),
                ProductVariant("Pink Rose (30ml)", 7, 0xFFF472B6)
            ),
            bpomNumber = "NA18211900123",
            imageUrl = "https://lh3.googleusercontent.com/aida-public/AB6AXuCUc8AXOhR2rmfROEAUpEITjIehWwpEr4lcN9Ap0eWSAS2haMK8rRcuZxHKa7bs2eqtbDuig0KN34j5G5zghpWE6Zjz23DhGGM2zkw5icVORK9Cj6M2jpStLaRto6fh4qVDRjcQFcJrYQHm6M8R6KBu7ZB1ZTK_KxhLq69SGlZDPvFO0CtK7AXzlyJw1KmvAqJRItpxQDUcHhE2b9mMjUb84QHxohAXxqyMOYwEAwbPVurSPBoam4fXDg"
        ),
        ProductItem(
            id = "prod-2",
            sku = "SKU-002",
            title = "Glow Facial Cleanser",
            brand = "Pure Botanicals",
            category = "Daily Cleanser / Face Wash",
            basePrice = 59000L,
            strikePrice = 69000L,
            promoBadge = "10% OFF",
            totalStock = 8,
            isLowStock = true,
            variants = listOf(
                ProductVariant("100ml", 5),
                ProductVariant("200ml", 3)
            ),
            bpomNumber = "NA18211200451",
            imageUrl = "https://lh3.googleusercontent.com/aida-public/AB6AXuB-o4JifdDAAwe6rjnk3T-hgBejNssyLUNrlR9802wncqPr76tGW3YgA_LsjhYbNRnaTP5OpLZnSA3KHBGzRbXU05swVG27M-Qc12jNpHo_8f5aCcLwU_HbgqnfInKvONtb1jfTUgSX_ueB2cDAs7h9PqYTe_jEviyhNaR1ydEovR2FePFFfYgZert3_ml_rT7XFCMuChg6UJkyeuoRT71I8W-0IVx1oFi0D78cJigHmz_xKsP6cSRFjA"
        ),
        ProductItem(
            id = "prod-3",
            sku = "SKU-003",
            title = "Hydra Barrier Cream",
            brand = "Derma Shield",
            category = "Moisturizer / Barrier Repair",
            basePrice = 89000L,
            totalStock = 0,
            isOutOfStock = true,
            variants = listOf(
                ProductVariant("30g", 0),
                ProductVariant("50g", 0),
                ProductVariant("100g", 0)
            ),
            bpomNumber = "NA18210103289",
            imageUrl = "https://lh3.googleusercontent.com/aida-public/AB6AXuBboMGuLO4iUfT3o4FwbIDvdvq1avJoY7Mp-PFmFtYpHTlCmKSC_3fIOgXqsS79-LzXTh5vTxvh5MyCk11NWTYJXHQ68_yOw7CHza6YXH0wp0sYowl-rTVhuol2_2vXg0yd3hIdNAg3tTgoOX-YfOjlJZfDk3t08B2-JFKvxJLKJzgIhSJBiLRcmpyS-GhndV7y63KtvVH5mn_LgiZrZJLXvWqTHQGNwaDlI3juuMpws0xzKlLffYg93g"
        ),
        ProductItem(
            id = "prod-4",
            sku = "SKU-004",
            title = "Vitamin C Antioxidant Serum",
            brand = "Lumin Skin",
            category = "Brightening / Dark Spots",
            basePrice = 109000L,
            strikePrice = 129000L,
            promoBadge = "15% OFF",
            totalStock = 6,
            isLowStock = true,
            variants = listOf(
                ProductVariant("15ml", 2),
                ProductVariant("30ml", 4)
            ),
            bpomNumber = "NA18221900892",
            imageUrl = "https://lh3.googleusercontent.com/aida-public/AB6AXuDsK5AFgL49uvY4AGQvkVZa2LXQuTsBHxjTr50MuxHCIgGHGLcAVneYyiL_M8AgEt1HZY3wbY6BlV8zT5smXJB2CU6xLChulfgnO8OH8L4OPS7J__17i_9BuZLcbXlH9dsSoBd90OSvdH3jwMrgXBSecAGR6LSRwYrqsdhrEtprQ__BcjGu8WSAyPFZu85N26b5HOHdMcTEYhxsYIDK5twV2SZhvtMKYnAK8JkBfrWvTkIK5qQh2B2PwA",
            syncStatus = "DELTA",
            conflict = SyncConflict(internalStock = 8, shopeeStock = 6, safeFloor = 6)
        ),
        ProductItem(
            id = "prod-5",
            sku = "SKU-005",
            title = "Sunscreen SPF 50 PA++++",
            brand = "UV Shield Guard",
            category = "Sun Protection / Day Care",
            basePrice = 65000L,
            strikePrice = 75000L,
            promoBadge = "5% BUNDLE",
            totalStock = 142,
            variants = listOf(
                ProductVariant("50ml", 90),
                ProductVariant("100ml", 52)
            ),
            bpomNumber = "NA18221700140",
            imageUrl = "https://lh3.googleusercontent.com/aida-public/AB6AXuCUc8AXOhR2rmfROEAUpEITjIehWwpEr4lcN9Ap0eWSAS2haMK8rRcuZxHKa7bs2eqtbDuig0KN34j5G5zghpWE6Zjz23DhGGM2zkw5icVORK9Cj6M2jpStLaRto6fh4qVDRjcQFcJrYQHm6M8R6KBu7ZB1ZTK_KxhLq69SGlZDPvFO0CtK7AXzlyJw1KmvAqJRItpxQDUcHhE2b9mMjUb84QHxohAXxqyMOYwEAwbPVurSPBoam4fXDg"
        )
    )

    val initialScriptQueue = listOf(
        ScriptBlock("sb-1", "INTRO_01", "Warm Welcome & Stream Kickoff", "02:00", ScriptStatus.DONE, 1f, "Done (02:00:12)"),
        ScriptBlock("sb-2", "PRODUCT_INTRO_01", "Serum X Origin & Active Formula", "02:45", ScriptStatus.DONE, 1f, "Done (02:04:45)"),
        ScriptBlock("sb-3", "BENEFIT_01", "Brightening Active Booster Highlights", "02:10", ScriptStatus.DONE, 1f, "Done (02:09:10)"),
        ScriptBlock("sb-4", "PROMO_03", "Flash Sale 20% Off Limited Window", "01:20", ScriptStatus.ACTIVE, 0.65f, "00:45 / 01:20"),
        ScriptBlock("sb-5", "CTA_01", "Keranjang Kuning Direct Urgency", "01:10", ScriptStatus.UPCOMING, 0f, "Upcoming (Est 01:10)"),
        ScriptBlock("sb-6", "FAQ_TEASER_01", "Sensitive Skin & BPOM Certification", "00:50", ScriptStatus.UPCOMING, 0f, "Upcoming"),
        ScriptBlock("sb-7", "PRODUCT_TRANSITION_01", "Transition to Glow Facial Cleanser", "00:40", ScriptStatus.UPCOMING, 0f, "Upcoming")
    )

    val initialChatMessages = listOf(
        LiveChatMessage(
            id = "chat-1",
            author = "Siti Rahma",
            handle = "@siti_rahma99",
            platform = "TikTok",
            time = "14:32:05",
            message = "Kak warna hitam ukuran L masih ada?",
            aiResponse = "Ada kak, untuk warna hitam ukuran L saat ini stoknya masih tersedia tinggal 4 pcs ya kak!",
            intentTag = "STOCK_CHECK",
            intentConfidence = 98,
            isAudited = true,
            spokenLiveSeconds = 1.4
        ),
        LiveChatMessage(
            id = "chat-2",
            author = "Siti Rahma",
            handle = "@siti_rahma99",
            platform = "TikTok",
            time = "14:32:41",
            message = "Kalau ambil 2 ada promo tambahan gak kak?",
            aiResponse = "Saat ini promo yang sedang aktif adalah diskon Flash Sale 20% untuk Serum X ya kak! Untuk pembelian 2 pcs belum ada voucher bundling tambahan yang tercatat di sistem kami, namun kakak otomatis klaim gratis ongkir ekstra saat checkout sekarang di keranjang kuning!",
            intentTag = "PROMO_CHECK",
            intentConfidence = 96,
            isAudited = true,
            spokenLiveSeconds = 1.8
        ),
        LiveChatMessage(
            id = "chat-3",
            author = "Budi Santoso",
            handle = "@budisantoso88",
            platform = "Shopee",
            time = "14:31:40",
            message = "Promonya sampai jam berapa kak? Bisa COD?",
            aiResponse = "Promo flash sale 20% ini berlaku sampai live berakhir jam 16.00 kak, dan bisa COD ya!",
            intentTag = "PROMO & COD",
            intentConfidence = 95,
            isAudited = true,
            spokenLiveSeconds = 1.6
        ),
        LiveChatMessage(
            id = "chat-4",
            author = "Dewi Lestari",
            handle = "@dewi_skincare",
            platform = "TikTok",
            time = "14:30:15",
            message = "Aman untuk kulit sensitif dan ibu menyusui ga kak?",
            aiResponse = "Aman banget kak Dewi! Sudah terdaftar BPOM dan formulanya dermatologically tested tanpa paraben.",
            intentTag = "SAFETY_BPOM",
            intentConfidence = 99,
            isAudited = true,
            spokenLiveSeconds = 1.9
        ),
        LiveChatMessage(
            id = "chat-5",
            author = "Rina Putri",
            handle = "@rinaputri_id",
            platform = "Shopee",
            time = "14:29:51",
            message = "Barangnya bisa dikirim hari ini? Mau urgent kak buat besok pagi.",
            intentTag = "SHIPPING_URGENT",
            intentConfidence = 88,
            isFlagged = true,
            isAudited = false
        ),
        LiveChatMessage(
            id = "chat-6",
            author = "Agus Pratama",
            handle = "@agus_p",
            platform = "TikTok",
            time = "14:28:12",
            message = "Kak kalau kulit aku sensitif berjerawat parah aman gak ya? Bisa sembuh?",
            aiResponse = "Formula Serum X lembut dan water-based kak Agus, sudah lolos uji dermatologi. Namun jika ada kondisi medis khusus, kami sarankan konsultasi terlebih dahulu dengan dokter ya kak.",
            intentTag = "BPOM_SAFETY",
            intentConfidence = 97,
            isAudited = true
        )
    )

    val initialKnowledgeSources = listOf(
        KnowledgeDoc("doc-1", "Serum X Product Guide v3.2", "Product", "SKU-001", 8, 1240, "Active Live", "Today 08:42", true),
        KnowledgeDoc("doc-2", "FAQ — Serum X Live Commerce", "FAQ", "SKU-001", 12, 1850, "Verified", "Today 08:38", true),
        KnowledgeDoc("doc-3", "Brand Guidelines 2026", "Voice", "Global", 48, 6200, "Verified", "Yesterday", false),
        KnowledgeDoc("doc-4", "Shipping & Logistics Policy", "Logistics", "All SKUs", 21, 3100, "Verified", "2 days ago", false),
        KnowledgeDoc("doc-5", "BPOM & Medical Restrictions", "Safety", "Guardrail", 16, 2400, "Enforced", "Permanent", true),
        KnowledgeDoc("doc-6", "Glow Facial Cleanser Primer", "Product", "SKU-002", 6, 890, "Verified", "3 days ago", false)
    )

    val initialSystemServices = listOf(
        SystemServiceNode("API SERVER", "Gateway", "HEALTHY", "24ms", "Heartbeat 1s", "Uptime 99.98%", "Fastify Node v20"),
        SystemServiceNode("AI ENGINE", "Neural Core", "CONNECTED", "1.2s", "12,482 Reqs", "48.2 tok/s", "Gemini 1.5 Pro"),
        SystemServiceNode("AI HOST ENGINE", "Orchestrator", "SELLING LOOP", "0.4s", "Return 98.2%", "41 Cycles", "Pitching SKU-001"),
        SystemServiceNode("TTS SERVICE", "Audio Voice", "ACTIVE", "340ms", "Cache 72%", "Realtime 28%", "ID Female 01"),
        SystemServiceNode("AVATAR ENGINE", "WebRTC Render", "STREAMING", "180ms", "30 FPS", "0 Drops", "LipSync 99.4%"),
        SystemServiceNode("STREAM ENCODER", "Video HW", "STABLE", "2.0s", "1080p60", "6,200 kbps", "NVENC Dual Pipe"),
        SystemServiceNode("POSTGRESQL", "Database", "HEALTHY", "18ms", "Pool 24/100", "42.4 GB", "Replication Synced"),
        SystemServiceNode("REDIS / EVENT BUS", "Queues", "HEALTHY", "2ms", "Queue 12 msgs", "48 ev/s", "Cluster 3 Nodes"),
        SystemServiceNode("VECTOR / RAG", "Knowledge", "READY", "82ms", "1,842 Chunks", "0 Errors", "text-embedding-3"),
        SystemServiceNode("SHOPEE ADAPTER", "E-Commerce", "HEALTHY", "112ms", "Live Stream OK", "Synced", "OpenPlatform ID"),
        SystemServiceNode("TIKTOK ADAPTER", "E-Commerce", "UNKNOWN", "N/A", "Catalog Synced", "Live Pending", "Whitelist Req"),
        SystemServiceNode("CHAT WORKER", "Audience Ingest", "ACTIVE", "38ms", "42 msgs/min", "Spam 99.4%", "Zero Stalls")
    )

    val initialIncidents = listOf(
        IncidentLog("inc-1", "14:02:12", "STREAM_WATCHDOG", "RTMP Heartbeat 4.1s packet gap detected", "LOW", "Fallback RTMP route engaged, 0 viewers dropped"),
        IncidentLog("inc-2", "11:45:04", "TTS_SYNTH", "Voice provider 504 gateway timeout", "LOW", "Switched to pre-cached sales audio (0ms jitter)"),
        IncidentLog("inc-3", "09:12:40", "SHOPEE_ADAPTER", "Webhook retry #2 ack received", "INFO", "Idempotent payload accepted and verified"),
        IncidentLog("inc-4", "08:31:05", "PRODUCT_SYNC", "Product SKU-004 Stock Discrepancy (8 vs 6)", "ATTENTION", "Clamped to safe 6 units floor across live pitches")
    )
}
