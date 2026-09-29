import React from 'react';
import { Eye, ShoppingCart, DollarSign, MessageSquare, ArrowRight, Sparkles } from 'lucide-react';
import { ProductItem, BroadcastSession } from '../types';

interface OverviewPageProps {
  session: BroadcastSession;
  currentProduct: ProductItem;
  recentEvents: { id: string; time: string; text: string; type: string }[];
}

export const OverviewPage: React.FC<OverviewPageProps> = ({
  session,
  currentProduct,
  recentEvents
}) => {
  return (
    <div className="p-8 max-w-[1440px] mx-auto space-y-8">
      {/* Top Section: Host Preview & Key Stats */}
      <div className="grid grid-cols-12 gap-6 items-start">
        {/* Left: Large AI Host Preview */}
        <div className="col-span-12 lg:col-span-7 bg-[#111827] border border-[#1E293B] rounded-2xl overflow-hidden relative shadow-xl">
          <div className="aspect-video relative bg-slate-950 flex items-center justify-center">
            {/* Host Render Canvas / Video Placeholder */}
            <img
              src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=1000&auto=format&fit=crop&q=80"
              alt="AI Presenter Sari"
              className="w-full h-full object-cover opacity-90"
            />
            {/* Overlay Badges */}
            <div className="absolute top-4 left-4 flex items-center gap-2">
              <span className="px-2.5 py-1 rounded bg-black/60 backdrop-blur border border-white/10 text-xs font-semibold text-white flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                1080p60 Live
              </span>
              <span className="px-2 py-1 rounded bg-black/60 backdrop-blur border border-white/10 text-xs font-mono text-cyan-400">
                Sari Neural v4
              </span>
            </div>

            {/* Current Product Badge in Preview */}
            <div className="absolute bottom-4 left-4 right-4 bg-slate-900/90 backdrop-blur border border-slate-700/60 p-3 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img
                  src={currentProduct.imageUrl}
                  alt={currentProduct.title}
                  className="w-10 h-10 rounded-lg object-cover border border-slate-700"
                />
                <div>
                  <div className="text-xs text-cyan-400 font-semibold uppercase tracking-wider">Now Featuring</div>
                  <div className="text-sm font-bold text-slate-100">{currentProduct.title}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold text-emerald-400">Rp{currentProduct.basePrice.toLocaleString('id-ID')}</div>
                <div className="text-[11px] text-amber-400 font-mono">Stock: {currentProduct.totalStock} pcs</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Key Session Metrics (5 Core Stats) */}
        <div className="col-span-12 lg:col-span-5 space-y-4">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Live Telemetry</div>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-4 bg-[#111827] border border-[#1E293B] rounded-xl">
              <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
                <Eye className="w-3.5 h-3.5 text-cyan-400" />
                <span>Viewers</span>
              </div>
              <div className="text-2xl font-bold font-mono text-slate-100">{session.viewers.toLocaleString()}</div>
              <div className="text-[11px] text-emerald-400 mt-1">TikTok + Shopee</div>
            </div>

            <div className="p-4 bg-[#111827] border border-[#1E293B] rounded-xl">
              <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
                <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                <span>Revenue</span>
              </div>
              <div className="text-2xl font-bold font-mono text-emerald-400">{session.gmv}</div>
              <div className="text-[11px] text-slate-400 mt-1">{session.orders} orders placed</div>
            </div>

            <div className="p-4 bg-[#111827] border border-[#1E293B] rounded-xl">
              <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
                <ShoppingCart className="w-3.5 h-3.5 text-amber-400" />
                <span>Active SKU</span>
              </div>
              <div className="text-lg font-bold font-mono text-slate-100">{currentProduct.sku}</div>
              <div className="text-[11px] text-cyan-400 mt-1">{currentProduct.promoBadge || 'Active Promo'}</div>
            </div>

            <div className="p-4 bg-[#111827] border border-[#1E293B] rounded-xl">
              <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
                <MessageSquare className="w-3.5 h-3.5 text-purple-400" />
                <span>Chat Activity</span>
              </div>
              <div className="text-2xl font-bold font-mono text-slate-100">84 / min</div>
              <div className="text-[11px] text-emerald-400 mt-1">98.4% AI Handled</div>
            </div>
          </div>

          {/* Current AI State Transition Card */}
          <div className="p-4 bg-[#111827] border border-[#1E293B] rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                <span>Current AI State</span>
              </div>
              <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                {session.activeState}
              </span>
            </div>

            {/* Transition Indicator */}
            <div className="flex items-center gap-2 text-xs text-slate-300 font-mono py-1">
              <span className="text-slate-400">SELLING PRODUCT</span>
              <ArrowRight className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-amber-300 font-semibold">CUSTOMER QUESTION</span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-slate-500">RETURN TO SELLING</span>
            </div>

            <div className="text-xs text-slate-400 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
              <span className="text-slate-500 font-mono">Live Speech: </span>
              "{session.liveTranscript}"
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Section: Recent Activity (Latest 5 Events only) */}
      <div className="bg-[#111827] border border-[#1E293B] rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-slate-200 uppercase tracking-wider">Recent Activity</h2>
          <span className="text-xs text-slate-400">Latest 5 events</span>
        </div>
        <div className="divide-y divide-slate-800/80">
          {recentEvents.slice(0, 5).map((evt) => (
            <div key={evt.id} className="py-2.5 flex items-center justify-between text-xs">
              <div className="flex items-center gap-3">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                <span className="text-slate-200">{evt.text}</span>
              </div>
              <span className="font-mono text-slate-400">{evt.time}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
