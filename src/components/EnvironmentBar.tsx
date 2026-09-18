import React from 'react';
import { Utensils, Smartphone, Flame, Beer, Fish, ShieldCheck, UserCheck } from 'lucide-react';

export type OperationalEnvironment = 'cliente' | 'pdv' | 'cozinha' | 'bar' | 'sushibar' | 'admin';

interface EnvironmentBarProps {
  currentEnvironment: OperationalEnvironment;
  onSelectEnvironment: (env: OperationalEnvironment) => void;
  className?: string;
  condensed?: boolean;
}

export const EnvironmentBar: React.FC<EnvironmentBarProps> = ({
  currentEnvironment,
  onSelectEnvironment,
  className = '',
  condensed = false,
}) => {
  const environments: Array<{
    id: OperationalEnvironment;
    label: string;
    sublabel: string;
    icon: React.ComponentType<{ className?: string }>;
    badgeColor: string;
    activeStyle: string;
  }> = [
    {
      id: 'cliente',
      label: 'CLIENTE',
      sublabel: 'Cardápio / Delivery',
      icon: Utensils,
      badgeColor: 'text-emerald-400',
      activeStyle: 'bg-emerald-500 text-slate-950 font-black border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.4)]',
    },
    {
      id: 'pdv',
      label: 'GARÇOM / PDV',
      sublabel: 'Venda Rápida Touch',
      icon: UserCheck,
      badgeColor: 'text-amber-400',
      activeStyle: 'bg-gradient-to-r from-amber-500 to-amber-400 text-slate-950 font-black border-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.5)]',
    },
    {
      id: 'cozinha',
      label: 'COZINHA',
      sublabel: 'KDS Pratos Quentes',
      icon: Flame,
      badgeColor: 'text-orange-400',
      activeStyle: 'bg-orange-500 text-slate-950 font-black border-orange-300 shadow-[0_0_15px_rgba(249,115,22,0.4)]',
    },
    {
      id: 'bar',
      label: 'BAR',
      sublabel: 'KDS Drinks & Chopp',
      icon: Beer,
      badgeColor: 'text-purple-400',
      activeStyle: 'bg-purple-500 text-slate-950 font-black border-purple-300 shadow-[0_0_15px_rgba(168,85,247,0.4)]',
    },
    {
      id: 'sushibar',
      label: 'SUSHIBAR',
      sublabel: 'KDS Sushis & Peixes',
      icon: Fish,
      badgeColor: 'text-teal-400',
      activeStyle: 'bg-teal-500 text-slate-950 font-black border-teal-300 shadow-[0_0_15px_rgba(20,184,166,0.4)]',
    },
    {
      id: 'admin',
      label: 'ADMIN',
      sublabel: 'Painel Restaurante',
      icon: ShieldCheck,
      badgeColor: 'text-indigo-400',
      activeStyle: 'bg-indigo-600 text-white font-black border-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.4)]',
    },
  ];

  return (
    <div
      className={`bg-[#0B0F19] border-b border-slate-800/80 px-2 py-1.5 flex items-center justify-between gap-1.5 overflow-x-auto no-scrollbar select-none z-30 ${className}`}
    >
      <div className="flex items-center gap-1.5 min-w-max mx-auto">
        <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500 px-2 hidden xl:inline-block">
          MODO OPERACIONAL:
        </span>

        {environments.map((env) => {
          const Icon = env.icon;
          const isActive = currentEnvironment === env.id;

          return (
            <button
              key={env.id}
              type="button"
              onClick={() => onSelectEnvironment(env.id)}
              className={`min-h-[42px] px-3 sm:px-3.5 py-1.5 rounded-xl border flex items-center gap-2 transition-all active:scale-95 cursor-pointer whitespace-nowrap text-left ${
                isActive
                  ? env.activeStyle
                  : 'bg-[#121724] border-slate-800 text-slate-300 hover:text-white hover:bg-[#181F30] hover:border-slate-700'
              }`}
              title={`Alternar para ambiente ${env.label}`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-inherit' : env.badgeColor}`} />
              <div className="flex flex-col">
                <span className="text-xs font-black tracking-wider leading-tight">
                  {env.label}
                </span>
                {!condensed && (
                  <span
                    className={`text-[9px] font-medium hidden sm:inline leading-tight ${
                      isActive ? 'opacity-80 text-inherit' : 'text-slate-400'
                    }`}
                  >
                    {env.sublabel}
                  </span>
                )}
              </div>
              {isActive && (
                <span className="w-1.5 h-1.5 rounded-full bg-current animate-ping ml-0.5 shrink-0" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
