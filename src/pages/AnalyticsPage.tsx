import React, { useState } from 'react';
import { DollarSign, ShoppingBag, Eye, MessageSquare, Percent, Zap, ChevronDown, ChevronUp } from 'lucide-react';

export const AnalyticsPage: React.FC = () => {
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);

  return (
    <div className="p-8 max-w-[1440px] mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-100">Live Commerce Performance</h2>
          <p className="text-xs text-slate-400">Essential Conversion, Revenue, and AI Autonomous Handling KPIs</p>
        </div>
        <span className="text-xs font-mono text-cyan-400 bg-cyan-950/40 px-3 py-1 rounded-lg border border-cyan-800">
          Session LIVE-001
        </span>
      </div>

      {/* 6 Essential Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="p-4 bg-[#111827] border border-[#1E293B] rounded-xl space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
            <span>GMV</span>
          </div>
          <div className="text-lg font-bold font-mono text-emerald-400">Rp48.2M</div>
          <div className="text-[10px] text-emerald-500 font-medium">+18.4% vs target</div>
        </div>

        <div className="p-4 bg-[#111827] border border-[#1E293B] rounded-xl space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <ShoppingBag className="w-3.5 h-3.5 text-cyan-400" />
            <span>Orders</span>
          </div>
          <div className="text-lg font-bold font-mono text-slate-100">612</div>
          <div className="text-[10px] text-slate-400">Avg basket 78k</div>
        </div>

        <div className="p-4 bg-[#111827] border border-[#1E293B] rounded-xl space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <Eye className="w-3.5 h-3.5 text-blue-400" />
            <span>Viewers</span>
          </div>
          <div className="text-lg font-bold font-mono text-slate-100">1,284</div>
          <div className="text-[10px] text-blue-400">Peak 1,850</div>
        </div>

        <div className="p-4 bg-[#111827] border border-[#1E293B] rounded-xl space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <MessageSquare className="w-3.5 h-3.5 text-purple-400" />
            <span>Chat Messages</span>
          </div>
          <div className="text-lg font-bold font-mono text-slate-100">2,840</div>
          <div className="text-[10px] text-slate-400">47 msgs/min</div>
        </div>

        <div className="p-4 bg-[#111827] border border-[#1E293B] rounded-xl space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <Percent className="w-3.5 h-3.5 text-amber-400" />
            <span>Conversion</span>
          </div>
          <div className="text-lg font-bold font-mono text-amber-400">4.8%</div>
          <div className="text-[10px] text-slate-400">Top 5% rank</div>
        </div>

        <div className="p-4 bg-[#111827] border border-[#1E293B] rounded-xl space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <Zap className="w-3.5 h-3.5 text-emerald-400" />
            <span>AI Response Rate</span>
          </div>
          <div className="text-lg font-bold font-mono text-cyan-400">98.2%</div>
          <div className="text-[10px] text-emerald-400">Avg 420ms latency</div>
        </div>
      </div>

      {/* 2 Simple Visual Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* GMV Timeline Bar Visual */}
        <div className="p-6 bg-[#111827] border border-[#1E293B] rounded-2xl space-y-4">
          <div className="flex justify-between items-center text-xs">
            <span className="font-semibold text-slate-300 uppercase tracking-wider">Hourly GMV Acceleration</span>
            <span className="font-mono text-emerald-400">Rp48.200.000 Total</span>
          </div>
          <div className="h-40 flex items-end gap-3 pt-6 border-b border-slate-800 pb-2">
            {[35, 48, 62, 85, 95, 80, 72, 90].map((h, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-2">
                <div
                  style={{ height: `${h}%` }}
                  className="w-full bg-gradient-to-t from-cyan-600 to-cyan-400 rounded-t-sm transition-all hover:opacity-80"
                />
                <span className="text-[10px] text-slate-400 font-mono">1{i}:00</span>
              </div>
            ))}
          </div>
        </div>

        {/* Channel Breakdown */}
        <div className="p-6 bg-[#111827] border border-[#1E293B] rounded-2xl space-y-4">
          <div className="flex justify-between items-center text-xs">
            <span className="font-semibold text-slate-300 uppercase tracking-wider">Channel Sales Attribution</span>
            <span className="font-mono text-cyan-400">TikTok 62% • Shopee 38%</span>
          </div>
          <div className="h-40 flex flex-col justify-center space-y-4">
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-slate-300">
                <span>TikTok Shop Live</span>
                <span className="font-mono text-cyan-400 font-semibold">Rp29.8M (380 orders)</span>
              </div>
              <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-cyan-500 rounded-full" style={{ width: '62%' }} />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-slate-300">
                <span>Shopee Live</span>
                <span className="font-mono text-amber-400 font-semibold">Rp18.4M (232 orders)</span>
              </div>
              <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-amber-500 rounded-full" style={{ width: '38%' }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Expandable Advanced Analytics */}
      <div className="bg-[#111827] border border-[#1E293B] rounded-xl overflow-hidden">
        <button
          onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
          className="w-full p-4 flex items-center justify-between text-xs font-semibold text-slate-300 hover:bg-slate-800/50 transition-colors"
        >
          <span>Advanced Funnel & SKU Click-Through Telemetry</span>
          {isAdvancedOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        {isAdvancedOpen && (
          <div className="p-5 border-t border-[#1E293B] bg-slate-900/40 grid grid-cols-3 gap-4 text-xs">
            <div className="p-3 bg-slate-900 rounded-lg border border-slate-800">
              <span className="text-slate-400">Yellow Basket CTR</span>
              <div className="text-base font-bold font-mono text-slate-200 mt-1">14.2%</div>
            </div>
            <div className="p-3 bg-slate-900 rounded-lg border border-slate-800">
              <span className="text-slate-400">Cart-to-Checkout Rate</span>
              <div className="text-base font-bold font-mono text-slate-200 mt-1">33.8%</div>
            </div>
            <div className="p-3 bg-slate-900 rounded-lg border border-slate-800">
              <span className="text-slate-400">Avg Retention Time</span>
              <div className="text-base font-bold font-mono text-slate-200 mt-1">4m 18s</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
