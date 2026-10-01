import React from 'react';
import { Power } from 'lucide-react';
import { useStore } from '../context/StoreContext';

/**
 * Botão para DESATIVAR o Kanban de pedidos (mostrado dentro do próprio Kanban).
 * Desativar só esconde o Kanban — o envio automático aos setores e a impressão
 * continuam funcionando. Para reativar: Ferramentas → Configurações do Sistema.
 * Somente quem pode editar configurações (administrador) vê o botão, porque o
 * servidor só aceita gravar `systemSettings` desses perfis.
 */
export const KanbanToggleButton: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { updateSystemSettings, checkPermission, showToast } = useStore();
  const canEdit = checkPermission('can_manage_users') || checkPermission('can_edit_restaurants');
  if (!canEdit) return null;

  return (
    <button
      type="button"
      onClick={() => {
        if (
          !confirm(
            'Desativar o Kanban de pedidos?\n\nOs pedidos continuam sendo enviados automaticamente para a cozinha, sushi bar e bar, com impressão normal.\nPara reativar: Ferramentas → Configurações do Sistema.'
          )
        )
          return;
        updateSystemSettings({ kanbanEnabled: false });
        showToast?.('Kanban desativado. Os pedidos seguem direto para os setores.', 'info');
      }}
      className={`px-3 py-2 rounded-xl border border-rose-500/40 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-black flex items-center gap-1.5 transition-colors ${className}`}
      title="Desativar o Kanban de pedidos"
    >
      <Power className="w-3.5 h-3.5" />
      <span>Desativar Kanban</span>
    </button>
  );
};
