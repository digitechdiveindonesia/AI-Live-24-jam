package com.example.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.example.data.MockLiveRepository
import com.example.model.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch

class LiveCommerceViewModel(application: Application = Application()) : AndroidViewModel(application) {

    private val _currentScreen = MutableStateFlow(NavScreen.OVERVIEW)
    val currentScreen: StateFlow<NavScreen> = _currentScreen.asStateFlow()

    private val _session = MutableStateFlow(MockLiveRepository.initialSession)
    val session: StateFlow<BroadcastSession> = _session.asStateFlow()

    private val _products = MutableStateFlow(MockLiveRepository.initialProducts)
    val products: StateFlow<List<ProductItem>> = _products.asStateFlow()

    private val _selectedProduct = MutableStateFlow(MockLiveRepository.initialProducts.first())
    val selectedProduct: StateFlow<ProductItem> = _selectedProduct.asStateFlow()

    private val _scripts = MutableStateFlow(MockLiveRepository.initialScriptQueue)
    val scripts: StateFlow<List<ScriptBlock>> = _scripts.asStateFlow()

    private val _chatMessages = MutableStateFlow(MockLiveRepository.initialChatMessages)
    val chatMessages: StateFlow<List<LiveChatMessage>> = _chatMessages.asStateFlow()

    private val _selectedChat = MutableStateFlow(MockLiveRepository.initialChatMessages.first())
    val selectedChat: StateFlow<LiveChatMessage> = _selectedChat.asStateFlow()

    private val _knowledgeSources = MutableStateFlow(MockLiveRepository.initialKnowledgeSources)
    val knowledgeSources: StateFlow<List<KnowledgeDoc>> = _knowledgeSources.asStateFlow()

    private val _systemNodes = MutableStateFlow(MockLiveRepository.initialSystemServices)
    val systemNodes: StateFlow<List<SystemServiceNode>> = _systemNodes.asStateFlow()

    private val _incidents = MutableStateFlow(MockLiveRepository.initialIncidents)
    val incidents: StateFlow<List<IncidentLog>> = _incidents.asStateFlow()

    // Interactive UI state
    private val _showEmergencyDialog = MutableStateFlow(false)
    val showEmergencyDialog: StateFlow<Boolean> = _showEmergencyDialog.asStateFlow()

    private val _toastMessage = MutableStateFlow<String?>(null)
    val toastMessage: StateFlow<String?> = _toastMessage.asStateFlow()

    // RAG Simulator State
    private val _ragQuery = MutableStateFlow("Serum X teksturnya seperti apa dan cara pakainya gimana?")
    val ragQuery: StateFlow<String> = _ragQuery.asStateFlow()

    private val _isRagSimulating = MutableStateFlow(false)
    val isRagSimulating: StateFlow<Boolean> = _isRagSimulating.asStateFlow()

    fun navigateTo(screen: NavScreen) {
        _currentScreen.value = screen
    }

    fun toggleAiHost() {
        val willBeOn = !_session.value.isAiHostOn
        _session.update {
            it.copy(
                isAiHostOn = willBeOn,
                activeState = if (willBeOn) "PROMO" else "PAUSED"
            )
        }
        showToast(if (willBeOn) "AI Host Activated (Autonomous Selling Loop)" else "AI Host Paused (Operator Standby)")
    }

    fun toggleMute() {
        _session.update { it.copy(isMuted = !it.isMuted) }
        showToast(if (_session.value.isMuted) "Host Audio Muted" else "Host Audio Active")
    }

    fun togglePauseStream() {
        val willBePaused = !_session.value.isPaused
        _session.update { it.copy(isPaused = willBePaused) }
        showToast(if (willBePaused) "Broadcast Paused (Holding on Slate)" else "Broadcast Stream Resumed")
    }

    fun toggleTakeover() {
        val willTakeover = !_session.value.isMicTakeover
        _session.update {
            it.copy(
                isMicTakeover = willTakeover,
                activeState = if (willTakeover) "HUMAN_TAKEOVER" else "RETURN_TO_SELLING"
            )
        }
        showToast(if (willTakeover) "Operator Mic Overridden (Live Air)" else "Control Returned to Autonomous AI Host")
    }

    fun triggerEmergencyStop() {
        _showEmergencyDialog.value = true
    }

