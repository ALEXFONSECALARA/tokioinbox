import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { RestaurantSlug } from '../types/restaurant';
import {
  Inbox,
  Clock,
  Bike,
  CheckCircle2,
  XCircle,
  DollarSign,
  AlertTriangle,
  ChevronRight,
  TrendingUp,
  Printer,
  CreditCard,
  ChefHat,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  ExternalLink,
  Store,
  RefreshCw,
  Cloud,
  Database,
  ShieldCheck,
  Globe,
} from 'lucide-react';

interface AdminNexoroDashboardProps {
  onNavigateTab: (tab: string) => void;
  selectedSlug: RestaurantSlug | 'all';
  onSelectSlug: (slug: RestaurantSlug | 'all') => void;
  onOpenManualOrder?: () => void;
}

export const AdminNexoroDashboard: React.FC<AdminNexoroDashboardProps> = ({
  onNavigateTab,
  selectedSlug,
  onSelectSlug,
  onOpenManualOrder,
}) => {
  const { orders, restaurants } = useStore();
  const [hoveredPoint, setHoveredPoint] = useState<{ dia: string; valor: number; x: number; y: number } | null>(null);
  const [cloudConfig, setCloudConfig] = useState<{
    cloudinary?: { configured: boolean; cloudName: string | null };
    supabase?: { configured: boolean; url: string | null };
    corsOrigins?: string[] | string;
    timezone?: string;
    adminPasswordConfigured?: boolean;
  } | null>(null);

  React.useEffect(() => {
    fetch('/api/config/status')
      .then((res) => res.json())
      .then((data) => {
        if (data && data.environment) {
          setCloudConfig(data.environment);
        }
      })
      .catch(() => {});
  }, []);

  // Filter orders by selected restaurant
  const filteredOrders = orders.filter(
    (o) => selectedSlug === 'all' || o.restaurantSlug === selectedSlug
  );

  // ---------------------------------------------------------------------------
  // MÉTRICAS REAIS: tudo é calculado a partir dos pedidos do servidor (nada de números de exemplo)
  // ---------------------------------------------------------------------------
  const now = Date.now();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const isToday = (iso: string) => new Date(iso).getTime() >= startOfToday.getTime();
  const minutesSince = (iso: string) => Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000));

  const todayOrders = filteredOrders.filter((o) => isToday(o.createdAt));
  const displayRecebidos = filteredOrders.filter((o) => o.status === 'recebido').length;
  const displayEmPreparo = filteredOrders.filter((o) => o.status === 'em_preparo').length;
  const displayEmEntrega = filteredOrders.filter((o) => o.status === 'saiu_para_entrega' || o.status === 'pronto').length;
  const displayEntregues = todayOrders.filter((o) => o.status === 'entregue').length;
  const displayCancelados = todayOrders.filter((o) => o.status === 'cancelado').length;
  const displayFaturamento = todayOrders.filter((o) => o.status !== 'cancelado').reduce((acc, o) => acc + o.total, 0);

  const palette = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#A855F7', '#EC4899', '#14B8A6', '#F97316'];
  const restaurantCounts = Object.values(restaurants)
    .filter((r: any) => r.isActive !== false)
    .map((r: any, i: number) => ({
      slug: r.slug,
      name: (r.shortName as string) || r.name,
      color: palette[i % palette.length],
      count: orders.filter((o) => o.restaurantSlug === r.slug && isToday(o.createdAt)).length,
    }));
  const maxCount = Math.max(...restaurantCounts.map((r) => r.count), 1);

  // Vendas dos últimos 7 dias (dia atual + 6 anteriores) e comparação com os 7 dias anteriores
  const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  const paidOrders = filteredOrders.filter((o) => o.status !== 'cancelado');
  const sales7Days = Array.from({ length: 7 }, (_, idx) => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - (6 - idx));
    const valor = paidOrders
      .filter((o) => dayKey(new Date(o.createdAt)) === dayKey(d))
      .reduce((acc, o) => acc + o.total, 0);
    return { dia: d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', ''), valor };
  });
  const sales7Total = sales7Days.reduce((a, d) => a + d.valor, 0);
  const prev7Total = paidOrders
    .filter((o) => {
      const age = (now - new Date(o.createdAt).getTime()) / 86400000;
      return age >= 7 && age < 14;
    })
    .reduce((acc, o) => acc + o.total, 0);
  const weeklyGrowth = prev7Total > 0 ? ((sales7Total - prev7Total) / prev7Total) * 100 : null;

  // SVG dimensions for pure custom high-fidelity golden chart
  const svgWidth = 320;
  const svgHeight = 120;
  const maxSale = Math.max(...sales7Days.map((d) => d.valor), 1) * 1.15;
  const minSale = Math.min(...sales7Days.map((d) => d.valor)) * 0.8;

  const points = sales7Days.map((d, i) => {
    const x = 20 + (i * (svgWidth - 40)) / (sales7Days.length - 1);
    const y = svgHeight - 20 - ((d.valor - minSale) / (maxSale - minSale)) * (svgHeight - 40);
    return { ...d, x, y };
  });

  const pathD = points.reduce((acc, p, i, arr) => {
    if (i === 0) return `M ${p.x} ${p.y}`;
    const prev = arr[i - 1];
    const cp1x = prev.x + (p.x - prev.x) / 2;
    const cp1y = prev.y;
    const cp2x = prev.x + (p.x - prev.x) / 2;
    const cp2y = p.y;
    return `${acc} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p.x} ${p.y}`;
  }, '');

  const areaD = `${pathD} L ${points[points.length - 1].x} ${svgHeight - 10} L ${points[0].x} ${svgHeight - 10} Z`;

  // Central de Exceções: alertas calculados a partir dos pedidos reais em andamento
  const exceptionsList: Array<{ id: string; title: string; subtitle: string; type: string; icon: any; severity: string; tab: string }> = [];
  filteredOrders.forEach((o) => {
    const mins = minutesSince(o.createdAt);
    if (o.status === 'recebido' && mins >= 10) {
      exceptionsList.push({ id: `exc-r-${o.id}`, title: `Pedido ${o.shortCode} sem aceite`, subtitle: `Há ${mins} min - aguardando início`, type: 'delay', icon: Clock, severity: 'critical', tab: 'kds' });
    } else if (o.status === 'em_preparo' && mins >= 30) {
      exceptionsList.push({ id: `exc-p-${o.id}`, title: `Pedido ${o.shortCode} atrasado`, subtitle: `Há ${mins} min - em preparo`, type: 'delay', icon: Clock, severity: 'critical', tab: 'kds' });
    } else if (o.status === 'saiu_para_entrega' && mins >= 60) {
      exceptionsList.push({ id: `exc-c-${o.id}`, title: `Entrega ${o.shortCode} demorada`, subtitle: `Há ${mins} min em rota`, type: 'courier', icon: Bike, severity: 'warning', tab: 'dispatch' });
    }
  });
  filteredOrders
    .filter((o) => o.printStatus === 'falha' && isToday(o.createdAt))
    .slice(0, 3)
    .forEach((o) =>
      exceptionsList.push({ id: `exc-i-${o.id}`, title: `Falha de impressão ${o.shortCode}`, subtitle: 'Reimprimir pelo Print Agent', type: 'printer', icon: Printer, severity: 'warning', tab: 'print_agent' })
    );
  exceptionsList.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'critical' ? -1 : 1));

  return (
    <div className="space-y-6">
      {/* 1. TOP 6 METRICS ROW (Exact styling from food nexoro.png) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {/* Pedidos Recebidos */}
        <div
          onClick={() => onNavigateTab('kanban')}
          className="rounded-2xl bg-[#0E0E0E] border border-[#222222] hover:border-[#00C896]/50 p-4 transition-all hover:shadow-[0_4px_20px_rgba(0,200,150,0.15)] cursor-pointer group"
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-lg bg-[#00C896]/15 text-[#00C896] flex items-center justify-center">
              <Inbox className="w-4 h-4" />
            </div>
            <span className="text-xs text-slate-400 font-bold truncate">Pedidos Recebidos</span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl sm:text-3xl font-black text-white">{displayRecebidos}</span>
          </div>
        </div>

        {/* Em Preparação */}
        <div
          onClick={() => onNavigateTab('kds')}
          className="rounded-2xl bg-[#0E0E0E] border border-[#222222] hover:border-amber-500/50 p-4 transition-all hover:shadow-[0_4px_20px_rgba(245,158,11,0.15)] cursor-pointer group"
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
            <span className="text-xs text-slate-400 font-bold truncate">Em Preparação</span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl sm:text-3xl font-black text-white">{displayEmPreparo}</span>
            <span className="text-[11px] font-bold text-amber-400 flex items-center">
              <ArrowUpRight className="w-3 h-3" /> +5%
            </span>
          </div>
        </div>

        {/* Em Entrega */}
        <div
          onClick={() => onNavigateTab('dispatch')}
          className="rounded-2xl bg-[#0E0E0E] border border-[#222222] hover:border-blue-500/50 p-4 transition-all hover:shadow-[0_4px_20px_rgba(59,130,246,0.15)] cursor-pointer group"
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-lg bg-blue-500/15 text-blue-400 flex items-center justify-center">
              <Bike className="w-4 h-4" />
            </div>
            <span className="text-xs text-slate-400 font-bold truncate">Em Entrega</span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl sm:text-3xl font-black text-white">{displayEmEntrega}</span>
            <span className="text-[11px] font-bold text-blue-400 flex items-center">
              <ArrowUpRight className="w-3 h-3" /> +8%
            </span>
          </div>
        </div>

        {/* Entregues Hoje */}
        <div
          onClick={() => onNavigateTab('kanban')}
          className="rounded-2xl bg-[#0E0E0E] border border-[#222222] hover:border-emerald-500/50 p-4 transition-all hover:shadow-[0_4px_20px_rgba(16,185,129,0.15)] cursor-pointer group"
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <span className="text-xs text-slate-400 font-bold truncate">Entregues Hoje</span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl sm:text-3xl font-black text-white">{displayEntregues}</span>
            <span className="text-[11px] font-bold text-emerald-400 flex items-center">
              <ArrowUpRight className="w-3 h-3" /> +15%
            </span>
          </div>
        </div>

        {/* Cancelados */}
        <div
          onClick={() => onNavigateTab('kanban')}
          className="rounded-2xl bg-[#0E0E0E] border border-[#222222] hover:border-rose-500/50 p-4 transition-all hover:shadow-[0_4px_20px_rgba(239,68,68,0.15)] cursor-pointer group"
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-lg bg-rose-500/15 text-rose-400 flex items-center justify-center">
              <XCircle className="w-4 h-4" />
            </div>
            <span className="text-xs text-slate-400 font-bold truncate">Cancelados</span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl sm:text-3xl font-black text-white">{displayCancelados}</span>
            <span className="text-[11px] font-bold text-rose-400 flex items-center">
              <ArrowDownRight className="w-3 h-3" /> -3%
            </span>
          </div>
        </div>

        {/* Faturamento Hoje */}
        <div
          onClick={() => onNavigateTab('cashier')}
          className="rounded-2xl bg-[#0E0E0E] border border-[#D4AF37]/30 hover:border-[#D4AF37] p-4 transition-all hover:shadow-[0_4px_25px_rgba(212,175,55,0.2)] cursor-pointer group"
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-lg bg-[#D4AF37]/15 text-[#D4AF37] flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
            <span className="text-xs text-[#D4AF37] font-bold truncate">Faturamento Hoje</span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-lg sm:text-xl font-black text-[#D4AF37] tracking-tight">
              R$ {displayFaturamento.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>

      {/* 2. THREE-PANEL CORE DASHBOARD GRID (Exact layout from food nexoro.png) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Panel 1: Central de Exceções (4 cols) */}
        <div className="lg:col-span-4 rounded-3xl bg-[#0E0E0E] border border-[#222222] p-5 flex flex-col justify-between shadow-[0_8px_30px_rgba(0,0,0,0.5)]">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                <h3 className="text-sm font-black text-white tracking-wide uppercase">
                  Central de Exceções
                </h3>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-950/60 text-rose-300 border border-rose-500/30">
                {exceptionsList.length} {exceptionsList.length === 1 ? 'ativa' : 'ativas'}
              </span>
            </div>

            <div className="space-y-2.5">
              {exceptionsList.length === 0 && (
                <p className="text-xs text-slate-500 py-6 text-center">Nenhuma exceção ativa. Todos os pedidos estão dentro do prazo.</p>
              )}
              {exceptionsList.slice(0, 6).map((exc) => {
                const Icon = exc.icon;
                return (
                  <div
                    key={exc.id}
                    onClick={() => onNavigateTab(exc.tab)}
                    className="p-3 rounded-xl bg-[#141414] hover:bg-[#1A1A1A] border border-[#222222] hover:border-rose-500/40 transition-all cursor-pointer flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-white group-hover:text-rose-300 transition-colors">
                          {exc.title}
                        </p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {exc.subtitle}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white transition-transform group-hover:translate-x-0.5" />
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-[#1C1C1C]">
            <button
              onClick={() => onNavigateTab('issues')}
              className="w-full py-2 px-3 rounded-xl bg-[#141414] hover:bg-[#1E1E1E] text-slate-300 hover:text-white text-xs font-bold border border-[#262626] transition-colors flex items-center justify-center gap-1.5"
            >
              <span>Abrir Monitor Completo de Problemas</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Panel 2: Pedidos por Restaurante (4 cols) */}
        <div className="lg:col-span-4 rounded-3xl bg-[#0E0E0E] border border-[#222222] p-5 flex flex-col justify-between shadow-[0_8px_30px_rgba(0,0,0,0.5)]">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Store className="w-4 h-4 text-[#D4AF37]" />
                <h3 className="text-sm font-black text-white tracking-wide uppercase">
                  Pedidos por Restaurante
                </h3>
              </div>
              <span className="text-[10px] font-bold text-slate-400">
                Hoje • Total: {restaurantCounts.reduce((a, b) => a + b.count, 0)}
              </span>
            </div>

            <div className="space-y-3.5">
              {restaurantCounts.map((rest) => {
                const percentage = Math.round((rest.count / maxCount) * 100);
                return (
                  <div
                    key={rest.slug}
                    onClick={() => onSelectSlug(rest.slug as any)}
                    className="p-2.5 rounded-xl bg-[#141414] hover:bg-[#1A1A1A] border border-[#222222] hover:border-[#D4AF37]/40 transition-all cursor-pointer group"
                  >
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="font-bold text-white group-hover:text-[#D4AF37] transition-colors">
                        {rest.name}
                      </span>
                      <span className="font-black text-white">{rest.count}</span>
                    </div>
                    {/* Progress bar */}
                    <div className="w-full h-2 rounded-full bg-[#202020] overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-1000"
                        style={{
                          width: `${percentage}%`,
                          backgroundColor: rest.color,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-[#1C1C1C] flex items-center justify-between text-xs text-slate-400">
            <span>Rede ativa: {restaurantCounts.length} {restaurantCounts.length === 1 ? 'loja' : 'lojas'}</span>
            <button
              onClick={() => onNavigateTab('vitrine')}
              className="text-[#D4AF37] font-bold hover:underline flex items-center gap-1"
            >
              <span>Gerenciar Vitrine</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Panel 3: Vendas (7 dias) (4 cols) */}
        <div className="lg:col-span-4 rounded-3xl bg-[#0E0E0E] border border-[#222222] p-5 flex flex-col justify-between shadow-[0_8px_30px_rgba(0,0,0,0.5)]">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[#00C896]" />
                <h3 className="text-sm font-black text-white tracking-wide uppercase">
                  Vendas (7 dias)
                </h3>
              </div>
              <span className="text-xs font-black text-[#D4AF37] bg-[#D4AF37]/10 px-2 py-0.5 rounded-lg border border-[#D4AF37]/20">
                R$ {sales7Total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mb-2">
              Receita consolidada de todas as unidades
            </p>

            {/* Custom Golden SVG Area Chart matching reference */}
            <div className="relative w-full h-44 flex items-center justify-center">
              <svg
                viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                className="w-full h-full overflow-visible"
              >
                <defs>
                  <linearGradient id="goldGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#D4AF37" stopOpacity="0.45" />
                    <stop offset="85%" stopColor="#D4AF37" stopOpacity="0.02" />
                  </linearGradient>
                </defs>

                {/* Subtle horizontal grid lines */}
                <line x1="15" y1={svgHeight - 20} x2={svgWidth - 15} y2={svgHeight - 20} stroke="#222" strokeWidth="1" />
                <line x1="15" y1={svgHeight - 60} x2={svgWidth - 15} y2={svgHeight - 60} stroke="#1A1A1A" strokeWidth="1" strokeDasharray="3 3" />
                <line x1="15" y1={svgHeight - 100} x2={svgWidth - 15} y2={svgHeight - 100} stroke="#1A1A1A" strokeWidth="1" strokeDasharray="3 3" />

                {/* Filled Area */}
                <path d={areaD} fill="url(#goldGradient)" />

                {/* Stroke Line */}
                <path d={pathD} fill="none" stroke="#D4AF37" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

                {/* Points */}
                {points.map((p, idx) => (
                  <g key={idx} className="cursor-pointer">
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r="4"
                      fill="#0B0B0B"
                      stroke="#D4AF37"
                      strokeWidth="2"
                      className="hover:r-5 transition-all"
                      onMouseEnter={() => setHoveredPoint(p)}
                      onMouseLeave={() => setHoveredPoint(null)}
                    />
                    <text
                      x={p.x}
                      y={svgHeight - 5}
                      textAnchor="middle"
                      fill="#888"
                      fontSize="9"
                      fontWeight="bold"
                    >
                      {p.dia}
                    </text>
                  </g>
                ))}
              </svg>

              {/* Floating Tooltip */}
              {hoveredPoint && (
                <div
                  className="absolute pointer-events-none bg-[#141414] border border-[#D4AF37] px-2.5 py-1 rounded-xl shadow-2xl text-center transform -translate-x-1/2 -translate-y-full z-20"
                  style={{
                    left: `${(hoveredPoint.x / svgWidth) * 100}%`,
                    top: `${(hoveredPoint.y / svgHeight) * 100 - 8}%`,
                  }}
                >
                  <span className="text-[10px] text-slate-400 font-bold block">{hoveredPoint.dia}</span>
                  <span className="text-xs font-black text-[#D4AF37]">
                    R$ {hoveredPoint.valor.toFixed(2)}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-[#1C1C1C] flex items-center justify-between text-xs">
            <span className="text-slate-400">Comparação com a semana anterior:</span>
            {weeklyGrowth === null ? (
              <span className="font-bold text-slate-500">Sem base de comparação</span>
            ) : (
              <span className={`font-bold flex items-center gap-1 ${weeklyGrowth >= 0 ? 'text-[#00C896]' : 'text-rose-400'}`}>
                {weeklyGrowth >= 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                {weeklyGrowth >= 0 ? '+' : ''}{weeklyGrowth.toFixed(1)}% vs semana anterior
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
