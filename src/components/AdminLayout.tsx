import React, { useState, useMemo, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { RestaurantSlug } from '../types/restaurant';
import { AdminKanban } from './AdminKanban';
import { AdminKds } from './AdminKds';
import { AdminDispatch } from './AdminDispatch';
import { AdminCashRegister } from './AdminCashRegister';
import { AdminPricingCmv } from './AdminPricingCmv';
import { AdminVitrineManager } from './AdminVitrineManager';
import { AdminMenuManager } from './AdminMenuManager';
import { AdminSettings } from './AdminSettings';
import { AdminHealthCheck } from './AdminHealthCheck';
import { AdminCustomers } from './AdminCustomers';
import { AdminDevices } from './AdminDevices';
import { AdminUsers } from './AdminUsers';
import { AdminAuditLogs } from './AdminAuditLogs';
import { AdminRestaurantsManager } from './AdminRestaurantsManager';
import { AdminMasterResetModal } from './AdminMasterResetModal';
import { AdminManualOrderModal } from './AdminManualOrderModal';
import { DevicePreviewModal } from './DevicePreviewModal';
import { MobileAlertReceiver } from './MobileAlertReceiver';
import { AdminAiSalesAssistant } from './AdminAiSalesAssistant';
import { AdminMarketingCenter } from './AdminMarketingCenter';
import { AdminAiPromotions } from './AdminAiPromotions';
import { AdminPrintAgentManager } from './AdminPrintAgentManager';
import { AdminDeliveryAreas } from './AdminDeliveryAreas';
import { AdminCrmRecovery } from './AdminCrmRecovery';
import { AdminIssuesCenter } from './AdminIssuesCenter';
import { AdminSeniorAuditor } from './AdminSeniorAuditor';
import { AdminBackupRestore } from './AdminBackupRestore';
import { AdminAdministrativeSuite } from './AdminAdministrativeSuite';
import { AdminAiEngineCenter } from './AdminAiEngineCenter';
import { AdminSalesChannelsSettings } from './AdminSalesChannelsSettings';
import { NexoroBrandFooter } from './NexoroBrandFooter';
import { AdminViewAsBar, ViewAsRole } from './AdminViewAsBar';
import { AdminNexoroDashboard } from './AdminNexoroDashboard';
import { AdminNexoroToolsHub } from './AdminNexoroToolsHub';
import { NexoroOfflineSyncBar } from './NexoroOfflineSyncBar';
import { BrandLogo } from './BrandLogo';
import { BRAND_CONFIG, BRAND_NAME, BRAND_SHORT_NAME } from '../config/brand';
import {
  Lock,
  LogOut,
  LayoutDashboard,
  ChefHat,
  Bike,
  Wallet,
  Calculator,
  Store,
  Utensils,
  Settings,
  Activity,
  ArrowLeft,
  ChevronDown,
  ShieldCheck,
  Bell,
  Eye,
  Users,
  Smartphone,
  Radio,
  FileText,
  UserCheck,
  Sparkles,
  Globe,
  Plus,
  Trash2,
  Clock,
  AlertTriangle,
  TrendingUp,
  CheckCircle2,
  DollarSign,
  Flame,
  Volume2,
  VolumeX,
  RefreshCw,
  Monitor,
  Printer,
  Megaphone,
  Tag,
  MapPin,
  ShieldAlert,
  Download,
  Wrench,
  Boxes,
  BarChart3,
  Bot,
  Sliders,
  SlidersHorizontal,
} from 'lucide-react';
import { playAlertSound } from '../utils/audioAlert';
import { TableServicePanel } from './TableServicePanel';

interface AdminLayoutProps {
  onBackToApp: () => void;
  initialTab?:
    | 'dashboard'
    | 'tools_catalog'
    | 'kanban'
    | 'kds'
    | 'tables'
    | 'dispatch'
    | 'cashier'
    | 'pricing'
    | 'vitrine'
    | 'menu'
    | 'restaurants'
    | 'customers'
    | 'devices'
    | 'users'
    | 'audit'
    | 'settings'
    | 'sales_channels'
    | 'health'
    | 'ai_sales'
    | 'marketing'
    | 'promotions'
    | 'print_agent'
    | 'delivery_areas'
    | 'crm_recovery'
    | 'issues'
    | 'auditor'
    | 'backup'
    | 'admin_suite'
    | 'ai_engine'

}

export const AdminLayout: React.FC<AdminLayoutProps> = ({ onBackToApp, initialTab }) => {
  const {
    restaurants,
    orders,
    customers,
    currentUser,
    loginUser,
    logoutUser,
    checkPermission,
    connectedDevices,
    soundSettings,
    updateSoundSettings,
  } = useStore();

  const [usernameInput, setUsernameInput] = useState('admin');
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Active admin tab
  const [activeTab, setActiveTab] = useState<
    | 'dashboard'
    | 'tools_catalog'
    | 'kanban'
    | 'kds'
    | 'tables'
    | 'dispatch'
    | 'cashier'
    | 'pricing'
    | 'vitrine'
    | 'menu'
    | 'restaurants'
    | 'customers'
    | 'devices'
    | 'users'
    | 'audit'
    | 'settings'
    | 'sales_channels'
    | 'health'
    | 'ai_sales'
    | 'marketing'
    | 'promotions'
    | 'print_agent'
    | 'delivery_areas'
    | 'crm_recovery'
    | 'issues'
    | 'auditor'
    | 'backup'
    | 'admin_suite'
    | 'ai_engine'
  >(initialTab || 'dashboard');

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Simulation role: View As
  const [viewAsRole, setViewAsRole] = useState<ViewAsRole>('superadmin');

  // Modals state
  const [isMobileReceiverOpen, setIsMobileReceiverOpen] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [isManualOrderModalOpen, setIsManualOrderModalOpen] = useState(false);
  const [isDevicePreviewModalOpen, setIsDevicePreviewModalOpen] = useState(false);

  // Filter for restaurant in admin: 'all' or specific slug
  const [selectedFilterSlug, setSelectedFilterSlug] = useState<RestaurantSlug | 'all'>(
    currentUser?.restaurantSlug && currentUser.restaurantSlug !== 'all' ? (currentUser.restaurantSlug as RestaurantSlug) : 'all'
  );

  useEffect(() => {
    if (currentUser?.restaurantSlug && currentUser.restaurantSlug !== 'all') {
      setSelectedFilterSlug(currentUser.restaurantSlug as RestaurantSlug);
    } else if (currentUser?.restaurantSlug === 'all') {
      setSelectedFilterSlug((prev) => prev);
    }
  }, [currentUser?.restaurantSlug]);

  // 6 Categorias Canônicas
  const [selectedCategory, setSelectedCategory] = useState<
    'TODAS' | 'OPERAÇÃO' | 'CARDÁPIO' | 'EQUIPE' | 'GESTÃO' | 'INTELIGÊNCIA' | 'SISTEMA'
  >('TODAS');

  const isTabInCategory = (tab: string) => {
    if (selectedCategory === 'TODAS') return true;
    switch (selectedCategory) {
      case 'OPERAÇÃO':
        return ['kanban', 'kds', 'tables', 'dispatch', 'cashier', 'issues'].includes(tab);
      case 'CARDÁPIO':
        return ['menu', 'pricing', 'vitrine', 'restaurants'].includes(tab);
      case 'EQUIPE':
        return ['users', 'devices', 'audit'].includes(tab);
      case 'GESTÃO':
        return ['dashboard', 'cashier', 'customers', 'crm_recovery', 'auditor'].includes(tab);
      case 'INTELIGÊNCIA':
        return ['ai_engine', 'ai_sales', 'marketing', 'promotions'].includes(tab);
      case 'SISTEMA':
        return ['settings', 'sales_channels', 'print_agent', 'delivery_areas', 'backup', 'health', 'admin_suite', 'tools_catalog'].includes(tab);
      default:
        return true;
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setAuthError(null);

    const res = await loginUser(usernameInput.trim(), passwordInput.trim());
    setIsLoggingIn(false);

    if (!res.success) {
      setAuthError(res.error || 'Usuário ou senha incorretos.');
    }
  };

  const handleLogout = () => {
    logoutUser();
    setPasswordInput('');
  };

  // Filtered orders for operational stats
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (selectedFilterSlug !== 'all' && o.restaurantSlug !== selectedFilterSlug) return false;
      return true;
    });
  }, [orders, selectedFilterSlug]);

  // Operational metrics
  const countRecebido = filteredOrders.filter((o) => o.status === 'recebido').length;
  const countEmPreparo = filteredOrders.filter((o) => o.status === 'em_preparo').length;
  const countPronto = filteredOrders.filter((o) => o.status === 'pronto').length;
  const countEmRota = filteredOrders.filter((o) => o.status === 'saiu_para_entrega').length;
  const countEntregue = filteredOrders.filter((o) => o.status === 'entregue').length;
  const countCancelado = filteredOrders.filter((o) => o.status === 'cancelado').length;

  const validOrders = filteredOrders.filter((o) => o.status !== 'cancelado');
  const grossRevenue = validOrders.reduce((sum, o) => sum + (o.total || 0), 0);
  const averageTicket = validOrders.length > 0 ? grossRevenue / validOrders.length : 0;

  // Preparo médio REAL: minutos entre a criação e o momento em que o pedido ficou "pronto"
  const prepDurations = validOrders
    .map((o) => {
      const ready = (o.statusHistory || []).find((h) => h.status === 'pronto');
      if (!ready) return null;
      const mins = (new Date(ready.timestamp).getTime() - new Date(o.createdAt).getTime()) / 60000;
      return mins >= 0 && mins < 240 ? mins : null;
    })
    .filter((m): m is number => m !== null);
  const averagePrepMinutes = prepDurations.length
    ? Math.round(prepDurations.reduce((a, b) => a + b, 0) / prepDurations.length)
    : null;

  // Delayed orders calculation (> 25 min in prep)
  const now = Date.now();
  const delayedOrders = filteredOrders.filter((o) => {
    if (o.status === 'entregue' || o.status === 'cancelado') return false;
    const createdAtMs = new Date(o.createdAt).getTime();
    return now - createdAtMs > 25 * 60 * 1000;
  });

  const onlineDevicesCount = connectedDevices.filter((d) => d.status === 'online').length;

  // Selected restaurant object if specific
  const activeRestaurant = selectedFilterSlug !== 'all' ? restaurants[selectedFilterSlug] : null;

  // If Mobile Alert Receiver mode is active
  if (isMobileReceiverOpen) {
    return <MobileAlertReceiver onBack={() => setIsMobileReceiverOpen(false)} />;
  }

  // Not authenticated gate
  if (!currentUser) {
    return (
      <div className="h-full bg-[#07090E] flex flex-col items-center justify-center p-4">
        <div className="bg-[#0E121B] border border-[#E3BD6A]/30 rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-[0_20px_60px_rgba(0,0,0,0.9)] text-center space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-[#E3BD6A]/15 text-[#E3BD6A] border border-[#E3BD6A]/40 flex items-center justify-center mx-auto text-2xl shadow-[0_0_20px_rgba(227,189,106,0.25)]">
            <Lock className="w-8 h-8" />
          </div>

          <div>
            <h1 className="text-xl font-black text-white tracking-tight">
              Tokio<span className="text-[#E3BD6A]">inBox</span> • Acesso Administrativo
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Plataforma Profissional Multirrestaurante • Autenticação Criptografada
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-3.5 text-left">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
                Nome de Usuário
              </label>
              <input
                type="text"
                required
                value={usernameInput}
                onChange={(e) => {
                  setUsernameInput(e.target.value);
                  setAuthError(null);
                }}
                placeholder="Ex: admin, caixa, cozinha"
                className="w-full bg-[#07090E] border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#E3BD6A] font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
                Senha de Acesso
              </label>
              <input
                type="password"
                required
                value={passwordInput}
                onChange={(e) => {
                  setPasswordInput(e.target.value);
                  setAuthError(null);
                }}
                placeholder="Digite sua senha..."
                className="w-full bg-[#07090E] border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#E3BD6A]"
              />
            </div>

            {authError && (
              <p className="text-xs text-rose-400 mt-1 font-medium bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-xl">
                {authError}
              </p>
            )}

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full py-3 bg-gradient-to-r from-[#E3BD6A] via-[#FF7A00] to-[#A77A1C] hover:from-[#f3d185] hover:via-[#ff8e24] hover:to-[#bd8b24] disabled:opacity-50 text-slate-950 font-black text-xs sm:text-sm rounded-xl shadow-lg transition-all"
            >
              {isLoggingIn ? 'Verificando credenciais...' : 'Entrar no Painel de Gestão'}
            </button>
          </form>

          <div className="flex items-center justify-between text-xs pt-1">
            <button
              onClick={() => setIsMobileReceiverOpen(true)}
              className="text-[#E3BD6A] hover:text-amber-300 font-bold flex items-center gap-1"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Modo Receptor Móvel</span>
            </button>

            <button
              onClick={onBackToApp}
              className="text-slate-400 hover:text-white flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Voltar à Vitrine</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Active single restaurant slug for tabs that manage one restaurant at a time
  const activeSingleSlug: RestaurantSlug =
    selectedFilterSlug === 'all' ? 'japones' : selectedFilterSlug;

  // STRICT RBAC CHECK: Admin Panel is exclusively for super_admin or administrador/admin/gerente
  // Other profiles (caixa, cozinha, entrega, garcom) MUST NOT access Admin Management
  const hasAdminAccess =
    currentUser.role === 'super_admin' ||
    currentUser.role === 'administrador' ||
    currentUser.role === 'admin' ||
    currentUser.role === 'admin_master' ||
    currentUser.role === 'gerente';

  if (!hasAdminAccess) {
    return (
      <div className="h-full bg-[#07090E] flex flex-col items-center justify-center p-4">
        <div className="bg-[#0E121B] border border-rose-500/30 rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-[0_20px_60px_rgba(0,0,0,0.9)] text-center space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/15 text-rose-400 border border-rose-500/40 flex items-center justify-center mx-auto text-2xl shadow-[0_0_20px_rgba(244,63,94,0.25)]">
            <Lock className="w-8 h-8" />
          </div>

          <div>
            <h1 className="text-xl font-black text-white tracking-tight">
              Acesso Proibido • Perfil Restrito
            </h1>
            <p className="text-xs text-slate-400 mt-2">
              Seu perfil atual é <span className="font-bold text-amber-400 uppercase tracking-wider">{currentUser.role}</span>. Este perfil não possui permissão para acessar as configurações de gestão administrativa e financeira do sistema.
            </p>
          </div>

          <div className="p-3 bg-[#07090E] rounded-xl border border-slate-800 text-xs text-slate-400">
            Cada operador possui sua tela e rotas operacionais separadas (Caixa, KDS Cozinha, Garçom/Salão ou Expedição).
          </div>

          <div className="flex flex-col gap-2 pt-2">
            <button
              onClick={handleLogout}
              className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl transition-all"
            >
              Trocar de Usuário (Logout)
            </button>
            <button
              onClick={onBackToApp}
              className="w-full py-3 bg-[#E3BD6A] hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-lg transition-all"
            >
              Voltar ao Ambiente Operacional
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-[#07090E] text-slate-100 flex flex-col font-sans overflow-hidden">
      {/* Simulation Bar (View As) */}
      {viewAsRole !== 'superadmin' && (
        <AdminViewAsBar
          currentRole={viewAsRole}
          onChangeRole={(role) => setViewAsRole(role)}
          onExit={() => setViewAsRole('superadmin')}
        />
      )}

      {/* Offline Mode & Auto-Reconnect Bar (Ferramenta 19) */}
      <NexoroOfflineSyncBar />

      {/* 1. CABEÇALHO MULTIRRESTAURANTE PRINCIPAL */}
      <header className="sticky top-0 z-40 bg-[#0A0D14]/95 border-b border-[#E3BD6A]/20 backdrop-blur-md shadow-lg">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Brand Logo & Sistema Online */}
          <div className="flex items-center gap-3">
            <BrandLogo size="sm" showTagline={false} />
            <div>
              <div className="flex items-center gap-2">
                <span className="bg-[#E3BD6A]/15 text-[#E3BD6A] border border-[#E3BD6A]/30 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                  {currentUser.role === 'super_admin' ? 'Super Admin' : currentUser.role.replace('_', ' ')}
                </span>
                <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Sistema Online
                </span>
                {/* View As Trigger */}
                <button
                  onClick={() => setViewAsRole(viewAsRole === 'superadmin' ? 'cliente' : 'superadmin')}
                  className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-[#E3BD6A] border border-slate-700 flex items-center gap-1"
                  title="Simular visão de outro perfil"
                >
                  <Eye className="w-3 h-3" />
                  <span>Simular Visão</span>
                </button>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Operador: <strong className="text-slate-200">@{currentUser.username}</strong> ({currentUser.name})
              </p>
            </div>
          </div>

          {/* Centro / Direita: Seletor Rápido de Restaurante + Status + Ações Rápidas */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            {/* Seletor rápido de restaurante para SUPER ADMIN/ADMIN MASTER */}
            <div className="flex items-center gap-2 bg-[#0E121B] border border-[#E3BD6A]/30 rounded-xl px-3 py-1.5 shadow-inner">
              <span className="text-xs text-slate-400 font-bold whitespace-nowrap">Restaurante:</span>
              <select
                value={selectedFilterSlug}
                disabled={currentUser.restaurantSlug !== 'all'}
                onChange={(e) => setSelectedFilterSlug(e.target.value as any)}
                className="bg-transparent text-xs text-[#E3BD6A] font-black focus:outline-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-70"
              >
                {currentUser.restaurantSlug === 'all' && (
                  <option value="all" className="bg-[#0E121B] text-white">
                    🌐 Todas as Lojas (Rede)
                  </option>
                )}
                {Object.values(restaurants)
                  .filter((r) => currentUser.restaurantSlug === 'all' || r.slug === currentUser.restaurantSlug)
                  .map((r) => (
                    <option key={r.slug} value={r.slug} className="bg-[#0E121B] text-white">
                      {r.emoji} {r.name} {r.isOpen ? '• Aberto' : '• Fechado'}
                    </option>
                  ))}
              </select>

              {/* Status do restaurante selecionado */}
              {activeRestaurant && (
                <span
                  className={`text-[10px] font-black px-2 py-0.5 rounded-md border shrink-0 ${
                    activeRestaurant.isOpen
                      ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/30'
                      : 'bg-rose-950/80 text-rose-300 border-rose-500/30'
                  }`}
                >
                  {activeRestaurant.isOpen ? 'Aberto' : 'Fechado'}
                </span>
              )}
            </div>

            {/* Novo Pedido Manual (Balcão / Telefone / WhatsApp) */}
            <button
              onClick={() => setIsManualOrderModalOpen(true)}
              className="px-3 py-1.5 bg-gradient-to-r from-[#E3BD6A] to-[#FF7A00] hover:from-[#f3d185] hover:to-[#ff8e24] text-slate-950 text-xs font-black rounded-xl shadow-[0_0_15px_rgba(227,189,106,0.3)] flex items-center gap-1.5 transition-all shrink-0"
              title="Lançar pedido manual rápido"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Novo Pedido</span>
            </button>

            {/* Alertas & Notificações / Som */}
            <button
              onClick={() => {
                updateSoundSettings({ enabled: !soundSettings.enabled });
                if (!soundSettings.enabled) {
                  playAlertSound(soundSettings.soundType, soundSettings.volume);
                }
              }}
              className={`p-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-colors shrink-0 ${
                soundSettings.enabled
                  ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/30 hover:bg-emerald-900/60'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
              }`}
              title={soundSettings.enabled ? 'Alertas sonoros ativos (Clique para silenciar)' : 'Alertas sonoros desativados (Clique para ativar)'}
            >
              {soundSettings.enabled ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
              {countRecebido > 0 && (
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
              )}
            </button>

            {/* Pré-visualização Multi-Dispositivo */}
            <button
              onClick={() => setIsDevicePreviewModalOpen(true)}
              className="p-2 bg-[#0E121B] hover:bg-slate-800 text-slate-300 hover:text-[#E3BD6A] border border-slate-800 rounded-xl transition-colors shrink-0"
              title="Simulador de Telas (Mobile, Tablet, Desktop, KDS)"
            >
              <Monitor className="w-4 h-4" />
            </button>

            {/* Botão Vitrine Principal */}
            <button
              onClick={onBackToApp}
              className="px-3 py-1.5 bg-[#0E121B] hover:bg-[#141A26] text-slate-200 hover:text-[#E3BD6A] border border-[#E3BD6A]/30 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors shrink-0"
              title="Ir para a Vitrine Pública de Restaurantes"
            >
              <Store className="w-3.5 h-3.5 text-[#E3BD6A]" />
              <span className="hidden sm:inline">Vitrine Principal</span>
            </button>

            {/* Botão Zerar Pedidos do Dia (Super Admin Exclusivo) */}
            {currentUser.role === 'super_admin' && (
              <button
                onClick={() => setIsResetModalOpen(true)}
                className="p-2 text-rose-400 hover:text-rose-300 bg-rose-950/30 hover:bg-rose-900/40 border border-rose-500/30 rounded-xl transition-colors shrink-0"
                title="Zerar Pedidos do Dia com Backup Seguro"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}

            {/* Logout */}
            <button
              onClick={handleLogout}
              className="p-2 text-slate-400 hover:text-rose-400 bg-[#0E121B] hover:bg-slate-800 rounded-xl border border-slate-800 transition-colors shrink-0"
              title="Encerrar Sessão"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 2. RESUMO OPERACIONAL — PAINEL MODERNO E LIMPO */}
        <div className="bg-[#07090E] border-t border-[#E3BD6A]/15 py-2.5 px-4 sm:px-6 lg:px-8">
          <div className="max-w-[1600px] mx-auto flex items-center justify-between gap-2 overflow-x-auto no-scrollbar">
            {/* Status dos Pedidos */}
            <div className="flex items-center gap-2 shrink-0">
              {/* Recebidos */}
              <div className={`px-2.5 py-1.5 rounded-xl border flex items-center gap-2 ${
                countRecebido > 0
                  ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 animate-pulse'
                  : 'bg-[#0E121B] border-slate-800 text-slate-400'
              }`}>
                <span className="text-[10px] uppercase font-black">Recebidos</span>
                <span className="text-xs font-black bg-amber-500 text-slate-950 px-1.5 py-0.2 rounded-md">
                  {countRecebido}
                </span>
              </div>

              {/* Em Preparo */}
              <div className="px-2.5 py-1.5 rounded-xl border bg-[#0E121B] border-slate-800 flex items-center gap-2">
                <span className="text-[10px] uppercase font-bold text-slate-400">Em Preparo</span>
                <span className="text-xs font-black text-orange-400">
                  {countEmPreparo}
                </span>
              </div>

              {/* Prontos */}
              <div className="px-2.5 py-1.5 rounded-xl border bg-[#0E121B] border-slate-800 flex items-center gap-2">
                <span className="text-[10px] uppercase font-bold text-slate-400">Prontos</span>
                <span className="text-xs font-black text-emerald-400">
                  {countPronto}
                </span>
              </div>

              {/* Em Rota */}
              <div className="px-2.5 py-1.5 rounded-xl border bg-[#0E121B] border-slate-800 flex items-center gap-2">
                <span className="text-[10px] uppercase font-bold text-slate-400">Em Rota</span>
                <span className="text-xs font-black text-cyan-400">
                  {countEmRota}
                </span>
              </div>

              {/* Entregues */}
              <div className="px-2.5 py-1.5 rounded-xl border bg-[#0E121B] border-slate-800 flex items-center gap-2">
                <span className="text-[10px] uppercase font-bold text-slate-400">Entregues</span>
                <span className="text-xs font-black text-slate-300">
                  {countEntregue}
                </span>
              </div>

              {/* Cancelados */}
              <div className="px-2.5 py-1.5 rounded-xl border bg-[#0E121B] border-slate-800 flex items-center gap-2">
                <span className="text-[10px] uppercase font-bold text-slate-400">Cancelados</span>
                <span className="text-xs font-black text-rose-400">
                  {countCancelado}
                </span>
              </div>
            </div>

            {/* Métricas Financeiras & Operacionais */}
            <div className="flex items-center gap-3 shrink-0 ml-auto pl-3 border-l border-slate-800">
              {/* Faturamento Bruto */}
              <div className="flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-[#E3BD6A]" />
                <span className="text-[11px] text-slate-400 font-medium">Faturamento:</span>
                <span className="text-xs font-black text-[#E3BD6A]">
                  R$ {grossRevenue.toFixed(2)}
                </span>
              </div>

              {/* Ticket Médio */}
              <div className="flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-[11px] text-slate-400 font-medium">Ticket Médio:</span>
                <span className="text-xs font-black text-white">
                  R$ {averageTicket.toFixed(2)}
                </span>
              </div>

              {/* Tempo Médio */}
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-[11px] text-slate-400 font-medium">Preparo Médio:</span>
                <span className="text-xs font-black text-white">
                  {averagePrepMinutes !== null ? `${averagePrepMinutes} min` : '—'}
                </span>
              </div>

              {/* Alerta de Atraso */}
              {delayedOrders.length > 0 ? (
                <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-950/70 border border-rose-500/40 text-rose-300 animate-pulse">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                  <span className="text-[10px] font-black uppercase">
                    {delayedOrders.length} em atraso!
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-1 text-[10px] text-emerald-400 font-bold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Sem atrasos</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* BARRA DAS 6 CATEGORIAS CANÔNICAS */}
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 pt-2.5 pb-1 flex items-center gap-1.5 border-t border-slate-800/80 overflow-x-auto no-scrollbar">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 mr-1 shrink-0">
            Categorias:
          </span>
          {(['TODAS', 'OPERAÇÃO', 'CARDÁPIO', 'EQUIPE', 'GESTÃO', 'INTELIGÊNCIA', 'SISTEMA'] as const).map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 rounded-xl text-[11px] font-black tracking-wide uppercase transition-all shrink-0 ${
                selectedCategory === cat
                  ? 'bg-gradient-to-r from-amber-500 to-[#FF7A00] text-slate-950 shadow-md shadow-amber-500/20'
                  : 'bg-slate-900/90 text-slate-400 border border-slate-800 hover:text-white hover:border-slate-700'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* 3. BARRA DE NAVEGAÇÃO DE ABAS — quebra em várias linhas, nunca corta nem exige rolagem */}
        <div className="max-w-[1600px] mx-auto px-3 sm:px-5 flex flex-wrap items-center gap-1.5 border-t border-slate-800/80 py-2 admin-compact-tabs">
          {/* 01. Painel Geral Tab (food nexoro.png) */}
          {isTabInCategory('dashboard') && (
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                activeTab === 'dashboard'
                  ? 'bg-[#D4AF37] text-slate-950 font-black shadow-[0_0_15px_rgba(212,175,55,0.4)]'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <Boxes className="w-3.5 h-3.5" />
              <span>01. Painel Geral</span>
            </button>
          )}

          {/* Ferramentas (23 Módulos) Tab (food nexoro2.png) */}
          {isTabInCategory('tools_catalog') && (
            <button
              onClick={() => setActiveTab('tools_catalog')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                activeTab === 'tools_catalog'
                  ? 'bg-[#D4AF37] text-slate-950 font-black shadow-[0_0_15px_rgba(212,175,55,0.4)]'
                  : 'text-[#D4AF37] bg-[#D4AF37]/10 hover:bg-[#D4AF37]/20 border border-[#D4AF37]/30'
              }`}
            >
              <Wrench className="w-3.5 h-3.5" />
              <span>Ferramentas</span>
              <span className="bg-[#D4AF37] text-slate-950 text-[10px] px-1.5 py-0.2 rounded-full font-black">
                23
              </span>
            </button>
          )}

          {/* Central de IA (AI Engine) Tab */}
          {isTabInCategory('ai_engine') && (
            <button
              onClick={() => setActiveTab('ai_engine')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                activeTab === 'ai_engine'
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-black shadow-[0_0_15px_rgba(147,51,234,0.5)]'
                  : 'text-purple-400 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30'
              }`}
            >
              <Bot className="w-3.5 h-3.5" />
              <span>Central de IA</span>
              <span className="bg-purple-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-black">
                AI
              </span>
            </button>
          )}

          {/* 20. Suite Admin Tab */}
          {isTabInCategory('admin_suite') && (
            <button
              onClick={() => setActiveTab('admin_suite')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                activeTab === 'admin_suite'
                  ? 'bg-[#D4AF37] text-slate-950 font-black shadow-[0_0_15px_rgba(212,175,55,0.4)]'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <Sliders className="w-3.5 h-3.5 text-[#D4AF37]" />
              <span>20. Suite Admin</span>
            </button>
          )}

          {/* Kanban Tab */}
          {isTabInCategory('kanban') && (
            <button
              onClick={() => setActiveTab('kanban')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                activeTab === 'kanban'
                  ? 'bg-[#E3BD6A] text-slate-950 font-black shadow-[0_0_15px_rgba(227,189,106,0.3)]'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>Kanban Pedidos</span>
              {countRecebido > 0 && (
                <span className="bg-rose-600 text-white text-[10px] px-1.5 py-0.2 rounded-full font-black animate-pulse">
                  {countRecebido}
                </span>
              )}
            </button>
          )}

          {/* KDS Cozinha Tab */}
          {isTabInCategory('kds') && (
            <button
              onClick={() => setActiveTab('kds')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                activeTab === 'kds'
                  ? 'bg-[#E3BD6A] text-slate-950 font-black shadow-[0_0_15px_rgba(227,189,106,0.3)]'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <ChefHat className="w-3.5 h-3.5" />
              <span>Cozinha KDS</span>
              {countEmPreparo > 0 && (
                <span className="bg-orange-500 text-slate-950 text-[10px] px-1.5 py-0.2 rounded-full font-black">
                  {countEmPreparo}
                </span>
              )}
            </button>
          )}

          {/* Salão & Mesas Tab */}
          {isTabInCategory('tables') && (
            <button
              onClick={() => setActiveTab('tables')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                activeTab === 'tables'
                  ? 'bg-[#E3BD6A] text-slate-950 font-black shadow-[0_0_15px_rgba(227,189,106,0.3)]'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <Utensils className="w-3.5 h-3.5" />
              <span>Salão &amp; Mesas</span>
            </button>
          )}

          {/* Despacho & Entregas Tab */}
          {isTabInCategory('dispatch') && (
            <button
              onClick={() => setActiveTab('dispatch')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                activeTab === 'dispatch'
                  ? 'bg-[#E3BD6A] text-slate-950 font-black shadow-[0_0_15px_rgba(227,189,106,0.3)]'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <Bike className="w-3.5 h-3.5" />
              <span>Despacho &amp; Motoboys</span>
              {countPronto > 0 && (
                <span className="bg-emerald-500 text-slate-950 text-[10px] px-1.5 py-0.2 rounded-full font-black">
                  {countPronto}
                </span>
              )}
            </button>
          )}

          {/* Caixa & Turno Tab */}
          {isTabInCategory('cashier') && (
            <button
              onClick={() => setActiveTab('cashier')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                activeTab === 'cashier'
                  ? 'bg-[#E3BD6A] text-slate-950 font-black shadow-[0_0_15px_rgba(227,189,106,0.3)]'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <Wallet className="w-3.5 h-3.5" />
              <span>Caixa &amp; Turnos</span>
            </button>
          )}

          {/* Precificação & CMV Tab */}
          {(currentUser.role === 'super_admin' || currentUser.permissions?.can_change_prices) && isTabInCategory('pricing') && (
            <button
              onClick={() => setActiveTab('pricing')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                activeTab === 'pricing'
                  ? 'bg-[#E3BD6A] text-slate-950 font-black shadow-[0_0_15px_rgba(227,189,106,0.3)]'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <Calculator className="w-3.5 h-3.5" />
              <span>Precificação &amp; CMV</span>
            </button>
          )}

          {/* Gestor da Vitrine Principal Tab */}
          {(currentUser.role === 'super_admin' || currentUser.permissions?.can_configure_restaurant) && isTabInCategory('vitrine') && (
            <button
              onClick={() => setActiveTab('vitrine')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                activeTab === 'vitrine'
                  ? 'bg-[#E3BD6A] text-slate-950 font-black shadow-[0_0_15px_rgba(227,189,106,0.3)]'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-[#E3BD6A]" />
              <span>Vitrine Principal</span>
            </button>
          )}

          {/* Cardápios & Preços */}
          {(currentUser.role === 'super_admin' || currentUser.permissions?.can_edit_menu) && isTabInCategory('menu') && (
            <button
              onClick={() => setActiveTab('menu')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                activeTab === 'menu'
                  ? 'bg-[#E3BD6A] text-slate-950 font-black shadow-[0_0_15px_rgba(227,189,106,0.3)]'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <Utensils className="w-3.5 h-3.5" />
              <span>Cardápios</span>
            </button>
          )}

          {/* Lojas & Links HTTP Tab */}
          {isTabInCategory('restaurants') && (
            <button
              onClick={() => setActiveTab('restaurants')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                activeTab === 'restaurants'
                  ? 'bg-[#E3BD6A] text-slate-950 font-black shadow-[0_0_15px_rgba(227,189,106,0.3)]'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Lojas HTTP</span>
            </button>
          )}

          {/* Clientes Tab */}
          {isTabInCategory('customers') && (
            <button
              onClick={() => setActiveTab('customers')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                activeTab === 'customers'
                  ? 'bg-[#E3BD6A] text-slate-950 font-black shadow-[0_0_15px_rgba(227,189,106,0.3)]'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Clientes CRM</span>
              {customers.length > 0 && (
                <span className="bg-slate-800 text-[#E3BD6A] text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                  {customers.length}
                </span>
              )}
            </button>
          )}

          {/* Dispositivos Conectados Tab */}
          {isTabInCategory('devices') && (
            <button
              onClick={() => setActiveTab('devices')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                activeTab === 'devices'
                  ? 'bg-[#E3BD6A] text-slate-950 font-black shadow-[0_0_15px_rgba(227,189,106,0.3)]'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Celulares</span>
              {onlineDevicesCount > 0 && (
                <span className="bg-emerald-500/30 text-emerald-300 text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                  {onlineDevicesCount}
                </span>
              )}
            </button>
          )}

          {/* Usuários Tab */}
          {(currentUser.role === 'super_admin' || currentUser.permissions?.can_manage_users) && isTabInCategory('users') && (
            <button
              onClick={() => setActiveTab('users')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                activeTab === 'users'
                  ? 'bg-[#E3BD6A] text-slate-950 font-black shadow-[0_0_15px_rgba(227,189,106,0.3)]'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Usuários &amp; RBAC</span>
            </button>
          )}

          {/* Auditoria Tab */}
          {isTabInCategory('audit') && (
            <button
              onClick={() => setActiveTab('audit')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                activeTab === 'audit'
                  ? 'bg-[#E3BD6A] text-slate-950 font-black shadow-[0_0_15px_rgba(227,189,106,0.3)]'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Auditoria</span>
            </button>
          )}

          {/* Configurações Tab */}
          {(currentUser.role === 'super_admin' || currentUser.permissions?.can_configure_alerts) && isTabInCategory('settings') && (
            <button
              onClick={() => setActiveTab('settings')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                activeTab === 'settings'
                  ? 'bg-[#E3BD6A] text-slate-950 font-black shadow-[0_0_15px_rgba(227,189,106,0.3)]'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Configurações</span>
            </button>
          )}

          {/* Canais de Venda Tab */}
          {(currentUser.role === 'super_admin' || currentUser.permissions?.can_configure_restaurant) && isTabInCategory('sales_channels') && (
            <button
              onClick={() => setActiveTab('sales_channels')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                activeTab === 'sales_channels'
                  ? 'bg-indigo-600 text-white font-black shadow-[0_0_15px_rgba(79,70,229,0.4)]'
                  : 'text-indigo-400 hover:text-white hover:bg-indigo-950/40'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Canais de Venda</span>
            </button>
          )}

          {/* Central de Problemas & Exceções */}
          {isTabInCategory('issues') && (
            <button
              onClick={() => setActiveTab('issues')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                activeTab === 'issues'
                  ? 'bg-rose-600 text-white font-black shadow-[0_0_15px_rgba(225,29,72,0.4)]'
                  : 'text-rose-400 hover:text-white hover:bg-rose-950/40'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Problemas &amp; Alertas</span>
              {delayedOrders.length > 0 && (
                <span className="bg-rose-950 border border-rose-500 text-rose-300 text-[10px] px-1.5 py-0.2 rounded-full font-bold animate-pulse">
                  {delayedOrders.length}
                </span>
              )}
            </button>
          )}

          {/* Assistente de Vendas IA */}
          {isTabInCategory('ai_sales') && (
            <button
              onClick={() => setActiveTab('ai_sales')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                activeTab === 'ai_sales'
                  ? 'bg-[#E3BD6A] text-slate-950 font-black shadow-[0_0_15px_rgba(227,189,106,0.3)]'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-[#E3BD6A]" />
              <span>Vendas IA</span>
            </button>
          )}

          {/* Central de Marketing */}
          {isTabInCategory('marketing') && (
            <button
              onClick={() => setActiveTab('marketing')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                activeTab === 'marketing'
                  ? 'bg-[#E3BD6A] text-slate-950 font-black shadow-[0_0_15px_rgba(227,189,106,0.3)]'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <Megaphone className="w-3.5 h-3.5" />
              <span>Marketing</span>
            </button>
          )}

          {/* Promoções IA */}
          {isTabInCategory('promotions') && (
            <button
              onClick={() => setActiveTab('promotions')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                activeTab === 'promotions'
                  ? 'bg-[#E3BD6A] text-slate-950 font-black shadow-[0_0_15px_rgba(227,189,106,0.3)]'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <Tag className="w-3.5 h-3.5" />
              <span>Promoções</span>
            </button>
          )}

          {/* Print Agent Térmico */}
          {isTabInCategory('print_agent') && (
            <button
              onClick={() => setActiveTab('print_agent')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                activeTab === 'print_agent'
                  ? 'bg-[#E3BD6A] text-slate-950 font-black shadow-[0_0_15px_rgba(227,189,106,0.3)]'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Agent</span>
            </button>
          )}

          {/* Áreas de Entrega */}
          {isTabInCategory('delivery_areas') && (
            <button
              onClick={() => setActiveTab('delivery_areas')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                activeTab === 'delivery_areas'
                  ? 'bg-[#E3BD6A] text-slate-950 font-black shadow-[0_0_15px_rgba(227,189,106,0.3)]'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>Áreas &amp; Taxas</span>
            </button>
          )}

          {/* CRM & Carrinhos Abandonados */}
          {isTabInCategory('crm_recovery') && (
            <button
              onClick={() => setActiveTab('crm_recovery')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                activeTab === 'crm_recovery'
                  ? 'bg-[#E3BD6A] text-slate-950 font-black shadow-[0_0_15px_rgba(227,189,106,0.3)]'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>CRM &amp; Carrinho</span>
            </button>
          )}

          {/* Auditor Sênior */}
          {isTabInCategory('auditor') && (
            <button
              onClick={() => setActiveTab('auditor')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                activeTab === 'auditor'
                  ? 'bg-cyan-500 text-slate-950 font-black shadow-[0_0_15px_rgba(6,182,212,0.4)]'
                  : 'text-cyan-400 hover:text-white hover:bg-cyan-950/40'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Auditor Sênior</span>
            </button>
          )}

          {/* Backup & Restauração */}
          {isTabInCategory('backup') && (
            <button
              onClick={() => setActiveTab('backup')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                activeTab === 'backup'
                  ? 'bg-[#E3BD6A] text-slate-950 font-black shadow-[0_0_15px_rgba(227,189,106,0.3)]'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <Download className="w-3.5 h-3.5" />
              <span>Backup Seguro</span>
            </button>
          )}

          {/* Diagnóstico Tab */}
          {isTabInCategory('health') && (
            <button
              onClick={() => setActiveTab('health')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                activeTab === 'health'
                  ? 'bg-[#E3BD6A] text-slate-950 font-black shadow-[0_0_15px_rgba(227,189,106,0.3)]'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Diagnóstico</span>
            </button>
          )}
        </div>
      </header>

      {/* 4. CONTEÚDO DA ABA ATIVA */}
      <main className="flex-1 min-h-0 max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full overflow-y-auto">
        {activeTab === 'dashboard' && (
          <AdminNexoroDashboard
            onNavigateTab={(tab) => setActiveTab(tab as any)}
            selectedSlug={selectedFilterSlug}
            onSelectSlug={(slug) => setSelectedFilterSlug(slug)}
            onOpenManualOrder={() => setIsManualOrderModalOpen(true)}
          />
        )}

        {activeTab === 'tools_catalog' && (
          <AdminNexoroToolsHub
            onSelectTab={(tab) => setActiveTab(tab as any)}
            onOpenDevicePreview={() => setIsDevicePreviewModalOpen(true)}
          />
        )}

        {activeTab === 'kanban' && (
          <AdminKanban selectedFilterSlug={selectedFilterSlug} />
        )}

        {activeTab === 'kds' && (
          <AdminKds selectedFilterSlug={selectedFilterSlug} />
        )}

        {activeTab === 'tables' && (
          <TableServicePanel
            onBackToApp={() => setActiveTab('dashboard')}
            onOpenAdmin={() => setActiveTab('dashboard')}
          />
        )}

        {activeTab === 'dispatch' && (
          <AdminDispatch selectedFilterSlug={selectedFilterSlug} />
        )}

        {activeTab === 'cashier' && (
          <AdminCashRegister />
        )}

        {activeTab === 'pricing' && (
          <AdminPricingCmv selectedFilterSlug={selectedFilterSlug} />
        )}

        {activeTab === 'vitrine' && (
          <AdminVitrineManager />
        )}

        {activeTab === 'menu' && (
          <AdminMenuManager currentRestaurantSlug={activeSingleSlug} />
        )}

        {activeTab === 'restaurants' && (
          <AdminRestaurantsManager
            onOpenStorePreview={(slug) => {
              setSelectedFilterSlug(slug);
              onBackToApp();
            }}
          />
        )}

        {activeTab === 'customers' && <AdminCustomers />}

        {activeTab === 'devices' && (
          <AdminDevices onOpenMobileReceiver={() => setIsMobileReceiverOpen(true)} />
        )}

        {activeTab === 'users' && <AdminUsers />}

        {activeTab === 'audit' && <AdminAuditLogs />}

        {activeTab === 'ai_sales' && (
          <AdminAiSalesAssistant selectedSlug={selectedFilterSlug} />
        )}

        {activeTab === 'marketing' && (
          <AdminMarketingCenter selectedSlug={selectedFilterSlug} />
        )}

        {activeTab === 'promotions' && (
          <AdminAiPromotions selectedSlug={selectedFilterSlug} />
        )}

        {activeTab === 'print_agent' && (
          <AdminPrintAgentManager selectedSlug={selectedFilterSlug} />
        )}

        {activeTab === 'delivery_areas' && (
          <AdminDeliveryAreas selectedSlug={selectedFilterSlug} />
        )}

        {activeTab === 'crm_recovery' && (
          <AdminCrmRecovery selectedSlug={selectedFilterSlug} />
        )}

        {activeTab === 'issues' && (
          <AdminIssuesCenter selectedSlug={selectedFilterSlug} />
        )}

        {activeTab === 'auditor' && <AdminSeniorAuditor />}

        {activeTab === 'backup' && (
          <AdminBackupRestore selectedSlug={selectedFilterSlug} />
        )}

        {activeTab === 'admin_suite' && (
          <AdminAdministrativeSuite
            selectedFilterSlug={selectedFilterSlug}
            onNavigateTab={(tab) => setActiveTab(tab)}
          />
        )}

        {activeTab === 'ai_engine' && (
          <AdminAiEngineCenter selectedFilterSlug={selectedFilterSlug} />
        )}

        {activeTab === 'settings' && (
          <AdminSettings currentRestaurantSlug={activeSingleSlug} />
        )}

        {activeTab === 'sales_channels' && (
          <AdminSalesChannelsSettings />
        )}

        {activeTab === 'health' && <AdminHealthCheck />}

        {/* 👑 DESIGN SYSTEM & BRAND SHOWCASE FOOTER (food nexoro.png) */}
        <NexoroBrandFooter />
      </main>

      {/* 5. MODAIS OPERACIONAIS */}
      {/* Modal de Pedido Manual (Balcão / Telefone) */}
      <AdminManualOrderModal
        isOpen={isManualOrderModalOpen}
        onClose={() => setIsManualOrderModalOpen(false)}
        defaultSlug={activeSingleSlug}
      />

      {/* Modal de Reset Master com Backup */}
      <AdminMasterResetModal
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
      />

      {/* Modal Simulador de Dispositivos */}
      <DevicePreviewModal
        isOpen={isDevicePreviewModalOpen}
        onClose={() => setIsDevicePreviewModalOpen(false)}
      />
    </div>
  );
};
