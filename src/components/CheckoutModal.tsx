import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { useCustomerAuth } from '../context/CustomerAuthContext';
import { formatPhoneMask } from '../utils/phoneUtils';
import { geocodeAddress, haversineDistanceKm, findMatchingDeliveryZone } from '../utils/geo';
import { OrderType, PaymentMethod, Order } from '../types/restaurant';
import confetti from 'canvas-confetti';
import { buildPixBrCode, cityFromAddress } from '../utils/pix';
import { waLink, orderChannels } from '../utils/contactLinks';
import { QrCodeImage } from './QrCodeImage';
import { isRestaurantAcceptingOrders, PAUSED_ORDERS_MESSAGE } from '../utils/restaurantStatus';
import {
  X,
  CheckCircle2,
  Bike,
  Store,
  UtensilsCrossed,
  QrCode,
  CreditCard,
  Banknote,
  Copy,
  MessageCircle,
  Clock,
  ArrowRight,
  ShieldCheck,
  Loader2,
  AlertTriangle,
} from 'lucide-react';

interface CheckoutModalProps {
  onClose: () => void;
  onOrderSuccess?: (order: Order) => void;
  onOrderPlaced?: (order: Order) => void;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  onClose,
  onOrderSuccess,
  onOrderPlaced,
}) => {
  const {
    cart,
    restaurants,
    activeRestaurantSlug,
    orderType,
    setOrderType,
    selectedTable,
    setSelectedTable,
    appliedCoupon,
    createOrder,
    appMode,
  } = useStore();

  const { customer, isAuthenticated } = useCustomerAuth();
  const currentRestaurant = restaurants[activeRestaurantSlug] || restaurants.japones;

  const [customerName, setCustomerName] = useState(customer?.name || '');
  const [customerPhone, setCustomerPhone] = useState(customer?.phone || '');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pix');
  const [notes, setNotes] = useState('');

  // Delivery Address state
  const defaultAddr = customer?.savedAddresses?.find((a) => a.isDefault) || customer?.savedAddresses?.[0];
  // V8 PRO PLUS: CEP no checkout, com autopreenchimento (ViaCEP) — antes só
  // existia na tela de "Meus Endereços" da conta, faltava aqui no fluxo
  // mais usado (pedido avulso na hora).
  const [cep, setCep] = useState(defaultAddr?.cep || '');
  const [cepLoading, setCepLoading] = useState(false);
  const [cepError, setCepError] = useState<string | null>(null);
  const [street, setStreet] = useState(defaultAddr?.street || '');
  const [number, setNumber] = useState(defaultAddr?.number || '');
  const [neighborhood, setNeighborhood] = useState(defaultAddr?.neighborhood || '');
  const [city, setCity] = useState(defaultAddr?.city || 'São Paulo');
  const [stateUf, setStateUf] = useState(defaultAddr?.state || '');
  const [complement, setComplement] = useState(defaultAddr?.complement || '');

  // V8 PRO PLUS: entrega por distância (KM) — quando o restaurante tem
  // coordenadas + faixas configuradas (Admin → Áreas de Entrega), calcula a
  // distância real até o CEP do cliente e usa a taxa da faixa
  // correspondente; senão, cai de volta para a taxa fixa do restaurante.
  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [isCalculatingDistance, setIsCalculatingDistance] = useState(false);

  const lookupCep = async (rawCep: string) => {
    const digits = rawCep.replace(/\D/g, '');
    if (digits.length !== 8) return;
    setCepLoading(true);
    setCepError(null);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await res.json();
      if (data.erro) {
        setCepError('CEP não encontrado. Preencha o endereço manualmente.');
      } else {
        setStreet(data.logradouro || '');
        setNeighborhood(data.bairro || '');
        setCity(data.localidade || '');
        setStateUf(data.uf || '');
      }
    } catch {
      setCepError('Não foi possível buscar o CEP agora. Preencha manualmente.');
    } finally {
      setCepLoading(false);
    }
  };

  // Recalcula a distância/taxa sempre que o endereço de entrega muda
  useEffect(() => {
    if (orderType !== 'delivery') return;
    if (!currentRestaurant.latitude || !currentRestaurant.longitude) return;
    if (!currentRestaurant.deliveryZones || currentRestaurant.deliveryZones.length === 0) return;
    if (!street.trim() || !number.trim() || !city.trim()) {
      setDistanceKm(null);
      return;
    }
    const query = `${street}, ${number}, ${neighborhood}, ${city}, ${stateUf}, ${cep}, Brasil`;
    let cancelled = false;
    setIsCalculatingDistance(true);
    geocodeAddress(query).then((coords) => {
      if (cancelled) return;
      if (coords && currentRestaurant.latitude != null && currentRestaurant.longitude != null) {
        const km = haversineDistanceKm(coords, { lat: currentRestaurant.latitude, lng: currentRestaurant.longitude });
        setDistanceKm(km);
      } else {
        setDistanceKm(null);
      }
      setIsCalculatingDistance(false);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderType, street, number, neighborhood, city, stateUf, cep]);

  const matchedZone =
    distanceKm !== null ? findMatchingDeliveryZone(distanceKm, currentRestaurant.deliveryZones) : null;

  useEffect(() => {
    if (customer) {
      if (!customerName) setCustomerName(customer.name);
      if (!customerPhone) setCustomerPhone(customer.phone);
      if (defaultAddr && !street) {
        setStreet(defaultAddr.street);
        setNumber(defaultAddr.number);
        setNeighborhood(defaultAddr.neighborhood);
        setCity(defaultAddr.city || 'São Paulo');
        if (defaultAddr.complement) setComplement(defaultAddr.complement);
      }
    }
  }, [customer]);

  // Table state
  const [tableInput, setTableInput] = useState<number>(selectedTable || 1);

  // Payment details state
  const [needsCashChange, setNeedsCashChange] = useState(false);
  const [cashChangeFor, setCashChangeFor] = useState<string>('');
  const [cardType, setCardType] = useState<'credito' | 'debito'>('credito');

  // Completed order state
  const [createdOrder, setCreatedOrder] = useState<Order | null>(null);
  const [copiedPix, setCopiedPix] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Idempotency key preserved across retries for the same checkout form attempt
  const idempotencyKeyRef = useRef<string>(
    `order-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
  );

  // Financial calculations
  const subtotal = cart.reduce((sum, item) => sum + item.subtotal, 0);
  let discount = 0;
  if (appliedCoupon) {
    if (appliedCoupon.type === 'percent') {
      discount = (subtotal * appliedCoupon.value) / 100;
    } else {
      discount = appliedCoupon.value;
    }
  }
  discount = Math.min(discount, subtotal);

  // V8 PRO PLUS: usa a taxa da faixa de KM encontrada quando o restaurante
  // tem entrega por distância configurada; senão, taxa fixa (comportamento
  // de sempre, sem quebrar quem não configurou zonas).
  const deliveryFee = orderType === 'delivery' ? (matchedZone?.fee ?? currentRestaurant.deliveryFee) : 0;
  const total = Math.max(0, subtotal - discount + deliveryFee);

  // V9.3: PIX "copia e cola" VÁLIDO (BR Code com CRC16). Sem chave cadastrada → string vazia
  // (a tela avisa que o PIX ainda não está disponível em vez de mostrar um código que o banco recusa).
  const pixCodeFor = (amount: number): string => {
    if (!currentRestaurant.pixKey?.trim()) return '';
    try {
      return buildPixBrCode({
        key: currentRestaurant.pixKey,
        name: currentRestaurant.pixReceiverName || currentRestaurant.name,
        city: cityFromAddress(currentRestaurant.address),
        amount,
      });
    } catch {
      return '';
    }
  };
  const simulatedPixCode = pixCodeFor(total);

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();

    // V9 PLUS ULTRA 01: restaurante pausado não recebe novos pedidos (o servidor também recusa).
    if (appMode !== 'staff' && !isRestaurantAcceptingOrders(currentRestaurant)) {
      alert(PAUSED_ORDERS_MESSAGE);
      return;
    }

    if (!customerName.trim() || !customerPhone.trim()) {
      alert('Por favor informe seu nome e telefone/WhatsApp.');
      return;
    }

    if (orderType === 'delivery' && (!street.trim() || !number.trim() || !neighborhood.trim())) {
      alert('Por favor preencha os dados do endereço de entrega (Rua, Número e Bairro).');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    const orderData = {
      customerId: customer?.id,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      orderType,
      tableNumber: orderType === 'mesa' ? tableInput : undefined,
      deliveryAddress:
        orderType === 'delivery'
          ? {
              street: street.trim(),
              number: number.trim(),
              neighborhood: neighborhood.trim(),
              city: city.trim(),
              state: stateUf.trim() || undefined,
              cep: cep.trim() || undefined,
              complement: complement.trim() || undefined,
              distanceKm: distanceKm !== null ? Number(distanceKm.toFixed(2)) : undefined,
            }
          : undefined,
      paymentMethod,
      paymentDetails: {
        paid: paymentMethod === 'pix',
        pixCode: paymentMethod === 'pix' ? simulatedPixCode : undefined,
        cashChangeFor:
          paymentMethod === 'dinheiro' && needsCashChange ? parseFloat(cashChangeFor) || undefined : undefined,
        cardBrand:
          paymentMethod === 'cartao_credito'
            ? 'Cartão de Crédito'
            : paymentMethod === 'cartao_debito'
            ? 'Cartão de Débito'
            : undefined,
      },
      notes: notes.trim() || undefined,
    };

    try {
      const newOrder = await createOrder(orderData, idempotencyKeyRef.current);
      setCreatedOrder(newOrder);
      if (onOrderPlaced) onOrderPlaced(newOrder);
      if (onOrderSuccess) onOrderSuccess(newOrder);

      // Fire Confetti
      try {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#f59e0b', '#f43f5e', '#10b981', '#3b82f6'],
        });
      } catch {
        // safe fallback
      }
    } catch (err: any) {
      console.error('[CHECKOUT FAILED]:', err);
      setSubmitError(
        err.message ||
          'Não foi possível registrar o pedido no restaurante. Verifique sua conexão e tente novamente.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyPixCode = () => {
    if (createdOrder?.paymentDetails?.pixCode || simulatedPixCode) {
      navigator.clipboard.writeText(createdOrder?.paymentDetails?.pixCode || simulatedPixCode);
      setCopiedPix(true);
      setTimeout(() => setCopiedPix(false), 3000);
    }
  };

  // WhatsApp formatted string generator
  const getOrderMessage = (): string => {
    if (!createdOrder) return '';

    const itemsText = createdOrder.items
      .map(
        (i) =>
          `• *${i.quantity}x* ${i.name} - R$ ${i.totalPrice.toFixed(2)}${
            i.notes ? ` _(Obs: ${i.notes})_` : ''
          }`
      )
      .join('\n');

    let addressText = '';
    if (createdOrder.orderType === 'delivery' && createdOrder.deliveryAddress) {
      const a = createdOrder.deliveryAddress;
      addressText = `📍 *Endereço:* ${a.street}, nº ${a.number}${
        a.complement ? ` (${a.complement})` : ''
      } - ${a.neighborhood}, ${a.city}`;
    } else if (createdOrder.orderType === 'mesa') {
      addressText = `🍽️ *Consumo no Local - Mesa:* ${createdOrder.tableNumber}`;
    } else {
      addressText = `🛍️ *Retirada no Balcão*`;
    }

    const paymentText =
      createdOrder.paymentMethod === 'pix'
        ? 'PIX (Chave enviada)'
        : createdOrder.paymentMethod === 'cartao_credito'
        ? 'Cartão de Crédito na Entrega'
        : createdOrder.paymentMethod === 'cartao_debito'
        ? 'Cartão de Débito na Entrega'
        : `Dinheiro ${
            createdOrder.paymentDetails?.cashChangeFor
              ? `(Troco para R$ ${createdOrder.paymentDetails.cashChangeFor.toFixed(2)})`
              : '(Valor exato)'
          }`;

    const message = `🍱 *NOVO PEDIDO - ${createdOrder.restaurantName.toUpperCase()}*\n` +
      `Código: *${createdOrder.shortCode}*\n\n` +
      `👤 *Cliente:* ${createdOrder.customerName}\n` +
      `📱 *WhatsApp:* ${createdOrder.customerPhone}\n` +
      `${addressText}\n\n` +
      `📝 *ITENS DO PEDIDO:*\n${itemsText}\n\n` +
      `💵 *Subtotal:* R$ ${createdOrder.subtotal.toFixed(2)}\n` +
      (createdOrder.discount > 0 ? `🏷️ *Desconto:* -R$ ${createdOrder.discount.toFixed(2)}\n` : '') +
      `🛵 *Entrega:* R$ ${createdOrder.deliveryFee.toFixed(2)}\n` +
      `⭐ *TOTAL:* R$ ${createdOrder.total.toFixed(2)}\n` +
      `💳 *Forma de Pagamento:* ${paymentText}\n` +
      (createdOrder.notes ? `\n💬 *Observações:* ${createdOrder.notes}` : '');

    return message;
  };
  const getWhatsAppShareUrl = (): string | null => waLink(currentRestaurant.whatsapp, getOrderMessage());

  // Instagram/Facebook não aceitam texto pré-preenchido: copia o pedido e abre a conversa.
  const openSocialChannel = async (url: string) => {
    try {
      await navigator.clipboard.writeText(getOrderMessage().replace(/\*/g, ''));
      alert('Pedido copiado! Cole a mensagem na conversa que vai abrir.');
    } catch {
      /* sem permissão de área de transferência: abre mesmo assim */
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="modal-viewport fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-xl w-full max-h-[92vh] overflow-hidden shadow-2xl my-auto animate-in fade-in duration-200 flex flex-col">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">{currentRestaurant.emoji}</span>
            <div>
              <h2 className="text-base font-bold text-white">
                {createdOrder ? 'Pedido Confirmado com Sucesso!' : 'Finalizar Pedido'}
              </h2>
              <p className="text-[11px] text-slate-400">
                {currentRestaurant.name} • {orderType.toUpperCase()}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* BODY */}
        {/* V7: agora flex-1 + min-h-0 em vez de max-h fixo, dentro de um
            modal com altura própria (flex-col) — o botão "Confirmar e
            Enviar Pedido" fica sempre visível num rodapé fixo abaixo,
            fora da área que rola. */}
        <form onSubmit={handleSubmitOrder} className="flex-1 min-h-0 flex flex-col">
        <div className="p-5 sm:p-6 flex-1 min-h-0 overflow-y-auto">
          {createdOrder ? (
            /* SUCCESS VIEW */
            <div className="text-center space-y-6 py-2">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto text-3xl animate-bounce">
                🎉
              </div>

              <div>
                <span className="text-xs font-bold uppercase tracking-widest text-amber-400 block mb-1">
                  Pedido Recebido pela Cozinha
                </span>
                <h3 className="text-2xl font-black text-white">{createdOrder.shortCode}</h3>
                <p className="text-xs text-slate-300 mt-2 max-w-md mx-auto">
                  Parabéns, {createdOrder.customerName}! Seu pedido foi enviado para a cozinha do{' '}
                  <strong className="text-white">{createdOrder.restaurantName}</strong> e já começou a ser processado.
                </p>
              </div>

              {/* PIX QR CODE BOX (IF PIX) */}
              {createdOrder.paymentMethod === 'pix' && (
                <div className="bg-slate-950 border border-amber-500/30 rounded-2xl p-4 text-left space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <QrCode className="w-5 h-5 text-amber-400" />
                      <span className="text-xs font-bold text-white uppercase tracking-wider">
                        Pagamento via PIX Instantâneo
                      </span>
                    </div>
                    <span className="text-xs font-black text-amber-400">
                      R$ {createdOrder.total.toFixed(2)}
                    </span>
                  </div>

                  {/* QR Code PIX real (BR Code) */}
                  {(createdOrder.paymentDetails?.pixCode || pixCodeFor(createdOrder.total)) ? (
                    <div className="flex flex-col sm:flex-row items-center gap-4 bg-white p-3.5 rounded-xl">
                      <QrCodeImage
                        url={createdOrder.paymentDetails?.pixCode || pixCodeFor(createdOrder.total)}
                        size={150}
                        alt="QR Code PIX"
                      />
                      <div className="text-slate-900 text-xs space-y-1">
                        <p className="font-extrabold text-sm">Escaneie com seu banco</p>
                        {currentRestaurant.pixReceiverName && (
                          <p className="text-[11px] text-slate-700">
                            Favorecido: <strong>{currentRestaurant.pixReceiverName}</strong>
                          </p>
                        )}
                        <p className="text-[11px] text-slate-700">
                          Valor: <strong>R$ {createdOrder.total.toFixed(2)}</strong>
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs">
                      O restaurante ainda não cadastrou a chave PIX. Combine o pagamento pelo WhatsApp ou pague na entrega/retirada.
                    </div>
                  )}

                  {/* Copy Code */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={createdOrder.paymentDetails?.pixCode || pixCodeFor(createdOrder.total)}
                      className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-[10px] text-slate-300 font-mono select-all truncate"
                    />
                    <button
                      onClick={copyPixCode}
                      className="px-3 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors shrink-0"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>{copiedPix ? 'Copiado!' : 'Copiar PIX'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-2.5 pt-2">
                {getWhatsAppShareUrl() && (
                  <a
                    href={getWhatsAppShareUrl() || undefined}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>Enviar Comprovante / Notificar no WhatsApp</span>
                  </a>
                )}
                {orderChannels(currentRestaurant, getOrderMessage())
                  .filter((c) => c.id !== 'whatsapp')
                  .map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => openSocialChannel(c.url)}
                      className="w-full py-3 px-4 bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-2"
                    >
                      <span>{c.id === 'instagram' ? 'Enviar pedido pelo Instagram' : 'Enviar pedido pelo Messenger (Facebook)'}</span>
                    </button>
                  ))}

                <button
                  onClick={() => {
                    onOrderSuccess(createdOrder);
                  }}
                  className="w-full py-3 px-4 bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-2 border border-slate-700 transition-colors"
                >
                  <Clock className="w-4 h-4 text-amber-400" />
                  <span>Acompanhar Status em Tempo Real</span>
                </button>
              </div>
            </div>
          ) : (
            /* CHECKOUT FORM VIEW */
            <div className="space-y-5">
              {/* Modality Pill Summary */}
              <div className="flex items-center justify-between p-3 bg-slate-950/60 rounded-2xl border border-slate-800">
                <div className="flex items-center gap-2 text-xs">
                  {orderType === 'delivery' && <Bike className="w-4 h-4 text-amber-400" />}
                  {orderType === 'retirada' && <Store className="w-4 h-4 text-emerald-400" />}
                  {orderType === 'mesa' && <UtensilsCrossed className="w-4 h-4 text-amber-400" />}
                  <span className="font-bold text-white capitalize">
                    {orderType === 'delivery'
                      ? 'Entrega no Endereço'
                      : orderType === 'retirada'
                      ? 'Retirada no Balcão'
                      : `Consumo no Local (Mesa ${tableInput})`}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (orderType === 'delivery') setOrderType('retirada');
                    else if (orderType === 'retirada') setOrderType('mesa');
                    else setOrderType('delivery');
                  }}
                  className="text-xs text-amber-400 hover:underline"
                >
                  Alterar modo
                </button>
              </div>

              {/* Customer Contact */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  1. Seus Dados de Contato
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      Seu Nome Completo *
                    </label>
                    <input
                      type="text"
                      required
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Ex: Carlos Eduardo"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      WhatsApp com DDD *
                    </label>
                    <input
                      type="tel"
                      required
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="(11) 98765-4321"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
              </div>

              {/* Delivery Address or Table selector */}
              {orderType === 'delivery' && (
                <div className="space-y-3 pt-2 border-t border-slate-800">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    2. Endereço de Entrega
                  </h3>

                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">CEP *</label>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        inputMode="numeric"
                        maxLength={9}
                        value={cep}
                        onChange={(e) => {
                          const v = e.target.value.replace(/\D/g, '').slice(0, 8);
                          const masked = v.length > 5 ? `${v.slice(0, 5)}-${v.slice(5)}` : v;
                          setCep(masked);
                          if (v.length === 8) lookupCep(v);
                        }}
                        placeholder="00000-000"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                      />
                      {cepLoading && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-amber-400">buscando…</span>
                      )}
                    </div>
                    {cepError && <p className="text-[10px] text-amber-400 mt-1">{cepError}</p>}
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2">
                      <label className="block text-[11px] text-slate-400 mb-1">Rua / Avenida *</label>
                      <input
                        type="text"
                        required
                        value={street}
                        onChange={(e) => setStreet(e.target.value)}
                        placeholder="Ex: Rua Oscar Freire"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">Número *</label>
                      <input
                        type="text"
                        required
                        value={number}
                        onChange={(e) => setNumber(e.target.value)}
                        placeholder="142"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">Bairro *</label>
                      <input
                        type="text"
                        required
                        value={neighborhood}
                        onChange={(e) => setNeighborhood(e.target.value)}
                        placeholder="Ex: Pinheiros"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">
                        Complemento (Apto, Bloco)
                      </label>
                      <input
                        type="text"
                        value={complement}
                        onChange={(e) => setComplement(e.target.value)}
                        placeholder="Apto 42, Bloco B"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>

                  {/* V8 PRO PLUS: indicador de distância / taxa por KM */}
                  {isCalculatingDistance && (
                    <p className="text-[11px] text-slate-400">Calculando distância de entrega…</p>
                  )}
                  {!isCalculatingDistance && matchedZone && distanceKm !== null && (
                    <div className="p-2.5 rounded-xl bg-cyan-950/30 border border-cyan-500/30 text-[11px] text-cyan-300 flex items-center justify-between">
                      <span>📍 {distanceKm.toFixed(1)} km • {matchedZone.name}</span>
                      <span className="font-bold">R$ {matchedZone.fee.toFixed(2)}</span>
                    </div>
                  )}
                  {!isCalculatingDistance &&
                    distanceKm !== null &&
                    !matchedZone &&
                    currentRestaurant.deliveryZones &&
                    currentRestaurant.deliveryZones.length > 0 && (
                      <p className="text-[11px] text-amber-400">
                        Endereço fora das faixas de entrega ({distanceKm.toFixed(1)} km) — taxa padrão aplicada.
                      </p>
                    )}
                </div>
              )}

              {orderType === 'mesa' && (
                <div className="space-y-3 pt-2 border-t border-slate-800">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    2. Sua Mesa no Salão
                  </h3>
                  <div className="flex items-center gap-3">
                    <label className="text-xs text-slate-400">Número da Mesa:</label>
                    <select
                      value={tableInput}
                      onChange={(e) => {
                        const num = Number(e.target.value);
                        setTableInput(num);
                        setSelectedTable(num);
                      }}
                      className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-xs text-white font-bold focus:border-amber-500"
                    >
                      {currentRestaurant.activeTables.map((t) => (
                        <option key={t} value={t}>
                          Mesa {t}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Payment Methods */}
              <div className="space-y-3 pt-2 border-t border-slate-800">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  3. Forma de Pagamento
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {/* PIX */}
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('pix')}
                    className={`p-3 rounded-2xl border text-left flex flex-col justify-between transition-all ${
                      paymentMethod === 'pix'
                        ? 'bg-amber-500/15 border-amber-500 text-white shadow-md'
                        : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <QrCode className="w-5 h-5 text-amber-400" />
                      <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded font-bold">
                        Mais rápido
                      </span>
                    </div>
                    <div>
                      <span className="font-bold text-xs block">PIX Instantâneo</span>
                      <span className="text-[10px] text-slate-400">QR Code automático</span>
                    </div>
                  </button>

                  {/* Cartão */}
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('cartao_credito')}
                    className={`p-3 rounded-2xl border text-left flex flex-col justify-between transition-all ${
                      paymentMethod === 'cartao_credito' || paymentMethod === 'cartao_debito'
                        ? 'bg-amber-500/15 border-amber-500 text-white shadow-md'
                        : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <CreditCard className="w-5 h-5 text-sky-400" />
                      <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded font-bold">
                        Na entrega
                      </span>
                    </div>
                    <div>
                      <span className="font-bold text-xs block">Cartão</span>
                      <span className="text-[10px] text-slate-400">Crédito ou Débito</span>
                    </div>
                  </button>

                  {/* Dinheiro */}
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('dinheiro')}
                    className={`p-3 rounded-2xl border text-left flex flex-col justify-between transition-all ${
                      paymentMethod === 'dinheiro'
                        ? 'bg-amber-500/15 border-amber-500 text-white shadow-md'
                        : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <Banknote className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                      <span className="font-bold text-xs block">Dinheiro</span>
                      <span className="text-[10px] text-slate-400">Com ou sem troco</span>
                    </div>
                  </button>
                </div>

                {/* Sub-options for Payment */}
                {(paymentMethod === 'cartao_credito' || paymentMethod === 'cartao_debito') && (
                  <div className="flex gap-2 p-2 bg-slate-950 rounded-xl border border-slate-800">
                    <button
                      type="button"
                      onClick={() => {
                        setCardType('credito');
                        setPaymentMethod('cartao_credito');
                      }}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-semibold ${
                        cardType === 'credito'
                          ? 'bg-amber-500 text-slate-950 font-bold'
                          : 'text-slate-400'
                      }`}
                    >
                      Crédito (Visa, Master, Elo, Hiper)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCardType('debito');
                        setPaymentMethod('cartao_debito');
                      }}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-semibold ${
                        cardType === 'debito'
                          ? 'bg-amber-500 text-slate-950 font-bold'
                          : 'text-slate-400'
                      }`}
                    >
                      Débito (Visa, Master, Elo)
                    </button>
                  </div>
                )}

                {paymentMethod === 'dinheiro' && (
                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                    <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={needsCashChange}
                        onChange={(e) => setNeedsCashChange(e.target.checked)}
                        className="rounded accent-amber-500"
                      />
                      <span>Preciso de troco para outra nota</span>
                    </label>

                    {needsCashChange && (
                      <div className="flex items-center gap-2 pt-1">
                        <span className="text-xs text-slate-400">Troco para: R$</span>
                        <input
                          type="number"
                          value={cashChangeFor}
                          onChange={(e) => setCashChangeFor(e.target.value)}
                          placeholder="Ex: 100,00"
                          className="w-28 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-white"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* General Order Notes */}
              <div className="pt-2 border-t border-slate-800">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
                  Observações Gerais do Pedido
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ex: Deixar na portaria, campainha não funciona..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

            </div>
          )}
        </div>

        {/* V7: rodapé fixo (fora do scroll) — total e botão "Confirmar e
            Enviar Pedido" ficam sempre visíveis, mesmo com a lista de
            itens/formulário rolando por cima. */}
        {!createdOrder && (
          <div className="shrink-0 border-t border-slate-800 bg-slate-900 p-4 sm:p-5 space-y-3">
            {/* Order Final Summary */}
            <div className="p-3.5 bg-slate-950 rounded-2xl border border-slate-800 space-y-1.5 text-xs text-slate-300">
              <div className="flex justify-between">
                <span>Itens ({cart.reduce((a, b) => a + b.quantity, 0)}):</span>
                <span>R$ {subtotal.toFixed(2)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-emerald-400">
                  <span>Desconto ({appliedCoupon?.code}):</span>
                  <span>- R$ {discount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Taxa de Entrega:</span>
                <span>R$ {deliveryFee.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm font-black text-white pt-2 border-t border-slate-800">
                <span>Total Final:</span>
                <span className="text-amber-400 text-base">R$ {total.toFixed(2)}</span>
              </div>
            </div>

            {/* Error Banner */}
            {submitError && (
              <div className="p-3 bg-red-950/60 border border-red-500/40 rounded-2xl flex items-start gap-2.5 text-xs text-red-200">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold text-red-300">Falha ao confirmar pedido</p>
                  <p className="text-[11px] text-red-200/90 mt-0.5">{submitError}</p>
                </div>
              </div>
            )}

            {/* Submit CTA */}
            <button
              type="submit"
              disabled={isSubmitting}
              className={`w-full py-4 px-4 font-black text-sm rounded-2xl shadow-xl transition-all flex items-center justify-center gap-2 active:scale-[0.98] ${
                isSubmitting
                  ? 'bg-amber-600/60 text-slate-900 cursor-wait'
                  : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 hover:shadow-amber-500/20'
              }`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                  <span>Confirmando e Gravando Pedido...</span>
                </>
              ) : (
                <>
                  <span>Confirmar e Enviar Pedido</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        )}
        </form>
      </div>
    </div>
  );
};
