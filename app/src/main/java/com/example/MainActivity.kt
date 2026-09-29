package com.example

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
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
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.example.model.NavScreen
import com.example.ui.components.EmergencyStopDialog
import com.example.ui.components.PulsingDot
import com.example.ui.components.TopBroadcastBar
import com.example.ui.screens.*
import com.example.ui.theme.*
import com.example.viewmodel.LiveCommerceViewModel
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            AIStudioLiveCommerceTheme {
                LiveCommerceApp()
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LiveCommerceApp(
    viewModel: LiveCommerceViewModel = viewModel()
) {
    val currentScreen by viewModel.currentScreen.collectAsStateWithLifecycle()
    val session by viewModel.session.collectAsStateWithLifecycle()
    val products by viewModel.products.collectAsStateWithLifecycle()
    val selectedProduct by viewModel.selectedProduct.collectAsStateWithLifecycle()
    val scripts by viewModel.scripts.collectAsStateWithLifecycle()
    val chatMessages by viewModel.chatMessages.collectAsStateWithLifecycle()
    val selectedChat by viewModel.selectedChat.collectAsStateWithLifecycle()
    val knowledgeSources by viewModel.knowledgeSources.collectAsStateWithLifecycle()
    val systemNodes by viewModel.systemNodes.collectAsStateWithLifecycle()
    val incidents by viewModel.incidents.collectAsStateWithLifecycle()
    val showEmergencyDialog by viewModel.showEmergencyDialog.collectAsStateWithLifecycle()
    val toastMessage by viewModel.toastMessage.collectAsStateWithLifecycle()
    val ragQuery by viewModel.ragQuery.collectAsStateWithLifecycle()
    val isRagSimulating by viewModel.isRagSimulating.collectAsStateWithLifecycle()

    val snackbarHostState = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()
    val drawerState = rememberDrawerState(initialValue = DrawerValue.Closed)

    BackHandler(enabled = currentScreen != NavScreen.OVERVIEW) {
        viewModel.navigateTo(NavScreen.OVERVIEW)
    }

    LaunchedEffect(toastMessage) {
        toastMessage?.let { msg ->
            snackbarHostState.showSnackbar(
                message = msg,
                duration = SnackbarDuration.Short
            )
            viewModel.clearToast()
        }
    }

    // Modal drawer sheet for small/narrow screens
    ModalNavigationDrawer(
        drawerState = drawerState,
        drawerContent = {
            ModalDrawerSheet(
                drawerContainerColor = VoidBlack,
                drawerContentColor = TextPrimary,
                modifier = Modifier.width(260.dp)
            ) {
                SidebarContent(
                    currentScreen = currentScreen,
                    onNavigate = { screen ->
                        viewModel.navigateTo(screen)
                        scope.launch { drawerState.close() }
                    }
                )
            }
        }
    ) {
        BoxWithConstraints(modifier = Modifier.fillMaxSize().background(VoidBlack)) {
            val isDesktop = maxWidth >= 840.dp

            Row(modifier = Modifier.fillMaxSize()) {
                // FIXED DESKTOP SAAS SIDEBAR
                if (isDesktop) {
                    Surface(
                        color = VoidBlack,
                        modifier = Modifier
                            .width(230.dp)
                            .fillMaxHeight()
                            .border(width = 1.dp, color = BorderOutlineVariant)
                    ) {
                        SidebarContent(
                            currentScreen = currentScreen,
                            onNavigate = { viewModel.navigateTo(it) }
                        )
                    }
                }

                // MAIN CONTENT AREA
                Scaffold(
                    snackbarHost = {
                        SnackbarHost(hostState = snackbarHostState) { data ->
                            Snackbar(
                                snackbarData = data,
                                containerColor = SurfaceContainerHighest,
                                contentColor = TextPrimary,
                                shape = RoundedCornerShape(6.dp),
                                modifier = Modifier.border(1.dp, PrimaryCyan.copy(alpha = 0.5f), RoundedCornerShape(6.dp))
                            )
                        }
                    },
                    topBar = {
                        TopBroadcastBar(
                            session = session,
                            onToggleAiHost = { viewModel.toggleAiHost() },
                            onPauseAi = { viewModel.togglePauseStream() },
                            onTakeOver = { viewModel.toggleTakeover() },
                            onEmergencyStop = { viewModel.triggerEmergencyStop() },
                            onOpenNav = if (!isDesktop) { { scope.launch { drawerState.open() } } } else null
                        )
                    },
                    containerColor = SurfaceCanvas,
                    modifier = Modifier.fillMaxSize()
                ) { innerPadding ->
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(innerPadding)
                    ) {
                        // 1440px Primary Viewport constraint
                        Box(
                            modifier = Modifier
                                .fillMaxSize()
                                .widthIn(max = 1440.dp)
                                .align(Alignment.TopCenter)
                        ) {
                            AnimatedContent(
                                targetState = currentScreen,
                                transitionSpec = {
                                    fadeIn() togetherWith fadeOut()
                                },
                                label = "ScreenTransition"
                            ) { screen ->
                                when (screen) {
                                    NavScreen.OVERVIEW -> OverviewScreen(
                                        session = session,
                                        activeProduct = selectedProduct,
                                        scripts = scripts,
                                        onNavigate = { viewModel.navigateTo(it) },
                                        onPauseAi = { viewModel.togglePauseStream() },
                                        onTakeOver = { viewModel.toggleTakeover() },
                                        onRunDemo = { viewModel.runDemoSimulation() }
                                    )
                                    NavScreen.LIVE_CONTROL -> LiveControlScreen(
                                        session = session,
                                        activeProduct = selectedProduct,
                                        scripts = scripts,
                                        chatMessages = chatMessages,
                                        onToggleMute = { viewModel.toggleMute() },
                                        onPauseHost = { viewModel.togglePauseStream() },
                                        onSkipScript = { viewModel.skipCurrentScript() },
                                        onSendWhisper = { text, isTts -> viewModel.sendOperatorWhisper(text, isTts) },
                                        onSelectProduct = { viewModel.selectProduct(it) }
                                    )
                                    NavScreen.LIVE_CHAT -> LiveChatScreen(
                                        session = session,
                                        chatMessages = chatMessages,
                                        selectedChat = selectedChat,
                                        activeProduct = selectedProduct,
                                        onSelectChat = { viewModel.selectChat(it) },
                                        onSendReply = { text, isTts -> viewModel.sendOperatorWhisper(text, isTts) }
                                    )
                                    NavScreen.PRODUCTS -> ProductsScreen(
                                        products = products,
                                        selectedProduct = selectedProduct,
                                        onSelectProduct = { viewModel.selectProduct(it) },
                                        onResolveConflict = { viewModel.resolveStockConflict(it) }
                                    )
                                    NavScreen.AI_HOST -> AiHostScreen(
                                        session = session,
                                        scripts = scripts,
                                        onToggleAiHost = { viewModel.toggleAiHost() },
                                        onSkipScript = { viewModel.skipCurrentScript() }
                                    )
                                    NavScreen.KNOWLEDGE -> KnowledgeScreen(
                                        knowledgeSources = knowledgeSources,
                                        ragQuery = ragQuery,
                                        isSimulating = isRagSimulating,
                                        onQueryChange = { viewModel.setRagQuery(it) },
                                        onRunSimulation = { viewModel.runRagSimulation() }
                                    )
                                    NavScreen.PLATFORM -> PlatformScreen(
                                        onRefresh = { viewModel.showToast("Refreshed platform adapter statuses.") },
                                        onTestConnection = { platform -> viewModel.showToast("Test ping sent to $platform: 200 OK") }
                                    )
                                    NavScreen.ANALYTICS -> AnalyticsScreen(
                                        session = session,
                                        products = products,
                                        onExportReport = { viewModel.showToast("Exporting session analytics...") }
                                    )
                                    NavScreen.SYSTEM -> SystemScreen(
                                        session = session,
                                        services = systemNodes,
                                        incidents = incidents,
                                        onRunChaosTest = { viewModel.runChaosSimulation(it) },
                                        onRestartService = { svc -> viewModel.showToast("Restarting microservice $svc...") }
                                    )
                                }
                            }
                        }
                    }
                }
            }

            // Emergency Stop Dialog Guardrail
            if (showEmergencyDialog) {
                EmergencyStopDialog(
                    onConfirm = { viewModel.confirmEmergencyHalt() },
                    onDismiss = { viewModel.dismissEmergencyDialog() }
                )
            }
        }
    }
}

