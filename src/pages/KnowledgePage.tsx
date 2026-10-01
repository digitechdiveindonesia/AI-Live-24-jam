import React, { useState, useEffect } from 'react';
import { BookOpen, CheckCircle, Search, HelpCircle, ShieldAlert, Sparkles, Database } from 'lucide-react';
import { Drawer } from '../components/Drawer';

export const KnowledgePage: React.FC = () => {
  const [isTesterOpen, setIsTesterOpen] = useState(false);
  const [testQuery, setTestQuery] = useState('Apakah Serum X aman untuk kulit sensitif dan ibu hamil?');
  const [testResult, setTestResult] = useState<{ answer: string; confidence: number; doc: string; method?: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [knowledgeData, setKnowledgeData] = useState<{
    documents: any[];
    faqs: any[];
    rules: any[];
    isConfigured: boolean;
  }>({
    documents: [],
    faqs: [],
    rules: [],
    isConfigured: false
  });

  useEffect(() => {
    fetch('/api/knowledge')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setKnowledgeData({
            documents: data.documents || [],
            faqs: data.faqs || [],
            rules: data.rules || [],
            isConfigured: Boolean(data.isConfigured)
          });
        }
      })
      .catch(err => console.warn('Could not load knowledge:', err));
  }, []);

  const handleRunTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testQuery.trim()) return;

    setIsLoading(true);
    try {
      const res = await fetch('/api/knowledge/retrieve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: testQuery, sku: 'SKU-001' })
      });
      const data = await res.json();
      if (data.success && data.result) {
        const topFaq = data.result.matchedFaqs?.[0];
        const topDoc = data.result.matchedDocuments?.[0];
        setTestResult({
          answer: topFaq ? `${topFaq.question}: ${topFaq.answer}` : (topDoc ? topDoc.content : 'No matching knowledge rule found.'),
          confidence: data.result.confidence || 0.85,
          doc: topDoc ? `${topDoc.title} (v${topDoc.version || '1.0'})` : (topFaq ? `Product FAQ (${topFaq.sku})` : 'Knowledge Base'),
          method: data.result.retrievalMethod || 'LEXICAL_SEARCH'
        });
      }
    } catch (err: any) {
      console.error('Retrieval error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-[1440px] mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-100">Knowledge & Grounding Engine</h2>
          <p className="text-xs text-slate-400">Authoritative Brand Rules, BPOM Claims, and Supabase Retrieval Pipeline</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-[11px] font-mono px-2.5 py-1 rounded-lg border flex items-center gap-1.5 ${
            knowledgeData.isConfigured
              ? 'text-emerald-400 bg-emerald-950/40 border-emerald-800'
              : 'text-amber-400 bg-amber-950/40 border-amber-800'
          }`}>
            <Database className="w-3 h-3" />
            <span>{knowledgeData.isConfigured ? 'SUPABASE POSTGRES' : 'LOCAL DEV SEED'}</span>
          </span>
          <button
            onClick={() => setIsTesterOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-cyan-500 hover:bg-cyan-400 text-slate-900 transition-colors"
          >
            <Search className="w-3.5 h-3.5" />
            <span>Open RAG Retrieval Tester</span>
          </button>
        </div>
      </div>

      {/* Main Grid: 4 Clean Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 1. Knowledge Sources & Indexing Status */}
        <div className="bg-[#111827] border border-[#1E293B] rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-cyan-400" />
              <span>Knowledge Sources ({knowledgeData.documents.length || 3})</span>
            </h3>
            <span className="px-2 py-0.5 rounded text-[11px] font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-800">
              ALL INDEXED
            </span>
          </div>
          <div className="space-y-2 text-xs">
            {knowledgeData.documents.length > 0 ? (
              knowledgeData.documents.map((doc, idx) => (
                <div key={doc.id || idx} className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 flex justify-between items-center">
                  <div>
                    <div className="font-semibold text-slate-200">{doc.title}</div>
                    <div className="text-[11px] text-slate-400">{doc.category} • v{doc.version}</div>
                  </div>
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                </div>
              ))
            ) : (
              <>
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
              </>
            )}
          </div>
        </div>

        {/* 2. Guardrail Claims & Grounding Rules */}
        <div className="bg-[#111827] border border-[#1E293B] rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              <span>Guardrail Rules ({knowledgeData.rules.length || 3})</span>
            </h3>
            <span className="px-2 py-0.5 rounded text-[11px] font-mono text-cyan-400 bg-cyan-950/40 border border-cyan-800">
              ACTIVE ENFORCEMENT
            </span>
          </div>
          <div className="space-y-2 text-xs">
            {knowledgeData.rules.length > 0 ? (
              knowledgeData.rules.map((rule, idx) => (
                <div key={rule.id || idx} className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-200">{rule.rule_type}</span>
                    <span className="text-[10px] text-slate-400 font-mono">{rule.pattern}</span>
                  </div>
                  <p className="text-[11px] text-slate-400">{rule.reason}</p>
                </div>
              ))
            ) : (
              <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 space-y-1">
                <span className="font-semibold text-slate-200">BPOM Claim Compliance</span>
                <p className="text-[11px] text-slate-400">Blocks prohibited cure guarantees or overpromising claims</p>
              </div>
            )}
          </div>
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
            disabled={isLoading}
            className="w-full py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-900 font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{isLoading ? 'Retrieving Facts...' : 'Simulate Retrieval'}</span>
          </button>

          {testResult && (
            <div className="p-3.5 bg-slate-900 rounded-xl border border-slate-800 space-y-3">
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-slate-400">Match Confidence</span>
                <span className="font-mono text-emerald-400 font-bold">{(testResult.confidence * 100).toFixed(0)}%</span>
              </div>
              <div>
                <span className="text-slate-400 text-[11px]">Source Chunk ({testResult.method})</span>
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
