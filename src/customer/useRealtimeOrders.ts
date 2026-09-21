import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';

export interface RealtimeOrderRow {
  id: string;
  restaurant_id: string;
  status: string;
  short_code: string;
  [key: string]: unknown;
}

/**
 * FASE 4 — Realtime real (Supabase Realtime em cima de replicação lógica do
 * Postgres), não polling. Cobre os requisitos da seção 10 do briefing:
 *  - reconexão automática: supabase-js reconecta sozinho o WebSocket;
 *    além disso, ao reconectar nós rebuscamos o estado atual via `onReconnect`
 *    para garantir sincronização mesmo se algum evento tiver sido perdido
 *    durante a queda de internet.
 *  - prevenção de duplicados: cada evento é indexado por id do pedido num Map,
 *    então reprocessar o mesmo evento (ou reconectar e reconciliar) nunca
 *    duplica linha na tela.
 */
export function useRealtimeOrders(restaurantId: string | undefined, onReconcile: () => Promise<void>) {
  const [connected, setConnected] = useState(false);
  const [lastEventAt, setLastEventAt] = useState<Date | null>(null);
  const seenEventIds = useRef<Set<string>>(new Set());

  const handlePayload = useCallback(
    (payload: any, onChange: (row: RealtimeOrderRow, eventType: string) => void) => {
      // idempotência: cada mudança de linha do Postgres vem com um id de commit;
      // como o supabase-js não expõe isso diretamente, deduplicamos por
      // "id do registro + updated_at/created_at", que muda a cada mudança real.
      const row = payload.new ?? payload.old;
      if (!row) return;
      const dedupeKey = `${row.id}:${row.updated_at ?? row.created_at ?? ''}:${payload.eventType}`;
      if (seenEventIds.current.has(dedupeKey)) return;
      seenEventIds.current.add(dedupeKey);
      if (seenEventIds.current.size > 500) {
        // evita crescer pra sempre numa sessão longa
        seenEventIds.current = new Set(Array.from(seenEventIds.current).slice(-250));
      }
      setLastEventAt(new Date());
      onChange(row, payload.eventType);
    },
    []
  );

  useEffect(() => {
    if (!restaurantId) return;

    const channel = supabase
      .channel(`orders-restaurant-${restaurantId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${restaurantId}` },
        (payload) => handlePayload(payload, () => onReconcile())
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'order_status_history' },
        (payload) => handlePayload(payload, () => onReconcile())
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setConnected(true);
          // ao (re)conectar, reconcilia com o servidor pra cobrir qualquer
          // evento perdido durante uma queda de internet.
          onReconcile();
        }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setConnected(false);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId]);

  return { connected, lastEventAt };
}
