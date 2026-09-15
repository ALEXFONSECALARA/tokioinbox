import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { RestaurantSlug } from '../types/restaurant';
import { AIPromotionRule } from '../types/marketing';
import {
  Tag,
  Plus,
  Percent,
  CheckCircle2,
  Clock,
  Calendar,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Gift,
} from 'lucide-react';

interface AdminAiPromotionsProps {
  selectedSlug: RestaurantSlug | 'all';
}

export const AdminAiPromotions: React.FC<AdminAiPromotionsProps> = ({ selectedSlug }) => {
  const { restaurants } = useStore();
  const targetSlug = selectedSlug === 'all' ? 'japones' : selectedSlug;
  const currentRestaurant = restaurants[targetSlug] || restaurants.japones;

  const [promotions, setPromotions] = useState<AIPromotionRule[]>([
    {
      id: 'promo-1',
      restaurantSlug: targetSlug,
      title: '15% OFF de Boas-Vindas PWA',
      type: 'percentual',
      value: 15,
      minOrderValue: 40,
      daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
      targetAudience: 'novos_clientes',
      maxTotalUses: 500,
      currentUses: 78,
      maxUsesPerCustomer: 1,
      status: 'ativa',
      couponCode: 'AURAAPP15',
      startDate: '2026-01-01',
      endDate: '2026-12-31',
    },
    {
      id: 'promo-2',
      restaurantSlug: targetSlug,
      title: 'Frete Grátis acima de R$ 90',
      type: 'frete_gratis',
      value: 0,
      minOrderValue: 90,
      daysOfWeek: [2, 3, 4], // Ter, Qua, Qui
      startTime: '18:00',
      endTime: '22:00',
      targetAudience: 'todos',
      maxTotalUses: 200,
      currentUses: 64,
      maxUsesPerCustomer: 3,
      status: 'ativa',
      couponCode: 'FRETELIVRE',
      startDate: '2026-02-01',
      endDate: '2026-12-31',
    },
    {
      id: 'promo-3',
      restaurantSlug: targetSlug,
      title: 'Reativação: R$ 20 OFF para Clientes Inativos',
      type: 'fixo',
      value: 20,
      minOrderValue: 70,
      daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
      targetAudience: 'inativos',
      maxTotalUses: 100,
      currentUses: 19,
      maxUsesPerCustomer: 1,
      status: 'ativa',
      couponCode: 'VOLTE20',
      startDate: '2026-03-01',
      endDate: '2026-12-31',
    },
  ]);

  const [showNewModal, setShowNewModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCode, setNewCode] = useState('');
  const [newValue, setNewValue] = useState(10);
  const [newMinOrder, setNewMinOrder] = useState(50);
  const [newType, setNewType] = useState<AIPromotionRule['type']>('percentual');

  const handleCreatePromo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newCode.trim()) return;

    const newPromo: AIPromotionRule = {
      id: `promo-${Date.now()}`,
      restaurantSlug: targetSlug,
      title: newTitle.trim(),
      type: newType,
      value: Number(newValue),
      minOrderValue: Number(newMinOrder),
      daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
      targetAudience: 'todos',
      maxTotalUses: 300,
      currentUses: 0,
      maxUsesPerCustomer: 1,
      status: 'ativa',
      couponCode: newCode.trim().toUpperCase(),
      startDate: new Date().toISOString().slice(0, 10),
      endDate: '2026-12-31',
    };

    setPromotions((prev) => [newPromo, ...prev]);
    setShowNewModal(false);
    setNewTitle('');
    setNewCode('');
  };

  const handleToggleStatus = (id: string) => {
    setPromotions((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, status: p.status === 'ativa' ? 'pausada' : 'ativa' } : p
      )
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-5 rounded-2xl bg-gradient-to-br from-[#18130B] via-[#121622] to-[#0A0D14] border border-[#E3BD6A]/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#E3BD6A] to-[#8F6A1E] flex items-center justify-center text-slate-950 font-black shadow-[0_0_20px_rgba(227,189,106,0.3)] shrink-0">
            <Tag className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-black text-white tracking-tight">
              Motor de Promoções &amp; Cupons • {currentRestaurant.name}
            </h2>
            <p className="text-xs text-slate-400">
              Descontos percentuais, fixos, frete grátis e regras por pedido mínimo e público-alvo
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowNewModal(true)}
          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#E3BD6A] to-[#C99C3D] hover:brightness-110 text-slate-950 font-black text-xs shadow flex items-center gap-2 transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Nova Promoção</span>
        </button>
      </div>

      {/* Promotions List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {promotions.map((promo) => {
          const isActive = promo.status === 'ativa';

          return (
            <div
              key={promo.id}
              className={`p-4 rounded-2xl border transition-colors flex flex-col justify-between ${
                isActive ? 'bg-[#121622] border-slate-800 hover:border-[#E3BD6A]/40' : 'bg-slate-950/40 border-slate-900 opacity-60'
              }`}
            >
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-black px-2.5 py-1 rounded-lg bg-[#E3BD6A]/10 text-[#E3BD6A] border border-[#E3BD6A]/20">
                    {promo.couponCode}
                  </span>
                  <button
                    onClick={() => handleToggleStatus(promo.id)}
                    className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                      isActive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {isActive ? 'ATIVA' : 'PAUSADA'}
                  </button>
                </div>

                <h3 className="text-sm font-bold text-white">{promo.title}</h3>

                <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 text-xs space-y-1">
                  <p className="text-slate-300">
                    Tipo: <strong className="text-white uppercase">{promo.type.replace('_', ' ')}</strong>{' '}
                    {promo.type === 'percentual' && `(${promo.value}% OFF)`}
                    {promo.type === 'fixo' && `(R$ ${promo.value.toFixed(2)} OFF)`}
                  </p>
                  <p className="text-slate-400">
                    Pedido Mínimo: <strong className="text-white">R$ {promo.minOrderValue.toFixed(2)}</strong>
                  </p>
                  <p className="text-slate-400">
                    Usos: {promo.currentUses} / {promo.maxTotalUses} (máx {promo.maxUsesPerCustomer} por cliente)
                  </p>
                </div>
              </div>

              <div className="pt-3 mt-3 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
                <span>Público: {promo.targetAudience}</span>
                <span className="text-[#E3BD6A] font-bold">Validade 2026</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* New Promotion Modal */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <form
            onSubmit={handleCreatePromo}
            className="w-full max-w-md bg-[#0E121B] border border-[#E3BD6A]/30 rounded-2xl p-6 shadow-2xl space-y-4"
          >
            <h3 className="text-base font-bold text-white">Criar Nova Promoção</h3>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Título da Promoção:</label>
              <input
                type="text"
                required
                placeholder="Ex: Noite do Sushi 10% OFF"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:border-[#E3BD6A] focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Código do Cupom:</label>
                <input
                  type="text"
                  required
                  placeholder="EX: AURA10"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs font-mono uppercase focus:border-[#E3BD6A] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Tipo de Desconto:</label>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:outline-none"
                >
                  <option value="percentual">Percentual (%)</option>
                  <option value="fixo">Fixo (R$)</option>
                  <option value="frete_gratis">Frete Grátis</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Valor do Desconto:</label>
                <input
                  type="number"
                  value={newValue}
                  onChange={(e) => setNewValue(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Pedido Mínimo (R$):</label>
                <input
                  type="number"
                  value={newMinOrder}
                  onChange={(e) => setNewMinOrder(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:outline-none"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                className="flex-1 py-2.5 rounded-xl bg-[#E3BD6A] hover:bg-[#F5D38A] text-slate-950 font-black text-xs transition-colors"
              >
                Ativar Promoção
              </button>
              <button
                type="button"
                onClick={() => setShowNewModal(false)}
                className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
