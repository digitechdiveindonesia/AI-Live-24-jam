import React, { useState } from 'react';
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

const INITIAL_SESSION: BroadcastSession = {
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

const INITIAL_PRODUCTS: ProductItem[] = [
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
  },
  {
    id: 'prod-002',
    sku: 'SKU-002',
    title: 'Barrier Cream 5X Ceramide',
    brand: 'Sari Glow Official',
    category: 'Skincare',
    basePrice: 119000,
    strikePrice: 139000,
    promoBadge: '15% OFF',
    totalStock: 45,
    isLowStock: false,
    isOutOfStock: false,
    isOnAir: false,
    variants: [{ name: '30g Jar', stock: 45 }],
    bpomNumber: 'NA18230104112',
    imageUrl: 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=500&auto=format&fit=crop&q=60',
    syncStatus: 'SYNCED'
  },
  {
    id: 'prod-003',
    sku: 'SKU-003',
    title: 'Micellar Water Deep Clean 250ml',
    brand: 'Sari Glow Official',
    category: 'Cleanser',
    basePrice: 49000,
    strikePrice: 65000,
    promoBadge: '25% OFF',
    totalStock: 12,
    isLowStock: true,
    isOutOfStock: false,
    isOnAir: false,
    variants: [{ name: '250ml Regular', stock: 12 }],
    bpomNumber: 'NA18221203491',
    imageUrl: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=500&auto=format&fit=crop&q=60',
    syncStatus: 'SYNCED'
  },
  {
    id: 'prod-004',
    sku: 'SKU-004',
    title: 'Sunscreen Aqua UV Shield SPF 50+',
    brand: 'Sari Glow Official',
    category: 'Suncare',
    basePrice: 69000,
    strikePrice: 89000,
    promoBadge: '22% OFF',
    totalStock: 6,
    isLowStock: true,
    isOutOfStock: false,
    isOnAir: false,
    variants: [{ name: '50g Tube', stock: 6 }],
    bpomNumber: 'NA18231700982',
    imageUrl: 'https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?w=500&auto=format&fit=crop&q=60',
    syncStatus: 'SYNCED'
  }
];

const INITIAL_MESSAGES: LiveChatMessage[] = [
  {
    id: 'msg-001',
    author: 'Rina Sasmita',
    handle: '@rina_beauty',
    platform: 'TikTok',
    text: 'Kak ini harganya berapa dan promonya sampai jam berapa ya?',
    time: 'Baru saja',
    intent: 'PRICE_QUESTION',
    intentConfidence: 0.98,
    verifiedSku: 'SKU-001',
    guardrailStatus: 'APPROVED',
    aiReply: 'Halo Kak Rina! Serum X Brightening Booster khusus promo live ini diskon 20%, dari Rp99.000 jadi Rp79.000 aja sampai live berakhir kak!',
    latencyMs: 380
  },
  {
    id: 'msg-002',
    author: 'Budi Santoso',
    handle: '@budisantoso88',
    platform: 'Shopee',
    text: 'Bisa COD ke Surabaya nggak kak? Estimasi sampai kapan?',
    time: '1m lalu',
    intent: 'SHIPPING_QUESTION',
    intentConfidence: 0.96,
    verifiedSku: 'SKU-001',
    guardrailStatus: 'APPROVED',
    aiReply: 'Bisa banget COD ke Surabaya Kak Budi! Pesan sebelum jam 4 sore langsung dikirim hari ini juga ya kak.',
    latencyMs: 410
  },
  {
    id: 'msg-003',
    author: 'Nadia Putri',
    handle: '@nadiaskincare',
    platform: 'TikTok',
    text: 'Buat kulit sensitif gampang merah aman gak min?',
    time: '2m lalu',
    intent: 'USAGE_QUESTION',
    intentConfidence: 0.95,
    verifiedSku: 'SKU-001',
    guardrailStatus: 'APPROVED',
    aiReply: 'Aman banget Kak Nadia! Formula Serum X teruji dermatologis dan mengandung Niacinamide lembut ramah kulit sensitif.',
    latencyMs: 395
  }
];

