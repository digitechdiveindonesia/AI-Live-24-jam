package com.example.ui.screens

import androidx.compose.animation.AnimatedVisibility
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
import com.example.model.IncidentLog
import com.example.model.SystemServiceNode
import com.example.ui.components.PulsingDot
import com.example.ui.theme.*

data class SimpleService(
    val id: String,
    val name: String,
    val category: String,
    val status: String,
    val latency: String,
    val details: String
)

@Composable
fun SystemScreen(
    session: BroadcastSession,
    services: List<SystemServiceNode>,
    incidents: List<IncidentLog>,
    onRunChaosTest: (String) -> Unit,
    onRestartService: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    val coreServices = listOf(
        SimpleService("ai", "AI Neural Core", "Gemini 1.5 Pro inference engine", "Healthy", "1.2s", "12,482 requests served • 48.2 tok/s"),
        SimpleService("host", "Host Orchestrator", "Autonomous Selling State Machine", "Healthy", "42ms", "Cycle #41 • Pitching SKU-001"),
        SimpleService("tts", "TTS Synthesis", "Natural Voice Audio Generation", "Healthy", "340ms", "Cache hit 72% • Realtime 28%"),
        SimpleService("avatar", "Avatar Render", "WebRTC Video Ingest & LipSync", "Healthy", "180ms", "30 FPS • 0 dropped frames"),
        SimpleService("stream", "Stream Encoder", "NVENC Dual-Pipe RTMP Relay", "Healthy", "2.0s", "1080p60 • 5,800 kbps constant"),
        SimpleService("database", "Database & Store", "PostgreSQL & Redis Event Bus", "Healthy", "18ms", "Cluster synchronized • Pool 24/100"),
        SimpleService("rag", "RAG Vector Store", "Knowledge Base Retrieval", "Healthy", "82ms", "1,842 chunks • text-embedding-3"),
        SimpleService("platform", "Platform Adapters", "TikTok & Shopee Live Sync", "Healthy", "112ms", "Simultaneous dual live connection")
    )

    var selectedService by remember { mutableStateOf<SimpleService?>(null) }
    var showChaosSuite by remember { mutableStateOf(false) }

    BoxWithConstraints(
        modifier = modifier
            .fillMaxSize()
            .background(SurfaceCanvas)
            .padding(24.dp)
    ) {
        val isWide = maxWidth >= 960.dp

        Row(
            modifier = Modifier.fillMaxSize(),
            horizontalArrangement = Arrangement.spacedBy(24.dp)
        ) {
            // MAIN SYSTEM LIST
            LazyColumn(
                modifier = Modifier
                    .weight(if (selectedService != null && isWide) 1.2f else 1f)
                    .fillMaxHeight(),
                verticalArrangement = Arrangement.spacedBy(20.dp)
            ) {
                // OVERALL SYSTEM STATUS HEADER
                item {
                    Surface(
                        color = SurfaceContainerLowest,
                        shape = RoundedCornerShape(8.dp),
                        border = androidx.compose.foundation.BorderStroke(1.dp, BorderOutlineVariant),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(20.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(10.dp)
                            ) {
                                PulsingDot(color = StatusGreen, size = 10)
                                Column {
                                    Text(
                                        text = "OVERALL SYSTEM STATUS: HEALTHY",
                                        color = StatusGreen,
                                        fontSize = 14.sp,
                                        fontWeight = FontWeight.Bold,
                                        fontFamily = FontFamily.Monospace
                                    )
                                    Text(
                                        text = "8 of 8 core broadcast services operational in Jakarta-1 cluster",
                                        color = TextSecondary,
                                        fontSize = 12.sp
                                    )
                                }
                            }

                            Text(
                                text = "99.98% Uptime",
                                color = TextPrimary,
                                fontSize = 12.sp,
                                fontFamily = FontFamily.Monospace,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }

                // 8 CORE SERVICE LIST
                item {
                    Surface(
                        color = SurfaceContainerLowest,
                        shape = RoundedCornerShape(8.dp),
                        border = androidx.compose.foundation.BorderStroke(1.dp, BorderOutlineVariant),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(
                            modifier = Modifier.padding(20.dp),
                            verticalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = "CORE SERVICES",
                                    color = TextPrimary,
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.Bold,
                                    fontFamily = FontFamily.Monospace,
                                    letterSpacing = 0.5.sp
                                )
                                Text("Click for diagnostics", color = TextTertiary, fontSize = 11.sp, fontFamily = FontFamily.Monospace)
                            }

                            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                coreServices.forEach { svc ->
                                    val isSelected = selectedService?.id == svc.id

                                    Row(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .clip(RoundedCornerShape(6.dp))
                                            .background(if (isSelected) SurfaceContainerHigh else SurfaceContainerLow)
                                            .border(
                                                1.dp,
                                                if (isSelected) PrimaryCyan else BorderOutlineVariant,
                                                RoundedCornerShape(6.dp)
                                            )
                                            .clickable { selectedService = svc }
                                            .padding(horizontal = 16.dp, vertical = 12.dp),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Column {
                                            Text(svc.name, color = TextPrimary, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                                            Text(svc.category, color = TextTertiary, fontSize = 10.sp, fontFamily = FontFamily.Monospace)
                                        }

                                        Row(
                                            verticalAlignment = Alignment.CenterVertically,
                                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                                        ) {
                                            Text(svc.latency, color = TextSecondary, fontSize = 11.sp, fontFamily = FontFamily.Monospace)
                                            Box(
                                                modifier = Modifier
                                                    .background(StatusGreenContainer.copy(alpha = 0.3f), RoundedCornerShape(4.dp))
                                                    .padding(horizontal = 8.dp, vertical = 4.dp)
                                            ) {
                                                Text(
                                                    text = svc.status.uppercase(),
                                                    color = StatusGreen,
                                                    fontSize = 10.sp,
                                                    fontWeight = FontWeight.Bold,
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

                // FAILOVER & CHAOS TESTS (Progressive Disclosure / Expandable)
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
                                    .clickable { showChaosSuite = !showChaosSuite },
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = "RESILIENCE & FAILOVER SIMULATION",
                                    color = TextTertiary,
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold,
                                    fontFamily = FontFamily.Monospace
                                )
                                Text(
                                    text = if (showChaosSuite) "Collapse ▲" else "Expand Tests ▼",
                                    color = PrimaryCyan,
                                    fontSize = 11.sp,
                                    fontFamily = FontFamily.Monospace
                                )
                            }

                            AnimatedVisibility(visible = showChaosSuite) {
                                Column(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(top = 8.dp),
                                    verticalArrangement = Arrangement.spacedBy(8.dp)
                                ) {
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                                    ) {
                                        Button(
                                            onClick = { onRunChaosTest("RTMP Packet Drop") },
                                            colors = ButtonDefaults.buttonColors(containerColor = SurfaceContainerHigh, contentColor = TextPrimary),
                                            shape = RoundedCornerShape(4.dp),
                                            modifier = Modifier.weight(1f).height(36.dp)
                                        ) {
                                            Text("RTMP Jitter", fontSize = 10.sp, fontFamily = FontFamily.Monospace)
                                        }
                                        Button(
                                            onClick = { onRunChaosTest("TTS Timeout") },
                                            colors = ButtonDefaults.buttonColors(containerColor = SurfaceContainerHigh, contentColor = TextPrimary),
                                            shape = RoundedCornerShape(4.dp),
                                            modifier = Modifier.weight(1f).height(36.dp)
                                        ) {
                                            Text("TTS Timeout", fontSize = 10.sp, fontFamily = FontFamily.Monospace)
                                        }
                                        Button(
                                            onClick = { onRunChaosTest("Stock Discrepancy") },
                                            colors = ButtonDefaults.buttonColors(containerColor = SurfaceContainerHigh, contentColor = TextPrimary),
                                            shape = RoundedCornerShape(4.dp),
                                            modifier = Modifier.weight(1f).height(36.dp)
                                        ) {
                                            Text("Stock Conflict", fontSize = 10.sp, fontFamily = FontFamily.Monospace)
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // SERVICE DIAGNOSTICS DETAIL DRAWER
            selectedService?.let { svc ->
                Surface(
                    color = SurfaceContainerLowest,
                    shape = RoundedCornerShape(8.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, BorderOutlineVariant),
                    modifier = Modifier
                        .weight(1f)
                        .fillMaxHeight()
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(20.dp),
                        verticalArrangement = Arrangement.spacedBy(16.dp)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "SERVICE DIAGNOSTICS",
                                color = TextPrimary,
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Bold,
                                fontFamily = FontFamily.Monospace,
                                letterSpacing = 0.5.sp
                            )
                            IconButton(onClick = { selectedService = null }, modifier = Modifier.size(28.dp)) {
                                Icon(Icons.Default.Close, contentDescription = "Close", tint = TextSecondary, modifier = Modifier.size(18.dp))
                            }
                        }

                        Divider(color = BorderOutlineVariant, thickness = 0.5.dp)

                        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            Text(svc.name, color = TextPrimary, fontSize = 16.sp, fontWeight = FontWeight.Bold)
                            Text(svc.category, color = TextSecondary, fontSize = 12.sp)
                        }

                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .background(SurfaceContainerLow, RoundedCornerShape(6.dp))
                                .padding(12.dp),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Column {
                                Text("STATUS", color = TextTertiary, fontSize = 10.sp, fontFamily = FontFamily.Monospace)
                                Text(svc.status, color = StatusGreen, fontSize = 14.sp, fontWeight = FontWeight.Bold, fontFamily = FontFamily.Monospace)
                            }
                            Column {
                                Text("LATENCY", color = TextTertiary, fontSize = 10.sp, fontFamily = FontFamily.Monospace)
                                Text(svc.latency, color = PrimaryCyan, fontSize = 14.sp, fontWeight = FontWeight.Bold, fontFamily = FontFamily.Monospace)
                            }
                        }

                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .background(SurfaceContainerLow, RoundedCornerShape(6.dp))
                                .padding(12.dp)
                        ) {
                            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                Text("NODE RUNTIME TELEMETRY", color = TextTertiary, fontSize = 9.sp, fontFamily = FontFamily.Monospace)
                                Text(svc.details, color = TextPrimary, fontSize = 12.sp)
                            }
                        }

                        Spacer(modifier = Modifier.weight(1f))

                        Button(
                            onClick = { onRestartService(svc.name) },
                            colors = ButtonDefaults.buttonColors(containerColor = SurfaceContainerHigh, contentColor = TextPrimary),
                            shape = RoundedCornerShape(6.dp),
                            modifier = Modifier.fillMaxWidth().height(36.dp)
                        ) {
                            Text("Restart Microservice Pod", fontSize = 11.sp, fontFamily = FontFamily.Monospace)
                        }
                    }
                }
            }
        }
    }
}
