import React, { useEffect, useRef, useState } from 'react';
import {
  Utensils,
  Flame,
  Beer,
  Fish,
  ShieldCheck,
  UserCheck,
  Truck,
  Wallet,
  Store,
  Kanban,
  Activity,
  Layers,
  ChevronDown,
  Wrench,
  Percent,
  Printer,
  QrCode,
  Send,
  Receipt,
} from 'lucide-react';
import { OperationalWorkflowModal } from './OperationalWorkflowModal';
import { useStore } from '../context/StoreContext';
import { UserPermissions } from '../types/restaurant';
import { isAreaEnabledByChannels } from '../painel/access';

export type OperationalEnvironment =
  | 'cliente'
  | 'pdv'
  | 'balcao'
  | 'delivery'
  | 'kanban'
  | 'cozinha'
  | 'sushibar'
  | 'bar'
  | 'caixa'
  | 'admin';

interface EnvironmentBarProps {
  currentEnvironment: OperationalEnvironment;
  onSelectEnvironment: (env: OperationalEnvironment, subOption?: string) => void;
  className?: string;
  condensed?: boolean;
}

export const EnvironmentBar: React.FC<EnvironmentBarProps> = ({
  currentEnvironment,
  onSelectEnvironment,
  className = '',
  condensed = false,
}) => {
  const { currentUser, salesChannels, systemSettings, updateSystemSettings } = useStore();
  const [isWorkflowModalOpen, setIsWorkflowModalOpen] = useState(false);

  // FERRAMENTAS DO SALÃO (topo): menu suspenso com tudo que o salão usa no dia a dia.
  // Fica "fixed" (calculado a partir do botão) porque a barra rola na horizontal e um
  // menu absoluto seria cortado pelo overflow.
  const [salaoMenu, setSalaoMenu] = useState<{ top: number; left: number } | null>(null);
  const salaoBtnRef = useRef<HTMLButtonElement | null>(null);
  const salaoMenuRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!salaoMenu) return;
    const close = (e: Event) => {
      const t = e.target as Node;
      if (salaoMenuRef.current?.contains(t) || salaoBtnRef.current?.contains(t)) return;
      setSalaoMenu(null);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setSalaoMenu(null);
    const onResize = () => setSalaoMenu(null);
    document.addEventListener('mousedown', close);
    document.addEventListener('touchstart', close);
    document.addEventListener('keydown', esc);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('touchstart', close);
      document.removeEventListener('keydown', esc);
      window.removeEventListener('resize', onResize);
    };
  }, [salaoMenu]);

  // Perfis e áreas liberadas seguem exatamente os nomes do servidor (ver painel/access.ts).
  // Sem usuário logado nada é exibido: esta barra só existe dentro do painel autenticado.
  const role = currentUser?.role;
  const permissions = (currentUser?.permissions || {}) as Partial<UserPermissions>;
  const canUse = (area: string) => {
    if (!role) return false;
    switch (area) {
      case 'pdv':
      case 'balcao': return Boolean(permissions.can_create_orders);
      case 'delivery':
      case 'kanban': return Boolean(permissions.can_view_orders);
      case 'caixa': return Boolean(permissions.can_view_orders && permissions.can_change_status);
      case 'cozinha':
      case 'sushibar':
      case 'bar':
        return Boolean(permissions.can_view_orders && permissions.can_change_status);
      case 'admin': return Boolean(permissions.can_manage_users || permissions.can_manage_permissions || role === 'super_admin' || role === 'administrador');
      default: return false;
    }
  };
  // V9 ULTRA PLUS: ferramentas desativadas (canal de venda desligado) ficam ocultas.
  const canAccessPdv = canUse('pdv') && isAreaEnabledByChannels('pdv', salesChannels);
  const canAccessCliente = Boolean(role) && (salesChannels?.mesa?.enabled !== false || salesChannels?.online?.enabled !== false); // abre o cardápio público em outra tela
  const canAccessBalcao = canUse('balcao') && isAreaEnabledByChannels('balcao', salesChannels);
  const canAccessDelivery = canUse('delivery') && isAreaEnabledByChannels('delivery', salesChannels);
  const canAccessCaixa = canUse('caixa');
  const canAccessProducao = systemSettings.kdsEnabled && (canUse('cozinha') || canUse('sushibar') || canUse('bar'));
  const canAccessAdmin = canUse('admin');
  const canAccessKanban = systemSettings.kanbanEnabled && canUse('kanban');

  // Check if current view is a production station
  const isProducaoActive =
    currentEnvironment === 'cozinha' ||
    currentEnvironment === 'sushibar' ||
    currentEnvironment === 'bar';

  return (
    <>
      <div
        id="environment-bar-container"
        className={`bg-[#0B0F19] border-b border-slate-800/80 px-3 py-1.5 flex items-center justify-between gap-2 overflow-x-auto no-scrollbar select-none z-30 ${className}`}
      >
        <div className="flex items-center gap-1.5 min-w-max mx-auto">
          {/* Label indicator */}
          <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500 px-2 hidden 2xl:inline-block">
            FLUXO OPERACIONAL:
          </span>

          {/* UNIFICADO: SALÃO & CAIXA — Mesas, Fechamento, Pagamento, Placas QR e ferramentas, tudo junto no topo */}
          {(canAccessPdv || canAccessCaixa || canAccessAdmin) && (
            <div
              id="env-group-salao-caixa"
              className="flex items-stretch gap-1 p-1 rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-500/5 to-yellow-500/5"
              role="group"
              aria-label="Salão e Caixa"
            >
              <span className="hidden 2xl:flex items-center px-1.5 text-[9px] font-black uppercase tracking-widest text-amber-400/80 select-none">
                Salão &amp; Caixa
              </span>
          {/* 1. 🏠 SALÃO (Mesas → Garçom → PDV Touch) */}
          {canAccessPdv && (
            <button
              id="env-btn-salao"
              type="button"
              onClick={() => onSelectEnvironment('pdv')}
              className={`min-h-[42px] px-3 py-1.5 rounded-xl border flex items-center gap-2 transition-all active:scale-95 cursor-pointer whitespace-nowrap text-left ${
                currentEnvironment === 'pdv'
                  ? 'bg-gradient-to-r from-amber-500 to-amber-400 text-slate-950 font-black border-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.5)]'
                  : 'bg-[#121724] border-slate-800 text-slate-300 hover:text-white hover:bg-[#181F30] hover:border-slate-700'
              }`}
              title="🏠 SALÃO: Mesas → Garçom → PDV Touch"
            >
              <UserCheck
                className={`w-4 h-4 shrink-0 ${
                  currentEnvironment === 'pdv' ? 'text-slate-950' : 'text-amber-400'
                }`}
              />
              <div className="flex flex-col">
                <span className="text-xs font-black tracking-wider leading-tight">
                  🏠 SALÃO
                </span>
                {!condensed && (
                  <span
                    className={`text-[9px] font-medium hidden sm:inline leading-tight ${
                      currentEnvironment === 'pdv' ? 'text-slate-900 font-bold' : 'text-slate-400'
                    }`}
                  >
                    Mesas → Garçom → PDV
                  </span>
                )}
              </div>
              {currentEnvironment === 'pdv' && (
                <span className="w-1.5 h-1.5 rounded-full bg-slate-950 animate-ping ml-0.5 shrink-0" />
              )}
            </button>
          )}

          {/* 5. 💰 CAIXA (Pagamentos → Fechamento) */}
          {canAccessCaixa && (
            <button
              id="env-btn-caixa"
              type="button"
              onClick={() => onSelectEnvironment('caixa')}
              className={`min-h-[42px] px-3 py-1.5 rounded-xl border flex items-center gap-2 transition-all active:scale-95 cursor-pointer whitespace-nowrap text-left ${
                currentEnvironment === 'caixa'
                  ? 'bg-yellow-500 text-slate-950 font-black border-yellow-300 shadow-[0_0_15px_rgba(234,179,8,0.4)]'
                  : 'bg-[#121724] border-slate-800 text-slate-300 hover:text-white hover:bg-[#181F30] hover:border-slate-700'
              }`}
              title="💰 CAIXA: Pagamentos → Fechamento"
            >
              <Wallet
                className={`w-4 h-4 shrink-0 ${
                  currentEnvironment === 'caixa' ? 'text-slate-950' : 'text-yellow-400'
                }`}
              />
              <div className="flex flex-col">
                <span className="text-xs font-black tracking-wider leading-tight">
                  💰 CAIXA
                </span>
                {!condensed && (
                  <span
                    className={`text-[9px] font-medium hidden sm:inline leading-tight ${
                      currentEnvironment === 'caixa' ? 'text-slate-900 font-bold' : 'text-slate-400'
                    }`}
                  >
                    Pagamentos → Fechamento
                  </span>
                )}
              </div>
              {currentEnvironment === 'caixa' && (
                <span className="w-1.5 h-1.5 rounded-full bg-slate-950 animate-ping ml-0.5 shrink-0" />
              )}
            </button>
          )}

          {/* 1b. 🛠 FERRAMENTAS DO SALÃO — menu suspenso no topo */}
          {(canAccessPdv || canAccessCaixa || canAccessAdmin) && (
            <button
              id="env-btn-ferramentas-salao"
              ref={salaoBtnRef}
              type="button"
              aria-haspopup="menu"
              aria-expanded={Boolean(salaoMenu)}
              onClick={() => {
                if (salaoMenu) return setSalaoMenu(null);
                const r = salaoBtnRef.current?.getBoundingClientRect();
                const width = 300;
                const left = Math.max(8, Math.min((r?.left ?? 8), window.innerWidth - width - 8));
                setSalaoMenu({ top: (r?.bottom ?? 48) + 6, left });
              }}
              className={`min-h-[42px] px-3 py-1.5 rounded-xl border flex items-center gap-2 transition-all active:scale-95 cursor-pointer whitespace-nowrap ${
                salaoMenu
                  ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                  : 'bg-[#121724] border-slate-800 text-slate-300 hover:text-white hover:bg-[#181F30] hover:border-slate-700'
              }`}
              title="Ferramentas do Salão, Mesas, Fechamento, Pagamento e Placas QR"
            >
              <Wrench className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="text-xs font-black tracking-wider">FERRAMENTAS</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${salaoMenu ? 'rotate-180' : ''}`} />
            </button>
          )}

            </div>
          )}

          {/* CLIENTE: função preservada, movida para o grupo secundário
              (Administração) no fim da barra — não é um fluxo operacional
              diário do garçom/caixa, então não compete mais com Salão/
              Balcão/Pedidos/Delivery/Caixa/Produção nesta posição de
              destaque. Ver o grupo "border-l" mais abaixo. */}

          {/* 2. 🚶 BALCÃO (PDV Touch → Senha → Pedido) */}
          {canAccessBalcao && (
            <button
              id="env-btn-balcao"
              type="button"
              onClick={() => onSelectEnvironment('balcao')}
              className={`min-h-[42px] px-3 py-1.5 rounded-xl border flex items-center gap-2 transition-all active:scale-95 cursor-pointer whitespace-nowrap text-left ${
                currentEnvironment === 'balcao'
                  ? 'bg-sky-500 text-slate-950 font-black border-sky-300 shadow-[0_0_15px_rgba(14,165,233,0.5)]'
                  : 'bg-[#121724] border-slate-800 text-slate-300 hover:text-white hover:bg-[#181F30] hover:border-slate-700'
              }`}
              title="🚶 BALCÃO RETIRADA: PDV Touch → Senha → Pedido"
            >
              <Store
                className={`w-4 h-4 shrink-0 ${
                  currentEnvironment === 'balcao' ? 'text-slate-950' : 'text-sky-400'
                }`}
              />
              <div className="flex flex-col">
                <span className="text-xs font-black tracking-wider leading-tight">
                  🚶 BALCÃO RETIRADA
                </span>
                {!condensed && (
                  <span
                    className={`text-[9px] font-medium hidden sm:inline leading-tight ${
                      currentEnvironment === 'balcao' ? 'text-slate-900 font-bold' : 'text-slate-400'
                    }`}
                  >
                    PDV Touch → Senha → Pedido
                  </span>
                )}
              </div>
              {currentEnvironment === 'balcao' && (
                <span className="w-1.5 h-1.5 rounded-full bg-slate-950 animate-ping ml-0.5 shrink-0" />
              )}
            </button>
          )}

          {/*
            4. 📦 PEDIDOS / KANBAN
            REORGANIZAÇÃO DE NAVEGAÇÃO: antes só existia um botão pequeno de
            Kanban, sem checagem de permissão, escondido em telas menores que
            xl ("hidden xl:flex" — nem aparecia em tablet/notebook) e fora de
            ordem (depois do Admin). Pedidos/Kanban é fluxo diário (acompanhar
            pedidos em preparo) — promovido para a mesma posição e peso visual
            das demais ferramentas operacionais, na ordem pedida: Salão →
            Balcão → Pedidos/Kanban → Delivery → Caixa → Produção.
          */}
          {canAccessKanban && (
            <button
              id="env-btn-kanban"
              type="button"
              onClick={() => onSelectEnvironment('kanban')}
              className={`min-h-[42px] px-3 py-1.5 rounded-xl border flex items-center gap-2 transition-all active:scale-95 cursor-pointer whitespace-nowrap text-left ${
                currentEnvironment === 'kanban'
                  ? 'bg-indigo-500 text-white font-black border-indigo-300 shadow-[0_0_15px_rgba(99,102,241,0.5)]'
                  : 'bg-[#121724] border-slate-800 text-slate-300 hover:text-white hover:bg-[#181F30] hover:border-slate-700'
              }`}
              title="📦 PEDIDOS / KANBAN: Recebidos → Em preparo → Prontos → Entregues"
            >
              <Kanban
                className={`w-4 h-4 shrink-0 ${
                  currentEnvironment === 'kanban' ? 'text-white' : 'text-indigo-400'
                }`}
              />
              <div className="flex flex-col">
                <span className="text-xs font-black tracking-wider leading-tight">
                  📦 PEDIDOS
                </span>
                {!condensed && (
                  <span
                    className={`text-[9px] font-medium hidden sm:inline leading-tight ${
                      currentEnvironment === 'kanban' ? 'text-indigo-100 font-bold' : 'text-slate-400'
                    }`}
                  >
                    Kanban de Pedidos
                  </span>
                )}
              </div>
              {currentEnvironment === 'kanban' && (
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping ml-0.5 shrink-0" />
              )}
            </button>
          )}

          {/* 4. 🚚 DELIVERY (Pedidos online → Entrega) */}
          {canAccessDelivery && (
            <button
              id="env-btn-delivery"
              type="button"
              onClick={() => onSelectEnvironment('delivery')}
              className={`min-h-[42px] px-3 py-1.5 rounded-xl border flex items-center gap-2 transition-all active:scale-95 cursor-pointer whitespace-nowrap text-left ${
                currentEnvironment === 'delivery'
                  ? 'bg-emerald-600 text-white font-black border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.4)]'
                  : 'bg-[#121724] border-slate-800 text-slate-300 hover:text-white hover:bg-[#181F30] hover:border-slate-700'
              }`}
              title="🚚 DELIVERY: Pedidos online → Entrega"
            >
              <Truck
                className={`w-4 h-4 shrink-0 ${
                  currentEnvironment === 'delivery' ? 'text-white' : 'text-emerald-400'
                }`}
              />
              <div className="flex flex-col">
                <span className="text-xs font-black tracking-wider leading-tight">
                  🚚 DELIVERY
                </span>
                {!condensed && (
                  <span
                    className={`text-[9px] font-medium hidden sm:inline leading-tight ${
                      currentEnvironment === 'delivery' ? 'text-emerald-100 font-bold' : 'text-slate-400'
                    }`}
                  >
                    Pedidos Online → Entrega
                  </span>
                )}
              </div>
              {currentEnvironment === 'delivery' && (
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping ml-0.5 shrink-0" />
              )}
            </button>
          )}

          {/* 6. 👨‍🍳 PRODUÇÃO (Cozinha • SushiBar • Bar) */}
          {canAccessProducao && (
            <div
              id="env-group-producao"
              className={`min-h-[42px] px-2 py-1 rounded-xl border flex items-center gap-1.5 transition-all ${
                isProducaoActive
                  ? 'bg-[#161D2B] border-orange-500/50 shadow-[0_0_15px_rgba(249,115,22,0.25)]'
                  : 'bg-[#121724] border-slate-800'
              }`}
            >
            <div className="flex items-center gap-1.5 px-1.5">
              <Flame
                className={`w-4 h-4 shrink-0 ${
                  isProducaoActive ? 'text-orange-400 animate-pulse' : 'text-orange-400'
                }`}
              />
              <span className="text-xs font-black text-slate-200 tracking-wider hidden lg:inline">
                👨‍🍳 PRODUÇÃO:
              </span>
            </div>

            {/* Cozinha pill */}
            <button
              id="env-btn-cozinha"
              type="button"
              onClick={() => onSelectEnvironment('cozinha')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                currentEnvironment === 'cozinha'
                  ? 'bg-orange-500 text-slate-950 font-black shadow'
                  : 'text-orange-300 hover:text-white hover:bg-orange-950/40'
              }`}
              title="KDS Cozinha (Pratos Quentes)"
            >
              Cozinha
            </button>

            {/* SushiBar pill */}
            <button
              id="env-btn-sushibar"
              type="button"
              onClick={() => onSelectEnvironment('sushibar')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                currentEnvironment === 'sushibar'
                  ? 'bg-teal-500 text-slate-950 font-black shadow'
                  : 'text-teal-300 hover:text-white hover:bg-teal-950/40'
              }`}
              title="KDS SushiBar (Sushis & Frios)"
            >
              SushiBar
            </button>

            {/* Bar pill */}
            <button
              id="env-btn-bar"
              type="button"
              onClick={() => onSelectEnvironment('bar')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                currentEnvironment === 'bar'
                  ? 'bg-purple-500 text-slate-950 font-black shadow'
                  : 'text-purple-300 hover:text-white hover:bg-purple-950/40'
              }`}
              title="KDS Bar (Chopp & Drinks)"
            >
              Bar
            </button>
          </div>
          )}

        </div>

        {/*
          REORGANIZAÇÃO DE NAVEGAÇÃO (Administração / Sistema):
          Antes, o botão "ADMIN" tinha o MESMO peso visual (tamanho, borda,
          destaque) que Salão/Balcão/Caixa/Produção — ferramentas de uso
          diário — competindo por atenção com elas. Também havia um botão de
          Kanban duplicado (agora removido; Kanban virou "PEDIDOS" acima) e um
          botão "7 Pilares" solto sem relação clara com o restante.
          Agora ADMIN e o atalho do mapa operacional ficam num grupo visualmente
          separado (divisor vertical + estilo neutro/menor), à direita, fora do
          fluxo operacional — mesma função de antes (nada foi removido), só
          reorganizada. Dentro do painel Admin, a categoria "SISTEMA" (já
          existente em AdminLayout.tsx) reúne Usuários/Permissões, Impressoras,
          Integrações, Backup, Diagnóstico e Configurações Avançadas,
          separada das demais categorias administrativas (Cardápio, Equipe,
          Gestão, Inteligência) por um filtro de categoria dedicado.
        */}
        {(canAccessAdmin || canAccessCliente) && (
          <div className="flex items-center gap-1.5 min-w-max pl-2 ml-1 border-l border-slate-800/80">
            {canAccessCliente && (
              <button
                id="env-btn-cliente"
                type="button"
                onClick={() => onSelectEnvironment('cliente')}
                className={`min-h-[38px] px-2.5 py-1 rounded-lg border flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer whitespace-nowrap text-left ${
                  currentEnvironment === 'cliente'
                    ? 'bg-emerald-500 text-slate-950 font-black border-emerald-400'
                    : 'bg-transparent border-slate-800 text-slate-500 hover:text-slate-200 hover:border-slate-700'
                }`}
                title="👤 CLIENTE: pré-visualizar QR da mesa → Cardápio → Pedido"
              >
                <Utensils className="w-3.5 h-3.5 shrink-0" />
                <span className="text-[11px] font-bold">Cliente</span>
              </button>
            )}

            {canAccessAdmin && (
              <button
                id="env-btn-admin"
                type="button"
                onClick={() => onSelectEnvironment('admin')}
                className={`min-h-[38px] px-2.5 py-1 rounded-lg border flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer whitespace-nowrap text-left ${
                  currentEnvironment === 'admin'
                    ? 'bg-indigo-600 text-white font-black border-indigo-400'
                    : 'bg-transparent border-slate-800 text-slate-500 hover:text-slate-200 hover:border-slate-700'
                }`}
                title="⚙️ ADMINISTRAÇÃO / SISTEMA: Cardápio, Equipe, Clientes, Relatórios, Usuários, Impressoras, Integrações..."
              >
                <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                <span className="text-[11px] font-bold">Administração</span>
              </button>
            )}

            <button
              id="env-btn-open-workflow-modal"
              type="button"
              onClick={() => setIsWorkflowModalOpen(true)}
              className="min-h-[38px] w-[34px] rounded-lg border border-slate-800 text-slate-500 hover:text-amber-300 hover:border-amber-500/40 flex items-center justify-center transition-all active:scale-95"
              title="Mapa e Arquitetura Operacional (7 Pilares)"
            >
              <Activity className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {salaoMenu && (
        <div
          ref={salaoMenuRef}
          role="menu"
          style={{ position: 'fixed', top: salaoMenu.top, left: salaoMenu.left, width: 300, zIndex: 120 }}
          className="bg-[#0F131D] border border-slate-700 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,.7)] p-2 space-y-1 max-h-[80vh] overflow-y-auto"
        >
          <p className="px-2 pt-1 pb-0.5 text-[10px] font-black uppercase tracking-widest text-slate-500">Salão &amp; Caixa — ferramentas</p>
          {[
            { show: canAccessPdv, icon: UserCheck, label: 'Mesas & PDV do Garçom', hint: 'Abrir mesa, lançar itens', go: () => onSelectEnvironment('pdv') },
            { show: canAccessCaixa, icon: Receipt, label: 'Fechamento da conta', hint: 'Fecha e imprime o cupom no mesmo clique', go: () => onSelectEnvironment('caixa', 'mesas') },
            { show: canAccessCaixa, icon: Wallet, label: 'Pagamento', hint: '10% incluído, cupom comum ou fiscal', go: () => onSelectEnvironment('caixa', 'mesas') },
            { show: canAccessCaixa || canAccessAdmin, icon: QrCode, label: 'Placas QR das Mesas', hint: 'Gerar, imprimir e liberar o QR de cada mesa', go: () => onSelectEnvironment(canAccessCaixa ? 'caixa' : 'admin', canAccessCaixa ? 'qrcodes' : 'tables') },
            { show: canAccessCaixa, icon: Wallet, label: 'Sangria, suprimento e extrato', hint: 'Movimentações do caixa', go: () => onSelectEnvironment('caixa', 'movimentacoes') },
            { show: canAccessAdmin, icon: Utensils, label: 'Gestão de Mesas', hint: 'Mesas e comandas (Administração)', go: () => onSelectEnvironment('admin', 'tables') },
            { show: canAccessAdmin, icon: Printer, label: 'Impressoras (Print Agent)', hint: 'Cozinha, Sushi Bar, Bar e Caixa', go: () => onSelectEnvironment('admin', 'print_agent') },
            { show: canAccessAdmin, icon: Wrench, label: 'Configurações do Salão', hint: '10%, impressão por setor, Kanban', go: () => onSelectEnvironment('admin', 'tools_catalog') },
          ]
            .filter((it) => it.show)
            .map((it) => (
              <button
                key={it.label}
                type="button"
                role="menuitem"
                onClick={() => { setSalaoMenu(null); it.go(); }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left hover:bg-slate-800/70 active:scale-[0.99]"
              >
                <it.icon className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="min-w-0">
                  <span className="block text-xs font-black text-white">{it.label}</span>
                  <span className="block text-[10px] text-slate-400">{it.hint}</span>
                </span>
              </button>
            ))}

          {canAccessAdmin && (
            <div className="border-t border-slate-800 mt-1 pt-2 space-y-1.5">
              <p className="px-2 text-[10px] font-black uppercase tracking-widest text-slate-500">Liga / desliga</p>
              {[
                { on: systemSettings.serviceFeeDefaultOn !== false, icon: Percent, label: 'Taxa de serviço 10%', set: () => updateSystemSettings({ serviceFeeDefaultOn: !(systemSettings.serviceFeeDefaultOn !== false) }) },
                { on: systemSettings.autoSendToStations !== false, icon: Send, label: 'Envio automático aos setores', set: () => updateSystemSettings({ autoSendToStations: !(systemSettings.autoSendToStations !== false) }) },
                { on: systemSettings.kanbanEnabled !== false, icon: Kanban, label: 'Kanban de pedidos', set: () => updateSystemSettings({ kanbanEnabled: !(systemSettings.kanbanEnabled !== false) }) },
              ].map((t) => (
                <button
                  key={t.label}
                  type="button"
                  aria-pressed={t.on}
                  onClick={() => t.set()}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-900/70 hover:bg-slate-800/70"
                >
                  <span className="flex items-center gap-2 text-xs font-bold text-slate-200">
                    <t.icon className="w-3.5 h-3.5 text-amber-400" />
                    {t.label}
                  </span>
                  <span className={`text-[10px] font-black px-2 py-1 rounded-lg ${t.on ? 'bg-emerald-500 text-slate-950' : 'bg-slate-700 text-slate-300'}`}>
                    {t.on ? 'ATIVO' : 'DESATIVADO'}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Operational Workflow Modal */}
      <OperationalWorkflowModal
        isOpen={isWorkflowModalOpen}
        onClose={() => setIsWorkflowModalOpen(false)}
        onNavigate={onSelectEnvironment}
      />
    </>
  );
};
