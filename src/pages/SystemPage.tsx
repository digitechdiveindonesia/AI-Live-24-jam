import React, { useState } from 'react';
import { Server, AlertTriangle, CheckCircle2, ShieldAlert, Cpu } from 'lucide-react';
import { Drawer } from '../components/Drawer';

interface SystemPageProps {
  onEmergencyStop: () => void;
}

export const SystemPage: React.FC<SystemPageProps> = ({ onEmergencyStop }) => {
  const [selectedService, setSelectedService] = useState<string | null>(null);

  const coreServices = [
    { name: 'Neural Host Engine', status: 'HEALTHY', latency: '42ms', uptime: '99.98%' },
    { name: 'Gemini LLM Intent & Pipeline', status: 'HEALTHY', latency: '380ms', uptime: '100%' },
    { name: 'Multichannel Chat Ingestion', status: 'HEALTHY', latency: '18ms', uptime: '99.95%' },
    { name: 'Commerce & Inventory Truth DB', status: 'HEALTHY', latency: '6ms', uptime: '100%' },
  ];

  const recentIncidents = [
    { time: '02:14:10', type: 'INFO', desc: 'Automatic inventory reconciliation synced with Shopee warehouse' },
    { time: '01:45:22', type: 'WARN', desc: 'Viewer claim attempt rejected by BPOM Guardrail filter (instant bleaching claim)' },
    { time: '00:30:15', type: 'INFO', desc: 'RTMP dual stream re-keyed seamlessly without viewer disconnect' }
  ];

  return (
    <div className="p-8 max-w-[1440px] mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-100">System Topology & Health</h2>
          <p className="text-xs text-slate-400">Microservice Cluster Health, Safety Guardrails, and Incident Audits</p>
        </div>
        <button
          onClick={onEmergencyStop}
          className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 rounded-xl text-xs font-semibold transition-colors"
        >
          <AlertTriangle className="w-4 h-4" />
          <span>Emergency Broadcast Halt</span>
        </button>
      </div>

      {/* 1. Overall System Status Banner */}
      <div className="p-5 bg-[#111827] border border-[#1E293B] rounded-2xl flex items-center justify-between shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
            <Server className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-100">Overall Infrastructure: Operational</h3>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            </div>
            <p className="text-xs text-slate-400 mt-0.5">Cluster Jakarta-1 • 0 active critical incidents • 4 core services online</p>
          </div>
        </div>
        <span className="px-3 py-1 bg-slate-900 border border-slate-800 text-xs font-mono text-emerald-400 rounded-lg">
          99.98% SLA
        </span>
      </div>

      {/* 2. Core Services Status (Clean 4 Cards) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Core Microservices</h3>
          <span className="text-[11px] text-cyan-400 font-mono">4 Services Monitored</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {coreServices.map((svc) => (
            <div
              key={svc.name}
              onClick={() => setSelectedService(svc.name)}
              className="p-4 bg-[#111827] border border-[#1E293B] hover:border-slate-700 rounded-xl cursor-pointer transition-colors space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-200">{svc.name}</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="flex justify-between items-center text-[11px] pt-1 border-t border-slate-800/80">
                <span className="text-slate-400 font-mono">Latency</span>
                <span className="font-mono text-cyan-400">{svc.latency}</span>
              </div>
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-slate-400 font-mono">Uptime</span>
                <span className="font-mono text-emerald-400">{svc.uptime}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Incident Logs (Latest only) */}
      <div className="bg-[#111827] border border-[#1E293B] rounded-2xl p-6 space-y-3">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Incident & Safety Audit Log</h3>
        <div className="divide-y divide-slate-800 text-xs font-mono">
          {recentIncidents.map((inc, i) => (
            <div key={i} className="py-2.5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  inc.type === 'WARN' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-slate-800 text-slate-300'
                }`}>
                  {inc.type}
                </span>
                <span className="text-slate-300 font-sans">{inc.desc}</span>
              </div>
              <span className="text-slate-400 text-[11px]">{inc.time}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ADVANCED DIAGNOSTICS DRAWER */}
      <Drawer
        isOpen={!!selectedService}
        onClose={() => setSelectedService(null)}
        title={selectedService || 'Service Diagnostics'}
        subtitle="Kubernetes Pod Telemetry & Chaos Readiness"
      >
        <div className="space-y-4 text-xs">
          <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-400">Pod Instance</span>
              <span className="font-mono text-slate-200">pod-core-live-001a</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Memory Utilization</span>
              <span className="font-mono text-cyan-400">242MB / 1024MB</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">CPU Load</span>
              <span className="font-mono text-emerald-400">12% (4 vCPU)</span>
            </div>
          </div>
          <div>
            <span className="text-slate-400">Failover Policy</span>
            <p className="text-slate-300 mt-1 leading-relaxed">
              Auto-healing replication configured with minimum 2 hot standbys across multi-zone availability zones.
            </p>
          </div>
        </div>
      </Drawer>
    </div>
  );
};
