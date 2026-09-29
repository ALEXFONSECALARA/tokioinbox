import React from 'react';
import { useStore } from '../context/StoreContext';
import { DEFAULT_SYSTEM_SETTINGS, ReportKind } from '../types/restaurant';
import { ChefHat, FileText, RotateCcw } from 'lucide-react';

const REPORT_KIND_LABELS: Record<ReportKind, string> = {
  dinheiro: 'Dinheiro',
  pix: 'PIX',
  credito: 'Crédito',
  debito: 'Débito',
  delivery: 'Delivery',
  mesa: 'Mesa',
  retirada: 'Retirada',
  balcao: 'Balcão',
  outros: 'Outros',
};

/**
 * V9.2 — Configurações globais editáveis (Ferramentas):
 *  - KDS ativado/desativado (não afeta a impressão);
 *  - tipos pré-selecionados do relatório de venda do fechamento de caixa.
 */
export const AdminSystemSettings: React.FC = () => {
  const { systemSettings, updateSystemSettings, checkPermission, showToast } = useStore();
  const canEdit = checkPermission('can_manage_users') || checkPermission('can_edit_restaurants');

  const guard = (fn: () => void) => {
    if (!canEdit) {
      showToast?.('Sem permissão para alterar configurações do sistema.', 'error');
      return;
    }
    fn();
  };

  const toggleKind = (k: ReportKind) =>
    guard(() => {
      const has = systemSettings.reportKinds.includes(k);
      updateSystemSettings({
        reportKinds: has ? systemSettings.reportKinds.filter((x) => x !== k) : [...systemSettings.reportKinds, k],
      });
    });

  return (
    <div className="space-y-4 mb-6">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
        <div className="flex items-center gap-2">
          <ChefHat className="w-4 h-4 text-amber-400" />
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">KDS — Sistema de Produção</h3>
        </div>
        <button
          type="button"
          onClick={() => guard(() => updateSystemSettings({ kdsEnabled: !systemSettings.kdsEnabled }))}
          className={`w-full sm:w-auto px-4 py-3 rounded-xl border text-xs font-black flex items-center gap-2 ${
            systemSettings.kdsEnabled
              ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/15 border-rose-500/30 text-rose-300'
          }`}
          aria-pressed={systemSettings.kdsEnabled}
        >
          <span>{systemSettings.kdsEnabled ? '☑ KDS ATIVADO' : '☐ KDS DESATIVADO'}</span>
          <span className="font-medium opacity-80">(clique para {systemSettings.kdsEnabled ? 'desativar' : 'ativar'})</span>
        </button>
        <p className="text-[11px] text-slate-400">
          Desativado: o painel de produção não é carregado nem exibido. A <b>impressão por setor (cozinha, sushi bar, bar,
          caixa) continua funcionando normalmente</b>.
        </p>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2">
        <label className="flex items-center gap-2 text-xs font-bold text-white cursor-pointer">
          <input
            type="checkbox"
            checked={systemSettings.requireCashForTables}
            onChange={() => guard(() => updateSystemSettings({ requireCashForTables: !systemSettings.requireCashForTables }))}
          />
          Exigir Caixa aberto para usar as Mesas
        </label>
        <p className="text-[11px] text-slate-400">Com a regra ligada, o servidor também recusa o pagamento de mesa com o Caixa fechado.</p>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">Tipos do relatório de venda</h3>
          </div>
          <button
            type="button"
            onClick={() => guard(() => updateSystemSettings({ reportKinds: DEFAULT_SYSTEM_SETTINGS.reportKinds }))}
            className="text-[11px] px-2 py-1 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 flex items-center gap-1"
          >
            <RotateCcw className="w-3 h-3" /> Restaurar padrão
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(REPORT_KIND_LABELS) as ReportKind[]).map((k) => {
            const on = systemSettings.reportKinds.includes(k);
            return (
              <label
                key={k}
                className={`px-3 py-1.5 rounded-lg border text-xs font-bold cursor-pointer select-none ${
                  on ? 'bg-amber-500/15 border-amber-500/30 text-amber-300' : 'bg-slate-950 border-slate-700 text-slate-400'
                }`}
              >
                <input type="checkbox" className="mr-1.5" checked={on} onChange={() => toggleKind(k)} />
                {REPORT_KIND_LABELS[k]}
              </label>
            );
          })}
        </div>
        <p className="text-[11px] text-slate-400">
          Seleção padrão do relatório impresso no fechamento de caixa. Pode ser alterada a qualquer momento.
        </p>
      </div>
    </div>
  );
};
