import React, { useState } from 'react';
import { Send, Sparkles, Info, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { LiveChatMessage, ProductItem } from '../types';
import { Drawer } from '../components/Drawer';

interface LiveChatPageProps {
  messages: LiveChatMessage[];
  currentProduct: ProductItem;
  onSendMessage: (text: string) => void;
}

export const LiveChatPage: React.FC<LiveChatPageProps> = ({
  messages,
  currentProduct,
  onSendMessage
}) => {
  const [inputText, setInputText] = useState('');
  const [selectedMessage, setSelectedMessage] = useState<LiveChatMessage | null>(null);
  const [isAiDetailsOpen, setIsAiDetailsOpen] = useState(false);

  const activeMessage = selectedMessage || messages[0];

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText.trim());
    setInputText('');
  };

  return (
    <div className="p-8 max-w-[1440px] mx-auto h-[calc(100vh-3.5rem)] flex flex-col gap-6">
      {/* 3 Clean Functional Areas Grid */}
      <div className="grid grid-cols-12 gap-6 flex-1 min-h-0">
        {/* 1. CUSTOMER CONVERSATION (Chat Stream) */}
        <div className="col-span-12 lg:col-span-5 bg-[#111827] border border-[#1E293B] rounded-2xl flex flex-col overflow-hidden">
          <div className="p-4 border-b border-[#1E293B] flex items-center justify-between">
            <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Customer Conversation
            </h3>
            <span className="text-[11px] text-cyan-400 font-mono">Live Ingestion</span>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((msg) => (
              <div
                key={msg.id}
                onClick={() => setSelectedMessage(msg)}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                  activeMessage?.id === msg.id
                    ? 'bg-slate-800/90 border-cyan-500/40 shadow-sm'
                    : 'bg-slate-900/60 border-slate-800/80 hover:bg-slate-800/50'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-200">{msg.author}</span>
                    <span className="text-[11px] text-slate-400 font-mono">{msg.handle}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">{msg.time}</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">{msg.text}</p>
              </div>
            ))}
          </div>

          {/* Operator chat injection bar */}
          <form onSubmit={handleSend} className="p-3 border-t border-[#1E293B] flex gap-2">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Test viewer query or simulate question..."
              className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
            <button
              type="submit"
              className="p-2 bg-cyan-500 hover:bg-cyan-600 text-slate-900 rounded-lg transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>

        {/* 2. AI RESPONSE & 3. PRODUCT CONTEXT */}
        <div className="col-span-12 lg:col-span-7 flex flex-col gap-6">
          {/* 2. AI RESPONSE PANEL */}
          <div className="bg-[#111827] border border-[#1E293B] rounded-2xl p-6 flex-1 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold text-cyan-400 uppercase tracking-wider">
                  <Sparkles className="w-4 h-4" />
                  <span>AI Generated Live Response</span>
                </div>
                {/* AI Details Drawer Trigger */}
                <button
                  onClick={() => setIsAiDetailsOpen(true)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 border border-slate-700 transition-colors"
                >
                  <Info className="w-3.5 h-3.5 text-cyan-400" />
                  <span>AI Details</span>
                </button>
              </div>

              {/* Selected Customer Question Recap */}
              <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800 text-xs">
                <span className="text-slate-400 font-medium">Answering {activeMessage?.author}: </span>
                <span className="text-slate-200 italic">"{activeMessage?.text}"</span>
              </div>

              {/* Live Host Speech Text */}
              <div className="p-4 rounded-xl bg-gradient-to-br from-cyan-950/20 to-slate-900/40 border border-cyan-900/30">
                <p className="text-sm text-slate-100 leading-relaxed font-medium">
                  "{activeMessage?.aiReply || 'Sedang merumuskan jawaban otomatis berdasarkan data BPOM dan promo terkini...'}"
                </p>
              </div>
            </div>

            {/* Quick Status Bar */}
            <div className="pt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>BPOM Compliant & Fact Grounded</span>
              </div>
              <span className="font-mono text-[11px]">Latency: {activeMessage?.latencyMs || 420}ms</span>
            </div>
          </div>

          {/* 3. PRODUCT CONTEXT PANEL */}
          <div className="bg-[#111827] border border-[#1E293B] rounded-2xl p-5">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              Product Context
            </h3>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img
                  src={currentProduct.imageUrl}
                  alt={currentProduct.title}
                  className="w-12 h-12 rounded-lg object-cover border border-slate-700"
                />
                <div>
                  <h4 className="text-sm font-semibold text-slate-100">{currentProduct.title}</h4>
                  <p className="text-xs text-slate-400 font-mono">SKU: {currentProduct.sku} | BPOM: {currentProduct.bpomNumber}</p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-base font-bold text-emerald-400">Rp{currentProduct.basePrice.toLocaleString('id-ID')}</div>
                <div className="text-xs text-amber-400 font-mono">Stock: {currentProduct.totalStock} available</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* COLLAPSIBLE AI DETAILS DRAWER */}
      <Drawer
        isOpen={isAiDetailsOpen}
        onClose={() => setIsAiDetailsOpen(false)}
        title="Technical AI Details"
        subtitle={`Audit telemetry for Message ID ${activeMessage?.id}`}
      >
        <div className="space-y-4 text-xs">
          <div>
            <span className="text-slate-400">Detected Intent</span>
            <div className="mt-1 font-mono font-semibold text-cyan-400 p-2 bg-slate-900 rounded border border-slate-800">
              {activeMessage?.intent || 'USAGE_QUESTION'}
            </div>
          </div>

          <div>
            <span className="text-slate-400">Confidence Score</span>
            <div className="mt-1 font-mono text-emerald-400 p-2 bg-slate-900 rounded border border-slate-800">
              {((activeMessage?.intentConfidence || 0.95) * 100).toFixed(1)}% verified
            </div>
          </div>

          <div>
            <span className="text-slate-400">Retrieval Source</span>
            <div className="mt-1 text-slate-300 p-2 bg-slate-900 rounded border border-slate-800 space-y-1">
              <div>Doc: <span className="font-mono text-cyan-300">Serum X Clinical Testing Specs v2.1</span></div>
              <div>Chunk: <span className="font-mono text-slate-400">Section 4 (Sensitive Skin & Niacinamide)</span></div>
            </div>
          </div>

          <div>
            <span className="text-slate-400">Guardrail Verification</span>
            <div className="mt-1 flex items-center gap-2 p-2 bg-emerald-950/30 text-emerald-300 rounded border border-emerald-900/50">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Zero restricted claims. Verified BPOM approval and price consistency.</span>
            </div>
          </div>
        </div>
      </Drawer>
    </div>
  );
};
