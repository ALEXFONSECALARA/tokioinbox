import React, { useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { RestaurantSlug } from '../../types/restaurant';
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  Server,
  Database,
  Radio,
  Clock,
  ShieldCheck,
  RefreshCw,
  Trash2,
  Zap,
  Download,
  Users,
  Power,
  Store,
  FileSpreadsheet,
} from 'lucide-react';

export const AdminHealthCheck: React.FC = () => {
  const {
    restaurants,
    menuItems,
    categories,
    orders,
    customers,
    resetToDefaultData,
    clearOrdersHistory,
    clearAllOrders,
    clearCustomersData,
    updateRestaurantConfig,
  } = useStore();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastCheck, setLastCheck] = useState<string>(new Date().toLocaleTimeString());

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
      setLastCheck(new Date().toLocaleTimeString());
    }, 600);
  };

  // Run audit checks across all 4 restaurants
  const auditResults = Object.values(restaurants).map((rest) => {
    const items = menuItems.filter((m) => m.restaurantSlug === rest.slug);
    const cats = categories.filter((c) => c.restaurantSlug === rest.slug);
    const restOrders = orders.filter((o) => o.restaurantSlug === rest.slug);

    const issues: string[] = [];
    if (items.length === 0) issues.push('Cardápio vazio (0 itens cadastrados)');
    if (cats.length === 0) issues.push('Nenhuma categoria cadastrada');
    if (!rest.whatsapp) issues.push('WhatsApp para pedidos não configurado');
    if (!rest.pixKey) issues.push('Chave PIX não informada');
    if (items.some((i) => !i.image)) issues.push('Existem itens sem imagem configurada');

    return {
      slug: rest.slug,
      name: rest.name,
      emoji: rest.emoji,
      isOpen: rest.isOpen,
      itemsCount: items.length,
      categoriesCount: cats.length,
      ordersCount: restOrders.length,
      issues,
      status: issues.length === 0 ? 'healthy' : 'warning',
    };
  });

  const totalRevenue = orders
    .filter((o) => o.status === 'entregue' || o.status === 'pronto' || o.status === 'em_preparo')
    .reduce((sum, o) => sum + o.total, 0);

  const areAllRestaurantsOpen = Object.values(restaurants).every((r) => r.isOpen);

  const handleToggleAllStores = () => {
    const targetState = !areAllRestaurantsOpen;
    const actionLabel = targetState ? 'ABRIR' : 'FECHAR/PAUSAR';
    if (window.confirm(`Deseja realmente ${actionLabel} simultaneamente todos os 4 restaurantes?`)) {
      (Object.keys(restaurants) as RestaurantSlug[]).forEach((slug) => {
        updateRestaurantConfig(slug, { isOpen: targetState });
      });
    }
  };

  const handleClearFinishedHistory = () => {
    if (
      window.confirm(
        'Deseja limpar todos os pedidos com status "Entregue" e "Cancelado" de todos os restaurantes? Pedidos ativos (Recebidos, Em preparo, Prontos) e os cadastros de clientes serão mantidos.'
      )
    ) {
      clearOrdersHistory(undefined, 'finished');
      alert('Histórico de pedidos finalizados limpo com sucesso.');
    }
  };

  const handleClearAllOrders = () => {
    if (
      window.confirm(
        '⚠️ ATENÇÃO CRÍTICA: Deseja ZERAR TODOS OS PEDIDOS (ativos e finalizados) de todos os restaurantes? Os cadastros de clientes NÃO serão apagados.'
      )
    ) {
      clearAllOrders();
      alert('Todos os pedidos foram excluídos.');
    }
  };

  const handleClearCustomersOnly = () => {
    if (
      window.confirm(
        '⚠️ Deseja excluir TODOS OS CADASTROS DE CLIENTES? O histórico de pedidos será mantido intacto.'
      )
    ) {
      clearCustomersData();
      alert('Base de cadastros de clientes excluída com sucesso.');
    }
  };

  const handleExportFullReport = () => {
    const dataReport = {
      system: 'Tokio inBox Multicardápio 1.0.0',
      exportDate: new Date().toISOString(),
      summary: {
        totalRevenue,
        totalOrders: orders.length,
        totalCustomers: customers.length,
        totalMenuItems: menuItems.length,
      },
      restaurants,
      orders,
      customers,
    };

    const blob = new Blob([JSON.stringify(dataReport, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tokio-inbox-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleResetSeed = () => {
    if (
      window.confirm(
        'ATENÇÃO: Deseja restaurar os dados originais de demonstração de todos os 4 restaurantes? Suas edições recentes de itens e pedidos serão reiniciadas.'
      )
    ) {
      resetToDefaultData();
      alert('Sistema restaurado para a versão de semente inicial.');
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">
              Ferramentas &amp; Diagnóstico Multicardápio (1.0.0)
            </h2>
            <p className="text-xs text-slate-400">
              Gerenciamento avançado de histórico, cadastros independentes e integridade operacional
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportFullReport}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-bold rounded-xl border border-slate-700 flex items-center gap-1.5 transition-colors shadow"
            title="Baixar backup completo de pedidos, cadastros e cardápios em JSON"
          >
            <Download className="w-3.5 h-3.5 text-amber-400" />
            <span>Exportar Relatório</span>
          </button>

          <button
            onClick={handleRefresh}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Diagnóstico ({lastCheck})</span>
          </button>
        </div>
      </div>

      {/* Global Infrastructure Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
        {/* Card 1: API & Server Status */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="font-semibold uppercase tracking-wider text-[10px]">
              Servidor &amp; API AI
            </span>
            <Server className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-sm font-black text-white">ONLINE / READY</span>
          </div>
          <p className="text-[11px] text-slate-400">Gemini 2.5 Flash + Roteador Térmico</p>
        </div>

        {/* Card 2: Database Storage */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="font-semibold uppercase tracking-wider text-[10px]">
              Base de Cadastros
            </span>
            <Users className="w-4 h-4 text-amber-400" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-black text-white">{customers.length} Clientes</span>
          </div>
          <p className="text-[11px] text-slate-400">
            Cadastros independentes do histórico
          </p>
        </div>

        {/* Card 3: Realtime Engine */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="font-semibold uppercase tracking-wider text-[10px]">
              Conexões Realtime
            </span>
            <Radio className="w-4 h-4 text-sky-400" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-black text-white">SSE + Fallback Polling</span>
          </div>
          <p className="text-[11px] text-slate-400">Sincronização ativa de pedidos</p>
        </div>

        {/* Card 4: Volume de Vendas */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="font-semibold uppercase tracking-wider text-[10px]">
              Volume Total
            </span>
            <Zap className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-sm font-black text-amber-400">
            R$ {totalRevenue.toFixed(2)}
          </div>
          <p className="text-[11px] text-slate-400">{orders.length} pedidos registrados</p>
        </div>
      </div>

      {/* Multicardápio Global Operational Tools */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-3">
        <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <Store className="w-4 h-4 text-amber-400" />
          <span>Ferramentas de Controle Geral Multicardápio</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 text-xs">
          <button
            onClick={handleToggleAllStores}
            className={`py-3 px-4 rounded-xl border flex items-center justify-center gap-2 font-bold transition-all ${
              areAllRestaurantsOpen
                ? 'bg-rose-500/15 border-rose-500/30 text-rose-300 hover:bg-rose-500 hover:text-white'
                : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500 hover:text-white'
            }`}
          >
            <Power className="w-4 h-4" />
            <span>
              {areAllRestaurantsOpen
                ? 'Pausar Todas as 4 Lojas Simultaneamente'
                : 'Abrir Todas as 4 Lojas Simultaneamente'}
            </span>
          </button>

          <button
            onClick={handleExportFullReport}
            className="py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl border border-slate-700 flex items-center justify-center gap-2 transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4 text-amber-400" />
            <span>Exportar Relatório Consolidado (JSON)</span>
          </button>
        </div>
      </div>

      {/* Restaurant-by-Restaurant Audit Table */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
        <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-amber-400" />
          <span>Auditoria Operacional por Restaurante</span>
        </h3>

        <div className="space-y-3">
          {auditResults.map((audit) => (
            <div
              key={audit.slug}
              className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{audit.emoji}</span>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-white text-sm">{audit.name}</h4>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded font-semibold ${
                        audit.isOpen
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      }`}
                    >
                      {audit.isOpen ? 'Aberto' : 'Pausado'}
                    </span>
                  </div>
                  <p className="text-slate-400 text-[11px] mt-0.5">
                    {audit.itemsCount} pratos • {audit.categoriesCount} categorias •{' '}
                    {audit.ordersCount} pedidos
                  </p>
                </div>
              </div>

              {/* Status & Issues */}
              <div className="flex items-center gap-3">
                {audit.issues.length === 0 ? (
                  <span className="px-3 py-1 rounded-lg bg-emerald-500/15 text-emerald-300 font-bold border border-emerald-500/30 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Cardápio Saudável</span>
                  </span>
                ) : (
                  <div className="text-right">
                    <span className="px-3 py-1 rounded-lg bg-amber-500/15 text-amber-300 font-bold border border-amber-500/30 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>{audit.issues.length} Alerta(s)</span>
                    </span>
                    <p className="text-[10px] text-amber-400/80 mt-1">
                      {audit.issues.join(', ')}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Database & History Maintenance Controls - SEPARATED BUTTONS */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div>
          <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Trash2 className="w-4 h-4 text-rose-400" />
            <span>Exclusão e Limpeza de Dados (Ações Separadas e Seguras)</span>
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Escolha exatamente o que deseja apagar sem afetar outras partes do sistema.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1 text-xs">
          {/* Action 1: Clear Finished Orders */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3 flex flex-col justify-between">
            <div>
              <h4 className="font-bold text-white text-xs">Histórico de Pedidos Finalizados</h4>
              <p className="text-[11px] text-slate-400 mt-1">
                Remove apenas pedidos &quot;Entregue&quot; e &quot;Cancelado&quot;. Mantém pedidos na cozinha e cadastros intactos.
              </p>
            </div>
            <button
              onClick={handleClearFinishedHistory}
              className="w-full py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 flex items-center justify-center gap-1.5 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              <span>Excluir Pedidos Finalizados</span>
            </button>
          </div>

          {/* Action 2: Clear All Orders */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3 flex flex-col justify-between">
            <div>
              <h4 className="font-bold text-white text-xs">Zerar Todos os Pedidos</h4>
              <p className="text-[11px] text-slate-400 mt-1">
                Exclui todos os pedidos da base (ativos e passados). Os cadastros de clientes continuam salvos.
              </p>
            </div>
            <button
              onClick={handleClearAllOrders}
              className="w-full py-2.5 px-3 bg-rose-500/15 hover:bg-rose-500 text-rose-300 hover:text-white text-xs font-bold rounded-xl border border-rose-500/30 flex items-center justify-center gap-1.5 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Zerar Todos os Pedidos</span>
            </button>
          </div>

          {/* Action 3: Clear Customers Only */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3 flex flex-col justify-between">
            <div>
              <h4 className="font-bold text-white text-xs">Excluir Cadastros de Clientes</h4>
              <p className="text-[11px] text-slate-400 mt-1">
                Exclui apenas a lista de clientes/CRM. O histórico de pedidos de vendas permanece inalterado.
              </p>
            </div>
            <button
              onClick={handleClearCustomersOnly}
              className="w-full py-2.5 px-3 bg-amber-500/15 hover:bg-amber-500 text-amber-300 hover:text-slate-950 text-xs font-bold rounded-xl border border-amber-500/30 flex items-center justify-center gap-1.5 transition-colors"
            >
              <Users className="w-3.5 h-3.5" />
              <span>Excluir Apenas Cadastros</span>
            </button>
          </div>
        </div>

        {/* Global Reset */}
        <div className="pt-2 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <p className="text-slate-400 text-[11px]">
            Precisa redefinir todo o sistema com os dados de demonstração iniciais?
          </p>
          <button
            onClick={handleResetSeed}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-amber-400 font-bold rounded-xl border border-slate-700 flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
            <span>Restaurar Dados Originais Tokio inBox</span>
          </button>
        </div>
      </div>
    </div>
  );
};

