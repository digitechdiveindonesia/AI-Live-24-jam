import React from 'react';
import { Play, Pause, Mic, Radio, ChevronRight } from 'lucide-react';
import { ProductItem, BroadcastSession } from '../types';

interface LiveControlPageProps {
  session: BroadcastSession;
  currentProduct: ProductItem;
  scriptBlocks: { id: string; step: string; content: string; durationSec: number; isActive: boolean }[];
  onToggleAi: () => void;
  onToggleTakeover: () => void;
  onSelectScriptBlock: (id: string) => void;
}

export const LiveControlPage: React.FC<LiveControlPageProps> = ({
  session,
  currentProduct,
  scriptBlocks,
  onToggleAi,
  onToggleTakeover,
  onSelectScriptBlock
}) => {
  const currentBlock = scriptBlocks.find(b => b.isActive) || scriptBlocks[0];
  const nextBlocks = scriptBlocks.filter(b => !b.isActive);

  return (
    <div className="p-8 max-w-[1440px] mx-auto space-y-6">
      {/* Primary Layout: Split Preview & Host Controls */}
      <div className="grid grid-cols-12 gap-6 items-start">
        {/* LEFT: Large Talking-Head Preview */}
        <div className="col-span-12 lg:col-span-7 bg-[#111827] border border-[#1E293B] rounded-2xl overflow-hidden shadow-xl">
          <div className="aspect-video relative bg-slate-950">
            <img
              src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=1000&auto=format&fit=crop&q=80"
              alt="AI Talking Head Preview"
              className="w-full h-full object-cover"
            />
            {/* Live Indicator */}
            <div className="absolute top-4 left-4 flex items-center gap-2">
              <span className="px-2.5 py-1 rounded bg-black/60 backdrop-blur border border-white/10 text-xs font-semibold text-white flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-red-500 animate-pulse" />
                Sari AI Host — Active
              </span>
            </div>
            {/* 24/7 Watchdog & Reliability Badge */}
            <div className="absolute top-4 right-4 flex items-center gap-2">
              <span className="px-2.5 py-1 rounded bg-black/60 backdrop-blur border border-white/10 text-[11px] font-mono font-medium text-emerald-400 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                24/7 Watchdog: Active
              </span>
            </div>
            {/* Audio Telemetry Overlay */}
            <div className="absolute bottom-4 left-4 right-4 bg-black/70 backdrop-blur border border-white/10 p-3 rounded-xl flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 font-mono text-slate-300">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span>Lip-sync Latency: 42ms</span>
              </div>
              <span className="font-mono text-cyan-400">Audio: 48kHz Stereo</span>
            </div>
          </div>
        </div>

        {/* RIGHT: Host Controls & Active Script */}
        <div className="col-span-12 lg:col-span-5 space-y-4">
          {/* Host State & Operator Actions */}
          <div className="bg-[#111827] border border-[#1E293B] rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Host State</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-800">
                  SESSION: RUNNING
                </span>
              </div>
              <span className="px-2.5 py-1 rounded text-xs font-mono font-bold bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                {session.activeState}
              </span>
            </div>

            {/* Quick Action Buttons */}
            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                onClick={onToggleAi}
                className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-xs font-semibold border transition-all ${
                  session.isAiHostOn
                    ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                    : 'bg-cyan-500 hover:bg-cyan-400 text-slate-900 border-cyan-400 font-bold'
                }`}
              >
                {session.isAiHostOn ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                {session.isAiHostOn ? 'Pause AI' : 'Resume AI'}
              </button>

              <button
                onClick={onToggleTakeover}
                className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-xs font-semibold border transition-all ${
                  session.isMicTakeover
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                }`}
              >
                <Mic className="w-3.5 h-3.5" />
                {session.isMicTakeover ? 'Release Mic' : 'Take Over'}
              </button>
            </div>
          </div>

          {/* Current Product Card */}
          <div className="bg-[#111827] border border-[#1E293B] rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img
                src={currentProduct.imageUrl}
                alt={currentProduct.title}
                className="w-12 h-12 rounded-lg object-cover border border-slate-700"
              />
              <div>
                <span className="text-[10px] text-cyan-400 font-mono uppercase">Current Product</span>
                <h4 className="text-sm font-semibold text-slate-100">{currentProduct.title}</h4>
                <span className="text-xs text-slate-400 font-mono">Stock: {currentProduct.totalStock} pcs</span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-sm font-bold text-emerald-400">Rp{currentProduct.basePrice.toLocaleString('id-ID')}</span>
            </div>
          </div>

          {/* Current Script Block */}
          <div className="bg-[#111827] border border-[#1E293B] rounded-xl p-5 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-400 uppercase tracking-wider">Current Script Block</span>
              <span className="font-mono text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800">
                {currentBlock.step}
              </span>
            </div>
            <p className="text-sm text-slate-200 leading-relaxed bg-slate-900/60 p-3 rounded-lg border border-slate-800">
              "{currentBlock.content}"
            </p>
          </div>
        </div>
      </div>

      {/* BELOW: Next Script Blocks (Simple) */}
      <div className="bg-[#111827] border border-[#1E293B] rounded-2xl p-6 space-y-4">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Next Script Blocks</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {nextBlocks.slice(0, 3).map((block) => (
            <div
              key={block.id}
              onClick={() => onSelectScriptBlock(block.id)}
              className="p-4 bg-slate-900/70 hover:bg-slate-800/80 border border-slate-800 rounded-xl cursor-pointer transition-colors space-y-2"
            >
              <div className="flex items-center justify-between text-xs">
                <span className="font-mono font-bold text-slate-300">{block.step}</span>
                <span className="text-slate-400 font-mono text-[11px]">{block.durationSec}s</span>
              </div>
              <p className="text-xs text-slate-400 line-clamp-2">
                "{block.content}"
              </p>
              <div className="flex items-center gap-1 text-[11px] text-cyan-400 pt-1">
                <span>Jump to step</span>
                <ChevronRight className="w-3 h-3" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