@Composable
private fun SidebarContent(
    currentScreen: NavScreen,
    onNavigate: (NavScreen) -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        // App Logo & Brand Header
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp),
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 12.dp)
        ) {
            Box(
                modifier = Modifier
                    .size(28.dp)
                    .clip(RoundedCornerShape(6.dp))
                    .background(PrimaryCyanContainer)
                    .border(1.dp, PrimaryCyan, RoundedCornerShape(6.dp)),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = Icons.Default.Sensors,
                    contentDescription = "Logo",
                    tint = PrimaryCyan,
                    modifier = Modifier.size(16.dp)
                )
            }
            Column {
                Text(
                    text = "AI LIVE",
                    color = TextPrimary,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    fontFamily = FontFamily.Monospace,
                    letterSpacing = 0.5.sp
                )
                Text(
                    text = "Command Center",
                    color = TextTertiary,
                    fontSize = 10.sp,
                    fontFamily = FontFamily.Monospace
                )
            }
        }

        HorizontalDivider(color = BorderOutlineVariant, thickness = 0.5.dp, modifier = Modifier.padding(bottom = 8.dp))

        // 9 Clean Nav Items (Overview, Live Control, Live Chat, Products, AI Host, Knowledge, Platform, Analytics, System)
        NavScreen.values().forEach { screen ->
            val isSelected = currentScreen == screen
            val icon = getScreenIcon(screen)

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(6.dp))
                    .background(if (isSelected) SurfaceContainerHigh else Color.Transparent)
                    .clickable { onNavigate(screen) }
                    .padding(horizontal = 12.dp, vertical = 10.dp)
                    .testTag("nav_${screen.name.lowercase()}"),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Icon(
                    imageVector = icon,
                    contentDescription = screen.label,
                    tint = if (isSelected) PrimaryCyan else TextSecondary,
                    modifier = Modifier.size(18.dp)
                )
                Text(
                    text = screen.label,
                    color = if (isSelected) TextPrimary else TextSecondary,
                    fontSize = 13.sp,
                    fontWeight = if (isSelected) FontWeight.SemiBold else FontWeight.Normal
                )
            }
        }

        Spacer(modifier = Modifier.weight(1f))

        // Clean Footer
        Text(
            text = "v2.4 • Jakarta Cluster",
            color = TextTertiary,
            fontSize = 10.sp,
            fontFamily = FontFamily.Monospace,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
        )
    }
}

private fun getScreenIcon(screen: NavScreen): ImageVector {
    return when (screen) {
        NavScreen.OVERVIEW -> Icons.Default.Dashboard
        NavScreen.LIVE_CONTROL -> Icons.Default.Videocam
        NavScreen.LIVE_CHAT -> Icons.Default.ChatBubbleOutline
        NavScreen.PRODUCTS -> Icons.Default.ShoppingBag
        NavScreen.AI_HOST -> Icons.Default.SmartToy
        NavScreen.KNOWLEDGE -> Icons.Default.AutoStories
        NavScreen.PLATFORM -> Icons.Default.Hub
        NavScreen.ANALYTICS -> Icons.Default.BarChart
        NavScreen.SYSTEM -> Icons.Default.Dns
    }
}
