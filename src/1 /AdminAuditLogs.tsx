import React, { useState, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { AuditActionLog } from '../types/restaurant';
import {
  ShieldAlert,
  Search,
  Filter,
  RefreshCw,
  Clock,
  User,
  Activity,
  FileText,
  AlertTriangle,
  Smartphone,
  CheckCircle2,
} from 'lucide-react';

export const AdminAuditLogs: React.FC = () => {
  const { auditLogs, refreshAuditLogs } = useStore();

  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    refreshAuditLogs();
  }, [refreshAuditLogs]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshAuditLogs();
    setTimeout(() => setIsRefreshing(false), 400);
  };

  const filteredLogs = auditLogs.filter((log) => {
    if (filterCategory !== 'all' && log.category !== filterCategory) return false;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const matchAction = log.action.toLowerCase().includes(q);
      const matchUser = log.userName.toLowerCase().includes(q);
      const matchDetails = log.details?.toLowerCase().includes(q);
      return matchAction || matchUser || matchDetails;
    }
    return true;
  });

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case 'order':
        return (
          <span className="text-[10px] bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded-full font-bold">
            Pedido
          </span>
        );
      case 'user':
        return (
          <span className="text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded-full font-bold">
            Usuário
          </span>
        );
      case 'alert':
        return (
          <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full font-bold">
            Alerta/Som
          </span>
        );
      case 'device':
        return (
          <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">
            Celular
          </span>
        );
      default:
        return (
          <span className="text-[10px] bg-slate-800 text-slate-400 border border-slate-700 px-2 py-0.5 rounded-full font-bold">
            Sistema
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center text-2xl shadow-md">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-black text-white flex items-center gap-2">
              <span>Trilha de Auditoria &amp; Logs de Operação</span>
              <span className="text-xs bg-slate-800 text-slate-400 border border-slate-700 px-2 py-0.5 rounded-full">
                {auditLogs.length} Registros
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Rastreabilidade total: quem alterou status de pedidos, silenciou alarmes, logou no sistema ou alterou cardápio.
            </p>
          </div>
        </div>

        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition-colors"
          title="Atualizar Logs"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Filtrar por operador, pedido ou palavra-chave..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
          {['all', 'order', 'user', 'alert', 'device', 'system'].map((cat) => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${
                filterCategory === cat
                  ? 'bg-amber-500 text-slate-950 font-black'
                  : 'bg-slate-950 text-slate-400 border border-slate-800 hover:border-slate-700'
              }`}
            >
              {cat === 'all'
                ? 'Todos'
                : cat === 'order'
                ? 'Pedidos'
                : cat === 'user'
                ? 'Usuários'
                : cat === 'alert'
                ? 'Alertas'
                : cat === 'device'
                ? 'Celulares'
                : 'Sistema'}
            </button>
          ))}
        </div>
      </div>

      {/* Logs Timeline List */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-300">Histórico de Eventos Recentes</span>
          <span className="text-[11px] text-slate-500 font-mono">Persistido em audit_logs.json</span>
        </div>

        {filteredLogs.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs">
            Nenhum registro de auditoria encontrado para o filtro atual.
          </div>
        ) : (
          <div className="divide-y divide-slate-800/80 max-h-[600px] overflow-y-auto">
            {filteredLogs.map((log) => {
              const dateStr = new Date(log.timestamp).toLocaleString('pt-BR');
              return (
                <div
                  key={log.id}
                  className="p-4 hover:bg-slate-850/40 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      {getCategoryBadge(log.category)}
                      <span className="text-xs font-bold text-white">{log.action}</span>
                    </div>

                    {log.details && (
                      <p className="text-[11px] text-slate-400 font-mono pl-0.5">
                        {log.details}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-3 shrink-0 text-right">
                    <div className="text-right">
                      <div className="text-[11px] font-bold text-amber-300">
                        {log.userName}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1 justify-end">
                        <Clock className="w-2.5 h-2.5" />
                        <span>{dateStr}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
