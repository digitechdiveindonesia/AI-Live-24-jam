import React, { useState } from 'react';
import { BookOpen, CheckCircle, Search, HelpCircle, ShieldAlert, Sparkles } from 'lucide-react';
import { Drawer } from '../components/Drawer';

export const KnowledgePage: React.FC = () => {
  const [isTesterOpen, setIsTesterOpen] = useState(false);
  const [testQuery, setTestQuery] = useState('Apakah Serum X aman untuk kulit sensitif dan ibu hamil?');
  const [testResult, setTestResult] = useState<{ answer: string; confidence: number; doc: string } | null>(null);

  const handleRunTest = (e: React.FormEvent) => {
    e.preventDefault();
    setTestResult({
      answer: 'Serum X diformulasikan aman untuk kulit sensitif dengan Niacinamide 10% teruji dermatologis. Untuk ibu hamil, kandungan telah lolos standar BPOM namun tetap disarankan konsultasi dokter kandungan.',
      confidence: 0.96,
      doc: 'Serum X Comprehensive Product Knowledge v2.1 (Section 4)'
    });
  };

  return (
    <div className="p-8 max-w-[1440px] mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-100">Knowledge & Grounding Engine</h2>
          <p className="text-xs text-slate-400">Authoritative Brand Rules, BPOM Claims, and Retrieval Pipeline</p>
        </div>
        <button
          onClick={() => setIsTesterOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-cyan-500 hover:bg-cyan-400 text-slate-900 transition-colors"
        >
          <Search className="w-3.5 h-3.5" />
          <span>Open RAG Retrieval Tester</span>
        </button>
      </div>

      {/* Main Grid: 4 Clean Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 1. Knowledge Sources & Indexing Status */}
        <div className="bg-[#111827] border border-[#1E293B] rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-cyan-400" />
              <span>Knowledge Sources</span>
            </h3>
            <span className="px-2 py-0.5 rounded text-[11px] font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-800">
              ALL INDEXED
            </span>
          </div>
          <div className="space-y-2 text-xs">
            <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 flex justify-between items-center">
              <div>
                <div className="font-semibold text-slate-200">Serum X Clinical Dossier</div>
                <div className="text-[11px] text-slate-400">Dermatologist safety panel data</div>
              </div>
              <CheckCircle className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 flex justify-between items-center">
              <div>
                <div className="font-semibold text-slate-200">Logistics & COD SOP 2026</div>
                <div className="text-[11px] text-slate-400">J&T, SiCepat shipping SLA & return policy</div>
              </div>
              <CheckCircle className="w-4 h-4 text-emerald-400" />
            </div>
          </div>
        </div>

        {/* 2. FAQ grounding */}
        <div className="bg-[#111827] border border-[#1E293B] rounded-2xl p-5 space-y-4">
          <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-purple-400" />
            <span>Product FAQ Grounding</span>
          </h3>
          <div className="space-y-2 text-xs">
            <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800">
              <div className="font-semibold text-slate-200">Bisa COD seluruh Indonesia?</div>
              <div className="text-[11px] text-slate-400 mt-1">Ya, seluruh Indonesia via J&T & SiCepat. Pesanan sebelum 16:00 dikirim hari yang sama.</div>
            </div>
            <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800">
              <div className="font-semibold text-slate-200">Cara pakai Serum X?</div>
              <div className="text-[11px] text-slate-400 mt-1">2-3 tetes pagi dan malam hari setelah toner sebelum moisturizer.</div>
            </div>
          </div>
        </div>

        {/* 3. Brand Rules */}
        <div className="bg-[#111827] border border-[#1E293B] rounded-2xl p-5 space-y-4">
          <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            <span>Approved Brand Claims</span>
          </h3>
          <ul className="space-y-2 text-xs text-slate-300">
            <li className="p-2.5 bg-slate-900/60 rounded-lg border border-slate-800 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>Mencerahkan kulit tampak berseri dalam 14 hari pemakaian rutin.</span>
            </li>
            <li className="p-2.5 bg-slate-900/60 rounded-lg border border-slate-800 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>Teruji klinis dermatologis untuk kulit sensitif dan non-comedogenic.</span>
            </li>
          </ul>
        </div>

        {/* 4. Restricted Claims */}
        <div className="bg-[#111827] border border-[#1E293B] rounded-2xl p-5 space-y-4">
          <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-red-400" />
            <span>Restricted Claims (Strictly Blocked)</span>
          </h3>
          <ul className="space-y-2 text-xs text-slate-300">
            <li className="p-2.5 bg-red-950/20 rounded-lg border border-red-900/40 flex items-center gap-2 text-red-300">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
              <span>Dilarang menjanjikan "Putih permanen instan dalam semalam".</span>
            </li>
            <li className="p-2.5 bg-red-950/20 rounded-lg border border-red-900/40 flex items-center gap-2 text-red-300">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
              <span>Dilarang mengklaim menyembuhkan penyakit medis kulit kronis / eksim.</span>
            </li>
          </ul>
        </div>
      </div>

      {/* RAG TESTER DRAWER */}
      <Drawer
        isOpen={isTesterOpen}
        onClose={() => setIsTesterOpen(false)}
        title="RAG Retrieval Simulator"
        subtitle="Simulate live knowledge grounding and claim auditing"
      >
        <form onSubmit={handleRunTest} className="space-y-4 text-xs">
          <div>
            <label className="text-slate-400 block mb-1.5 font-medium">Customer Test Query</label>
            <textarea
              value={testQuery}
              onChange={(e) => setTestQuery(e.target.value)}
              rows={3}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <button
            type="submit"
            className="w-full py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-900 font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Simulate Retrieval</span>
          </button>

          {testResult && (
            <div className="p-3.5 bg-slate-900 rounded-xl border border-slate-800 space-y-3">
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-slate-400">Match Confidence</span>
                <span className="font-mono text-emerald-400 font-bold">{(testResult.confidence * 100).toFixed(0)}%</span>
              </div>
              <div>
                <span className="text-slate-400 text-[11px]">Source Chunk</span>
                <div className="text-cyan-300 font-mono text-[11px] mt-0.5">{testResult.doc}</div>
              </div>
              <div>
                <span className="text-slate-400 text-[11px]">Grounding Verification</span>
                <p className="text-slate-200 mt-1 leading-relaxed">{testResult.answer}</p>
              </div>
            </div>
          )}
        </form>
      </Drawer>
    </div>
  );
};
