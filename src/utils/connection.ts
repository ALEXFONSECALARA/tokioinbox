import { useEffect, useRef, useState } from 'react';

// Detecta conexão de verdade com o SERVIDOR, não só a interface de rede do
// aparelho. `navigator.onLine` só diz se há uma rede ativa — dá pra estar
// "online" (wifi conectado) e mesmo assim sem conseguir falar com o
// TokioInbox (wifi sem internet de verdade, servidor fora do ar, etc). Por
// isso este hook pinga /api/version de verdade em vez de confiar só nesse
// evento do navegador.
export type ConnectionState = 'online' | 'unstable' | 'offline';

const PING_URL = '/api/version';
const NORMAL_INTERVAL_MS = 15000; // enquanto está tudo bem, não precisa checar toda hora
const RETRY_INTERVAL_MS = 4000; // instável/offline: tenta de novo com mais frequência
const SLOW_THRESHOLD_MS = 2500; // resposta mais lenta que isso já conta como "instável"
const TIMEOUT_MS = 6000;

export function useConnectionStatus(onReconnect?: () => void) {
  const [state, setState] = useState<ConnectionState>('online');
  const consecutiveFailuresRef = useRef(0);
  const wasDownRef = useRef(false);
  const onReconnectRef = useRef(onReconnect);
  onReconnectRef.current = onReconnect;

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const scheduleNext = (delay: number) => {
      timer = setTimeout(check, delay); // eslint-disable-line @typescript-eslint/no-use-before-define
    };

    const check = async () => {
      if (cancelled) return;
      // Sem rede nenhuma no aparelho — nem precisa tentar chegar ao servidor.
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        consecutiveFailuresRef.current += 1;
        setState('offline');
        wasDownRef.current = true;
        scheduleNext(RETRY_INTERVAL_MS);
        return;
      }
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
      const startedAt = Date.now();
      try {
        const res = await fetch(PING_URL, { cache: 'no-store', signal: controller.signal });
        const latency = Date.now() - startedAt;
        clearTimeout(timeoutId);
        if (cancelled) return;
        if (!res.ok) throw new Error(`status ${res.status}`);
        consecutiveFailuresRef.current = 0;
        const next: ConnectionState = latency > SLOW_THRESHOLD_MS ? 'unstable' : 'online';
        setState(next);
        if (next === 'online' && wasDownRef.current) {
          wasDownRef.current = false;
          onReconnectRef.current?.();
        }
        scheduleNext(next === 'online' ? NORMAL_INTERVAL_MS : RETRY_INTERVAL_MS);
      } catch {
        clearTimeout(timeoutId);
        if (cancelled) return;
        consecutiveFailuresRef.current += 1;
        // Uma falha isolada já é "instável"; duas ou mais seguidas = offline
        // de verdade (evita marcar como caído por causa de um único
        // request perdido, o que deixaria o painel piscando à toa).
        setState(consecutiveFailuresRef.current >= 2 ? 'offline' : 'unstable');
        if (consecutiveFailuresRef.current >= 2) wasDownRef.current = true;
        scheduleNext(RETRY_INTERVAL_MS);
      }
    };

    check();

    // Reage na hora aos eventos do navegador também, sem esperar o próximo
    // tick — sobretudo importante pra "voltou a internet" ser percebido
    // rapidamente (troca de wifi pra 4G, por exemplo).
    const handleOnline = () => { clearTimeout(timer); check(); };
    const handleOffline = () => { consecutiveFailuresRef.current += 1; wasDownRef.current = true; setState('offline'); };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    const handleVisible = () => { if (document.visibilityState === 'visible') { clearTimeout(timer); check(); } };
    document.addEventListener('visibilitychange', handleVisible);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisible);
    };
  }, []);

  return state;
}
