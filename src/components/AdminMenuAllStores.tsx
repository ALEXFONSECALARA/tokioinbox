import React, { useMemo, useState } from 'react';
import { useStore } from '../context/StoreContext';
import type { RestaurantSlug } from '../types/restaurant';

interface Props {
  /** abre o editor de cardápio de um restaurante específico */
  onEditRestaurant: (slug: RestaurantSlug) => void;
}

/**
 * V9.2 — CARDÁPIOS › "TODAS AS LOJAS": cardápio consolidado de TODOS os restaurantes
 * cadastrados e permitidos ao usuário (sem limite fixo). Antes, "Todas as Lojas" caía
 * silenciosamente em um único restaurante. Cada restaurante é um bloco recolhível; itens
 * e imagens só são montados quando o bloco é aberto (menos DOM/rede).
 */
export const AdminMenuAllStores: React.FC<Props> = ({ onEditRestaurant }) => {
  const { restaurants, categories, menuItems, currentUser } = useStore();
  const [openSlugs, setOpenSlugs] = useState<string[]>([]);
  const [query, setQuery] = useState('');

  const visible = useMemo(
    () =>
      Object.values(restaurants).filter(
        (r) => currentUser?.restaurantSlug === 'all' || r.slug === currentUser?.restaurantSlug
      ),
    [restaurants, currentUser]
  );

  // índices por restaurante calculados uma única vez (evita filtrar o array inteiro N vezes por render)
  const byRestaurant = useMemo(() => {
    const cats: Record<string, typeof categories> = {};
    const items: Record<string, typeof menuItems> = {};
    for (const c of categories) (cats[c.restaurantSlug] ||= []).push(c);
    for (const i of menuItems) (items[i.restaurantSlug] ||= []).push(i);
    return { cats, items };
  }, [categories, menuItems]);

  const toggle = (slug: string) =>
    setOpenSlugs((prev) => (prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]));

  const q = query.trim().toLowerCase();

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-white">🌐 Cardápio — Todas as Lojas</h2>
          <p className="text-xs text-slate-400">
            {visible.length} restaurante(s) • {menuItems.length} produto(s). Para editar, abra o restaurante desejado.
          </p>
        </div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar produto em todas as lojas…"
          className="bg-[#0E1015] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white w-full sm:w-72"
        />
      </div>

      {visible.map((r) => {
        const cats = byRestaurant.cats[r.slug] || [];
        const allItems = byRestaurant.items[r.slug] || [];
        const items = q
          ? allItems.filter((i) => i.name.toLowerCase().includes(q) || (i.description || '').toLowerCase().includes(q))
          : allItems;
        const isOpen = openSlugs.includes(r.slug) || (q !== '' && items.length > 0);
        const mode = r.isActive === false ? 'DESATIVADO' : r.isOpen ? 'ATIVO' : 'PAUSADO';
        if (q && items.length === 0) return null;
        return (
          <section key={r.slug} className="bg-slate-900/70 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="p-4 flex items-center gap-3">
              <button type="button" onClick={() => toggle(r.slug)} className="flex-1 min-w-0 flex items-center gap-3 text-left">
                <span className="text-2xl">{r.emoji}</span>
                <span className="min-w-0">
                  <span className="block font-bold text-white text-sm truncate">{r.name}</span>
                  <span className="block text-[11px] text-slate-400">
                    {cats.length} categorias • {allItems.length} produtos
                  </span>
                </span>
              </button>
              <span
                className={`text-[10px] font-black px-2 py-0.5 rounded border ${
                  mode === 'ATIVO'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    : mode === 'PAUSADO'
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                    : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                }`}
              >
                {mode}
              </span>
              <button
                type="button"
                onClick={() => onEditRestaurant(r.slug)}
                className="text-[11px] px-2.5 py-1.5 rounded-lg border border-slate-700 text-slate-200 font-bold hover:bg-slate-800"
              >
                Editar cardápio
              </button>
            </div>

            {isOpen && (
              <div className="border-t border-slate-800 p-4 space-y-4">
                {cats.length === 0 && items.length === 0 && (
                  <p className="text-xs text-slate-500">Nenhum produto cadastrado.</p>
                )}
                {cats.map((c) => {
                  const catItems = items.filter((i) => i.categoryId === c.id);
                  if (catItems.length === 0) return null;
                  return (
                    <div key={c.id} className="space-y-2">
                      <h4 className="text-[11px] font-black uppercase tracking-wider text-amber-300">
                        {c.name} <span className="text-slate-500">({catItems.length})</span>
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {catItems.map((i) => (
                          <div key={i.id} className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl p-2">
                            {i.image ? (
                              <img
                                src={i.image}
                                alt=""
                                loading="lazy"
                                decoding="async"
                                width={40}
                                height={40}
                                className="w-10 h-10 rounded-lg object-cover shrink-0"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-lg bg-slate-800 shrink-0" />
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-bold text-white truncate">{i.name}</div>
                              <div className="text-[10px] text-slate-500">{i.available === false ? 'Indisponível' : 'Disponível'}</div>
                            </div>
                            <div className="text-xs font-mono font-black text-amber-400">
                              R$ {(i.promoPrice ?? i.price).toFixed(2)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
};
