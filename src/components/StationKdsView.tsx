import React, { useState, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { Order, ProductionStation, StationItemStatus, RestaurantSlug } from '../types/restaurant';
import {
  Beer,
  Utensils,
  Fish,
  Clock,
  CheckCircle2,
  Flame,
  AlertTriangle,
  ArrowLeft,
  Volume2,
  RefreshCw,
  Layers,
  Sparkles,
  Timer,
} from 'lucide-react';
import { playAlertSound } from '../utils/audioAlert';

interface StationKdsViewProps {
  station: ProductionStation;
  onBack?: () => void;
  standalone?: boolean;
}

export const StationKdsView: React.FC<StationKdsViewProps> = ({
  station,
  onBack,
  standalone = false,
}) => {
  const { orders, restaurants, updateStationStatus, currentUser } = useStore();
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [completedItemKeys, setCompletedItemKeys] = useState<Record<string, boolean>>({});

  // Timer refresh every 5s
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(Date.now()), 5000);
    return () => clearInterval(interval);
  }, []);

  // Station metadata
  const stationConfig = {
    bar: {
      title: 'KDS BAR & DRINKS',
      subtitle: 'Produção exclusiva de bebidas, coquetéis, cafés e sucos',
      icon: Beer,
      gradient: 'from-purple-600 to-indigo-700',
      badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
      accentColor: 'text-purple-400',
      targetMinutes: 8,
    },
    cozinha: {
      title: 'KDS COZINHA PRINCIPAL',
      subtitle: 'Produção exclusiva de pratos quentes, entradas e massas',
      icon: Utensils,
      gradient: 'from-amber-500 to-orange-600',
      badgeColor: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
      accentColor: 'text-orange-400',
      targetMinutes: 18,
    },
    sushibar: {
      title: 'KDS SUSHIBAR',
      subtitle: 'Produção exclusiva de sushis, sashimis, temakis e combinados',
      icon: Fish,
      gradient: 'from-emerald-500 to-teal-700',
      badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
      accentColor: 'text-emerald-400',
      targetMinutes: 15,
    },
  }[station];

  const Icon = stationConfig.icon;

  const isItemForStation = (item: any, targetStation: ProductionStation): boolean => {
    if (item.station) return item.station === targetStation;
    const lower = (item.name || '').toLowerCase();
    const cat = (item.category || '').toLowerCase();

    const isBar =
      lower.includes('coca') ||
      lower.includes('suco') ||
      lower.includes('refrigerante') ||
      lower.includes('cerveja') ||
      lower.includes('chopp') ||
      lower.includes('drink') ||
      lower.includes('coquetel') ||
      lower.includes('gin') ||
      lower.includes('vodka') ||
      lower.includes('whisky') ||
      lower.includes('vinho') ||
      lower.includes('espumante') ||
      lower.includes('caipirinha') ||
      lower.includes('mocktail') ||
      lower.includes('água') ||
      lower.includes('agua') ||
      lower.includes('guaraná') ||
      lower.includes('guarana') ||
      lower.includes('red bull') ||
      lower.includes('energético') ||
      lower.includes('chá') ||
      lower.includes('cha') ||
      lower.includes('café') ||
      lower.includes('cafe') ||
      lower.includes('espresso') ||
      lower.includes('sake') ||
      lower.includes('saquê') ||
      lower.includes('heineken') ||
      lower.includes('stella') ||
      lower.includes('corona') ||
      lower.includes('smirnoff') ||
      lower.includes('campari') ||
      lower.includes('aperol') ||
      lower.includes('soda') ||
      lower.includes('tonica') ||
      lower.includes('tônica') ||
      lower.includes('licor') ||
      lower.includes('shot') ||
      cat.includes('bebida') ||
      cat.includes('drink') ||
      cat.includes('bar');

    if (isBar) return targetStation === 'bar';

    const isSushi =
      lower.includes('sushi') ||
      lower.includes('sashimi') ||
      lower.includes('temaki') ||
      lower.includes('uramaki') ||
      lower.includes('hossomaki') ||
      lower.includes('niguiri') ||
      lower.includes('gunkan') ||
      lower.includes('dyo') ||
      lower.includes('combinado') ||
      lower.includes('tartare') ||
      lower.includes('tartar') ||
      lower.includes('carpaccio') ||
      lower.includes('ceviche') ||
      lower.includes('hot roll') ||
      lower.includes('harumaki') ||
      lower.includes('poke') ||
      lower.includes('shimeji') ||
      lower.includes('sunomono') ||
      lower.includes('edamame') ||
      lower.includes('tataki') ||
      cat.includes('sushi') ||
      cat.includes('japones') ||
      cat.includes('japonês') ||
      cat.includes('oriental');

    if (isSushi) return targetStation === 'sushibar';

    return targetStation === 'cozinha';
  };

  // Filter orders that have items for this station and are not finished
  const stationOrders = orders
    .filter((order) => {
      // Ignore canceled or delivered orders
      if (order.status === 'entregue' || order.status === 'cancelado') return false;

      // Check if station status is already finished
      const currentStationStatus =
        order.stations?.[station]?.status || order.stationsStatus?.[station] || 'recebido';
      if (currentStationStatus === 'pedido_feito') return false;

      // Check if order contains at least one item destined to this station
      return order.items.some((item) => isItemForStation(item, station));
    })
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  // Filter items in each order to display ONLY items for this station
  const getStationItems = (order: Order) => {
    return order.items.filter((item) => isItemForStation(item, station));
  };

  const handleStartStation = async (orderId: string) => {
    await updateStationStatus(orderId, station, 'em_preparo');
    playAlertSound('sound1', 0.6);
  };

  const handleFinishStation = async (orderId: string) => {
    await updateStationStatus(orderId, station, 'pedido_feito');
    playAlertSound('sound3', 0.8);
  };

  const toggleItemReady = (orderId: string, itemIdx: number) => {
    const key = `${orderId}-${station}-${itemIdx}`;
    setCompletedItemKeys((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="min-h-screen bg-[#07090E] text-slate-100 flex flex-col font-sans p-4 sm:p-6 select-none">
      {/* Station Header */}
      <header className="bg-[#10141D] border border-slate-800/90 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-2xl mb-6">
        <div className="flex items-center gap-4">
          {onBack && (
            <button
              onClick={onBack}
              className="p-3 bg-slate-800/80 hover:bg-slate-700 text-slate-300 rounded-xl transition-all"
              title="Voltar"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}

          <div
            className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${stationConfig.gradient} flex items-center justify-center text-white shadow-xl`}
          >
            <Icon className="w-7 h-7" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-wider">
                {stationConfig.title}
              </h1>
              <span className={`text-[11px] font-black px-2.5 py-0.5 rounded-full border uppercase ${stationConfig.badgeColor}`}>
                Ao Vivo
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">{stationConfig.subtitle}</p>
          </div>
        </div>

        {/* Stats bar */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="bg-[#181D28] px-4 py-2 rounded-xl border border-slate-800 flex items-center gap-2.5">
            <Timer className="w-4 h-4 text-amber-400" />
            <div>
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Meta Preparo</span>
              <strong className="text-sm text-white font-mono">{stationConfig.targetMinutes} min</strong>
            </div>
          </div>

          <div className="bg-[#181D28] px-4 py-2 rounded-xl border border-slate-800 flex items-center gap-2.5">
            <Flame className="w-4 h-4 text-orange-400" />
            <div>
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Na Praça</span>
              <strong className="text-sm text-orange-400 font-mono">
                {stationOrders.length} pedido{stationOrders.length !== 1 ? 's' : ''}
              </strong>
            </div>
          </div>
        </div>
      </header>

      {/* Orders List */}
      {stationOrders.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center bg-[#10141D]/50 border border-slate-800/60 rounded-3xl p-12 text-center">
          <div className="w-20 h-20 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4">
            <CheckCircle2 className="w-10 h-10 text-emerald-400" />
          </div>
          <h2 className="text-lg font-black text-white uppercase tracking-wider">
            Praça 100% Zerada!
          </h2>
          <p className="text-sm text-slate-400 max-w-md mt-1">
            Não há comandas pendentes para esta praça no momento. Os novos pedidos feitos por
            clientes ou garçons soarão o alarme e entrarão aqui automaticamente.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 flex-1">
          {stationOrders.map((order) => {
            const stationStatus: StationItemStatus =
              order.stations?.[station]?.status || order.stationsStatus?.[station] || 'recebido';

            const elapsedMins = Math.floor(
              (currentTime - new Date(order.createdAt).getTime()) / (60 * 1000)
            );
            const isDelayed = elapsedMins >= stationConfig.targetMinutes;
            const items = getStationItems(order);

            return (
              <div
                key={order.id}
                className={`bg-[#121620] rounded-2xl border-2 transition-all flex flex-col shadow-2xl overflow-hidden ${
                  isDelayed
                    ? 'border-red-500/90 shadow-red-950/40 animate-pulse'
                    : stationStatus === 'em_preparo'
                    ? 'border-amber-500/80 shadow-amber-950/30'
                    : 'border-slate-800/90'
                }`}
              >
                {/* Header Card */}
                <div
                  className={`p-3.5 border-b flex items-center justify-between ${
                    isDelayed
                      ? 'bg-red-950/60 border-red-900/60'
                      : stationStatus === 'em_preparo'
                      ? 'bg-amber-950/40 border-amber-900/40'
                      : 'bg-[#181D28] border-slate-800'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-black text-white font-mono">
                        #{order.shortCode}
                      </span>
                      <span className="text-[10px] bg-slate-800 text-amber-300 font-black px-2 py-0.5 rounded-lg border border-amber-500/20 uppercase">
                        {order.orderType === 'mesa'
                          ? `🍽 MESA ${order.tableNumber}`
                          : order.orderType === 'balcao'
                          ? `🥡 BALCÃO #${order.pickupNumber || ''}`
                          : '🛵 DELIVERY'}
                      </span>
                    </div>
                    <span className="text-xs text-slate-400 font-semibold block truncate mt-0.5">
                      {order.customerName} {order.waiterName ? `(Garçom: ${order.waiterName})` : ''}
                    </span>
                  </div>

                  {/* Timer Badge */}
                  <div
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-xl font-mono text-xs font-black border ${
                      isDelayed
                        ? 'bg-red-500 text-white border-red-400 animate-bounce'
                        : 'bg-slate-900 text-slate-300 border-slate-700'
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>{elapsedMins} min</span>
                  </div>
                </div>

                {/* Items of THIS station */}
                <div className="p-4 flex-1 space-y-3 overflow-y-auto max-h-80 divide-y divide-slate-800/50">
                  {items.map((item, idx) => {
                    const isChecked = completedItemKeys[`${order.id}-${station}-${idx}`];
                    return (
                      <div
                        key={idx}
                        onClick={() => toggleItemReady(order.id, idx)}
                        className={`pt-2.5 first:pt-0 cursor-pointer flex items-start justify-between gap-3 group transition-opacity select-none ${
                          isChecked ? 'opacity-40 line-through' : 'opacity-100'
                        }`}
                      >
                        <div className="flex items-start gap-2.5">
                          <input
                            type="checkbox"
                            checked={!!isChecked}
                            onChange={() => {}}
                            className="mt-1 w-5 h-5 rounded text-amber-500 focus:ring-0 cursor-pointer bg-slate-900 border-slate-700"
                          />
                          <div>
                            <span className="text-sm font-black text-white group-hover:text-amber-400 transition-colors">
                              {item.quantity}x {item.name}
                            </span>
                            {item.selectedOptions && item.selectedOptions.length > 0 && (
                              <p className="text-xs text-slate-400 mt-0.5">
                                + {item.selectedOptions.map((o) => o.name).join(', ')}
                              </p>
                            )}
                            {item.notes && (
                              <p className="text-xs text-amber-300 font-bold bg-amber-500/10 p-1 rounded-md mt-1">
                                Obs: {item.notes}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {order.notes && (
                    <div className="pt-2 text-xs text-amber-400 font-bold bg-amber-500/10 p-2 rounded-xl border border-amber-500/20">
                      Obs Geral: {order.notes}
                    </div>
                  )}
                </div>

                {/* Action Buttons: RECEBER -> EM PREPARO -> PEDIDO FEITO */}
                <div className="p-3 bg-[#0D1017] border-t border-slate-800 flex flex-col gap-2">
                  <div className="flex items-center justify-between text-[11px] text-slate-400 px-1 font-semibold">
                    <span>Status Atual da Praça:</span>
                    <span
                      className={`font-black uppercase px-2 py-0.5 rounded ${
                        stationStatus === 'em_preparo'
                          ? 'bg-amber-500/20 text-amber-400'
                          : 'bg-sky-500/20 text-sky-400'
                      }`}
                    >
                      {stationStatus === 'em_preparo' ? 'Em Preparo' : 'Recebido'}
                    </span>
                  </div>

                  {stationStatus === 'recebido' ? (
                    <button
                      onClick={() => handleStartStation(order.id)}
                      className="w-full py-3 bg-gradient-to-r from-sky-600 to-sky-700 hover:from-sky-500 hover:to-sky-600 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 active:scale-95"
                    >
                      <Flame className="w-4 h-4" />
                      <span>Iniciar Preparo</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleFinishStation(order.id)}
                      className="w-full py-3 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 active:scale-95"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>PEDIDO FEITO (Liberar Praça)</span>
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
