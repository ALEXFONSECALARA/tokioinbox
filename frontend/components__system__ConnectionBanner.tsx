import React, { useEffect, useRef, useState } from 'react';
import { useConnectionStatus } from './utils__connection';
import { startConnectionAlarm, stopConnectionAlarm } from './utils__helpers';
import { WifiOff, Wifi, RefreshCw } from 'lucide-react';

interface ConnectionBannerProps {
  onReconnect?: () => void;
  // Alarme sonoro contínuo enquanto offline — faz sentido pra quem
  // trabalha com pedidos chegando (admin/kanban), não pro cliente
  // navegando o cardápio no celular dele.
  soundEnabled?: boolean;
}

export const ConnectionBanner: React.FC<ConnectionBannerProps> = ({ onReconnect, soundEnabled = false }) => {
  const state = useConnectionStatus(onReconnect);
  const [muted, setMuted] = useState(false);
  const [justReconnected, setJustReconnected] = useState(false);
  const wasOfflineRef = useRef(false);

  useEffect(() => {
    if (state === 'offline') wasOfflineRef.current = true;
    if (state === 'online' && wasOfflineRef.current) {
      wasOfflineRef.current = false;
      setJustReconnected(true);
      const t = setTimeout(() => setJustReconnected(false), 6000);
      return () => clearTimeout(t);
    }
  }, [state]);

  useEffect(() => {
    if (soundEnabled && state === 'offline' && !muted) {
      startConnectionAlarm();
    } else {
      stopConnectionAlarm();
    }
    return () => stopConnectionAlarm();
  }, [soundEnabled, state, muted]);

  // Ao voltar a ficar online, desmuta pra próxima vez que cair de novo.
  useEffect(() => {
    if (state === 'online') setMuted(false);
  }, [state]);

  if (state === 'online' && !justReconnected) return null;

  if (justReconnected) {
    return (
      <div className="fixed top-2 left-1/2 -translate-x-1/2 z-[9998] bg-emerald-600 text-white rounded-2xl shadow-xl px-4 py-2 flex items-center gap-2 text-sm font-bold">
        <Wifi className="w-4 h-4" />
        Conexão restabelecida — sincronizando pedidos...
      </div>
    );
  }

  const isOffline = state === 'offline';

  return (
    <div
      className={`fixed top-2 left-1/2 -translate-x-1/2 z-[9998] rounded-2xl shadow-xl px-4 py-2.5 flex items-center gap-3 text-sm font-bold text-white ${
        isOffline ? 'bg-red-600' : 'bg-amber-500 text-stone-950'
      }`}
    >
      {isOffline ? <WifiOff className="w-4 h-4" /> : <RefreshCw className="w-4 h-4 animate-spin" />}
      <span>
        {isOffline
          ? '🔴 Sem conexão com o servidor — os pedidos podem não estar chegando!'
          : '🟡 Conexão instável — verificando...'}
      </span>
      {isOffline && soundEnabled && (
        <button
          onClick={() => setMuted((m) => !m)}
          className="bg-white/20 hover:bg-white/30 rounded-lg px-2 py-1 text-xs whitespace-nowrap"
        >
          {muted ? 'Reativar som' : 'Silenciar'}
        </button>
      )}
    </div>
  );
};
