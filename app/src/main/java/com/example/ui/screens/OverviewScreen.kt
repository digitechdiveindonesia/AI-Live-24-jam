package com.example.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.example.data.MockLiveRepository
import com.example.model.BroadcastSession
import com.example.model.NavScreen
import com.example.model.ProductItem
import com.example.model.ScriptBlock
import com.example.ui.components.PulsingDot
import com.example.ui.theme.*

data class ActivityEvent(
    val time: String,
    val type: String,
    val description: String,
    val highlight: String? = null
)

@Composable
fun OverviewScreen(
    session: BroadcastSession,
    activeProduct: ProductItem,
    scripts: List<ScriptBlock>,
    onNavigate: (NavScreen) -> Unit,
    onPauseAi: () -> Unit,
    onTakeOver: () -> Unit,
    onRunDemo: (() -> Unit)? = null,
    modifier: Modifier = Modifier
) {
    val recentActivities = listOf(
        ActivityEvent("14:32:41", "AI ANSWER", "Answered @siti_rahma99: Verified Flash Sale 20% discount applies", "20% Promo"),
        ActivityEvent("14:32:15", "ORDER", "Checkout confirmed via TikTok Yellow Basket (#TK-8492)", "+Rp79.000"),
        ActivityEvent("14:31:40", "INTERRUPT", "Paused pitch for COD question from Shopee viewer @budisantoso88", "Resolved"),
        ActivityEvent("14:30:15", "BPOM AUDIT", "Passed safety check: Formulated without parabens confirmed", "Safe"),
        ActivityEvent("14:28:00", "PITCH START", "Started script block PROMO_03 (Flash Sale 20% Off)", "Serum X")
    )

    LazyColumn(
        modifier = modifier
            .fillMaxSize()
            .background(SurfaceCanvas)
            .padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(24.dp)
    ) {
        // 1. TOP HERO: LARGE AI HOST PREVIEW & 5 CORE METRICS
        item {
            BoxWithConstraints(modifier = Modifier.fillMaxWidth()) {
                val isWide = maxWidth >= 900.dp
                if (isWide) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(24.dp)
                    ) {
                        // Large Host Viewport
                        HostPreviewBox(
                            session = session,
                            modifier = Modifier
                                .weight(1.3f)
                                .height(380.dp)
                        )

                        // 5 Core Indicators & State
                        Column(
                            modifier = Modifier
                                .weight(1f)
                                .height(380.dp),
                            verticalArrangement = Arrangement.SpaceBetween
                        ) {
                            CoreStatsCard(session = session, activeProduct = activeProduct)
                            AiStateCard(session = session)
                        }
                    }
                } else {
                    Column(
                        modifier = Modifier.fillMaxWidth(),
                        verticalArrangement = Arrangement.spacedBy(16.dp)
                    ) {
                        HostPreviewBox(
                            session = session,
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(260.dp)
                        )
                        CoreStatsCard(session = session, activeProduct = activeProduct)
                        AiStateCard(session = session)
                    }
                }
            }
        }

        // 2. RECENT ACTIVITY (Latest 5 Events only)
        item {
            Surface(
                color = SurfaceContainerLowest,
                shape = RoundedCornerShape(8.dp),
                border = androidx.compose.foundation.BorderStroke(1.dp, BorderOutlineVariant),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier.padding(20.dp),
                    verticalArrangement = Arrangement.spacedBy(14.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "RECENT ACTIVITY",
                            color = TextPrimary,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold,
                            fontFamily = FontFamily.Monospace,
                            letterSpacing = 0.5.sp
                        )

                        if (onRunDemo != null) {
                            Button(
                                onClick = onRunDemo,
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = PrimaryCyanContainer,
                                    contentColor = PrimaryCyan
                                ),
                                shape = RoundedCornerShape(4.dp),
                                contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp),
                                modifier = Modifier.height(28.dp).testTag("simulate_customer_btn")
                            ) {
                                Icon(Icons.Default.PlayCircle, contentDescription = null, modifier = Modifier.size(12.dp))
                                Spacer(modifier = Modifier.width(4.dp))
                                Text("Simulate Interruption Flow", fontSize = 10.sp, fontWeight = FontWeight.Bold, fontFamily = FontFamily.Monospace)
                            }
                        } else {
                            Text(
                                text = "Live Stream Log",
                                color = TextTertiary,
                                fontSize = 11.sp,
                                fontFamily = FontFamily.Monospace
                            )
                        }
                    }

                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        recentActivities.forEach { event ->
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .background(SurfaceContainerLow, RoundedCornerShape(6.dp))
                                    .padding(horizontal = 14.dp, vertical = 10.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                                    modifier = Modifier.weight(1f)
                                ) {
                                    Text(
                                        text = event.time,
                                        color = TextTertiary,
                                        fontSize = 11.sp,
                                        fontFamily = FontFamily.Monospace
                                    )
                                    Text(
                                        text = event.type,
                                        color = PrimaryCyan,
                                        fontSize = 10.sp,
                                        fontWeight = FontWeight.Bold,
                                        fontFamily = FontFamily.Monospace
                                    )
                                    Text(
                                        text = event.description,
                                        color = TextPrimary,
                                        fontSize = 12.sp,
                                        maxLines = 1
                                    )
                                }

                                event.highlight?.let { hl ->
                                    Text(
                                        text = hl,
                                        color = StatusGreen,
                                        fontSize = 11.sp,
                                        fontWeight = FontWeight.SemiBold,
                                        fontFamily = FontFamily.Monospace
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun HostPreviewBox(
    session: BroadcastSession,
    modifier: Modifier = Modifier
) {
    Surface(
        color = SurfaceContainerLowest,
        shape = RoundedCornerShape(8.dp),
        border = androidx.compose.foundation.BorderStroke(1.dp, BorderOutlineVariant),
        modifier = modifier
    ) {
        Box(modifier = Modifier.fillMaxSize()) {
            AsyncImage(
                model = MockLiveRepository.PRESENTER_IMAGE_URL,
                contentDescription = "AI Host Live Camera View",
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxSize()
            )

            // Minimal gradient overlay at bottom
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .align(Alignment.BottomCenter)
                    .background(
                        androidx.compose.ui.graphics.Brush.verticalGradient(
                            colors = listOf(Color.Transparent, VoidBlack.copy(alpha = 0.85f))
                        )
                    )
                    .padding(16.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            PulsingDot(color = StatusGreen, size = 8)
                            Text(
                                text = "Sari Neural v4",
                                color = TextPrimary,
                                fontSize = 14.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                        Text(
                            text = session.liveTranscript,
                            color = TextSecondary,
                            fontSize = 12.sp,
                            maxLines = 1
                        )
                    }

                    Text(
                        text = "1080p60 • ${session.rtmpBitrate} Mbps",
                        color = TextTertiary,
                        fontSize = 11.sp,
                        fontFamily = FontFamily.Monospace
                    )
                }
            }
        }
    }
}

@Composable
private fun CoreStatsCard(
    session: BroadcastSession,
    activeProduct: ProductItem
) {
    Surface(
        color = SurfaceContainerLowest,
        shape = RoundedCornerShape(8.dp),
        border = androidx.compose.foundation.BorderStroke(1.dp, BorderOutlineVariant),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(
            modifier = Modifier.padding(18.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            Text(
                text = "LIVE SESSION STATS",
                color = TextTertiary,
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                fontFamily = FontFamily.Monospace,
                letterSpacing = 0.5.sp
            )

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                StatItem(label = "STATUS", value = if (session.isLive) "LIVE" else "OFFLINE", sub = session.duration, valueColor = if (session.isLive) AlertRed else TextTertiary)
                StatItem(label = "VIEWERS", value = "${session.viewersCount}", sub = session.viewersChange, valueColor = PrimaryCyan)
                StatItem(label = "REVENUE", value = session.gmvFormatted, sub = "${session.ordersCount} orders", valueColor = StatusGreen)
                StatItem(label = "CHAT", value = "${session.chatVelocity} /m", sub = "Velocity", valueColor = WarningYellow)
            }

            HorizontalDivider(color = BorderOutlineVariant, thickness = 0.5.dp)

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "CURRENT PRODUCT",
                    color = TextTertiary,
                    fontSize = 10.sp,
                    fontFamily = FontFamily.Monospace
                )
                Text(
                    text = "${activeProduct.title} (${activeProduct.sku})",
                    color = TextPrimary,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold
                )
            }
        }
    }
}

