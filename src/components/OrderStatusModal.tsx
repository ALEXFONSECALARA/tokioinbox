import React from 'react';
import { Order, RestaurantConfig } from '../types';
import { formatCurrency, getOrderStatusLabel } from '../utils/helpers';
import { 
  X, 
  CheckCircle2, 
  Clock, 
  ChefHat, 
  Bike, 
  Printer, 
  Phone, 
  MapPin, 
  ShoppingBag,
  Check,
  Star,
  ShieldCheck,
  MessageCircle
} from 'lucide-react';

interface OrderStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  orders: Order[];
  activeOrderId: string | null;
  onSelectOrder: (id: string) => void;
  restaurantConfig: RestaurantConfig;
  // Ajuste operacional atual (Fase 4, itens 14-16), atualizado por polling
  // enquanto o modal está de olho num pedido aberto — soma ao tempo padrão
  // do pedido pra refletir "restaurante mais devagar hoje" quase em tempo
  // real, sem o cliente precisar dar refresh na página.
  liveOperationalAdjustment?: number;
}

export const OrderStatusModal: React.FC<OrderStatusModalProps> = ({
  isOpen,
  onClose,
  orders,
  activeOrderId,
  onSelectOrder,
  restaurantConfig,
  liveOperationalAdjustment = 0,
}) => {
  if (!isOpen || orders.length === 0) return null;

  const currentOrder = orders.find((o) => o.id === activeOrderId) || orders[0];
  const statusInfo = getOrderStatusLabel(currentOrder.status);

  const steps = currentOrder.orderType === 'delivery' ? [
    { key: 'recebido', label: 'Recebido', icon: Clock, desc: 'Confirmado no sistema' },
    { key: 'em_preparo', label: 'Na Cozinha', icon: ChefHat, desc: 'Pedido sendo preparado' },
    { key: 'pronto', label: 'Pronto', icon: ShoppingBag, desc: 'Pedido embalado e pronto' },
    { key: 'saiu_entrega', label: 'A Caminho', icon: Bike, desc: 'Motoboy a caminho' },
    { key: 'entregue', label: 'Entregue', icon: CheckCircle2, desc: 'Bom apetite!' },
  ] : [
    { key: 'recebido', label: 'Recebido', icon: Clock, desc: 'Confirmado no sistema' },
    { key: 'em_preparo', label: 'Na Cozinha', icon: ChefHat, desc: 'Pedido sendo preparado' },
    { key: 'pronto', label: 'Pronto', icon: ShoppingBag, desc: 'Disponível para retirada' },
    { key: 'entregue', label: 'Concluído', icon: CheckCircle2, desc: 'Bom apetite!' },
  ];

  const handlePrint = () => {
    window.print();
  };

  const driver = currentOrder.driver || restaurantConfig.drivers[0];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div
        id="order-status-modal"
        className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-stone-200 overflow-hidden my-auto max-h-[92vh] flex flex-col animate-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 bg-stone-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[var(--brand)] text-slate-950 font-bold">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black tracking-tight">
                  Rastreamento do Pedido #{currentOrder.orderNumber}
                </h2>
                <span className="px-2 py-0.5 rounded-md bg-[var(--brand)]/20 text-[var(--brand-light)] text-[10px] font-black uppercase">
                  {currentOrder.orderType === 'delivery' ? '🛵 Delivery' : '🛍️ Retirada'}
                </span>
              </div>
              <p className="text-xs text-stone-300">
                Realizado em {new Date(currentOrder.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              id="print-order-receipt-btn"
              onClick={handlePrint}
              className="p-2 rounded-full hover:bg-stone-800 text-stone-300 hover:text-white transition-all"
              title="Imprimir Comprovante"
            >
              <Printer className="w-4 h-4" />
            </button>
            <button
              id="close-order-status-modal-btn"
              onClick={onClose}
              className="p-2 rounded-full hover:bg-stone-800 text-stone-400 hover:text-white transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Multi-order switcher tabs if multiple orders exist */}
        {orders.length > 1 && (
          <div className="bg-stone-100 px-4 py-2 border-b border-stone-200 flex items-center gap-2 overflow-x-auto scrollbar-none">
            <span className="text-[11px] font-bold text-stone-500 uppercase mr-1">Seus Pedidos:</span>
            {orders.map((o) => (
              <button
                key={o.id}
                onClick={() => onSelectOrder(o.id)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                  o.id === currentOrder.id
                    ? 'bg-[var(--brand)] text-slate-950 shadow-xs'
                    : 'bg-white text-stone-600 hover:bg-stone-200'
                }`}
              >
                #{o.orderNumber} ({getOrderStatusLabel(o.status).label})
              </button>
            ))}
          </div>
        )}

        {/* Body Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 text-stone-900 text-xs sm:text-sm">
          {/* Status Live Progress Tracker */}
          <div className="bg-[var(--brand)]/5 p-5 rounded-2xl border border-[var(--brand)]/20">
            <div className="flex items-center justify-between mb-4">
              <div>
                <span className="text-[11px] uppercase font-black text-amber-700 block">Status da Entrega:</span>
                <h3 className="text-base sm:text-lg font-black text-stone-900">
                  {statusInfo.label}
                </h3>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-black border ${statusInfo.color}`}>
                {currentOrder.status.toUpperCase().replace('_', ' ')}
              </span>
            </div>

            {/* Stepper Bar */}
            <div className={`grid ${steps.length === 5 ? 'grid-cols-5' : 'grid-cols-4'} gap-2 relative mt-4`}>
              {steps.map((step, idx) => {
                const isPassed = statusInfo.step > idx + 1;
                const isCurrent = statusInfo.step === idx + 1;
                const IconComponent = step.icon;

                return (
                  <div key={step.key} className="flex flex-col items-center text-center relative">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center font-bold mb-1.5 transition-all shadow-xs ${
                        isPassed
                          ? 'bg-emerald-600 text-white'
                          : isCurrent
                          ? 'bg-[var(--brand)] text-slate-950 ring-4 ring-[var(--brand-tint)] animate-pulse'
                          : 'bg-stone-200 text-stone-400'
                      }`}
                    >
                      {isPassed ? <Check className="w-5 h-5 stroke-[3]" /> : <IconComponent className="w-5 h-5" />}
                    </div>
                    <span className={`text-[11px] font-bold ${isCurrent ? 'text-amber-700 font-black' : isPassed ? 'text-emerald-700' : 'text-stone-400'}`}>
                      {step.label}
                    </span>
                    <span className="text-[9px] text-stone-400 hidden sm:block mt-0.5">
                      {step.desc}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Dedicated Motoboy / Driver Card for Delivery Orders */}
          {currentOrder.orderType === 'delivery' && driver && (
            <div className="bg-stone-900 text-white p-4 sm:p-5 rounded-2xl border border-stone-800 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-[var(--brand)] text-slate-950 flex items-center justify-center font-black text-lg flex-shrink-0 shadow-md">
                  <Bike className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-black text-sm text-white">{driver.name}</span>
                    <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-[var(--brand)]/20 text-[var(--brand-light)] text-[10px] font-bold">
                      <Star className="w-3 h-3 fill-[var(--brand-light)] text-[var(--brand-light)]" />
                      {driver.rating.toFixed(1)}
                    </span>
                  </div>
                  <p className="text-xs text-stone-300 mt-0.5">
                    {driver.vehicle} • Placa: <strong className="text-[var(--brand-light)]">{driver.plate}</strong>
                  </p>
                  <p className="text-[11px] text-emerald-400 flex items-center gap-1 mt-0.5 font-medium">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Entregador Credenciado Delivery Sabor & Brasa
                  </p>
                </div>
              </div>

              {driver.phone && (
                <a
                  href={`https://wa.me/${driver.phone.replace(/\D/g, '')}?text=Ol%C3%A1%20${encodeURIComponent(driver.name)}%2C%20sobre%20o%20meu%20pedido%20%23${currentOrder.orderNumber}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs flex-shrink-0"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span className="hidden sm:inline">WhatsApp</span>
                </a>
              )}
            </div>
          )}

          {/* Delivery & Contact info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-stone-50 p-4 rounded-2xl border border-stone-200 space-y-1.5">
              <span className="text-[10px] uppercase font-black text-stone-400">Endereço de Entrega</span>
              <p className="font-bold text-stone-900 text-sm">
                {currentOrder.orderType === 'delivery' ? 'Entrega em Domicílio' : 'Retirada no Balcão'}
              </p>
              {currentOrder.customer.address ? (
                <p className="text-xs text-stone-600 flex items-start gap-1 leading-relaxed">
                  <MapPin className="w-3.5 h-3.5 text-[var(--brand-dark)] flex-shrink-0 mt-0.5" />
                  <span>
                    {currentOrder.customer.address.street}, {currentOrder.customer.address.number}
                    {currentOrder.customer.address.unit && ` — ${currentOrder.customer.address.unit}`}
                    {currentOrder.customer.address.complement && ` (${currentOrder.customer.address.complement})`}
                    <br />
                    {currentOrder.customer.address.neighborhood} — {currentOrder.customer.address.city}
                    {currentOrder.customer.address.reference && (
                      <span className="block text-[11px] text-stone-500 mt-0.5">Ref: {currentOrder.customer.address.reference}</span>
                    )}
                  </span>
                </p>
              ) : (
                <p className="text-xs text-stone-600">
                  Retirada: {restaurantConfig.address}
                </p>
              )}
              <p className="text-xs text-stone-500 pt-1 border-t border-stone-200">
                Cliente: <strong>{currentOrder.customer.name}</strong> ({currentOrder.customer.phone || 'S/ Telefone'})
              </p>
            </div>

            <div className="bg-stone-50 p-4 rounded-2xl border border-stone-200 space-y-1.5">
              <span className="text-[10px] uppercase font-black text-stone-400">Previsão & Pagamento</span>
              {(() => {
                const baseMin = currentOrder.estimatedMinutes || 35;
                // Só aplica o ajuste operacional enquanto o pedido ainda está
                // em andamento — um pedido já entregue/cancelado não muda de
                // previsão retroativamente.
                const isOngoing = !['entregue', 'cancelado'].includes(currentOrder.status);
                const adjustedMin = isOngoing ? baseMin + liveOperationalAdjustment : baseMin;
                const wasAdjusted = isOngoing && liveOperationalAdjustment > 0;
                return (
                  <>
                    <p className={`font-bold text-sm flex items-center gap-1.5 ${wasAdjusted ? 'text-amber-700' : 'text-stone-900'}`}>
                      <Clock className="w-4 h-4 text-[var(--brand-dark)]" />
                      <span>
                        {wasAdjusted ? 'Previsão atualizada: ' : 'Previsão: '}
                        {adjustedMin} - {adjustedMin + 15} min
                      </span>
                    </p>
                    {wasAdjusted && (
                      <p className="text-[11px] text-amber-600 font-medium flex items-center gap-1">
                        ⚠️ O restaurante está com o movimento mais alto agora — previsão ajustada em +{liveOperationalAdjustment} min.
                      </p>
                    )}
                  </>
                );
              })()}
              <p className="text-xs text-stone-600">
                Pagamento: <strong className="uppercase">{currentOrder.paymentMethod.replace('_', ' ')}</strong>
                {currentOrder.cardBrand && ` (${currentOrder.cardBrand})`}
              </p>
              {currentOrder.cashChangeFor && (
                <p className="text-xs text-amber-700 font-bold">
                  Troco solicitado para: {formatCurrency(currentOrder.cashChangeFor)}
                </p>
              )}
              {currentOrder.notes && (
                <p className="text-[11px] text-stone-500 italic pt-1 border-t border-stone-200">
                  Obs: {currentOrder.notes}
                </p>
              )}
            </div>
          </div>

          {/* Itemized Order Ticket */}
          <div className="bg-white p-4 rounded-2xl border border-stone-200 space-y-2">
            <h4 className="font-black text-stone-800 text-xs uppercase tracking-wider mb-2">
              Itens da Comanda
            </h4>
            <div className="space-y-2 divide-y divide-stone-100">
              {currentOrder.items.map((item) => (
                <div key={item.id} className="pt-2 first:pt-0 flex justify-between items-start">
                  <div>
                    <span className="font-bold text-stone-900">
                      {item.quantity}x {item.menuItem.name}
                    </span>
                    {item.selectedChoices.length > 0 && (
                      <div className="text-[11px] text-stone-500">
                        {item.selectedChoices.map((c) => c.optionName).join(', ')}
                      </div>
                    )}
                    {item.selectedExtras.length > 0 && (
                      <div className="text-[11px] text-amber-700 font-medium">
                        + {item.selectedExtras.map((e) => `${e.quantity}x ${e.name}`).join(', ')}
                      </div>
                    )}
                    {item.specialNotes && (
                      <div className="text-[10px] text-stone-400 italic">
                        Obs: {item.specialNotes}
                      </div>
                    )}
                  </div>
                  <span className="font-black text-stone-800 text-xs">
                    {formatCurrency(item.totalPrice)}
                  </span>
                </div>
              ))}
            </div>

            {/* Financial totals */}
            <div className="pt-3 border-t border-stone-200 space-y-1 text-xs">
              <div className="flex justify-between text-stone-600">
                <span>Subtotal</span>
                <span>{formatCurrency(currentOrder.subtotal)}</span>
              </div>
              {currentOrder.deliveryFee > 0 ? (
                <div className="flex justify-between text-stone-600">
                  <span>Taxa de Entrega</span>
                  <span>{formatCurrency(currentOrder.deliveryFee)}</span>
                </div>
              ) : (
                <div className="flex justify-between text-emerald-600 font-bold">
                  <span>Taxa de Entrega</span>
                  <span>Grátis</span>
                </div>
              )}
              {currentOrder.discount > 0 && (
                <div className="flex justify-between text-emerald-600 font-semibold">
                  <span>Desconto ({currentOrder.couponCode || 'Cupom'})</span>
                  <span>-{formatCurrency(currentOrder.discount)}</span>
                </div>
              )}
              <div className="flex justify-between items-baseline pt-2 border-t border-stone-100 text-sm font-black">
                <span>Total</span>
                <span className="text-[var(--brand-dark)] text-base">{formatCurrency(currentOrder.total)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer with Support Action */}
        <div className="p-4 sm:p-5 bg-stone-50 border-t border-stone-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className="text-xs text-stone-500 text-center sm:text-left">
            Dúvidas sobre sua entrega? Fale com a central do restaurante.
          </span>
          <a
            href={`https://wa.me/${restaurantConfig.whatsapp.replace(/\D/g, '')}?text=Ol%C3%A1%2C%20gostaria%20de%20informa%C3%A7%C3%B5es%20sobre%20meu%20pedido%20%23${currentOrder.orderNumber}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-xs"
          >
            <Phone className="w-3.5 h-3.5" />
            <span>Falar com o Restaurante</span>
          </a>
        </div>
      </div>
    </div>
  );
};

