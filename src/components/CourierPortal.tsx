import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { Order } from '../types/restaurant';
import { BRAND_SHORT_NAME } from '../config/brand';
import {
  Bike,
  X,
  CheckCircle2,
  Navigation,
  Phone,
  AlertTriangle,
  Clock,
  DollarSign,
  MapPin,
  Power,
  ShieldCheck,
  ChevronRight,
} from 'lucide-react';

interface CourierPortalProps {
  isOpen?: boolean;
  onClose?: () => void;
  /** uso como tela do painel (rota /entregador) */
  onBackToHome?: () => void;
}

export const CourierPortal: React.FC<CourierPortalProps> = ({ isOpen, onClose, onBackToHome }) => {
  const { orders, updateOrderStatus, currentUser } = useStore();
  const closePortal = () => (onBackToHome || onClose)?.();

  // A identidade do entregador é o usuário logado no painel (login validado no servidor).
  // Não existe mais PIN local nem nome de exemplo.
  const courierName = currentUser?.name || 'Entregador';
  const [isOnline, setIsOnline] = useState(true);
  const [problemOrderId, setProblemOrderId] = useState<string | null>(null);
  const [problemDescription, setProblemDescription] = useState('');

  if (isOpen === false) return null;

  const handleLogout = closePortal;

  // Orders available for delivery or currently assigned:
  // Statuses: 'pronto' (ready for pickup) or 'saiu_para_entrega' (in route)
  const readyOrders = orders.filter((o) => o.orderType === 'delivery' && o.status === 'pronto');
  const inRouteOrders = orders.filter((o) => o.orderType === 'delivery' && o.status === 'saiu_para_entrega');
  const deliveredToday = orders.filter((o) => o.orderType === 'delivery' && o.status === 'entregue');

  const totalEarningsToday = deliveredToday.length * 6.5; // R$ 6,50 per delivery commission

  const handleAcceptAndStartRoute = async (orderId: string) => {
    await updateOrderStatus(orderId, 'saiu_para_entrega', `Retirado por ${courierName}. Iniciando rota.`);
  };

  const handleMarkDelivered = async (orderId: string) => {
    await updateOrderStatus(orderId, 'entregue', `Entregue com sucesso por ${courierName}.`);
  };

  const handleReportProblem = async (orderId: string) => {
    if (!problemDescription.trim()) return;
    await updateOrderStatus(
      orderId,
      'saiu_para_entrega',
      `[PROBLEMA ENTREGADOR]: ${problemDescription.trim()} - Relatado por ${courierName}`
    );
    setProblemOrderId(null);
    setProblemDescription('');
    alert('Ocorrência registrada no painel administrativo.');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-[#0E121B] border border-[#E3BD6A]/30 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.9)] overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-[#121622] via-[#0E121B] to-[#0A0D14] border-b border-[#E3BD6A]/20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-sm">
              <Bike className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-black text-white tracking-tight flex items-center gap-2">
                Portal do Entregador
              </h2>
              <p className="text-[11px] text-slate-400">
                Área restrita e exclusiva para motociclistas credenciados
              </p>
            </div>
          </div>
          <button
            onClick={closePortal}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {(
            <div className="space-y-6">
              {/* Courier Status Bar */}
              <div className="p-4 rounded-xl bg-[#121622] border border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-3.5 h-3.5 rounded-full ${isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
                  <div>
                    <h3 className="text-sm font-bold text-white">{courierName}</h3>
                    <p className="text-xs text-slate-400">{isOnline ? 'Pronto para entregas (Online)' : 'Pausado (Offline)'}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsOnline(!isOnline)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors ${
                      isOnline ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}
                  >
                    <Power className="w-3.5 h-3.5" />
                    <span>{isOnline ? 'Online' : 'Offline'}</span>
                  </button>

                  <button
                    onClick={handleLogout}
                    className="px-2.5 py-1.5 rounded-xl text-xs text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                  >
                    Sair
                  </button>
                </div>
              </div>

              {/* Earnings Today Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Entregas Hoje</span>
                  <span className="text-lg font-black text-white">{deliveredToday.length} concluidas</span>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Comissão Estimada</span>
                  <span className="text-lg font-black text-[#E3BD6A]">R$ {totalEarningsToday.toFixed(2)}</span>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 col-span-2 sm:col-span-1">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Em Rota Agora</span>
                  <span className="text-lg font-black text-cyan-400">{inRouteOrders.length} pedido(s)</span>
                </div>
              </div>

              {/* Active Route Orders */}
              <div className="space-y-3">
                <h3 className="text-xs font-black uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                  <Navigation className="w-4 h-4" />
                  <span>Em Rota de Entrega ({inRouteOrders.length})</span>
                </h3>

                {inRouteOrders.length === 0 ? (
                  <p className="text-xs text-slate-500 italic p-3 border border-dashed border-slate-800 rounded-xl">
                    Nenhum pedido em rota de entrega no momento.
                  </p>
                ) : (
                  inRouteOrders.map((order) => {
                    const fullAddr = order.deliveryAddress
                      ? `${order.deliveryAddress.street}, ${order.deliveryAddress.number} - ${order.deliveryAddress.neighborhood}, ${order.deliveryAddress.city}`
                      : 'Endereço não informado';
                    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddr)}`;

                    return (
                      <div
                        key={order.id}
                        className="p-4 rounded-xl bg-cyan-950/20 border border-cyan-500/40 space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-black text-[#E3BD6A]">{order.shortCode}</span>
                            <span className="text-xs font-bold text-slate-200">• {order.customerName}</span>
                          </div>
                          <span className="text-xs font-bold text-white">R$ {order.total.toFixed(2)}</span>
                        </div>

                        <div className="text-xs text-slate-300 space-y-1">
                          <div className="flex items-start gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                            <span>{fullAddr}</span>
                          </div>
                          {order.deliveryAddress?.complement && (
                            <p className="text-[11px] text-slate-400 pl-5">
                              Complemento: {order.deliveryAddress.complement}
                            </p>
                          )}
                          <div className="flex items-center gap-1.5 pl-5 text-[11px] text-slate-400">
                            <Phone className="w-3 h-3 text-slate-400" />
                            <a href={`tel:${order.customerPhone}`} className="text-cyan-400 hover:underline">
                              {order.customerPhone}
                            </a>
                          </div>
                        </div>

                        {/* Route Actions */}
                        <div className="flex items-center gap-2 pt-2 border-t border-cyan-900/40">
                          <a
                            href={mapsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-bold flex items-center justify-center gap-1.5 border border-slate-700 transition-colors"
                          >
                            <Navigation className="w-3.5 h-3.5" />
                            <span>Abrir no GPS / Waze</span>
                          </a>

                          <button
                            onClick={() => handleMarkDelivered(order.id)}
                            className="flex-1 py-2 px-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black flex items-center justify-center gap-1.5 shadow transition-colors"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Marcar Entregue</span>
                          </button>

                          <button
                            onClick={() => setProblemOrderId(order.id)}
                            className="p-2 rounded-lg bg-rose-950/50 text-rose-300 hover:bg-rose-900/60 border border-rose-500/30 text-xs"
                            title="Informar Problema"
                          >
                            <AlertTriangle className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Problem Reporter Form */}
                        {problemOrderId === order.id && (
                          <div className="p-3 rounded-lg bg-rose-950/80 border border-rose-500/40 space-y-2 mt-2">
                            <label className="text-[11px] font-bold text-rose-200 block">
                              Descreva o problema (Ex: cliente não atende, endereço não localizado):
                            </label>
                            <input
                              type="text"
                              value={problemDescription}
                              onChange={(e) => setProblemDescription(e.target.value)}
                              placeholder="Motivo..."
                              className="w-full px-2.5 py-1.5 rounded bg-slate-900 border border-rose-700 text-xs text-white focus:outline-none"
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleReportProblem(order.id)}
                                className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded"
                              >
                                Enviar Alerta
                              </button>
                              <button
                                onClick={() => setProblemOrderId(null)}
                                className="px-3 py-1 bg-slate-800 text-slate-300 text-xs rounded"
                              >
                                Cancelar
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Ready Orders to Pickup */}
              <div className="space-y-3">
                <h3 className="text-xs font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Prontos para Retirada no Restaurante ({readyOrders.length})</span>
                </h3>

                {readyOrders.length === 0 ? (
                  <p className="text-xs text-slate-500 italic p-3 border border-dashed border-slate-800 rounded-xl">
                    Nenhum pedido aguardando saída da cozinha no momento.
                  </p>
                ) : (
                  readyOrders.map((order) => (
                    <div
                      key={order.id}
                      className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between hover:border-slate-700 transition-colors"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-[#E3BD6A]">{order.shortCode}</span>
                          <span className="text-xs font-bold text-white">{order.restaurantName}</span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {order.deliveryAddress?.neighborhood} • Taxa entrega: R$ {order.deliveryFee.toFixed(2)}
                        </p>
                      </div>

                      <button
                        onClick={() => handleAcceptAndStartRoute(order.id)}
                        className="py-1.5 px-3 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 hover:brightness-110 text-slate-950 font-black text-xs shadow flex items-center gap-1"
                      >
                        <span>Aceitar e Sair</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
