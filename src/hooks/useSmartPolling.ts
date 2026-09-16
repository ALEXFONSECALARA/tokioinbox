import { useEffect, useRef } from 'react';
import { usePageVisibility } from './usePageVisibility';

interface SmartPollingOptions {
  intervalMs: number;
  enabled?: boolean;
  maxBackoffMs?: number;
}

/**
 * Item 1 do pedido de otimização de rede: substitui "setInterval bruto" por
 * polling que:
 *  - PAUSA completamente quando a aba está em background (Page Visibility API)
 *    — não gasta bateria/dados de celular à toa quando o operador trocou de app;
 *  - ao voltar pro primeiro plano, busca imediatamente (sem esperar o próximo tick);
 *  - se a requisição falhar (rede instável), aplica backoff exponencial em vez
 *    de martelar o servidor, e volta ao intervalo normal assim que uma
 *    chamada tiver sucesso de novo (fallback de reconexão automática).
 *
 * Uso típico: coisas que ainda não têm push/realtime (ex: fila local de
 * impressão consultada pelo agente de impressão). Onde já existe Supabase
 * Realtime (Kanban, cozinha, etc.) não precisa disso — o push já resolve.
 */
export function useSmartPolling(callback: () => Promise<void>, { intervalMs, enabled = true, maxBackoffMs = 60_000 }: SmartPollingOptions) {
  const isVisible = usePageVisibility();
  const callbackRef = useRef(callback);
  callbackRef.current = callback;
  const backoffRef = useRef(intervalMs);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled || !isVisible) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      return;
    }

    let cancelled = false;
    backoffRef.current = intervalMs;

    const tick = async () => {
      try {
        await callbackRef.current();
        backoffRef.current = intervalMs; // sucesso: volta ao ritmo normal
      } catch {
        backoffRef.current = Math.min(backoffRef.current * 2, maxBackoffMs); // erro: espera mais da próxima vez
      }
      if (!cancelled) {
        timeoutRef.current = setTimeout(tick, backoffRef.current);
      }
    };

    tick(); // busca imediata ao ficar visível/habilitar, sem esperar o primeiro intervalo

    return () => {
      cancelled = true;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [enabled, isVisible, intervalMs, maxBackoffMs]);
}
