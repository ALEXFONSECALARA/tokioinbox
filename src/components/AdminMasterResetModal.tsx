import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { Trash2, AlertTriangle, ShieldAlert, Lock, X } from 'lucide-react';

interface AdminMasterResetModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AdminMasterResetModal: React.FC<AdminMasterResetModalProps> = ({ isOpen, onClose }) => {
  const { masterResetOrders, currentUser, orders } = useStore();
  const [confirmationInput, setConfirmationInput] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const isAuthorized = currentUser?.role === 'super_admin';
  const REQUIRED_PHRASE = 'RESETAR PEDIDOS';

  const handleExecuteReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (confirmationInput !== REQUIRED_PHRASE) {
      setErrorMsg(`Digite exatamente "${REQUIRED_PHRASE}" para confirmar.`);
      return;
    }

    setIsResetting(true);
    setErrorMsg(null);

    try {
      const res = await masterResetOrders(confirmationInput);
      alert(`Sucesso! ${res.message}`);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Falha ao executar o Reset Mestre.');
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn text-slate-100">
      <div className="bg-[#141720] border-2 border-red-500/60 rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl space-y-6 relative overflow-hidden">
        {/* Top Danger Accent Ribbon */}
        <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-red-600 via-rose-500 to-red-600 animate-pulse" />

        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-red-500/20 text-red-400 border border-red-500/40 flex items-center justify-center shadow-lg">
              <ShieldAlert className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-white tracking-wide">
                RESET MESTRE DE PEDIDOS
              </h3>
              <span className="text-[10px] bg-red-500/20 text-red-300 font-bold px-2 py-0.5 rounded border border-red-500/30 uppercase">
                Ação Irreversível • Super Admin
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800/60 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Warning Details */}
        <div className="bg-red-950/40 border border-red-900/60 rounded-2xl p-4 text-xs text-red-200 space-y-2">
          <div className="flex items-center gap-2 font-bold text-red-300">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <span>ATENÇÃO: Operação Destrutiva Definitiva</span>
          </div>
          <p className="text-slate-300 leading-relaxed">
            Esta operação irá apagar permanentemente <strong>todos os {orders.length} pedidos</strong>{' '}
            gravados no servidor e na base de dados de todos os 4 restaurantes, limpando filas de
            cozinha KDS, entregas e relatórios operacionais.
          </p>
          <p className="text-[11px] text-slate-400">
            A ação será registrada no <strong>Log de Auditoria</strong> com a identificação do operador:{' '}
            <strong className="text-white">@{currentUser?.username}</strong> ({currentUser?.name}).
          </p>
        </div>

        {!isAuthorized ? (
          <div className="bg-slate-900 p-4 rounded-xl text-center text-xs text-rose-400 font-bold">
            Acesso Negado: Apenas usuários com a função &quot;Super Admin&quot; podem executar o Reset Mestre.
          </div>
        ) : (
          <form onSubmit={handleExecuteReset} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Digite <span className="text-red-400 font-mono font-black">{REQUIRED_PHRASE}</span> para
                autorizar:
              </label>
              <input
                type="text"
                required
                value={confirmationInput}
                onChange={(e) => {
                  setConfirmationInput(e.target.value);
                  setErrorMsg(null);
                }}
                placeholder={REQUIRED_PHRASE}
                className="w-full bg-[#0B0D12] border-2 border-red-900/80 focus:border-red-500 rounded-xl px-4 py-2.5 text-white font-mono text-center tracking-widest text-sm focus:outline-none uppercase"
              />
            </div>

            {errorMsg && (
              <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-xl font-bold">
                {errorMsg}
              </p>
            )}

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isResetting}
                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={confirmationInput !== REQUIRED_PHRASE || isResetting}
                className="flex-1 py-3 bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 disabled:opacity-40 text-white font-black text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isResetting ? 'Apagando Pedidos...' : 'Executar Reset Mestre'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
