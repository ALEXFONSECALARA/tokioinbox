import React, { useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { Order, OrderStatus, RestaurantSlug } from '../../types/restaurant';
import { ThermalTicketModal } from './ThermalTicketModal';
import {
  Clock,
  Printer,
  ChevronRight,
  XCircle,
  CheckCircle2,
  AlertTriangle,
  Bike,
  Store,
  UtensilsCrossed,
  Receipt,
  Trash2,
  Volume2,
  VolumeX,
  Filter,
} from 'lucide-react';

interface AdminKanbanProps {
  selectedFilterSlug: RestaurantSlug | 'all';
}

interface ColumnConfig {
  status: OrderStatus;
  title: string;
  emoji: string;
  badgeBg: string;
  nextStatus?: OrderStatus;
  nextLabel?: string;
}

const KANBAN_COLUMNS: ColumnConfig[] = [
  {
    status: 'recebido',
    title: 'Recebidos',
    emoji: '📥',
    badgeBg: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    nextStatus: 'em_preparo',
    nextLabel: 'Iniciar Preparo',
  },
  {
    status: 'em_preparo',
    title: 'Em Preparo',
    emoji: '👨‍🍳',
    badgeBg: 'bg-sky-500/10 text-sky-400 border-sky-500/30',
    nextStatus: 'pronto',
    nextLabel: 'Marcar como Pronto',
  },
  {
    status: 'pronto',
    title: 'Prontos',
    emoji: '📦',
    badgeBg: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    nextStatus: 'saiu_para_entrega',
    nextLabel: 'Despachar / Chamar Garçom',
  },
  {
    status: 'saiu_para_entrega',
    title: 'A Caminho',
    emoji: '🛵',
    badgeBg: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30',
    nextStatus: 'entregue',
    nextLabel: 'Concluir Entrega',
  },
  {
    status: 'entregue',
    title: 'Entregues',
    emoji: '✅',
    badgeBg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  },
];

export const AdminKanban: React.FC<AdminKanbanProps> = ({ selectedFilterSlug }) => {
  const {
    orders,
    restaurants,
    updateOrderStatus,
    deleteOrder,
  } = useStore();

  const [activeThermalOrder, setActiveThermalOrder] = useState<Order | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Filter orders by restaurant
  const filteredOrders = orders.filter((order) => {
    if (selectedFilterSlug !== 'all' && order.restaurantSlug !== selectedFilterSlug) {
      return false;
    }
    return true;
  });

  const handleAdvance = async (order: Order, nextStatus: OrderStatus) => {
    try { await updateOrderStatus(order.id, nextStatus); }
    catch (e: any) { alert(`Não foi possível atualizar o pedido.\n\n${e?.message || 'Erro desconhecido'}${e?.code ? ` (código: ${e.code})` : ''}`); }
  };

  const handleCancel = (order: Order) => {
    const reason = window.prompt(
      `Deseja realmente cancelar o pedido ${order.shortCode}? Informe o motivo para o histórico:`,
      'Cancelado pelo operador / Restaurante sem estoque'
    );
    if (reason !== null) {
      updateOrderStatus(order.id, 'cancelado', reason || 'Cancelado pelo operador').catch((e:any)=>alert(`Não foi possível cancelar o pedido.\n\n${e?.message || 'Erro desconhecido'}${e?.code ? ` (código: ${e.code})` : ''}`));
    }
  };

  const handleDelete = (order: Order) => {
    if (
      window.confirm(
        `Excluir o pedido ${order.shortCode} do histórico deste restaurante? Esta ação não pode ser desfeita.`
      )
    ) {
      deleteOrder(order.id).catch((e:any)=>alert(`Não foi possível excluir o pedido.\n\n${e?.message || 'Erro desconhecido'}${e?.code ? ` (código: ${e.code})` : ''}`));
    }
  };

  // Helper to format minutes elapsed
  const getMinutesElapsed = (createdAt: string) => {
    const diffMs = Date.now() - new Date(createdAt).getTime();
    const mins = Math.floor(diffMs / (60 * 1000));
    if (mins <= 0) return 'Agora';
    if (mins < 60) return `${mins} min`;
    const hours = Math.floor(mins / 60);
    return `${hours}h ${mins % 60}m`;
  };

  return (
    <div className="space-y-4">
      {/* Sound & Status Toolbar */}
      <div className="flex items-center justify-between bg-slate-900/90 border border-slate-800 p-3 rounded-2xl">
        <div className="flex items-center gap-2 text-xs">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-semibold text-white">Kanban Global em Tempo Real (SSE/Sync)</span>
          <span className="text-slate-400">• {filteredOrders.length} pedidos no total</span>
        </div>

        <button
          onClick={() => setSoundEnabled(!soundEnabled)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition-colors"
          title="Alerta sonoro para novos pedidos"
        >
          {soundEnabled ? (
            <>
              <Volume2 className="w-3.5 h-3.5 text-amber-400" />
              <span>Som Ativo</span>
            </>
          ) : (
            <>
              <VolumeX className="w-3.5 h-3.5 text-slate-500" />
              <span>Som Silenciado</span>
            </>
          )}
        </button>
      </div>

      {/* Kanban Board Columns Container */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 overflow-x-auto pb-6">
        {KANBAN_COLUMNS.map((col) => {
          const colOrders = filteredOrders.filter((o) => o.status === col.status);

          return (
            <div
              key={col.status}
              className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-3 flex flex-col min-h-[500px]"
            >
              {/* Column Header */}
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-800">
                <div className="flex items-center gap-1.5">
                  <span className="text-base">{col.emoji}</span>
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                    {col.title}
                  </h3>
                </div>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-extrabold border ${col.badgeBg}`}
                >
                  {colOrders.length}
                </span>
              </div>

              {/* Cards in this column */}
              <div className="flex-1 space-y-3 overflow-y-auto max-h-[calc(100vh-280px)] pr-1">
                {colOrders.length === 0 ? (
                  <div className="h-32 flex flex-col items-center justify-center text-slate-600 text-xs text-center p-2">
                    <span>Nenhum pedido aqui</span>
                  </div>
                ) : (
                  colOrders.map((order) => {
                    const rest = restaurants[order.restaurantSlug];
                    const elapsed = getMinutesElapsed(order.createdAt);

                    return (
                      <div
                        key={order.id}
                        className="bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl p-3 shadow-md space-y-2.5 transition-all text-xs"
                      >
                        {/* Restaurant and Code Header */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm">{rest?.emoji || '🍱'}</span>
                            <span className="font-bold text-slate-200 line-clamp-1">
                              {rest?.name?.split(' ')[0] || order.restaurantName}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <span className="font-black text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded text-[11px]">
                              {order.shortCode}
                            </span>
                            <span className="text-[10px] text-slate-500 flex items-center gap-0.5">
                              <Clock className="w-3 h-3" />
                              {elapsed}
                            </span>
                          </div>
                        </div>

                        {/* Customer & Type */}
                        <div className="bg-slate-900/80 p-2 rounded-lg space-y-1">
                          <div className="flex items-center justify-between font-semibold text-white">
                            <span className="truncate">{order.customerName}</span>
                            <span className="text-amber-400 font-extrabold shrink-0">
                              R$ {order.total.toFixed(2)}
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-[11px] text-slate-400">
                            <span className="flex items-center gap-1">
                              {order.orderType === 'delivery' && (
                                <>
                                  <Bike className="w-3 h-3 text-amber-400" />
                                  <span>Delivery</span>
                                </>
                              )}
                              {order.orderType === 'retirada' && (
                                <>
                                  <Store className="w-3 h-3 text-emerald-400" />
                                  <span>Retirada</span>
                                </>
                              )}
                              {order.orderType === 'mesa' && (
                                <>
                                  <UtensilsCrossed className="w-3 h-3 text-sky-400" />
                                  <span className="font-bold text-white">
                                    Mesa {order.tableNumber}
                                  </span>
                                </>
                              )}
                            </span>

                            <span className="capitalize text-[10px] text-slate-400">
                              {order.paymentMethod.replace('_', ' ')}
                            </span>
                          </div>
                        </div>

                        {/* Order Items Snippet */}
                        <div className="text-[11px] text-slate-300 space-y-0.5 border-l-2 border-amber-500/50 pl-2">
                          {order.items.map((item, idx) => (
                            <div key={idx} className="truncate">
                              <span className="font-bold text-white">{item.quantity}x</span>{' '}
                              {item.name}
                            </div>
                          ))}
                        </div>

                        {/* Notes if any */}
                        {order.notes && (
                          <p className="text-[10px] text-slate-400 italic bg-slate-900/40 px-2 py-1 rounded truncate">
                            Obs: {order.notes}
                          </p>
                        )}

                        {/* Print & Action Buttons */}
                        <div className="pt-1.5 border-t border-slate-800/80 flex items-center justify-between gap-1.5">
                          {/* Thermal Print Button */}
                          <button
                            onClick={() => setActiveThermalOrder(order)}
                            className={`p-1.5 rounded-lg border flex items-center gap-1 text-[11px] font-semibold transition-colors ${
                              order.printStatus === 'impresso'
                                ? 'bg-slate-900 text-emerald-400 border-emerald-500/30'
                                : 'bg-slate-900 text-amber-400 border-amber-500/30 hover:bg-slate-800'
                            }`}
                            title="Imprimir comanda térmica 80mm"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">
                              {order.printStatus === 'impresso' ? 'Impresso' : 'Imprimir'}
                            </span>
                          </button>

                          {/* Operational Advance Status Button */}
                          {col.nextStatus && (
                            <button
                              onClick={() => handleAdvance(order, col.nextStatus!)}
                              className="flex-1 py-1.5 px-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[11px] rounded-lg flex items-center justify-center gap-1 shadow-sm transition-all"
                            >
                              <span>{col.nextLabel || 'Avançar'}</span>
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Cancel or Delete Action */}
                          {order.status !== 'entregue' && order.status !== 'cancelado' ? (
                            <button
                              onClick={() => handleCancel(order)}
                              className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-slate-900 transition-colors"
                              title="Cancelar Pedido"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <button
                              onClick={() => handleDelete(order)}
                              className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-slate-900 transition-colors"
                              title="Excluir do Histórico"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Cancelled orders section if any */}
      {filteredOrders.some((o) => o.status === 'cancelado') && (
        <div className="bg-slate-900/50 border border-rose-950/80 rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <XCircle className="w-4 h-4 text-rose-400" />
            <h4 className="text-xs font-bold text-rose-300 uppercase tracking-wider">
              Pedidos Cancelados ({filteredOrders.filter((o) => o.status === 'cancelado').length})
            </h4>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredOrders
              .filter((o) => o.status === 'cancelado')
              .map((order) => (
                <div
                  key={order.id}
                  className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs flex items-center justify-between"
                >
                  <div>
                    <span className="font-bold text-white">{order.shortCode}</span> •{' '}
                    <span className="text-slate-400">{order.customerName}</span>
                    <p className="text-[10px] text-rose-400 mt-0.5">
                      {order.statusHistory[order.statusHistory.length - 1]?.note || 'Cancelado'}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDelete(order)}
                    className="p-1.5 text-slate-500 hover:text-rose-400"
                    title="Excluir definitivo"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Thermal Ticket Modal */}
      {activeThermalOrder && (
        <ThermalTicketModal
          order={activeThermalOrder}
          restaurant={
            restaurants[activeThermalOrder.restaurantSlug] || restaurants.japones
          }
          onClose={() => setActiveThermalOrder(null)}
        />
      )}
    </div>
  );
};
