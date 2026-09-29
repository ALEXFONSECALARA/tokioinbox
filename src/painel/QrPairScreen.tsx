import React, { useEffect, useRef, useState } from 'react';
import { Smartphone, Loader2, CheckCircle2, XCircle } from 'lucide-react';

interface Props {
  token: string;
  onDone: () => void;
}

/** V9.2 — Tela de autorização exibida no celular/tablet depois de escanear o QR Code. */
export const QrPairScreen: React.FC<Props> = ({ token, onDone }) => {
  const [name, setName] = useState(() => localStorage.getItem('tokio_mobile_device_name') || '');
  const [deviceType, setDeviceType] = useState<'celular' | 'tablet'>('celular');
  const [phase, setPhase] = useState<'form' | 'sending' | 'waiting' | 'approved' | 'rejected' | 'error'>('form');
  const [error, setError] = useState('');
  const timer = useRef<any>(null);

  useEffect(() => () => clearInterval(timer.current), []);

  const send = async () => {
    setPhase('sending');
    setError('');
    try {
      const res = await fetch('/api/devices/qr/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          deviceName: name.trim() || (deviceType === 'tablet' ? 'Tablet' : 'Celular'),
          deviceType,
          platform: /iPad|iPhone|iPod/.test(navigator.userAgent) ? 'ios' : /Android/.test(navigator.userAgent) ? 'android' : 'web',
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Falha ao solicitar conexão');
      setPhase('waiting');
      const deadline = Date.now() + 5 * 60 * 1000;
      timer.current = setInterval(async () => {
        if (Date.now() > deadline) {
          clearInterval(timer.current);
          setError('Tempo esgotado. Gere um novo QR Code.');
          setPhase('error');
          return;
        }
        if (document.visibilityState !== 'visible') return;
        try {
          const r = await fetch(`/api/devices/qr/claim/${data.claimId}`);
          const s = await r.json();
          if (s.status === 'approved' && s.deviceId) {
            clearInterval(timer.current);
            localStorage.setItem('tokio_mobile_paired_id', s.deviceId);
            localStorage.setItem('tokio_mobile_device_name', name.trim() || 'Celular');
            setPhase('approved');
          } else if (s.status === 'rejected' || s.status === 'expired') {
            clearInterval(timer.current);
            setError(s.status === 'rejected' ? 'O administrador recusou a conexão.' : 'Solicitação expirada.');
            setPhase(s.status === 'rejected' ? 'rejected' : 'error');
          }
        } catch {
          /* tenta novamente no próximo ciclo */
        }
      }, 3000);
    } catch (e: any) {
      setError(e.message || 'Falha ao solicitar conexão');
      setPhase('error');
    }
  };

  return (
    <div className="min-h-screen bg-[#07090E] flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-[#0E121B] border border-slate-800 rounded-3xl p-6 space-y-4 text-center">
        <div className="mx-auto w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
          <Smartphone className="w-6 h-6 text-amber-400" />
        </div>
        <h1 className="text-white font-black text-lg">Conectar este aparelho</h1>

        {phase === 'form' && (
          <>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              placeholder="Nome do aparelho (ex: Celular Cozinha)"
              className="w-full bg-[#0E1015] border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white"
            />
            <div className="grid grid-cols-2 gap-2">
              {(['celular', 'tablet'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setDeviceType(t)}
                  className={`py-2 rounded-xl border text-xs font-bold capitalize ${
                    deviceType === t ? 'border-amber-400 bg-amber-500/10 text-amber-300' : 'border-slate-700 text-slate-400'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            <button onClick={send} className="w-full py-3 rounded-xl bg-amber-500 text-slate-950 font-black text-sm">
              Confirmar conexão
            </button>
          </>
        )}
        {(phase === 'sending' || phase === 'waiting') && (
          <div className="space-y-2 text-slate-300 text-sm">
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-amber-400" />
            <p>{phase === 'sending' ? 'Enviando solicitação…' : 'Aguardando autorização do administrador…'}</p>
          </div>
        )}
        {phase === 'approved' && (
          <div className="space-y-3">
            <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-400" />
            <p className="text-emerald-300 font-bold text-sm">Dispositivo conectado!</p>
            <button onClick={onDone} className="w-full py-3 rounded-xl bg-slate-800 text-white font-bold text-sm">Continuar</button>
          </div>
        )}
        {(phase === 'rejected' || phase === 'error') && (
          <div className="space-y-3">
            <XCircle className="w-8 h-8 mx-auto text-rose-400" />
            <p className="text-rose-300 text-sm">{error}</p>
            <button onClick={onDone} className="w-full py-3 rounded-xl bg-slate-800 text-white font-bold text-sm">Voltar ao painel</button>
          </div>
        )}
      </div>
    </div>
  );
};