    fun dismissEmergencyDialog() {
        _showEmergencyDialog.value = false
    }

    fun confirmEmergencyHalt() {
        _session.update { it.copy(isLive = false, isAiHostOn = false, activeState = "IDLE") }
        _showEmergencyDialog.value = false
        showToast("EMERGENCY STOP TRIGGERED: Broadcast halted immediately.")
    }

    fun selectProduct(product: ProductItem) {
        _selectedProduct.value = product
        _products.update { list ->
            list.map { it.copy(isOnAir = it.id == product.id) }
        }
        _session.update { it.copy(activeSku = "${product.title} (${product.sku})") }
        showToast("Active On-Air Product Switched to ${product.sku}")
    }

    fun resolveStockConflict(action: String) {
        _products.update { list ->
            list.map { prod ->
                if (prod.sku == "SKU-004") {
                    when (action) {
                        "INTERNAL" -> prod.copy(totalStock = 8, syncStatus = "SYNCED", conflict = null)
                        "SHOPEE" -> prod.copy(totalStock = 6, syncStatus = "SYNCED", conflict = null)
                        else -> prod.copy(totalStock = 6, syncStatus = "CLAMPED_SAFE", conflict = null)
                    }
                } else prod
            }
        }
        showToast("Stock discrepancy resolved: $action applied across channels.")
    }

    fun skipCurrentScript() {
        _scripts.update { list ->
            val activeIdx = list.indexOfFirst { it.status == ScriptStatus.ACTIVE }
            if (activeIdx != -1 && activeIdx + 1 < list.size) {
                list.mapIndexed { idx, item ->
                    when (idx) {
                        activeIdx -> item.copy(status = ScriptStatus.DONE, currentProgress = 1f)
                        activeIdx + 1 -> item.copy(status = ScriptStatus.ACTIVE, currentProgress = 0.1f)
                        else -> item
                    }
                }
            } else list
        }
        showToast("Skipped current pitch. Advanced to next script block.")
    }

    fun selectChat(chat: LiveChatMessage) {
        _selectedChat.value = chat
    }

    fun sendOperatorWhisper(text: String, isWhisperToTts: Boolean) {
        if (text.isBlank()) return
        val newMsg = LiveChatMessage(
            id = "chat-${System.currentTimeMillis()}",
            author = "Operator (Rian W.)",
            handle = "@broadcast_lead",
            platform = "Internal",
            time = "Just now",
            message = text,
            aiResponse = "Menjawab untuk ${_selectedProduct.value.title}: Produk ready stok ${_selectedProduct.value.totalStock} pcs dan bisa langsung checkout di keranjang kuning ya kak!",
            intentTag = "GENERAL_QUESTION",
            intentConfidence = 100,
            isAudited = true,
            spokenLiveSeconds = 1.8
        )
        _chatMessages.update { listOf(newMsg) + it }
        _selectedChat.value = newMsg
        showToast(if (isWhisperToTts) "AI Host answered & spoken to live stream (APPROVED)" else "Direct chat reply broadcasted")
    }

    fun setRagQuery(query: String) {
        _ragQuery.value = query
    }

    fun runRagSimulation() {
        viewModelScope.launch {
            _isRagSimulating.value = true
            delay(300)
            _isRagSimulating.value = false
            showToast("Vector similarity computed: 3 chunks retrieved (98.4% grounded)")
        }
    }

    fun runDemoSimulation() {
        viewModelScope.launch {
            showToast("Starting Demo Simulation: Host selling -> Customer question -> AI Answer -> Return to Selling")
            _session.update { it.copy(activeState = "CUSTOMER_INTERRUPTION") }
            delay(600)
            _session.update { it.copy(activeState = "ANSWERING") }
            delay(800)
            _session.update { it.copy(activeState = "RETURN_TO_SELLING") }
            delay(600)
            _session.update { it.copy(activeState = "PROMO") }
            showToast("Demo Simulation Complete: Answered factually & returned to selling loop.")
        }
    }

    fun runChaosSimulation(testName: String) {
        showToast("Simulated chaos test: '$testName' - Autonomous failover succeeded with 0 drop.")
    }

    fun showToast(msg: String) {
        _toastMessage.value = msg
    }

    fun clearToast() {
        _toastMessage.value = null
    }
}
