import React from 'react';
import { Radio, Mic, Pause, Play, AlertOctagon } from 'lucide-react';

interface HeaderProps {
  isLive: boolean;
  sessionId: string;
  platform: string;
  isAiHostOn: boolean;
  isPaused: boolean;
  isMicTakeover: boolean;
  onToggleAi: () => void;
  onTogglePause: () => void;
  onToggleMic: () => void;
  onEmergencyStop: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  isLive,
  sessionId,
  platform,
  isAiHostOn,
  isPaused,
  isMicTakeover,
  onToggleAi,
  onTogglePause,
  onToggleMic,
  onEmergencyStop
}) => {
  return (
    <header className="h-14 px-6 bg-[#0F172A]/90 backdrop-blur border-b border-[#1E293B] flex items-center justify-between z-10 shrink-0">
      {/* Left: Broadcast Status */}
      <div className="flex items-center gap-4">
        {/* LIVE status */}
        <div className={`flex items-center gap-2 px-2.5 py-1 rounded-md text-xs font-semibold uppercase tracking-wider ${
          isLive ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-slate-800 text-slate-400'
        }`}>
          <span className={`w-2 h-2 rounded-full ${isLive ? 'bg-red-500 animate-ping' : 'bg-slate-500'}`} />
          {isLive ? 'LIVE' : 'OFFLINE'}
        </div>

        {/* Session ID */}
        <div className="flex items-center gap-1.5 text-xs text-slate-300 font-mono">
          <span className="text-slate-500">SESSION:</span>
          <span className="font-semibold text-slate-200">{sessionId}</span>
        </div>

        {/* Current Platform */}
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-slate-800 border border-slate-700 text-slate-300">
          <Radio className="w-3 h-3 text-cyan-400" />
          <span>{platform}</span>
        </div>
      </div>

      {/* Right: AI Host Status & Operator Controls */}
      <div className="flex items-center gap-3">
        {/* AI Host Status Indicator */}
        <div className={`flex items-center gap-2 px-3 py-1 rounded-lg border text-xs font-medium ${
          isAiHostOn
            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
            : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${isAiHostOn ? 'bg-emerald-400' : 'bg-amber-400'}`} />
          <span>AI Host: {isAiHostOn ? 'Autonomous' : 'Standby'}</span>
        </div>

        <div className="h-4 w-px bg-slate-700" />

        {/* Operator Controls */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={onToggleAi}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors border ${
              isAiHostOn
                ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
                : 'bg-cyan-500 hover:bg-cyan-600 border-cyan-400 text-slate-900 font-semibold'
            }`}
          >
            {isAiHostOn ? 'Pause AI' : 'Resume AI'}
          </button>

          <button
            onClick={onToggleMic}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium border transition-colors ${
              isMicTakeover
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'
            }`}
          >
            <Mic className="w-3.5 h-3.5" />
            <span>{isMicTakeover ? 'Release Mic' : 'Take Over'}</span>
          </button>

          <button
            onClick={onTogglePause}
            title={isPaused ? 'Resume Stream' : 'Pause Stream'}
            className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300"
          >
            {isPaused ? <Play className="w-4 h-4 text-emerald-400" /> : <Pause className="w-4 h-4 text-slate-300" />}
          </button>

          <button
            onClick={onEmergencyStop}
            title="Emergency Halt Broadcast"
            className="p-1.5 rounded bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 transition-colors"
          >
            <AlertOctagon className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
