import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { OverviewPage } from './pages/OverviewPage';
import { LiveControlPage } from './pages/LiveControlPage';
import { LiveChatPage } from './pages/LiveChatPage';
import { ProductsPage } from './pages/ProductsPage';
import { AiHostPage } from './pages/AiHostPage';
import { KnowledgePage } from './pages/KnowledgePage';
import { PlatformPage } from './pages/PlatformPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { SystemPage } from './pages/SystemPage';
import { BroadcastSession, ProductItem, LiveChatMessage } from './types';

// Bootstrap development fallback data used only until initial API load resolves
const BOOTSTRAP_SESSION: BroadcastSession = {
  id: 'LIVE-001',
  title: 'Sari Glow Mega Flash Sale Payday',
  runtime: '02:14:30',
  viewers: 1284,
  gmv: 'Rp48.200.000',
  orders: 612,
  isLive: true,
  isAiHostOn: true,
  isMuted: false,
  isPaused: false,
  isMicTakeover: false,
  activeState: 'PROMO',
  liveTranscript: 'Sedang menjelaskan promo Serum X: Dapatkan diskon 20% khusus checkout keranjang kuning sekarang juga ya kak!'
};

const BOOTSTRAP_PRODUCTS: ProductItem[] = [
  {
    id: 'prod-001',
    sku: 'SKU-001',
    title: 'Serum X – Brightening Booster',
    brand: 'Sari Glow Official',
    category: 'Skincare',
    basePrice: 79000,
    strikePrice: 99000,
    promoBadge: '20% OFF',
    totalStock: 23,
    isLowStock: false,
    isOutOfStock: false,
    isOnAir: true,
    variants: [{ name: '20ml Travel Size', stock: 15 }, { name: '50ml Jumbo', stock: 8 }],
    bpomNumber: 'NA18231900452',
    imageUrl: 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=500&auto=format&fit=crop&q=60',
    syncStatus: 'SYNCED'
  }
];

