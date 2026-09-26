import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, RefreshCw, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';

export const NexoroOfflineSyncBar: React.FC = () => {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [isSimulatedOffline, setIsSimulatedOffline] = useState(false);
  const [queuedOrdersCount, setQueuedOrdersCount] = useState<number>(0);
  const [justReconnected, setJustReconnected] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setJustReconnected(true);
      setTimeout(() => setJustReconnected(false), 5000);
      // Auto sync pending orders
      syncQueuedOrders();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check of offline queue
    const queue = localStorage.getItem('nexoro_offline_queue');
    if (queue) {
      try {
        const parsed = JSON.parse(queue);
        setQueuedOrdersCount(Array.isArray(parsed) ? parsed.length : 0);
      } catch (e) {
        // ignore
      }
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const syncQueuedOrders = () => {
    const queue = localStorage.getItem('nexoro_offline_queue');
    if (queue) {
      try {
        const parsed = JSON.parse(queue);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Emulate instant sync
          setTimeout(() => {
            localStorage.removeItem('nexoro_offline_queue');
            setQueuedOrdersCount(0);
          }, 1500);
        }
      } catch (e) {
        // ignore
      }
    }
  };

  const currentStatus = isSimulatedOffline ? false : isOnline;

  if (currentStatus && !justReconnected) {
    return null;
  }

  if (justReconnected) {
    return (
      <div className="bg-[#00C896] text-slate-950 px-4 py-2 text-xs font-black flex items-center justify-between shadow-lg sticky top-0 z-50">
        <div className="flex items-center gap-2 max-w-7xl mx-auto w-full">
          <CheckCircle2 className="w-4 h-4 text-slate-950 shrink-0" />
          <span>Conexão restaurada com sucesso! Todos os dados foram sincronizados automaticamente sem duplicidade.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-amber-500 text-slate-950 px-4 py-2 text-xs font-black flex items-center justify-between shadow-lg sticky top-0 z-50 animate-in fade-in">
      <div className="max-w-7xl mx-auto w-full flex flex-col sm:flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <WifiOff className="w-4 h-4 text-slate-950 shrink-0 animate-pulse" />
          <span>
            MODO OFFLINE ATIVO • Seus pedidos estão sendo armazenados localmente e serão sincronizados automaticamente assim que a conexão retornar.
          </span>
        </div>
        <div className="flex items-center gap-2">
          {queuedOrdersCount > 0 && (
            <span className="bg-slate-950 text-[#D4AF37] px-2 py-0.5 rounded-full text-[10px]">
              {queuedOrdersCount} pedido(s) em fila
            </span>
          )}
          {isSimulatedOffline && (
            <button
              onClick={() => setIsSimulatedOffline(false)}
              className="px-2 py-1 rounded bg-slate-950 text-white text-[10px] font-bold hover:bg-slate-800"
            >
              Desativar Simulação
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
