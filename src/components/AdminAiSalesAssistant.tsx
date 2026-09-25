import React, { useState, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { AISalesSuggestion } from '../types/ai';
import { RestaurantSlug } from '../types/restaurant';
import {
  Sparkles,
  CheckCircle,
  XCircle,
  Edit3,
  TrendingUp,
  Tag,
  Users,
  ShoppingBag,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';

interface AdminAiSalesAssistantProps {
  selectedSlug: RestaurantSlug | 'all';
}

export const AdminAiSalesAssistant: React.FC<AdminAiSalesAssistantProps> = ({ selectedSlug }) => {
  const { restaurants, orders, menuItems } = useStore();
  const [suggestions, setSuggestions] = useState<AISalesSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  const targetSlug = selectedSlug === 'all' ? 'japones' : selectedSlug;
  const currentRestaurant = restaurants[targetSlug] || restaurants.japones;
  const restaurantMenu = menuItems.filter((m) => m.restaurantSlug === targetSlug);

  const fetchSuggestions = async () => {
    setIsLoading(true);
    try {
      // Calculate real metrics from current store orders
      const relevantOrders = orders.filter(
        (o) => selectedSlug === 'all' || o.restaurantSlug === selectedSlug
      );
      const totalRevenue = relevantOrders.reduce((acc, o) => acc + o.total, 0);
      const avgTicket = relevantOrders.length > 0 ? totalRevenue / relevantOrders.length : 58.5;

      const res = await fetch('/api/ai/sales-suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantSlug: targetSlug,
          restaurantName: currentRestaurant.name,
          totalOrders: relevantOrders.length,
          averageTicket: avgTicket,
          topItemNames: restaurantMenu.slice(0, 3).map((m) => m.name),
          lowSellingNames: restaurantMenu.slice(-2).map((m) => m.name),
          inactiveCustomersCount: 14,
          abandonedCartsCount: 7,
        }),
      });

      const data = await res.json();
      if (data.success && Array.isArray(data.suggestions)) {
        setSuggestions(data.suggestions);
      }
    } catch (err) {
      console.error('Error fetching AI suggestions:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSuggestions();
  }, [selectedSlug]);

  const handleApprove = (id: string) => {
    setSuggestions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status: 'aprovado' } : s))
    );
  };

  const handleReject = (id: string) => {
    setSuggestions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status: 'rejeitado' } : s))
    );
  };

  const handleSaveEdit = (id: string) => {
    setSuggestions((prev) =>
      prev.map((s) =>
        s.id === id
          ? {
              ...s,
              status: 'editado',
              proposedAction: { ...s.proposedAction, description: editText },
            }
          : s
      )
    );
    setEditingId(null);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-5 rounded-2xl bg-gradient-to-br from-[#18130B] via-[#121622] to-[#0A0D14] border border-[#E3BD6A]/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#E3BD6A] to-[#8F6A1E] flex items-center justify-center text-slate-950 font-black shadow-[0_0_20px_rgba(227,189,106,0.3)] shrink-0">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-black text-white tracking-tight flex items-center gap-2">
              Assistente de Vendas IA • {currentRestaurant.name}
            </h2>
            <p className="text-xs text-slate-400">
              Sugestões proativas de combos, upsells e retenção geradas a partir dos pedidos reais
            </p>
          </div>
        </div>

        <button
          onClick={fetchSuggestions}
          disabled={isLoading}
          className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-[#E3BD6A] border border-[#E3BD6A]/30 text-xs font-bold flex items-center gap-2 transition-colors self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>{isLoading ? 'Analisando dados...' : 'Gerar Novas Análises'}</span>
        </button>
      </div>

      {/* Suggestion Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {suggestions.map((sug) => {
          const isPending = sug.status === 'pendente';
          const isApproved = sug.status === 'aprovado';
          const isRejected = sug.status === 'rejeitado';
          const isEdited = sug.status === 'editado';

          return (
            <div
              key={sug.id}
              className={`p-5 rounded-2xl border transition-all flex flex-col justify-between ${
                isApproved
                  ? 'bg-emerald-950/20 border-emerald-500/40'
                  : isRejected
                  ? 'bg-slate-900/40 border-slate-800 opacity-60'
                  : 'bg-[#121622] border-slate-800 hover:border-[#E3BD6A]/40 shadow-sm'
              }`}
            >
              <div className="space-y-3">
                {/* Header info */}
                <div className="flex items-center justify-between gap-2">
                  <span className="px-2.5 py-1 rounded-lg bg-[#E3BD6A]/10 text-[#E3BD6A] text-[10px] font-black uppercase tracking-wider border border-[#E3BD6A]/20">
                    {sug.category.replace('_', ' ')}
                  </span>

                  <span
                    className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                      isApproved
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : isRejected
                        ? 'bg-rose-500/20 text-rose-400'
                        : isEdited
                        ? 'bg-cyan-500/20 text-cyan-400'
                        : 'bg-amber-500/20 text-amber-400'
                    }`}
                  >
                    {sug.status.toUpperCase()}
                  </span>
                </div>

                <h3 className="text-sm font-bold text-white leading-tight">{sug.title}</h3>

                <p className="text-xs text-slate-300 leading-relaxed">{sug.reasoning}</p>

                {/* Impact Estimate */}
                <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between text-xs">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Impacto Estimado:</span>
                  </span>
                  <span className="font-bold text-emerald-400">{sug.impactEstimate}</span>
                </div>

                {/* Proposed Action Box */}
                <div className="p-3 rounded-xl bg-[#181E2E] border border-slate-700/60 text-xs space-y-1">
                  <span className="text-[10px] font-bold text-[#E3BD6A] uppercase tracking-wider block">
                    Ação Proposta pela IA:
                  </span>
                  {editingId === sug.id ? (
                    <div className="space-y-2 pt-1">
                      <textarea
                        rows={2}
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        className="w-full p-2 text-xs bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSaveEdit(sug.id)}
                          className="px-3 py-1 rounded bg-emerald-500 text-slate-950 font-bold text-xs"
                        >
                          Salvar
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="px-3 py-1 rounded bg-slate-800 text-slate-300 text-xs"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-slate-200">
                      {sug.proposedAction.description || 'Configuração automática recomendada'}
                    </p>
                  )}
                </div>
              </div>

              {/* Action Buttons (Approve / Edit / Ignore) */}
              <div className="pt-4 mt-4 border-t border-slate-800/80 flex items-center gap-2">
                {isPending ? (
                  <>
                    <button
                      onClick={() => handleApprove(sug.id)}
                      className="flex-1 py-2 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 shadow transition-colors"
                    >
                      <CheckCircle className="w-4 h-4" />
                      <span>APROVAR</span>
                    </button>

                    <button
                      onClick={() => {
                        setEditingId(sug.id);
                        setEditText(sug.proposedAction.description || '');
                      }}
                      className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center justify-center gap-1 border border-slate-700 transition-colors"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>EDITAR</span>
                    </button>

                    <button
                      onClick={() => handleReject(sug.id)}
                      className="py-2 px-3 rounded-xl bg-slate-800/60 hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 font-bold text-xs flex items-center justify-center gap-1 border border-slate-800 transition-colors"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>IGNORAR</span>
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() =>
                      setSuggestions((prev) =>
                        prev.map((s) => (s.id === sug.id ? { ...s, status: 'pendente' } : s))
                      )
                    }
                    className="text-xs text-slate-400 hover:text-white underline"
                  >
                    Reverter status para Pendente
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
