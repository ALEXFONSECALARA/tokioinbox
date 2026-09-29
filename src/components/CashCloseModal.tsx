import React, { useMemo, useState } from 'react';
import { Lock, Printer } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { buildCashReport, printCashReport } from '../utils/cashReport';

interface Props {
  onClose: () => void;
  onClosed?: () => void;
}

const money = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`;

/**
 * V9.2 — FECHAR CAIXA: resumo do turno (vendas, cancelamentos, descontos, meios de pagamento,
 * bruto/líquido, esperado × informado × diferença, observação) + IMPRIMIR RELATÓRIO DE VENDA.
 */
export const CashCloseModal: React.FC<Props> = ({ onClose, onClosed }) => {
  const { cashShift, orders, restaurants, currentUser, closeCashShift, systemSettings, showToast } = useStore();
  const [counted, setCounted] = useState('');
  const [note, setNote] = useState('');
  const [print, setPrint] = useState(true);

  const slug = currentUser?.restaurantSlug;
  const report = useMemo(
    () => buildCashReport(cashShift, orders, restaurants, { slug: slug && slug !== 'all' ? slug : 'all' }),
    [cashShift, orders, restaurants, slug]
  );

  const countedNum = counted.trim() === '' ? null : parseFloat(counted.replace(',', '.'));
  const invalid = countedNum !== null && (isNaN(countedNum) || countedNum < 0);
  const diff = countedNum === null || invalid ? null : Number((countedNum - report.expectedCash).toFixed(2));

  const confirm = () => {
    if (invalid) return;
    if (diff !== null && Math.abs(diff) >= 0.01 && !window.confirm(`Há uma diferença de ${money(diff)} entre o esperado e o informado. Fechar mesmo assim?`)) return;
    closeCashShift({
      countedCash: countedNum,
      note,
      salesTotals: {
        dinheiro: report.byPayment.dinheiro.total,
        pix: report.byPayment.pix.total,
        cartao: report.byPayment.credito.total + report.byPayment.debito.total,
      },
    });
    if (print) {
      // relatório final com valor informado/diferença/observação
      const finalReport = {
        ...report,
        to: new Date(),
        closedBy: currentUser?.name,
        countedCash: countedNum,
        difference: diff,
        note: note.trim() || undefined,
      };
      printCashReport(finalReport, systemSettings.reportKinds);
    }
    showToast('Caixa fechado e registrado.', 'success');
    onClosed?.();
    onClose();
  };

  const Row = ({ l, v, b }: { l: string; v: string; b?: boolean }) => (
    <div className={`flex justify-between text-xs ${b ? 'font-black text-white' : 'text-slate-300'}`}>
      <span>{l}</span>
      <span className="font-mono">{v}</span>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[120] bg-black/90 flex items-center justify-center p-3" role="dialog" aria-modal="true">
      <div className="w-full max-w-md max-h-[92dvh] overflow-y-auto bg-[#121622] border border-red-500/40 rounded-3xl p-5 space-y-3 shadow-2xl">
        <h3 className="text-base font-black text-white flex items-center gap-2">
          <Lock className="w-5 h-5 text-red-400" /> Fechar Caixa
        </h3>

        <div className="space-y-1 bg-slate-950 border border-slate-800 rounded-xl p-3">
          <Row l="Pedidos pagos" v={String(report.ordersCount)} />
          <Row l="Cancelamentos" v={`${report.cancelledCount} (${money(report.cancelledTotal)})`} />
          <Row l="Descontos" v={money(report.discounts)} />
          <Row l="Dinheiro" v={`${report.byPayment.dinheiro.count} • ${money(report.byPayment.dinheiro.total)}`} />
          <Row l="PIX" v={`${report.byPayment.pix.count} • ${money(report.byPayment.pix.total)}`} />
          <Row l="Crédito" v={`${report.byPayment.credito.count} • ${money(report.byPayment.credito.total)}`} />
          <Row l="Débito" v={`${report.byPayment.debito.count} • ${money(report.byPayment.debito.total)}`} />
          <Row l="Total bruto" v={money(report.gross)} />
          <Row l="Total líquido" v={money(report.net)} b />
        </div>

        <div className="space-y-1 bg-slate-950 border border-slate-800 rounded-xl p-3">
          <Row l="Fundo inicial" v={money(report.initialAmount)} />
          <Row l="Sangrias" v={`- ${money(report.sangrias)}`} />
          <Row l="Valor esperado na gaveta" v={money(report.expectedCash)} b />
        </div>

        <label className="block space-y-1">
          <span className="text-[11px] font-bold uppercase text-slate-400">Valor informado (contagem da gaveta)</span>
          <input
            inputMode="decimal"
            value={counted}
            onChange={(e) => setCounted(e.target.value)}
            placeholder="0,00"
            className="w-full bg-[#0B0F19] border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white font-mono"
          />
        </label>
        {diff !== null && (
          <p className={`text-xs font-black ${Math.abs(diff) < 0.01 ? 'text-emerald-400' : diff > 0 ? 'text-amber-300' : 'text-rose-400'}`}>
            Diferença: {money(diff)} {Math.abs(diff) < 0.01 ? '(confere)' : diff > 0 ? '(sobra)' : '(falta)'}
          </p>
        )}
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={300}
          placeholder="Observações do fechamento (opcional)"
          className="w-full bg-[#0B0F19] border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white"
        />
        <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
          <input type="checkbox" checked={print} onChange={(e) => setPrint(e.target.checked)} />
          <Printer className="w-3.5 h-3.5" /> Imprimir relatório de venda ao fechar
        </label>

        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 py-2.5 bg-slate-800 text-slate-300 rounded-xl text-xs font-bold">Cancelar</button>
          <button onClick={confirm} disabled={invalid} className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-black disabled:opacity-40">
            Confirmar fechamento
          </button>
        </div>
      </div>
    </div>
  );
};
