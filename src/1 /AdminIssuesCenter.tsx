import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { RestaurantSlug, Order } from '../types/restaurant';
import {
  AlertTriangle,
  Clock,
  Printer,
  CheckCircle2,
  RefreshCw,
  Phone,
  ArrowRight,
  ShieldAlert,
  Flame,
} from 'lucide-react';

interface AdminIssuesCenterProps {
  selectedSlug: RestaurantSlug | 'all';
}

interface IssueItem {
  id: string;
  type: 'pedido_atrasado' | 'impressao_falhou' | 'loja_fechada' | 'pagamento_pendente';
  severity: 'CRITICO' | 'ALTO' | 'MEDIO';
  title: string;
  description: string;
  targetId: string;
  restaurantSlug: RestaurantSlug;
  suggestedAction: string;
  resolved: boolean;
}

export const AdminIssuesCenter: React.FC<AdminIssuesCenterProps> = ({ selectedSlug }) => {
  const { orders, restaurants, updateOrderStatus, updateOrderPrintStatus } = useStore();

  const [resolvedIds, setResolvedIds] = useState<string[]>([]);

  // Detect real issues dynamically from current orders and restaurant state
  const issues: IssueItem[] = [];

  // 1. Check orders delayed (>15 min in preparo or recebido)
  const now = Date.now();
  orders.forEach((o) => {
    if (selectedSlug !== 'all' && o.restaurantSlug !== selectedSlug) return;
    if (o.status === 'recebido' || o.status === 'em_preparo') {
      const orderTime = new Date(o.createdAt).getTime();
      const elapsedMinutes = Math.floor((now - orderTime) / 60000);
      if (elapsedMinutes > 15) {
        issues.push({
          id: `issue-delay-${o.id}`,
          type: 'pedido_atrasado',
          severity: elapsedMinutes > 30 ? 'CRITICO' : 'ALTO',
          title: `Pedido ${o.shortCode} Atrasado (${elapsedMinutes} min)`,
          description: `O cliente ${o.customerName} aguarda o pedido há ${elapsedMinutes} minutos no status "${o.status}".`,
          targetId: o.id,
          restaurantSlug: o.restaurantSlug,
          suggestedAction: 'Avançar para Pronto e Notificar Cliente',
          resolved: resolvedIds.includes(`issue-delay-${o.id}`),
        });
      }
    }

    // 2. Check printing failed or pending
    if (o.printStatus === 'falha') {
      issues.push({
        id: `issue-print-${o.id}`,
        type: 'impressao_falhou',
        severity: 'ALTO',
        title: `Falha na Impressão do Pedido ${o.shortCode}`,
        description: `O cupom térmico não pôde ser impresso para a cozinha (${o.restaurantName}).`,
        targetId: o.id,
        restaurantSlug: o.restaurantSlug,
        suggestedAction: 'Reenviar Cupom Térmico',
        resolved: resolvedIds.includes(`issue-print-${o.id}`),
      });
    }
  });

  // 3. Simulated store check
  Object.values(restaurants).forEach((rest) => {
    if (selectedSlug !== 'all' && rest.slug !== selectedSlug) return;
    if (!rest.isOpen) {
      issues.push({
        id: `issue-store-${rest.slug}`,
        type: 'loja_fechada',
        severity: 'MEDIO',
        title: `Restaurante ${rest.name} Fechado`,
        description: 'A cozinha está marcada como fechada no momento. Novos clientes não conseguirão pedir.',
        targetId: rest.slug,
        restaurantSlug: rest.slug,
        suggestedAction: 'Abrir Loja Agora',
        resolved: resolvedIds.includes(`issue-store-${rest.slug}`),
      });
    }
  });

  const activeIssues = issues.filter((i) => !i.resolved);

  const handleResolve = async (issue: IssueItem) => {
    if (issue.type === 'pedido_atrasado') {
      await updateOrderStatus(issue.targetId, 'pronto', 'Acelerado pela Central de Problemas');
    } else if (issue.type === 'impressao_falhou') {
      await updateOrderPrintStatus(issue.targetId, 'impresso');
    }
    setResolvedIds((prev) => [...prev, issue.id]);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-5 rounded-2xl bg-gradient-to-br from-[#1c0e0e] via-[#121622] to-[#0A0D14] border border-rose-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 font-black shadow-md shrink-0">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black text-white tracking-tight">
                Central de Problemas &amp; Exceções Operacionais
              </h2>
              <span
                className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                  activeIssues.length === 0
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-rose-500/20 text-rose-400 animate-pulse'
                }`}
              >
                {activeIssues.length} Alerta(s) Ativo(s)
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Monitoramento contínuo de gargalos de cozinha, impressões travadas e atrasos em tempo real
            </p>
          </div>
        </div>
      </div>

      {/* Issues List */}
      <div className="space-y-3">
        {activeIssues.length === 0 ? (
          <div className="p-10 text-center border border-dashed border-emerald-500/30 rounded-2xl bg-emerald-950/10 space-y-2">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
            <h3 className="text-base font-bold text-white">Operação 100% Estável</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Nenhum pedido com atraso crítico, impressões falhas ou divergências detectadas no momento.
            </p>
          </div>
        ) : (
          activeIssues.map((issue) => (
            <div
              key={issue.id}
              className="p-4 rounded-xl bg-[#141014] border border-rose-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-rose-500/50 transition-colors"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider ${
                      issue.severity === 'CRITICO'
                        ? 'bg-rose-600 text-white'
                        : issue.severity === 'ALTO'
                        ? 'bg-amber-500 text-slate-950'
                        : 'bg-blue-500 text-white'
                    }`}
                  >
                    {issue.severity}
                  </span>
                  <h4 className="text-sm font-bold text-white">{issue.title}</h4>
                </div>
                <p className="text-xs text-slate-300">{issue.description}</p>
                <span className="text-[11px] text-slate-500 block">
                  Restaurante: <strong className="text-slate-300">{issue.restaurantSlug}</strong>
                </span>
              </div>

              <button
                onClick={() => handleResolve(issue)}
                className="py-2 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:brightness-110 text-slate-950 font-black text-xs shadow flex items-center justify-center gap-1.5 shrink-0 transition-transform active:scale-95"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{issue.suggestedAction}</span>
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
