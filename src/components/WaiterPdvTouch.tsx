import React, { useState, useMemo } from 'react';
import { useStore } from '../context/StoreContext';
import {
  MenuItem,
  ProductionStation,
  Order,
  RestaurantSlug,
} from '../types/restaurant';
import {
  Users,
  Utensils,
  Plus,
  Minus,
  Check,
  Send,
  ArrowLeft,
  Search,
  Sparkles,
  Beer,
  Fish,
  Flame,
  Clock,
  CheckCircle2,
  Receipt,
  X,
  UserCheck,
  Layers,
} from 'lucide-react';
import { playAlertSound } from '../utils/audioAlert';

interface WaiterPdvTouchProps {
  onBackToApp?: () => void;
  onOpenAdmin?: () => void;
}

interface DraftItem {
  id: string;
  menuItem: MenuItem;
  quantity: number;
  unitPrice: number;
  selectedOptions: any[];
  notes: string;
  station: ProductionStation;
}

export const WaiterPdvTouch: React.FC<WaiterPdvTouchProps> = ({
  onBackToApp,
  onOpenAdmin,
}) => {
  const {
    orders,
    menuItems,
    categories,
    appendItemsToTableOrder,
    activeRestaurantSlug,
    restaurants,
    showToast,
  } = useStore();

  const [selectedTable, setSelectedTable] = useState<number | null>(null);
  const [waiterName, setWaiterName] = useState('Garçom Salão');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Draft cart for currently selected table
  const [draftItems, setDraftItems] = useState<DraftItem[]>([]);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [editQty, setEditQty] = useState(1);
  const [editNotes, setEditNotes] = useState('');
  const [editSelectedOptions, setEditSelectedOptions] = useState<any[]>([]);

  // Tables range: 1 to 24
  const tableNumbers = useMemo(() => Array.from({ length: 24 }, (_, i) => i + 1), []);

  // Map active orders by table
  const activeOrdersByTable = useMemo(() => {
    const map: Record<number, Order> = {};
    orders.forEach((ord) => {
      if (
        ord.orderType === 'mesa' &&
        ord.tableNumber &&
        ord.status !== 'entregue' &&
        ord.status !== 'cancelado'
      ) {
        // Keep the latest or active order for this table
        if (!map[ord.tableNumber] || new Date(ord.createdAt) > new Date(map[ord.tableNumber].createdAt)) {
          map[ord.tableNumber] = ord;
        }
      }
    });
    return map;
  }, [orders]);

  // Determine Table status color
  const getTableStatus = (tableNum: number) => {
    const order = activeOrdersByTable[tableNum];
    if (!order) return { label: 'Livre', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40', dot: 'bg-emerald-400' };
    if (order.status === 'pronto') return { label: 'Pronto / Servir', color: 'bg-green-500 text-slate-950 font-black border-green-400', dot: 'bg-white' };
    if (order.status === 'em_preparo') return { label: 'Em Preparo', color: 'bg-amber-500/20 text-amber-300 border-amber-500/40', dot: 'bg-amber-400 animate-pulse' };
    if (order.status === 'recebido') return { label: 'Aguardando', color: 'bg-sky-500/20 text-sky-300 border-sky-500/40', dot: 'bg-sky-400' };
    return { label: 'Ocupada', color: 'bg-purple-500/20 text-purple-300 border-purple-500/40', dot: 'bg-purple-400' };
  };

  // Helper to determine destination station
  const determineStation = (item: MenuItem): ProductionStation => {
    const lower = (item.name || '').toLowerCase();
    const catLower = (item.categoryId || '').toLowerCase();

    const isBar =
      lower.includes('coca') ||
      lower.includes('suco') ||
      lower.includes('refrigerante') ||
      lower.includes('cerveja') ||
      lower.includes('chopp') ||
      lower.includes('drink') ||
      lower.includes('coquetel') ||
      lower.includes('gin') ||
      lower.includes('vodka') ||
      lower.includes('whisky') ||
      lower.includes('vinho') ||
      lower.includes('espumante') ||
      lower.includes('caipirinha') ||
      lower.includes('mocktail') ||
      lower.includes('água') ||
      lower.includes('agua') ||
      lower.includes('guaraná') ||
      lower.includes('guarana') ||
      lower.includes('red bull') ||
      lower.includes('energético') ||
      lower.includes('chá') ||
      lower.includes('cha') ||
      lower.includes('café') ||
      lower.includes('cafe') ||
      lower.includes('espresso') ||
      lower.includes('sake') ||
      lower.includes('saquê') ||
      lower.includes('heineken') ||
      lower.includes('stella') ||
      lower.includes('corona') ||
      lower.includes('smirnoff') ||
      lower.includes('campari') ||
      lower.includes('aperol') ||
      lower.includes('soda') ||
      lower.includes('tonica') ||
      lower.includes('tônica') ||
      lower.includes('licor') ||
      lower.includes('shot') ||
      catLower.includes('bebida') ||
      catLower.includes('drink') ||
      catLower.includes('bar');

    if (isBar) return 'bar';

    const isSushi =
      lower.includes('sushi') ||
      lower.includes('sashimi') ||
      lower.includes('temaki') ||
      lower.includes('uramaki') ||
      lower.includes('hossomaki') ||
      lower.includes('niguiri') ||
      lower.includes('gunkan') ||
      lower.includes('dyo') ||
      lower.includes('combinado') ||
      lower.includes('tartare') ||
      lower.includes('tartar') ||
      lower.includes('carpaccio') ||
      lower.includes('ceviche') ||
      lower.includes('hot roll') ||
      lower.includes('harumaki') ||
      lower.includes('poke') ||
      lower.includes('shimeji') ||
      lower.includes('sunomono') ||
      lower.includes('edamame') ||
      lower.includes('tataki') ||
      catLower.includes('sushi') ||
      catLower.includes('japones') ||
      catLower.includes('japonês') ||
      catLower.includes('sushibar');

    if (isSushi) return 'sushibar';

    return 'cozinha';
  };

  // Filter menu items
  const filteredMenuItems = useMemo(() => {
    return menuItems.filter((item) => {
      if (item.available === false) return false;
      if (selectedCategory !== 'all' && item.categoryId !== selectedCategory) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return item.name.toLowerCase().includes(q) || item.description.toLowerCase().includes(q);
      }
      return true;
    });
  }, [menuItems, selectedCategory, searchQuery]);

  // Open item customization dialog
  const handleOpenItem = (item: MenuItem) => {
    setEditingItem(item);
    setEditQty(1);
    setEditNotes('');
    setEditSelectedOptions([]);
  };

  // Confirm item to draft cart
  const handleConfirmItem = () => {
    if (!editingItem) return;
    const station = determineStation(editingItem);
    const newItem: DraftItem = {
      id: `draft-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      menuItem: editingItem,
      quantity: editQty,
      unitPrice: editingItem.price,
      selectedOptions: editSelectedOptions,
      notes: editNotes.trim(),
      station,
    };

    setDraftItems((prev) => [...prev, newItem]);
    setEditingItem(null);
    playAlertSound('sound1', 0.4);
    showToast(`+${editQty}x ${editingItem.name} na comanda da mesa`, 'info');
  };

  // Send table draft to production
  const handleSendOrder = async () => {
    if (!selectedTable) return;
    if (draftItems.length === 0) {
      showToast('Selecione ao menos 1 item para enviar às praças', 'error');
      return;
    }

    const payloadItems = draftItems.map((d) => ({
      name: d.menuItem.name,
      quantity: d.quantity,
      unitPrice: d.unitPrice,
      selectedOptions: d.selectedOptions,
      notes: d.notes,
      station: d.station,
    }));

    const result = await appendItemsToTableOrder({
      tableNumber: selectedTable,
      restaurantSlug: activeRestaurantSlug,
      items: payloadItems,
      waiterName,
      customerName: `Mesa ${selectedTable} (${waiterName})`,
    });

    if (result.success) {
      playAlertSound('sound3', 0.7);
      setDraftItems([]);
    }
  };

  const draftTotal = useMemo(() => {
    return draftItems.reduce((acc, item) => acc + item.unitPrice * item.quantity, 0);
  }, [draftItems]);

  const activeTableOrder = selectedTable ? activeOrdersByTable[selectedTable] : null;

  return (
    <div className="min-h-screen bg-[#0A0D14] text-slate-100 flex flex-col font-sans select-none">
      {/* Top Touch Bar */}
      <header className="bg-[#121622] border-b border-slate-800 p-3 sm:px-6 flex items-center justify-between shadow-xl">
        <div className="flex items-center gap-3">
          {onBackToApp && (
            <button
              onClick={onBackToApp}
              className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-all"
              title="Voltar ao início"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}

          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center font-black text-slate-950 shadow-lg">
              <Utensils className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-black text-white uppercase tracking-wider flex items-center gap-2">
                PDV TOUCH • SALÃO &amp; GARÇOM
              </h1>
              <span className="text-xs text-slate-400">
                Divisão automática de Praças (Cozinha, Sushibar, Bar)
              </span>
            </div>
          </div>
        </div>

        {/* Waiter Profile & Admin Switch */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-[#1A1F2C] px-3 py-1.5 rounded-xl border border-slate-700">
            <UserCheck className="w-4 h-4 text-amber-400" />
            <input
              type="text"
              value={waiterName}
              onChange={(e) => setWaiterName(e.target.value)}
              className="bg-transparent text-xs font-bold text-white focus:outline-none w-28 sm:w-36"
              placeholder="Nome do Garçom"
            />
          </div>

          {onOpenAdmin && (
            <button
              onClick={onOpenAdmin}
              className="text-xs font-bold px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-all"
            >
              Painel Admin
            </button>
          )}
        </div>
      </header>

      {/* Main Split Layout */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left / Center Area */}
        <div className="flex-1 flex flex-col overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* Tables Selector Bar */}
          <div className="bg-[#121622] border border-slate-800 rounded-2xl p-4 shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-black uppercase tracking-wider text-slate-300">
                  Mapa de Mesas do Salão ({tableNumbers.length} Mesas)
                </span>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-slate-400">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block" /> Livre
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" /> Em Preparo
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-400 inline-block" /> Ocupada
                </span>
              </div>
            </div>

            {/* Tables Grid */}
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-12 gap-2.5">
              {tableNumbers.map((num) => {
                const status = getTableStatus(num);
                const isSelected = selectedTable === num;
                return (
                  <button
                    key={num}
                    onClick={() => setSelectedTable(num)}
                    className={`p-2.5 rounded-xl border flex flex-col items-center justify-center transition-all active:scale-95 ${
                      isSelected
                        ? 'bg-amber-500 text-slate-950 font-black border-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.5)] scale-105'
                        : `${status.color} hover:border-slate-600`
                    }`}
                  >
                    <span className="text-sm font-black font-mono">MESA {num}</span>
                    <span className="text-[9px] font-bold mt-0.5 truncate max-w-full">
                      {status.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* If table is selected, show Product Selector & Categories */}
          {selectedTable ? (
            <div className="space-y-4">
              {/* Category Filter Pills (GRANDES PARA TOUCH) */}
              <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
                <button
                  onClick={() => setSelectedCategory('all')}
                  className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider whitespace-nowrap transition-all border ${
                    selectedCategory === 'all'
                      ? 'bg-amber-500 text-slate-950 border-amber-300 shadow-md'
                      : 'bg-[#181D2C] text-slate-400 border-slate-800 hover:text-white'
                  }`}
                >
                  Todos os Produtos
                </button>

                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider whitespace-nowrap transition-all border ${
                      selectedCategory === cat.id
                        ? 'bg-amber-500 text-slate-950 border-amber-300 shadow-md'
                        : 'bg-[#181D2C] text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar produto por nome ou código..."
                  className="w-full pl-11 pr-4 py-3 bg-[#121622] border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Products Touch Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                {filteredMenuItems.map((item) => {
                  const station = determineStation(item);
                  const stationBadge = {
                    bar: { label: 'BAR', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
                    cozinha: { label: 'COZINHA', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
                    sushibar: { label: 'SUSHIBAR', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
                  }[station];

                  return (
                    <button
                      key={item.id}
                      onClick={() => handleOpenItem(item)}
                      className="bg-[#141926] border border-slate-800 hover:border-amber-500/50 rounded-2xl p-3.5 flex flex-col justify-between text-left transition-all active:scale-95 shadow-lg group hover:bg-[#181E2E]"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <span
                            className={`text-[9px] font-black px-1.5 py-0.5 rounded border uppercase ${stationBadge.color}`}
                          >
                            {stationBadge.label}
                          </span>
                        </div>
                        <h4 className="text-sm font-black text-white group-hover:text-amber-400 transition-colors line-clamp-2">
                          {item.name}
                        </h4>
                        <p className="text-[11px] text-slate-400 line-clamp-2 mt-1">
                          {item.description}
                        </p>
                      </div>

                      <div className="mt-3 pt-2 border-t border-slate-800/60 flex items-center justify-between">
                        <span className="text-sm font-black text-amber-400 font-mono">
                          R$ {item.price.toFixed(2)}
                        </span>
                        <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-black group-hover:bg-amber-500 group-hover:text-slate-950 transition-all">
                          <Plus className="w-4 h-4" />
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center bg-[#121622]/40 border border-slate-800/60 rounded-3xl p-12 text-center text-slate-400">
              <Users className="w-12 h-12 text-amber-400 mb-3 opacity-80" />
              <h3 className="text-base font-black text-white uppercase tracking-wider">
                Selecione uma Mesa Acima
              </h3>
              <p className="text-xs max-w-sm mt-1">
                Toque no número da mesa para ver a comanda atual e lançar novos pedidos diretamente
                para o Bar, Cozinha e Sushibar.
              </p>
            </div>
          )}
        </div>

        {/* Right Sidebar: Mesa Selecionada & Carrinho do Garçom */}
        {selectedTable && (
          <aside className="w-full lg:w-96 bg-[#10141E] border-t lg:border-t-0 lg:border-l border-slate-800 flex flex-col shadow-2xl">
            {/* Header da Mesa */}
            <div className="p-4 border-b border-slate-800 bg-[#161C2B] flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-black text-white font-mono">
                    MESA #{selectedTable}
                  </span>
                  <span className="text-[10px] bg-amber-500/20 text-amber-300 font-black px-2 py-0.5 rounded-full border border-amber-500/30">
                    COMANDA ATIVA
                  </span>
                </div>
                <span className="text-xs text-slate-400">Atendido por: {waiterName}</span>
              </div>
              <button
                onClick={() => setSelectedTable(null)}
                className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800/60"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Se houver comanda aberta já na mesa (Itens já enviados) */}
            {activeTableOrder && (
              <div className="p-3 bg-[#131824] border-b border-slate-800 max-h-48 overflow-y-auto">
                <div className="flex items-center justify-between text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2">
                  <span>Itens Já em Produção ({activeTableOrder.items.length})</span>
                  <span className="text-amber-400">#{activeTableOrder.shortCode}</span>
                </div>
                <div className="space-y-1.5">
                  {activeTableOrder.items.map((it, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs py-1 border-b border-slate-800/40 last:border-0">
                      <span className="text-slate-300 truncate max-w-[200px]">
                        {it.quantity}x {it.name}
                      </span>
                      <span className="text-slate-400 font-mono">
                        R$ {(it.quantity * it.unitPrice).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-2 pt-2 border-t border-slate-800 flex items-center justify-between text-xs font-bold text-slate-300">
                  <span>Subtotal Anterior:</span>
                  <span className="text-amber-400 font-mono">R$ {activeTableOrder.total.toFixed(2)}</span>
                </div>
              </div>
            )}

            {/* Novos Itens a Enviar (Rascunho Atual) */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3">
              <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider text-amber-400">
                <div className="flex items-center gap-1.5">
                  <Layers className="w-4 h-4" />
                  <span>Novos Itens Desta Rodada ({draftItems.length})</span>
                </div>
                {draftItems.length > 0 && (
                  <button
                    onClick={() => setDraftItems([])}
                    className="text-[10px] text-red-400 hover:underline"
                  >
                    Limpar
                  </button>
                )}
              </div>

              {draftItems.length === 0 ? (
                <div className="p-8 text-center text-slate-500 border border-dashed border-slate-800 rounded-2xl">
                  <p className="text-xs">Nenhum item adicionado nesta rodada.</p>
                  <p className="text-[11px] mt-1 text-slate-600">
                    Toque nos produtos para montar a rodada do pedido.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {draftItems.map((item, idx) => (
                    <div
                      key={item.id}
                      className="bg-[#151B28] border border-slate-800 p-2.5 rounded-xl flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <span className="text-xs font-bold text-white block truncate">
                          {item.quantity}x {item.menuItem.name}
                        </span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                            Praça: {item.station.toUpperCase()}
                          </span>
                          {item.notes && (
                            <span className="text-[10px] text-amber-300 truncate max-w-[120px]">
                              Obs: {item.notes}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-mono font-bold text-amber-400">
                          R$ {(item.quantity * item.unitPrice).toFixed(2)}
                        </span>
                        <button
                          onClick={() => setDraftItems((prev) => prev.filter((_, i) => i !== idx))}
                          className="p-1 text-slate-500 hover:text-red-400"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Bottom Actions Bar */}
            <div className="p-4 bg-[#141824] border-t border-slate-800 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Total Desta Rodada:</span>
                <span className="text-lg font-black text-amber-400 font-mono">
                  R$ {draftTotal.toFixed(2)}
                </span>
              </div>

              <button
                onClick={handleSendOrder}
                disabled={draftItems.length === 0}
                className="w-full py-4 bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-black text-sm uppercase tracking-wider rounded-2xl shadow-xl flex items-center justify-center gap-2 transition-all active:scale-95"
              >
                <Send className="w-4 h-4" />
                <span>ENVIAR PARA AS PRAÇAS</span>
              </button>
            </div>
          </aside>
        )}
      </div>

      {/* Modal Rápido de Customização do Item (Touch) */}
      {editingItem && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#141926] border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-fadeIn">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  Praça: {determineStation(editingItem).toUpperCase()}
                </span>
                <h3 className="text-lg font-black text-white mt-1">{editingItem.name}</h3>
                <p className="text-xs text-slate-400 mt-0.5">{editingItem.description}</p>
              </div>
              <button
                onClick={() => setEditingItem(null)}
                className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800/60"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quantidade (+ / -) */}
            <div className="bg-[#1A2030] p-4 rounded-2xl border border-slate-800 flex items-center justify-between">
              <span className="text-sm font-bold text-slate-300">Quantidade:</span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setEditQty((q) => Math.max(1, q - 1))}
                  className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center font-black active:scale-95"
                >
                  <Minus className="w-5 h-5" />
                </button>
                <span className="text-lg font-mono font-black text-white w-6 text-center">
                  {editQty}
                </span>
                <button
                  onClick={() => setEditQty((q) => q + 1)}
                  className="w-10 h-10 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center justify-center font-black active:scale-95"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Observações do Garçom / Cliente */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 block">
                Observação para a Praça de Produção:
              </label>
              <textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Ex: Sem cebola, gelo e limão, bem passado..."
                className="w-full p-3 bg-[#1A2030] border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 h-20"
              />
            </div>

            {/* Quick buttons */}
            <div className="flex gap-2">
              {['Sem Gelo', 'Com Limão', 'Bem Passado', 'Ao Ponto'].map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setEditNotes((prev) => (prev ? `${prev}, ${tag}` : tag))}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 border border-slate-700 font-medium"
                >
                  + {tag}
                </button>
              ))}
            </div>

            {/* Confirmação */}
            <button
              onClick={handleConfirmItem}
              className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-black text-sm rounded-2xl shadow-xl flex items-center justify-center gap-2 active:scale-95"
            >
              <Check className="w-5 h-5" />
              <span>Adicionar (R$ {(editingItem.price * editQty).toFixed(2)})</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
