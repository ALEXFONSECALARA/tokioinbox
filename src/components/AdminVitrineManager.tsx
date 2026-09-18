import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { RestaurantConfig, RestaurantSlug } from '../types/restaurant';
import {
  Sparkles,
  Layers,
  Star,
  Eye,
  EyeOff,
  CheckCircle2,
  Image,
  Tag,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';

export const AdminVitrineManager: React.FC = () => {
  const { restaurants, updateVitrineConfig, checkPermission } = useStore();
  const [editingSlug, setEditingSlug] = useState<string>('japones');

  const restaurantList = Object.values(restaurants).sort(
    (a, b) => (a.vitrineOrder || 0) - (b.vitrineOrder || 0)
  );

  const currentRest = restaurants[editingSlug] || restaurantList[0];

  const handleToggleActive = (slug: string, current: boolean) => {
    if (!checkPermission('can_edit_restaurants')) return;
    updateVitrineConfig(slug, { isActiveInVitrine: !current });
  };

  const handleUpdateBadge = (slug: string, badge: string) => {
    if (!checkPermission('can_edit_restaurants')) return;
    updateVitrineConfig(slug, { vitrineBadge: badge });
  };

  const handleUpdateCallout = (slug: string, text: string) => {
    if (!checkPermission('can_edit_restaurants')) return;
    updateVitrineConfig(slug, { vitrineCallout: text });
  };

  const handleUpdateCover = (slug: string, url: string) => {
    if (!checkPermission('can_edit_restaurants')) return;
    updateVitrineConfig(slug, { vitrineCoverImage: url });
  };

  const handleMoveOrder = (slug: string, direction: 'up' | 'down') => {
    if (!checkPermission('can_edit_restaurants')) return;
    const idx = restaurantList.findIndex((r) => r.slug === slug);
    if (direction === 'up' && idx > 0) {
      const prevRest = restaurantList[idx - 1];
      const currOrder = restaurants[slug].vitrineOrder || idx;
      const prevOrder = prevRest.vitrineOrder || idx - 1;
      updateVitrineConfig(slug, { vitrineOrder: prevOrder });
      updateVitrineConfig(prevRest.slug, { vitrineOrder: currOrder });
    } else if (direction === 'down' && idx < restaurantList.length - 1) {
      const nextRest = restaurantList[idx + 1];
      const currOrder = restaurants[slug].vitrineOrder || idx;
      const nextOrder = nextRest.vitrineOrder || idx + 1;
      updateVitrineConfig(slug, { vitrineOrder: nextOrder });
      updateVitrineConfig(nextRest.slug, { vitrineOrder: currOrder });
    }
  };

  const AVAILABLE_BADGES = [
    'Mais Pedido',
    'Novidade',
    'Frete Grátis',
    'Destaque da Semana',
    'Aberto Agora',
    'Super Desconto',
  ];

  return (
    <div className="space-y-6 animate-fadeIn text-slate-100">
      {/* Header */}
      <div className="bg-[#12151C] border border-[#222836] rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-slate-950 font-black shadow-lg">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-black text-white uppercase tracking-wider">
                Gerenciador da Vitrine Principal
              </h2>
              <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-black px-2 py-0.5 rounded-full uppercase">
                Página Pública
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Configure como os restaurantes aparecem na vitrine, ordem de exibição, badges e capas
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Restaurants Reordering List */}
        <div className="bg-[#151922] border border-slate-800 rounded-2xl p-4 shadow-lg space-y-3">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-2">
            <Layers className="w-4 h-4 text-amber-400" />
            <span>Ordem dos Restaurantes na Vitrine</span>
          </h3>

          <div className="space-y-2.5">
            {restaurantList.map((rest, index) => {
              const isActive = rest.isActiveInVitrine !== false;
              const isSelected = rest.slug === editingSlug;

              return (
                <div
                  key={rest.slug}
                  onClick={() => setEditingSlug(rest.slug)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                    isSelected
                      ? 'bg-amber-500/15 border-amber-500/80 shadow-md'
                      : 'bg-[#1A1F2B] border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-6 h-6 rounded-lg bg-slate-800 text-slate-400 font-mono text-xs flex items-center justify-center font-bold">
                      {index + 1}º
                    </span>
                    <div className="min-w-0">
                      <span className="text-xs font-bold text-white block truncate">{rest.name}</span>
                      <span className="text-[10px] text-slate-400 block truncate">
                        {rest.vitrineBadge || 'Sem badge'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => handleToggleActive(rest.slug, isActive)}
                      className={`p-1.5 rounded-lg border transition-colors ${
                        isActive
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                          : 'bg-red-500/20 text-red-300 border-red-500/30'
                      }`}
                      title={isActive ? 'Ativo na Vitrine' : 'Oculto na Vitrine'}
                    >
                      {isActive ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMoveOrder(rest.slug, 'up')}
                      disabled={index === 0}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-300"
                      title="Mover para Cima"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMoveOrder(rest.slug, 'down')}
                      disabled={index === restaurantList.length - 1}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-300"
                      title="Mover para Baixo"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Center & Right 2 Columns: Edit Details for Selected Restaurant */}
        {currentRest && (
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-[#151922] border border-slate-800 rounded-2xl p-5 shadow-lg space-y-5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <span className="text-[11px] text-amber-400 font-bold uppercase tracking-wider">
                    Editando na Vitrine
                  </span>
                  <h3 className="text-base font-black text-white">{currentRest.name}</h3>
                </div>
                <span
                  className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${
                    currentRest.isActiveInVitrine !== false
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                      : 'bg-red-500/20 text-red-300 border-red-500/30'
                  }`}
                >
                  {currentRest.isActiveInVitrine !== false ? 'Visível na Vitrine' : 'Oculto'}
                </span>
              </div>

              {/* Badges Selector */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 uppercase flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-amber-400" />
                  <span>Etiqueta Promocional (Badge de Destaque)</span>
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {AVAILABLE_BADGES.map((b) => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => handleUpdateBadge(currentRest.slug, b)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                        currentRest.vitrineBadge === b
                          ? 'bg-amber-500 text-slate-950 border-amber-400 shadow'
                          : 'bg-[#1A1F2B] text-slate-400 border-slate-800 hover:text-white'
                      }`}
                    >
                      {b}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => handleUpdateBadge(currentRest.slug, '')}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold bg-[#1A1F2B] text-slate-500 border border-slate-800 hover:text-white"
                  >
                    Nenhuma
                  </button>
                </div>
              </div>

              {/* Promotional Callout Phrase */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 uppercase block">
                  Texto da Chamada Promocional (Slogan do Card)
                </label>
                <input
                  type="text"
                  value={currentRest.vitrineCallout || ''}
                  onChange={(e) => handleUpdateCallout(currentRest.slug, e.target.value)}
                  placeholder="Ex: O melhor da autêntica gastronomia oriental com peixes frescos"
                  className="w-full bg-[#0E1015] border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Cover Image */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 uppercase flex items-center gap-1.5">
                  <Image className="w-3.5 h-3.5 text-amber-400" />
                  <span>URL da Imagem da Capa na Vitrine</span>
                </label>
                <input
                  type="text"
                  value={currentRest.vitrineCoverImage || currentRest.bannerImage || ''}
                  onChange={(e) => handleUpdateCover(currentRest.slug, e.target.value)}
                  className="w-full bg-[#0E1015] border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>

              {/* Live Preview of the Card */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <span className="text-[11px] font-bold text-slate-400 uppercase block">
                  Pré-visualização do Card na Vitrine:
                </span>
                <div className="relative h-44 rounded-2xl overflow-hidden border border-slate-700 shadow-xl bg-slate-900 group">
                  <img
                    src={currentRest.vitrineCoverImage || currentRest.bannerImage}
                    alt={currentRest.name}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
                  {currentRest.vitrineBadge && (
                    <span className="absolute top-3 right-3 bg-amber-500 text-slate-950 font-black text-[11px] px-2.5 py-0.5 rounded-full shadow">
                      {currentRest.vitrineBadge}
                    </span>
                  )}
                  <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-black text-white">{currentRest.name}</h4>
                      <p className="text-[11px] text-slate-300 line-clamp-1">
                        {currentRest.vitrineCallout || currentRest.tagline}
                      </p>
                    </div>
                    <span className="text-[11px] font-bold text-amber-400 bg-black/60 px-2 py-1 rounded-lg">
                      {currentRest.deliveryTime}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
