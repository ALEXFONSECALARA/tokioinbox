import React, { useState } from 'react';
import { Unlock, DollarSign } from 'lucide-react';
import { useStore } from '../context/StoreContext';

/**
 * Abertura de caixa. Aparece quando NÃO há turno aberto. O turno é compartilhado entre todos os
 * aparelhos (fica no servidor): abrir aqui abre para o restaurante inteiro.
 */
export const OpenCashShiftCard: React.FC = () => {
  const { cashShift, openCashShift, currentUser } = useStore();
  const [amount, setAmount] = useState('');

  if (!cashShift.isClosed) return null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const value = parseFloat(amount.replace(',', '.'));
    if (isNaN(value) || value < 0) return;
    openCashShift(value);
    setAmount('');
  };

  const last = cashShift.finalTotals;

  return (
    <form
      onSubmit={submit}
      className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 sm:p-5 flex flex-col lg:flex-row lg:items-end gap-4"
    >
      <div className="flex-1 space-y-1">
        <h3 className="text-sm font-black text-amber-300 flex items-center gap-2">
          <Unlock className="w-4 h-4" /> Nenhum caixa aberto
        </h3>
        <p className="text-xs text-slate-400">
          Informe o troco inicial da gaveta para abrir o turno
          {currentUser ? <> como <strong className="text-white">{currentUser.name}</strong></> : null}.
        </p>
        {cashShift.closedAt && last && (
          <p className="text-[11px] text-slate-500">
            Último turno encerrado às {cashShift.closedAt} por {cashShift.closedBy}: saldo da gaveta R$ {last.saldoGaveta.toFixed(2)}.
          </p>
        )}
      </div>
      <label className="space-y-1 lg:w-56">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
          <DollarSign className="w-3 h-3" /> Troco inicial (R$)
        </span>
        <input
          type="text"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0,00"
          data-testid="cash-initial-amount"
          className="w-full bg-[#0B0F19] border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-amber-400"
        />
      </label>
      <button
        type="submit"
        data-testid="cash-open-button"
        className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-slate-950 font-black text-sm hover:from-emerald-400"
      >
        Abrir caixa
      </button>
    </form>
  );
};
