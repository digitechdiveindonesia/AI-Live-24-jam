import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Radio,
  MessageSquare,
  Package,
  Bot,
  BookOpen,
  Share2,
  BarChart3,
  Server
} from 'lucide-react';

const NAV_ITEMS = [
  { path: '/', label: 'Overview', icon: LayoutDashboard },
  { path: '/live-control', label: 'Live Control', icon: Radio },
  { path: '/live-chat', label: 'Live Chat', icon: MessageSquare },
  { path: '/products', label: 'Products', icon: Package },
  { path: '/ai-host', label: 'AI Host', icon: Bot },
  { path: '/knowledge', label: 'Knowledge', icon: BookOpen },
  { path: '/platform', label: 'Platform', icon: Share2 },
  { path: '/analytics', label: 'Analytics', icon: BarChart3 },
  { path: '/system', label: 'System', icon: Server },
];

export const Sidebar: React.FC = () => {
  return (
    <aside className="w-56 shrink-0 bg-[#0F172A] border-r border-[#1E293B] flex flex-col select-none">
      {/* Brand */}
      <div className="h-14 px-5 flex items-center gap-3 border-b border-[#1E293B]">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 font-bold text-white text-sm">
          S
        </div>
        <div>
          <h1 className="text-sm font-bold text-slate-100 tracking-tight">Sari AI Live</h1>
          <p className="text-[10px] text-slate-400 font-mono">v2.4 Core</p>
        </div>
      </div>

      {/* Nav List */}
      <nav className="p-3 space-y-1 flex-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-semibold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`
              }
            >
              <Icon className="w-4 h-4" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Footer System Status */}
      <div className="p-3 border-t border-[#1E293B] flex items-center justify-between text-[11px] text-slate-400">
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Engine Active
        </span>
        <span className="font-mono text-slate-500">Jakarta-1</span>
      </div>
    </aside>
  );
};
