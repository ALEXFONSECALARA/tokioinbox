import React, { useEffect, useState } from 'react';
import { MessageSquare, Send, Bot, Sparkles, Loader2 } from 'lucide-react';

interface ConversationSummary {
  id: string;
  status: 'bot' | 'human' | 'closed';
  updatedAt: string;
  customerId: string | null;
  sessionId: string | null;
}

interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant' | 'human_agent';
  content: string;
  createdAt: string;
}

interface AdminAiPanelProps {
  slug: string;
  token: string;
}

export const AdminAiPanel: React.FC<AdminAiPanelProps> = ({ slug, token }) => {
  const API_BASE = String((import.meta as any).env.VITE_API_URL || '')
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/api$/i, '');
  const API_PREFIX = API_BASE ? `${API_BASE}/api` : '/api';
  const authHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);

  const [analysis, setAnalysis] = useState<{ summary: string; analysis: string } | null>(null);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const loadConversations = () => {
    fetch(`${API_PREFIX}/admin/${slug}/ai/conversations?status=human`, { headers: authHeaders })
      .then((r) => r.json())
      .then(setConversations)
      .catch(() => {});
  };

  useEffect(() => {
    loadConversations();
    const interval = setInterval(loadConversations, 15000); // atualiza sozinho, sem precisar de refresh manual
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  useEffect(() => {
    if (!selectedId) return;
    fetch(`${API_PREFIX}/admin/${slug}/ai/conversations/${selectedId}/messages`, { headers: authHeaders })
      .then((r) => r.json())
      .then(setMessages)
      .catch(() => {});
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleReply = async () => {
    if (!selectedId || !reply.trim()) return;
    setSending(true);
    try {
      await fetch(`${API_PREFIX}/admin/${slug}/ai/conversations/${selectedId}/reply`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ message: reply.trim() }),
      });
      setMessages((prev) => [
        ...prev,
        { id: `local-${Date.now()}`, role: 'human_agent', content: reply.trim(), createdAt: new Date().toISOString() },
      ]);
      setReply('');
    } finally {
      setSending(false);
    }
  };

  const handleReturnToBot = async () => {
    if (!selectedId) return;
    await fetch(`${API_PREFIX}/admin/${slug}/ai/conversations/${selectedId}`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({ status: 'bot' }),
    });
    setSelectedId(null);
    loadConversations();
  };

  const handleAnalyze = async () => {
    setLoadingAnalysis(true);
    setAnalysisError(null);
    try {
      const res = await fetch(`${API_PREFIX}/admin/${slug}/ai/analyze`, { headers: authHeaders });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha ao analisar.');
      setAnalysis(data);
    } catch (err: any) {
      setAnalysisError(err.message || 'Não foi possível gerar a análise.');
    } finally {
      setLoadingAnalysis(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Conversas aguardando atendente (item 38) */}
      <div className="bg-white rounded-2xl border border-stone-200 p-4">
        <h3 className="font-black text-stone-800 flex items-center gap-2 mb-3">
          <MessageSquare className="w-4 h-4 text-amber-500" /> Aguardando atendente ({conversations.length})
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1.5 sm:col-span-1">
            {conversations.length === 0 && (
              <p className="text-xs text-stone-400">Nenhuma conversa esperando atendimento humano agora.</p>
            )}
            {conversations.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                className={`w-full text-left px-3 py-2 rounded-xl text-xs border ${
                  selectedId === c.id ? 'bg-stone-900 text-white border-stone-900' : 'border-stone-200 text-stone-700 hover:bg-stone-50'
                }`}
              >
                Conversa #{c.id.slice(0, 8)}
                <br />
                <span className="opacity-70">{new Date(c.updatedAt).toLocaleString('pt-BR')}</span>
              </button>
            ))}
          </div>

          <div className="sm:col-span-2 border border-stone-100 rounded-xl p-3 flex flex-col min-h-[220px]">
            {!selectedId ? (
              <p className="text-xs text-stone-400 m-auto">Selecione uma conversa pra responder.</p>
            ) : (
              <>
                <div className="flex-1 space-y-1.5 overflow-y-auto mb-2 max-h-56">
                  {messages.map((m) => (
                    <div
                      key={m.id}
                      className={`text-xs rounded-xl px-2.5 py-1.5 max-w-[85%] ${
                        m.role === 'user'
                          ? 'bg-stone-100 text-stone-800'
                          : m.role === 'human_agent'
                            ? 'bg-emerald-100 text-emerald-800 ml-auto'
                            : 'bg-amber-50 text-amber-800 ml-auto'
                      }`}
                    >
                      {m.content}
                    </div>
                  ))}
                </div>
                <div className="flex gap-1.5">
                  <input
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleReply()}
                    placeholder="Responder como atendente..."
                    className="flex-1 border border-stone-200 rounded-lg px-2.5 py-2 text-xs"
                  />
                  <button
                    onClick={handleReply}
                    disabled={sending || !reply.trim()}
                    className="px-3 py-2 rounded-lg bg-stone-900 text-white disabled:opacity-40"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={handleReturnToBot}
                    title="Devolver pra IA"
                    className="px-3 py-2 rounded-lg bg-stone-100 text-stone-600 hover:bg-stone-200"
                  >
                    <Bot className="w-3.5 h-3.5" />
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* IA administrativa (item 40) */}
      <div className="bg-white rounded-2xl border border-stone-200 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-black text-stone-800 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500" /> Análise administrativa com IA
          </h3>
          <button
            onClick={handleAnalyze}
            disabled={loadingAnalysis}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-stone-900 text-white text-xs font-bold disabled:opacity-50"
          >
            {loadingAnalysis && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Analisar vendas
          </button>
        </div>
        {analysisError && <p className="text-xs text-red-500">{analysisError}</p>}
        {analysis && (
          <div className="text-xs text-stone-700 space-y-2">
            <pre className="whitespace-pre-wrap bg-stone-50 rounded-xl p-3 font-mono text-[11px]">{analysis.summary}</pre>
            <div className="whitespace-pre-wrap">{analysis.analysis}</div>
            <p className="text-[10px] text-stone-400">
              A IA só sugere — nenhuma alteração de preço, produto ou configuração é feita automaticamente.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
