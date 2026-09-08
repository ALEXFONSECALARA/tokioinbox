import React, { useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { RestaurantSlug } from '../../types/restaurant';
import { AdminKanban } from './AdminKanban';
import { AdminMenuManager } from './AdminMenuManager';
import { AdminSettings } from './AdminSettings';
import { AdminHealthCheck } from './AdminHealthCheck';
import { AdminCustomers } from './AdminCustomers';
import {
  Lock,
  LogOut,
  LayoutDashboard,
  Utensils,
  Settings,
  Activity,
  ArrowLeft,
  ChevronDown,
  ShieldCheck,
  Bell,
  Eye,
  Users,
} from 'lucide-react';

interface AdminLayoutProps {
  onBackToApp: () => void;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({ onBackToApp }) => {
  const { restaurants, orders, customers, adminLogin, adminLogout, isAdminAuthenticated } = useStore();

  // Simple and secure authentication gate
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(isAdminAuthenticated);
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState(false);

  // Active admin tab
  const [activeTab, setActiveTab] = useState<'kanban' | 'menu' | 'customers' | 'settings' | 'health'>('kanban');

  // Filter for restaurant in admin: 'all' or specific slug
  const [selectedFilterSlug, setSelectedFilterSlug] = useState<RestaurantSlug | 'all'>('all');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(false);
    try {
      await adminLogin(passwordInput);
      setIsAuthenticated(true);
      setPasswordInput('');
    } catch {
      setAuthError(true);
    }
  };

  const handleLogout = () => {
    adminLogout();
    setIsAuthenticated(false);
    setPasswordInput('');
  };

  // Pending incoming orders count
  const pendingOrdersCount = orders.filter((o) => o.status === 'recebido').length;

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center mx-auto text-2xl shadow-lg">
            <Lock className="w-8 h-8" />
          </div>

          <div>
            <h1 className="text-xl font-black text-white tracking-tight">
              Tokio inBox • Painel Super-Admin
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Acesso restrito para gestão de pedidos e cardápios dos 4 restaurantes.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4 text-left">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                Senha de Acesso Mestre
              </label>
              <input
                type="password"
                required
                autoFocus
                value={passwordInput}
                onChange={(e) => {
                  setPasswordInput(e.target.value);
                  setAuthError(false);
                }}
                placeholder="Digite a senha..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
              />
              {authError && (
                <p className="text-xs text-rose-400 mt-1.5 font-medium">
                  Senha incorreta ou acesso não configurado no servidor.
                </p>
              )}
            </div>

            <button
              type="submit"
              className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs sm:text-sm rounded-xl shadow-lg transition-all"
            >
              Entrar no Painel de Controle
            </button>
          </form>

          <button
            onClick={onBackToApp}
            className="text-xs text-slate-400 hover:text-white flex items-center justify-center gap-1.5 mx-auto"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Voltar ao Cardápio dos Clientes</span>
          </button>
        </div>
      </div>
    );
  }

  // Active restaurant for menu/settings tab (if selectedFilterSlug is 'all', default to 'japones')
  const activeSingleSlug: RestaurantSlug =
    selectedFilterSlug === 'all' ? 'japones' : selectedFilterSlug;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Super Admin Top Header */}
      <header className="sticky top-0 z-30 bg-slate-900/95 border-b border-slate-800 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Logo & Super-Admin Badge */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-black text-base shadow">
              ⚡
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-extrabold text-white tracking-tight">
                  Tokio<span className="text-amber-400">inBox</span>
                </h1>
                <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Super-Admin
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Central de Operações Multicardápio
              </p>
            </div>
          </div>

          {/* Restaurant Filter Dropdown */}
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5">
              <span className="text-xs text-slate-400">Filtrar por Loja:</span>
              <select
                value={selectedFilterSlug}
                onChange={(e) => setSelectedFilterSlug(e.target.value as any)}
                className="bg-transparent text-xs text-white font-bold focus:outline-none cursor-pointer"
              >
                <option value="all" className="bg-slate-900">
                  🌐 Todos os 4 Restaurantes (Visão Global)
                </option>
                <option value="japones" className="bg-slate-900">
                  🍣 Sakura Sushi House (Japonês)
                </option>
                <option value="italiano" className="bg-slate-900">
                  🍝 Cantina Bella Vista (Italiano)
                </option>
                <option value="pizza" className="bg-slate-900">
                  🍕 Forno D&apos;Oro (Pizzaria)
                </option>
                <option value="hamburgueria" className="bg-slate-900">
                  🍔 Burger Craft &amp; Beer (Burgers)
                </option>
              </select>
            </div>

            {/* Back to Client App */}
            <button
              onClick={onBackToApp}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl border border-slate-700 flex items-center gap-1.5 transition-colors"
              title="Abrir a visão pública do cliente"
            >
              <Eye className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden md:inline">Ver Cardápio Público</span>
            </button>

            {/* Logout */}
            <button
              onClick={handleLogout}
              className="p-2 text-slate-400 hover:text-rose-400 bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-700 transition-colors"
              title="Encerrar Sessão do Admin"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center gap-1 border-t border-slate-800/80 overflow-x-auto no-scrollbar py-1">
          <button
            onClick={() => setActiveTab('kanban')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
              activeTab === 'kanban'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            <span>Kanban Global de Pedidos</span>
            {pendingOrdersCount > 0 && (
              <span className="bg-rose-600 text-white text-[10px] px-1.5 py-0.2 rounded-full font-black animate-pulse">
                {pendingOrdersCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('menu')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
              activeTab === 'menu'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <Utensils className="w-3.5 h-3.5" />
            <span>Gestão de Cardápio</span>
          </button>

          <button
            onClick={() => setActiveTab('customers')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
              activeTab === 'customers'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Cadastros &amp; Clientes</span>
            {customers.length > 0 && (
              <span className="bg-slate-800 text-amber-300 text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                {customers.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
              activeTab === 'settings'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Configurações &amp; Loja</span>
          </button>

          <button
            onClick={() => setActiveTab('health')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
              activeTab === 'health'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Ferramentas &amp; Diagnóstico</span>
          </button>
        </div>
      </header>

      {/* Main Admin Content */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full">
        {activeTab === 'kanban' && (
          <AdminKanban selectedFilterSlug={selectedFilterSlug} />
        )}

        {activeTab === 'menu' && (
          <AdminMenuManager currentRestaurantSlug={activeSingleSlug} />
        )}

        {activeTab === 'customers' && <AdminCustomers />}

        {activeTab === 'settings' && (
          <AdminSettings currentRestaurantSlug={activeSingleSlug} />
        )}

        {activeTab === 'health' && <AdminHealthCheck />}
      </main>
    </div>
  );
};
