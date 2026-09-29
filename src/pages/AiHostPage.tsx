import React, { useState } from 'react';
import { Bot, Volume2, Repeat, Zap, ChevronDown, ChevronUp } from 'lucide-react';
import { BroadcastSession } from '../types';

interface AiHostPageProps {
  session: BroadcastSession;
  onToggleAi: () => void;
}

export const AiHostPage: React.FC<AiHostPageProps> = ({ session, onToggleAi }) => {
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);

  return (
    <div className="p-8 max-w-[1440px] mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-100">AI Host Persona Engine</h2>
          <p className="text-xs text-slate-400">Autonomous Selling Loop, Neural Lip-Sync, and Interruption Handling</p>
        </div>
        <button
          onClick={onToggleAi}
          className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-all ${
            session.isAiHostOn
              ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
              : 'bg-cyan-500 hover:bg-cyan-400 text-slate-900 border-cyan-400 font-bold'
          }`}
        >
          {session.isAiHostOn ? 'Pause Autonomous Host' : 'Resume Autonomous Host'}
        </button>
      </div>

      <div className="grid grid-cols-12 gap-6 items-start">
        {/* Avatar Preview */}
        <div className="col-span-12 lg:col-span-5 bg-[#111827] border border-[#1E293B] rounded-2xl overflow-hidden p-6 space-y-4">
          <div className="aspect-[4/5] rounded-xl overflow-hidden relative bg-slate-950 border border-slate-800">
            <img
              src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&auto=format&fit=crop&q=80"
              alt="Sari Neural Presenter"
              className="w-full h-full object-cover"
            />
            <div className="absolute bottom-3 left-3 right-3 bg-black/70 backdrop-blur p-2.5 rounded-lg border border-white/10 flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-200">Sari Neural v4</span>
              <span className="text-[11px] font-mono text-cyan-400">1080p60 WebRTC</span>
            </div>
          </div>
          <div className="text-xs text-slate-400 text-center">
            Zero-latency neural avatar with Indonesian broadcast cadence & active expression tracking.
          </div>
        </div>

        {/* Core Controls: Voice, State, Selling Loop, Interruption */}
        <div className="col-span-12 lg:col-span-7 space-y-4">
          {/* Voice Profile */}
          <div className="p-5 bg-[#111827] border border-[#1E293B] rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                <Volume2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">Voice Model</h4>
                <p className="text-sm font-bold text-slate-100 mt-0.5">Sari ID Warm Energy (24kHz HD)</p>
                <span className="text-[11px] text-slate-400">Natural Indonesian live shopping intonation</span>
              </div>
            </div>
            <span className="px-2.5 py-1 bg-slate-800 text-emerald-400 rounded text-xs font-mono font-semibold">
              CALIBRATED
            </span>
          </div>

          {/* Current State */}
          <div className="p-5 bg-[#111827] border border-[#1E293B] rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Current Host State</h4>
                <p className="text-base font-bold font-mono text-cyan-400 mt-0.5">{session.activeState}</p>
                <span className="text-[11px] text-slate-400">Autonomous Selling State Machine</span>
              </div>
            </div>
            <span className="px-2.5 py-1 bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 rounded text-xs font-mono">
              CYCLE ACTIVE
            </span>
          </div>

          {/* Selling Loop */}
          <div className="p-5 bg-[#111827] border border-[#1E293B] rounded-xl space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-300 uppercase tracking-wider">
              <Repeat className="w-4 h-4 text-cyan-400" />
              <span>Selling Loop Sequence</span>
            </div>
            <div className="grid grid-cols-5 gap-2 text-center text-xs font-mono">
              {['INTRO', 'PROBLEM', 'SOLUTION', 'PROMO', 'CTA'].map((step, idx) => (
                <div
                  key={step}
                  className={`p-2 rounded-lg border ${
                    step === 'PROMO'
                      ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 font-bold'
                      : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}
                >
                  <div className="text-[10px] text-slate-400 mb-0.5">0{idx + 1}</div>
                  <div>{step}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Interruption Behavior */}
          <div className="p-5 bg-[#111827] border border-[#1E293B] rounded-xl space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-300 uppercase tracking-wider">
              <Zap className="w-4 h-4 text-amber-400" />
              <span>Interruption Behavior</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              When high-priority viewer queries are received, host pauses current pitch block, acknowledges viewer by name, answers grounded in verified facts, and resumes pitch without restarting.
            </p>
          </div>

          {/* Collapsible Advanced Configuration */}
          <div className="bg-[#111827] border border-[#1E293B] rounded-xl overflow-hidden">
            <button
              onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
              className="w-full p-4 flex items-center justify-between text-xs font-semibold text-slate-300 hover:bg-slate-800/50 transition-colors"
            >
              <span>Advanced Neural & Pacing Settings</span>
              {isAdvancedOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {isAdvancedOpen && (
              <div className="p-4 border-t border-[#1E293B] space-y-3 text-xs bg-slate-900/40">
                <div className="flex justify-between items-center text-slate-400">
                  <span>Pitch Duration per SKU</span>
                  <span className="font-mono text-slate-200">120 seconds</span>
                </div>
                <div className="flex justify-between items-center text-slate-400">
                  <span>Interruption Response Max Duration</span>
                  <span className="font-mono text-slate-200">15 seconds</span>
                </div>
                <div className="flex justify-between items-center text-slate-400">
                  <span>Urgency Level</span>
                  <span className="font-mono text-cyan-400">Payday High Conversion</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
