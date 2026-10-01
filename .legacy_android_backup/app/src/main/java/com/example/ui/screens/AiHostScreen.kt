package com.example.ui.screens

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
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
import com.example.model.ScriptBlock
import com.example.model.ScriptStatus
import com.example.ui.components.PulsingDot
import com.example.ui.theme.*

@Composable
fun AiHostScreen(
    session: BroadcastSession,
    scripts: List<ScriptBlock>,
    onToggleAiHost: () -> Unit,
    onSkipScript: () -> Unit,
    modifier: Modifier = Modifier
) {
    var showAdvancedConfig by remember { mutableStateOf(false) }

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
                        text = "AI HOST COCKPIT",
                        color = TextPrimary,
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold,
                        fontFamily = FontFamily.Monospace,
                        letterSpacing = (-0.5).sp
                    )
                    Text(
                        text = "Autonomous persona, voice engine, and selling loop orchestration",
                        color = TextSecondary,
                        fontSize = 12.sp
                    )
                }

                Button(
                    onClick = onToggleAiHost,
                    colors = ButtonDefaults.buttonColors(
                        containerColor = if (session.isAiHostOn) StatusGreenContainer else SurfaceContainerHigh,
                        contentColor = if (session.isAiHostOn) StatusGreen else TextPrimary
                    ),
                    shape = RoundedCornerShape(6.dp),
                    contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp),
                    modifier = Modifier.height(34.dp).testTag("ai_host_main_toggle_btn")
                ) {
                    Icon(
                        imageVector = if (session.isAiHostOn) Icons.Default.CheckCircle else Icons.Default.Pause,
                        contentDescription = null,
                        modifier = Modifier.size(16.dp)
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = if (session.isAiHostOn) "Host Active" else "Host Paused",
                        fontSize = 11.sp,
                        fontFamily = FontFamily.Monospace
                    )
                }
            }
        }

        // PRIMARY ROW: AVATAR PREVIEW + CORE PERSONA
        item {
            BoxWithConstraints(modifier = Modifier.fillMaxWidth()) {
                val isWide = maxWidth >= 860.dp

                if (isWide) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(20.dp)
                    ) {
                        // Avatar Preview
                        AvatarCard(
                            session = session,
                            modifier = Modifier
                                .weight(1f)
                                .height(320.dp)
                        )

                        // Voice, State & Selling Loop
                        HostSpecsCard(
                            session = session,
                            modifier = Modifier
                                .weight(1.2f)
                                .height(320.dp)
                        )
                    }
                } else {
                    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                        AvatarCard(
                            session = session,
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(240.dp)
                        )
                        HostSpecsCard(
                            session = session,
                            modifier = Modifier.fillMaxWidth()
                        )
                    }
                }
            }
        }

        // INTERRUPTION BEHAVIOR & SCRIPT
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
                    Text(
                        text = "INTERRUPTION & SELLING BEHAVIOR",
                        color = TextPrimary,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Bold,
                        fontFamily = FontFamily.Monospace,
                        letterSpacing = 0.5.sp
                    )

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        BehaviorPill(
                            title = "1. FLASH SALE OVERRIDE",
                            desc = "Immediate priority when checkout surges",
                            color = AlertRed,
                            modifier = Modifier.weight(1f)
                        )
                        BehaviorPill(
                            title = "2. CUSTOMER Q&A PITCH",
                            desc = "Answers within 0.4s and routes back to CTA",
                            color = PrimaryCyan,
                            modifier = Modifier.weight(1f)
                        )
                        BehaviorPill(
                            title = "3. BPOM SAFETY GATE",
                            desc = "Strictly drops non-compliant medical claims",
                            color = StatusGreen,
                            modifier = Modifier.weight(1f)
                        )
                    }

                    Divider(color = BorderOutlineVariant, thickness = 0.5.dp)

                    // Current Script Progress
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text("CURRENT PITCH SCRIPT", color = TextTertiary, fontSize = 10.sp, fontFamily = FontFamily.Monospace)
                            Text(session.liveTranscript, color = TextPrimary, fontSize = 12.sp, maxLines = 1)
                        }

                        Button(
                            onClick = onSkipScript,
                            colors = ButtonDefaults.buttonColors(containerColor = SurfaceContainerHigh, contentColor = TextPrimary),
                            shape = RoundedCornerShape(4.dp),
                            contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp),
                            modifier = Modifier.height(30.dp)
                        ) {
                            Text("Skip Next →", fontSize = 10.sp, fontFamily = FontFamily.Monospace)
                        }
                    }
                }
            }
        }

        // ADVANCED CONFIGURATION (Collapsible)
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
                            .clickable { showAdvancedConfig = !showAdvancedConfig },
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "ADVANCED ENGINE CONFIGURATION",
                            color = TextTertiary,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            fontFamily = FontFamily.Monospace
                        )
                        Text(
                            text = if (showAdvancedConfig) "Collapse ▲" else "Expand ▼",
                            color = PrimaryCyan,
                            fontSize = 11.sp,
                            fontFamily = FontFamily.Monospace
                        )
                    }

                    AnimatedVisibility(visible = showAdvancedConfig) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(top = 8.dp),
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            ConfigRow("Neural Engine", "Gemini 1.5 Pro (Fine-tuned ID E-Commerce)")
                            ConfigRow("Voice Model", "Indonesian Sari Neural v4 (Pitch +0.2, Speed 1.05x)")
                            ConfigRow("WebRTC Render", "1080p60 Dual-Pipe Hardware Sync")
                            ConfigRow("Safety Floor", "BPOM Guardrail 2.4 Active")
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun AvatarCard(
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
                contentDescription = "AI Host Avatar",
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxSize()
            )

            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .align(Alignment.BottomCenter)
                    .background(VoidBlack.copy(alpha = 0.8f))
                    .padding(12.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("Sari Neural v4", color = TextPrimary, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    Text("LipSync ${session.lipSyncAccuracy}%", color = StatusGreen, fontSize = 10.sp, fontFamily = FontFamily.Monospace)
                }
            }
        }
    }
}