@Composable
private fun AiStateCard(
    session: BroadcastSession
) {
    Surface(
        color = SurfaceContainerLowest,
        shape = RoundedCornerShape(8.dp),
        border = androidx.compose.foundation.BorderStroke(1.dp, BorderOutlineVariant),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(
            modifier = Modifier.padding(18.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(
                text = "CURRENT AI STATE",
                color = TextTertiary,
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                fontFamily = FontFamily.Monospace,
                letterSpacing = 0.5.sp
            )

            // Simple visual stepper:
            // SELLING PRODUCT → Customer Question → ANSWERING → RETURNING TO SELLING
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                StatePill(label = "SELLING PRODUCT", isActive = true)
                Text("→", color = TextTertiary, fontSize = 12.sp)
                StatePill(label = "Question", isActive = false)
                Text("→", color = TextTertiary, fontSize = 12.sp)
                StatePill(label = "ANSWERING", isActive = false)
                Text("→", color = TextTertiary, fontSize = 12.sp)
                StatePill(label = "RETURN", isActive = false)
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Active Script: ${session.activeBlock}",
                    color = TextSecondary,
                    fontSize = 11.sp,
                    fontFamily = FontFamily.Monospace
                )
                Text(
                    text = "Next: ${session.nextBlock}",
                    color = PrimaryCyan,
                    fontSize = 11.sp,
                    fontFamily = FontFamily.Monospace
                )
            }
        }
    }
}

@Composable
private fun StatItem(
    label: String,
    value: String,
    sub: String,
    valueColor: Color
) {
    Column {
        Text(label, color = TextTertiary, fontSize = 10.sp, fontFamily = FontFamily.Monospace)
        Spacer(modifier = Modifier.height(2.dp))
        Text(value, color = valueColor, fontSize = 18.sp, fontWeight = FontWeight.Bold, fontFamily = FontFamily.Monospace)
        Text(sub, color = TextSecondary, fontSize = 10.sp, fontFamily = FontFamily.Monospace)
    }
}

@Composable
private fun StatePill(
    label: String,
    isActive: Boolean
) {
    Box(
        modifier = Modifier
            .background(
                if (isActive) PrimaryCyanContainer.copy(alpha = 0.4f) else SurfaceContainerHigh,
                RoundedCornerShape(4.dp)
            )
            .border(
                1.dp,
                if (isActive) PrimaryCyan else BorderOutlineVariant,
                RoundedCornerShape(4.dp)
            )
            .padding(horizontal = 8.dp, vertical = 4.dp)
    ) {
        Text(
            text = label,
            color = if (isActive) PrimaryCyan else TextTertiary,
            fontSize = 10.sp,
            fontWeight = if (isActive) FontWeight.Bold else FontWeight.Normal,
            fontFamily = FontFamily.Monospace
        )
    }
}
