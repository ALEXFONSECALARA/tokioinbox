import React, { useCallback, useEffect, useRef, useState } from 'react';
import { QrCode, Check, X, RefreshCw } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { QrCodeImage } from './QrCodeImage';

interface PendingClaim {
  id: string;
  deviceName: string;
  platform: string;
  deviceType: string;
  restaurantSlug?: string;
  requestedBy: string;
  expiresAt: string;
}

/**
 * V9.2 — "CONECTAR POR QR CODE": Admin gera QR (token temporário, uso único, expira em 5 min);
 * o celular/tablet escaneia, confirma na tela de autorização e o admin aprova aqui.
 * Consumo: nenhuma requisição enquanto não houver QR ativo; com QR ativo, consulta leve a cada 4 s
 * (somente aba visível) e para sozinho quando o QR expira.
 */
export const AdminDeviceQrPanel: React.FC = () => {
  const { restaurants, currentUser, refreshDevices, showToast } = useStore();
  const [slug, setSlug] = useState<string>('all');
  const [qr, setQr] = useState<{ token: string; expiresAt: number } | null>(null);
  const [now, setNow] = useState(Date.now());
  const [claims, setClaims] = useState<PendingClaim[]>([]);
  const [busy, setBusy] = useState(false);
  const activeRef = useRef(false);

  const allowed = Object.values(restaurants).filter(
    (r) => currentUser?.restaurantSlug === 'all' || r.slug === currentUser?.restaurantSlug
  );

  const remaining = qr ? Math.max(0, Math.floor((qr.expiresAt - now) / 1000)) : 0;
  const expired = qr !== null && remaining === 0;
  const watching = (qr !== null && !expired) || claims.length > 0;
  activeRef.current = watching;

  const generate = async () => {
    setBusy(true);
    try {
      const res = await fetch('/api/devices/qr/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restaurantSlug: slug }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Falha ao gerar QR Code');
      setQr({ token: data.token, expiresAt: new Date(data.expiresAt).getTime() });
      setNow(Date.now());
    } catch (e: any) {
      showToast(e.message || 'Falha ao gerar QR Code', 'error');
    } finally {
      setBusy(false);
    }
  };

  const loadPending = useCallback(async () => {
    if (document.visibilityState !== 'visible') return;
    try {
      const res = await fetch('/api/devices/qr/pending');
      const data = await res.json();
      if (data.success) setClaims(data.claims || []);
    } catch {
      /* rede instável: tenta no próximo ciclo */
    }
  }, []);

  // relógio só enquanto há QR ativo
  useEffect(() => {
    if (!qr || expired) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [qr, expired]);

  // consulta de solicitações só enquanto há QR ativo ou solicitação pendente
  useEffect(() => {
    if (!watching) return;
    loadPending();
    const t = setInterval(() => {
      if (activeRef.current) loadPending();
    }, 4000);
    return () => clearInterval(t);
  }, [watching, loadPending]);

  const decide = async (claim: PendingClaim, approve: boolean) => {
    try {
      const res = await fetch(`/api/devices/qr/claim/${claim.id}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approve }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Falha ao decidir');
      setClaims((prev) => prev.filter((c) => c.id !== claim.id));
      if (approve) {
        setQr(null); // token já consumido
        await refreshDevices();
        showToast(`"${claim.deviceName}" conectado.`, 'success');
      }
    } catch (e: any) {
      showToast(e.message || 'Falha ao decidir', 'error');
    }
  };

  const url = qr ? `${window.location.origin}/painel?qrpair=${qr.token}` : '';
  const mm = String(Math.floor(remaining / 60)).padStart(1, '0');
  const ss = String(remaining % 60).padStart(2, '0');

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <QrCode className="w-4 h-4 text-amber-400" />
          <h3 className="text-sm font-black text-white uppercase tracking-wider">Conectar por QR Code</h3>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            className="bg-[#0E1015] border border-slate-700 rounded-xl px-2 py-2 text-xs text-white"
            aria-label="Restaurante do dispositivo"
          >
            {currentUser?.restaurantSlug === 'all' && <option value="all">Todas as lojas</option>}
            {allowed.map((r) => (
              <option key={r.slug} value={r.slug}>
                {r.emoji} {r.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={generate}
            disabled={busy}
            className="px-3 py-2 rounded-xl bg-amber-500 text-slate-950 text-xs font-black flex items-center gap-1.5 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${busy ? 'animate-spin' : ''}`} />
            {qr ? 'Gerar novo QR' : 'Gerar QR Code'}
          </button>
        </div>
      </div>

      {qr && (
        <div className="flex flex-col sm:flex-row items-center gap-5">
          <div className={`bg-white p-2 rounded-2xl ${expired ? 'opacity-30' : ''}`}>
            <QrCodeImage url={url} size={200} alt="QR Code de conexão de dispositivo" />
          </div>
          <div className="text-xs text-slate-300 space-y-2">
            <p className={expired ? 'text-rose-400 font-black' : 'text-amber-300 font-black'}>
              {expired ? 'QR Code expirado — gere um novo.' : `Expira em ${mm}:${ss} • uso único`}
            </p>
            <ol className="list-decimal list-inside space-y-1 text-slate-400">
              <li>Escaneie com a câmera do celular/tablet.</li>
              <li>Entre com seu usuário e confirme a conexão no aparelho.</li>
              <li>Autorize o aparelho na solicitação que aparece abaixo.</li>
            </ol>
          </div>
        </div>
      )}

      {claims.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-black uppercase text-amber-300">Solicitações aguardando autorização</p>
          {claims.map((c) => (
            <div key={c.id} className="flex items-center gap-3 bg-slate-950 border border-amber-500/30 rounded-xl px-3 py-2">
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-white truncate">{c.deviceName}</div>
                <div className="text-[10px] text-slate-400">
                  {c.deviceType} • {c.platform} • usuário: {c.requestedBy}
                  {c.restaurantSlug ? ` • ${restaurants[c.restaurantSlug]?.name || c.restaurantSlug}` : ''}
                </div>
              </div>
              <button type="button" onClick={() => decide(c, true)} className="px-2.5 py-1.5 rounded-lg bg-emerald-500 text-slate-950 text-[11px] font-black flex items-center gap-1">
                <Check className="w-3 h-3" /> Autorizar
              </button>
              <button type="button" onClick={() => decide(c, false)} className="px-2.5 py-1.5 rounded-lg bg-slate-800 text-slate-200 text-[11px] font-bold flex items-center gap-1">
                <X className="w-3 h-3" /> Recusar
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
