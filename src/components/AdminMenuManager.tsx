import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { MenuItem, RestaurantSlug } from '../types/restaurant';
import {
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  Image as ImageIcon,
  Tag,
  Search,
  Sparkles,
  TrendingUp,
  DollarSign,
  AlertTriangle,
  Percent,
} from 'lucide-react';

interface AdminMenuManagerProps {
  currentRestaurantSlug: RestaurantSlug;
}

export const AdminMenuManager: React.FC<AdminMenuManagerProps> = ({
  currentRestaurantSlug,
}) => {
  const {
    restaurants,
    categories,
    menuItems,
    updateMenuItem,
    addMenuItem,
    deleteMenuItem,
    showToast,
  } = useStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCatFilter, setSelectedCatFilter] = useState<string>('all');
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formPromoPrice, setFormPromoPrice] = useState('');
  const [formCmvCost, setFormCmvCost] = useState('');
  const [formImage, setFormImage] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formIsAvailable, setFormIsAvailable] = useState(true);

  const restaurant = restaurants[currentRestaurantSlug] || restaurants.japones;
  const restaurantCategories = categories.filter(
    (c) => c.restaurantSlug === currentRestaurantSlug
  );

  const filteredItems = menuItems.filter((item) => {
    if (item.restaurantSlug !== currentRestaurantSlug) return false;
    if (selectedCatFilter !== 'all' && item.categoryId !== selectedCatFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        item.name.toLowerCase().includes(q) || item.description.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const openCreateModal = () => {
    setIsCreating(true);
    setEditingItem(null);
    setFormName('');
    setFormDesc('');
    setFormPrice('');
    setFormPromoPrice('');
    setFormCmvCost('');
    setFormImage(
      'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=80'
    );
    setFormCategory(restaurantCategories[0]?.id || '');
    setFormIsAvailable(true);
  };

  const openEditModal = (item: MenuItem) => {
    setEditingItem(item);
    setIsCreating(false);
    setFormName(item.name);
    setFormDesc(item.description);
    setFormPrice(item.price.toString());
    setFormPromoPrice(item.promoPrice ? item.promoPrice.toString() : '');
    setFormCmvCost(item.cmvCost ? item.cmvCost.toString() : '');
    setFormImage(item.image);
    setFormCategory(item.categoryId);
    setFormIsAvailable(item.available);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formName.trim() || !formPrice.trim() || !formCategory) {
      showToast('Preencha os campos obrigatórios (Nome, Preço e Categoria).', 'warning');
      return;
    }

    const priceNum = parseFloat(formPrice);
    const promoNum = formPromoPrice ? parseFloat(formPromoPrice) : undefined;
    const cmvCostNum = formCmvCost ? parseFloat(formCmvCost) : undefined;

    if (isNaN(priceNum) || priceNum <= 0) {
      showToast('Informe um valor de preço de venda válido.', 'warning');
      return;
    }

    if (editingItem) {
      updateMenuItem({
        ...editingItem,
        name: formName.trim(),
        description: formDesc.trim(),
        price: priceNum,
        promoPrice: promoNum,
        cmvCost: cmvCostNum,
        image: formImage.trim(),
        categoryId: formCategory,
        available: formIsAvailable,
      });
      showToast(`Prato "${formName.trim()}" atualizado com sucesso!`, 'success');
    } else {
      addMenuItem({
        restaurantSlug: currentRestaurantSlug,
        categoryId: formCategory,
        name: formName.trim(),
        description: formDesc.trim(),
        price: priceNum,
        promoPrice: promoNum,
        cmvCost: cmvCostNum,
        image:
          formImage.trim() ||
          'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=80',
        available: formIsAvailable,
        tags: ['destaque'],
      });
      showToast(`Prato "${formName.trim()}" cadastrado com sucesso!`, 'success');
    }

    setEditingItem(null);
    setIsCreating(false);
  };

  const handleToggleAvailable = (item: MenuItem) => {
    updateMenuItem({
      ...item,
      available: !item.available,
    });
    showToast(`Status de "${item.name}" alterado para ${!item.available ? 'Ativo' : 'Pausado'}.`, 'info');
  };

  const handleDelete = (item: MenuItem) => {
    if (window.confirm(`Tem certeza que deseja excluir "${item.name}" do cardápio?`)) {
      deleteMenuItem(item.id);
      showToast(`Prato "${item.name}" excluído.`, 'success');
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Toolbar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="text-2xl">{restaurant.emoji}</div>
          <div>
            <h2 className="text-sm font-bold text-white">Cardápio: {restaurant.name}</h2>
            <p className="text-xs text-slate-400">
              {filteredItems.length} pratos cadastrados no total
            </p>
          </div>
        </div>

        <button
          onClick={openCreateModal}
          className="w-full sm:w-auto px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl flex items-center justify-center gap-2 shadow-md transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Novo Item no Cardápio</span>
        </button>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Pesquisar produto por nome ou descrição..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
          />
        </div>

        <select
          value={selectedCatFilter}
          onChange={(e) => setSelectedCatFilter(e.target.value)}
          className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
        >
          <option value="all">Todas as Categorias</option>
          {restaurantCategories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.icon || '🍽️'} {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* Item Table / Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredItems.map((item) => {
          const cat = categories.find((c) => c.id === item.categoryId);

          return (
            <div
              key={item.id}
              className={`bg-slate-950 border rounded-2xl p-4 flex flex-col justify-between transition-all ${
                item.available
                  ? 'border-slate-800 hover:border-slate-700'
                  : 'border-slate-900 opacity-60 bg-slate-950/40'
              }`}
            >
              <div className="flex gap-3">
                <img
                  src={item.image}
                  alt={item.name}
                  className="w-16 h-16 rounded-xl object-cover shrink-0 border border-slate-800"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded">
                      {cat?.name || 'Geral'}
                    </span>
                    {item.tags?.includes('mais_vendido') && (
                      <span className="text-[10px] bg-amber-500/20 text-amber-400 font-bold px-1.5 py-0.5 rounded">
                        Top
                      </span>
                    )}
                  </div>
                  <h3 className="text-xs font-bold text-white truncate mt-1">{item.name}</h3>
                  <p className="text-[11px] text-slate-400 line-clamp-2 mt-0.5">
                    {item.description}
                  </p>
                </div>
              </div>

              {/* Price & Controls */}
              <div className="mt-4 pt-3 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-black text-amber-400">
                      R$ {(item.promoPrice || item.price).toFixed(2)}
                    </span>
                    {item.promoPrice && (
                      <span className="text-[10px] text-slate-500 line-through ml-1.5">
                        R$ {item.price.toFixed(2)}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleToggleAvailable(item)}
                      className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-colors ${
                        item.available
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                      }`}
                    >
                      {item.available ? 'Ativo' : 'Pausado'}
                    </button>

                    <button
                      onClick={() => openEditModal(item)}
                      className="p-1.5 text-slate-400 hover:text-white rounded-lg bg-slate-900 border border-slate-800"
                      title="Editar produto"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => handleDelete(item)}
                      className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg bg-slate-900 border border-slate-800"
                      title="Excluir produto"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* CMV Cost & Health Indicator */}
                {(() => {
                  const sellPrice = item.promoPrice || item.price;
                  const cost = item.cmvCost;
                  const cmvRatio = cost && sellPrice > 0 ? (cost / sellPrice) * 100 : null;

                  if (cmvRatio === null) return null;

                  return (
                    <div className="mt-2 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px]">
                      <span className="text-slate-400 font-mono">
                        Custo: R$ {cost.toFixed(2)}
                      </span>
                      <span
                        className={`font-black px-1.5 py-0.5 rounded border flex items-center gap-1 ${
                          cmvRatio > 35
                            ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                            : cmvRatio > 30
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                            : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        }`}
                      >
                        {cmvRatio > 35 && <AlertTriangle className="w-3 h-3 text-rose-400" />}
                        <span>CMV {cmvRatio.toFixed(0)}%</span>
                        <span>{cmvRatio > 35 ? '(Crítico)' : cmvRatio > 30 ? '(Alerta)' : '(OK)'}</span>
                      </span>
                    </div>
                  );
                })()}
              </div>
            </div>
          );
        })}
      </div>

      {/* Edit / Create Item Modal */}
      {(isCreating || editingItem) && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-white">
              {editingItem ? `Editar: ${editingItem.name}` : 'Novo Item no Cardápio'}
            </h3>

            <form onSubmit={handleSave} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Nome do Prato *</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Descrição Detalhada</label>
                <textarea
                  rows={2}
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Preço Normal (R$) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formPrice}
                    onChange={(e) => setFormPrice(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Preço Promo (Opcional)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formPromoPrice}
                    onChange={(e) => setFormPromoPrice(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                  />
                </div>
              </div>

              {/* CMV Cost & Profit Preview */}
              <div className="p-3 bg-[#0E1015] border border-slate-800 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                    <DollarSign className="w-3.5 h-3.5 text-amber-400" />
                    <span>Custo Insumos / CMV (R$)</span>
                  </label>
                  <span className="text-[10px] text-slate-500">Opcional para cálculo automático</span>
                </div>
                <input
                  type="number"
                  step="0.01"
                  placeholder="Ex: 8.50"
                  value={formCmvCost}
                  onChange={(e) => setFormCmvCost(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono text-xs focus:border-amber-500"
                />

                {/* Real-time CMV / Margin preview */}
                {(() => {
                  const effectiveSell = parseFloat(formPromoPrice) || parseFloat(formPrice);
                  const cost = parseFloat(formCmvCost);
                  if (!isNaN(effectiveSell) && effectiveSell > 0 && !isNaN(cost) && cost > 0) {
                    const cmvPct = (cost / effectiveSell) * 100;
                    const marginPct = 100 - cmvPct;
                    const grossProfit = effectiveSell - cost;

                    return (
                      <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px]">
                        <div>
                          <span className="text-slate-400">Lucro Bruto: </span>
                          <strong className="text-white font-mono">R$ {grossProfit.toFixed(2)}</strong>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-black px-1.5 py-0.5 rounded text-[10px] ${
                              cmvPct > 35
                                ? 'bg-rose-500/20 text-rose-300'
                                : cmvPct > 30
                                ? 'bg-amber-500/20 text-amber-300'
                                : 'bg-emerald-500/20 text-emerald-300'
                            }`}
                          >
                            CMV: {cmvPct.toFixed(1)}%
                          </span>
                          <span className="text-slate-400">Margem: <strong className="text-emerald-400">{marginPct.toFixed(1)}%</strong></span>
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Categoria *</label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                >
                  {restaurantCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">URL da Foto (Unsplash/Web)</label>
                <input
                  type="url"
                  value={formImage}
                  onChange={(e) => setFormImage(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="availCheck"
                  checked={formIsAvailable}
                  onChange={(e) => setFormIsAvailable(e.target.checked)}
                  className="accent-amber-500"
                />
                <label htmlFor="availCheck" className="text-slate-300">
                  Produto Disponível no Cardápio Online
                </label>
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setEditingItem(null);
                    setIsCreating(false);
                  }}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
