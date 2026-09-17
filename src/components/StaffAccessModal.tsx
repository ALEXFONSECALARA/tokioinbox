import React from 'react';
import {
  Lock,
  Utensils,
  ShieldCheck,
  Bike,
  X,
  ArrowRight,
  Beer,
  Fish,
  Flame,
  Layers,
} from 'lucide-react';
import { BRAND_NAME } from '../config/brand';

interface StaffAccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectView: (view: any) => void;
}

export const StaffAccessModal: React.FC<StaffAccessModalProps> = ({
  isOpen,
  onClose,
  onSelectView,
}) => {
  if (!isOpen) return null;

  const stations = [
    {
      id: 'pdv',
      title: 'PDV Touch • Salão & Garçom',
      desc: 'Comanda de mesas, lançamentos rápidos e pré-conta',
      icon: Utensils,
      badge: 'Touch',
      color: 'from-amber-500 to-amber-600',
      iconBg: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
      hoverBorder: 'hover:border-amber-500/60',
      textColor: 'group-hover:text-amber-400',
    },
    {
      id: 'bar',
      title: 'KDS Bar & Drinks',
      desc: 'Produção exclusiva de bebidas, chopp, sucos e coquetéis',
      icon: Beer,
      badge: 'Praça Bar',
      color: 'from-purple-500 to-indigo-600',
      iconBg: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
      hoverBorder: 'hover:border-purple-500/60',
      textColor: 'group-hover:text-purple-400',
    },
    {
      id: 'cozinha',
      title: 'KDS Cozinha Principal',
      desc: 'Produção exclusiva de pratos quentes, porções e pizzas',
      icon: Flame,
      badge: 'Praça Cozinha',
      color: 'from-orange-500 to-amber-600',
      iconBg: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
      hoverBorder: 'hover:border-orange-500/60',
      textColor: 'group-hover:text-orange-400',
    },
    {
      id: 'sushibar',
      title: 'KDS Sushibar',
      desc: 'Produção exclusiva de sushis, sashimis e combinados',
      icon: Fish,
      badge: 'Praça Sushi',
      color: 'from-emerald-500 to-teal-600',
      iconBg: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
      hoverBorder: 'hover:border-emerald-500/60',
      textColor: 'group-hover:text-emerald-400',
    },
    {
      id: 'admin',
      title: 'Painel Administrativo Geral',
      desc: 'Expedição, Caixa, Cardápio, Relatórios e Configurações',
      icon: ShieldCheck,
      badge: 'Gestão',
      color: 'from-blue-500 to-blue-700',
      iconBg: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      hoverBorder: 'hover:border-blue-500/60',
      textColor: 'group-hover:text-blue-400',
    },
    {
      id: 'courier',
      title: 'Portal do Entregador',
      desc: 'Despacho de motoboys, rotas e confirmação de entrega',
      icon: Bike,
      badge: 'Delivery',
      color: 'from-cyan-500 to-blue-600',
      iconBg: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
      hoverBorder: 'hover:border-cyan-500/60',
      textColor: 'group-hover:text-cyan-400',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
      <div className="w-full max-w-xl bg-[#111520] border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-[0_20px_60px_rgba(0,0,0,0.9)] space-y-5 text-slate-100 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <Lock className="w-4 h-4" />
              </span>
              <h2 className="text-base sm:text-lg font-black text-white">
                Estações de Trabalho • Operações
              </h2>
            </div>
            <p className="text-xs text-slate-400">
              {BRAND_NAME} • Selecione a tela exclusiva para sua função
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Stations List */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {stations.map((st) => {
            const Icon = st.icon;
            return (
              <button
                key={st.id}
                onClick={() => {
                  onClose();
                  onSelectView(st.id);
                }}
                className={`p-3.5 rounded-2xl bg-[#161C2B] hover:bg-[#1A2236] border border-slate-800 ${st.hoverBorder} transition-all text-left flex items-start justify-between group shadow-md`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl ${st.iconBg} flex items-center justify-center border shrink-0 transition-colors`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h3
                        className={`text-xs font-black text-white ${st.textColor} transition-colors line-clamp-1`}
                      >
                        {st.title}
                      </h3>
                    </div>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-800/80 text-slate-300 inline-block mt-0.5">
                      {st.badge}
                    </span>
                    <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                      {st.desc}
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-white group-hover:translate-x-1 transition-all shrink-0 mt-2" />
              </button>
            );
          })}
        </div>

        {/* Footer Hint */}
        <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
          <span>Cada tela exibe estritamente o necessário para sua função.</span>
          <span className="text-amber-500 font-semibold">Produção Ativa</span>
        </div>
      </div>
    </div>
  );
};
