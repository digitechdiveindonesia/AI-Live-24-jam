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
import com.example.model.LiveChatMessage
import com.example.model.ProductItem
import com.example.model.ScriptBlock
import com.example.model.ScriptStatus
import com.example.ui.components.PulsingDot
import com.example.ui.theme.*

@Composable
fun LiveControlScreen(
    session: BroadcastSession,
    activeProduct: ProductItem,
    scripts: List<ScriptBlock>,
    chatMessages: List<LiveChatMessage>,
    onToggleMute: () -> Unit,
    onPauseHost: () -> Unit,
    onSkipScript: () -> Unit,
    onSendWhisper: (String, Boolean) -> Unit,
    onSelectProduct: (ProductItem) -> Unit,
    modifier: Modifier = Modifier
) {
    val activeScript = scripts.firstOrNull { it.status == ScriptStatus.ACTIVE }
        ?: scripts.firstOrNull()

    val nextScripts = scripts.filter { it.status == ScriptStatus.UPCOMING }

    LazyColumn(
        modifier = modifier
            .fillMaxSize()
            .background(SurfaceCanvas)
            .padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(24.dp)
    ) {
        // 1. PRIMARY LAYOUT: LEFT (PREVIEW) & RIGHT (CONTROL CONSOLE)
        item {
            BoxWithConstraints(modifier = Modifier.fillMaxWidth()) {
                val isWide = maxWidth >= 860.dp
                if (isWide) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(24.dp)
                    ) {
                        // LEFT: Large Talking-Head Preview
                        HostVideoFrame(
                            session = session,
                            modifier = Modifier
                                .weight(1.3f)
                                .height(420.dp)
                        )

                        // RIGHT: Control Console
                        HostControlConsole(
                            session = session,
                            activeScript = activeScript,
                            activeProduct = activeProduct,
                            onPauseHost = onPauseHost,
                            onToggleMute = onToggleMute,
                            onSkipScript = onSkipScript,
                            modifier = Modifier
                                .weight(1f)
                                .height(420.dp)
                        )
                    }
                } else {
                    Column(
                        modifier = Modifier.fillMaxWidth(),
                        verticalArrangement = Arrangement.spacedBy(16.dp)
                    ) {
                        HostVideoFrame(
                            session = session,
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(260.dp)
                        )
                        HostControlConsole(
                            session = session,
                            activeScript = activeScript,
                            activeProduct = activeProduct,
                            onPauseHost = onPauseHost,
                            onToggleMute = onToggleMute,
                            onSkipScript = onSkipScript,
                            modifier = Modifier.fillMaxWidth()
                        )
                    }
                }
            }
        }

        // 2. BELOW: NEXT SCRIPT BLOCKS
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
                            text = "NEXT SCRIPT BLOCKS",
                            color = TextPrimary,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold,
                            fontFamily = FontFamily.Monospace,
                            letterSpacing = 0.5.sp
                        )
                        Text(
                            text = "${nextScripts.size} Upcoming in Queue",
                            color = TextTertiary,
                            fontSize = 11.sp,
                            fontFamily = FontFamily.Monospace
                        )
                    }

                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        nextScripts.forEachIndexed { index, block ->
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .background(SurfaceContainerLow, RoundedCornerShape(6.dp))
                                    .padding(horizontal = 14.dp, vertical = 12.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                                ) {
                                    Text(
                                        text = "#${index + 1}",
                                        color = TextTertiary,
                                        fontSize = 11.sp,
                                        fontFamily = FontFamily.Monospace,
                                        fontWeight = FontWeight.Bold
                                    )
                                    Column {
                                        Text(
                                            text = block.title,
                                            color = TextPrimary,
                                            fontSize = 12.sp,
                                            fontWeight = FontWeight.SemiBold
                                        )
                                        Text(
                                            text = block.code,
                                            color = TextTertiary,
                                            fontSize = 10.sp,
                                            fontFamily = FontFamily.Monospace
                                        )
                                    }
                                }

                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                                ) {
                                    Text(
                                        text = block.durationText,
                                        color = TextSecondary,
                                        fontSize = 11.sp,
                                        fontFamily = FontFamily.Monospace
                                    )
                                    Box(
                                        modifier = Modifier
                                            .background(SurfaceContainerHigh, RoundedCornerShape(4.dp))
                                            .padding(horizontal = 6.dp, vertical = 2.dp)
                                    ) {
                                        Text(
                                            text = "QUEUED",
                                            color = TextTertiary,
                                            fontSize = 9.sp,
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
}

@Composable
private fun HostVideoFrame(
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
                contentDescription = "Live Host Talking Head",
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxSize()
            )

            // Minimal overlay at top
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(14.dp)
                    .align(Alignment.TopStart),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    modifier = Modifier
                        .background(VoidBlack.copy(alpha = 0.75f), RoundedCornerShape(4.dp))
                        .padding(horizontal = 8.dp, vertical = 4.dp)
                ) {
                    PulsingDot(color = StatusGreen, size = 6)
                    Text("HOST ON-AIR", color = TextPrimary, fontSize = 10.sp, fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold)
                }

                Text(
                    text = "LipSync ${session.lipSyncAccuracy}%",
                    color = PrimaryCyan,
                    fontSize = 10.sp,
                    fontFamily = FontFamily.Monospace,
                    modifier = Modifier
                        .background(VoidBlack.copy(alpha = 0.75f), RoundedCornerShape(4.dp))
                        .padding(horizontal = 8.dp, vertical = 4.dp)
                )
            }

            // Subtitle caption box
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .align(Alignment.BottomCenter)
                    .background(VoidBlack.copy(alpha = 0.85f))
                    .padding(14.dp)
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    Text(
                        text = "LIVE SPEECH TRANSCRIPT",
                        color = TextTertiary,
                        fontSize = 9.sp,
                        fontFamily = FontFamily.Monospace,
                        letterSpacing = 0.5.sp
                    )
                    Text(
                        text = session.liveTranscript,
                        color = TextPrimary,
                        fontSize = 12.sp,
                        maxLines = 2
                    )
                }
            }
        }
    }
}

