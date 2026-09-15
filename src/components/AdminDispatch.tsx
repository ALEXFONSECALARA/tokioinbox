import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { Order, RestaurantSlug } from '../types/restaurant';
import {
  Bike,
  MapPin,
  Phone,
  CheckCircle2,
  Navigation,
  ExternalLink,
  Users,
  Clock,
  PackageCheck,
  Send,
  Sparkles,
  Smartphone,
  ShieldCheck,
  Layers,
} from 'lucide-react';
import { playAlertSound } from '../utils/audioAlert';

interface AdminDispatchProps {
  selectedFilterSlug: RestaurantSlug | 'all';
}

export const AdminDispatch: React.FC<AdminDispatchProps> = ({ selectedFilterSlug }) => {
  const {
    orders,
    restaurants,
    deliveryStaff,
    updateDeliveryStaffStatus,
    assignOrderToDelivery,
    updateOrderStatus,
    checkPermission,
  } = useStore();

  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState<string>('mot-1');
  const [mobileDriverViewId, setMobileDriverViewId] = useState<string | null>(null);

  // Ready orders waiting for courier
  const readyOrders = orders.filter((o) => {
    if (selectedFilterSlug !== 'all' && o.restaurantSlug !== selectedFilterSlug) return false;
    return o.status === 'pronto' && o.orderType === 'delivery';
  });

  // Orders currently on route
  const inTransitOrders = orders.filter((o) => {
    if (selectedFilterSlug !== 'all' && o.restaurantSlug !== selectedFilterSlug) return false;
    return o.status === 'saiu_para_entrega';
  });

  const toggleSelectOrder = (id: string) => {
    setSelectedOrderIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllReady = () => {
    if (selectedOrderIds.length === readyOrders.length) {
      setSelectedOrderIds([]);
    } else {
      setSelectedOrderIds(readyOrders.map((o) => o.id));
    }
  };

  const handleBatchDispatch = () => {
    if (!checkPermission('can_edit_orders')) return;
    if (selectedOrderIds.length === 0) {
      alert('Selecione pelo menos um pedido pronto para despachar.');
      return;
    }
    const staff = deliveryStaff.find((s) => s.id === selectedStaffId);
    if (!staff) {
      alert('Selecione um entregador válido.');
      return;
    }

    selectedOrderIds.forEach((orderId) => {
      assignOrderToDelivery(orderId, staff.id);
    });

    playAlertSound('sound3', 0.8);
    setSelectedOrderIds([]);
    alert(`Sucesso! ${selectedOrderIds.length} pedido(s) despachados com ${staff.name}.`);
  };

  const handleCompleteDelivery = (orderId: string) => {
    if (!checkPermission('can_edit_orders')) return;
    updateOrderStatus(orderId, 'entregue', 'Entrega confirmada pelo operador de expedição');
    playAlertSound('sound2', 0.6);
  };

  return (
    <div className="space-y-6 animate-fadeIn text-slate-100">
      {/* Header Bar */}
      <div className="bg-[#12151C] border border-[#222836] rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-black shadow-lg">
            <Bike className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-black text-white uppercase tracking-wider">
                Expedição &amp; Gestão de Entregadores
              </h2>
              <span className="bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 text-[10px] font-black px-2 py-0.5 rounded-full uppercase">
                Logística de Entrega
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Atribuição rápida de motoboys, saída em lote e rastreamento em mapa
            </p>
          </div>
        </div>

        {/* Courier Counter Status */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="bg-[#181D26] px-3.5 py-1.5 rounded-xl border border-slate-800 flex items-center gap-2 text-xs">
            <Users className="w-4 h-4 text-indigo-400" />
            <span className="text-slate-400">Motoboys Ativos:</span>
            <strong className="text-white font-mono">
              {deliveryStaff.filter((s) => s.status !== 'offline').length}/{deliveryStaff.length}
            </strong>
          </div>
          <div className="bg-[#181D26] px-3.5 py-1.5 rounded-xl border border-slate-800 flex items-center gap-2 text-xs">
            <PackageCheck className="w-4 h-4 text-purple-400" />
            <span className="text-slate-400">Aguardando Saída:</span>
            <strong className="text-purple-400 font-mono">{readyOrders.length}</strong>
          </div>
        </div>
      </div>

      {/* Grid: Delivery Personnel list & Ready Orders for Dispatch */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Delivery Staff Overview */}
        <div className="space-y-4">
          <div className="bg-[#151922] border border-[#242B3A] rounded-2xl p-4 shadow-lg">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-2 mb-3">
              <Users className="w-4 h-4 text-indigo-400" />
              <span>Equipe de Entregadores</span>
            </h3>

            <div className="space-y-2.5">
              {deliveryStaff.map((staff) => (
                <div
                  key={staff.id}
                  className={`p-3 rounded-xl border transition-all ${
                    selectedStaffId === staff.id
                      ? 'bg-indigo-950/40 border-indigo-500/80 shadow-md'
                      : 'bg-[#1A1F2B] border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-xs">
                        <Bike className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-white block">{staff.name}</span>
                        <span className="text-[11px] text-slate-400 font-mono">{staff.phone}</span>
                      </div>
                    </div>

                    {/* Status Pill */}
                    <select
                      value={staff.status}
                      onChange={(e) =>
                        updateDeliveryStaffStatus(staff.id, e.target.value as any)
                      }
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border focus:outline-none cursor-pointer ${
                        staff.status === 'disponivel'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                          : staff.status === 'em_entrega'
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}
                    >
                      <option value="disponivel" className="bg-slate-900">
                        Disponível
                      </option>
                      <option value="em_entrega" className="bg-slate-900">
                        Em Rota
                      </option>
                      <option value="offline" className="bg-slate-900">
                        Offline
                      </option>
                    </select>
                  </div>

                  <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                    <span>★ {staff.rating} ({staff.totalDeliveries} entregas)</span>
                    <button
                      onClick={() => setSelectedStaffId(staff.id)}
                      className={`text-xs font-bold px-2 py-0.5 rounded-md transition-colors ${
                        selectedStaffId === staff.id
                          ? 'bg-indigo-600 text-white'
                          : 'text-indigo-400 hover:text-white'
                      }`}
                    >
                      {selectedStaffId === staff.id ? 'Selecionado' : 'Selecionar'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right 2 Columns: Ready Orders for Batch Dispatch & On Route */}
        <div className="lg:col-span-2 space-y-6">
          {/* Section 1: Ready to Dispatch (with Batch Actions) */}
          <div className="bg-[#151922] border border-[#242B3A] rounded-2xl p-4 shadow-lg space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-purple-400 flex items-center gap-2">
                  <PackageCheck className="w-4 h-4" />
                  <span>Pedidos Prontos para Despacho ({readyOrders.length})</span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Selecione um ou múltiplos pedidos para saída simultânea com o entregador
                </p>
              </div>

              {readyOrders.length > 0 && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSelectAllReady}
                    className="text-xs text-slate-400 hover:text-white font-bold px-2.5 py-1 bg-[#1A1F2B] rounded-lg border border-slate-800"
                  >
                    {selectedOrderIds.length === readyOrders.length ? 'Desmarcar Todos' : 'Marcar Todos'}
                  </button>
                  <button
                    onClick={handleBatchDispatch}
                    disabled={selectedOrderIds.length === 0}
                    className="px-3.5 py-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-40 text-white font-black text-xs rounded-xl shadow transition-all flex items-center gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Despachar Lote ({selectedOrderIds.length})</span>
                  </button>
                </div>
              )}
            </div>

            {readyOrders.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                Nenhum pedido aguardando entrega no momento.
              </div>
            ) : (
              <div className="space-y-2.5">
                {readyOrders.map((order) => {
                  const isSelected = selectedOrderIds.includes(order.id);
                  const addressStr = order.deliveryAddress
                    ? `${order.deliveryAddress.street}, ${order.deliveryAddress.number} - ${order.deliveryAddress.neighborhood}, ${order.deliveryAddress.city}`
                    : 'Retirada no balcão';
                  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                    addressStr
                  )}`;

                  return (
                    <div
                      key={order.id}
                      className={`p-3.5 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        isSelected
                          ? 'bg-purple-950/30 border-purple-500/80 shadow-md'
                          : 'bg-[#1A1F2B] border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectOrder(order.id)}
                          className="mt-1 w-4 h-4 rounded text-purple-500 focus:ring-0 cursor-pointer"
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-black text-white font-mono">
                              #{order.shortCode}
                            </span>
                            <span className="text-xs font-bold text-slate-300">
                              {order.customerName}
                            </span>
                            <span className="text-[10px] bg-slate-800 text-purple-300 px-2 py-0.5 rounded font-mono font-bold">
                              R$ {order.total.toFixed(2)}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-1">
                            <MapPin className="w-3.5 h-3.5 text-red-400 shrink-0" />
                            <span className="truncate max-w-md">{addressStr}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <a
                          href={mapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                          title="Abrir no Google Maps"
                        >
                          <Navigation className="w-3.5 h-3.5 text-blue-400" />
                        </a>
                        <button
                          onClick={() => {
                            assignOrderToDelivery(order.id, selectedStaffId);
                            playAlertSound('sound3', 0.8);
                          }}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow transition-colors flex items-center gap-1"
                        >
                          <Send className="w-3 h-3" />
                          <span>Despachar</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section 2: In Transit / Out for Delivery */}
          <div className="bg-[#151922] border border-[#242B3A] rounded-2xl p-4 shadow-lg space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-indigo-400 flex items-center gap-2">
              <Bike className="w-4 h-4" />
              <span>Pedidos em Rota de Entrega ({inTransitOrders.length})</span>
            </h3>

            {inTransitOrders.length === 0 ? (
              <div className="py-6 text-center text-slate-400 text-xs">
                Nenhum pedido em trânsito no momento.
              </div>
            ) : (
              <div className="space-y-2.5">
                {inTransitOrders.map((order) => {
                  const addressStr = order.deliveryAddress
                    ? `${order.deliveryAddress.street}, ${order.deliveryAddress.number} - ${order.deliveryAddress.neighborhood}`
                    : '';
                  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                    addressStr
                  )}`;

                  return (
                    <div
                      key={order.id}
                      className="p-3.5 rounded-xl bg-[#1A1F2B] border border-indigo-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-black text-white font-mono">
                            #{order.shortCode}
                          </span>
                          <span className="text-xs font-bold text-slate-200">
                            {order.customerName}
                          </span>
                          <span className="text-[10px] bg-indigo-500/20 text-indigo-300 font-bold px-2 py-0.5 rounded">
                            {order.paymentMethod.toUpperCase()} • R$ {order.total.toFixed(2)}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-1">
                          <MapPin className="w-3.5 h-3.5 text-red-400 shrink-0" />
                          <span>{addressStr}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <a
                          href={mapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1 transition-colors"
                        >
                          <Navigation className="w-3 h-3 text-blue-400" />
                          <span>Rota</span>
                        </a>

                        <button
                          onClick={() => handleCompleteDelivery(order.id)}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl shadow transition-colors flex items-center gap-1"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Confirmar Entrega</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
