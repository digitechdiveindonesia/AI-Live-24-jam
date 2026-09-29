package com.example.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
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
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.model.BroadcastSession
import com.example.ui.theme.*

@Composable
fun TopBroadcastBar(
    session: BroadcastSession,
    onToggleAiHost: () -> Unit,
    onPauseAi: () -> Unit,
    onTakeOver: () -> Unit,
    onEmergencyStop: () -> Unit,
    onOpenNav: (() -> Unit)? = null,
    modifier: Modifier = Modifier
) {
    Surface(
        color = VoidBlack,
        modifier = modifier
            .fillMaxWidth()
            .border(width = 1.dp, color = BorderOutlineVariant)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            // LEFT: LIVE Status, Session ID & Platforms
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                if (onOpenNav != null) {
                    IconButton(
                        onClick = onOpenNav,
                        modifier = Modifier.size(32.dp).testTag("open_nav_button")
                    ) {
                        Icon(
                            imageVector = Icons.Default.Menu,
                            contentDescription = "Open navigation",
                            tint = TextSecondary,
                            modifier = Modifier.size(20.dp)
                        )
                    }
                }

                // LIVE badge + Session ID
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    modifier = Modifier
                        .background(if (session.isLive) AlertRedContainer.copy(alpha = 0.3f) else SurfaceContainerHigh, RoundedCornerShape(4.dp))
                        .border(1.dp, if (session.isLive) AlertRed.copy(alpha = 0.5f) else BorderOutline, RoundedCornerShape(4.dp))
                        .padding(horizontal = 8.dp, vertical = 4.dp)
                ) {
                    if (session.isLive) {
                        PulsingDot(color = AlertRed, size = 6)
                        Text(
                            text = "LIVE",
                            color = AlertRed,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            fontFamily = FontFamily.Monospace
                        )
                    } else {
                        Text(
                            text = "OFFLINE",
                            color = TextTertiary,
                            fontSize = 11.sp,
                            fontFamily = FontFamily.Monospace
                        )
                    }
                    Text(
                        text = "• ${session.id}",
                        color = TextPrimary,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.SemiBold,
                        fontFamily = FontFamily.Monospace
                    )
                }

                // Current Platform
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    PlatformPill("TikTok", session.tiktokConnected, StatusBlue)
                    PlatformPill("Shopee", session.shopeeConnected, WarningYellow)
                }
            }

            // RIGHT: AI Host Status & Operator Quick Controls
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                // AI Host Status Indicator
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    modifier = Modifier
                        .background(SurfaceContainerLow, RoundedCornerShape(4.dp))
                        .border(1.dp, BorderOutlineVariant, RoundedCornerShape(4.dp))
                        .padding(horizontal = 8.dp, vertical = 4.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .size(7.dp)
                            .clip(CircleShape)
                            .background(if (session.isAiHostOn) StatusGreen else WarningYellow)
                    )
                    Text(
                        text = if (session.isAiHostOn) "AI Host Active" else "AI Host Standby",
                        color = if (session.isAiHostOn) StatusGreen else WarningYellow,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Medium,
                        fontFamily = FontFamily.Monospace
                    )
                }

                // Pause / Resume AI Host
                OutlinedButton(
                    onClick = onToggleAiHost,
                    shape = RoundedCornerShape(6.dp),
                    contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, BorderOutline),
                    colors = ButtonDefaults.outlinedButtonColors(
                        contentColor = TextPrimary
                    ),
                    modifier = Modifier.height(32.dp).testTag("header_toggle_ai_btn")
                ) {
                    Icon(
                        imageVector = if (session.isAiHostOn) Icons.Default.Pause else Icons.Default.PlayArrow,
                        contentDescription = null,
                        modifier = Modifier.size(14.dp),
                        tint = if (session.isAiHostOn) WarningYellow else StatusGreen
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = if (session.isAiHostOn) "Pause AI" else "Resume AI",
                        fontSize = 11.sp,
                        fontFamily = FontFamily.Monospace
                    )
                }

                // Mic Takeover
                OutlinedButton(
                    onClick = onTakeOver,
                    shape = RoundedCornerShape(6.dp),
                    contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp),
                    border = androidx.compose.foundation.BorderStroke(
                        1.dp,
                        if (session.isMicTakeover) PrimaryCyan else BorderOutline
                    ),
                    colors = ButtonDefaults.outlinedButtonColors(
                        containerColor = if (session.isMicTakeover) PrimaryCyanContainer.copy(alpha = 0.3f) else Color.Transparent,
                        contentColor = if (session.isMicTakeover) PrimaryCyan else TextPrimary
                    ),
                    modifier = Modifier.height(32.dp).testTag("header_takeover_btn")
                ) {
                    Icon(
                        imageVector = Icons.Default.Mic,
                        contentDescription = null,
                        modifier = Modifier.size(14.dp),
                        tint = if (session.isMicTakeover) PrimaryCyan else TextSecondary
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = if (session.isMicTakeover) "Mic Live" else "Take Over",
                        fontSize = 11.sp,
                        fontFamily = FontFamily.Monospace
                    )
                }

                // Emergency Stop (Compact red button)
                Button(
                    onClick = onEmergencyStop,
                    shape = RoundedCornerShape(6.dp),
                    contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = AlertRedContainer,
                        contentColor = AlertRed
                    ),
                    modifier = Modifier.height(32.dp).testTag("header_emergency_stop_btn")
                ) {
                    Icon(
                        imageVector = Icons.Default.PowerSettingsNew,
                        contentDescription = null,
                        modifier = Modifier.size(14.dp)
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = "Stop",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        fontFamily = FontFamily.Monospace
                    )
                }
            }
        }
    }
}

@Composable
private fun PlatformPill(name: String, isConnected: Boolean, brandColor: Color) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp),
        modifier = Modifier
            .background(SurfaceContainerLowest, RoundedCornerShape(4.dp))
            .border(1.dp, BorderOutlineVariant, RoundedCornerShape(4.dp))
            .padding(horizontal = 6.dp, vertical = 3.dp)
    ) {
        Box(
            modifier = Modifier
                .size(6.dp)
                .clip(CircleShape)
                .background(if (isConnected) brandColor else TextTertiary)
        )
        Text(
            text = name,
            color = if (isConnected) TextSecondary else TextTertiary,
            fontSize = 10.sp,
            fontFamily = FontFamily.Monospace
        )
    }
}
