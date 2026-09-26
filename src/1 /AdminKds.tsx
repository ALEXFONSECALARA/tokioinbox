import React, { useState, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { Order, RestaurantSlug } from '../types/restaurant';
import {
  ChefHat,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Layers,
  Volume2,
  RefreshCw,
  Utensils,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { playAlertSound } from '../utils/audioAlert';

interface AdminKdsProps {
  selectedFilterSlug: RestaurantSlug | 'all';
}

export const AdminKds: React.FC<AdminKdsProps> = ({ selectedFilterSlug }) => {
  const { orders, restaurants, updateOrderStatus, checkPermission } = useStore();
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [completedItems, setCompletedItems] = useState<Record<string, boolean>>({});

  // Auto tick every 5 seconds to update timers
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(Date.now()), 5000);
    return () => clearInterval(interval);
  }, []);

  // Filter kitchen orders: only 'recebido' and 'em_preparo'
  const kitchenOrders = orders
    .filter((o) => {
      if (selectedFilterSlug !== 'all' && o.restaurantSlug !== selectedFilterSlug) return false;
      return o.status === 'recebido' || o.status === 'em_preparo';
    })
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  // Aggregate items across all pending kitchen orders for batch prep
  const aggregatedItems = kitchenOrders.reduce((acc, order) => {
    order.items.forEach((item) => {
      const key = `${item.name}-${item.selectedOptions?.map((o) => o.name).sort().join(',') || ''}`;
      if (!acc[key]) {
        acc[key] = {
          name: item.name,
          options: item.selectedOptions?.map((o) => o.name).join(', '),
          totalQty: 0,
          orders: [],
        };
      }
      acc[key].totalQty += item.quantity;
      acc[key].orders.push(order.shortCode);
    });
    return acc;
  }, {} as Record<string, { name: string; options?: string; totalQty: number; orders: string[] }>);

  const toggleItemReady = (orderId: string, itemIdx: number) => {
    const key = `${orderId}-${itemIdx}`;
    setCompletedItems((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleStartOrder = (order: Order) => {
    if (!checkPermission('can_edit_orders')) return;
    updateOrderStatus(order.id, 'em_preparo', 'Iniciado na cozinha KDS');
    playAlertSound('sound1', 0.5);
  };

  const handleFinishOrder = (order: Order) => {
    if (!checkPermission('can_edit_orders')) return;
    updateOrderStatus(order.id, 'pronto', 'Concluído na cozinha KDS');
    playAlertSound('sound3', 0.7);
  };

  return (
    <div className="space-y-6 animate-fadeIn text-slate-100">
      {/* KDS Header */}
      <div className="bg-[#12151C] border border-[#222836] rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-slate-950 font-black shadow-lg">
            <ChefHat className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-black text-white uppercase tracking-wider">
                Cozinha &amp; Produção KDS
              </h2>
              <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-black px-2 py-0.5 rounded-full uppercase">
                Em Tempo Real
              </span>
            </div>
            <p className="text-xs text-slate-400">
              {kitchenOrders.length} pedido{kitchenOrders.length !== 1 ? 's' : ''} ativo
              {kitchenOrders.length !== 1 ? 's' : ''} na fila de preparo
            </p>
          </div>
        </div>

        {/* Quick KDS stats */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="bg-[#181D26] px-3.5 py-1.5 rounded-xl border border-slate-800 flex items-center gap-2 text-xs">
            <Clock className="w-4 h-4 text-amber-400" />
            <span className="text-slate-400">Tempo Alvo:</span>
            <strong className="text-white font-mono">15 min</strong>
          </div>
          <div className="bg-[#181D26] px-3.5 py-1.5 rounded-xl border border-slate-800 flex items-center gap-2 text-xs">
            <Flame className="w-4 h-4 text-orange-400" />
            <span className="text-slate-400">Em Fogo:</span>
            <strong className="text-orange-400 font-mono">
              {kitchenOrders.filter((o) => o.status === 'em_preparo').length}
            </strong>
          </div>
        </div>
      </div>

      {/* Aggregated Batch Preparation Bar (Itens Agrupados para a Cozinha) */}
      {Object.keys(aggregatedItems).length > 0 && (
        <div className="bg-[#151922] border border-[#272F3E] rounded-2xl p-4 shadow-lg">
          <div className="flex items-center gap-2 mb-3 text-xs font-black uppercase tracking-wider text-amber-400">
            <Layers className="w-4 h-4" />
            <span>Itens Agrupados no Total da Fila (Preparo em Lote)</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2.5">
            {Object.entries(aggregatedItems).map(([key, data]) => (
              <div
                key={key}
                className="bg-[#1C212D] border border-slate-800/80 hover:border-amber-500/40 p-2.5 rounded-xl flex items-center justify-between gap-2 transition-all shadow-sm"
              >
                <div className="min-w-0">
                  <span className="text-xs font-bold text-white block truncate">{data.name}</span>
                  {data.options && (
                    <span className="text-[10px] text-slate-400 block truncate">{data.options}</span>
                  )}
                  <span className="text-[9px] text-slate-500 font-mono block">
                    {data.orders.map((o) => `#${o}`).join(' ')}
                  </span>
                </div>
                <span className="text-sm font-black bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-lg border border-amber-500/30 font-mono shrink-0">
                  {data.totalQty}x
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Orders KDS Grid */}
      {kitchenOrders.length === 0 ? (
        <div className="bg-[#12151C] border border-[#222836] rounded-2xl p-12 text-center text-slate-400 space-y-3">
          <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto opacity-80" />
          <h3 className="text-sm font-black text-white uppercase tracking-wider">
            Cozinha Livre de Pedidos!
          </h3>
          <p className="text-xs max-w-sm mx-auto text-slate-400">
            Todos os pedidos ativos já foram preparados e despachados para expedição. Novos pedidos
            aparecerão aqui instantaneamente.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {kitchenOrders.map((order) => {
            const elapsedMins = Math.floor(
              (currentTime - new Date(order.createdAt).getTime()) / (60 * 1000)
            );
            const isDelayed = elapsedMins >= 15;
            const isWarning = elapsedMins >= 10 && elapsedMins < 15;
            const rest = restaurants[order.restaurantSlug];

            return (
              <div
                key={order.id}
                className={`bg-[#151922] rounded-2xl border-2 transition-all flex flex-col shadow-xl overflow-hidden ${
                  isDelayed
                    ? 'border-red-500/80 shadow-red-950/40 animate-pulse'
                    : isWarning
                    ? 'border-amber-500/80 shadow-amber-950/20'
                    : 'border-[#262D3D]'
                }`}
              >
                {/* Order Card Header */}
                <div
                  className={`p-3 border-b flex items-center justify-between ${
                    isDelayed
                      ? 'bg-red-950/60 border-red-800/60'
                      : isWarning
                      ? 'bg-amber-950/40 border-amber-800/40'
                      : 'bg-[#1A1F2B] border-slate-800'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-black text-white font-mono">
                        #{order.shortCode}
                      </span>
                      <span className="text-[10px] bg-slate-800 text-slate-300 font-bold px-1.5 py-0.5 rounded uppercase">
                        {order.orderType === 'delivery'
                          ? '🛵 Entrega'
                          : order.orderType === 'mesa'
                          ? `🍽 Mesa ${order.tableNumber || ''}`
                          : `🥡 Balcão #${order.pickupNumber || (order.shortCode.replace(/\D/g, '') || '')}`}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400 font-semibold block truncate">
                      {order.customerName} • {rest?.name || order.restaurantName}
                    </span>
                  </div>

                  {/* Stopwatch Badge */}
                  <div
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl font-mono text-xs font-black border ${
                      isDelayed
                        ? 'bg-red-500 text-white border-red-400 animate-bounce'
                        : isWarning
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        : 'bg-slate-800 text-slate-300 border-slate-700'
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>{elapsedMins} min</span>
                  </div>
                </div>

                {/* Items Checklist */}
                <div className="p-3.5 flex-1 space-y-2.5 overflow-y-auto max-h-72 divide-y divide-slate-800/60">
                  {order.items.map((item, idx) => {
                    const isDone = completedItems[`${order.id}-${idx}`];
                    return (
                      <div
                        key={idx}
                        onClick={() => toggleItemReady(order.id, idx)}
                        className={`pt-2 first:pt-0 cursor-pointer flex items-start justify-between gap-2 select-none group transition-opacity ${
                          isDone ? 'opacity-40 line-through' : 'opacity-100'
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <input
                            type="checkbox"
                            checked={!!isDone}
                            onChange={() => {}}
                            className="mt-1 w-4 h-4 rounded text-amber-500 focus:ring-0 cursor-pointer"
                          />
                          <div>
                            <span className="text-xs font-bold text-white group-hover:text-amber-400 transition-colors">
                              {item.quantity}x {item.name}
                            </span>
                            {item.selectedOptions && item.selectedOptions.length > 0 && (
                              <p className="text-[11px] text-slate-400 mt-0.5">
                                + {item.selectedOptions.map((o) => o.name).join(', ')}
                              </p>
                            )}
                            {item.notes && (
                              <p className="text-[10px] text-amber-300/90 font-medium italic mt-0.5 bg-amber-500/10 p-1 rounded">
                                Obs: {item.notes}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {order.notes && (
                    <div className="pt-2 text-[11px] text-amber-400 font-bold bg-amber-500/10 p-2 rounded-xl border border-amber-500/20">
                      Observação do Pedido: {order.notes}
                    </div>
                  )}
                </div>

                {/* Order Footer Actions */}
                <div className="p-3 bg-[#11141A] border-t border-slate-800/80 flex items-center gap-2">
                  {order.status === 'recebido' ? (
                    <button
                      onClick={() => handleStartOrder(order)}
                      className="w-full py-2 bg-gradient-to-r from-sky-600 to-sky-700 hover:from-sky-500 hover:to-sky-600 text-white text-xs font-black rounded-xl shadow transition-all flex items-center justify-center gap-1.5"
                    >
                      <Flame className="w-3.5 h-3.5" />
                      <span>Iniciar Preparo</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleFinishOrder(order)}
                      className="w-full py-2 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white text-xs font-black rounded-xl shadow transition-all flex items-center justify-center gap-1.5"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Pronto p/ Expedição</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
