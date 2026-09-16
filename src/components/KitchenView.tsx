import React, { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { apiUpdateOrderStatus } from '../lib/ordersApi';
import { useRealtimeOrders } from '../hooks/useRealtimeOrders';
import { supabase } from '../lib/supabaseClient';

async function fetchByDestination(restaurantId: string, destination: string) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const res = await fetch(`/api/v2/orders/by-destination/${destination}?restaurantId=${restaurantId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Falha ao carregar pedidos.');
  return res.json();
}

interface KitchenViewProps {
  restaurantId: string;
  destination: 'cozinha' | 'sushibar';
}

/** Cada estação (cozinha ou sushibar) só vê os itens destinados a ela (seções "Cozinha"/"Sushibar" do briefing). */
export function KitchenView({ restaurantId, destination }: KitchenViewProps) {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      setOrders(await fetchByDestination(restaurantId, destination));
    } finally {
      setLoading(false);
    }
  }, [restaurantId, destination]);

  useEffect(() => {
    reload();
  }, [reload]);

  const { connected } = useRealtimeOrders(restaurantId, reload);

  const markPreparing = (orderId: string) => apiUpdateOrderStatus(orderId, restaurantId, 'preparando').then(reload);
  const markReady = (orderId: string) => apiUpdateOrderStatus(orderId, restaurantId, 'pronto').then(reload);

  return (
    <div className="min-h-screen bg-[#07090E] text-white p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold capitalize">{destination}</h1>
        <span className={`text-xs ${connected ? 'text-emerald-400' : 'text-amber-400'}`}>
          {connected ? '● Ao vivo' : '○ Reconectando...'}
        </span>
      </div>
      {loading ? (
        <Loader2 className="animate-spin" />
      ) : orders.length === 0 ? (
        <p className="text-white/50">Nenhum pedido pendente para {destination} agora.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {orders.map((order) => (
            <div key={order.id} className="rounded-xl border border-white/10 p-4 bg-white/[0.03]">
              <div className="flex justify-between mb-2">
                <span className="font-semibold">{order.short_code}</span>
                <span className="text-xs uppercase text-white/40">{order.status}</span>
              </div>
              <ul className="text-sm text-white/70 mb-3 space-y-1">
                {order.order_items?.map((it: any) => (
                  <li key={it.id}>
                    {it.quantity}x {it.name_snapshot} {it.notes ? <span className="text-white/40">— {it.notes}</span> : null}
                  </li>
                ))}
              </ul>
              <div className="flex gap-2">
                {order.status !== 'preparando' && order.status !== 'pronto' && (
                  <button onClick={() => markPreparing(order.id)} className="flex-1 text-xs bg-white/10 rounded-lg py-2">
                    Iniciar preparo
                  </button>
                )}
                {order.status !== 'pronto' && (
                  <button onClick={() => markReady(order.id)} className="flex-1 text-xs bg-white text-black rounded-lg py-2 font-medium">
                    Marcar pronto
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
