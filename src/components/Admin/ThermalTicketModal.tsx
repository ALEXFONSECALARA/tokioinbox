import React, { useState, useEffect } from 'react';
import { Order, RestaurantConfig, SmartTicketAIAnalysis } from '../../types/restaurant';
import { useStore } from '../../context/StoreContext';
import {
  X,
  Printer,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Receipt,
  Bike,
  Store,
  UtensilsCrossed,
  Sparkles,
  Bot,
  Flame,
  Clock,
  ShieldAlert,
  ListOrdered,
  HeartHandshake,
} from 'lucide-react';

interface ThermalTicketModalProps {
  order: Order;
  restaurant: RestaurantConfig;
  onClose: () => void;
}

export const ThermalTicketModal: React.FC<ThermalTicketModalProps> = ({
  order,
  restaurant,
  onClose,
}) => {
  const { updateOrderPrintStatus, printerSettings, updatePrinterSettings } = useStore();
  const [printStep, setPrintStep] = useState<'idle' | 'printing' | 'printed' | 'error'>(
    order.printStatus === 'impresso' ? 'printed' : 'idle'
  );

  // Smart Ticket AI State
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<SmartTicketAIAnalysis | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [includeAiInPrint, setIncludeAiInPrint] = useState(true);

  // Auto-fetch AI analysis if enabled in printerSettings
  useEffect(() => {
    if (printerSettings?.enableSmartTicketAI) {
      handleFetchAiAnalysis();
    }
  }, [order.id]);

  const handleFetchAiAnalysis = async () => {
    setIsAiLoading(true);
    setAiError(null);
    try {
      const res = await fetch('/api/ai/smart-ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: order.id,
          items: order.items,
          notes: order.notes,
          restaurantName: restaurant.name,
          restaurantSlug: order.restaurantSlug,
        }),
      });

      if (!res.ok) {
        throw new Error('Falha ao conectar com o serviço de IA');
      }

      const data = await res.json();
      if (data.success && data.analysis) {
        setAiAnalysis(data.analysis);
      } else {
        throw new Error(data.error || 'Não foi possível analisar o pedido');
      }
    } catch (err: any) {
      console.error('Smart ticket AI error:', err);
      setAiError(err.message || 'Erro ao gerar análise');
    } finally {
      setIsAiLoading(false);
    }
  };

  const handlePrint = () => {
    setPrintStep('printing');
    updateOrderPrintStatus(order.id, 'imprimindo');

    // Thermal printer spool / window.print
    setTimeout(() => {
      try {
        window.print();
        setPrintStep('printed');
        updateOrderPrintStatus(order.id, 'impresso');
      } catch (e) {
        setPrintStep('error');
      }
    }, 600);
  };

  const isWidth58mm = printerSettings?.paperWidth === '58mm';

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-xl w-full overflow-hidden shadow-2xl my-auto animate-in fade-in duration-200">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">Impressora Inteligente com IA</h3>
                <span className="bg-gradient-to-r from-amber-500 to-rose-600 text-slate-950 text-[10px] font-black px-1.5 py-0.2 rounded uppercase">
                  ESC/POS {printerSettings?.paperWidth || '80mm'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Comanda {order.shortCode} • {order.customerName}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* PRINT STATUS & AI CONTROLS BAR */}
        <div className="bg-slate-950 px-4 py-2.5 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Fila Spool:</span>
            {printStep === 'printing' ? (
              <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold flex items-center gap-1 animate-pulse">
                <Printer className="w-3 h-3" /> Imprimindo...
              </span>
            ) : printStep === 'printed' ? (
              <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Impresso
              </span>
            ) : printStep === 'error' ? (
              <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> Falha
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-bold">
                Pendente
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* AI Generator Button */}
            <button
              onClick={handleFetchAiAnalysis}
              disabled={isAiLoading}
              className="px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 font-semibold text-[11px] flex items-center gap-1.5 transition-all disabled:opacity-50"
            >
              <Sparkles className="w-3 h-3" />
              <span>{isAiLoading ? 'Analisando Pedido...' : aiAnalysis ? 'Reanalisar IA' : 'Otimizar com IA'}</span>
            </button>

            {printStep === 'printed' && (
              <button
                onClick={handlePrint}
                className="text-[11px] text-slate-300 hover:text-white flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" /> Reimprimir
              </button>
            )}
          </div>
        </div>

        {/* AI INSIGHTS CARD */}
        {aiAnalysis && (
          <div className="mx-4 mt-3 bg-gradient-to-br from-slate-950 via-slate-900 to-amber-950/30 border border-amber-500/40 rounded-2xl p-3.5 space-y-2.5 shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bot className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-bold text-white">Tokio Copilot Cozinha (IA)</span>
              </div>
              <span
                className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                  aiAnalysis.urgencyLevel === 'alta'
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                    : aiAnalysis.urgencyLevel === 'media'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                }`}
              >
                Urgência: {aiAnalysis.urgencyLevel}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-slate-900/80 p-2 rounded-xl border border-slate-800">
                <span className="text-slate-400 text-[10px] block">Estação de Trabalho</span>
                <span className="font-bold text-slate-200">{aiAnalysis.prepStation}</span>
              </div>
              <div className="bg-slate-900/80 p-2 rounded-xl border border-slate-800">
                <span className="text-slate-400 text-[10px] block">Tempo Estimado Preparo</span>
                <span className="font-bold text-amber-400 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {aiAnalysis.estimatedPrepMinutes} minutos
                </span>
              </div>
            </div>

            {/* Allergy Alerts */}
            {aiAnalysis.allergyOrDietAlerts && aiAnalysis.allergyOrDietAlerts.length > 0 && (
              <div className="bg-rose-950/40 border border-rose-800/60 p-2 rounded-xl text-xs text-rose-200 space-y-1">
                <div className="flex items-center gap-1 font-bold text-rose-300 text-[11px]">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>Atenção para Alergias & Restrições:</span>
                </div>
                <ul className="list-disc list-inside text-[11px] space-y-0.5 pl-1">
                  {aiAnalysis.allergyOrDietAlerts.map((alert, i) => (
                    <li key={i}>{alert}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Prep Sequence */}
            {aiAnalysis.prepSequence && aiAnalysis.prepSequence.length > 0 && (
              <div className="text-xs space-y-1 bg-slate-950/60 p-2 rounded-xl border border-slate-800/80">
                <span className="font-bold text-slate-300 text-[11px] flex items-center gap-1">
                  <ListOrdered className="w-3 h-3 text-amber-400" />
                  Sequência Otimizada de Montagem:
                </span>
                <ol className="list-decimal list-inside text-[11px] text-slate-300 space-y-0.5 pl-1">
                  {aiAnalysis.prepSequence.map((step, i) => (
                    <li key={i}>{step}</li>
                  ))}
                </ol>
              </div>
            )}

            {/* Chef note & kindness message */}
            <div className="text-[11px] text-slate-400 bg-slate-900/60 p-2 rounded-xl border border-slate-800 flex items-start gap-1.5">
              <HeartHandshake className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
              <span>
                <strong>Dica da Cozinha:</strong> {aiAnalysis.chefNotes} &quot;{aiAnalysis.customerKindMessage}&quot;
              </span>
            </div>

            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={includeAiInPrint}
                onChange={(e) => setIncludeAiInPrint(e.target.checked)}
                className="rounded text-amber-500 focus:ring-amber-500 bg-slate-950 border-slate-700"
              />
              <span>Incluir resumo da IA na comanda impressa</span>
            </label>
          </div>
        )}

        {/* THERMAL PAPER VISUAL CONTAINER */}
        <div className="p-4 bg-slate-950/80 max-h-[50vh] overflow-y-auto">
          <div
            id="thermal-receipt-body"
            className={`bg-amber-50 text-slate-900 font-mono text-xs p-5 rounded-md shadow-inner border border-amber-200/60 mx-auto ${
              isWidth58mm ? 'max-w-[270px] text-[11px]' : 'max-w-[340px]'
            } leading-relaxed space-y-3`}
          >
            {/* Header */}
            <div className="text-center border-b border-dashed border-slate-400 pb-2.5 space-y-0.5">
              <h2 className="font-extrabold text-sm uppercase tracking-wider">{restaurant.name}</h2>
              <p className="text-[10px] text-slate-600">{restaurant.address}</p>
              <p className="text-[10px] text-slate-600">WhatsApp: {restaurant.phone}</p>
              <div className="pt-1.5 flex justify-center items-center gap-2 text-xs font-black">
                <span>COMANDA COZINHA</span>
                <span>•</span>
                <span className="bg-slate-900 text-amber-100 px-1.5 py-0.2 rounded">
                  {order.shortCode}
                </span>
              </div>
            </div>

            {/* AI Summary on Ticket */}
            {aiAnalysis && includeAiInPrint && (
              <div className="bg-amber-100/90 border border-amber-300 p-2 rounded text-[10px] space-y-1">
                <div className="flex justify-between font-bold">
                  <span>[IA TOKIO KITCHEN]</span>
                  <span>ESTAÇÃO: {aiAnalysis.prepStation}</span>
                </div>
                <div>URGÊNCIA: {aiAnalysis.urgencyLevel.toUpperCase()} • PREP: ~{aiAnalysis.estimatedPrepMinutes}m</div>
                {aiAnalysis.allergyOrDietAlerts && aiAnalysis.allergyOrDietAlerts.length > 0 && (
                  <div className="font-bold text-rose-800">
                    ALERTA: {aiAnalysis.allergyOrDietAlerts.join(' | ')}
                  </div>
                )}
              </div>
            )}

            {/* Order info & Time */}
            <div className="text-[11px] border-b border-dashed border-slate-400 pb-2 space-y-0.5">
              <div className="flex justify-between">
                <span>Data/Hora:</span>
                <span>{new Date(order.createdAt).toLocaleTimeString()}</span>
              </div>
              <div className="flex justify-between font-bold">
                <span>MODALIDADE:</span>
                <span className="uppercase">{order.orderType}</span>
              </div>
              {order.orderType === 'mesa' && (
                <div className="flex justify-between text-xs font-black bg-amber-200/70 px-1 py-0.5 rounded">
                  <span>MESA SALÃO:</span>
                  <span>MESA {order.tableNumber}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Cliente:</span>
                <span className="font-bold">{order.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span>Fone:</span>
                <span>{order.customerPhone}</span>
              </div>
              {order.orderType === 'delivery' && order.deliveryAddress && (
                <div className="pt-1 text-[10px] text-slate-800">
                  <strong>Endereço:</strong> {order.deliveryAddress.street}, nº{' '}
                  {order.deliveryAddress.number}{' '}
                  {order.deliveryAddress.complement && `(${order.deliveryAddress.complement})`} -{' '}
                  {order.deliveryAddress.neighborhood}, {order.deliveryAddress.city}
                </div>
              )}
            </div>

            {/* Items list */}
            <div className="border-b border-dashed border-slate-400 pb-2 space-y-2">
              <div className="text-[10px] uppercase font-bold text-slate-600 flex justify-between">
                <span>QTD ITEM</span>
                <span>TOTAL</span>
              </div>

              {order.items.map((item, idx) => (
                <div key={idx} className="space-y-0.5">
                  <div className="flex justify-between font-bold text-xs">
                    <span>
                      {item.quantity}x {item.name}
                    </span>
                    <span>R$ {item.totalPrice.toFixed(2)}</span>
                  </div>
                  {item.selectedOptions && item.selectedOptions.length > 0 && (
                    <div className="pl-3 text-[10px] text-slate-700">
                      {item.selectedOptions.map((o) => `+ ${o.name}`).join(' | ')}
                    </div>
                  )}
                  {item.notes && (
                    <div className="pl-3 text-[10px] font-semibold text-rose-700">
                      OBS: {item.notes}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Financial summary */}
            <div className="text-[11px] space-y-0.5 border-b border-dashed border-slate-400 pb-2">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>R$ {order.subtotal.toFixed(2)}</span>
              </div>
              {order.discount > 0 && (
                <div className="flex justify-between text-emerald-800">
                  <span>Desconto ({order.couponCode}):</span>
                  <span>- R$ {order.discount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Taxa de Entrega:</span>
                <span>R$ {order.deliveryFee.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm font-black pt-1">
                <span>TOTAL:</span>
                <span>R$ {order.total.toFixed(2)}</span>
              </div>
              <div className="flex justify-between pt-1 text-[10px]">
                <span>PAGAMENTO:</span>
                <span className="font-bold uppercase">
                  {order.paymentMethod.replace('_', ' ')}
                </span>
              </div>
              {order.paymentDetails?.cashChangeFor && (
                <div className="flex justify-between text-[10px]">
                  <span>Troco para:</span>
                  <span>R$ {order.paymentDetails.cashChangeFor.toFixed(2)}</span>
                </div>
              )}
            </div>

            {/* General notes & footer */}
            {order.notes && (
              <div className="text-[10px] bg-amber-100 p-1.5 rounded border border-amber-300">
                <strong>Obs Geral:</strong> {order.notes}
              </div>
            )}

            <div className="text-center pt-2 text-[9px] text-slate-500 space-y-0.5">
              <p>*** SISTEMA TOKIO INBOX 1.0.0 ***</p>
              <p>Impressão Térmica ESC/POS Inteligente</p>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Largura Bobina:</span>
            <select
              value={printerSettings?.paperWidth || '80mm'}
              onChange={(e) =>
                updatePrinterSettings({ paperWidth: e.target.value as '80mm' | '58mm' })
              }
              className="bg-slate-900 border border-slate-800 text-xs text-white rounded-lg px-2 py-1 focus:outline-none"
            >
              <option value="80mm">80mm Padrão</option>
              <option value="58mm">58mm Compacta</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="min-h-[44px] px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-colors"
            >
              Fechar
            </button>

            <button
              onClick={handlePrint}
              disabled={printStep === 'printing'}
              className="min-h-[44px] flex-1 sm:flex-none py-2.5 px-5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 shadow-lg hover:shadow-amber-500/20 transition-all"
            >
              <Printer className="w-4 h-4" />
              <span>
                {printStep === 'printing'
                  ? 'Imprimindo Comanda...'
                  : printStep === 'printed'
                  ? 'Imprimir Novamente'
                  : 'Imprimir Comanda Térmica'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

