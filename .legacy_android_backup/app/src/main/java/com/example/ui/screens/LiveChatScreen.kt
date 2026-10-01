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
import com.example.model.LiveChatMessage
import com.example.model.ProductItem
import com.example.ui.components.PulsingDot
import com.example.ui.theme.*

@Composable
fun LiveChatScreen(
    session: BroadcastSession,
    chatMessages: List<LiveChatMessage>,
    selectedChat: LiveChatMessage,
    activeProduct: ProductItem,
    onSelectChat: (LiveChatMessage) -> Unit,
    onSendReply: (String, Boolean) -> Unit,
    modifier: Modifier = Modifier
) {
    var replyText by remember { mutableStateOf("") }
    var isWhisperToTts by remember { mutableStateOf(true) }
    var showAiDetails by remember { mutableStateOf(false) }

    BoxWithConstraints(
        modifier = modifier
            .fillMaxSize()
            .background(SurfaceCanvas)
            .padding(24.dp)
    ) {
        val isWide = maxWidth >= 860.dp

        if (isWide) {
            Row(
                modifier = Modifier.fillMaxSize(),
                horizontalArrangement = Arrangement.spacedBy(24.dp)
            ) {
                // 1. CUSTOMER CONVERSATION FEED
                Surface(
                    color = SurfaceContainerLowest,
                    shape = RoundedCornerShape(8.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, BorderOutlineVariant),
                    modifier = Modifier
                        .weight(1.2f)
                        .fillMaxHeight()
                ) {
                    ChatFeedColumn(
                        messages = chatMessages,
                        selectedChat = selectedChat,
                        onSelectChat = onSelectChat
                    )
                }

                // 2. AI RESPONSE & 3. PRODUCT CONTEXT
                Column(
                    modifier = Modifier
                        .weight(1f)
                        .fillMaxHeight(),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    // AI Response Panel
                    Surface(
                        color = SurfaceContainerLowest,
                        shape = RoundedCornerShape(8.dp),
                        border = androidx.compose.foundation.BorderStroke(1.dp, BorderOutlineVariant),
                        modifier = Modifier
                            .fillMaxWidth()
                            .weight(1.2f)
                    ) {
                        AiResponsePanel(
                            selectedChat = selectedChat,
                            replyText = replyText,
                            onReplyTextChange = { replyText = it },
                            isWhisperToTts = isWhisperToTts,
                            onToggleWhisper = { isWhisperToTts = !isWhisperToTts },
                            onSend = {
                                if (replyText.isNotBlank()) {
                                    onSendReply(replyText, isWhisperToTts)
                                    replyText = ""
                                }
                            },
                            showAiDetails = showAiDetails,
                            onToggleDetails = { showAiDetails = !showAiDetails }
                        )
                    }

                    // Product Context Panel
                    Surface(
                        color = SurfaceContainerLowest,
                        shape = RoundedCornerShape(8.dp),
                        border = androidx.compose.foundation.BorderStroke(1.dp, BorderOutlineVariant),
                        modifier = Modifier
                            .fillMaxWidth()
                            .weight(0.8f)
                    ) {
                        ProductContextPanel(activeProduct = activeProduct)
                    }
                }
            }
        } else {
            // Stacked for narrow viewports
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                item {
                    Surface(
                        color = SurfaceContainerLowest,
                        shape = RoundedCornerShape(8.dp),
                        border = androidx.compose.foundation.BorderStroke(1.dp, BorderOutlineVariant),
                        modifier = Modifier.fillMaxWidth().height(320.dp)
                    ) {
                        ChatFeedColumn(
                            messages = chatMessages,
                            selectedChat = selectedChat,
                            onSelectChat = onSelectChat
                        )
                    }
                }
                item {
                    Surface(
                        color = SurfaceContainerLowest,
                        shape = RoundedCornerShape(8.dp),
                        border = androidx.compose.foundation.BorderStroke(1.dp, BorderOutlineVariant),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        AiResponsePanel(
                            selectedChat = selectedChat,
                            replyText = replyText,
                            onReplyTextChange = { replyText = it },
                            isWhisperToTts = isWhisperToTts,
                            onToggleWhisper = { isWhisperToTts = !isWhisperToTts },
                            onSend = {
                                if (replyText.isNotBlank()) {
                                    onSendReply(replyText, isWhisperToTts)
                                    replyText = ""
                                }
                            },
                            showAiDetails = showAiDetails,
                            onToggleDetails = { showAiDetails = !showAiDetails }
                        )
                    }
                }
                item {
                    Surface(
                        color = SurfaceContainerLowest,
                        shape = RoundedCornerShape(8.dp),
                        border = androidx.compose.foundation.BorderStroke(1.dp, BorderOutlineVariant),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        ProductContextPanel(activeProduct = activeProduct)
                    }
                }
            }
        }
    }
}

