import React, { useCallback, useEffect, useState } from 'react';
import { Bike, MapPin, Loader2 } from 'lucide-react';
import { apiListOrders, apiUpdateOrderStatus } from '../lib/ordersApi';
import { useRealtimeOrders } from '../hooks/useRealtimeOrders';

interface DeliveryViewProps {
  restaurantId: string;
}

/** Motoboy só vê entregas prontas ou em andamento (seção Motoboy/Entrega do briefing). */
export function DeliveryView({ restaurantId }: DeliveryViewProps) {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      const all = await apiListOrders(restaurantId, ['pronto', 'em_entrega']);
      setOrders(all.filter((o: any) => o.order_type === 'delivery'));
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const { connected } = useRealtimeOrders(restaurantId, reload);

  const markPickedUp = (orderId: string) => apiUpdateOrderStatus(orderId, restaurantId, 'em_entrega').then(reload);
  const markDelivered = (orderId: string) => apiUpdateOrderStatus(orderId, restaurantId, 'finalizado').then(reload);

  return (
    <div className="min-h-screen bg-[#07090E] text-white p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold flex items-center gap-2"><Bike size={20}/> Minhas Entregas</h1>
        <span className={`text-xs ${connected ? 'text-emerald-400' : 'text-amber-400'}`}>
          {connected ? '● Ao vivo' : '○ Reconectando...'}
        </span>
      </div>
      {loading ? (
        <Loader2 className="animate-spin" />
      ) : orders.length === 0 ? (
        <p className="text-white/50">Nenhuma entrega no momento.</p>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <div key={order.id} className="rounded-xl border border-white/10 p-4 bg-white/[0.03]">
              <div className="flex justify-between mb-1">
                <span className="font-semibold">{order.short_code}</span>
                <span className="text-xs uppercase text-white/40">{order.status}</span>
              </div>
              <p className="text-sm text-white/60 flex items-center gap-1 mb-2">
                <MapPin size={14} /> {order.customer_name || 'Cliente'} — {order.customer_phone || 'sem telefone'}
              </p>
              <p className="text-sm font-medium mb-3">R$ {Number(order.total).toFixed(2)}</p>
              {order.status === 'pronto' ? (
                <button onClick={() => markPickedUp(order.id)} className="w-full text-sm bg-white text-black rounded-lg py-2 font-medium">
                  Peguei o pedido
                </button>
              ) : (
                <button onClick={() => markDelivered(order.id)} className="w-full text-sm bg-white text-black rounded-lg py-2 font-medium">
                  Entreguei
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
