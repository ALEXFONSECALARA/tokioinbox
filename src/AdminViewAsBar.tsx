import React from 'react';
import { Eye, X, Smartphone, Monitor, ChefHat, Bike, ShieldCheck, ShoppingBag } from 'lucide-react';

export type ViewAsRole = 'superadmin' | 'cliente' | 'cozinha_kds' | 'caixa_pdv' | 'entregador';

interface AdminViewAsBarProps {
  currentRole: ViewAsRole;
  onChangeRole: (role: ViewAsRole) => void;
  onExit: () => void;
}

export const AdminViewAsBar: React.FC<AdminViewAsBarProps> = ({
  currentRole,
  onChangeRole,
  onExit,
}) => {
  return (
    <div className="sticky top-0 z-50 bg-[#0E121B] border-b border-[#E3BD6A]/40 px-4 py-2 flex items-center justify-between shadow-lg text-xs">
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-[#E3BD6A] animate-ping" />
        <span className="text-[#E3BD6A] font-black uppercase tracking-wider flex items-center gap-1.5">
          <Eye className="w-3.5 h-3.5" />
          <span>Modo Simulação de Visão:</span>
        </span>
      </div>

      {/* Role options */}
      <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
        <button
          onClick={() => onChangeRole('superadmin')}
          className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 transition-colors ${
            currentRole === 'superadmin'
              ? 'bg-[#E3BD6A] text-slate-950'
              : 'text-slate-400 hover:text-white bg-slate-800'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Super Admin</span>
        </button>

        <button
          onClick={() => onChangeRole('cliente')}
          className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 transition-colors ${
            currentRole === 'cliente'
              ? 'bg-[#E3BD6A] text-slate-950'
              : 'text-slate-400 hover:text-white bg-slate-800'
          }`}
        >
          <ShoppingBag className="w-3.5 h-3.5" />
          <span>Cliente</span>
        </button>

        <button
          onClick={() => onChangeRole('cozinha_kds')}
          className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 transition-colors ${
            currentRole === 'cozinha_kds'
              ? 'bg-[#E3BD6A] text-slate-950'
              : 'text-slate-400 hover:text-white bg-slate-800'
          }`}
        >
          <ChefHat className="w-3.5 h-3.5" />
          <span>Cozinha (KDS)</span>
        </button>

        <button
          onClick={() => onChangeRole('caixa_pdv')}
          className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 transition-colors ${
            currentRole === 'caixa_pdv'
              ? 'bg-[#E3BD6A] text-slate-950'
              : 'text-slate-400 hover:text-white bg-slate-800'
          }`}
        >
          <Monitor className="w-3.5 h-3.5" />
          <span>Caixa (PDV)</span>
        </button>

        <button
          onClick={() => onChangeRole('entregador')}
          className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 transition-colors ${
            currentRole === 'entregador'
              ? 'bg-[#E3BD6A] text-slate-950'
              : 'text-slate-400 hover:text-white bg-slate-800'
          }`}
        >
          <Bike className="w-3.5 h-3.5" />
          <span>Entregador</span>
        </button>
      </div>

      <button
        onClick={onExit}
        className="text-slate-400 hover:text-rose-400 p-1 transition-colors ml-2"
        title="Sair do modo simulação"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
