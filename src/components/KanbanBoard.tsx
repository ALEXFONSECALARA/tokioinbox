import React, { useCallback, useEffect, useState } from 'react';
import { Clock, Utensils, ShoppingBag, Bike, Loader2 } from 'lucide-react';
import { apiListOrders, apiUpdateOrderStatus } from '../lib/ordersApi';
import { useRealtimeOrders } from '../hooks/useRealtimeOrders';
import { useToast } from '../context/ToastContext';

const COLUMNS: { status: string; label: string }[] = [
  { status: 'novo', label: 'Novo' },
  { status: 'confirmado', label: 'Confirmado' },
  { status: 'preparando', label: 'Preparando' },
  { status: 'pronto', label: 'Pronto' },
  { status: 'em_entrega', label: 'Em Entrega' },
  { status: 'finalizado', label: 'Finalizado' },
];

const NEXT_STATUS: Record<string, string | null> = {
  novo: 'confirmado',
  confirmado: 'preparando',
  preparando: 'pronto',
  pronto: null, // pronto pode ir pra em_entrega (delivery) OU finalizado (mesa/balcão) - decidido no botão
  em_entrega: 'finalizado',
  finalizado: null,
  cancelado: null,
};

const SOURCE_ICON: Record<string, React.ReactNode> = {
  mesa: <Utensils size={14} />,
  balcao: <ShoppingBag size={14} />,
  delivery: <Bike size={14} />,
  online: <ShoppingBag size={14} />,
};

interface KanbanBoardProps {
  restaurantId: string;
}

/** Kanban único de operação (seção 8): todos os pedidos, de qualquer origem, num só lugar. */
export function KanbanBoard({ restaurantId }: KanbanBoardProps) {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const { showToast } = useToast();

  const reload = useCallback(async () => {
    try {
      const data = await apiListOrders(restaurantId);
      setOrders(data);
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const { connected } = useRealtimeOrders(restaurantId, reload);

  const advance = async (order: any, targetStatus: string) => {
    setBusyId(order.id);
    try {
      await apiUpdateOrderStatus(order.id, restaurantId, targetStatus);
      await reload();
      showToast(`Pedido ${order.short_code} → ${targetStatus}`, 'success');
    } catch (err) {
      showToast((err as Error).message, 'error');
    } finally {
      setBusyId(null);
    }
  };

  const cancel = async (order: any) => {
    if (!confirm(`Cancelar o pedido ${order.short_code}?`)) return;
    await advance(order, 'cancelado');
  };

  return (
    <div className="min-h-screen bg-[#07090E] text-white p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold">Kanban de Pedidos</h1>
        <span className={`text-xs ${connected ? 'text-emerald-400' : 'text-amber-400'}`}>
          {connected ? '● Ao vivo' : '○ Reconectando...'}
        </span>
      </div>

      {loading ? (
        <Loader2 className="animate-spin" />
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {COLUMNS.map((col) => {
            const columnOrders = orders.filter((o) => o.status === col.status);
            return (
              <div key={col.status} className="min-w-[260px] w-[260px] shrink-0">
                <div className="flex items-center justify-between px-2 py-1.5 rounded-t-lg bg-white/5 text-sm font-medium">
                  <span>{col.label}</span>
                  <span className="text-white/40">{columnOrders.length}</span>
                </div>
                <div className="space-y-2 mt-2">
                  {columnOrders.map((order) => (
                    <div key={order.id} className="rounded-xl border border-white/10 p-3 bg-white/[0.03]">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-semibold flex items-center gap-1">
                          {SOURCE_ICON[order.source]} {order.short_code}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-white/40">
                          <Clock size={12} /> {new Date(order.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <ul className="text-xs text-white/60 mb-2 space-y-0.5">
                        {order.order_items?.map((it: any) => (
                          <li key={it.id}>{it.quantity}x {it.name_snapshot}</li>
                        ))}
                      </ul>
                      <p className="text-sm font-medium mb-2">R$ {Number(order.total).toFixed(2)}</p>
                      <div className="flex gap-2">
                        {col.status === 'pronto' ? (
                          <>
                            {order.order_type === 'delivery' ? (
                              <button
                                disabled={busyId === order.id}
                                onClick={() => advance(order, 'em_entrega')}
                                className="flex-1 text-xs bg-white text-black rounded-lg py-1.5 font-medium"
                              >
                                Saiu p/ entrega
                              </button>
                            ) : (
                              <button
                                disabled={busyId === order.id}
                                onClick={() => advance(order, 'finalizado')}
                                className="flex-1 text-xs bg-white text-black rounded-lg py-1.5 font-medium"
                              >
                                Finalizar
                              </button>
                            )}
                          </>
                        ) : NEXT_STATUS[col.status] ? (
                          <button
                            disabled={busyId === order.id}
                            onClick={() => advance(order, NEXT_STATUS[col.status]!)}
                            className="flex-1 text-xs bg-white text-black rounded-lg py-1.5 font-medium"
                          >
                            Avançar
                          </button>
                        ) : null}
                        {col.status !== 'finalizado' && col.status !== 'cancelado' && (
                          <button
                            disabled={busyId === order.id}
                            onClick={() => cancel(order)}
                            className="text-xs border border-white/20 rounded-lg px-2 py-1.5 text-white/60"
                          >
                            Cancelar
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
