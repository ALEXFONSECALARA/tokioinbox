import React, { useState, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { Wifi, WifiOff, RefreshCw, CheckCircle2, ShieldAlert, Layers } from 'lucide-react';
import {
  getSimulatedOffline,
  setSimulatedOffline,
  getOfflineQueue,
} from '../utils/offlineQueueManager';

interface OfflineStatusIndicatorProps {
  compact?: boolean;
  className?: string;
  showToggle?: boolean;
}

export const OfflineStatusIndicator: React.FC<OfflineStatusIndicatorProps> = ({
  compact = false,
  className = '',
  showToggle = true,
}) => {
  const { isOnline, isSyncing, syncOrdersNow, showToast } = useStore();
  const [isSimulated, setIsSimulated] = useState(getSimulatedOffline());
  const [queueCount, setQueueCount] = useState(getOfflineQueue().length);
  const [justSynced, setJustSynced] = useState(false);

  useEffect(() => {
    const handleQueueChange = () => {
      setQueueCount(getOfflineQueue().length);
    };

    const handleModeChange = (e: any) => {
      setIsSimulated(e.detail?.isOffline ?? getSimulatedOffline());
    };

    window.addEventListener('tokio-offline-queue-change', handleQueueChange);
    window.addEventListener('tokio-offline-mode-change', handleModeChange);

    return () => {
      window.removeEventListener('tokio-offline-queue-change', handleQueueChange);
      window.removeEventListener('tokio-offline-mode-change', handleModeChange);
    };
  }, []);

  const effectiveOnline = isOnline && !isSimulated;

  const handleToggleSimulation = () => {
    const nextVal = !isSimulated;
    setSimulatedOffline(nextVal);
    setIsSimulated(nextVal);
    if (nextVal) {
      showToast('Modo OFFLINE ativado para simulação e testes do PDV!', 'info');
    } else {
      showToast('Conexão ONLINE restaurada! Sincronizando operações locais...', 'success');
      setJustSynced(true);
      syncOrdersNow().finally(() => {
        setTimeout(() => setJustSynced(false), 3000);
      });
    }
  };

  const handleManualSync = async () => {
    if (!effectiveOnline) {
      showToast('Dispositivo em modo offline. Restaure a conexão para sincronizar.', 'error');
      return;
    }
    showToast('Sincronizando com o servidor...', 'info');
    await syncOrdersNow();
    setQueueCount(getOfflineQueue().length);
    setJustSynced(true);
    setTimeout(() => setJustSynced(false), 3000);
    showToast('Sincronização concluída com sucesso!', 'success');
  };

  // Determine current status state:
  // 🟢 ONLINE | 🟠 OFFLINE | 🔄 SINCRONIZANDO | ✅ SINCRONIZADO
  let statusBadge = (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 text-[11px] font-black tracking-wide">
      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
      <span>🟢 ONLINE</span>
    </div>
  );

  if (!effectiveOnline) {
    statusBadge = (
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/20 border border-amber-500/50 text-amber-300 text-[11px] font-black tracking-wide">
        <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
        <span>🟠 OFFLINE</span>
        {queueCount > 0 && (
          <span className="ml-1 px-1.5 py-0.2 bg-amber-400 text-slate-950 rounded-full text-[10px] font-mono">
            {queueCount} na fila
          </span>
        )}
      </div>
    );
  } else if (isSyncing) {
    statusBadge = (
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-sky-500/20 border border-sky-500/50 text-sky-300 text-[11px] font-black tracking-wide">
        <RefreshCw className="w-3 h-3 text-sky-400 animate-spin" />
        <span>🔄 SINCRONIZANDO</span>
      </div>
    );
  } else if (justSynced) {
    statusBadge = (
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 text-[11px] font-black tracking-wide">
        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
        <span>✅ SINCRONIZADO</span>
      </div>
    );
  }

  if (compact) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        {statusBadge}
        {showToggle && (
          <button
            onClick={handleToggleSimulation}
            title={isSimulated ? 'Reconectar à Internet (Modo Online)' : 'Simular Queda de Conexão (Modo Offline)'}
            className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-colors ${
              isSimulated
                ? 'bg-amber-500/20 border-amber-500 text-amber-300 hover:bg-amber-500/30'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
            }`}
          >
            {isSimulated ? 'Desativar Offline' : 'Testar Offline'}
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className={`flex flex-wrap items-center gap-2 bg-[#0A0D14] p-1.5 px-3 rounded-xl border border-slate-800 ${className}`}
    >
      {statusBadge}

      {/* Queue Counter if pending */}
      {queueCount > 0 && (
        <span className="text-[11px] text-slate-400 flex items-center gap-1 font-mono">
          <Layers className="w-3 h-3 text-amber-400" />
          <span>{queueCount} op. local</span>
        </span>
      )}

      {/* Manual Sync Button */}
      {effectiveOnline && (
        <button
          onClick={handleManualSync}
          disabled={isSyncing}
          className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          title="Forçar Sincronização Agora"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-sky-400' : ''}`} />
        </button>
      )}

      {/* Offline Simulator Switch */}
      {showToggle && (
        <button
          onClick={handleToggleSimulation}
          className={`text-[10px] font-bold px-2 py-1 rounded-lg border transition-all ${
            isSimulated
              ? 'bg-amber-500 text-slate-950 border-amber-400 font-black shadow-sm'
              : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200'
          }`}
          title="Alternar Simulação Offline para testes práticos"
        >
          {isSimulated ? '📶 RECONECTAR REDE' : '⚠️ SIMULAR SEM INTERNET'}
        </button>
      )}
    </div>
  );
};
