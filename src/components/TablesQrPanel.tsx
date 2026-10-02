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
  const { activeRestaurantSlug, currentUser, showToast, restaurants } = useStore();
  const restaurantName = restaurants?.[activeRestaurantSlug]?.name || 'Cardápio Digital';
  const [isPrintingAll, setIsPrintingAll] = useState(false);
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

  const escHtml = (v: string) => v.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));

  const plateHtml = (number: number, dataUrl: string) => `
    <section class="plate">
      <div class="brand">${escHtml(restaurantName)}</div>
      <div class="mesa">MESA ${number}</div>
      <img src="${dataUrl}" alt="QR Mesa ${number}" />
      <div class="cta">Aponte a câmera do celular<br/>para ver o cardápio e pedir</div>
      <div class="url">${escHtml(tableLink(number))}</div>
    </section>`;

  // CORREÇÃO: a impressão abria uma janela pop-up (bloqueada em celular/Chrome) e, bloqueada, não
  // acontecia nada e nenhuma mensagem aparecia. Agora imprime por um quadro oculto, sem pop-up.
  const printPlates = (plates: Array<{ number: number; dataUrl: string }>) => {
    if (plates.length === 0) return;
    const iframe = document.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow?.document;
    if (!doc || !iframe.contentWindow) {
      iframe.remove();
      showToast('Não foi possível abrir a impressão neste aparelho. Use "Baixar" e imprima a imagem.', 'error');
      return;
    }
    doc.open();
    doc.write(`<!doctype html><html><head><meta charset="utf-8"><title>Placas QR - ${escHtml(restaurantName)}</title>
      <style>
        @page { size: A5 portrait; margin: 10mm; }
        * { box-sizing: border-box; }
        body { font-family: Arial, Helvetica, sans-serif; margin: 0; color: #111; }
        .plate { page-break-after: always; text-align: center; padding: 8mm 4mm; border: 2px solid #111; border-radius: 6mm; }
        .plate:last-child { page-break-after: auto; }
        .brand { font-size: 20px; font-weight: 700; letter-spacing: .5px; margin-bottom: 4mm; }
        .mesa { font-size: 44px; font-weight: 900; margin: 2mm 0 4mm; }
        img { width: 80mm; height: 80mm; }
        .cta { font-size: 16px; font-weight: 700; margin-top: 4mm; line-height: 1.35; }
        .url { font-size: 9px; color: #555; margin-top: 4mm; word-break: break-all; }
      </style></head><body>${plates.map((p) => plateHtml(p.number, p.dataUrl)).join('')}</body></html>`);
    doc.close();
    const run = () => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch {
        showToast('Não foi possível acionar a impressão. Use "Baixar" e imprima a imagem.', 'error');
      }
      setTimeout(() => iframe.remove(), 60000);
    };
    // espera as imagens (data URL) carregarem antes de imprimir
    setTimeout(run, 400);
  };

  const handlePrintQr = (number: number, dataUrl: string | null) => {
    if (!dataUrl) return;
    printPlates([{ number, dataUrl }]);
  };

  // Imprime a placa de TODAS as mesas de uma vez (uma placa por página).
  const handlePrintAll = async () => {
    if (isPrintingAll || tables.length === 0) return;
    setIsPrintingAll(true);
    try {
      const list = [...tables].sort((a, b) => a.number - b.number);
      const plates: Array<{ number: number; dataUrl: string }> = [];
      for (const t of list) plates.push({ number: t.number, dataUrl: await generateQrCodeDataUrl(tableLink(t.number), 360) });
      printPlates(plates);
    } catch {
      showToast('Não foi possível gerar as placas. Tente novamente.', 'error');
    } finally {
      setIsPrintingAll(false);
    }
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
          <button
            type="button"
            onClick={handlePrintAll}
            disabled={isPrintingAll || tables.length === 0}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-black flex items-center gap-1.5 disabled:opacity-50"
            title="Imprimir a placa QR de todas as mesas (uma por página)"
          >
            <Printer className="w-3.5 h-3.5" /> {isPrintingAll ? 'Gerando...' : 'Imprimir todas as placas'}
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
