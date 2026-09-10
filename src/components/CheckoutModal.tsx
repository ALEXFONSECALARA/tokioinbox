import React, { useState, useEffect } from 'react';
import { 
  CartItem, 
  Order, 
  OrderType, 
  PaymentMethod, 
  RestaurantConfig,
  DeliveryAddress 
} from '../types';
import { 
  formatCurrency, 
  generateWhatsAppOrderUrl, 
  playSoundEffect,
  calculateDeliveryFee
} from '../utils/helpers';
import confetti from 'canvas-confetti';
import { 
  X, 
  Bike, 
  ShoppingBag, 
  CreditCard, 
  Banknote, 
  Send, 
  CheckCircle2, 
  Copy, 
  Check, 
  AlertCircle,
  Clock,
  Sparkles,
  MapPin,
  Utensils
} from 'lucide-react';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  appliedCoupon: string | null;
  discountAmount: number;
  restaurantConfig: RestaurantConfig;
  currentAddress?: DeliveryAddress | null;
  onOrderPlaced: (order: Order, openWhatsApp: boolean) => void;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  isOpen,
  onClose,
  items,
  appliedCoupon,
  discountAmount,
  restaurantConfig,
  currentAddress,
  onOrderPlaced,
}) => {
  const [orderType, setOrderType] = useState<OrderType>('delivery');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  
  // Delivery address fields
  const [cep, setCep] = useState(currentAddress?.cep || '');
  const [street, setStreet] = useState(currentAddress?.street || '');
  const [number, setNumber] = useState(currentAddress?.number || '');
  const [neighborhood, setNeighborhood] = useState(currentAddress?.neighborhood || restaurantConfig.deliveryZones[0]?.name || 'Bela Vista');
  const [city, setCity] = useState(currentAddress?.city || 'São Paulo - SP');
  // Apto/Bloco separado do Complemento livre (Fase 4, item 7) — antes só
  // existia um campo "Complemento (Apto/Bloco)" misturando os dois conceitos.
  const [unit, setUnit] = useState(currentAddress?.unit || '');
  const [complement, setComplement] = useState(currentAddress?.complement || '');
  const [reference, setReference] = useState(currentAddress?.reference || '');
  // Latitude/longitude do endereço (Fase 4, item 8) — obtidas por geocodificação
  // best-effort depois do CEP resolver a rua/bairro; nunca bloqueiam o pedido
  // se a busca falhar (ficam undefined e seguem assim).
  const [lat, setLat] = useState<number | undefined>(currentAddress?.lat);
  const [lng, setLng] = useState<number | undefined>(currentAddress?.lng);
  
  // Payment
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pix');
  const [cardBrand, setCardBrand] = useState('Mastercard / Visa');
  const [needCashChange, setNeedCashChange] = useState(false);
  const [cashChangeFor, setCashChangeFor] = useState('');
  const [copiedPix, setCopiedPix] = useState(false);
  
  // General notes
  const [generalNotes, setGeneralNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // Item pedido: CEP no próprio checkout, preenchendo rua/bairro/cidade
  // automaticamente (mesmo padrão do DeliveryAddressModal, via ViaCEP)
  const [isLoadingCep, setIsLoadingCep] = useState(false);
  const [cepError, setCepError] = useState<string | null>(null);
  // Item pedido: todos os campos obrigatórios com aviso visual — só passa a
  // mostrar borda/mensagem vermelha depois da primeira tentativa de enviar
  const [triedSubmit, setTriedSubmit] = useState(false);

  // Sync address prop
  useEffect(() => {
    if (currentAddress) {
      setCep(currentAddress.cep || '');
      setStreet(currentAddress.street || '');
      setNumber(currentAddress.number || '');
      setNeighborhood(currentAddress.neighborhood || restaurantConfig.deliveryZones[0]?.name || 'Bela Vista');
      setCity(currentAddress.city || 'São Paulo - SP');
      setUnit(currentAddress.unit || '');
      setComplement(currentAddress.complement || '');
      setReference(currentAddress.reference || '');
      setLat(currentAddress.lat);
      setLng(currentAddress.lng);
    }
  }, [currentAddress, isOpen]);

  if (!isOpen) return null;

  const subtotal = items.reduce((acc, item) => acc + item.totalPrice, 0);
  const isFreeDelivery = (restaurantConfig.freeDeliveryEnabled ?? true) && subtotal >= (restaurantConfig.freeDeliveryThreshold || 80);

  // Motor de cálculo de entrega (Fase 4, itens 9-13) — decide taxa/tempo
  // conforme o método que o restaurante escolheu (bairro/CEP/distância/
  // fórmula/híbrido). Sem fee resolvido e sem estar fora da área (endereço
  // incompleto pro método, ou restaurante nunca configurou nada além de
  // bairro), cai pro valor padrão fixo de sempre — exatamente o
  // comportamento anterior a esta mudança, preservado de propósito.
  const deliveryCalc = calculateDeliveryFee(restaurantConfig, { neighborhood, cep, lat, lng });
  const isOutOfDeliveryRange = orderType === 'delivery' && deliveryCalc.outOfRange;
  const baseDeliveryFee = deliveryCalc.fee ?? restaurantConfig.deliveryFee;
  const deliveryFee = orderType === 'delivery' ? (isFreeDelivery ? 0 : baseDeliveryFee) : 0;
  const total = Math.max(0, subtotal - discountAmount + deliveryFee);

  const handleCopyPix = () => {
    navigator.clipboard.writeText(restaurantConfig.pixKey);
    setCopiedPix(true);
    playSoundEffect('beep');
    setTimeout(() => setCopiedPix(false), 2500);
  };

  // Busca lat/long best-effort via Nominatim (OpenStreetMap, gratuito e sem
  // chave) a partir do endereço já resolvido pelo CEP. Silencioso de
  // propósito: nunca mostra erro pro cliente, nunca bloqueia o checkout —
  // é só um dado extra pra cálculo de entrega por distância no futuro.
  const geocodeAddress = async (street_: string, neighborhood_: string, city_: string, state_: string, cep_: string) => {
    try {
      const query = encodeURIComponent(`${street_ || ''}, ${neighborhood_ || ''}, ${city_ || ''}, ${state_ || ''}, Brasil`);
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=${query}`);
      const results = await res.json();
      if (Array.isArray(results) && results[0]) {
        setLat(parseFloat(results[0].lat));
        setLng(parseFloat(results[0].lon));
      }
    } catch {
      // Best-effort — se a geocodificação falhar (rede, rate limit etc.),
      // simplesmente não temos lat/lng pra esse endereço. Sem problema.
    }
  };

  // Busca o endereço pelo CEP (ViaCEP) e preenche rua, bairro e cidade
  // automaticamente. Se o bairro devolvido bater com um dos atendidos pelo
  // restaurante, já seleciona ele pra calcular a taxa certa.
  const handleCepLookup = async (cepValue: string) => {
    const cleanCep = cepValue.replace(/\D/g, '');
    if (cleanCep.length !== 8) {
      setCepError('O CEP deve conter 8 dígitos.');
      return;
    }
    setIsLoadingCep(true);
    setCepError(null);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data = await response.json();
      if (data.erro) {
        setCepError('CEP não encontrado. Preencha o endereço manualmente.');
      } else {
        setStreet(data.logradouro || street);
        setCity(`${data.localidade || 'São Paulo'} - ${data.uf || 'SP'}`);
        const foundZone = restaurantConfig.deliveryZones.find(
          (z) => data.bairro && (z.name.toLowerCase().includes(data.bairro.toLowerCase()) || data.bairro.toLowerCase().includes(z.name.toLowerCase()))
        );
        setNeighborhood(foundZone ? foundZone.name : data.bairro || neighborhood);
        if (data.complemento && !complement) {
          setComplement(data.complemento);
        }
        playSoundEffect('beep');
        // Geocodificação best-effort (Nominatim/OpenStreetMap) pra obter
        // lat/long a partir do endereço que o CEP acabou de resolver — usado
        // futuramente pro cálculo de entrega por distância. Silenciosa: se
        // falhar ou não achar nada, o pedido segue normalmente sem lat/lng.
        geocodeAddress(data.logradouro, data.bairro, data.localidade, data.uf, cleanCep);
      }
    } catch {
      setCepError('Erro ao consultar CEP. Preencha o endereço manualmente.');
    } finally {
      setIsLoadingCep(false);
    }
  };

  // Item pedido: todos os campos obrigatórios (delivery) com aviso — usado
  // tanto pra bloquear o envio quanto pra pintar a borda vermelha no campo
  const fieldErrors: Record<string, string> = {};
  if (!name.trim()) fieldErrors.name = 'Informe seu nome';
  if (!phone.trim()) fieldErrors.phone = 'Informe seu telefone';
  if (orderType === 'delivery') {
    if (!cep.trim()) fieldErrors.cep = 'Informe o CEP';
    if (!street.trim()) fieldErrors.street = 'Informe a rua';
    if (!number.trim()) fieldErrors.number = 'Informe o número';
    if (!neighborhood.trim()) fieldErrors.neighborhood = 'Selecione o bairro';
    if (!reference.trim()) fieldErrors.reference = 'Informe um ponto de referência';
  }
  const fieldClass = (field: string) =>
    `w-full px-3 py-2.5 bg-white border rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand)] ${
      triedSubmit && fieldErrors[field] ? 'border-rose-400 ring-1 ring-rose-200' : 'border-stone-200'
    }`;

  const handleCompleteOrder = (openWhatsApp: boolean) => {
    setErrorMsg(null);
    setTriedSubmit(true);

    // Validation — todos os campos obrigatórios listados em fieldErrors
    const firstErrorField = Object.keys(fieldErrors)[0];
    if (firstErrorField) {
      setErrorMsg(`Por favor, preencha todos os campos obrigatórios (${fieldErrors[firstErrorField]}).`);
      // Rola até o primeiro campo com problema pra facilitar corrigir no celular
      document.getElementById(`checkout-${firstErrorField}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    // Item 12: endereço fora do raio máximo de entrega configurado é
    // recusado aqui — nunca aceito silenciosamente com a taxa padrão.
    if (isOutOfDeliveryRange) {
      setErrorMsg('Este endereço está fora da nossa área de entrega no momento.');
      return;
    }

    if (paymentMethod === 'cash' && needCashChange) {
      const changeNum = parseFloat(cashChangeFor.replace(',', '.'));
      if (isNaN(changeNum) || changeNum < total) {
        setErrorMsg(`O valor para troco deve ser maior que o total do pedido (${formatCurrency(total)}).`);
        return;
      }
    }

    // Assign a default available driver for delivery
    const assignedDriver = orderType === 'delivery' && restaurantConfig.drivers.length > 0 
      ? restaurantConfig.drivers[Math.floor(Math.random() * restaurantConfig.drivers.length)]
      : undefined;

    // Build Order object
    const orderNumber = Math.floor(1000 + Math.random() * 9000);
    const newOrder: Order = {
      id: `ord-${Date.now()}`,
      orderNumber,
      createdAt: new Date().toISOString(),
      items: [...items],
      subtotal,
      deliveryFee,
      discount: discountAmount,
      couponCode: appliedCoupon || undefined,
      total,
      orderType,
      driver: assignedDriver,
      // Guarda o tempo PADRÃO (sem o ajuste operacional) — o ajuste em si é
      // sempre recalculado ao vivo na hora de exibir (item 14: "tempo padrão
      // + ajuste operacional ATUAL"), nunca fica congelado no valor de quando
      // o pedido foi criado. Ver OrderStatusModal, que soma o ajuste vigente.
      estimatedMinutes: deliveryCalc.etaMinutes?.total ?? 35,
      customer: {
        name: name.trim(),
        phone: phone.trim(),
        address: orderType === 'delivery' ? {
          cep: cep.trim() || undefined,
          street: street.trim(),
          number: number.trim(),
          neighborhood: neighborhood.trim(),
          city: city.trim(),
          unit: unit.trim() || undefined,
          complement: complement.trim() || undefined,
          reference: reference.trim() || undefined,
          lat,
          lng,
        } : undefined,
      },
      paymentMethod,
      cardBrand: paymentMethod === 'credit_card' || paymentMethod === 'debit_card' || paymentMethod === 'meal_voucher' ? cardBrand : undefined,
      cashChangeFor: paymentMethod === 'cash' && needCashChange ? parseFloat(cashChangeFor.replace(',', '.')) : undefined,
      status: 'recebido',
      statusHistory: [
        {
          status: 'recebido',
          timestamp: new Date().toISOString(),
          note: 'Pedido de Delivery recebido com sucesso!',
        },
      ],
      notes: generalNotes.trim() || undefined,
    };

    // Confetti effect
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#f59e0b', '#10b981', '#3b82f6', '#ec4899'],
      });
    } catch {
      // Ignore in non-browser envs
    }

    playSoundEffect('success');

    if (openWhatsApp) {
      const waUrl = generateWhatsAppOrderUrl(newOrder, restaurantConfig);
      window.open(waUrl, '_blank');
    }

    onOrderPlaced(newOrder, openWhatsApp);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div
        id="checkout-modal-container"
        className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-stone-200 overflow-hidden my-auto max-h-[92vh] flex flex-col animate-in zoom-in-95 duration-200"
      >
        {/* Checkout Header */}
        <div className="p-4 sm:p-5 bg-stone-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[var(--brand)] text-slate-950 font-bold">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black tracking-tight">Finalização do Pedido Delivery</h2>
              <p className="text-xs text-stone-300">
                Informe o endereço para entrega e forma de pagamento
              </p>
            </div>
          </div>
          <button
            id="close-checkout-modal-btn"
            onClick={onClose}
            className="p-2 rounded-full hover:bg-stone-800 text-stone-400 hover:text-white transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 text-stone-900 text-xs sm:text-sm">
          {errorMsg && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-2xl flex items-center gap-2 font-medium">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Section 1: Order Type Selector */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-stone-600 mb-2">
              1. Modalidade do Pedido
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                id="type-delivery-btn"
                onClick={() => setOrderType('delivery')}
                className={`p-3.5 rounded-2xl border text-center flex items-center justify-center gap-2.5 transition-all ${
                  orderType === 'delivery'
                    ? 'bg-[var(--brand-tint)] border-[var(--brand)] text-slate-950 ring-2 ring-[var(--brand)]/20 font-black shadow-xs'
                    : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'
                }`}
              >
                <Bike className="w-5 h-5 text-[var(--brand-dark)]" />
                <div className="text-left">
                  <span className="text-xs font-black block">Entrega em Domicílio</span>
                  <span className="text-[11px] text-stone-500 font-normal">Motoboy leva até você</span>
                </div>
              </button>

              <button
                type="button"
                id="type-takeaway-btn"
                onClick={() => setOrderType('takeaway')}
                className={`p-3.5 rounded-2xl border text-center flex items-center justify-center gap-2.5 transition-all ${
                  orderType === 'takeaway'
                    ? 'bg-[var(--brand-tint)] border-[var(--brand)] text-slate-950 ring-2 ring-[var(--brand)]/20 font-black shadow-xs'
                    : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'
                }`}
              >
                <ShoppingBag className="w-5 h-5 text-[var(--brand-dark)]" />
                <div className="text-left">
                  <span className="text-xs font-black block">Retirar no Balcão</span>
                  <span className="text-[11px] text-stone-500 font-normal">Sem taxa de entrega</span>
                </div>
              </button>
            </div>
          </div>

          {/* Section 2: Customer and Location details */}
          <div className="bg-stone-50 p-4 sm:p-5 rounded-2xl border border-stone-200 space-y-3.5">
            <h3 className="text-xs font-black uppercase tracking-wider text-stone-800 flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-[var(--brand-dark)]" />
              <span>2. Dados do Cliente e Endereço</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-stone-700 font-bold text-xs mb-1">
                  Seu Nome Completo *
                </label>
                <input
                  id="checkout-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Carlos Silva"
                  className={fieldClass('name')}
                />
                {triedSubmit && fieldErrors.name && (
                  <p className="text-rose-600 text-[11px] mt-1 font-semibold">{fieldErrors.name}</p>
                )}
              </div>

              <div>
                <label className="block text-stone-700 font-bold text-xs mb-1">
                  Telefone / WhatsApp *
                </label>
                <input
                  id="checkout-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(11) 98765-4321"
                  className={fieldClass('phone')}
                />
                {triedSubmit && fieldErrors.phone && (
                  <p className="text-rose-600 text-[11px] mt-1 font-semibold">{fieldErrors.phone}</p>
                )}
              </div>
            </div>

            {/* Delivery specific address fields */}
            {orderType === 'delivery' && (
              <div className="space-y-3 pt-2 border-t border-stone-200">
                {/* CEP com preenchimento automático de rua/bairro/cidade (ViaCEP) */}
                <div>
                  <label className="block text-stone-700 font-bold text-xs mb-1">
                    CEP *
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="checkout-cep"
                      type="text"
                      inputMode="numeric"
                      value={cep}
                      onChange={(e) => setCep(e.target.value)}
                      onBlur={() => cep.trim() && handleCepLookup(cep)}
                      placeholder="00000-000"
                      maxLength={9}
                      className={fieldClass('cep')}
                    />
                    <button
                      type="button"
                      onClick={() => handleCepLookup(cep)}
                      disabled={isLoadingCep}
                      className="px-3.5 py-2.5 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold whitespace-nowrap disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {isLoadingCep ? 'Buscando...' : 'Buscar'}
                    </button>
                  </div>
                  {cepError && <p className="text-rose-600 text-[11px] mt-1 font-medium">{cepError}</p>}
                  {triedSubmit && fieldErrors.cep && !cepError && (
                    <p className="text-rose-600 text-[11px] mt-1 font-semibold">{fieldErrors.cep}</p>
                  )}
                </div>

                {/* Bairro Selector with auto fee */}
                <div>
                  <label className="block text-stone-700 font-bold text-xs mb-1">
                    Bairro para Entrega (Selecione para calcular taxa) *
                  </label>
                  <select
                    id="checkout-neighborhood"
                    value={neighborhood}
                    onChange={(e) => setNeighborhood(e.target.value)}
                    className={`${fieldClass('neighborhood')} font-semibold`}
                  >
                    {restaurantConfig.deliveryZones.map((zone) => (
                      <option key={zone.id} value={zone.name || zone.neighborhood}>
                        {zone.name || zone.neighborhood} — Taxa: {formatCurrency(zone.fee)} (Tempo: {zone.estimatedMinutes || zone.estimatedTime || '—'})
                      </option>
                    ))}
                  </select>
                  {triedSubmit && fieldErrors.neighborhood && (
                    <p className="text-rose-600 text-[11px] mt-1 font-semibold">{fieldErrors.neighborhood}</p>
                  )}
                  {isOutOfDeliveryRange && (
                    <p className="text-rose-600 text-[11px] mt-1.5 font-semibold flex items-center gap-1">
                      ⚠️ Este endereço está fora da nossa área de entrega no momento.
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <label className="block text-stone-700 font-bold text-xs mb-1">
                      Rua / Avenida *
                    </label>
                    <input
                      id="checkout-street"
                      type="text"
                      value={street}
                      onChange={(e) => setStreet(e.target.value)}
                      placeholder="Ex: Av. Paulista"
                      className={fieldClass('street')}
                    />
                    {triedSubmit && fieldErrors.street && (
                      <p className="text-rose-600 text-[11px] mt-1 font-semibold">{fieldErrors.street}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-stone-700 font-bold text-xs mb-1">
                      Número *
                    </label>
                    <input
                      id="checkout-number"
                      type="text"
                      value={number}
                      onChange={(e) => setNumber(e.target.value)}
                      placeholder="1500"
                      className={`${fieldClass('number')} font-bold`}
                    />
                    {triedSubmit && fieldErrors.number && (
                      <p className="text-rose-600 text-[11px] mt-1 font-semibold">{fieldErrors.number}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-stone-700 font-bold text-xs mb-1">
                      Apto / Bloco
                    </label>
                    <input
                      id="checkout-unit"
                      type="text"
                      value={unit}
                      onChange={(e) => setUnit(e.target.value)}
                      placeholder="Apto 302, Bloco B"
                      className="w-full px-3 py-2.5 bg-white border border-stone-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
                    />
                  </div>
                  <div>
                    <label className="block text-stone-700 font-bold text-xs mb-1">
                      Complemento
                    </label>
                    <input
                      id="checkout-complement"
                      type="text"
                      value={complement}
                      onChange={(e) => setComplement(e.target.value)}
                      placeholder="Casa azul, fundos"
                      className="w-full px-3 py-2.5 bg-white border border-stone-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
                    />
                  </div>
                  <div>
                    <label className="block text-stone-700 font-bold text-xs mb-1">
                      Ponto de Referência *
                    </label>
                    <input
                      id="checkout-reference"
                      type="text"
                      value={reference}
                      onChange={(e) => setReference(e.target.value)}
                      placeholder="Em frente ao parque"
                      className={fieldClass('reference')}
                    />
                    {triedSubmit && fieldErrors.reference && (
                      <p className="text-rose-600 text-[11px] mt-1 font-semibold">{fieldErrors.reference}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Takeaway notes */}
            {orderType === 'takeaway' && (
              <div className="text-xs text-stone-700 bg-[var(--brand-tint)] p-3 rounded-xl border border-[var(--brand-tint)] flex items-start gap-2">
                <MapPin className="w-4 h-4 text-[var(--brand-dark)] flex-shrink-0 mt-0.5" />
                <div>
                  <strong>Endereço para retirada no balcão:</strong> {restaurantConfig.address}
                  <p className="text-[11px] text-stone-500 mt-0.5">Seu pedido ficará pronto em aproximadamente 20-30 min.</p>
                </div>
              </div>
            )}
          </div>

          {/* Section 3: Payment Method */}
          <div className="bg-stone-50 p-4 sm:p-5 rounded-2xl border border-stone-200 space-y-3.5">
            <h3 className="text-xs font-black uppercase tracking-wider text-stone-800">
              3. Forma de Pagamento
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                id="pay-pix-btn"
                onClick={() => setPaymentMethod('pix')}
                className={`p-3 rounded-xl border text-center flex flex-col items-center gap-1 transition-all ${
                  paymentMethod === 'pix'
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-950 ring-2 ring-emerald-500/20 font-black shadow-xs'
                    : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'
                }`}
              >
                <span className="text-sm font-black text-emerald-600">PIX</span>
                <span className="text-xs">Chave / QR Code</span>
              </button>

              <button
                type="button"
                id="pay-credit-btn"
                onClick={() => setPaymentMethod('credit_card')}
                className={`p-3 rounded-xl border text-center flex flex-col items-center gap-1 transition-all ${
                  paymentMethod === 'credit_card'
                    ? 'bg-[var(--brand-tint)] border-[var(--brand)] text-[var(--brand-dark)] ring-2 ring-[var(--brand)]/20 font-black shadow-xs'
                    : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'
                }`}
              >
                <CreditCard className="w-4 h-4 text-[var(--brand-dark)]" />
                <span className="text-xs">Cartão de Crédito</span>
              </button>

              <button
                type="button"
                id="pay-debit-btn"
                onClick={() => setPaymentMethod('debit_card')}
                className={`p-3 rounded-xl border text-center flex flex-col items-center gap-1 transition-all ${
                  paymentMethod === 'debit_card'
                    ? 'bg-[var(--brand-tint)] border-[var(--brand)] text-[var(--brand-dark)] ring-2 ring-[var(--brand)]/20 font-black shadow-xs'
                    : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'
                }`}
              >
                <CreditCard className="w-4 h-4 text-[var(--brand-dark)]" />
                <span className="text-xs">Cartão de Débito</span>
              </button>

              <button
                type="button"
                id="pay-cash-btn"
                onClick={() => setPaymentMethod('cash')}
                className={`p-3 rounded-xl border text-center flex flex-col items-center gap-1 transition-all ${
                  paymentMethod === 'cash'
                    ? 'bg-[var(--brand-tint)] border-[var(--brand)] text-[var(--brand-dark)] ring-2 ring-[var(--brand)]/20 font-black shadow-xs'
                    : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'
                }`}
              >
                <Banknote className="w-4 h-4 text-[var(--brand-dark)]" />
                <span className="text-xs">Dinheiro</span>
              </button>
            </div>

            {/* Pix key copy details */}
            {paymentMethod === 'pix' && (
              <div className="bg-emerald-50/70 p-3.5 rounded-xl border border-emerald-200 space-y-2 mt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-950 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                    Chave Pix da Loja (Copia e Cola):
                  </span>
                  <span className="text-[10px] uppercase font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">
                    {restaurantConfig.pixKeyType}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={restaurantConfig.pixKey}
                    className="flex-1 px-3 py-2 bg-white border border-emerald-300 rounded-xl font-mono text-xs text-emerald-950 select-all"
                  />
                  <button
                    id="copy-pix-key-btn"
                    type="button"
                    onClick={handleCopyPix}
                    className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs flex items-center gap-1 transition-all shadow-xs"
                  >
                    {copiedPix ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedPix ? 'Copiado!' : 'Copiar'}</span>
                  </button>
                </div>
                <p className="text-[11px] text-emerald-800">
                  Transfira o valor exato de <strong>{formatCurrency(total)}</strong>. O motoboy confere o comprovante na entrega.
                </p>
              </div>
            )}

            {/* Card Machine selection */}
            {(paymentMethod === 'credit_card' || paymentMethod === 'debit_card') && (
              <div className="p-3 bg-white rounded-xl border border-stone-200 space-y-2">
                <label className="block text-xs font-bold text-stone-700">
                  Bandeira ou Tipo de Cartão (O entregador leva a maquininha):
                </label>
                <div className="flex flex-wrap gap-2">
                  {['Mastercard', 'Visa', 'Elo', 'Hipercard', 'Alelo / VR / Sodexo'].map((brand) => (
                    <button
                      key={brand}
                      type="button"
                      onClick={() => setCardBrand(brand)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                        cardBrand === brand
                          ? 'bg-[var(--brand)] text-slate-950 border-[var(--brand)] font-bold'
                          : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                      }`}
                    >
                      {brand}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Cash change details */}
            {paymentMethod === 'cash' && (
              <div className="p-3 bg-white rounded-xl border border-stone-200 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={needCashChange}
                    onChange={(e) => setNeedCashChange(e.target.checked)}
                    className="w-4 h-4 rounded text-[var(--brand-dark)] focus:ring-[var(--brand)]"
                  />
                  <span className="text-xs font-bold text-stone-800">
                    Preciso de troco em dinheiro
                  </span>
                </label>

                {needCashChange && (
                  <div className="flex items-center gap-2 pl-6">
                    <span className="text-xs text-stone-600 font-semibold">Troco para: R$</span>
                    <input
                      id="cash-change-input"
                      type="number"
                      value={cashChangeFor}
                      onChange={(e) => setCashChangeFor(e.target.value)}
                      placeholder={total.toFixed(2)}
                      className="w-28 px-3 py-1.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Section 4: General Notes */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1">
              4. Observações para a Cozinha / Entregador (Opcional)
            </label>
            <input
              id="checkout-general-notes"
              type="text"
              value={generalNotes}
              onChange={(e) => setGeneralNotes(e.target.value)}
              placeholder="Ex: Tocar campainha do 2º andar, deixar na portaria, mandar talheres..."
              className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
            />
          </div>
        </div>

        {/* Modal Footer with Financial Recap & Dual Order Placement CTA */}
        <div className="p-4 sm:p-5 bg-stone-50 border-t border-stone-200 space-y-3">
          <div className="flex items-center justify-between text-xs sm:text-sm">
            <span className="text-stone-600">
              {items.length} {items.length === 1 ? 'item' : 'itens'} {deliveryFee > 0 ? `+ Frete (${formatCurrency(deliveryFee)})` : isFreeDelivery ? ' (Frete Grátis)' : ''}
              {discountAmount > 0 ? ` - Desconto (${formatCurrency(discountAmount)})` : ''}
            </span>
            <div className="text-right">
              <span className="text-xs text-stone-500 mr-2">Total a pagar:</span>
              <span className="text-lg sm:text-xl font-black text-[var(--brand-dark)]">
                {formatCurrency(total)}
              </span>
            </div>
          </div>

          {/* Dual Action Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              id="confirm-whatsapp-order-btn"
              type="button"
              onClick={() => handleCompleteOrder(true)}
              className="py-3.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-md"
            >
              <Send className="w-4 h-4" />
              <span>Enviar Pedido pelo WhatsApp</span>
            </button>

            <button
              id="confirm-online-order-btn"
              type="button"
              onClick={() => handleCompleteOrder(false)}
              className="py-3.5 px-4 rounded-2xl bg-slate-900 hover:bg-slate-800 active:scale-[0.99] text-[var(--brand-light)] font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-md"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Pedir Aqui</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

