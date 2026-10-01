package com.example.ui.screens

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
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
import com.example.model.BroadcastSession
import com.example.model.ProductItem
import com.example.ui.theme.*

@Composable
fun AnalyticsScreen(
    session: BroadcastSession,
    products: List<ProductItem>,
    onExportReport: () -> Unit,
    modifier: Modifier = Modifier
) {
    var showAdvancedBreakdown by remember { mutableStateOf(false) }

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
                        text = "SESSION ANALYTICS",
                        color = TextPrimary,
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold,
                        fontFamily = FontFamily.Monospace,
                        letterSpacing = (-0.5).sp
                    )
                    Text(
                        text = "Live revenue, audience conversion, and AI response efficacy",
                        color = TextSecondary,
                        fontSize = 12.sp
                    )
                }

                Button(
                    onClick = onExportReport,
                    colors = ButtonDefaults.buttonColors(containerColor = SurfaceContainerHigh, contentColor = TextPrimary),
                    shape = RoundedCornerShape(6.dp),
                    contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp),
                    modifier = Modifier.height(34.dp).testTag("export_analytics_btn")
                ) {
                    Icon(Icons.Default.FileDownload, contentDescription = null, modifier = Modifier.size(14.dp))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("Export Report", fontSize = 11.sp, fontFamily = FontFamily.Monospace)
                }
            }
        }

        // 6 PRIMARY METRICS ONLY
        item {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    AnalyticsMetricBox("GMV REVENUE", session.gmvFormatted, "+24.6% vs prev", StatusGreen, Modifier.weight(1f))
                    AnalyticsMetricBox("CONFIRMED ORDERS", "${session.ordersCount} orders", "Avg Rp79k", PrimaryCyan, Modifier.weight(1f))
                    AnalyticsMetricBox("CONCURRENT VIEWERS", "${session.viewersCount}", session.viewersChange, TextPrimary, Modifier.weight(1f))
                }
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    AnalyticsMetricBox("CHAT MESSAGES", "${session.chatVelocity} /min", "420 total", WarningYellow, Modifier.weight(1f))
                    AnalyticsMetricBox("CONVERSION RATE", session.conversionRate, "Basket to Order", AccentViolet, Modifier.weight(1f))
                    AnalyticsMetricBox("AI RESPONSE RATE", "94.1%", "176 of 187 solved", StatusGreen, Modifier.weight(1f))
                }
            }
        }

        // SIMPLE CHARTS: CHANNEL REVENUE ATTRIBUTION
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
                            text = "CHANNEL REVENUE SPLIT",
                            color = TextPrimary,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold,
                            fontFamily = FontFamily.Monospace,
                            letterSpacing = 0.5.sp
                        )
                        Text(
                            text = "TikTok Shop (62%) • Shopee Live (38%)",
                            color = TextSecondary,
                            fontSize = 11.sp,
                            fontFamily = FontFamily.Monospace
                        )
                    }

                    // Clean comparative bar
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(12.dp)
                            .clip(RoundedCornerShape(6.dp))
                            .background(SurfaceContainerHigh)
                    ) {
                        Box(
                            modifier = Modifier
                                .fillMaxHeight()
                                .weight(0.62f)
                                .background(StatusBlue)
                        )
                        Box(
                            modifier = Modifier
                                .fillMaxHeight()
                                .weight(0.38f)
                                .background(WarningYellow)
                        )
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text("TikTok: Rp2.350.000 (31 orders)", color = StatusBlue, fontSize = 11.sp, fontFamily = FontFamily.Monospace)
                        Text("Shopee: Rp1.442.000 (17 orders)", color = WarningYellow, fontSize = 11.sp, fontFamily = FontFamily.Monospace)
                    }
                }
            }
        }

        // ADVANCED ANALYTICS (Expandable section)
        item {
            Surface(
                color = SurfaceContainerLowest,
                shape = RoundedCornerShape(8.dp),
                border = androidx.compose.foundation.BorderStroke(1.dp, BorderOutlineVariant),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { showAdvancedBreakdown = !showAdvancedBreakdown },
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "ADVANCED SKU SALES & ATTRIBUTION",
                            color = TextTertiary,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            fontFamily = FontFamily.Monospace
                        )
                        Text(
                            text = if (showAdvancedBreakdown) "Collapse ▲" else "Expand Details ▼",
                            color = PrimaryCyan,
                            fontSize = 11.sp,
                            fontFamily = FontFamily.Monospace
                        )
                    }

                    AnimatedVisibility(visible = showAdvancedBreakdown) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(top = 8.dp),
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            products.forEach { prod ->
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .background(SurfaceContainerLow, RoundedCornerShape(4.dp))
                                        .padding(horizontal = 12.dp, vertical = 8.dp),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Column {
                                        Text(prod.title, color = TextPrimary, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                                        Text("${prod.sku} • Stock: ${prod.totalStock} units", color = TextTertiary, fontSize = 10.sp, fontFamily = FontFamily.Monospace)
                                    }

                                    Text(
                                        text = if (prod.sku == "SKU-001") "34 sold (Rp2.686.000)" else "4 sold (Rp396.000)",
                                        color = StatusGreen,
                                        fontSize = 11.sp,
                                        fontFamily = FontFamily.Monospace,
                                        fontWeight = FontWeight.SemiBold
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
private fun AnalyticsMetricBox(
    title: String,
    value: String,
    sub: String,
    valueColor: Color,
    modifier: Modifier = Modifier
) {
    Surface(
        color = SurfaceContainerLowest,
        shape = RoundedCornerShape(8.dp),
        border = androidx.compose.foundation.BorderStroke(1.dp, BorderOutlineVariant),
        modifier = modifier
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            Text(title, color = TextTertiary, fontSize = 10.sp, fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold)
            Text(value, color = valueColor, fontSize = 18.sp, fontWeight = FontWeight.Bold, fontFamily = FontFamily.Monospace)
            Text(sub, color = TextSecondary, fontSize = 10.sp, fontFamily = FontFamily.Monospace)
        }
    }
}
