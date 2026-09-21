import React from 'react';
import { AdminLayout } from '../../components/AdminLayout';

interface AdminModuleProps {
  onBackToApp?: () => void;
  initialTab?: any;
}

/**
 * MÓDULO 7: ADMIN / RETAGUARDA / GESTÃO ESTRATÉGICA
 * Painel administrativo centralizado com as 6 categorias canônicas:
 * - OPERAÇÃO (Kanban Central, KDS Cozinha/Bar, Expedição Delivery, Caixa / PDV)
 * - CARDÁPIO (Produtos, Categorias, CMV & Ficha Técnica, Vitrine Multi-Restaurantes)
 * - EQUIPE (Garçons, Motoboys, Permissões de Acesso e Auditoria de Ações)
 * - GESTÃO (Relatórios Financeiros, DRE, Fechamento de Caixa, Clientes & CRM)
 * - INTELIGÊNCIA (IA Assistente de Vendas, Motor de Promoções, Nexoro AI Engine)
 * - SISTEMA (Configurações, Canais de Venda, Impressoras Térmicas, Backup & Saúde)
 */
export const AdminModule: React.FC<AdminModuleProps> = ({ onBackToApp, initialTab }) => {
  return (
    <div className="w-full h-full min-h-screen bg-[#07090E]">
      <AdminLayout onBackToApp={onBackToApp} initialTab={initialTab} />
    </div>
  );
};
