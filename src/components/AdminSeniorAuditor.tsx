import React, { useCallback, useEffect, useState } from 'react';
import { ShieldCheck, CheckCircle2, AlertTriangle, XCircle, RefreshCw, Loader2 } from 'lucide-react';

interface AuditCheck {
  id: string;
  label: string;
  status: 'ok' | 'warn' | 'fail';
  detail: string;
}

/**
 * Auditoria de segurança e configuração.
 * Todas as verificações são calculadas AGORA pelo servidor (GET /api/admin/system-audit),
 * a partir da configuração e dos dados reais. Nada aqui é texto fixo.
 */
export const AdminSeniorAuditor: React.FC = () => {
  const [checks, setChecks] = useState<AuditCheck[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/system-audit');
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setError(data.error || `Não foi possível executar a auditoria (erro ${res.status}).`);
        setChecks([]);
      } else {
        setChecks(data.checks);
        setGeneratedAt(data.generatedAt);
      }
    } catch {
      setError('Sem conexão com o servidor.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const fails = checks.filter((c) => c.status === 'fail').length;
  const warns = checks.filter((c) => c.status === 'warn').length;
  const oks = checks.filter((c) => c.status === 'ok').length;

  const icon = (s: AuditCheck['status']) =>
    s === 'ok' ? (
      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
    ) : s === 'warn' ? (
      <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
    ) : (
      <XCircle className="w-5 h-5 text-rose-400 shrink-0" />
    );

  const order = { fail: 0, warn: 1, ok: 2 } as const;
  const sorted = [...checks].sort((a, b) => order[a.status] - order[b.status]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-amber-400" />
            Auditoria de segurança e configuração
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Verificações reais feitas pelo servidor neste momento
            {generatedAt ? ` (${new Date(generatedAt).toLocaleString('pt-BR')})` : ''}.
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold flex items-center gap-2 disabled:opacity-60"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Executar novamente
        </button>
      </div>

      {error && (
        <div role="alert" className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/25 rounded-xl p-3">
          {error}
        </div>
      )}

      {checks.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-2xl bg-rose-500/10 border border-rose-500/25 p-3 text-center">
            <div className="text-2xl font-black text-rose-300">{fails}</div>
            <div className="text-[11px] text-slate-400">Críticos</div>
          </div>
          <div className="rounded-2xl bg-amber-500/10 border border-amber-500/25 p-3 text-center">
            <div className="text-2xl font-black text-amber-300">{warns}</div>
            <div className="text-[11px] text-slate-400">Atenção</div>
          </div>
          <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/25 p-3 text-center">
            <div className="text-2xl font-black text-emerald-300">{oks}</div>
            <div className="text-[11px] text-slate-400">Em ordem</div>
          </div>
        </div>
      )}

      <ul className="space-y-2">
        {sorted.map((c) => (
          <li key={c.id} className="flex items-start gap-3 rounded-2xl bg-slate-900/60 border border-slate-800 p-3.5">
            {icon(c.status)}
            <div className="min-w-0">
              <div className="text-sm font-bold text-white">{c.label}</div>
              <div className="text-xs text-slate-400 mt-0.5 break-words">{c.detail}</div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};