export const App: React.FC = () => {
  const [session, setSession] = useState<BroadcastSession>(BOOTSTRAP_SESSION);
  const [products, setProducts] = useState<ProductItem[]>(BOOTSTRAP_PRODUCTS);
  const [selectedProduct, setSelectedProduct] = useState<ProductItem>(BOOTSTRAP_PRODUCTS[0]);
  const [chatMessages, setChatMessages] = useState<LiveChatMessage[]>([]);
  const [scriptBlocks, setScriptBlocks] = useState<any[]>([]);
  const [recentEvents, setRecentEvents] = useState<any[]>([]);

  // 1. Fetch Real Backend Data on Mount
  useEffect(() => {
    // A. Fetch Authoritative Products
    fetch('/api/products')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.products && data.products.length > 0) {
          const mapped: ProductItem[] = data.products.map((p: any, idx: number) => ({
            id: p.sku || `prod-${idx}`,
            sku: p.sku,
            title: p.name,
            brand: p.brand || 'Sari Glow Official',
            category: p.category,
            basePrice: p.salePrice || p.basePrice,
            strikePrice: p.salePrice < p.basePrice ? p.basePrice : undefined,
            promoBadge: p.promoTitle || (p.discountPercent > 0 ? `${p.discountPercent}% OFF` : undefined),
            totalStock: p.totalStock ?? 0,
            isLowStock: p.isLowStock ?? false,
            isOutOfStock: p.isOutOfStock ?? false,
            isOnAir: idx === 0,
            variants: (p.variants || []).map((v: any) => ({ name: v.variant_name || v.name, stock: v.stock })),
            bpomNumber: p.bpomNumber || '',
            imageUrl: 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=500&auto=format&fit=crop&q=60',
            syncStatus: 'SYNCED'
          }));
          setProducts(mapped);
          setSelectedProduct(mapped[0]);
        }
      })
      .catch(err => console.warn('[App] Could not load products:', err));

    // B. Fetch Live Session State
    fetch('/api/session/status')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.session) {
          const s = data.session;
          setSession(prev => ({
            ...prev,
            id: s.id || prev.id,
            title: s.title || prev.title,
            isLive: s.status === 'RUNNING' || s.status === 'LIVE',
            isAiHostOn: s.is_ai_host_on ?? prev.isAiHostOn,
            isPaused: s.is_paused ?? prev.isPaused,
            isMicTakeover: s.is_mic_takeover ?? prev.isMicTakeover,
            activeState: s.current_host_state || prev.activeState
          }));
        }
      })
      .catch(err => console.warn('[App] Could not load session status:', err));

    // C. Fetch Conversations
    fetch('/api/conversations')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.conversations) {
          const msgs: LiveChatMessage[] = [];
          data.conversations.forEach((conv: any) => {
            (conv.recentMessages || []).forEach((m: any) => {
              msgs.push({
                id: m.message_id || `msg-${Date.now()}`,
                author: conv.customer_name || 'Viewer',
                handle: conv.handle || '@viewer',
                platform: conv.platform || 'TikTok',
                text: m.content || '',
                time: 'Baru saja',
                intent: m.metadata?.intent || 'GENERAL_QUESTION',
                intentConfidence: 0.95,
                verifiedSku: m.metadata?.productId || 'SKU-001',
                guardrailStatus: m.metadata?.guardrailStatus || 'APPROVED',
                aiReply: m.role === 'AI' ? m.content : undefined,
                latencyMs: m.metadata?.latencyMs || 350
              });
            });
          });
          if (msgs.length > 0) setChatMessages(msgs);
        }
      })
      .catch(err => console.warn('[App] Could not load conversations:', err));

    // D. Fetch Selling Scripts
    fetch('/api/scripts')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.scriptBlocks) {
          const blocks = data.scriptBlocks.map((sb: any) => ({
            id: sb.id,
            step: sb.step_name,
            content: sb.content,
            durationSec: sb.duration_sec,
            isActive: sb.is_active
          }));
          setScriptBlocks(blocks);
        }
      })
      .catch(err => console.warn('[App] Could not load scripts:', err));

    // E. Fetch Events
    fetch('/api/events')
      .then(res => res.json())
      .then(data => {
        if (data.auditLogs) {
          const evts = data.auditLogs.map((log: any) => ({
            id: log.id,
            time: new Date(log.timestamp).toLocaleTimeString('id-ID'),
            text: `${log.action}: ${log.target}`,
            type: log.operator === 'SYSTEM' ? 'SYSTEM' : 'AI'
          }));
          setRecentEvents(evts);
        }
      })
      .catch(err => console.warn('[App] Could not load events:', err));
  }, []);

  const handleToggleAi = async () => {
    try {
      const res = await fetch('/api/host/toggle', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setSession(prev => ({
          ...prev,
          isAiHostOn: data.isAiHostOn,
          activeState: data.state
        }));
      }
    } catch {
      setSession(prev => ({ ...prev, isAiHostOn: !prev.isAiHostOn }));
    }
  };

  const handleTogglePause = async () => {
    const isPaused = session.isPaused;
    const endpoint = isPaused ? '/api/session/resume' : '/api/session/pause';
    try {
      const res = await fetch(endpoint, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setSession(prev => ({ ...prev, isPaused: !isPaused }));
      }
    } catch {
      setSession(prev => ({ ...prev, isPaused: !isPaused }));
    }
  };

  const handleToggleMic = async () => {
    try {
      const res = await fetch('/api/host/takeover', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setSession(prev => ({
          ...prev,
          isMicTakeover: data.isMicTakeover,
          activeState: data.state
        }));
      }
    } catch {
      setSession(prev => ({ ...prev, isMicTakeover: !prev.isMicTakeover }));
    }
  };

  const handleEmergencyStop = async () => {
    if (window.confirm('EMERGENCY HALT: Are you sure you want to stop the live stream and halt the AI Host immediately?')) {
      try {
        await fetch('/api/session/stop', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: 'EMERGENCY_HALT', cancelCurrentResponse: true })
        });
      } catch (err) {
        console.error('Stop error:', err);
      }
      setSession(prev => ({
        ...prev,
        isLive: false,
        isAiHostOn: false,
        activeState: 'IDLE'
      }));
    }
  };

  const handleSendMessage = async (text: string) => {
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          author: 'Operator Test',
          handle: '@operator',
          platform: 'TikTok',
          sku: selectedProduct.sku,
          skipTtsDelay: true
        })
      });
      const data = await res.json();

      const newMsg: LiveChatMessage = {
        id: `msg-${Date.now()}`,
        author: 'Operator Test',
        handle: '@operator',
        platform: 'TikTok',
        text,
        time: 'Baru saja',
        intent: data.data?.intent || 'GENERAL_QUESTION',
        intentConfidence: data.data?.confidence || 0.95,
        verifiedSku: selectedProduct.sku,
        guardrailStatus: data.data?.guardrailStatus || 'APPROVED',
        aiReply: data.data?.response || `Menjawab untuk ${selectedProduct.title}: Produk siap checkout di keranjang kuning ya kak!`,
        latencyMs: data.data?.latencyMs || 340
      };
      setChatMessages(prev => [newMsg, ...prev]);
    } catch (err) {
      console.error('Chat error:', err);
    }
  };

  const handleUpdateStock = async (sku: string, newStock: number) => {
    try {
      await fetch(`/api/products/${sku}/stock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newStock })
      });
    } catch (err) {
      console.warn('Could not persist stock:', err);
    }

    setProducts(prev => prev.map(p => (p.sku === sku ? { ...p, totalStock: newStock } : p)));
    if (selectedProduct.sku === sku) {
      setSelectedProduct(prev => ({ ...prev, totalStock: newStock }));
    }
  };

  const handleSelectScriptBlock = (id: string) => {
    setScriptBlocks(prev => prev.map(b => ({ ...b, isActive: b.id === id })));
  };

  return (
    <BrowserRouter>
      <div className="flex h-screen w-screen overflow-hidden bg-[#0B0F19] text-[#F1F5F9]">
        {/* Simplified Sidebar */}
        <Sidebar />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Global Compact Header */}
          <Header
            isLive={session.isLive}
            sessionId={session.id}
            platform="TikTok + Shopee"
            isAiHostOn={session.isAiHostOn}
            isPaused={session.isPaused}
            isMicTakeover={session.isMicTakeover}
            onToggleAi={handleToggleAi}
            onTogglePause={handleTogglePause}
            onToggleMic={handleToggleMic}
            onEmergencyStop={handleEmergencyStop}
          />

          {/* 9 Simplified Views */}
          <main className="flex-1 overflow-y-auto">
            <Routes>
              <Route
                path="/"
                element={
                  <OverviewPage
                    session={session}
                    currentProduct={selectedProduct}
                    recentEvents={recentEvents}
                  />
                }
              />
              <Route
                path="/live-control"
                element={
                  <LiveControlPage
                    session={session}
                    currentProduct={selectedProduct}
                    scriptBlocks={scriptBlocks}
                    onToggleAi={handleToggleAi}
                    onToggleTakeover={handleToggleMic}
                    onSelectScriptBlock={handleSelectScriptBlock}
                  />
                }
              />
              <Route
                path="/live-chat"
                element={
                  <LiveChatPage
                    messages={chatMessages}
                    currentProduct={selectedProduct}
                    onSendMessage={handleSendMessage}
                  />
                }
              />
              <Route
                path="/products"
                element={
                  <ProductsPage
                    products={products}
                    onSelectProduct={setSelectedProduct}
                    onUpdateStock={handleUpdateStock}
                  />
                }
              />
              <Route
                path="/ai-host"
                element={
                  <AiHostPage
                    session={session}
                    onToggleAi={handleToggleAi}
                  />
                }
              />
              <Route path="/knowledge" element={<KnowledgePage />} />
              <Route path="/platform" element={<PlatformPage />} />
              <Route path="/analytics" element={<AnalyticsPage />} />
              <Route path="/system" element={<SystemPage onEmergencyStop={handleEmergencyStop} />} />
            </Routes>
          </main>
        </div>
      </div>
    </BrowserRouter>
  );
};

export default App;
