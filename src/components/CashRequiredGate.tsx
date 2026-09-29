import React from 'react';
import { Lock } from 'lucide-react';
import { useStore } from '../context/StoreContext';

interface Props {
  children: React.ReactNode;
  onGoToCashier?: () => void;
}

/**
 * V9.2 — Mesas só operam com o CAIXA aberto (regra configurável em Ferramentas).
 * Caixa fechado → mostra "Abra o Caixa para utilizar as mesas.".
 */
export const CashRequiredGate: React.FC<Props> = ({ children, onGoToCashier }) => {
  const { cashShift, systemSettings } = useStore();
  const blocked = systemSettings.requireCashForTables && cashShift.isClosed;
  if (!blocked) return <>{children}</>;
  return (
    <div className="w-full h-full min-h-[60vh] flex items-center justify-center p-6 bg-[#07090E]">
      <div className="max-w-sm text-center space-y-3">
        <div className="mx-auto w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
          <Lock className="w-5 h-5 text-amber-400" />
        </div>
        <p className="text-white font-black text-base">Abra o Caixa para utilizar as mesas.</p>
        <p className="text-xs text-slate-400">O Caixa precisa estar aberto para lançar e receber pelas mesas.</p>
        {onGoToCashier && (
          <button onClick={onGoToCashier} className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 text-xs font-black">
            Ir para o Caixa
          </button>
        )}
      </div>
    </div>
  );
};
