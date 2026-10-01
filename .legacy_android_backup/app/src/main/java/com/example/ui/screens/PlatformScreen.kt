package com.example.ui.screens

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.ui.components.PulsingDot
import com.example.ui.theme.*

@Composable
fun PlatformScreen(
    onRefresh: () -> Unit,
    onTestConnection: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    var showTiktokDetails by remember { mutableStateOf(false) }
    var showShopeeDetails by remember { mutableStateOf(false) }

    LazyColumn(
        modifier = modifier
            .fillMaxSize()
            .background(SurfaceCanvas)
            .padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(20.dp)
    ) {
        // HEADER
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(
                        text = "PLATFORM INTEGRATIONS",
                        color = TextPrimary,
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold,
                        fontFamily = FontFamily.Monospace,
                        letterSpacing = (-0.5).sp
                    )
                    Text(
                        text = "Real-time sync adapters for TikTok Shop and Shopee Live",
                        color = TextSecondary,
                        fontSize = 12.sp
                    )
                }

                Button(
                    onClick = onRefresh,
                    colors = ButtonDefaults.buttonColors(containerColor = SurfaceContainerHigh, contentColor = TextPrimary),
                    shape = RoundedCornerShape(6.dp),
                    contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp),
                    modifier = Modifier.height(34.dp)
                ) {
                    Icon(Icons.Default.Refresh, contentDescription = null, modifier = Modifier.size(14.dp))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("Refresh Status", fontSize = 11.sp, fontFamily = FontFamily.Monospace)
                }
            }
        }

        // PLATFORM CARDS
        item {
            BoxWithConstraints(modifier = Modifier.fillMaxWidth()) {
                val isWide = maxWidth >= 860.dp

                if (isWide) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(20.dp)
                    ) {
                        SimplePlatformCard(
                            platformName = "TikTok Shop",
                            brandColor = StatusBlue,
                            isConnected = true,
                            isLive = true,
                            chatActive = true,
                            productSync = "Synced (128 SKUs)",
                            inventorySync = "Realtime Webhook",
                            showDetails = showTiktokDetails,
                            onToggleDetails = { showTiktokDetails = !showTiktokDetails },
                            onTestPing = { onTestConnection("TikTok") },
                            modifier = Modifier.weight(1f)
                        )

                        SimplePlatformCard(
                            platformName = "Shopee Live",
                            brandColor = WarningYellow,
                            isConnected = true,
                            isLive = true,
                            chatActive = true,
                            productSync = "Synced (128 SKUs)",
                            inventorySync = "Realtime Webhook",
                            showDetails = showShopeeDetails,
                            onToggleDetails = { showShopeeDetails = !showShopeeDetails },
                            onTestPing = { onTestConnection("Shopee") },
                            modifier = Modifier.weight(1f)
                        )
                    }
                } else {
                    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                        SimplePlatformCard(
                            platformName = "TikTok Shop",
                            brandColor = StatusBlue,
                            isConnected = true,
                            isLive = true,
                            chatActive = true,
                            productSync = "Synced (128 SKUs)",
                            inventorySync = "Realtime Webhook",
                            showDetails = showTiktokDetails,
                            onToggleDetails = { showTiktokDetails = !showTiktokDetails },
                            onTestPing = { onTestConnection("TikTok") },
                            modifier = Modifier.fillMaxWidth()
                        )

                        SimplePlatformCard(
                            platformName = "Shopee Live",
                            brandColor = WarningYellow,
                            isConnected = true,
                            isLive = true,
                            chatActive = true,
                            productSync = "Synced (128 SKUs)",
                            inventorySync = "Realtime Webhook",
                            showDetails = showShopeeDetails,
                            onToggleDetails = { showShopeeDetails = !showShopeeDetails },
                            onTestPing = { onTestConnection("Shopee") },
                            modifier = Modifier.fillMaxWidth()
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun SimplePlatformCard(
    platformName: String,
    brandColor: Color,
    isConnected: Boolean,
    isLive: Boolean,
    chatActive: Boolean,
    productSync: String,
    inventorySync: String,
    showDetails: Boolean,
    onToggleDetails: () -> Unit,
    onTestPing: () -> Unit,
    modifier: Modifier = Modifier
) {
    Surface(
        color = SurfaceContainerLowest,
        shape = RoundedCornerShape(8.dp),
        border = androidx.compose.foundation.BorderStroke(1.dp, BorderOutlineVariant),
        modifier = modifier
    ) {
        Column(
            modifier = Modifier.padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Header
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Box(modifier = Modifier.size(10.dp).clip(CircleShape).background(brandColor))
                    Text(platformName, color = TextPrimary, fontSize = 15.sp, fontWeight = FontWeight.Bold)
                }

                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    modifier = Modifier
                        .background(SurfaceContainerLow, RoundedCornerShape(4.dp))
                        .padding(horizontal = 8.dp, vertical = 4.dp)
                ) {
                    PulsingDot(color = StatusGreen, size = 6)
                    Text("ONLINE", color = StatusGreen, fontSize = 10.sp, fontWeight = FontWeight.Bold, fontFamily = FontFamily.Monospace)
                }
            }

            Divider(color = BorderOutlineVariant, thickness = 0.5.dp)

            // 5 Required Status Rows
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                PlatformStatusRow("Connection", if (isConnected) "Connected" else "Disconnected", if (isConnected) StatusGreen else AlertRed)
                PlatformStatusRow("Live Stream", if (isLive) "Broadcasting (1080p60)" else "Inactive", if (isLive) StatusGreen else TextTertiary)
                PlatformStatusRow("Live Chat", if (chatActive) "Ingestion Active" else "Paused", if (chatActive) StatusGreen else TextTertiary)
                PlatformStatusRow("Product Sync", productSync, TextSecondary)
                PlatformStatusRow("Inventory Sync", inventorySync, TextSecondary)
            }

            // Collapsible Technical Diagnostics
            AnimatedVisibility(visible = showDetails) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(SurfaceContainerLow, RoundedCornerShape(6.dp))
                        .padding(10.dp),
                    verticalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    Text("API DIAGNOSTICS", color = TextTertiary, fontSize = 9.sp, fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold)
                    Text("Adapter: OpenPlatform v2.4 (OAuth 2.0)", color = TextSecondary, fontSize = 10.sp, fontFamily = FontFamily.Monospace)
                    Text("RTMP Endpoint: rtmp://live.channel.id/app/stream", color = TextSecondary, fontSize = 10.sp, fontFamily = FontFamily.Monospace)
                    Text("Webhook Latency: 38ms (0 dropped events)", color = StatusGreen, fontSize = 10.sp, fontFamily = FontFamily.Monospace)
                }
            }

            // Bottom Actions
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                TextButton(
                    onClick = onToggleDetails,
                    contentPadding = PaddingValues(0.dp)
                ) {
                    Text(
                        text = if (showDetails) "Hide Technical Details ▲" else "View Details ▼",
                        color = PrimaryCyan,
                        fontSize = 11.sp,
                        fontFamily = FontFamily.Monospace
                    )
                }

                Button(
                    onClick = onTestPing,
                    colors = ButtonDefaults.buttonColors(containerColor = SurfaceContainerHigh, contentColor = TextPrimary),
                    shape = RoundedCornerShape(4.dp),
                    contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp),
                    modifier = Modifier.height(28.dp)
                ) {
                    Text("Test Ping", fontSize = 10.sp, fontFamily = FontFamily.Monospace)
                }
            }
        }
    }
}

@Composable
private fun PlatformStatusRow(label: String, value: String, valueColor: Color) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(label, color = TextTertiary, fontSize = 11.sp, fontFamily = FontFamily.Monospace)
        Text(value, color = valueColor, fontSize = 11.sp, fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Medium)
    }
}
