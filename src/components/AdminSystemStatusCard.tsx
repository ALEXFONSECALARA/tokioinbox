import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { PowerOff, Rocket, CheckCircle2, AlertTriangle, ShieldAlert } from 'lucide-react';

/**
 * Botão mestre (somente Super Admin): desativa ou reativa TODOS os restaurantes do
 * sistema de uma só vez, com 3 estados possíveis:
 *  - Operando normalmente
 *  - Abrimos em Breve (pré-lançamento)
 *  - Temporariamente Fechado (manutenção, pausa, etc.)
 * Isso bloqueia novos pedidos em toda a plataforma e exibe um aviso para os clientes.
 */
export const AdminSystemStatusCard: React.FC = () => {
  const { restaurants, currentUser, setAllRestaurantsOperationalStatus } = useStore();

  const [pendingAction, setPendingAction] = useState<null | 'aberto' | 'abrimos_em_breve' | 'fechado_temporariamente'>(null);
  const [customMessage, setCustomMessage] = useState('');
  const [confirming, setConfirming] = useState(false);

  if (currentUser?.role !== 'super_admin') return null;

  const restaurantList = Object.values(restaurants || {});
  const statuses = restaurantList.map((r: any) => r.operationalStatus || 'aberto');
  const allSame = statuses.length > 0 && statuses.every((s) => s === statuses[0]);
  const currentGlobalStatus = allSame ? statuses[0] : 'misto';

  const apply = () => {
    if (!pendingAction) return;
    setAllRestaurantsOperationalStatus(pendingAction, customMessage.trim() || undefined);
    setConfirming(false);
    setPendingAction(null);
    setCustomMessage('');
  };

  const statusLabel: Record<string, string> = {
    aberto: 'Operando Normalmente',
    abrimos_em_breve: 'Abrimos em Breve',
    fechado_temporariamente: 'Temporariamente Fechado',
    misto: 'Status Misto (varia por restaurante)',
  };

  const statusColor =
    currentGlobalStatus === 'aberto'
      ? 'text-emerald-400 border-emerald-500/40 bg-emerald-950/30'
      : currentGlobalStatus === 'abrimos_em_breve'
      ? 'text-amber-400 border-amber-500/40 bg-amber-950/30'
      : currentGlobalStatus === 'fechado_temporariamente'
      ? 'text-rose-400 border-rose-500/40 bg-rose-950/30'
      : 'text-slate-300 border-slate-700 bg-slate-900';

  return (
    <div className="bg-slate-900 border border-rose-500/30 rounded-2xl p-5 space-y-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-400 flex items-center justify-center shrink-0">
          <ShieldAlert className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-sm font-black text-white">Status Global do Sistema (Super Admin)</h3>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Ativa/desativa pedidos em <strong>TODOS os restaurantes</strong> do sistema de uma vez. Use para lançamentos,
            manutenção programada ou pausas temporárias.
          </p>
        </div>
      </div>

      <div className={`px-3 py-2 rounded-xl border text-xs font-bold flex items-center gap-2 ${statusColor}`}>
        <span className="w-2 h-2 rounded-full bg-current" />
        Status atual: {statusLabel[currentGlobalStatus] || currentGlobalStatus}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <button
          type="button"
          onClick={() => {
            setPendingAction('aberto');
            setConfirming(true);
          }}
          className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-950/20 hover:bg-emerald-950/40 text-emerald-300 text-xs font-bold flex flex-col items-center gap-1.5 transition-colors"
        >
          <CheckCircle2 className="w-5 h-5" />
          Reativar Sistema
        </button>
        <button
          type="button"
          onClick={() => {
            setPendingAction('abrimos_em_breve');
            setConfirming(true);
          }}
          className="p-3 rounded-xl border border-amber-500/30 bg-amber-950/20 hover:bg-amber-950/40 text-amber-300 text-xs font-bold flex flex-col items-center gap-1.5 transition-colors"
        >
          <Rocket className="w-5 h-5" />
          Abrimos em Breve
        </button>
        <button
          type="button"
          onClick={() => {
            setPendingAction('fechado_temporariamente');
            setConfirming(true);
          }}
          className="p-3 rounded-xl border border-rose-500/30 bg-rose-950/20 hover:bg-rose-950/40 text-rose-300 text-xs font-bold flex flex-col items-center gap-1.5 transition-colors"
        >
          <PowerOff className="w-5 h-5" />
          Fechar Temporariamente
        </button>
      </div>

      {confirming && pendingAction && (
        <div className="p-4 rounded-2xl border border-slate-700 bg-slate-950/60 space-y-3">
          <div className="flex items-start gap-2 text-xs text-slate-300">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <span>
              Confirma aplicar <strong>"{statusLabel[pendingAction]}"</strong> em{' '}
              <strong>todos os {restaurantList.length} restaurantes</strong> do sistema agora?
            </span>
          </div>
          {pendingAction !== 'aberto' && (
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">
                Mensagem para o cliente (opcional)
              </label>
              <input
                type="text"
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                placeholder={
                  pendingAction === 'abrimos_em_breve'
                    ? 'Ex: Estamos quase lá! Abrimos dia 25/09.'
                    : 'Ex: Fechado hoje para manutenção. Voltamos amanhã.'
                }
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={apply}
              className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold"
            >
              Confirmar
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirming(false);
                setPendingAction(null);
              }}
              className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