@Composable
private fun HostControlConsole(
    session: BroadcastSession,
    activeScript: ScriptBlock?,
    activeProduct: ProductItem,
    onPauseHost: () -> Unit,
    onToggleMute: () -> Unit,
    onSkipScript: () -> Unit,
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
            Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                // Host State Header
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text(
                            text = "HOST STATUS",
                            color = TextTertiary,
                            fontSize = 10.sp,
                            fontFamily = FontFamily.Monospace
                        )
                        Text(
                            text = if (session.isAiHostOn) "Autonomous Selling Loop" else "Standby (Paused)",
                            color = if (session.isAiHostOn) StatusGreen else WarningYellow,
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }

                    Box(
                        modifier = Modifier
                            .background(
                                if (session.isAiHostOn) StatusGreenContainer.copy(alpha = 0.3f) else WarningYellowContainer.copy(alpha = 0.3f),
                                RoundedCornerShape(4.dp)
                            )
                            .padding(horizontal = 8.dp, vertical = 4.dp)
                    ) {
                        Text(
                            text = session.activeState,
                            color = if (session.isAiHostOn) StatusGreen else WarningYellow,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            fontFamily = FontFamily.Monospace
                        )
                    }
                }

                Divider(color = BorderOutlineVariant, thickness = 0.5.dp)

                // Current Script Block
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text(
                        text = "CURRENT SCRIPT BLOCK",
                        color = TextTertiary,
                        fontSize = 10.sp,
                        fontFamily = FontFamily.Monospace
                    )
                    Text(
                        text = activeScript?.title ?: "No Active Script",
                        color = TextPrimary,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                    Text(
                        text = "${activeScript?.code ?: ""} • ${activeScript?.timeLabel ?: ""}",
                        color = PrimaryCyan,
                        fontSize = 11.sp,
                        fontFamily = FontFamily.Monospace
                    )
                    LinearProgressIndicator(
                        progress = { activeScript?.currentProgress ?: 0f },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(4.dp)
                            .clip(RoundedCornerShape(2.dp)),
                        color = PrimaryCyan,
                        trackColor = SurfaceContainerHigh
                    )
                }

                Divider(color = BorderOutlineVariant, thickness = 0.5.dp)

                // Current Product
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(
                        text = "CURRENT PRODUCT",
                        color = TextTertiary,
                        fontSize = 10.sp,
                        fontFamily = FontFamily.Monospace
                    )
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "${activeProduct.title} (${activeProduct.sku})",
                            color = TextPrimary,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.SemiBold
                        )
                        Text(
                            text = "Rp${activeProduct.basePrice}",
                            color = StatusGreen,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            fontFamily = FontFamily.Monospace
                        )
                    }
                    Text(
                        text = "Stock: ${activeProduct.totalStock} units remaining",
                        color = TextSecondary,
                        fontSize = 11.sp,
                        fontFamily = FontFamily.Monospace
                    )
                }
            }

            // Action Buttons
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Button(
                        onClick = onPauseHost,
                        colors = ButtonDefaults.buttonColors(
                            containerColor = if (session.isPaused) StatusGreenContainer else SurfaceContainerHigh,
                            contentColor = if (session.isPaused) StatusGreen else TextPrimary
                        ),
                        shape = RoundedCornerShape(6.dp),
                        modifier = Modifier
                            .weight(1f)
                            .height(38.dp)
                            .testTag("control_pause_btn")
                    ) {
                        Icon(
                            imageVector = if (session.isPaused) Icons.Default.PlayArrow else Icons.Default.Pause,
                            contentDescription = null,
                            modifier = Modifier.size(16.dp)
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = if (session.isPaused) "Resume AI" else "Pause AI",
                            fontSize = 11.sp,
                            fontFamily = FontFamily.Monospace
                        )
                    }

                    Button(
                        onClick = onSkipScript,
                        colors = ButtonDefaults.buttonColors(
                            containerColor = SurfaceContainerHigh,
                            contentColor = TextPrimary
                        ),
                        shape = RoundedCornerShape(6.dp),
                        modifier = Modifier
                            .weight(1f)
                            .height(38.dp)
                            .testTag("control_skip_script_btn")
                    ) {
                        Icon(
                            imageVector = Icons.Default.SkipNext,
                            contentDescription = null,
                            modifier = Modifier.size(16.dp)
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = "Skip Pitch",
                            fontSize = 11.sp,
                            fontFamily = FontFamily.Monospace
                        )
                    }
                }
            }
        }
    }
}
