import React, { useState, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { Order, OrderStatus } from '../types/restaurant';
import {
  X,
  Clock,
  CheckCircle2,
  ChefHat,
  Bike,
  PackageCheck,
  AlertTriangle,
  Search,
  MessageCircle,
  MapPin,
  UtensilsCrossed,
  Receipt,
  Store,
  Copy,
  Check,
  ExternalLink,
  FileCode,
  FileText,
  ShieldCheck,
} from 'lucide-react';

interface OrderTrackerModalProps {
  onClose: () => void;
  defaultOrderId?: string | null;
}

const ORDER_STEPS: { status: OrderStatus; label: string; icon: any; desc: string }[] = [
  {
    status: 'recebido',
    label: 'Recebido',
    icon: Receipt,
    desc: 'Pedido registrado no sistema',
  },
  {
    status: 'aceito',
    label: 'Confirmado',
    icon: Store,
    desc: 'Restaurante confirmou e aceitou o pedido',
  },
  {
    status: 'em_preparo',
    label: 'Em Preparo',
    icon: ChefHat,
    desc: 'Chef preparando seus pratos com ingredientes frescos',
  },
  {
    status: 'pronto',
    label: 'Pronto',
    icon: PackageCheck,
    desc: 'Pronto e embalado com cuidado na expedição',
  },
  {
    status: 'saiu_para_entrega',
    label: 'A Caminho',
    icon: Bike,
    desc: 'Saiu com o entregador para seu endereço',
  },
  {
    status: 'entregue',
    label: 'Entregue',
    icon: CheckCircle2,
    desc: 'Pedido entregue com sucesso! Bom apetite!',
  },
];

export const OrderTrackerModal: React.FC<OrderTrackerModalProps> = ({
  onClose,
  defaultOrderId,
}) => {
  const { orders, restaurants } = useStore();
  const [searchCode, setSearchCode] = useState('');
  const [fiscalDoc, setFiscalDoc] = useState<any | null>(null);
  const [isLoadingFiscal, setIsLoadingFiscal] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);

  // Current active order to view
  const currentOrder: Order | undefined = defaultOrderId
    ? orders.find((o) => o.id === defaultOrderId)
    : searchCode.trim()
    ? orders.find(
        (o) =>
          o.shortCode.toLowerCase() === searchCode.trim().toLowerCase() ||
          o.id.toLowerCase() === searchCode.trim().toLowerCase()
      )
    : orders[0]; // defaults to most recent order

  const restaurant = currentOrder ? restaurants[currentOrder.restaurantSlug] : null;

  useEffect(() => {
    if (!currentOrder?.id) {
      setFiscalDoc(null);
      return;
    }
    let isMounted = true;
    setIsLoadingFiscal(true);
    fetch(`/api/fiscal/public-order/${encodeURIComponent(currentOrder.id)}?t=${encodeURIComponent(currentOrder.trackingToken || '')}`)
      .then((res) => res.json())
      .then((data) => {
        if (isMounted) {
          if (data.success && data.hasFiscalDoc) {
            setFiscalDoc(data.document);
          } else {
            setFiscalDoc(null);
          }
        }
      })
      .catch((err) => {
        console.warn('Erro ao consultar NFC-e do pedido:', err);
        if (isMounted) setFiscalDoc(null);
      })
      .finally(() => {
        if (isMounted) setIsLoadingFiscal(false);
      });

    return () => {
      isMounted = false;
    };
  }, [currentOrder?.id]);

  const handleCopyKey = () => {
    if (!fiscalDoc?.accessKey) return;
    navigator.clipboard?.writeText(fiscalDoc.accessKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const getStepIndex = (status: OrderStatus) => {
    switch (status) {
      case 'recebido':
        return 0;
      case 'aceito':
        return 1;
      case 'em_preparo':
        return 2;
      case 'pronto':
        return 3;
      case 'saiu_para_entrega':
        return 4;
      case 'entregue':
        return 5;
      case 'cancelado':
        return -1;
      default:
        return 0;
    }
  };

  const currentStepIndex = currentOrder ? getStepIndex(currentOrder.status) : 0;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-xl w-full overflow-hidden shadow-2xl my-auto animate-in fade-in duration-200">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Rastreamento de Pedido</h2>
              <p className="text-[11px] text-slate-400">Status em tempo real • Tokio inBox</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search by code */}
        <div className="p-4 bg-slate-950/40 border-b border-slate-800">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchCode}
              onChange={(e) => setSearchCode(e.target.value)}
              placeholder="Digite o código do pedido (Ex: #TK-4821)"
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 uppercase"
            />
          </div>
        </div>

        {/* BODY */}
        <div className="p-5 sm:p-6 max-h-[70vh] overflow-y-auto space-y-6">
          {!currentOrder ? (
            <div className="text-center py-10 space-y-2 text-slate-400">
              <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto mb-2" />
              <h3 className="text-base font-bold text-white">Pedido não localizado</h3>
              <p className="text-xs max-w-xs mx-auto">
                Verifique o código digitado ou crie um novo pedido pelo cardápio.
              </p>
            </div>
          ) : (
            <>
              {/* Order Status Badge & ShortCode */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-2xl shadow">
                    {restaurant?.emoji || '🍱'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-black text-white">{currentOrder.shortCode}</span>
                      <span className="text-xs text-slate-400">({currentOrder.restaurantName})</span>
                    </div>
                    <p className="text-xs text-slate-400">
                      Cliente: <strong className="text-white">{currentOrder.customerName}</strong>
                    </p>
                  </div>
                </div>

                <div className="text-right sm:text-right w-full sm:w-auto flex justify-between sm:block">
                  <span className="text-[11px] text-slate-400 block">Total</span>
                  <span className="text-base font-black text-amber-400">
                    R$ {currentOrder.total.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* CANCELLED STATE NOTICE */}
              {currentOrder.status === 'cancelado' ? (
                <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-center space-y-2">
                  <AlertTriangle className="w-8 h-8 text-rose-400 mx-auto" />
                  <h4 className="text-sm font-bold text-rose-300">Este pedido foi cancelado</h4>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    Entre em contato diretamente com o restaurante caso tenha alguma dúvida sobre o cancelamento.
                  </p>
                </div>
              ) : (
                /* PROGRESS BAR (5 STEPS V7) */
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                      Fluxo de Preparo & Entrega
                    </span>
                    <span className="text-xs font-bold text-amber-400">
                      {ORDER_STEPS[currentStepIndex]?.label}
                    </span>
                  </div>

                  <div className="space-y-3">
                    {ORDER_STEPS.map((step, idx) => {
                      const isPast = idx < currentStepIndex;
                      const isCurrent = idx === currentStepIndex;
                      const isPending = idx > currentStepIndex;
                      const StepIcon = step.icon;

                      return (
                        <div
                          key={step.status}
                          className={`flex items-start gap-3 p-3 rounded-2xl border transition-all ${
                            isCurrent
                              ? 'bg-amber-500/10 border-amber-500/50 shadow-md'
                              : isPast
                              ? 'bg-slate-950/60 border-emerald-500/30'
                              : 'bg-slate-950/20 border-slate-900 opacity-40'
                          }`}
                        >
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                              isCurrent
                                ? 'bg-amber-500 border-amber-400 text-slate-950 animate-pulse'
                                : isPast
                                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                                : 'bg-slate-800 border-slate-700 text-slate-500'
                            }`}
                          >
                            <StepIcon className="w-4 h-4" />
                          </div>

                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <h5
                                className={`text-xs font-bold ${
                                  isCurrent
                                    ? 'text-amber-400'
                                    : isPast
                                    ? 'text-white'
                                    : 'text-slate-400'
                                }`}
                              >
                                {step.label}
                              </h5>
                              {isCurrent && (
                                <span className="text-[10px] bg-amber-500/20 text-amber-300 font-bold px-2 py-0.5 rounded-full">
                                  Em andamento
                                </span>
                              )}
                              {isPast && (
                                <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-semibold">
                                  <CheckCircle2 className="w-3 h-3" /> Concluído
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-400 mt-0.5">{step.desc}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Status History Timeline */}
              {currentOrder.statusHistory && currentOrder.statusHistory.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-slate-800">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Histórico do Pedido
                  </h4>
                  <div className="space-y-2">
                    {currentOrder.statusHistory.map((h, i) => (
                      <div
                        key={i}
                        className="text-[11px] bg-slate-950/50 p-2.5 rounded-xl border border-slate-800/80 flex items-start justify-between gap-3"
                      >
                        <div>
                          <span className="font-bold text-slate-200 capitalize">
                            {h.status.replace('_', ' ')}
                          </span>
                          {h.note && <span className="text-slate-400 block">{h.note}</span>}
                        </div>
                        <span className="text-[10px] text-slate-500 shrink-0">{h.timestamp}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Items in order */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Itens Solicitados
                </h4>
                <div className="space-y-1.5">
                  {currentOrder.items.map((item, idx) => (
                    <div
                      key={idx}
                      className="text-xs p-2.5 bg-slate-950/40 rounded-xl border border-slate-800/60 flex items-center justify-between"
                    >
                      <div>
                        <span className="font-bold text-white">
                          {item.quantity}x {item.name}
                        </span>
                        {item.selectedOptions && item.selectedOptions.length > 0 && (
                          <div className="text-[10px] text-slate-400">
                            {item.selectedOptions.map((o) => o.name).join(', ')}
                          </div>
                        )}
                      </div>
                      <span className="font-bold text-slate-300">
                        R$ {item.totalPrice.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* NFC-e Cupom Fiscal do Consumidor */}
              {isLoadingFiscal ? (
                <div className="p-3 bg-slate-950/50 rounded-2xl border border-slate-800 text-center animate-pulse text-xs text-slate-400">
                  Verificando emissão do Cupom Fiscal (NFC-e)...
                </div>
              ) : fiscalDoc ? (
                <div className="p-4 bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950/20 border border-emerald-500/30 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
                        <Receipt className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                          Cupom Fiscal Eletrônico (NFC-e)
                          <span className="text-[10px] text-emerald-400 font-mono font-normal">
                            Mod {fiscalDoc.type || 65}
                          </span>
                        </h4>
                        <p className="text-[10px] text-slate-400">
                          Série {fiscalDoc.series} • Nº {String(fiscalDoc.number).padStart(6, '0')}
                        </p>
                      </div>
                    </div>

                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 border ${
                        fiscalDoc.status === 'homologado'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                          : fiscalDoc.status === 'contingencia'
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                          : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                      }`}
                    >
                      <ShieldCheck className="w-3 h-3" />
                      {fiscalDoc.status === 'homologado'
                        ? 'Autorizada SEFAZ'
                        : fiscalDoc.status === 'contingencia'
                        ? 'Contingência'
                        : 'Cancelada'}
                    </span>
                  </div>

                  {/* Chave de Acesso */}
                  <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                        Chave de Acesso (44 dígitos)
                      </span>
                      <button
                        onClick={handleCopyKey}
                        className="text-[10px] font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-500/20 transition-colors"
                        title="Copiar chave de acesso completa"
                      >
                        {copiedKey ? (
                          <>
                            <Check className="w-3 h-3" /> Copiado!
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" /> Copiar
                          </>
                        )}
                      </button>
                    </div>
                    <p className="font-mono text-[10px] text-slate-300 select-all break-all leading-tight">
                      {fiscalDoc.formattedAccessKey || fiscalDoc.accessKey}
                    </p>
                  </div>

                  {/* Informações Tributárias & Protocolo */}
                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <div className="p-2 rounded-lg bg-slate-950/40 border border-slate-800/80">
                      <span className="text-slate-400 block">Protocolo SEFAZ</span>
                      <span className="font-mono font-bold text-slate-200">
                        {fiscalDoc.protocol || 'Transmissão em lote'}
                      </span>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-950/40 border border-slate-800/80">
                      <span className="text-slate-400 block">Tributos Aprox. (Lei 12.741)</span>
                      <span className="font-bold text-emerald-400">
                        R$ {Number(fiscalDoc.approximateTaxesTotal || 0).toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Botões de Ação */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <a
                      href={fiscalDoc.danfceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Ver DANFC-e</span>
                      <ExternalLink className="w-3 h-3 opacity-70" />
                    </a>

                    <a
                      href={fiscalDoc.xmlUrl}
                      download={`NFCe_${fiscalDoc.accessKey}.xml`}
                      className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-xl flex items-center justify-center gap-1.5 border border-slate-700 transition-colors"
                    >
                      <FileCode className="w-3.5 h-3.5 text-amber-400" />
                      <span>Baixar XML</span>
                    </a>
                  </div>
                </div>
              ) : null}

              {/* Contact Restaurant */}
              {restaurant && (
                <div className="pt-2">
                  <a
                    href={`https://wa.me/${restaurant.whatsapp}?text=Ol%C3%A1%2C%20estou%20acompanhando%20o%20pedido%20${encodeURIComponent(
                      currentOrder.shortCode
                    )}%20e%20gostaria%20de%20uma%20informa%C3%A7%C3%A3o.`}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-xl flex items-center justify-center gap-2 border border-slate-700 transition-colors"
                  >
                    <MessageCircle className="w-4 h-4 text-emerald-400" />
                    <span>Falar com o {restaurant.name} no WhatsApp</span>
                  </a>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
