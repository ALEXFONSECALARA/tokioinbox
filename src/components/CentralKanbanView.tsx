import React, { useState, useMemo } from 'react';
import { useStore } from '../context/StoreContext';
import { Order, OrderStatus, ProductionStation, normalizeOrderType } from '../types/restaurant';
import { OrderOriginBadge } from './OrderOriginBadge';
import { OfflineStatusIndicator } from './OfflineStatusIndicator';
import {
  Kanban,
  Filter,
  Flame,
  Fish,
  Beer,
  Utensils,
  Store,
  Bike,
  Globe,
  Clock,
  CheckCircle2,
  AlertCircle,
  Printer,
  ChevronRight,
  Search,
  Volume2,
  VolumeX,
  RefreshCw,
  ArrowLeft,
  SlidersHorizontal,
  PackageCheck,
} from 'lucide-react';
import { playAlertSound } from '../utils/audioAlert';

interface CentralKanbanViewProps {
  onBackToApp?: () => void;
}

type ChannelFilter = 'all' | 'mesa' | 'balcao' | 'delivery' | 'retirada' | 'online';
type StationFilter = 'all' | 'cozinha' | 'sushibar' | 'bar';

export const CentralKanbanView: React.FC<CentralKanbanViewProps> = ({ onBackToApp }) => {
  const {
    orders,
    updateOrderStatus,
    updateStationStatus,
    soundSettings,
    updateSoundSettings,
    syncOrdersNow,
    showToast,
  } = useStore();

  const [channelFilter, setChannelFilter] = useState<ChannelFilter>('all');
  const [stationFilter, setStationFilter] = useState<StationFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Filter orders by channel, station, and search
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      // 1. Channel filter using canonical normalization
      if (channelFilter !== 'all') {
        const orderOrigin = normalizeOrderType(order.orderType);
        if (orderOrigin !== channelFilter) return false;
      }

      // 2. Production station filter using explicit item.station
      if (stationFilter !== 'all') {
        const hasStationItem = order.items.some((item) => item.station === stationFilter);
        if (!hasStationItem) return false;
      }

      // 3. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesCode = order.shortCode?.toLowerCase().includes(q);
        const matchesCust = order.customerName?.toLowerCase().includes(q);
        const matchesTable = order.tableNumber && String(order.tableNumber).includes(q);
        const matchesItem = order.items.some((i) => i.name.toLowerCase().includes(q));
        if (!matchesCode && !matchesCust && !matchesTable && !matchesItem) return false;
      }

      return true;
    });
  }, [orders, channelFilter, stationFilter, searchQuery]);

  // Kanban Columns
  const columns: Array<{
    id: string;
    title: string;
    badgeColor: string;
    statuses: OrderStatus[];
    actionLabel?: string;
    nextStatus?: OrderStatus;
  }> = [
    {
      id: 'recebidos',
      title: 'RECEBIDOS / NOVOS',
      badgeColor: 'border-sky-500/50 text-sky-400 bg-sky-500/10',
      statuses: ['recebido', 'aceito'],
      actionLabel: 'Iniciar Preparo',
      nextStatus: 'em_preparo',
    },
    {
      id: 'preparo',
      title: 'EM PRODUÇÃO',
      badgeColor: 'border-amber-500/50 text-amber-400 bg-amber-500/10',
      statuses: ['em_producao', 'em_preparo', 'parcialmente_pronto'],
      actionLabel: 'Marcar Pronto',
      nextStatus: 'pronto',
    },
    {
      id: 'prontos',
      title: 'PRONTOS / EXPEDIÇÃO',
      badgeColor: 'border-emerald-500/50 text-emerald-400 bg-emerald-500/10',
      statuses: ['pronto'],
      actionLabel: 'Despachar / Servir',
      nextStatus: 'saiu_para_entrega',
    },
    {
      id: 'entrega',
      title: 'EM ENTREGA / SERVIDOS',
      badgeColor: 'border-indigo-500/50 text-indigo-400 bg-indigo-500/10',
      statuses: ['saiu_para_entrega'],
      actionLabel: 'Finalizar',
      nextStatus: 'entregue',
    },
    {
      id: 'concluidos',
      title: 'CONCLUÍDOS',
      badgeColor: 'border-slate-600 text-slate-400 bg-slate-800/40',
      statuses: ['entregue', 'finalizado'],
    },
  ];

  const handleAdvanceStatus = async (order: Order, nextStatus: OrderStatus) => {
    try {
      await updateOrderStatus(order.id, nextStatus);
      playAlertSound('sound1', 0.4);
      showToast(`Pedido #${order.shortCode} atualizado para ${nextStatus.toUpperCase()}`, 'success');
    } catch {
      showToast('Erro ao avançar status', 'error');
    }
  };

  const getElapsedTimeMinutes = (createdAt: string) => {
    const diffMs = Date.now() - new Date(createdAt).getTime();
    return Math.floor(diffMs / 60000);
  };

  return (
    <div className="min-h-full h-full bg-[#07090E] text-slate-100 flex flex-col select-none overflow-hidden">
      {/* Top Header */}
      <header className="bg-[#0B0F19] border-b border-slate-800/80 px-4 py-3 flex flex-wrap items-center justify-between gap-3 sticky top-0 z-20">
        <div className="flex items-center gap-3">
          {onBackToApp && (
            <button
              onClick={onBackToApp}
              className="p-2 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl border border-slate-700/60 transition-colors"
              title="Voltar ao Início"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <Kanban className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-black tracking-tight text-white uppercase">
                  📋 KANBAN ÚNICO CENTRAL
                </h1>
                <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 text-[10px] font-black uppercase">
                  FLUXO INTEGRADO
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Visualização unificada de todos os pedidos com distinção visual por canal
              </p>
            </div>
          </div>
        </div>

        {/* Right Tools: Offline Status & Audio */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => updateSoundSettings({ enabled: !soundSettings.enabled })}
            className={`p-2 rounded-xl border transition-colors ${
              soundSettings.enabled
                ? 'bg-purple-500/20 border-purple-500/50 text-purple-300'
                : 'bg-slate-900 border-slate-800 text-slate-500'
            }`}
            title={soundSettings.enabled ? 'Som Ativado' : 'Som Desativado'}
          >
            {soundSettings.enabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
          <OfflineStatusIndicator showToggle />
        </div>
      </header>

      {/* Filter Toolbar */}
      <div className="bg-[#090D16] border-b border-slate-800/80 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
        {/* Channel Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mr-1 hidden sm:inline-block">
            CANAIS:
          </span>
          <button
            onClick={() => setChannelFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase transition-all ${
              channelFilter === 'all'
                ? 'bg-slate-100 text-slate-950 shadow-sm'
                : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            🌈 Todos
          </button>
          <button
            onClick={() => setChannelFilter('mesa')}
            className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase transition-all flex items-center gap-1 ${
              channelFilter === 'mesa'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'bg-slate-900 border border-slate-800 text-amber-400 hover:bg-amber-500/10'
            }`}
          >
            <Utensils className="w-3.5 h-3.5" /> 🍽️ Mesa
          </button>
          <button
            onClick={() => setChannelFilter('balcao')}
            className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase transition-all flex items-center gap-1 ${
              channelFilter === 'balcao'
                ? 'bg-sky-500 text-slate-950 shadow-md shadow-sky-500/20'
                : 'bg-slate-900 border border-slate-800 text-sky-400 hover:bg-sky-500/10'
            }`}
          >
            <Store className="w-3.5 h-3.5" /> 🚶 Balcão
          </button>
          <button
            onClick={() => setChannelFilter('delivery')}
            className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase transition-all flex items-center gap-1 ${
              channelFilter === 'delivery'
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                : 'bg-slate-900 border border-slate-800 text-emerald-400 hover:bg-emerald-500/10'
            }`}
          >
            <Bike className="w-3.5 h-3.5" /> 🚚 Delivery
          </button>
          <button
            onClick={() => setChannelFilter('retirada')}
            className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase transition-all flex items-center gap-1 ${
              channelFilter === 'retirada'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                : 'bg-slate-900 border border-slate-800 text-blue-400 hover:bg-blue-600/10'
            }`}
          >
            <PackageCheck className="w-3.5 h-3.5" /> 📦 Retirada
          </button>
          <button
            onClick={() => setChannelFilter('online')}
            className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase transition-all flex items-center gap-1 ${
              channelFilter === 'online'
                ? 'bg-purple-500 text-slate-950 shadow-md shadow-purple-500/20'
                : 'bg-slate-900 border border-slate-800 text-purple-400 hover:bg-purple-500/10'
            }`}
          >
            <Globe className="w-3.5 h-3.5" /> 🌐 Online
          </button>
        </div>

        {/* Station Filters & Search */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setStationFilter('all')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase transition-colors ${
                stationFilter === 'all' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Praças
            </button>
            <button
              onClick={() => setStationFilter('cozinha')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase flex items-center gap-1 transition-colors ${
                stationFilter === 'cozinha' ? 'bg-orange-500 text-slate-950' : 'text-orange-400 hover:bg-orange-500/10'
              }`}
            >
              <Flame className="w-3 h-3" /> Cozinha
            </button>
            <button
              onClick={() => setStationFilter('sushibar')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase flex items-center gap-1 transition-colors ${
                stationFilter === 'sushibar' ? 'bg-teal-500 text-slate-950' : 'text-teal-400 hover:bg-teal-500/10'
              }`}
            >
              <Fish className="w-3 h-3" /> Sushi
            </button>
            <button
              onClick={() => setStationFilter('bar')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase flex items-center gap-1 transition-colors ${
                stationFilter === 'bar' ? 'bg-purple-500 text-slate-950' : 'text-purple-400 hover:bg-purple-500/10'
              }`}
            >
              <Beer className="w-3 h-3" /> Bar
            </button>
          </div>

          <div className="relative w-44 sm:w-56">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Buscar pedido, mesa, item..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* Kanban Board — responsivo: 1/2/3/5 colunas conforme a largura.
          Evita min-w-max e evita o corte horizontal que ocorria no painel admin. */}
      <div className="flex-1 min-h-0 p-3 sm:p-4 overflow-y-hidden">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 h-full min-h-[520px]">
          {columns.map((col) => {
            const columnOrders = filteredOrders.filter((o) => col.statuses.includes(o.status));

            return (
              <div
                key={col.id}
                className="min-w-0 min-h-0 flex flex-col bg-[#0B0F19] rounded-2xl border border-slate-800/80 shadow-xl overflow-hidden"
              >
                {/* Column Header */}
                <div className="p-3 bg-[#0E1320] border-b border-slate-800/80 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-white uppercase tracking-wider">
                      {col.title}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full border text-[11px] font-mono font-bold ${col.badgeColor}`}>
                      {columnOrders.length}
                    </span>
                  </div>
                </div>

                {/* Column Cards Container */}
                <div className="flex-1 p-3 overflow-y-auto space-y-3">
                  {columnOrders.length === 0 ? (
                    <div className="h-40 flex flex-col items-center justify-center text-center text-slate-600">
                      <p className="text-xs">Nenhum pedido nesta etapa</p>
                    </div>
                  ) : (
                    columnOrders.map((order) => {
                      const elapsedMin = getElapsedTimeMinutes(order.createdAt);
                      const isOverdue = elapsedMin > 20 && order.status !== 'entregue' && order.status !== 'finalizado';

                      return (
                        <div
                          key={order.id}
                          className="bg-[#101626] border border-slate-800/90 hover:border-slate-700 rounded-2xl p-3.5 shadow-lg space-y-3 transition-all group"
                        >
                          {/* Card Top: Origin Badge + Elapsed Time */}
                          <div className="flex items-start justify-between gap-2">
                            <OrderOriginBadge
                              orderType={order.orderType}
                              tableNumber={order.tableNumber}
                              pickupNumber={order.pickupNumber}
                              shortCode={order.shortCode}
                              variant="box"
                              className="flex-1"
                            />
                          </div>

                          {/* Customer & Timestamp */}
                          <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800/60">
                            <span className="font-bold text-slate-200 truncate">
                              {order.customerName || 'Cliente'}
                            </span>
                            <span
                              className={`flex items-center gap-1 font-mono text-[11px] font-bold ${
                                isOverdue ? 'text-rose-400 animate-pulse' : 'text-slate-400'
                              }`}
                            >
                              <Clock className="w-3 h-3" />
                              <span>{elapsedMin}m atrás</span>
                            </span>
                          </div>

                          {/* Items List */}
                          <div className="bg-[#0A0E17] rounded-xl p-2.5 border border-slate-800/80 space-y-1.5 max-h-36 overflow-y-auto">
                            {order.items.map((item, idx) => (
                              <div key={idx} className="flex items-start justify-between text-xs gap-2">
                                <span className="font-medium text-slate-300 line-clamp-1">
                                  <strong className="text-white font-mono">{item.quantity}x</strong> {item.name}
                                </span>
                                {item.station && (
                                  <span className="text-[9px] px-1 py-0.2 rounded bg-slate-800 text-slate-400 uppercase font-mono whitespace-nowrap">
                                    {item.station}
                                  </span>
                                )}
                              </div>
                            ))}
                            {order.notes && (
                              <p className="text-[10px] text-amber-300/90 font-medium italic pt-1 border-t border-slate-800/60">
                                Obs: {order.notes}
                              </p>
                            )}
                          </div>

                          {/* Bottom Action Bar */}
                          <div className="flex items-center justify-between pt-1 gap-2">
                            <span className="font-mono font-black text-sm text-emerald-400">
                              R$ {order.total.toFixed(2)}
                            </span>

                            {col.nextStatus && (
                              <button
                                onClick={() => handleAdvanceStatus(order, col.nextStatus!)}
                                className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-indigo-600/20 active:scale-95 transition-all"
                              >
                                <span>{col.actionLabel}</span>
                                <ChevronRight className="w-3.5 h-3.5" />
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
      </div>
    </div>
  );
};