@Composable
private fun HostSpecsCard(
    session: BroadcastSession,
    modifier: Modifier = Modifier
) {
    Surface(
        color = SurfaceContainerLowest,
        shape = RoundedCornerShape(8.dp),
        border = androidx.compose.foundation.BorderStroke(1.dp, BorderOutlineVariant),
        modifier = modifier
    ) {
        Column(
            modifier = Modifier
                .padding(20.dp)
                .fillMaxHeight(),
            verticalArrangement = Arrangement.SpaceBetween
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
                Text(
                    text = "HOST SPECIFICATIONS",
                    color = TextPrimary,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    fontFamily = FontFamily.Monospace,
                    letterSpacing = 0.5.sp
                )

                SpecRow("SPEAKER VOICE", session.activeSpeaker)
                SpecRow("CURRENT STATE", session.activeState)
                SpecRow("SELLING LOOP", "Continuous Autonomous Pitching (Cycle #41)")
                SpecRow("LATENCY", "${session.latencyMs}ms WebRTC loop")
            }

            Text(
                text = "Autonomous sales mode active across connected platforms.",
                color = TextTertiary,
                fontSize = 11.sp
            )
        }
    }
}

@Composable
private fun SpecRow(label: String, value: String) {
    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Text(label, color = TextTertiary, fontSize = 10.sp, fontFamily = FontFamily.Monospace)
        Text(value, color = TextPrimary, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
private fun BehaviorPill(title: String, desc: String, color: Color, modifier: Modifier = Modifier) {
    Column(
        modifier = modifier
            .background(SurfaceContainerLow, RoundedCornerShape(6.dp))
            .border(1.dp, BorderOutlineVariant, RoundedCornerShape(6.dp))
            .padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        Text(title, color = color, fontSize = 10.sp, fontWeight = FontWeight.Bold, fontFamily = FontFamily.Monospace)
        Text(desc, color = TextSecondary, fontSize = 11.sp)
    }
}

@Composable
private fun ConfigRow(key: String, value: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(SurfaceContainerLow, RoundedCornerShape(4.dp))
            .padding(horizontal = 10.dp, vertical = 6.dp),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(key, color = TextSecondary, fontSize = 11.sp, fontFamily = FontFamily.Monospace)
        Text(value, color = TextPrimary, fontSize = 11.sp, fontFamily = FontFamily.Monospace)
    }
}