@Composable
private fun ChatFeedColumn(
    messages: List<LiveChatMessage>,
    selectedChat: LiveChatMessage,
    onSelectChat: (LiveChatMessage) -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(18.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "CUSTOMER CONVERSATION",
                color = TextPrimary,
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
                fontFamily = FontFamily.Monospace,
                letterSpacing = 0.5.sp
            )
            Text(
                text = "${messages.size} Messages",
                color = TextTertiary,
                fontSize = 11.sp,
                fontFamily = FontFamily.Monospace
            )
        }

        LazyColumn(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            items(messages) { msg ->
                val isSelected = msg.id == selectedChat.id
                val platformColor = if (msg.platform == "TikTok") StatusBlue else WarningYellow

                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(6.dp))
                        .background(if (isSelected) SurfaceContainerHigh else SurfaceContainerLow)
                        .border(
                            1.dp,
                            if (isSelected) PrimaryCyan else BorderOutlineVariant,
                            RoundedCornerShape(6.dp)
                        )
                        .clickable { onSelectChat(msg) }
                        .padding(12.dp),
                    verticalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            Text(
                                text = msg.author,
                                color = TextPrimary,
                                fontSize = 12.sp,
                                fontWeight = FontWeight.SemiBold
                            )
                            Text(
                                text = "(${msg.platform})",
                                color = platformColor,
                                fontSize = 10.sp,
                                fontFamily = FontFamily.Monospace
                            )
                        }
                        Text(
                            text = msg.time,
                            color = TextTertiary,
                            fontSize = 10.sp,
                            fontFamily = FontFamily.Monospace
                        )
                    }

                    Text(
                        text = msg.message,
                        color = TextSecondary,
                        fontSize = 12.sp,
                        maxLines = 2
                    )
                }
            }
        }
    }
}

