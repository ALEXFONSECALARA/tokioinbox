import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import {
  Utensils,
  ChefHat,
  Trello,
  Receipt,
  Bike,
  PlusCircle,
  Zap,
  Minimize2,
  Maximize2,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';

interface TesterFloatingBarProps {
  currentView: 'home' | 'menu' | 'admin' | 'courier';
  onNavigateView: (view: 'home' | 'menu' | 'admin' | 'courier', adminTab?: any) => void;
  onOpenManualOrder?: () => void;
}

export const TesterFloatingBar: React.FC<TesterFloatingBarProps> = ({
  currentView,
  onNavigateView,
  onOpenManualOrder,
}) => {
  const { orders, createQuickTestOrder, isOnline, isSyncing } = useStore();
  const [isMinimized, setIsMinimized] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const activeOrdersCount = orders.filter(
    (o) => o.status !== 'entregue' && o.status !== 'cancelado'
  ).length;

  const handleQuickCreate = async (type: 'balcao' | 'mesa' | 'delivery') => {
    if (isCreating) return;
    setIsCreating(true);
    try {
      await createQuickTestOrder(type);
    } finally {
      setIsCreating(false);
    }
  };

  if (isMinimized) {
    return (
      <aside aria-label="Painel de testes minimizado" className="fixed bottom-4 right-4 z-50">
        <button
          id="btn-expand-test-bar"
          onClick={() => setIsMinimized(false)}
          className="px-3.5 py-2 rounded-full bg-[#111622] hover:bg-[#182030] text-[#E3BD6A] border border-[#E3BD6A]/40 shadow-[0_8px_24px_rgba(0,0,0,0.6)] flex items-center gap-2 text-xs font-black transition-all hover:scale-105 active:scale-95"
          title="Abrir barra de atalhos e testes rápidos"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <Sparkles className="w-3.5 h-3.5 text-[#E3BD6A]" />
          <span>Painel de Testes</span>
          <span className="px-1.5 py-0.2 bg-[#E3BD6A]/20 text-[#E3BD6A] text-[10px] rounded-full">
            {activeOrdersCount}
          </span>
          <Maximize2 className="w-3 h-3 text-slate-400 ml-1" />
        </button>
      </aside>
    );
  }

  return (
    <aside
      aria-label="Painel de atalhos e testes"
      className="fixed bottom-3 left-1/2 -translate-x-1/2 z-50 w-[96%] max-w-5xl transition-all"
    >
      <div className="bg-[#0c1017]/95 border border-[#E3BD6A]/40 rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.8)] backdrop-blur-xl p-2.5 sm:px-4 sm:py-2.5 flex flex-col md:flex-row items-center justify-between gap-2.5">
        {/* Esquerda: Status e Indicador do Modo Teste */}
        <div className="flex items-center gap-2.5 w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-md bg-[#E3BD6A]/15 border border-[#E3BD6A]/30 text-[#E3BD6A] text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-[#E3BD6A]" />
              Modo Teste Ativo
            </span>
            <span className="hidden sm:flex items-center gap-1 text-[11px] font-bold text-slate-300">
              <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-400' : 'bg-rose-400'} animate-pulse`} />
              {isSyncing ? 'Sincronizando...' : `${activeOrdersCount} em andamento`}
            </span>
          </div>

          <button
            id="btn-minimize-test-bar"
            onClick={() => setIsMinimized(true)}
            className="md:hidden p-1 text-slate-400 hover:text-white rounded-lg"
            title="Minimizar barra de teste"
          >
            <Minimize2 className="w-4 h-4" />
          </button>
        </div>

        {/* Centro: Navegação Rápida entre Visões */}
        <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap justify-center">
          {/* 1. Cardápio Cliente */}
          <button
            id="btn-test-nav-client"
            onClick={() => onNavigateView('home')}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
              currentView === 'home' || currentView === 'menu'
                ? 'bg-[#E3BD6A] text-black shadow font-black'
                : 'bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Utensils className="w-3.5 h-3.5" />
            <span>Cardápio</span>
          </button>

          {/* 2. Cozinha KDS */}
          <button
            id="btn-test-nav-kds"
            onClick={() => onNavigateView('admin', 'kds')}
            className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-slate-800/80 hover:bg-slate-800 text-amber-300 hover:text-amber-200 flex items-center gap-1.5 transition-all border border-amber-500/20"
          >
            <ChefHat className="w-3.5 h-3.5 text-amber-400" />
            <span>KDS Cozinha</span>
          </button>

          {/* 3. Kanban Operacional */}
          <button
            id="btn-test-nav-kanban"
            onClick={() => onNavigateView('admin', 'kanban')}
            className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-slate-800/80 hover:bg-slate-800 text-cyan-300 hover:text-cyan-200 flex items-center gap-1.5 transition-all border border-cyan-500/20"
          >
            <Trello className="w-3.5 h-3.5 text-cyan-400" />
            <span>Kanban</span>
          </button>

          {/* 4. Caixa & Expedição */}
          <button
            id="btn-test-nav-cashier"
            onClick={() => onNavigateView('admin', 'cashier')}
            className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-slate-800/80 hover:bg-slate-800 text-emerald-300 hover:text-emerald-200 flex items-center gap-1.5 transition-all border border-emerald-500/20"
          >
            <Receipt className="w-3.5 h-3.5 text-emerald-400" />
            <span>Caixa</span>
          </button>

          {/* 5. Portal Entregador */}
          <button
            id="btn-test-nav-courier"
            onClick={() => onNavigateView('courier')}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
              currentView === 'courier'
                ? 'bg-purple-600 text-white font-black'
                : 'bg-slate-800/80 text-purple-300 hover:bg-slate-800 border border-purple-500/20'
            }`}
          >
            <Bike className="w-3.5 h-3.5 text-purple-400" />
            <span>Entregador</span>
          </button>
        </div>

        {/* Direita: Gerador de Pedidos Teste com 1 Clique */}
        <div className="flex items-center gap-1.5 w-full md:w-auto justify-end">
          <span className="text-[11px] text-slate-400 font-bold hidden lg:inline mr-1">
            + Gerar Teste:
          </span>

          <button
            id="btn-quick-balcao"
            disabled={isCreating}
            onClick={() => handleQuickCreate('balcao')}
            className="px-2 py-1 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 disabled:opacity-50"
            title="Criar pedido com Senha de Retirada no Balcão"
          >
            <Zap className="w-3 h-3 text-amber-400" />
            <span>Balcão</span>
          </button>

          <button
            id="btn-quick-mesa"
            disabled={isCreating}
            onClick={() => handleQuickCreate('mesa')}
            className="px-2 py-1 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-300 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 disabled:opacity-50"
            title="Criar pedido para Mesa no Salão"
          >
            <Zap className="w-3 h-3 text-cyan-400" />
            <span>Mesa</span>
          </button>

          <button
            id="btn-quick-delivery"
            disabled={isCreating}
            onClick={() => handleQuickCreate('delivery')}
            className="px-2 py-1 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/40 text-purple-300 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 disabled:opacity-50"
            title="Criar pedido para Entrega Delivery"
          >
            <Zap className="w-3 h-3 text-purple-400" />
            <span>Delivery</span>
          </button>

          <button
            id="btn-minimize-test-bar-desktop"
            onClick={() => setIsMinimized(true)}
            className="hidden md:flex p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors ml-1"
            title="Minimizar barra"
          >
            <Minimize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
};
