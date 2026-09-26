import React, { useState, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { RestaurantSlug, MenuItem } from '../types/restaurant';
import {
  Bot,
  Sparkles,
  Wine,
  BarChart3,
  ChefHat,
  ShieldCheck,
  Play,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Settings,
  History,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Layers,
  Volume2,
  RefreshCw,
  Search,
  Filter,
  Save,
  Check,
  Eye,
  Sliders,
  AlertCircle,
  Percent,
  DollarSign,
  HelpCircle,
} from 'lucide-react';

interface AdminAiEngineCenterProps {
  selectedFilterSlug: RestaurantSlug | 'all';
}

type TabType = 'overview' | 'concierge' | 'pairing' | 'cmv' | 'kitchen' | 'simulator' | 'logs';

export const AdminAiEngineCenter: React.FC<AdminAiEngineCenterProps> = ({ selectedFilterSlug }) => {
  const {
    currentRestaurant,
    restaurants,
    menuItems,
    orders,
    currentUser,
    checkPermission,
    updateMenuItem,
  } = useStore();

  // Active restaurant for multi-tenant isolation
  const activeSlug: RestaurantSlug =
    selectedFilterSlug !== 'all' ? selectedFilterSlug : currentRestaurant.slug;
  const activeRestaurant = restaurants[activeSlug] || currentRestaurant;

  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [priceSuggestions, setPriceSuggestions] = useState<any[]>([]);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // CMV Diagnostic State
  const [cmvPeriodDays, setCmvPeriodDays] = useState<number>(30);
  const [cmvDiagnostic, setCmvDiagnostic] = useState<any>(null);
  const [cmvLoading, setCmvLoading] = useState(false);

  // Simulator State
  const [simScenario, setSimScenario] = useState<'cliente' | 'carrinho' | 'cmv' | 'cozinha'>('cliente');
  const [simCustomInput, setSimCustomInput] = useState<string>('');
  const [simResult, setSimResult] = useState<any>(null);
  const [simLoading, setSimLoading] = useState(false);

  // Load config & suggestions
  const fetchEngineData = async () => {
    setLoading(true);
    try {
      const [resConfig, resLogs, resSuggestions] = await Promise.all([
        fetch(`/api/ai-engine/config?restaurantSlug=${activeSlug}`),
        fetch(`/api/ai-engine/logs?restaurantSlug=${activeSlug}`),
        fetch(`/api/ai-engine/price-suggestions?restaurantSlug=${activeSlug}`),
      ]);

      const dataConfig = await resConfig.json();
      const dataLogs = await resLogs.json();
      const dataSuggestions = await resSuggestions.json();

      if (dataConfig.success) setConfig(dataConfig.config);
      if (dataLogs.success) setAuditLogs(dataLogs.logs || []);
      if (dataSuggestions.success) setPriceSuggestions(dataSuggestions.suggestions || []);
    } catch (err) {
      console.error('Error loading AI Engine data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEngineData();
  }, [activeSlug]);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Save Module Config
  const handleSaveModuleConfig = async (moduleId: string, updates: any) => {
    try {
      const res = await fetch('/api/ai-engine/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantSlug: activeSlug,
          moduleId,
          updates,
          operatorUsername: currentUser?.username || 'admin',
          operatorRole: currentUser?.role || 'gerente',
        }),
      });

      const data = await res.json();
      if (data.success) {
        setConfig(data.config);
        showToast(`Configurações de ${moduleId} salvas com sucesso!`);
        fetchEngineData();
      } else {
        showToast(data.error || 'Erro ao salvar configurações', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Erro de conexão', 'error');
    }
  };

  // Toggle Module Enable/Disable
  const handleToggleModule = (moduleId: string, currentValue: boolean) => {
    handleSaveModuleConfig(moduleId, { enabled: !currentValue });
  };

  // Run CMV Analysis
  const handleRunCmvAnalysis = async () => {
    setCmvLoading(true);
    try {
      const activeMenuItems = menuItems.filter((m) => m.restaurantSlug === activeSlug);
      const res = await fetch('/api/ai-engine/menu-engineering', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantSlug: activeSlug,
          restaurantName: activeRestaurant.name,
          periodDays: cmvPeriodDays,
          menuItems: activeMenuItems,
          orders,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setCmvDiagnostic(data);
        fetchEngineData(); // refresh suggestions
        showToast('Engenharia de Cardápio atualizada!');
      } else {
        showToast('Erro ao processar análise de CMV', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Erro ao conectar ao motor de IA', 'error');
    } finally {
      setCmvLoading(false);
    }
  };

  // Resolve Price Suggestion (Human In The Loop)
  const handleResolvePrice = async (suggestionId: string, action: 'aprovar' | 'ignorar') => {
    try {
      const res = await fetch('/api/ai-engine/resolve-price', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          suggestionId,
          action,
          operatorUsername: currentUser?.username || 'admin',
          operatorRole: currentUser?.role || 'gerente',
        }),
      });

      const data = await res.json();
      if (data.success) {
        if (action === 'aprovar' && data.suggestion) {
          // Update real price in store if approved
          const product = menuItems.find((m) => m.id === data.suggestion.productId);
          if (product) {
            updateMenuItem({ ...product, price: data.suggestion.suggestedPrice });
          }
          showToast(`Preço do produto atualizado para R$ ${data.suggestion.suggestedPrice.toFixed(2)} e registrado em LOG!`);
        } else {
          showToast('Sugestão arquivada.');
        }
        fetchEngineData();
      } else {
        showToast(data.error || 'Erro ao processar sugestão', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Erro ao comunicar com o servidor', 'error');
    }
  };

  // Run Simulation
  const handleRunSimulation = async () => {
    setSimLoading(true);
    try {
      const activeMenuItems = menuItems.filter((m) => m.restaurantSlug === activeSlug);
      const res = await fetch('/api/ai-engine/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantSlug: activeSlug,
          scenario: simScenario,
          customInput: simCustomInput,
          menuItems: activeMenuItems,
          orders,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSimResult(data);
        fetchEngineData(); // refresh logs
      } else {
        showToast(data.error || 'Erro na simulação', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Erro ao simular', 'error');
    } finally {
      setSimLoading(false);
    }
  };

  return (
    <div className="space-y-6 text-slate-100 animate-fadeIn">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2 text-xs font-bold border transition-all ${
            toastMessage.type === 'success'
              ? 'bg-emerald-950 text-emerald-300 border-emerald-500/50'
              : 'bg-rose-950 text-rose-300 border-rose-500/50'
          }`}
        >
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-400" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Main Header */}
      <div className="bg-[#12151C] border border-[#222836] rounded-2xl p-4 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-600 to-amber-500 flex items-center justify-center text-white shadow-lg">
            <Bot className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-black text-white uppercase tracking-wider">
                Central de Inteligência Artificial
              </h1>
              <span className="bg-purple-500/20 text-purple-300 border border-purple-500/40 text-[10px] font-black px-2 py-0.5 rounded-full uppercase">
                AI Engine
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Restaurante ativo: <strong className="text-amber-400">{activeRestaurant.name}</strong> • Governança, auditoria e supervisão humana obrigatória.
            </p>
          </div>
        </div>

        {/* Quick Indicators Status Bar */}
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <div className="bg-[#181D26] px-3 py-1.5 rounded-xl border border-slate-800 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-slate-400 font-medium">Motor:</span>
            <strong className="text-emerald-400 font-bold">Online</strong>
          </div>
          <div className="bg-[#181D26] px-3 py-1.5 rounded-xl border border-slate-800 flex items-center gap-2">
            <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />
            <span className="text-slate-400">Auditoria:</span>
            <strong className="text-white font-mono">{auditLogs.length} logs</strong>
          </div>
          <button
            onClick={fetchEngineData}
            disabled={loading}
            className="p-2 bg-[#181D26] hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl border border-slate-800 transition-colors"
            title="Atualizar dados"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-800/80">
        {[
          { id: 'overview', label: 'Visão Geral & Módulos', icon: Layers },
          { id: 'concierge', label: '1. Atendente Virtual', icon: Bot },
          { id: 'pairing', label: '2. Smart Pairing', icon: Wine },
          { id: 'cmv', label: '3. Engenheiro CMV & Preços', icon: BarChart3 },
          { id: 'kitchen', label: '4. Smart KDS', icon: ChefHat },
          { id: 'simulator', label: 'Simular IA', icon: Play },
          { id: 'logs', label: 'Histórico & Logs', icon: History },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-900/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#181D26]'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: OVERVIEW & 4 MODULES CARDS */}
      {activeTab === 'overview' && config && (
        <div className="space-y-6">
          {/* 4 Core Modules Bento Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {/* Module 1: Concierge */}
            <div className="bg-[#151922] border border-[#272F3E] rounded-2xl p-4 sm:p-5 flex flex-col justify-between shadow-lg relative overflow-hidden group">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center border border-purple-500/30">
                    <Bot className="w-5 h-5" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase border ${
                        config.customer_concierge.enabled
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}
                    >
                      {config.customer_concierge.enabled ? '🟢 Ativo' : '⚪ Inativo'}
                    </span>
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">Atendente Virtual & Concierge</h3>
                  <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                    Chat com cliente no cardápio, tira dúvidas de ingredientes reais e sugere pratos.
                  </p>
                </div>
                <div className="bg-[#1C212D] p-2.5 rounded-xl border border-slate-800/80 text-[11px] space-y-1">
                  <div className="flex justify-between text-slate-400">
                    <span>Nome do Bot:</span>
                    <strong className="text-white">{config.customer_concierge.botName}</strong>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Tom de Voz:</span>
                    <strong className="text-purple-300 capitalize">{config.customer_concierge.personality}</strong>
                  </div>
                </div>
              </div>
              <div className="pt-4 flex items-center justify-between border-t border-slate-800/80 mt-4">
                <button
                  onClick={() => handleToggleModule('customer_concierge', config.customer_concierge.enabled)}
                  className={`text-xs font-bold px-3 py-1.5 rounded-xl transition-colors ${
                    config.customer_concierge.enabled
                      ? 'bg-slate-800 text-slate-300 hover:text-white'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  }`}
                >
                  {config.customer_concierge.enabled ? 'Desativar' : 'Ativar'}
                </button>
                <button
                  onClick={() => setActiveTab('concierge')}
                  className="text-xs text-purple-400 hover:text-purple-300 font-semibold flex items-center gap-1"
                >
                  <span>Configurar</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Module 2: Smart Pairing */}
            <div className="bg-[#151922] border border-[#272F3E] rounded-2xl p-4 sm:p-5 flex flex-col justify-between shadow-lg relative overflow-hidden group">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
                    <Wine className="w-5 h-5" />
                  </div>
                  <span
                    className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase border ${
                      config.smart_pairing.enabled
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    {config.smart_pairing.enabled ? '🟢 Ativo' : '⚪ Inativo'}
                  </span>
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">Chef & Sommelier Virtual</h3>
                  <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                    Harmonização de bebidas, vinhos e sobremesas reais direto no carrinho do cliente.
                  </p>
                </div>
                <div className="bg-[#1C212D] p-2.5 rounded-xl border border-slate-800/80 text-[11px] space-y-1">
                  <div className="flex justify-between text-slate-400">
                    <span>Harmonizar Vinhos:</span>
                    <strong className="text-white">{config.smart_pairing.suggestWines ? 'Sim' : 'Não'}</strong>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Sobremesas:</span>
                    <strong className="text-white">{config.smart_pairing.suggestDesserts ? 'Sim' : 'Não'}</strong>
                  </div>
                </div>
              </div>
              <div className="pt-4 flex items-center justify-between border-t border-slate-800/80 mt-4">
                <button
                  onClick={() => handleToggleModule('smart_pairing', config.smart_pairing.enabled)}
                  className={`text-xs font-bold px-3 py-1.5 rounded-xl transition-colors ${
                    config.smart_pairing.enabled
                      ? 'bg-slate-800 text-slate-300 hover:text-white'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  }`}
                >
                  {config.smart_pairing.enabled ? 'Desativar' : 'Ativar'}
                </button>
                <button
                  onClick={() => setActiveTab('pairing')}
                  className="text-xs text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1"
                >
                  <span>Configurar</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Module 3: Menu Engineering */}
            <div className="bg-[#151922] border border-[#272F3E] rounded-2xl p-4 sm:p-5 flex flex-col justify-between shadow-lg relative overflow-hidden group">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center border border-sky-500/30">
                    <BarChart3 className="w-5 h-5" />
                  </div>
                  <span
                    className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase border ${
                      config.menu_engineering.enabled
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    {config.menu_engineering.enabled ? '🟢 Ativo' : '⚪ Inativo'}
                  </span>
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">Engenharia de Cardápio & CMV</h3>
                  <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                    Matriz BCG, cálculo real de margem bruta e sugestões com aprovação humana obrigatória.
                  </p>
                </div>
                <div className="bg-[#1C212D] p-2.5 rounded-xl border border-slate-800/80 text-[11px] space-y-1">
                  <div className="flex justify-between text-slate-400">
                    <span>Margem Alvo:</span>
                    <strong className="text-emerald-400">{config.menu_engineering.targetMarginPercent}%</strong>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Sugestões Pendentes:</span>
                    <strong className="text-amber-400">
                      {priceSuggestions.filter((s) => s.status === 'pendente').length} itens
                    </strong>
                  </div>
                </div>
              </div>
              <div className="pt-4 flex items-center justify-between border-t border-slate-800/80 mt-4">
                <button
                  onClick={() => handleToggleModule('menu_engineering', config.menu_engineering.enabled)}
                  className={`text-xs font-bold px-3 py-1.5 rounded-xl transition-colors ${
                    config.menu_engineering.enabled
                      ? 'bg-slate-800 text-slate-300 hover:text-white'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  }`}
                >
                  {config.menu_engineering.enabled ? 'Desativar' : 'Ativar'}
                </button>
                <button
                  onClick={() => setActiveTab('cmv')}
                  className="text-xs text-sky-400 hover:text-sky-300 font-semibold flex items-center gap-1"
                >
                  <span>Analisar</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Module 4: Smart KDS */}
            <div className="bg-[#151922] border border-[#272F3E] rounded-2xl p-4 sm:p-5 flex flex-col justify-between shadow-lg relative overflow-hidden group">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-orange-500/20 text-orange-400 flex items-center justify-center border border-orange-500/30">
                    <ChefHat className="w-5 h-5" />
                  </div>
                  <span
                    className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase border ${
                      config.smart_kitchen.enabled
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    {config.smart_kitchen.enabled ? '🟢 Ativo' : '⚪ Inativo'}
                  </span>
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">Gerente de Cozinha & Smart KDS</h3>
                  <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                    Roteamento para praças (Cozinha, Sushi Bar, Bar), sequenciamento e alertas de alergia.
                  </p>
                </div>
                <div className="bg-[#1C212D] p-2.5 rounded-xl border border-slate-800/80 text-[11px] space-y-1">
                  <div className="flex justify-between text-slate-400">
                    <span>Praças Ativas:</span>
                    <strong className="text-white">{config.smart_kitchen.stations?.length || 3} praças</strong>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Alerta de Alergia:</span>
                    <strong className="text-orange-400 font-bold">Visual + Som</strong>
                  </div>
                </div>
              </div>
              <div className="pt-4 flex items-center justify-between border-t border-slate-800/80 mt-4">
                <button
                  onClick={() => handleToggleModule('smart_kitchen', config.smart_kitchen.enabled)}
                  className={`text-xs font-bold px-3 py-1.5 rounded-xl transition-colors ${
                    config.smart_kitchen.enabled
                      ? 'bg-slate-800 text-slate-300 hover:text-white'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  }`}
                >
                  {config.smart_kitchen.enabled ? 'Desativar' : 'Ativar'}
                </button>
                <button
                  onClick={() => setActiveTab('kitchen')}
                  className="text-xs text-orange-400 hover:text-orange-300 font-semibold flex items-center gap-1"
                >
                  <span>Configurar</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Pending Price Suggestions Alert Bar */}
          {priceSuggestions.filter((s) => s.status === 'pendente').length > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">
                    {priceSuggestions.filter((s) => s.status === 'pendente').length} Sugestão(ões) de Preço da IA aguardando Aprovação Humana
                  </h4>
                  <p className="text-xs text-amber-300/80 mt-0.5">
                    A IA identificou itens de alta saída com CMV elevado e calculou o impacto positivo de margem. A alteração só é aplicada no cardápio após seu clique explícito em [Aprovar].
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveTab('cmv')}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl transition-colors shrink-0 shadow"
              >
                Revisar Sugestões
              </button>
            </div>
          )}

          {/* Quick Simulation CTA */}
          <div className="bg-gradient-to-r from-purple-950/40 via-[#151922] to-slate-900 border border-purple-500/30 rounded-2xl p-4 sm:p-6 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-400" />
                <h4 className="text-sm font-black text-white uppercase tracking-wider">
                  Testar o Motor de IA com Segurança
                </h4>
              </div>
              <p className="text-xs text-slate-400 max-w-xl">
                Execute simulações interativas nos 4 cenários (Cliente, Carrinho, CMV e Cozinha). Nenhuma alteração é gravada no banco de dados durante a simulação.
              </p>
            </div>
            <button
              onClick={() => setActiveTab('simulator')}
              className="px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl transition-colors shadow-lg flex items-center gap-2 shrink-0"
            >
              <Play className="w-4 h-4" />
              <span>Abrir Simulador</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB 2: ATENDENTE VIRTUAL CONFIG */}
      {activeTab === 'concierge' && config && (
        <div className="bg-[#151922] border border-[#272F3E] rounded-2xl p-5 space-y-6 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div>
              <h2 className="text-base font-black text-white flex items-center gap-2">
                <Bot className="w-5 h-5 text-purple-400" />
                <span>Configurações do Atendente Virtual & Concierge</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Personalize a identidade do bot do restaurante <strong>{activeRestaurant.name}</strong>.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Status:</span>
              <button
                onClick={() => handleToggleModule('customer_concierge', config.customer_concierge.enabled)}
                className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase transition-all ${
                  config.customer_concierge.enabled
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                }`}
              >
                {config.customer_concierge.enabled ? '🟢 Habilitado' : '⚪ Desabilitado'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">Nome do Atendente:</label>
              <input
                type="text"
                value={config.customer_concierge.botName}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    customer_concierge: { ...config.customer_concierge, botName: e.target.value },
                  })
                }
                className="w-full bg-[#1C212D] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-purple-500"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">Personalidade do Atendimento:</label>
              <select
                value={config.customer_concierge.personality}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    customer_concierge: {
                      ...config.customer_concierge,
                      personality: e.target.value as any,
                    },
                  })
                }
                className="w-full bg-[#1C212D] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-purple-500"
              >
                <option value="premium">Premium & Gastronômico (Acolhedor e refinado)</option>
                <option value="educado">Educado & Direto (Rápido e objetivo)</option>
                <option value="natural">Natural & Amigável (Conversacional e suave)</option>
                <option value="descontraido">Descontraído (Leve e jovem)</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="text-xs font-bold text-slate-300 block mb-1">Mensagem de Boas-Vindas / Saudação:</label>
              <textarea
                rows={2}
                value={config.customer_concierge.greetingMessage}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    customer_concierge: { ...config.customer_concierge, greetingMessage: e.target.value },
                  })
                }
                className="w-full bg-[#1C212D] border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-purple-500"
              />
            </div>

            <div className="md:col-span-2">
              <label className="text-xs font-bold text-slate-300 block mb-1">
                Aviso Mandatório de Alergias & Restrições (Nunca diagnosticar; orientar confirmação):
              </label>
              <textarea
                rows={2}
                value={config.customer_concierge.allergyNotice}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    customer_concierge: { ...config.customer_concierge, allergyNotice: e.target.value },
                  })
                }
                className="w-full bg-[#1C212D] border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-purple-500"
              />
            </div>

            <div className="md:col-span-2">
              <label className="text-xs font-bold text-slate-300 block mb-1">
                Regras Especiais & Instruções do Restaurante:
              </label>
              <textarea
                rows={3}
                value={config.customer_concierge.rules}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    customer_concierge: { ...config.customer_concierge, rules: e.target.value },
                  })
                }
                placeholder="Ex: Nunca inventar produtos, priorizar sobremesas da casa..."
                className="w-full bg-[#1C212D] border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-purple-500"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">
                Máximo de Pratos Sugeridos por Resposta:
              </label>
              <input
                type="number"
                min={1}
                max={5}
                value={config.customer_concierge.maxRecommendations}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    customer_concierge: {
                      ...config.customer_concierge,
                      maxRecommendations: Number(e.target.value),
                    },
                  })
                }
                className="w-full bg-[#1C212D] border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800 flex justify-end">
            <button
              onClick={() => handleSaveModuleConfig('customer_concierge', config.customer_concierge)}
              className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl shadow-lg flex items-center gap-2 transition-all"
            >
              <Save className="w-4 h-4" />
              <span>Salvar Alterações com Registro em Log</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB 3: SMART PAIRING CONFIG */}
      {activeTab === 'pairing' && config && (
        <div className="bg-[#151922] border border-[#272F3E] rounded-2xl p-5 space-y-6 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div>
              <h2 className="text-base font-black text-white flex items-center gap-2">
                <Wine className="w-5 h-5 text-amber-400" />
                <span>Chef & Sommelier Virtual (Smart Pairing AI)</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Harmonização inteligente de bebidas, vinhos e sobremesas no carrinho do cliente.
              </p>
            </div>
            <button
              onClick={() => handleToggleModule('smart_pairing', config.smart_pairing.enabled)}
              className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase transition-all ${
                config.smart_pairing.enabled
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                  : 'bg-slate-800 text-slate-400 border border-slate-700'
              }`}
            >
              {config.smart_pairing.enabled ? '🟢 Habilitado' : '⚪ Desabilitado'}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-[#1C212D] p-4 rounded-xl border border-slate-800 space-y-3">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">Categorias Habilitadas para Harmonização</h4>
              
              <label className="flex items-center gap-2.5 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.smart_pairing.suggestBeverages}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      smart_pairing: { ...config.smart_pairing, suggestBeverages: e.target.checked },
                    })
                  }
                  className="w-4 h-4 rounded text-amber-500 focus:ring-0"
                />
                <span>Sugerir Bebidas & Sucos Refrescantes</span>
              </label>

              <label className="flex items-center gap-2.5 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.smart_pairing.suggestWines}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      smart_pairing: { ...config.smart_pairing, suggestWines: e.target.checked },
                    })
                  }
                  className="w-4 h-4 rounded text-amber-500 focus:ring-0"
                />
                <span>Sugerir Carta de Vinhos e Espumantes da Casa</span>
              </label>

              <label className="flex items-center gap-2.5 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.smart_pairing.suggestDesserts}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      smart_pairing: { ...config.smart_pairing, suggestDesserts: e.target.checked },
                    })
                  }
                  className="w-4 h-4 rounded text-amber-500 focus:ring-0"
                />
                <span>Sugerir Sobremesas Artesanais para Finalizar</span>
              </label>
            </div>

            <div className="bg-[#1C212D] p-4 rounded-xl border border-slate-800 space-y-3">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">Diretrizes de Segurança do Carrinho</h4>
              <div className="text-xs text-slate-400 space-y-2">
                <p>
                  • <strong>Decisão do Cliente:</strong> A IA nunca adiciona nada automaticamente ao carrinho. Ela exibe a &quot;Sugestão do Chef&quot; com o botão &quot;Adicionar ao Pedido&quot;.
                </p>
                <p>
                  • <strong>Estoque & Cadastro Real:</strong> Somente produtos disponíveis na loja <strong>{activeRestaurant.name}</strong> são considerados.
                </p>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800 flex justify-end">
            <button
              onClick={() => handleSaveModuleConfig('smart_pairing', config.smart_pairing)}
              className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-lg flex items-center gap-2 transition-all"
            >
              <Save className="w-4 h-4" />
              <span>Salvar Diretrizes de Harmonização</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB 4: ENGENHARIA DE CARDÁPIO & CONSULTOR CMV */}
      {activeTab === 'cmv' && (
        <div className="space-y-6">
          {/* Header Controls */}
          <div className="bg-[#151922] border border-[#272F3E] rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
            <div>
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-sky-400" />
                <h2 className="text-base font-black text-white">
                  Engenheiro de Cardápio & Consultor CMV (Matriz BCG Real)
                </h2>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Cálculo do CMV real = (custo / preço) × 100, margem de contribuição e classificação dos pratos.
              </p>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="flex items-center bg-[#1C212D] rounded-xl border border-slate-800 p-1 text-xs">
                {[
                  { days: 1, label: 'Hoje' },
                  { days: 7, label: '7 Dias' },
                  { days: 30, label: '30 Dias' },
                  { days: 90, label: '90 Dias' },
                ].map((p) => (
                  <button
                    key={p.days}
                    onClick={() => setCmvPeriodDays(p.days)}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                      cmvPeriodDays === p.days
                        ? 'bg-sky-500 text-slate-950 shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              <button
                onClick={handleRunCmvAnalysis}
                disabled={cmvLoading}
                className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white font-black text-xs rounded-xl shadow flex items-center gap-2 transition-all disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${cmvLoading ? 'animate-spin' : ''}`} />
                <span>{cmvLoading ? 'Calculando...' : 'Calcular Matriz'}</span>
              </button>
            </div>
          </div>

          {/* Pending Human Approval List for Price Suggestions */}
          <div className="bg-[#151922] border border-[#272F3E] rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
                <h3 className="text-sm font-black text-white uppercase tracking-wider">
                  Sugestões de Preço & CMV — Aprovação Humana Obrigatória
                </h3>
              </div>
              <span className="text-xs text-slate-400">
                {priceSuggestions.filter((s) => s.status === 'pendente').length} pendentes
              </span>
            </div>

            {priceSuggestions.filter((s) => s.status === 'pendente').length === 0 ? (
              <div className="p-6 text-center text-slate-400 text-xs bg-[#1C212D]/40 rounded-xl border border-slate-800/60">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2 opacity-80" />
                <p className="font-bold text-white">Nenhuma sugestão de preço pendente para aprovação.</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Clique em &quot;Calcular Matriz&quot; acima para reanalisar as vendas e CMV do período selecionado.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {priceSuggestions
                  .filter((s) => s.status === 'pendente')
                  .map((sug) => (
                    <div
                      key={sug.id}
                      className="bg-[#1C212D] border border-slate-800 hover:border-amber-500/40 p-4 rounded-xl flex flex-col justify-between gap-3 transition-all shadow"
                    >
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              {sug.matrixCategory}
                            </span>
                            <h4 className="text-sm font-bold text-white mt-1">{sug.productName}</h4>
                            <span className="text-[11px] text-slate-400">{sug.category}</span>
                          </div>
                          <div className="text-right font-mono">
                            <span className="text-xs text-slate-400 block line-through">
                              R$ {sug.currentPrice.toFixed(2)}
                            </span>
                            <span className="text-sm font-black text-amber-400 block">
                              R$ {sug.suggestedPrice.toFixed(2)}
                            </span>
                          </div>
                        </div>

                        <p className="text-[11px] text-slate-300 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
                          {sug.reasoning}
                        </p>

                        <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                          <span>
                            CMV Atual: <strong className="text-rose-400">{sug.currentCmvPercent}%</strong>
                          </span>
                          <span>
                            Novo CMV Est.: <strong className="text-emerald-400">{sug.newCmvPercent}%</strong>
                          </span>
                        </div>
                      </div>

                      {/* Approval Actions */}
                      <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
                        <button
                          onClick={() => handleResolvePrice(sug.id, 'aprovar')}
                          className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black rounded-lg shadow flex items-center justify-center gap-1.5 transition-colors"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>[APROVAR] Atualizar Preço</span>
                        </button>
                        <button
                          onClick={() => handleResolvePrice(sug.id, 'ignorar')}
                          className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold rounded-lg transition-colors"
                        >
                          [IGNORAR]
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* BCG Matrix Visual Cards */}
          {cmvDiagnostic && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Estrelas */}
              <div className="bg-[#151922] border border-amber-500/40 rounded-2xl p-4 shadow-lg space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-amber-400 uppercase">⭐ Estrelas</span>
                  <span className="text-lg font-black text-white font-mono">{cmvDiagnostic.starsCount}</span>
                </div>
                <p className="text-[11px] text-slate-400">Alta popularidade + Alta margem de contribuição.</p>
                <div className="text-[10px] text-amber-300/90 font-medium bg-amber-500/10 p-2 rounded">
                  Ação: Manter padrão rigoroso e destacar no cardápio.
                </div>
              </div>

              {/* Burros de Carga */}
              <div className="bg-[#151922] border border-sky-500/40 rounded-2xl p-4 shadow-lg space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-sky-400 uppercase">🐴 Burros de Carga</span>
                  <span className="text-lg font-black text-white font-mono">{cmvDiagnostic.plowhorsesCount}</span>
                </div>
                <p className="text-[11px] text-slate-400">Alta popularidade + Baixa margem de lucro.</p>
                <div className="text-[10px] text-sky-300/90 font-medium bg-sky-500/10 p-2 rounded">
                  Ação: Leve reajuste de preço ou revisão de ficha técnica.
                </div>
              </div>

              {/* Quebra-Cabeça */}
              <div className="bg-[#151922] border border-purple-500/40 rounded-2xl p-4 shadow-lg space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-purple-400 uppercase">🧩 Quebra-Cabeça</span>
                  <span className="text-lg font-black text-white font-mono">{cmvDiagnostic.puzzlesCount}</span>
                </div>
                <p className="text-[11px] text-slate-400">Baixa popularidade + Alta margem de contribuição.</p>
                <div className="text-[10px] text-purple-300/90 font-medium bg-purple-500/10 p-2 rounded">
                  Ação: Promover em combos ou reposicionar na vitrine.
                </div>
              </div>

              {/* Cães */}
              <div className="bg-[#151922] border border-rose-500/40 rounded-2xl p-4 shadow-lg space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-rose-400 uppercase">🐕 Cães (Baixo Retorno)</span>
                  <span className="text-lg font-black text-white font-mono">{cmvDiagnostic.dogsCount}</span>
                </div>
                <p className="text-[11px] text-slate-400">Baixa popularidade + Baixa margem de lucro.</p>
                <div className="text-[10px] text-rose-300/90 font-medium bg-rose-500/10 p-2 rounded">
                  Ação: Avaliar substituição ou promoção de saída rápida.
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 5: SMART KDS CONFIG */}
      {activeTab === 'kitchen' && config && (
        <div className="bg-[#151922] border border-[#272F3E] rounded-2xl p-5 space-y-6 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div>
              <h2 className="text-base font-black text-white flex items-center gap-2">
                <ChefHat className="w-5 h-5 text-orange-400" />
                <span>Gerente de Cozinha & Smart KDS</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Organização inteligente de praças de produção, controle de atrasos e alertas críticos de alergias.
              </p>
            </div>
            <button
              onClick={() => handleToggleModule('smart_kitchen', config.smart_kitchen.enabled)}
              className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase transition-all ${
                config.smart_kitchen.enabled
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                  : 'bg-slate-800 text-slate-400 border border-slate-700'
              }`}
            >
              {config.smart_kitchen.enabled ? '🟢 Habilitado' : '⚪ Desabilitado'}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-[#1C212D] p-4 rounded-xl border border-slate-800 space-y-3">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">Praças de Produção Cadastradas</h4>
              <div className="flex flex-wrap gap-2">
                {config.smart_kitchen.stations?.map((station: string, idx: number) => (
                  <span
                    key={idx}
                    className="px-3 py-1 bg-slate-900 text-amber-400 font-mono text-xs rounded-lg border border-slate-800"
                  >
                    {station}
                  </span>
                ))}
              </div>
              <p className="text-[11px] text-slate-400 pt-2">
                Os itens do pedido são roteados automaticamente para a respectiva praça conforme a categoria e nome do prato.
              </p>
            </div>

            <div className="bg-[#1C212D] p-4 rounded-xl border border-slate-800 space-y-3">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">Configurações de Tempo & Alergias</h4>

              <label className="flex items-center gap-2.5 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.smart_kitchen.soundAlertForAllergies}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      smart_kitchen: { ...config.smart_kitchen, soundAlertForAllergies: e.target.checked },
                    })
                  }
                  className="w-4 h-4 rounded text-orange-500 focus:ring-0"
                />
                <span>Emitir alerta sonoro específico ao receber pedido com alerta de ALERGIA</span>
              </label>

              <label className="flex items-center gap-2.5 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.smart_kitchen.requireAllergyConfirmation}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      smart_kitchen: { ...config.smart_kitchen, requireAllergyConfirmation: e.target.checked },
                    })
                  }
                  className="w-4 h-4 rounded text-orange-500 focus:ring-0"
                />
                <span>Exigir confirmação de leitura do cozinheiro em pedidos com alergias graves</span>
              </label>

              <div className="flex items-center justify-between text-xs text-slate-300 pt-2">
                <span>Tempo Alvo de Preparo:</span>
                <span className="font-mono text-white font-bold">{config.smart_kitchen.targetPrepTimeMinutes} min</span>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800 flex justify-end">
            <button
              onClick={() => handleSaveModuleConfig('smart_kitchen', config.smart_kitchen)}
              className="px-5 py-2.5 bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs rounded-xl shadow-lg flex items-center gap-2 transition-all"
            >
              <Save className="w-4 h-4" />
              <span>Salvar Regras de Cozinha</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB 6: SIMULADOR DA IA ("SIMULAR IA") */}
      {activeTab === 'simulator' && (
        <div className="bg-[#151922] border border-[#272F3E] rounded-2xl p-5 space-y-6 shadow-xl">
          <div className="border-b border-slate-800 pb-4">
            <div className="flex items-center gap-2">
              <Play className="w-5 h-5 text-purple-400" />
              <h2 className="text-base font-black text-white">Simulador do Motor de Inteligência Artificial</h2>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Execute testes em tempo real sem alterar dados reais de produtos, preços, estoque ou pedidos.
            </p>
          </div>

          {/* Scenario Picker */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { id: 'cliente', title: '1. Atendente Virtual', defaultMsg: 'Estou procurando algo leve.' },
              { id: 'carrinho', title: '2. Smart Pairing', defaultMsg: 'Analise meu pedido e sugira uma bebida.' },
              { id: 'cmv', title: '3. Engenheiro CMV', defaultMsg: 'Analise os produtos dos últimos 30 dias.' },
              { id: 'cozinha', title: '4. Gerente Cozinha KDS', defaultMsg: 'Organize estes pedidos por praça.' },
            ].map((scen) => (
              <button
                key={scen.id}
                onClick={() => {
                  setSimScenario(scen.id as any);
                  setSimCustomInput(scen.defaultMsg);
                }}
                className={`p-3 rounded-xl border text-left transition-all ${
                  simScenario === scen.id
                    ? 'bg-purple-600/20 border-purple-500 text-white shadow'
                    : 'bg-[#1C212D] border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <span className="text-xs font-bold block">{scen.title}</span>
                <span className="text-[11px] text-slate-500 italic block mt-1 truncate">
                  &quot;{scen.defaultMsg}&quot;
                </span>
              </button>
            ))}
          </div>

          {/* Input & Run */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 block">Mensagem ou Comando de Entrada para Simular:</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={simCustomInput}
                onChange={(e) => setSimCustomInput(e.target.value)}
                placeholder="Digite a mensagem para o teste..."
                className="flex-1 bg-[#1C212D] border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-purple-500"
              />
              <button
                onClick={handleRunSimulation}
                disabled={simLoading}
                className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-black text-xs rounded-xl shadow-lg flex items-center gap-2 transition-all disabled:opacity-50"
              >
                <Play className={`w-3.5 h-3.5 ${simLoading ? 'animate-spin' : ''}`} />
                <span>{simLoading ? 'Processando...' : 'Executar Simulação'}</span>
              </button>
            </div>
          </div>

          {/* Simulation Output Area */}
          {simResult && (
            <div className="bg-[#12151C] border border-purple-500/40 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-xs font-bold text-purple-400 uppercase tracking-wider">
                  Resultado da Simulação ({simResult.scenario})
                </span>
                <span className="text-[10px] text-emerald-400 font-mono">Executado com Sucesso</span>
              </div>

              <p className="text-[11px] text-amber-300/90 font-medium bg-amber-500/10 p-2.5 rounded-lg border border-amber-500/20">
                ⚠️ {simResult.disclaimer}
              </p>

              <pre className="bg-[#0D1017] p-3 rounded-lg text-[11px] font-mono text-slate-300 overflow-x-auto max-h-72">
                {JSON.stringify(simResult.outputSummary, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* TAB 7: HISTÓRICO & LOGS DE AUDITORIA */}
      {activeTab === 'logs' && (
        <div className="bg-[#151922] border border-[#272F3E] rounded-2xl p-5 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                <History className="w-4 h-4 text-purple-400" />
                <span>Histórico de Auditoria & Governança da IA</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Registro imutável de todas as decisões, alterações de configuração e aprovações humanas.
              </p>
            </div>
            <span className="text-xs font-mono text-slate-400">{auditLogs.length} eventos registrados</span>
          </div>

          {auditLogs.length === 0 ? (
            <div className="text-center py-10 text-slate-500 text-xs">
              Nenhum registro de auditoria no histórico recente.
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[500px] overflow-y-auto">
              {auditLogs.map((log) => (
                <div
                  key={log.id}
                  className="bg-[#1C212D] border border-slate-800 p-3 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-white">{log.action}</span>
                      <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-mono">
                        {log.moduleId}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
                          log.status === 'aprovado'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : log.status === 'simulado'
                            ? 'bg-purple-500/20 text-purple-300'
                            : 'bg-sky-500/20 text-sky-300'
                        }`}
                      >
                        {log.status}
                      </span>
                    </div>
                    {log.notes && <p className="text-[11px] text-slate-400">{log.notes}</p>}
                  </div>

                  <div className="text-right shrink-0 text-[11px] text-slate-500 font-mono">
                    <span className="block text-slate-400 font-semibold">{log.operatorUsername} ({log.operatorRole})</span>
                    <span>{new Date(log.timestamp).toLocaleString('pt-BR')}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
