import React, { useEffect, useMemo, useState } from 'react';
import { useStore } from '../context/StoreContext';
import { generateQrCodeDataUrl } from './QrCodeImage';
import { copyToClipboard, getCurrentOrigin } from '../utils/urlRouting';
import { QrCode, Plus, Download, Copy, Check, Printer, RefreshCw, Lock, Unlock } from 'lucide-react';

/**
 * V9 PLUS ULTRA 04 — MESAS E QR CODES
 * Cada mesa tem um link PERMANENTE (/{slug}/mesa/{numero}) que nunca muda —
 * o Caixa apenas ativa/bloqueia se aquele link aceita pedidos AGORA. Reaproveita
 * 100% do fluxo de pedidos, cardápio e Print Agent já existentes; a única coisa
 * nova é o registro de mesas + o endpoint público de checagem (/api/tables/.../qr-access).
 */

interface TableRow {
  restaurantSlug: string;
  number: number;
  active: boolean;
  updatedAt: string;
}

export const TablesQrPanel: React.FC = () => {
  const { activeRestaurantSlug, currentUser, showToast } = useStore();
  const [tables, setTables] = useState<TableRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [newTableNumber, setNewTableNumber] = useState('');
  const [busyNumber, setBusyNumber] = useState<number | null>(null);
  const [qrOpenFor, setQrOpenFor] = useState<number | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copiedNumber, setCopiedNumber] = useState<number | null>(null);

  const authHeaders = () => {
    const token = currentUser?.token || sessionStorage.getItem('tokio_staff_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const loadTables = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/tables/${activeRestaurantSlug}/list`, { headers: { ...authHeaders() } });
      const data = await res.json();
      if (data.success) setTables(data.tables || []);
      else setLoadError(data.error || 'Não foi possível carregar as mesas.');
    } catch {
      // V9 PLUS ULTRA 04: este painel (criar mesa, QR, ativar/bloquear) é
      // trabalho de backoffice do Caixa/Admin e depende do servidor — não
      // precisa funcionar 100% offline como o PDV em si, mas NUNCA deve
      // ficar girando pra sempre: mostra uma mensagem clara e permite tentar de novo.
      setLoadError('Sem conexão com o servidor. Verifique a internet e tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTables();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRestaurantSlug]);

  const tableLink = (number: number) => `${getCurrentOrigin()}/${activeRestaurantSlug}/mesa/${number}`;

  const handleCreateTable = async () => {
    const n = parseInt(newTableNumber, 10);
    if (!Number.isInteger(n) || n < 1 || n > 999) return;
    setBusyNumber(n);
    try {
      const res = await fetch(`/api/tables/${activeRestaurantSlug}/${n}/ensure`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
      });
      const data = await res.json();
      if (data.success) {
        setNewTableNumber('');
        await loadTables();
      } else {
        showToast(data.error || 'Não foi possível criar a mesa.', 'error');
      }
    } catch {
      showToast('Sem conexão com o servidor. Tente novamente quando a internet voltar.', 'error');
    } finally {
      setBusyNumber(null);
    }
  };

  const handleToggle = async (number: number, nextActive: boolean) => {
    setBusyNumber(number);
    try {
      const res = await fetch(`/api/tables/${activeRestaurantSlug}/${number}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ active: nextActive }),
      });
      const data = await res.json();
      if (data.success) {
        setTables((prev) => prev.map((t) => (t.number === number ? { ...t, active: nextActive } : t)));
      } else {
        showToast(data.error || 'Não foi possível atualizar a mesa.', 'error');
      }
    } catch {
      showToast('Sem conexão com o servidor. Tente novamente quando a internet voltar.', 'error');
    } finally {
      setBusyNumber(null);
    }
  };

  const handleShowQr = async (number: number) => {
    setQrOpenFor(number);
    setQrDataUrl(null);
    try {
      const dataUrl = await generateQrCodeDataUrl(tableLink(number), 360);
      setQrDataUrl(dataUrl);
    } catch {
      setQrDataUrl(null);
    }
  };

  const handleCopyLink = async (number: number) => {
    const ok = await copyToClipboard(tableLink(number));
    if (ok) {
      setCopiedNumber(number);
      setTimeout(() => setCopiedNumber(null), 2000);
    }
  };

  const handlePrintQr = (number: number, dataUrl: string | null) => {
    if (!dataUrl) return;
    const w = window.open('', '_blank', 'width=420,height=560');
    if (!w) return;
    w.document.write(`
      <html><head><title>QR Mesa ${number}</title>
      <style>
        body{font-family:sans-serif;text-align:center;padding:24px;}
        h1{font-size:22px;margin-bottom:4px;} p{color:#555;font-size:12px;}
        img{width:280px;height:280px;margin:16px auto;}
      </style></head>
      <body>
        <h1>MESA ${number}</h1>
        <p>Escaneie para ver o cardápio e pedir</p>
        <img src="${dataUrl}" />
        <p>${tableLink(number)}</p>
        <script>window.onload = () => window.print();</script>
      </body></html>
    `);
    w.document.close();
  };

  const sorted = useMemo(() => [...tables].sort((a, b) => a.number - b.number), [tables]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h3 className="text-sm font-black text-white flex items-center gap-2">
            <QrCode className="w-4 h-4 text-amber-400" /> Mesas e QR Codes
          </h3>
          <p className="text-[11px] text-slate-500">
            Cada mesa tem um link permanente. O QR não muda — você só decide se a mesa está aceitando pedidos agora.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={1}
            max={999}
            placeholder="Nº da mesa"
            value={newTableNumber}
            onChange={(e) => setNewTableNumber(e.target.value)}
            className="w-28 px-3 py-2 rounded-xl bg-[#0E121C] border border-slate-800 text-white text-sm focus:outline-none focus:border-amber-500"
          />
          <button
            type="button"
            onClick={handleCreateTable}
            disabled={busyNumber !== null || !newTableNumber}
            className="px-3 py-2 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-300 text-xs font-black flex items-center gap-1.5 hover:bg-amber-500/25 disabled:opacity-50"
          >
            <Plus className="w-3.5 h-3.5" /> Criar Mesa
          </button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-xs text-slate-500 text-center py-6">Carregando mesas...</p>
      ) : loadError ? (
        <div className="text-center py-6 space-y-2">
          <p className="text-xs text-rose-400">🔴 {loadError}</p>
          <button
            type="button"
            onClick={loadTables}
            className="text-[11px] px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold inline-flex items-center gap-1.5"
          >
            <RefreshCw className="w-3 h-3" /> Tentar novamente
          </button>
        </div>
      ) : sorted.length === 0 ? (
        <p className="text-xs text-slate-500 text-center py-6">Nenhuma mesa cadastrada ainda. Crie a primeira acima.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {sorted.map((t) => (
            <div key={t.number} className="p-3 rounded-2xl bg-[#0E121C] border border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-black text-white">MESA {t.number}</span>
                <span
                  className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                    t.active
                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                      : 'bg-rose-500/15 text-rose-300 border-rose-500/40'
                  }`}
                >
                  {t.active ? '🟢 PEDIDOS ATIVOS' : '🔴 PEDIDOS BLOQUEADOS'}
                </span>
              </div>

              <button
                type="button"
                onClick={() => handleToggle(t.number, !t.active)}
                disabled={busyNumber === t.number}
                className={`w-full py-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 disabled:opacity-50 ${
                  t.active
                    ? 'bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/40'
                    : 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/40'
                }`}
              >
                {t.active ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                <span>{t.active ? 'Desativar Pedidos' : 'Ativar Pedidos'}</span>
              </button>

              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => handleShowQr(t.number)}
                  className="flex-1 px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-bold flex items-center justify-center gap-1"
                >
                  <QrCode className="w-3.5 h-3.5" /> Ver QR
                </button>
                <button
                  type="button"
                  onClick={() => handleCopyLink(t.number)}
                  className="flex-1 px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-bold flex items-center justify-center gap-1"
                >
                  {copiedNumber === t.number ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedNumber === t.number ? 'Copiado!' : 'Copiar Link'}</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {qrOpenFor !== null && (
        <div className="fixed inset-0 z-[110] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setQrOpenFor(null)}>
          <div className="bg-[#121622] border border-slate-800 rounded-3xl p-6 max-w-xs w-full text-center space-y-3" onClick={(e) => e.stopPropagation()}>
            <h4 className="text-sm font-black text-white">MESA {qrOpenFor}</h4>
            {qrDataUrl ? (
              <img src={qrDataUrl} alt={`QR Mesa ${qrOpenFor}`} className="w-56 h-56 mx-auto rounded-xl bg-white p-2" />
            ) : (
              <div className="w-56 h-56 mx-auto rounded-xl bg-black/30 animate-pulse flex items-center justify-center">
                <span className="text-[10px] text-slate-500">Gerando QR...</span>
              </div>
            )}
            <p className="text-[10px] text-slate-500 break-all">{tableLink(qrOpenFor)}</p>
            <div className="flex items-center gap-2">
              <a
                href={qrDataUrl || undefined}
                download={`qr-mesa-${qrOpenFor}.png`}
                className={`flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 ${!qrDataUrl ? 'opacity-50 pointer-events-none' : ''}`}
              >
                <Download className="w-3.5 h-3.5" /> Baixar
              </a>
              <button
                type="button"
                onClick={() => handlePrintQr(qrOpenFor, qrDataUrl)}
                disabled={!qrDataUrl}
                className="flex-1 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 text-xs font-black flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <Printer className="w-3.5 h-3.5" /> Imprimir
              </button>
            </div>
            <button type="button" onClick={() => setQrOpenFor(null)} className="text-[11px] text-slate-500 hover:text-white">
              Fechar
            </button>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={loadTables}
        className="text-[10px] text-slate-500 hover:text-white flex items-center gap-1.5"
      >
        <RefreshCw className="w-3 h-3" /> Atualizar lista
      </button>
    </div>
  );
};
