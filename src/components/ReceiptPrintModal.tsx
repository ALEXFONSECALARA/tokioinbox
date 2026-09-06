import React, { useEffect, useState } from 'react';
import { Order, RestaurantConfig } from '../types';
import { formatCurrency, playSoundEffect } from '../utils/helpers';
import { PrintPortal } from './PrintPortal';
import { PrintableDocument, PrintVariant } from './PrintableDocument';
import { Printer, X, Copy, Check, Download, ChefHat, Bike, Receipt, RefreshCw } from 'lucide-react';

interface ReceiptPrintModalProps {
  order: Order;
  restaurantConfig: RestaurantConfig;
  onClose: () => void;
  printState: 'pendente' | 'imprimindo' | 'impresso' | 'erro';
  onPrintStateChange: (state: 'pendente' | 'imprimindo' | 'impresso' | 'erro') => void;
}

const paymentLabels: Record<string, string> = {
  pix: 'PIX (Pagamento Instantâneo)',
  credit_card: 'Cartão de Crédito na Entrega',
  debit_card: 'Cartão de Débito na Entrega',
  cash: 'Dinheiro na Entrega',
  meal_voucher: 'Vale Refeição (VR / Sodexo)',
};

const VARIANT_LABELS: Record<PrintVariant, { label: string; icon: React.ReactNode }> = {
  kitchen: { label: 'Cozinha', icon: <ChefHat className="w-3.5 h-3.5" /> },
  delivery: { label: 'Entrega', icon: <Bike className="w-3.5 h-3.5" /> },
  customer: { label: 'Cliente (completo)', icon: <Receipt className="w-3.5 h-3.5" /> },
};