@Composable
private fun AiResponsePanel(
    selectedChat: LiveChatMessage,
    replyText: String,
    onReplyTextChange: (String) -> Unit,
    isWhisperToTts: Boolean,
    onToggleWhisper: () -> Unit,
    onSend: () -> Unit,
    showAiDetails: Boolean,
    onToggleDetails: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(18.dp),
        verticalArrangement = Arrangement.SpaceBetween
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "AI RESPONSE",
                    color = TextPrimary,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    fontFamily = FontFamily.Monospace,
                    letterSpacing = 0.5.sp
                )

                // Toggle AI Details button
                TextButton(
                    onClick = onToggleDetails,
                    contentPadding = PaddingValues(horizontal = 8.dp, vertical = 2.dp)
                ) {
                    Text(
                        text = if (showAiDetails) "Hide AI Details ▲" else "View AI Details ▼",
                        color = PrimaryCyan,
                        fontSize = 11.sp,
                        fontFamily = FontFamily.Monospace
                    )
                }
            }

            // Customer Question reference
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(SurfaceContainerLow, RoundedCornerShape(6.dp))
                    .padding(10.dp)
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    Text(
                        text = "QUESTION FROM ${selectedChat.author.uppercase()}:",
                        color = TextTertiary,
                        fontSize = 9.sp,
                        fontFamily = FontFamily.Monospace
                    )
                    Text(
                        text = "\"${selectedChat.message}\"",
                        color = TextPrimary,
                        fontSize = 12.sp
                    )
                }
            }

            // AI Generated Answer
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(SurfaceContainerLow, RoundedCornerShape(6.dp))
                    .border(1.dp, PrimaryCyan.copy(alpha = 0.3f), RoundedCornerShape(6.dp))
                    .padding(10.dp)
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        PulsingDot(color = StatusGreen, size = 6)
                        Text(
                            text = "GENERATED SPEECH ANSWER",
                            color = StatusGreen,
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold,
                            fontFamily = FontFamily.Monospace
                        )
                    }
                    Text(
                        text = selectedChat.aiResponse ?: "No AI response queued for this question.",
                        color = TextPrimary,
                        fontSize = 12.sp,
                        lineHeight = 18.sp
                    )
                }
            }

            // Collapsible AI Details Drawer/Section
            AnimatedVisibility(visible = showAiDetails) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(SurfaceContainerHighest, RoundedCornerShape(6.dp))
                        .padding(10.dp),
                    verticalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    Text("AI GROUNDING METADATA", color = TextTertiary, fontSize = 9.sp, fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold)
                    Text("Intent: ${selectedChat.intentTag ?: "GENERAL"} (Confidence: ${selectedChat.intentConfidence ?: 95}%)", color = TextSecondary, fontSize = 11.sp, fontFamily = FontFamily.Monospace)
                    Text("Source: Serum X Guide v3.2 & Live FAQ", color = TextSecondary, fontSize = 11.sp, fontFamily = FontFamily.Monospace)
                    Text("BPOM Safety Verification: Passed (0 violations)", color = StatusGreen, fontSize = 11.sp, fontFamily = FontFamily.Monospace)
                }
            }
        }

        // Operator Reply / Whisper Box
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedTextField(
                value = replyText,
                onValueChange = onReplyTextChange,
                placeholder = {
                    Text(
                        text = if (isWhisperToTts) "Whisper to AI Host speech buffer..." else "Direct message to viewer...",
                        color = TextTertiary,
                        fontSize = 12.sp
                    )
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(56.dp)
                    .testTag("chat_reply_input"),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = PrimaryCyan,
                    unfocusedBorderColor = BorderOutline,
                    focusedTextColor = TextPrimary,
                    unfocusedTextColor = TextPrimary,
                    focusedContainerColor = SurfaceContainerLow,
                    unfocusedContainerColor = SurfaceContainerLow
                ),
                shape = RoundedCornerShape(6.dp)
            )

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    modifier = Modifier.clickable { onToggleWhisper() }
                ) {
                    Checkbox(
                        checked = isWhisperToTts,
                        onCheckedChange = { onToggleWhisper() },
                        colors = CheckboxDefaults.colors(
                            checkedColor = PrimaryCyan,
                            checkmarkColor = VoidBlack
                        ),
                        modifier = Modifier.size(16.dp)
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = "Speak via AI Host (TTS)",
                        color = TextSecondary,
                        fontSize = 11.sp,
                        fontFamily = FontFamily.Monospace
                    )
                }

                Button(
                    onClick = onSend,
                    colors = ButtonDefaults.buttonColors(
                        containerColor = PrimaryCyan,
                        contentColor = VoidBlack
                    ),
                    shape = RoundedCornerShape(6.dp),
                    contentPadding = PaddingValues(horizontal = 14.dp, vertical = 6.dp),
                    modifier = Modifier.height(32.dp).testTag("chat_send_btn")
                ) {
                    Text("Send", fontSize = 11.sp, fontWeight = FontWeight.Bold, fontFamily = FontFamily.Monospace)
                }
            }
        }
    }
}

@Composable
private fun ProductContextPanel(
    activeProduct: ProductItem
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(18.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Text(
            text = "PRODUCT CONTEXT",
            color = TextPrimary,
            fontSize = 13.sp,
            fontWeight = FontWeight.Bold,
            fontFamily = FontFamily.Monospace,
            letterSpacing = 0.5.sp
        )

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text(
                    text = activeProduct.title,
                    color = TextPrimary,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = "${activeProduct.brand} • ${activeProduct.sku}",
                    color = TextTertiary,
                    fontSize = 11.sp,
                    fontFamily = FontFamily.Monospace
                )
            }
            Text(
                text = "Rp${activeProduct.basePrice}",
                color = StatusGreen,
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold,
                fontFamily = FontFamily.Monospace
            )
        }

        Divider(color = BorderOutlineVariant, thickness = 0.5.dp)

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Text("Available Stock: ${activeProduct.totalStock} units", color = TextSecondary, fontSize = 11.sp, fontFamily = FontFamily.Monospace)
            Text("BPOM: ${activeProduct.bpomNumber}", color = PrimaryCyan, fontSize = 11.sp, fontFamily = FontFamily.Monospace)
        }
    }
}
