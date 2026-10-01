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
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.model.KnowledgeDoc
import com.example.ui.components.PulsingDot
import com.example.ui.theme.*

@Composable
fun KnowledgeScreen(
    knowledgeSources: List<KnowledgeDoc>,
    ragQuery: String,
    isSimulating: Boolean,
    onQueryChange: (String) -> Unit,
    onRunSimulation: () -> Unit,
    modifier: Modifier = Modifier
) {
    var showRagTester by remember { mutableStateOf(false) }

    LazyColumn(
        modifier = modifier
            .fillMaxSize()
            .background(SurfaceCanvas)
            .padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(20.dp)
    ) {
        // HEADER & INDEXING STATUS
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(
                        text = "KNOWLEDGE & GROUNDING",
                        color = TextPrimary,
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold,
                        fontFamily = FontFamily.Monospace,
                        letterSpacing = (-0.5).sp
                    )
                    Text(
                        text = "Verified product facts, BPOM compliance rules, and live FAQ embeddings",
                        color = TextSecondary,
                        fontSize = 12.sp
                    )
                }

                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    // Indexing Status Pill
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                        modifier = Modifier
                            .background(SurfaceContainerLow, RoundedCornerShape(4.dp))
                            .border(1.dp, StatusGreen.copy(alpha = 0.4f), RoundedCornerShape(4.dp))
                            .padding(horizontal = 8.dp, vertical = 4.dp)
                    ) {
                        PulsingDot(color = StatusGreen, size = 6)
                        Text(
                            text = "1,842 Chunks Indexed (100% Synced)",
                            color = StatusGreen,
                            fontSize = 11.sp,
                            fontFamily = FontFamily.Monospace
                        )
                    }

                    // Open RAG Tester Button
                    Button(
                        onClick = { showRagTester = !showRagTester },
                        colors = ButtonDefaults.buttonColors(
                            containerColor = if (showRagTester) PrimaryCyan else SurfaceContainerHigh,
                            contentColor = if (showRagTester) VoidBlack else TextPrimary
                        ),
                        shape = RoundedCornerShape(6.dp),
                        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp),
                        modifier = Modifier.height(34.dp).testTag("toggle_rag_tester_btn")
                    ) {
                        Icon(
                            imageVector = Icons.Default.Search,
                            contentDescription = null,
                            modifier = Modifier.size(14.dp)
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = if (showRagTester) "Close Tester" else "RAG Tester",
                            fontSize = 11.sp,
                            fontFamily = FontFamily.Monospace,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }
        }

        // DEDICATED RAG TESTER DRAWER / SECTION (Collapsible)
        item {
            AnimatedVisibility(visible = showRagTester) {
                Surface(
                    color = SurfaceContainerLowest,
                    shape = RoundedCornerShape(8.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, PrimaryCyan.copy(alpha = 0.5f)),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(
                        modifier = Modifier.padding(18.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Text(
                            text = "RAG RETRIEVAL SIMULATOR",
                            color = PrimaryCyan,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            fontFamily = FontFamily.Monospace
                        )

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(10.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            OutlinedTextField(
                                value = ragQuery,
                                onValueChange = onQueryChange,
                                placeholder = { Text("Enter sample customer query to test semantic retrieval...", fontSize = 12.sp) },
                                modifier = Modifier.weight(1f).height(50.dp),
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

                            Button(
                                onClick = onRunSimulation,
                                enabled = !isSimulating,
                                colors = ButtonDefaults.buttonColors(containerColor = PrimaryCyan, contentColor = VoidBlack),
                                shape = RoundedCornerShape(6.dp),
                                modifier = Modifier.height(50.dp)
                            ) {
                                Text(if (isSimulating) "Querying..." else "Test Retrieval", fontSize = 11.sp, fontWeight = FontWeight.Bold, fontFamily = FontFamily.Monospace)
                            }
                        }

                        // Simulation Result Pill
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .background(SurfaceContainerLow, RoundedCornerShape(6.dp))
                                .padding(12.dp)
                        ) {
                            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                Text("RETRIEVED CONTEXT (SIMILARITY 98.4%):", color = TextTertiary, fontSize = 9.sp, fontFamily = FontFamily.Monospace)
                                Text("\"Serum X mengandung 10% Niacinamide + Ceramide NP. Tekstur water-gel ringan mudah meresap tanpa rasa lengket. Gunakan 3-4 tetes sebelum pelembab.\"", color = TextPrimary, fontSize = 12.sp)
                                Text("Matched Source: Serum X Product Guide v3.2 (Chunk #14)", color = StatusGreen, fontSize = 10.sp, fontFamily = FontFamily.Monospace)
                            }
                        }
                    }
                }
            }
        }

        // MAIN SCREEN: KNOWLEDGE SOURCES & RULESETS
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
                        text = "GROUNDING SOURCES & POLICIES",
                        color = TextPrimary,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Bold,
                        fontFamily = FontFamily.Monospace,
                        letterSpacing = 0.5.sp
                    )

                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        knowledgeSources.forEach { doc ->
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
                                    Box(
                                        modifier = Modifier
                                            .background(
                                                if (doc.isEnforced) AlertRedContainer.copy(alpha = 0.3f) else SurfaceContainerHigh,
                                                RoundedCornerShape(4.dp)
                                            )
                                            .padding(horizontal = 6.dp, vertical = 3.dp)
                                    ) {
                                        Text(
                                            text = doc.type.uppercase(),
                                            color = if (doc.isEnforced) AlertRed else TextSecondary,
                                            fontSize = 9.sp,
                                            fontWeight = FontWeight.Bold,
                                            fontFamily = FontFamily.Monospace
                                        )
                                    }

                                    Column {
                                        Text(
                                            text = doc.title,
                                            color = TextPrimary,
                                            fontSize = 12.sp,
                                            fontWeight = FontWeight.SemiBold
                                        )
                                        Text(
                                            text = "${doc.sku} • ${doc.chunksCount} chunks • ${doc.tokensCount} tokens",
                                            color = TextTertiary,
                                            fontSize = 10.sp,
                                            fontFamily = FontFamily.Monospace
                                        )
                                    }
                                }

                                Text(
                                    text = doc.statusText,
                                    color = if (doc.statusText == "Enforced") AlertRed else StatusGreen,
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Medium,
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
