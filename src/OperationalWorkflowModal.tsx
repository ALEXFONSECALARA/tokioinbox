import React, { useMemo } from 'react';
import { useStore } from '../context/StoreContext';
import { OperationalEnvironment } from './EnvironmentBar';
import {
  Users,
  Utensils,
  Store,
  Truck,
  Wallet,
  Flame,
  Fish,
  Beer,
  Settings,
  X,
  ChevronRight,
  ArrowRight,
  ExternalLink,
  CheckCircle2,
  Clock,
  Sparkles,
  Bot,
  QrCode,
  Layers,
  ShieldCheck,
  UserCheck,
  Receipt,
  Bike,
  Activity,
  DollarSign,
  TrendingUp,
} from 'lucide-react';

interface OperationalWorkflowModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (env: OperationalEnvironment, subOption?: string) => void;
}

export const OperationalWorkflowModal: React.FC<OperationalWorkflowModalProps> = ({
  isOpen,
  onClose,
  onNavigate,
}) => {
  const { orders, menuItems, restaurants, activeRestaurantSlug } = useStore();

  const activeOrders = useMemo(() => {
    return orders.filter((o) => o.status !== 'entregue' && o.status !== 'cancelado');
  }, [orders]);

  const stats = useMemo(() => {
    const mesaOrders = activeOrders.filter((o) => o.orderType === 'mesa');
    const balcaoOrders = activeOrders.filter((o) => o.orderType === 'balcao');
    const deliveryOrders = activeOrders.filter((o) => o.orderType === 'delivery');
    const retiradaOrders = activeOrders.filter((o) => o.orderType === 'retirada');

    let cozinhaPending = 0;
    let sushibarPending = 0;
    let barPending = 0;

    activeOrders.forEach((o) => {
      (o.items || []).forEach((item) => {
        const cat = (item.name || '').toLowerCase();
        if (cat.includes('sushi') || cat.includes('sashimi') || cat.includes('temaki') || cat.includes('uramaki')) {
          sushibarPending += item.quantity || 1;
        } else if (cat.includes('drink') || cat.includes('chopp') || cat.includes('suco') || cat.includes('cerveja') || cat.includes('refrigerante')) {
          barPending += item.quantity || 1;
        } else {
          cozinhaPending += item.quantity || 1;
        }
      });
    });

    return {
      mesasAtivas: mesaOrders.length,
      balcaoAtivos: balcaoOrders.length,
      deliveryAtivos: deliveryOrders.length + retiradaOrders.length,
      cozinhaPending,
      sushibarPending,
      barPending,
      totalCardapio: menuItems.length,
    };
  }, [activeOrders, menuItems]);

  if (!isOpen) return null;

  return (
    <div
      id="modal-operational-workflow"
      className="modal-viewport fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/95 backdrop-blur-md overflow-y-auto animate-fadeIn"
      onClick={onClose}
    >
      <div
        id="card-operational-workflow-dialog"
        className="bg-[#0B0F19] border border-slate-700/80 rounded-3xl max-w-6xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-[#0F1422] border-b border-slate-800 px-6 py-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-white tracking-tight uppercase">
                  Arquitetura &amp; Fluxos Operacionais
                </h2>
                <span className="bg-amber-500/20 text-amber-300 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-amber-500/30 uppercase">
                  7 Pilares Integrados
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Mapeamento visual da operação do restaurante ponta a ponta com acesso imediato a cada etapa.
              </p>
            </div>
          </div>

          <button
            id="btn-close-operational-modal"
            onClick={onClose}
            className="w-10 h-10 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center border border-slate-700 transition-colors"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body - 7 Pillars */}
        <div className="p-6 overflow-y-auto space-y-4 max-h-[calc(92vh-90px)] no-scrollbar">
          {/* 1. SALÃO */}
          <div
            id="pillar-salao"
            className="bg-[#121724] border border-amber-500/30 hover:border-amber-500/60 rounded-2xl p-5 transition-all shadow-md group"
          >
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-400 shrink-0">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black text-amber-400 uppercase tracking-wider">
                      🏠 SALÃO
                    </span>
                    <span className="text-xs text-slate-400 font-medium">
                      Atendimento presencial nas mesas
                    </span>
                  </div>
                  <div className="text-xs text-slate-300 flex items-center gap-2 font-mono mt-0.5">
                    <span className="text-white font-bold">{stats.mesasAtivas}</span> mesas com pedidos ativos
                  </div>
                </div>
              </div>

              {/* Pipeline Step Badges */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  id="btn-step-mesas"
                  onClick={() => {
                    onNavigate('pdv');
                    onClose();
                  }}
                  className="px-3 py-1.5 rounded-xl bg-[#1A2133] hover:bg-amber-500/20 text-slate-200 hover:text-amber-300 border border-slate-700 hover:border-amber-500/50 text-xs font-bold transition-all flex items-center gap-1.5"
                >
                  <span>1. Mesas</span>
                  <ArrowRight className="w-3.5 h-3.5 text-amber-400" />
                </button>

                <button
                  id="btn-step-garcom"
                  onClick={() => {
                    onNavigate('pdv');
                    onClose();
                  }}
                  className="px-3 py-1.5 rounded-xl bg-[#1A2133] hover:bg-amber-500/20 text-slate-200 hover:text-amber-300 border border-slate-700 hover:border-amber-500/50 text-xs font-bold transition-all flex items-center gap-1.5"
                >
                  <UserCheck className="w-3.5 h-3.5 text-amber-400" />
                  <span>2. Garçom</span>
                  <ArrowRight className="w-3.5 h-3.5 text-amber-400" />
                </button>

                <button
                  id="btn-step-pdv-touch"
                  onClick={() => {
                    onNavigate('pdv');
                    onClose();
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black transition-all flex items-center gap-1.5 shadow"
                >
                  <span>3. PDV Touch</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* 2. CLIENTE */}
          <div
            id="pillar-cliente"
            className="bg-[#121724] border border-emerald-500/30 hover:border-emerald-500/60 rounded-2xl p-5 transition-all shadow-md group"
          >
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400 shrink-0">
                  <Utensils className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black text-emerald-400 uppercase tracking-wider">
                      👤 CLIENTE
                    </span>
                    <span className="text-xs text-slate-400 font-medium">
                      Autoatendimento na mesa via celular
                    </span>
                  </div>
                  <div className="text-xs text-slate-300 font-mono mt-0.5">
                    {stats.totalCardapio} itens no cardápio online
                  </div>
                </div>
              </div>

              {/* Pipeline Step Badges */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  id="btn-step-qr-mesa"
                  onClick={() => {
                    onNavigate('cliente', 'qr');
                    onClose();
                  }}
                  className="px-3 py-1.5 rounded-xl bg-[#1A2133] hover:bg-emerald-500/20 text-slate-200 hover:text-emerald-300 border border-slate-700 hover:border-emerald-500/50 text-xs font-bold transition-all flex items-center gap-1.5"
                >
                  <QrCode className="w-3.5 h-3.5 text-emerald-400" />
                  <span>1. QR da Mesa</span>
                  <ArrowRight className="w-3.5 h-3.5 text-emerald-400" />
                </button>

                <button
                  id="btn-step-cardapio-digital"
                  onClick={() => {
                    onNavigate('cliente', 'menu');
                    onClose();
                  }}
                  className="px-3 py-1.5 rounded-xl bg-[#1A2133] hover:bg-emerald-500/20 text-slate-200 hover:text-emerald-300 border border-slate-700 hover:border-emerald-500/50 text-xs font-bold transition-all flex items-center gap-1.5"
                >
                  <span>2. Cardápio</span>
                  <ArrowRight className="w-3.5 h-3.5 text-emerald-400" />
                </button>

                <button
                  id="btn-step-pedido-cliente"
                  onClick={() => {
                    onNavigate('cliente', 'tracker');
                    onClose();
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black transition-all flex items-center gap-1.5 shadow"
                >
                  <span>3. Pedido</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* 3. BALCÃO */}
          <div
            id="pillar-balcao"
            className="bg-[#121724] border border-sky-500/30 hover:border-sky-500/60 rounded-2xl p-5 transition-all shadow-md group"
          >
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-sky-400 shrink-0">
                  <Store className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black text-sky-400 uppercase tracking-wider">
                      🚶 BALCÃO
                    </span>
                    <span className="text-xs text-slate-400 font-medium">
                      Atendimento rápido e retirada com senha
                    </span>
                  </div>
                  <div className="text-xs text-slate-300 font-mono mt-0.5">
                    <span className="text-white font-bold">{stats.balcaoAtivos}</span> pedidos no balcão hoje
                  </div>
                </div>
              </div>

              {/* Pipeline Step Badges */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  id="btn-step-balcao-pdv"
                  onClick={() => {
                    onNavigate('balcao');
                    onClose();
                  }}
                  className="px-3 py-1.5 rounded-xl bg-[#1A2133] hover:bg-sky-500/20 text-slate-200 hover:text-sky-300 border border-slate-700 hover:border-sky-500/50 text-xs font-bold transition-all flex items-center gap-1.5"
                >
                  <span>1. PDV Touch</span>
                  <ArrowRight className="w-3.5 h-3.5 text-sky-400" />
                </button>

                <button
                  id="btn-step-balcao-senha"
                  onClick={() => {
                    onNavigate('balcao');
                    onClose();
                  }}
                  className="px-3 py-1.5 rounded-xl bg-[#1A2133] hover:bg-sky-500/20 text-slate-200 hover:text-sky-300 border border-slate-700 hover:border-sky-500/50 text-xs font-bold transition-all flex items-center gap-1.5"
                >
                  <Receipt className="w-3.5 h-3.5 text-sky-400" />
                  <span>2. Senha</span>
                  <ArrowRight className="w-3.5 h-3.5 text-sky-400" />
                </button>

                <button
                  id="btn-step-balcao-pedido"
                  onClick={() => {
                    onNavigate('balcao');
                    onClose();
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-black transition-all flex items-center gap-1.5 shadow"
                >
                  <span>3. Pedido</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* 4. DELIVERY */}
          <div
            id="pillar-delivery"
            className="bg-[#121724] border border-emerald-600/30 hover:border-emerald-500/60 rounded-2xl p-5 transition-all shadow-md group"
          >
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-emerald-600/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black text-emerald-400 uppercase tracking-wider">
                      🚚 DELIVERY
                    </span>
                    <span className="text-xs text-slate-400 font-medium">
                      Vendas online, entregas e motoboys
                    </span>
                  </div>
                  <div className="text-xs text-slate-300 font-mono mt-0.5">
                    <span className="text-white font-bold">{stats.deliveryAtivos}</span> entregas em andamento
                  </div>
                </div>
              </div>

              {/* Pipeline Step Badges */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  id="btn-step-pedidos-online"
                  onClick={() => {
                    onNavigate('delivery');
                    onClose();
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-[#1A2133] hover:bg-emerald-500/20 text-slate-200 hover:text-emerald-300 border border-slate-700 hover:border-emerald-500/50 text-xs font-bold transition-all flex items-center gap-1.5"
                >
                  <span>1. Pedidos Online</span>
                  <ArrowRight className="w-3.5 h-3.5 text-emerald-400" />
                </button>

                <button
                  id="btn-step-entrega-courier"
                  onClick={() => {
                    onNavigate('delivery');
                    onClose();
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black transition-all flex items-center gap-1.5 shadow"
                >
                  <Bike className="w-3.5 h-3.5" />
                  <span>2. Entrega</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* 5. CAIXA */}
          <div
            id="pillar-caixa"
            className="bg-[#121724] border border-yellow-500/30 hover:border-yellow-500/60 rounded-2xl p-5 transition-all shadow-md group"
          >
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-yellow-500/20 border border-yellow-400/40 flex items-center justify-center text-yellow-400 shrink-0">
                  <Wallet className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black text-yellow-400 uppercase tracking-wider">
                      💰 CAIXA
                    </span>
                    <span className="text-xs text-slate-400 font-medium">
                      Recebimentos, conciliação e turno
                    </span>
                  </div>
                  <div className="text-xs text-slate-300 font-mono mt-0.5">
                    Terminal ativo com PIX, Débito, Crédito e Dinheiro
                  </div>
                </div>
              </div>

              {/* Pipeline Step Badges */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  id="btn-step-caixa-pagamentos"
                  onClick={() => {
                    onNavigate('caixa');
                    onClose();
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-[#1A2133] hover:bg-yellow-500/20 text-slate-200 hover:text-yellow-300 border border-slate-700 hover:border-yellow-500/50 text-xs font-bold transition-all flex items-center gap-1.5"
                >
                  <DollarSign className="w-3.5 h-3.5 text-yellow-400" />
                  <span>1. Pagamentos</span>
                  <ArrowRight className="w-3.5 h-3.5 text-yellow-400" />
                </button>

                <button
                  id="btn-step-caixa-fechamento"
                  onClick={() => {
                    onNavigate('caixa');
                    onClose();
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-yellow-500 hover:bg-yellow-400 text-slate-950 text-xs font-black transition-all flex items-center gap-1.5 shadow"
                >
                  <span>2. Fechamento</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* 6. PRODUÇÃO */}
          <div
            id="pillar-producao"
            className="bg-[#121724] border border-orange-500/30 hover:border-orange-500/60 rounded-2xl p-5 transition-all shadow-md group"
          >
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-orange-500/20 border border-orange-400/40 flex items-center justify-center text-orange-400 shrink-0">
                  <Flame className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black text-orange-400 uppercase tracking-wider">
                      👨‍🍳 PRODUÇÃO (KDS)
                    </span>
                    <span className="text-xs text-slate-400 font-medium">
                      Roteamento automático por praça de preparo
                    </span>
                  </div>
                  <div className="text-xs text-slate-300 font-mono mt-0.5">
                    Telas operacionais dedicadas com timer e alertas sonoros
                  </div>
                </div>
              </div>

              {/* 3 Production Stations */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  id="btn-station-cozinha"
                  onClick={() => {
                    onNavigate('cozinha');
                    onClose();
                  }}
                  className="px-3 py-1.5 rounded-xl bg-orange-500/15 hover:bg-orange-500 text-orange-300 hover:text-slate-950 border border-orange-500/40 text-xs font-black transition-all flex items-center gap-1.5"
                >
                  <Flame className="w-3.5 h-3.5" />
                  <span>Cozinha ({stats.cozinhaPending})</span>
                </button>

                <button
                  id="btn-station-sushibar"
                  onClick={() => {
                    onNavigate('sushibar');
                    onClose();
                  }}
                  className="px-3 py-1.5 rounded-xl bg-teal-500/15 hover:bg-teal-500 text-teal-300 hover:text-slate-950 border border-teal-500/40 text-xs font-black transition-all flex items-center gap-1.5"
                >
                  <Fish className="w-3.5 h-3.5" />
                  <span>SushiBar ({stats.sushibarPending})</span>
                </button>

                <button
                  id="btn-station-bar"
                  onClick={() => {
                    onNavigate('bar');
                    onClose();
                  }}
                  className="px-3 py-1.5 rounded-xl bg-purple-500/15 hover:bg-purple-500 text-purple-300 hover:text-slate-950 border border-purple-500/40 text-xs font-black transition-all flex items-center gap-1.5"
                >
                  <Beer className="w-3.5 h-3.5" />
                  <span>Bar ({stats.barPending})</span>
                </button>
              </div>
            </div>
          </div>

          {/* 7. ADMIN */}
          <div
            id="pillar-admin"
            className="bg-[#121724] border border-indigo-500/30 hover:border-indigo-500/60 rounded-2xl p-5 transition-all shadow-md group"
          >
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-indigo-500/20 border border-indigo-400/40 flex items-center justify-center text-indigo-400 shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black text-indigo-400 uppercase tracking-wider">
                      ⚙️ ADMIN
                    </span>
                    <span className="text-xs text-slate-400 font-medium">
                      Gestão completa e inteligência do negócio
                    </span>
                  </div>
                  <div className="text-xs text-slate-300 font-mono mt-0.5">
                    Controle de cardápio, usuários, métricas e motor de IA
                  </div>
                </div>
              </div>

              {/* Admin 5 Direct Steps */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  id="btn-admin-configuracoes"
                  onClick={() => {
                    onNavigate('admin', 'settings');
                    onClose();
                  }}
                  className="px-2.5 py-1.5 rounded-xl bg-[#1A2133] hover:bg-indigo-500/20 text-slate-300 hover:text-white border border-slate-700 hover:border-indigo-400 text-xs font-bold transition-all flex items-center gap-1"
                >
                  <Settings className="w-3 h-3 text-indigo-400" />
                  <span>Configurações</span>
                </button>

                <button
                  id="btn-admin-cardapio"
                  onClick={() => {
                    onNavigate('admin', 'menu');
                    onClose();
                  }}
                  className="px-2.5 py-1.5 rounded-xl bg-[#1A2133] hover:bg-indigo-500/20 text-slate-300 hover:text-white border border-slate-700 hover:border-indigo-400 text-xs font-bold transition-all flex items-center gap-1"
                >
                  <Utensils className="w-3 h-3 text-indigo-400" />
                  <span>Cardápio</span>
                </button>

                <button
                  id="btn-admin-usuarios"
                  onClick={() => {
                    onNavigate('admin', 'users');
                    onClose();
                  }}
                  className="px-2.5 py-1.5 rounded-xl bg-[#1A2133] hover:bg-indigo-500/20 text-slate-300 hover:text-white border border-slate-700 hover:border-indigo-400 text-xs font-bold transition-all flex items-center gap-1"
                >
                  <Users className="w-3 h-3 text-indigo-400" />
                  <span>Usuários</span>
                </button>

                <button
                  id="btn-admin-relatorios"
                  onClick={() => {
                    onNavigate('admin', 'dashboard');
                    onClose();
                  }}
                  className="px-2.5 py-1.5 rounded-xl bg-[#1A2133] hover:bg-indigo-500/20 text-slate-300 hover:text-white border border-slate-700 hover:border-indigo-400 text-xs font-bold transition-all flex items-center gap-1"
                >
                  <TrendingUp className="w-3 h-3 text-indigo-400" />
                  <span>Relatórios</span>
                </button>

                <button
                  id="btn-admin-ia"
                  onClick={() => {
                    onNavigate('admin', 'ai_engine');
                    onClose();
                  }}
                  className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black transition-all flex items-center gap-1 shadow"
                >
                  <Bot className="w-3 h-3" />
                  <span>IA</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-[#0B0F19] border-t border-slate-800 px-6 py-3.5 flex items-center justify-between text-xs text-slate-400">
          <span className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#E3BD6A]" />
            Sistema Integrado Tokio Rest • Dados em sincronia tempo real
          </span>
          <button
            id="btn-footer-close-modal"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