export const ReceiptPrintModal: React.FC<ReceiptPrintModalProps> = ({
  order,
  restaurantConfig: config,
  onClose,
  printState,
  onPrintStateChange,
}) => {
  const [copied, setCopied] = useState(false);
  const [variant, setVariant] = useState<PrintVariant>('customer');
  const [paperWidth, setPaperWidth] = useState<'58mm' | '80mm'>(config.printPaperWidth || '80mm');
  // Enquanto isPrinting=true, o conteúdo é montado no PrintPortal (fora do
  // modal) e o navegador abre a caixa de diálogo de impressão real.
  const [isPrinting, setIsPrinting] = useState(false);

  useEffect(() => {
    if (!isPrinting) return;
    // Dá um tick pro portal montar no DOM antes de chamar print().
    const raf = requestAnimationFrame(() => {
      if (typeof window.print !== 'function') {
        setIsPrinting(false);
        onPrintStateChange('erro');
        return;
      }
      try { window.print(); } catch { setIsPrinting(false); onPrintStateChange('erro'); }
    });
    const timeout = window.setTimeout(() => {
      // Alguns navegadores não disparam afterprint quando a caixa é bloqueada.
      // Evita deixar o pedido eternamente em "Imprimindo…".
      setIsPrinting(false);
      onPrintStateChange('erro');
    }, 15000);
    const handleAfterPrint = () => {
      window.clearTimeout(timeout);
      setIsPrinting(false);
      onPrintStateChange('impresso');
    };
    window.addEventListener('afterprint', handleAfterPrint);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(timeout);
      window.removeEventListener('afterprint', handleAfterPrint);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPrinting]);

  const getPlainTextReceipt = (): string => {
    let txt = `========================================\n`;
    txt += `         ${config.name.toUpperCase()}\n`;
    txt += `   ${config.address}\n`;
    txt += `   WhatsApp: ${config.whatsapp}\n`;
    txt += `========================================\n`;
    txt += `PEDIDO #${order.orderNumber} - VIA DE PRODUÇÃO & ENTREGA\n`;
    txt += `Data/Hora: ${new Date(order.createdAt).toLocaleString('pt-BR')}\n`;
    txt += `========================================\n`;
    txt += `DADOS DO CLIENTE:\n`;
    txt += `Nome: ${order.customer.name}\n`;
    txt += `Telefone: ${order.customer.phone}\n`;
    if (order.customer.address) {
      const a = order.customer.address;
      txt += `Endereço: ${a.street}, ${a.number}\n`;
      if (a.unit) txt += `Apto/Bloco: ${a.unit}\n`;
      if (a.complement) txt += `Complemento: ${a.complement}\n`;
      txt += `Bairro: ${a.neighborhood}\n`;
      txt += `Cidade: ${a.city} - CEP: ${a.cep || 'S/N'}\n`;
      if (a.reference) txt += `Ponto de Ref: ${a.reference}\n`;
    }
    txt += `========================================\n`;
    txt += `ITENS DO PEDIDO:\n`;
    order.items.forEach((item) => {
      txt += `${item.quantity}x ${item.menuItem.name} - ${formatCurrency(item.totalPrice)}\n`;
      if (item.selectedChoices.length > 0) {
        txt += `   Opções: ${item.selectedChoices.map((c) => c.optionName).join(', ')}\n`;
      }
      if (item.selectedExtras.length > 0) {
        txt += `   Adicionais: ${item.selectedExtras.map((e) => `${e.quantity}x ${e.name}`).join(', ')}\n`;
      }
      if (item.specialNotes) txt += `   OBS: ${item.specialNotes}\n`;
    });
    txt += `========================================\n`;
    txt += `Subtotal: ${formatCurrency(order.subtotal)}\n`;
    txt += `Taxa de Entrega: ${order.deliveryFee === 0 ? 'GRÁTIS' : formatCurrency(order.deliveryFee)}\n`;
    if (order.discount > 0) txt += `Desconto (${order.couponCode || 'Cupom'}): -${formatCurrency(order.discount)}\n`;
    txt += `TOTAL: ${formatCurrency(order.total)}\n`;
    txt += `========================================\n`;
    txt += `FORMA DE PAGAMENTO: ${paymentLabels[order.paymentMethod] || order.paymentMethod}\n`;
    if (order.paymentMethod === 'cash' && order.cashChangeFor) {
      txt += `Troco para: ${formatCurrency(order.cashChangeFor)} (Levar: ${formatCurrency(order.cashChangeFor - order.total)})\n`;
    }
    if (order.driver) txt += `ENTREGADOR: ${order.driver.name} (${order.driver.vehicle} - ${order.driver.plate || ''})\n`;
    if (order.notes) txt += `OBS GERAIS: ${order.notes}\n`;
    txt += `========================================\n     OBRIGADO PELA PREFERÊNCIA!\n========================================\n`;
    return txt;
  };

  const handleCopyText = () => {
    navigator.clipboard.writeText(getPlainTextReceipt());
    setCopied(true);
    playSoundEffect('beep');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadTxt = () => {
    const element = document.createElement('a');
    const file = new Blob([getPlainTextReceipt()], { type: 'text/plain;charset=utf-8' });
    element.href = URL.createObjectURL(file);
    element.download = `pedido_${order.orderNumber}_${variant}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const handlePrintClick = () => {
    playSoundEffect('beep');
    onPrintStateChange('imprimindo');
    setIsPrinting(true);
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in print:hidden">
        <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[92vh]">
          {/* Header */}
          <div className="bg-stone-900 text-white p-4 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-[var(--brand)] text-slate-950 font-bold">
                <Printer className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm sm:text-base">Imprimir Pedido #{order.orderNumber}</h3>
                <p className="text-xs text-stone-400">Térmica {paperWidth} — Cozinha, Entrega ou Cliente</p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-xl text-stone-400 hover:text-white hover:bg-stone-800 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Seletor de modelo + largura do papel */}
          <div className="p-3 bg-stone-50 border-b border-stone-200 flex flex-wrap items-center gap-2">
            <div className="flex gap-1.5 flex-1">
              {(Object.keys(VARIANT_LABELS) as PrintVariant[]).map((v) => (
                <button
                  key={v}
                  onClick={() => setVariant(v)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                    variant === v ? 'bg-stone-900 text-white' : 'bg-white text-stone-600 border border-stone-200 hover:border-stone-300'
                  }`}
                >
                  {VARIANT_LABELS[v].icon}
                  {VARIANT_LABELS[v].label}
                </button>
              ))}
            </div>
            <div className="flex gap-1 bg-white border border-stone-200 rounded-xl p-0.5">
              {(['58mm', '80mm'] as const).map((w) => (
                <button
                  key={w}
                  onClick={() => setPaperWidth(w)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors ${
                    paperWidth === w ? 'bg-stone-900 text-white' : 'text-stone-500'
                  }`}
                >
                  {w}
                </button>
              ))}
            </div>
          </div>

          {/* Prévia — exatamente o que sai na impressão */}
          <div className="p-4 sm:p-6 overflow-y-auto bg-stone-100 flex-1 flex justify-center">
            <div className="bg-white p-4 rounded-xl shadow-md border border-stone-300 select-text overflow-x-auto">
              <PrintableDocument order={order} config={config} variant={variant} paperWidth={paperWidth} />
            </div>
          </div>

          {/* Botões */}
          <div className="px-4 py-2 border-t border-stone-100 bg-stone-50 flex items-center gap-2 text-[11px] font-bold">
            <span className={`w-2 h-2 rounded-full ${printState === 'impresso' ? 'bg-emerald-500' : printState === 'erro' ? 'bg-rose-500' : printState === 'imprimindo' ? 'bg-amber-500 animate-pulse' : 'bg-stone-400'}`} />
            {printState === 'impresso' ? 'Impresso nesta estação' : printState === 'erro' ? 'Falha ao iniciar impressão — tente novamente' : printState === 'imprimindo' ? 'Aguardando a impressora…' : 'Pendente de impressão'}
          </div>

          <div className="p-4 bg-white border-t border-stone-200 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyText}
                className="px-3 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold flex items-center gap-1.5 transition-all"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'Copiado!' : 'Copiar Texto'}</span>
              </button>
              <button
                onClick={handleDownloadTxt}
                className="px-3 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold flex items-center gap-1.5 transition-all"
              >
                <Download className="w-4 h-4" />
                <span>Baixar .TXT</span>
              </button>
            </div>

            <button
              onClick={handlePrintClick}
              className="px-5 py-2.5 rounded-xl bg-[var(--brand)] hover:bg-[var(--brand-light)] text-slate-950 text-xs font-extrabold flex items-center gap-2 shadow-xs transition-transform active:scale-95"
            >
              {printState === 'imprimindo' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
              <span>{printState === 'imprimindo' ? 'Imprimindo…' : printState === 'impresso' ? 'Reimprimir' : printState === 'erro' ? 'Tentar novamente' : 'Imprimir'} ({VARIANT_LABELS[variant].label})</span>
            </button>
          </div>
        </div>
      </div>

      {/* Só existe no DOM durante o print de verdade — fora do modal acima,
          então nenhum overflow/fixed/flex do modal pode cortar a impressão. */}
      {isPrinting && (
        <PrintPortal>
          <style>{`@page { size: ${paperWidth} auto; margin: 0; }`}</style>
          <PrintableDocument order={order} config={config} variant={variant} paperWidth={paperWidth} />
        </PrintPortal>
      )}
    </>
  );
};
