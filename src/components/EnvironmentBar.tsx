import React, { useState } from 'react';
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
} from 'lucide-react';
import { OperationalWorkflowModal } from './OperationalWorkflowModal';
import { useStore } from '../context/StoreContext';
import { canAccessArea } from '../painel/access';

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
  const { currentUser } = useStore();
  const [isWorkflowModalOpen, setIsWorkflowModalOpen] = useState(false);

  // Perfis e áreas liberadas seguem exatamente os nomes do servidor (ver painel/access.ts).
  // Sem usuário logado nada é exibido: esta barra só existe dentro do painel autenticado.
  const role = currentUser?.role;
  const canAccessPdv = canAccessArea(role, 'pdv');
  const canAccessCliente = Boolean(role); // abre o cardápio público em outra tela
  const canAccessBalcao = canAccessArea(role, 'balcao');
  const canAccessDelivery = canAccessArea(role, 'delivery');
  const canAccessCaixa = canAccessArea(role, 'caixa');
  const canAccessProducao = canAccessArea(role, 'cozinha') || canAccessArea(role, 'sushibar') || canAccessArea(role, 'bar');
  const canAccessAdmin = canAccessArea(role, 'admin');

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

          {/* 2. 👤 CLIENTE (QR da mesa → Cardápio → Pedido) */}
          {canAccessCliente && (
            <button
              id="env-btn-cliente"
              type="button"
              onClick={() => onSelectEnvironment('cliente')}
              className={`min-h-[42px] px-3 py-1.5 rounded-xl border flex items-center gap-2 transition-all active:scale-95 cursor-pointer whitespace-nowrap text-left ${
                currentEnvironment === 'cliente'
                  ? 'bg-emerald-500 text-slate-950 font-black border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.4)]'
                  : 'bg-[#121724] border-slate-800 text-slate-300 hover:text-white hover:bg-[#181F30] hover:border-slate-700'
              }`}
              title="👤 CLIENTE: QR da mesa → Cardápio → Pedido"
            >
              <Utensils
                className={`w-4 h-4 shrink-0 ${
                  currentEnvironment === 'cliente' ? 'text-slate-950' : 'text-emerald-400'
                }`}
              />
              <div className="flex flex-col">
                <span className="text-xs font-black tracking-wider leading-tight">
                  👤 CLIENTE
                </span>
                {!condensed && (
                  <span
                    className={`text-[9px] font-medium hidden sm:inline leading-tight ${
                      currentEnvironment === 'cliente' ? 'text-slate-900 font-bold' : 'text-slate-400'
                    }`}
                  >
                    QR Mesa → Cardápio → Pedido
                  </span>
                )}
              </div>
              {currentEnvironment === 'cliente' && (
                <span className="w-1.5 h-1.5 rounded-full bg-slate-950 animate-ping ml-0.5 shrink-0" />
              )}
            </button>
          )}

          {/* 3. 🚶 BALCÃO (PDV Touch → Senha → Pedido) */}
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
              title="🚶 BALCÃO: PDV Touch → Senha → Pedido"
            >
              <Store
                className={`w-4 h-4 shrink-0 ${
                  currentEnvironment === 'balcao' ? 'text-slate-950' : 'text-sky-400'
                }`}
              />
              <div className="flex flex-col">
                <span className="text-xs font-black tracking-wider leading-tight">
                  🚶 BALCÃO
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

          {/* 7. ⚙️ ADMIN (Configurações → Cardápio → Usuários → Relatórios → IA) */}
          {canAccessAdmin && (
            <button
              id="env-btn-admin"
              type="button"
              onClick={() => onSelectEnvironment('admin')}
              className={`min-h-[42px] px-3 py-1.5 rounded-xl border flex items-center gap-2 transition-all active:scale-95 cursor-pointer whitespace-nowrap text-left ${
                currentEnvironment === 'admin'
                  ? 'bg-indigo-600 text-white font-black border-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.4)]'
                  : 'bg-[#121724] border-slate-800 text-slate-300 hover:text-white hover:bg-[#181F30] hover:border-slate-700'
              }`}
              title="⚙️ ADMIN: Configurações → Cardápio → Usuários → Relatórios → IA"
            >
              <ShieldCheck
                className={`w-4 h-4 shrink-0 ${
                  currentEnvironment === 'admin' ? 'text-white' : 'text-indigo-400'
                }`}
              />
              <div className="flex flex-col">
                <span className="text-xs font-black tracking-wider leading-tight">
                  ⚙️ ADMIN
                </span>
                {!condensed && (
                  <span
                    className={`text-[9px] font-medium hidden sm:inline leading-tight ${
                      currentEnvironment === 'admin' ? 'text-indigo-100 font-bold' : 'text-slate-400'
                    }`}
                  >
                    Config → Menu → Equipe → IA
                  </span>
                )}
              </div>
              {currentEnvironment === 'admin' && (
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping ml-0.5 shrink-0" />
              )}
            </button>
          )}

          {/* KANBAN VISÃO CENTRAL (Opcional) */}
          <button
            id="env-btn-kanban"
            type="button"
            onClick={() => onSelectEnvironment('kanban')}
            className={`min-h-[42px] px-2.5 py-1.5 rounded-xl border hidden xl:flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer whitespace-nowrap text-left ${
              currentEnvironment === 'kanban'
                ? 'bg-indigo-600 text-white font-black border-indigo-400 shadow'
                : 'bg-[#121724] border-slate-800 text-slate-400 hover:text-white hover:bg-[#181F30]'
            }`}
            title="Kanban Central Integrado"
          >
            <Kanban className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-xs font-bold">KANBAN</span>
          </button>

          {/* BOTÃO ESPECIAL: MAPA OPERACIONAL (7 PILARES) */}
          <button
            id="env-btn-open-workflow-modal"
            type="button"
            onClick={() => setIsWorkflowModalOpen(true)}
            className="min-h-[42px] px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-indigo-500/20 hover:from-amber-500/30 hover:to-indigo-500/30 border border-amber-500/40 text-amber-300 hover:text-white text-xs font-black transition-all flex items-center gap-1.5 shadow-lg active:scale-95 ml-1"
            title="Abrir Mapa e Arquitetura Operacional dos 7 Pilares"
          >
            <Activity className="w-4 h-4 text-amber-400" />
            <span className="hidden md:inline uppercase tracking-wider">
              7 Pilares
            </span>
          </button>
        </div>
      </div>

      {/* Operational Workflow Modal */}
      <OperationalWorkflowModal
        isOpen={isWorkflowModalOpen}
        onClose={() => setIsWorkflowModalOpen(false)}
        onNavigate={onSelectEnvironment}
      />
    </>
  );
};