const INITIAL_SCRIPTS = [
  { id: 'sb-1', step: 'HOOK', content: 'Kakak yang kulitnya kusam dan banyak noda hitam, stop scroll sekarang juga!', durationSec: 15, isActive: false },
  { id: 'sb-2', step: 'PROBLEM', content: 'Udah coba berbagai skincare tapi wajah tetap kusam dan noda hitam membandel?', durationSec: 20, isActive: false },
  { id: 'sb-3', step: 'SOLUTION', content: 'Kenalin Serum X Brightening Booster dengan Niacinamide 10% dan Alpha Arbutin murni!', durationSec: 25, isActive: false },
  { id: 'sb-4', step: 'DEMO', content: 'Lihat teksturnya water-gel ringan banget, sekali oles langsung meresap nyaman tanpa lengket.', durationSec: 20, isActive: false },
  { id: 'sb-5', step: 'PROMO', content: 'Khusus live sekarang diskon 20%! Dari harga normal Rp99.000 jadi cuma Rp79.000 aja!', durationSec: 20, isActive: true },
  { id: 'sb-6', step: 'CTA', content: 'Sisa stok tinggal 23 botol lagi kak, klik keranjang kuning nomor satu sebelum kehabisan!', durationSec: 20, isActive: false }
];

export const App: React.FC = () => {
  const [session, setSession] = useState<BroadcastSession>(INITIAL_SESSION);
  const [products, setProducts] = useState<ProductItem[]>(INITIAL_PRODUCTS);
  const [selectedProduct, setSelectedProduct] = useState<ProductItem>(INITIAL_PRODUCTS[0]);
  const [chatMessages, setChatMessages] = useState<LiveChatMessage[]>(INITIAL_MESSAGES);
  const [scriptBlocks, setScriptBlocks] = useState(INITIAL_SCRIPTS);

  const recentEvents = [
    { id: '1', time: '14:22:04', text: 'AI Host seamlessly answered question from @rina_beauty', type: 'AI' },
    { id: '2', time: '14:21:40', text: 'New order #ORD-9921 placed (Rp79.000 - TikTok Shop)', type: 'COMMERCE' },
    { id: '3', time: '14:20:12', text: 'Promotional countdown entered final 15 minutes', type: 'HOST' },
    { id: '4', time: '14:18:50', text: 'Inventory auto-synced with Shopee warehouse API', type: 'SYSTEM' },
    { id: '5', time: '14:15:30', text: 'Dual stream bitrate stabilized at 6000 kbps 1080p60', type: 'STREAM' }
  ];

  const handleToggleAi = () => {
    setSession(prev => ({
      ...prev,
      isAiHostOn: !prev.isAiHostOn,
      activeState: !prev.isAiHostOn ? 'PROMO' : 'PAUSED'
    }));
  };

  const handleTogglePause = () => {
    setSession(prev => ({ ...prev, isPaused: !prev.isPaused }));
  };

  const handleToggleMic = () => {
    setSession(prev => ({
      ...prev,
      isMicTakeover: !prev.isMicTakeover,
      activeState: !prev.isMicTakeover ? 'HUMAN_TAKEOVER' : 'RETURN_TO_SELLING'
    }));
  };

  const handleEmergencyStop = () => {
    if (window.confirm('EMERGENCY HALT: Are you sure you want to stop the live stream and halt the AI Host immediately?')) {
      setSession(prev => ({
        ...prev,
        isLive: false,
        isAiHostOn: false,
        activeState: 'IDLE'
      }));
    }
  };

  const handleSendMessage = (text: string) => {
    const newMsg: LiveChatMessage = {
      id: `msg-${Date.now()}`,
      author: 'Operator Test',
      handle: '@operator',
      platform: 'TikTok',
      text,
      time: 'Baru saja',
      intent: 'GENERAL_QUESTION',
      intentConfidence: 0.94,
      verifiedSku: selectedProduct.sku,
      guardrailStatus: 'APPROVED',
      aiReply: `Menjawab langsung untuk ${selectedProduct.title}: Produk ready stok ${selectedProduct.totalStock} pcs dan bisa langsung checkout di keranjang kuning ya kak!`,
      latencyMs: 360
    };
    setChatMessages(prev => [newMsg, ...prev]);
  };

  const handleUpdateStock = (sku: string, newStock: number) => {
    setProducts(prev => prev.map(p => p.sku === sku ? { ...p, totalStock: newStock } : p));
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
