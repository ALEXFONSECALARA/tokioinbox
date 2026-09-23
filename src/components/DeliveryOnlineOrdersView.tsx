import React, { useState, useMemo } from 'react';
import { useStore } from '../context/StoreContext';
import { Order, OrderStatus } from '../types/restaurant';
import { OrderOriginBadge } from './OrderOriginBadge';
import { ThermalTicketModal } from './ThermalTicketModal';
import { OfflineStatusIndicator } from './OfflineStatusIndicator';
import {
  Bike,
  Package,
  Clock,
  Phone,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Search,
  Printer,
  Receipt,
  ChevronRight,
  Filter,
  DollarSign,
  ExternalLink,
  MessageCircle,
  Truck,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { playAlertSound } from '../utils/audioAlert';

interface DeliveryOnlineOrdersViewProps {
  onBackToApp?: () => void;
}

export const DeliveryOnlineOrdersView: React.FC<DeliveryOnlineOrdersViewProps> = ({
  onBackToApp,
}) => {
  const { orders, updateOrderStatus, showToast, restaurants } = useStore();

  const [activeTab, setActiveTab] = useState<'all' | 'delivery' | 'retirada'>('all');
  const [statusFilter, setStatusFilter] = useState<'ativos' | 'recebido' | 'em_preparo' | 'pronto' | 'saiu_para_entrega' | 'entregue'>('ativos');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTicketOrder, setSelectedTicketOrder] = useState<Order | null>(null);

  // STRICT RULE: ONLY orders made outside the salon (NEVER mesa/dine-in)
  const onlineOrders = useMemo(() => {
    return orders.filter(
      (o) => o.orderType === 'delivery' || o.orderType === 'retirada' || o.orderType === 'balcao'
    );
  }, [orders]);

  // Filtered by tab, status and search
  const filteredOrders = useMemo(() => {
    return onlineOrders.filter((order) => {
      // Tab filter
      if (activeTab === 'delivery' && order.orderType !== 'delivery') return false;
      if (activeTab === 'retirada' && order.orderType !== 'retirada' && order.orderType !== 'balcao') return false;

      // Status filter
      if (statusFilter === 'ativos') {
        if (order.status === 'entregue' || order.status === 'finalizado' || order.status === 'cancelado') {
          return false;
        }
      } else {
        // (statusFilter já não pode ser 'ativos' aqui — tratado no if acima)
        if (statusFilter === 'em_preparo') {
          if (order.status !== 'em_preparo' && order.status !== 'em_producao') return false;
        } else if (order.status !== statusFilter) {
          return false;
        }
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const codeMatch = order.shortCode.toLowerCase().includes(q);
        const nameMatch = order.customerName.toLowerCase().includes(q);
        const phoneMatch = order.customerPhone.toLowerCase().includes(q);
        const addressMatch = order.deliveryAddress
          ? `${order.deliveryAddress.street} ${order.deliveryAddress.neighborhood} ${order.deliveryAddress.city}`
              .toLowerCase()
              .includes(q)
          : false;
        return codeMatch || nameMatch || phoneMatch || addressMatch;
      }

      return true;
    });
  }, [onlineOrders, activeTab, statusFilter, searchQuery]);

  // Counts
  const counts = useMemo(() => {
    const active = onlineOrders.filter((o) => o.status !== 'entregue' && o.status !== 'finalizado' && o.status !== 'cancelado');
    const delivery = active.filter((o) => o.orderType === 'delivery').length;
    const retirada = active.filter((o) => o.orderType === 'retirada' || o.orderType === 'balcao').length;
    return {
      totalAtivos: active.length,
      delivery,
      retirada,
    };
  }, [onlineOrders]);

  const handleAdvanceStatus = (order: Order) => {
    let nextStatus: OrderStatus = 'em_preparo';
    if (order.status === 'recebido' || order.status === 'aceito') {
      nextStatus = 'em_preparo';
    } else if (order.status === 'em_preparo' || order.status === 'em_producao') {
      nextStatus = 'pronto';
    } else if (order.status === 'pronto') {
      nextStatus = order.orderType === 'delivery' ? 'saiu_para_entrega' : 'entregue';
    } else if (order.status === 'saiu_para_entrega') {
      nextStatus = 'entregue';
    }

    updateOrderStatus(order.id, nextStatus);
    playAlertSound('sound1', 0.5);
    showToast(`Pedido #${order.shortCode} atualizado para "${nextStatus.replace('_', ' ').toUpperCase()}"`, 'success');
  };

  return (
    <div className="h-full bg-[#07090E] text-slate-100 flex flex-col font-sans overflow-hidden">
      {/* Header */}
      <header className="bg-[#0D111A] border-b border-slate-800/80 px-4 lg:px-8 py-4 sticky top-0 z-30 shadow-xl">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Truck className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
                  <span>DELIVERY & PEDIDOS ONLINE</span>
                  <span className="text-[11px] bg-emerald-500/20 text-emerald-300 font-bold px-2 py-0.5 rounded-full border border-emerald-500/30">
                    MÓDULO EXCLUSIVO
                  </span>
                </h1>
                <p className="text-xs text-slate-400">
                  Gestão isolada de entregas e retiradas — NUNCA misturado com consumo de salão
                </p>
              </div>
            </div>
          </div>

          {/* Quick Metrics & Offline Status */}
          <div className="flex items-center gap-3">
            <OfflineStatusIndicator />

            <div className="bg-[#141923] border border-slate-800 px-3.5 py-2 rounded-xl flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
              <div className="text-left">
                <div className="text-[10px] text-slate-400 font-bold uppercase">Ativos</div>
                <div className="text-sm font-black text-white font-mono">{counts.totalAtivos}</div>
              </div>
            </div>

            <div className="bg-[#141923] border border-slate-800 px-3.5 py-2 rounded-xl flex items-center gap-2">
              <Bike className="w-4 h-4 text-emerald-400" />
              <div className="text-left">
                <div className="text-[10px] text-slate-400 font-bold uppercase">Delivery</div>
                <div className="text-sm font-black text-emerald-400 font-mono">{counts.delivery}</div>
              </div>
            </div>

            <div className="bg-[#141923] border border-slate-800 px-3.5 py-2 rounded-xl flex items-center gap-2">
              <Package className="w-4 h-4 text-sky-400" />
              <div className="text-left">
                <div className="text-[10px] text-slate-400 font-bold uppercase">Retirada</div>
                <div className="text-sm font-black text-sky-400 font-mono">{counts.retirada}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="max-w-7xl mx-auto mt-4 pt-4 border-t border-slate-800/60 flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Main Mode Tabs */}
          <div className="flex items-center gap-1 bg-[#121622] p-1 rounded-xl border border-slate-800 w-full md:w-auto">
            <button
              onClick={() => setActiveTab('all')}
              className={`flex-1 md:flex-initial px-4 py-2 rounded-lg text-xs font-black transition-all ${
                activeTab === 'all'
                  ? 'bg-slate-700 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              TODOS ({onlineOrders.length})
            </button>
            <button
              onClick={() => setActiveTab('delivery')}
              className={`flex-1 md:flex-initial px-4 py-2 rounded-lg text-xs font-black flex items-center justify-center gap-1.5 transition-all ${
                activeTab === 'delivery'
                  ? 'bg-emerald-500 text-slate-950 shadow-[0_0_12px_rgba(16,185,129,0.4)]'
                  : 'text-emerald-400 hover:bg-emerald-500/10'
              }`}
            >
              <Bike className="w-3.5 h-3.5" />
              <span>🚚 DELIVERY</span>
            </button>
            <button
              onClick={() => setActiveTab('retirada')}
              className={`flex-1 md:flex-initial px-4 py-2 rounded-lg text-xs font-black flex items-center justify-center gap-1.5 transition-all ${
                activeTab === 'retirada'
                  ? 'bg-sky-500 text-slate-950 shadow-[0_0_12px_rgba(14,165,233,0.4)]'
                  : 'text-sky-400 hover:bg-sky-500/10'
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              <span>📦 RETIRADA</span>
            </button>
          </div>

          {/* Search Box */}
          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por #pedido, cliente, rua..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-[#121622] border border-slate-800 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>
        </div>

        {/* Status Pills */}
        <div className="max-w-7xl mx-auto mt-3 flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <button
            onClick={() => setStatusFilter('ativos')}
            className={`px-3 py-1.5 rounded-lg font-bold uppercase transition-colors whitespace-nowrap ${
              statusFilter === 'ativos'
                ? 'bg-amber-500 text-slate-950'
                : 'bg-slate-900 text-slate-400 hover:text-white'
            }`}
          >
            ⚡ Em Andamento (Ativos)
          </button>
          <button
            onClick={() => setStatusFilter('recebido')}
            className={`px-3 py-1.5 rounded-lg font-bold uppercase transition-colors whitespace-nowrap ${
              statusFilter === 'recebido'
                ? 'bg-blue-500 text-white'
                : 'bg-slate-900 text-slate-400 hover:text-white'
            }`}
          >
            📥 Recebidos / Novos
          </button>
          <button
            onClick={() => setStatusFilter('em_preparo')}
            className={`px-3 py-1.5 rounded-lg font-bold uppercase transition-colors whitespace-nowrap ${
              statusFilter === 'em_preparo'
                ? 'bg-orange-500 text-white'
                : 'bg-slate-900 text-slate-400 hover:text-white'
            }`}
          >
            🔥 Em Preparo
          </button>
          <button
            onClick={() => setStatusFilter('pronto')}
            className={`px-3 py-1.5 rounded-lg font-bold uppercase transition-colors whitespace-nowrap ${
              statusFilter === 'pronto'
                ? 'bg-emerald-500 text-slate-950'
                : 'bg-slate-900 text-slate-400 hover:text-white'
            }`}
          >
            ✅ Prontos p/ Despacho
          </button>
          <button
            onClick={() => setStatusFilter('saiu_para_entrega')}
            className={`px-3 py-1.5 rounded-lg font-bold uppercase transition-colors whitespace-nowrap ${
              statusFilter === 'saiu_para_entrega'
                ? 'bg-purple-500 text-white'
                : 'bg-slate-900 text-slate-400 hover:text-white'
            }`}
          >
            🛵 Em Rota (Na Rua)
          </button>
          <button
            onClick={() => setStatusFilter('entregue')}
            className={`px-3 py-1.5 rounded-lg font-bold uppercase transition-colors whitespace-nowrap ${
              statusFilter === 'entregue'
                ? 'bg-slate-700 text-white'
                : 'bg-slate-900 text-slate-400 hover:text-white'
            }`}
          >
            🏁 Concluídos / Entregues
          </button>
        </div>
      </header>

      {/* Orders Grid */}
      <main className="max-w-7xl mx-auto p-4 lg:p-8 flex-1 min-h-0 w-full overflow-y-auto">
        {filteredOrders.length === 0 ? (
          <div className="bg-[#0F131D] border border-slate-800 rounded-3xl p-12 text-center my-8">
            <div className="w-16 h-16 rounded-full bg-slate-800/80 border border-slate-700 flex items-center justify-center mx-auto mb-4 text-slate-400">
              <Truck className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-white">Nenhum pedido encontrado nesta seção</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Neste módulo são listados exclusivamente pedidos de Delivery e Retirada. Quando um cliente fizer um pedido online, ele aparecerá aqui com aviso sonoro instantâneo.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {filteredOrders.map((order) => {
              const isDelivery = order.orderType === 'delivery';
              const isPaid = order.paymentDetails?.paid;
              const elapsedMinutes = Math.floor(
                (Date.now() - new Date(order.createdAt).getTime()) / (60 * 1000)
              );

              return (
                <div
                  key={order.id}
                  className={`bg-[#10141F] rounded-2xl border-2 flex flex-col shadow-xl overflow-hidden transition-all hover:border-slate-600 ${
                    isDelivery ? 'border-emerald-500/40' : 'border-sky-500/40'
                  }`}
                >
                  {/* Card Top: Visual Origin Badge & Timer */}
                  <div className="p-4 bg-[#141A28] border-b border-slate-800 flex items-start justify-between gap-3">
                    <OrderOriginBadge
                      orderType={order.orderType}
                      shortCode={order.shortCode}
                      variant="box"
                      className="min-w-[140px]"
                    />

                    <div className="flex flex-col items-end gap-1.5">
                      {/* Elapsed time */}
                      <div className="flex items-center gap-1 text-xs font-mono font-bold text-slate-300 bg-slate-900/80 px-2 py-1 rounded-lg border border-slate-700">
                        <Clock className="w-3.5 h-3.5 text-amber-400" />
                        <span>{elapsedMinutes} min</span>
                      </div>

                      {/* Status Badge */}
                      <span
                        className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border ${
                          order.status === 'recebido'
                            ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                            : order.status === 'em_preparo'
                            ? 'bg-amber-500/20 text-amber-400 border-amber-500/30 animate-pulse'
                            : order.status === 'pronto'
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                            : order.status === 'saiu_para_entrega'
                            ? 'bg-purple-500/20 text-purple-400 border-purple-500/30'
                            : 'bg-slate-800 text-slate-400 border-slate-700'
                        }`}
                      >
                        {order.status.replace('_', ' ')}
                      </span>
                    </div>
                  </div>

                  {/* Customer and Contact Details */}
                  <div className="p-4 border-b border-slate-800/80 space-y-2 bg-[#0E121C]">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-black text-white">{order.customerName}</span>
                      <a
                        href={`https://wa.me/55${order.customerPhone.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/30"
                      >
                        <MessageCircle className="w-3 h-3" />
                        <span>{order.customerPhone}</span>
                      </a>
                    </div>

                    {/* Address for Delivery or Counter pickup */}
                    {isDelivery && order.deliveryAddress ? (
                      <div className="flex items-start gap-2 text-xs text-slate-300 bg-[#161D2D] p-2.5 rounded-xl border border-slate-800">
                        <MapPin className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                        <div className="leading-tight">
                          <span className="font-bold text-white">
                            {order.deliveryAddress.street}, {order.deliveryAddress.number}
                          </span>
                          {order.deliveryAddress.complement && (
                            <span className="text-slate-400"> ({order.deliveryAddress.complement})</span>
                          )}
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            {order.deliveryAddress.neighborhood} • {order.deliveryAddress.city}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-xs text-sky-300 bg-[#121A28] p-2.5 rounded-xl border border-sky-500/20">
                        <Package className="w-4 h-4 text-sky-400 shrink-0" />
                        <span className="font-bold">Cliente retira no balcão da loja</span>
                      </div>
                    )}
                  </div>

                  {/* Order Items List */}
                  <div className="p-4 flex-1 space-y-2 overflow-y-auto max-h-48 divide-y divide-slate-800/60">
                    {order.items.map((item, idx) => (
                      <div key={idx} className="pt-2 first:pt-0 flex items-start justify-between gap-2 text-xs">
                        <div>
                          <span className="font-black text-white">{item.quantity}x {item.name}</span>
                          {item.selectedOptions && item.selectedOptions.length > 0 && (
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              {item.selectedOptions.map((o) => o.name).join(', ')}
                            </p>
                          )}
                          {item.notes && (
                            <p className="text-[11px] text-amber-300/90 font-medium italic mt-0.5 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                              Obs: {item.notes}
                            </p>
                          )}
                        </div>
                        <span className="font-mono text-slate-300 font-bold shrink-0">
                          R$ {item.totalPrice.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Notes Alert if any */}
                  {order.notes && (
                    <div className="px-4 py-2 bg-amber-500/10 border-t border-amber-500/20 text-[11px] text-amber-300 flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                      <span className="truncate font-semibold">Obs Geral: {order.notes}</span>
                    </div>
                  )}

                  {/* Financial & Action Footer */}
                  <div className="p-4 bg-[#141A28] border-t border-slate-800 space-y-3">
                    {/* Price and Payment Method */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs">
                        <span className="text-slate-400">Pagamento:</span>
                        <span className="font-bold text-white uppercase">{order.paymentMethod.replace('_', ' ')}</span>
                        <span
                          className={`text-[9px] font-black px-1.5 py-0.2 rounded ${
                            isPaid ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                          }`}
                        >
                          {isPaid ? 'PAGO' : 'A COBRAR'}
                        </span>
                      </div>

                      <div className="text-right">
                        <div className="text-[10px] text-slate-400">Total Pedido</div>
                        <div className="text-base font-black text-emerald-400 font-mono">
                          R$ {order.total.toFixed(2)}
                        </div>
                      </div>
                    </div>

                    {/* Operational Action Buttons */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setSelectedTicketOrder(order)}
                        className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
                        title="Imprimir comanda térmica de entrega"
                      >
                        <Printer className="w-4 h-4" />
                      </button>

                      {order.status !== 'entregue' && order.status !== 'finalizado' ? (
                        <button
                          onClick={() => handleAdvanceStatus(order)}
                          className="flex-1 py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-950/40 active:scale-95 transition-all"
                        >
                          <span>
                            {order.status === 'recebido'
                              ? 'Iniciar Preparo'
                              : order.status === 'em_preparo'
                              ? 'Marcar Pronto'
                              : order.status === 'pronto'
                              ? (isDelivery ? 'Despachar Entrega' : 'Entregar ao Cliente')
                              : 'Concluir Entrega'}
                          </span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <div className="flex-1 py-2 rounded-xl bg-slate-900 border border-slate-800 text-center text-xs font-bold text-slate-400 flex items-center justify-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          <span>Pedido Concluído</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Thermal Ticket Modal */}
      {/* BUG CORRIGIDO: faltava a prop `restaurant`, obrigatória no componente —
          o modal quebrava sempre que se tentava imprimir um pedido de delivery
          online a partir desta tela. */}
      {selectedTicketOrder && restaurants[selectedTicketOrder.restaurantSlug] && (
        <ThermalTicketModal
          order={selectedTicketOrder}
          restaurant={restaurants[selectedTicketOrder.restaurantSlug]}
          onClose={() => setSelectedTicketOrder(null)}
        />
      )}

    </div>
  );
};
