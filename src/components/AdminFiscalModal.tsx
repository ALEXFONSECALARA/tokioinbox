import React from 'react';
import { X, FileText } from 'lucide-react';
import { Order } from '../types/restaurant';

interface AdminFiscalModalProps {
  isOpen: boolean;
  order: Order;
  restaurantSlug: string;
  onClose: () => void;
}

/** Emissão fiscal deliberadamente desativada nesta versão. */
export const AdminFiscalModal: React.FC<AdminFiscalModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-viewport fixed inset-0 z-[80] bg-black/95 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-md max-h-[92vh] overflow-y-auto my-auto rounded-3xl border border-amber-500/30 bg-[#0E121B] p-6 shadow-2xl">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center border border-amber-500/25">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white">Emissão fiscal desativada</h3>
              <p className="text-[11px] text-slate-400">Esta instalação opera sem nota fiscal.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl bg-slate-900 text-slate-400 hover:text-white" aria-label="Fechar">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="mt-5 text-xs leading-relaxed text-slate-300">Os pedidos continuam funcionando normalmente. Não há emissão, consulta, cancelamento ou impressão de NFC-e/NF-e nesta versão.</p>
        <button onClick={onClose} className="mt-5 w-full py-3 rounded-xl bg-amber-500 text-slate-950 text-xs font-black">Fechar</button>
      </div>
    </div>
  );
};
