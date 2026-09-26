import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useStore } from '../context/StoreContext';
import {
  MenuItem,
  ProductionStation,
  Order,
  RestaurantSlug,
  PaymentMethod,
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
  CreditCard,
  QrCode,
  DollarSign,
  Printer,
  Percent,
  ChevronRight,
  Trash2,
  Edit3,
  Coffee,
  AlertTriangle,
  RefreshCw,
  SlidersHorizontal,
  BookmarkCheck,
  RotateCcw,
  Ban,
  Tag,
  ChevronDown,
} from 'lucide-react';
import { playAlertSound } from '../utils/audioAlert';
import { ThermalTicketModal } from './ThermalTicketModal';
import { EnvironmentBar, OperationalEnvironment } from './EnvironmentBar';
import { OfflineStatusIndicator } from './OfflineStatusIndicator';

interface WaiterPdvTouchProps {
  onBackToApp?: () => void;
  onOpenAdmin?: () => void;
  onNavigateToEnvironment?: (env: OperationalEnvironment) => void;
}

export type WaiterScreen = 'mesas' | 'cardapio' | 'pedido' | 'fechamento';

export interface DraftItem {
  id: string;
  menuItem: MenuItem;
  quantity: number;
  unitPrice: number;
  selectedOptions: any[];
  removedIngredients: string[];
  notes: string;
  station: ProductionStation;
}

export const WaiterPdvTouch: React.FC<WaiterPdvTouchProps> = ({
  onBackToApp,
  onOpenAdmin,
  onNavigateToEnvironment,
}) => {
  const {
    orders,
    menuItems,
    categories,
    appendItemsToTableOrder,
    updateOrderItem,
    closeTableOrder,
    activeRestaurantSlug,
    setActiveRestaurantSlug,
    restaurants,
    currentUser,
    showToast,
    updateRestaurantConfig,
  } = useStore();

  // ---------------------------------------------------------------------
  // PERSISTÊNCIA DE CONTEXTO ENTRE REFRESH (F5)
  // Antes, tela atual, mesa selecionada e itens ainda não enviados eram
  // perdidos a cada atualização da página porque viviam só em useState.
  // Agora ficam também em sessionStorage (por aba), restritos ao
  // restaurante ativo no momento em que foram salvos. Isso não altera a
  // navegação por URL (mantida como estado interno, conforme já decidido
  // no sistema) — apenas evita perder o contexto operacional no F5.
  // ---------------------------------------------------------------------
  const PDV_TOUCH_SESSION_KEY = 'nx_waiter_pdv_touch_session_v1';

  type PersistedTouchState = {
    slug: string;
    screen: WaiterScreen;
    table: number | null;
    draftItems: DraftItem[];
  };

  const readPersistedTouchState = (): PersistedTouchState | null => {
    try {
      const raw = sessionStorage.getItem(PDV_TOUCH_SESSION_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      return parsed as PersistedTouchState;
    } catch {
      return null;
    }
  };

  const persistedOnLoadRaw = readPersistedTouchState();
  // Só reaproveita o estado salvo se for do MESMO restaurante ativo agora.
  const persistedOnLoad = useRef<PersistedTouchState | null>(
    persistedOnLoadRaw && persistedOnLoadRaw.slug === activeRestaurantSlug ? persistedOnLoadRaw : null
  );

  // Current Screen in the Touch Waiter Flow
  const [currentScreen, setCurrentScreen] = useState<WaiterScreen>(
    () => persistedOnLoad.current?.screen || 'mesas'
  );

  // Selected Table & Operator
  const [selectedTable, setSelectedTable] = useState<number | null>(
    () => (persistedOnLoad.current ? persistedOnLoad.current.table : null)
  );
  const [waiterName, setWaiterName] = useState('Garçom Salão');

  // Screen 1: Mesas Filters & Modal
  const [tableFilter, setTableFilter] = useState<'todos' | 'livre' | 'atendimento' | 'pronto' | 'fechamento'>('todos');
  const [tableModalOption, setTableModalOption] = useState<number | null>(null);
  const [showSwitchTableModal, setShowSwitchTableModal] = useState(false);
  const [showTableManagerModal, setShowTableManagerModal] = useState(false);
  const [showToolsMenu, setShowToolsMenu] = useState(false);
  const [tableDraft, setTableDraft] = useState<number[]>([]);
  const [newTableNumber, setNewTableNumber] = useState('');
  const [editingTableNumber, setEditingTableNumber] = useState<number | null>(null);
  const [editingTableValue, setEditingTableValue] = useState('');

  // Screen 2: Cardápio PDV Filters & Search
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Mobile drawer state for fixed cart
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);

  // Item Customizer Panel (Touch Modal / Bottom Drawer)
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [editDraftId, setEditDraftId] = useState<string | null>(null);
  const [editingExistingItemId, setEditingExistingItemId] = useState<string | null>(null);
  const [editQty, setEditQty] = useState(1);
  const [editNotes, setEditNotes] = useState('');
  const [editSelectedOptions, setEditSelectedOptions] = useState<any[]>([]);
  const [editRemovedIngredients, setEditRemovedIngredients] = useState<string[]>([]);

  // Screen 3: Draft Items for Current Round
  const [draftItems, setDraftItems] = useState<DraftItem[]>(
    () => persistedOnLoad.current?.draftItems || []
  );
  const [isSendingOrder, setIsSendingOrder] = useState(false);

  // Screen 4: Fechamento Settings
  const [paymentMethod, setPaymentMethod] = useState<string>('pix');
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [serviceFeeEnabled, setServiceFeeEnabled] = useState<boolean>(true);
  const [splitCount, setSplitCount] = useState<number>(1);
  const [cashGiven, setCashGiven] = useState<string>('');
  const [waiterNotes, setWaiterNotes] = useState<string>('');
  const [isClosingTable, setIsClosingTable] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [isFinalizeExpanded, setIsFinalizeExpanded] = useState(false);

  const restaurant = restaurants[activeRestaurantSlug] || Object.values(restaurants)[0];

  // Fonte única: mesas cadastradas/configuradas no restaurante. Nunca limitar por quantidade fixa.
  const tableNumbers = useMemo(() => {
    const configured = Array.isArray(restaurant?.activeTables)
      ? restaurant.activeTables
      : Array.from({ length: 30 }, (_, i) => i + 1);
    const activeFromOrders = orders
      .filter((o) => o.restaurantSlug === activeRestaurantSlug && o.orderType === 'mesa' && Number.isInteger(o.tableNumber))
      .map((o) => Number(o.tableNumber));
    return Array.from(new Set([...configured, ...activeFromOrders]))
      .filter((n) => Number.isInteger(n) && n > 0 && n <= 999)
      .sort((a, b) => a - b);
  }, [restaurant?.activeTables, orders, activeRestaurantSlug]);

  const getTableVisual = (statusKey: string) => {
    if (statusKey === 'livre') return '/table-chairs-open.svg';
    if (statusKey === 'ocupada' || statusKey === 'atendimento' || statusKey === 'aguardando' || statusKey === 'pronto') return '/table-chairs-use.svg';
    return '/table-chairs-closed.svg';
  };

  const openTableManager = () => {
    const configured = Array.isArray(restaurant?.activeTables) ? restaurant.activeTables : Array.from({ length: 30 }, (_, i) => i + 1);
    setTableDraft(Array.from(new Set(configured.filter((n) => Number.isInteger(n) && n > 0 && n <= 999))).sort((a, b) => a - b));
    setNewTableNumber('');
    setEditingTableNumber(null);
    setEditingTableValue('');
    setShowTableManagerModal(true);
  };

  const saveTableManager = () => {
    if (!restaurant?.slug) return;
    const next = Array.from(new Set(tableDraft.filter((n) => Number.isInteger(n) && n > 0 && n <= 999))).sort((a, b) => a - b);
    const activeIds = new Set(orders.filter((o) => o.restaurantSlug === activeRestaurantSlug && o.orderType === 'mesa' && Number.isInteger(o.tableNumber) && o.status !== 'entregue' && o.status !== 'finalizado' && o.status !== 'cancelado').map((o) => Number(o.tableNumber)));
    const blocked = [...activeIds].filter((id) => !next.includes(id));
    if (blocked.length) {
      showToast(`Não é possível excluir Mesa ${blocked.join(', ')} enquanto houver comanda ativa.`, 'warning', 5000);
      return;
    }
    updateRestaurantConfig(restaurant.slug, { activeTables: next });
    setShowTableManagerModal(false);
    showToast(`${next.length} mesa(s) cadastrada(s)/atualizada(s).`, 'success');
  };

  const addTableToDraft = () => {
    const value = Number(newTableNumber);
    if (!Number.isInteger(value) || value < 1 || value > 999) {
      showToast('Informe um número de mesa entre 1 e 999.', 'warning');
      return;
    }
    if (tableDraft.includes(value)) {
      showToast(`Mesa ${value} já está cadastrada.`, 'info');
      return;
    }
    setTableDraft((prev) => [...prev, value].sort((a, b) => a - b));
    setNewTableNumber('');
  };

  const startEditTable = (table: number) => {
    setEditingTableNumber(table);
    setEditingTableValue(String(table));
  };

  const applyEditTable = () => {
    if (editingTableNumber === null) return;
    const value = Number(editingTableValue);
    if (!Number.isInteger(value) || value < 1 || value > 999 || (tableDraft.includes(value) && value !== editingTableNumber)) {
      showToast('Número inválido ou já utilizado.', 'warning');
      return;
    }
    setTableDraft((prev) => prev.map((n) => (n === editingTableNumber ? value : n)).sort((a, b) => a - b));
    if (selectedTable === editingTableNumber) setSelectedTable(value);
    setEditingTableNumber(null);
    setEditingTableValue('');
  };

  const removeTableFromDraft = (table: number) => {
    const active = activeOrdersByTable[table];
    if (active) {
      showToast(`Mesa ${table} possui comanda ativa e não pode ser excluída.`, 'warning', 5000);
      return;
    }
    setTableDraft((prev) => prev.filter((n) => n !== table));
    if (selectedTable === table) setSelectedTable(null);
  };
  const restaurantMenuItems = useMemo(
    () => menuItems.filter((item) => item.restaurantSlug === restaurant?.slug),
    [menuItems, restaurant?.slug]
  );
  const restaurantCategories = useMemo(
    () => categories.filter((cat) => cat.restaurantSlug === restaurant?.slug),
    [categories, restaurant?.slug]
  );
  const canSwitchRestaurant = Boolean(currentUser?.restaurantSlug === 'all' && currentUser?.permissions?.can_view_menu);

  useEffect(() => {
    if (currentUser?.restaurantSlug && currentUser.restaurantSlug !== 'all' && currentUser.restaurantSlug !== activeRestaurantSlug) {
      setActiveRestaurantSlug(currentUser.restaurantSlug as RestaurantSlug);
      setCurrentScreen('mesas');
      setSelectedTable(null);
      setDraftItems([]);
    }
  }, [currentUser?.restaurantSlug, activeRestaurantSlug, setActiveRestaurantSlug]);

  // Limpa filtros/mesa/rascunho ao TROCAR de restaurante — mas não no
  // carregamento inicial da página (refresh), para não descartar o contexto
  // que acabou de ser restaurado do sessionStorage acima.
  const isFirstRestaurantEffect = useRef(true);
  useEffect(() => {
    if (isFirstRestaurantEffect.current) {
      isFirstRestaurantEffect.current = false;
      return;
    }
    setSelectedCategory('all');
    setSearchQuery('');
    setSelectedTable(null);
    setDraftItems([]);
    setCurrentScreen('mesas');
  }, [activeRestaurantSlug]);

  // Salva o contexto (tela, mesa, rascunho) a cada mudança, para sobreviver a um F5.
  useEffect(() => {
    try {
      const toSave: PersistedTouchState = {
        slug: activeRestaurantSlug,
        screen: currentScreen,
        table: selectedTable,
        draftItems,
      };
      sessionStorage.setItem(PDV_TOUCH_SESSION_KEY, JSON.stringify(toSave));
    } catch {
      // sessionStorage indisponível (modo privado/quota) — falha silenciosa,
      // sem impacto na operação, só perde a restauração após F5.
    }
  }, [activeRestaurantSlug, currentScreen, selectedTable, draftItems]);

  // Ao fechar a mesa (pagamento concluído) ou voltar manualmente para a tela
  // de mesas, não faz sentido restaurar aquela mesa/rascunho num F5 futuro.
  useEffect(() => {
    if (currentScreen === 'mesas' && selectedTable === null && draftItems.length === 0) {
      try {
        sessionStorage.removeItem(PDV_TOUCH_SESSION_KEY);
      } catch {
        // ignorar
      }
    }
  }, [currentScreen, selectedTable, draftItems.length]);

  // Map active orders by table
  const activeOrdersByTable = useMemo(() => {
    const map: Record<number, Order> = {};
    orders.forEach((ord) => {
      if (ord.restaurantSlug !== activeRestaurantSlug) return;
      if (
        ord.orderType === 'mesa' &&
        ord.tableNumber &&
        ord.status !== 'entregue' &&
        ord.status !== 'finalizado' &&
        ord.status !== 'cancelado'
      ) {
        if (!map[ord.tableNumber] || new Date(ord.createdAt) > new Date(map[ord.tableNumber].createdAt)) {
          map[ord.tableNumber] = ord;
        }
      }
    });
    return map;
  }, [orders, activeRestaurantSlug]);

  // Current active order for selected table
  const currentTableOrder = selectedTable ? activeOrdersByTable[selectedTable] : null;

  // Determine Table status label and visual theme
  const getTableStatus = (tableNum: number) => {
    const order = activeOrdersByTable[tableNum];
    if (!order) {
      return {
        key: 'livre' as const,
        label: 'Livre',
        badgeColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
        cardBg: 'bg-[#101522] border-slate-800/80 hover:border-emerald-500/50',
        dot: 'bg-emerald-400',
        hasOrder: false,
      };
    }
    if (order.status === 'pronto') {
      return {
        key: 'pronto' as const,
        label: 'Pronto / Servir',
        badgeColor: 'bg-white text-slate-950 font-black border-white shadow-md',
        cardBg: 'bg-white/[.06] border-white/40 hover:border-white animate-pulse',
        dot: 'bg-amber-400 animate-ping',
        hasOrder: true,
      };
    }
    if (order.status === 'recebido') {
      return {
        key: 'aguardando' as const,
        label: 'Aguardando',
        badgeColor: 'bg-white text-slate-950 font-black border-white',
        cardBg: 'bg-white/[.05] border-white/30 hover:border-white',
        dot: 'bg-sky-400',
        hasOrder: true,
      };
    }
    if (order.status === 'em_preparo' || order.status === 'em_producao') {
      return {
        key: 'atendimento' as const,
        label: 'Em Atendimento',
        badgeColor: 'bg-white text-slate-950 font-black border-white',
        cardBg: 'bg-white/[.05] border-white/30 hover:border-white',
        dot: 'bg-white',
        hasOrder: true,
      };
    }
    return {
      key: 'fechamento' as const,
      label: 'Fechamento',
      badgeColor: 'bg-red-500 text-white font-black border-red-400',
      cardBg: 'bg-red-500/[.08] border-red-500/50 hover:border-red-400',
      dot: 'bg-red-500',
      hasOrder: true,
    };
  };

  // Helper to determine production station (Cozinha, Sushibar, Bar)
  const determineStation = (item: MenuItem): ProductionStation => {
    if (item.station) return item.station;
    const nameLower = (item.name || '').toLowerCase();
    const descLower = (item.description || '').toLowerCase();
    const catLower = (item.categoryId || '').toLowerCase();

    // Bar: Chopp, cervejas, drinks, refrigerantes, águas, caipirinhas, sucos, vinhos
    if (
      nameLower.includes('chopp') ||
      nameLower.includes('cerveja') ||
      nameLower.includes('suco') ||
      nameLower.includes('refrigerante') ||
      nameLower.includes('coca') ||
      nameLower.includes('água') ||
      nameLower.includes('agua') ||
      nameLower.includes('gin') ||
      nameLower.includes('drink') ||
      nameLower.includes('vinho') ||
      nameLower.includes('caipirinha') ||
      nameLower.includes('vodka') ||
      catLower.includes('bebida') ||
      catLower.includes('cerveja') ||
      catLower.includes('vinhos')
    ) {
      return 'bar';
    }

    // SushiBar: Peixes crus, sushis, sashimis, temakis, combinados, hossomakis, uramakis
    if (
      nameLower.includes('sushi') ||
      nameLower.includes('sashimi') ||
      nameLower.includes('temaki') ||
      nameLower.includes('niguiri') ||
      nameLower.includes('uramaki') ||
      nameLower.includes('hossomaki') ||
      nameLower.includes('combinado') ||
      catLower.includes('jap') ||
      catLower.includes('sushi')
    ) {
      return 'sushibar';
    }

    // Default: Cozinha (grelhados, burgers, pizzas, risotos, quentes, massas)
    return 'cozinha';
  };

  // Quick categories and popular items filter
  const filteredMenuItems = useMemo(() => {
    return restaurantMenuItems.filter((item) => {
      // Must be available
      if (!item.available) return false;

      // Category filter
      if (selectedCategory === 'mais_vendidos') {
        const isBestseller = item.tags && item.tags.includes('mais_vendido');
        if (!isBestseller) return false;
      } else if (selectedCategory === 'destaque') {
        const isFeatured = item.tags && item.tags.includes('destaque');
        if (!isFeatured) return false;
      } else if (selectedCategory === 'promocao') {
        const isPromo = (item.tags && item.tags.includes('promocao')) || item.promoPrice;
        if (!isPromo) return false;
      } else if (selectedCategory === 'vegetariano') {
        const isVeg = item.tags && item.tags.includes('vegetariano');
        if (!isVeg) return false;
      } else if (selectedCategory !== 'all') {
        if (item.categoryId !== selectedCategory) return false;
      }

      // Search Query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = item.name.toLowerCase().includes(q);
        const matchesDesc = item.description.toLowerCase().includes(q);
        return matchesName || matchesDesc;
      }

      return true;
    });
  }, [restaurantMenuItems, selectedCategory, searchQuery]);

  // Counts of draft items and totals
  const draftItemsCount = useMemo(
    () => draftItems.reduce((sum, d) => sum + d.quantity, 0),
    [draftItems]
  );

  const draftTotal = useMemo(
    () => draftItems.reduce((sum, d) => sum + d.unitPrice * d.quantity, 0),
    [draftItems]
  );

  // Table items calculation for Fechamento and Resumo
  const tableItems = useMemo(() => {
    const activeItems = currentTableOrder ? currentTableOrder.items : [];
    return [...activeItems];
  }, [currentTableOrder]);

  const tableSubtotal = useMemo(() => {
    return tableItems.reduce((sum, it) => sum + it.unitPrice * it.quantity, 0);
  }, [tableItems]);

  const serviceFeeAmount = useMemo(() => {
    if (!serviceFeeEnabled) return 0;
    return Math.round(tableSubtotal * 0.1 * 100) / 100;
  }, [serviceFeeEnabled, tableSubtotal]);

  const finalBillTotal = useMemo(() => {
    return Math.max(0, tableSubtotal - discountAmount + serviceFeeAmount);
  }, [tableSubtotal, discountAmount, serviceFeeAmount]);

  const splitPerPerson = useMemo(() => {
    return finalBillTotal / Math.max(1, splitCount);
  }, [finalBillTotal, splitCount]);

  const cashChange = useMemo(() => {
    const given = parseFloat(cashGiven.replace(',', '.'));
    if (isNaN(given) || given < finalBillTotal) return 0;
    return given - finalBillTotal;
  }, [cashGiven, finalBillTotal]);

  // Count items already in draft for quick card badge
  const getItemDraftCount = (itemId: string) => {
    return draftItems
      .filter((d) => d.menuItem.id === itemId)
      .reduce((sum, d) => sum + d.quantity, 0);
  };

  // Open Table from Map (Screen 1)
  const handleSelectTable = (tableNum: number) => {
    const status = getTableStatus(tableNum);
    setSelectedTable(tableNum);
    setTableModalOption(tableNum);
    if (status.key === 'livre') {
      playAlertSound('sound1', 0.25);
    }
  };

  // Fast direct add to cart from the product card
  const handleQuickAdd = (e: React.MouseEvent, item: MenuItem) => {
    e.stopPropagation();

    // Check if item has mandatory option groups
    const hasRequiredOptions = item.optionGroups?.some((g) => g.required);
    if (hasRequiredOptions) {
      handleOpenItem(item);
      return;
    }

    const station = determineStation(item);
    const existingIndex = draftItems.findIndex(
      (d) =>
        d.menuItem.id === item.id &&
        d.notes === '' &&
        d.selectedOptions.length === 0 &&
        d.removedIngredients.length === 0
    );

    if (existingIndex >= 0) {
      setDraftItems((prev) =>
        prev.map((d, idx) =>
          idx === existingIndex ? { ...d, quantity: d.quantity + 1 } : d
        )
      );
    } else {
      const newItem: DraftItem = {
        id: `draft-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        menuItem: item,
        quantity: 1,
        unitPrice: item.promoPrice || item.price,
        selectedOptions: [],
        removedIngredients: [],
        notes: '',
        station,
      };
      setDraftItems((prev) => [...prev, newItem]);
    }

    playAlertSound('sound1', 0.35);
    showToast(`+1x ${item.name}`, 'info', 1200);
  };

  // Fast direct decrement from the product card
  const handleQuickDecrement = (e: React.MouseEvent, item: MenuItem) => {
    e.stopPropagation();
    const existingIndex = draftItems.findIndex((d) => d.menuItem.id === item.id);
    if (existingIndex === -1) return;

    setDraftItems((prev) => {
      const target = prev[existingIndex];
      if (target.quantity > 1) {
        return prev.map((d, idx) =>
          idx === existingIndex ? { ...d, quantity: d.quantity - 1 } : d
        );
      } else {
        return prev.filter((_, idx) => idx !== existingIndex);
      }
    });
  };

  // Open item customizer (Touch Modal)
  const handleOpenItem = (item: MenuItem, existingDraftId?: string) => {
    setEditingItem(item);
    if (existingDraftId) {
      const draft = draftItems.find((d) => d.id === existingDraftId);
      if (draft) {
        setEditDraftId(draft.id);
        setEditQty(draft.quantity);
        setEditNotes(draft.notes);
        setEditSelectedOptions(draft.selectedOptions || []);
        setEditRemovedIngredients(draft.removedIngredients || []);
        return;
      }
    }
    setEditDraftId(null);
    setEditQty(1);
    setEditNotes('');
    setEditSelectedOptions([]);
    setEditRemovedIngredients([]);
  };

  // Toggle quick removed ingredient
  const handleToggleRemoveIngredient = (ingredient: string) => {
    setEditRemovedIngredients((prev) =>
      prev.includes(ingredient)
        ? prev.filter((i) => i !== ingredient)
        : [...prev, ingredient]
    );
  };

  // Calculate dynamic unit price with options in customizer
  const currentEditingUnitPrice = useMemo(() => {
    if (!editingItem) return 0;
    const basePrice = editingItem.promoPrice || editingItem.price;
    const optionsPrice = editSelectedOptions.reduce((acc, opt) => acc + (opt.price || 0), 0);
    return basePrice + optionsPrice;
  }, [editingItem, editSelectedOptions]);

  // Confirm item into Draft cart
  const handleConfirmItem = async () => {
    if (!editingItem) return;
    const station = determineStation(editingItem);

    // Se a edição veio de uma comanda já enviada, persistir no pedido real.
    if (editingExistingItemId && currentTableOrder) {
      let finalNoteParts: string[] = [];
      if (editRemovedIngredients.length > 0) finalNoteParts.push(`SEM: ${editRemovedIngredients.join(', ')}`);
      if (editNotes.trim()) finalNoteParts.push(editNotes.trim());
      const result = await updateOrderItem({
        orderId: currentTableOrder.id,
        itemId: editingExistingItemId,
        quantity: editQty,
        selectedOptions: editSelectedOptions,
        notes: finalNoteParts.join(' • '),
      });
      if (result.success) showToast(`${editingItem.name} atualizado na comanda`, 'success');
      setEditingItem(null);
      setEditingExistingItemId(null);
      return;
    }

    // Format full notes including removed ingredients
    let finalNoteParts: string[] = [];
    if (editRemovedIngredients.length > 0) {
      finalNoteParts.push(`SEM: ${editRemovedIngredients.join(', ')}`);
    }
    if (editNotes.trim()) {
      finalNoteParts.push(editNotes.trim());
    }
    const combinedNotes = finalNoteParts.join(' • ');

    if (editDraftId) {
      setDraftItems((prev) =>
        prev.map((d) =>
          d.id === editDraftId
            ? {
                ...d,
                quantity: editQty,
                unitPrice: currentEditingUnitPrice,
                notes: combinedNotes,
                selectedOptions: editSelectedOptions,
                removedIngredients: editRemovedIngredients,
              }
            : d
        )
      );
      showToast(`${editingItem.name} atualizado no pedido`, 'info');
    } else {
      const newItem: DraftItem = {
        id: `draft-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        menuItem: editingItem,
        quantity: editQty,
        unitPrice: currentEditingUnitPrice,
        selectedOptions: editSelectedOptions,
        removedIngredients: editRemovedIngredients,
        notes: combinedNotes,
        station,
      };
      setDraftItems((prev) => [...prev, newItem]);
      playAlertSound('sound1', 0.4);
      showToast(`+${editQty}x ${editingItem.name} adicionado ao pedido`, 'info');
    }

    setEditingItem(null);
    setEditDraftId(null);
    setEditingExistingItemId(null);
  };

  const handleEditSentItem = (item: Order['items'][number]) => {
    const menuItem = restaurantMenuItems.find((m) => m.id === item.id);
    if (!menuItem) {
      showToast('O produto original não está mais disponível no catálogo.', 'error');
      return;
    }
    setEditingExistingItemId(item.id);
    setEditingItem(menuItem);
    setEditDraftId(null);
    setEditQty(item.quantity);
    setEditNotes(item.notes || '');
    setEditSelectedOptions(item.selectedOptions || []);
    setEditRemovedIngredients([]);
  };

  // Remove draft item
  const handleRemoveDraftItem = (draftId: string) => {
    setDraftItems((prev) => prev.filter((d) => d.id !== draftId));
    showToast('Item removido da rodada', 'info');
  };

  // Save draft locally
  const handleSaveDraft = () => {
    if (draftItems.length === 0) {
      showToast('Nenhum item adicionado para salvar', 'info');
      return;
    }
    playAlertSound('sound1', 0.5);
    showToast(`Rascunho da Mesa ${selectedTable} salvo com sucesso!`, 'success');
  };

  // Send Order to Production (Screen 2 / 3)
  const handleSendOrderToProduction = async () => {
    if (!selectedTable) {
      showToast('Selecione uma mesa primeiro', 'error');
      setCurrentScreen('mesas');
      return;
    }

    if (draftItems.length === 0) {
      showToast('Adicione pelo menos 1 item ao pedido antes de enviar', 'error');
      return;
    }

    setIsSendingOrder(true);
    try {
      const payloadItems = draftItems.map((d) => ({
        id: d.menuItem.id,
        name: d.menuItem.name,
        quantity: d.quantity,
        unitPrice: d.unitPrice,
        selectedOptions: d.selectedOptions,
        notes: d.notes,
        station: d.station,
      }));

      const res = await appendItemsToTableOrder({
        tableNumber: selectedTable,
        restaurantSlug: activeRestaurantSlug,
        items: payloadItems,
        waiterName,
        customerName: `Mesa ${selectedTable} (${waiterName})`,
        idempotencyKey: `touch-${activeRestaurantSlug}-${selectedTable}-${draftItems.map((d) => `${d.id}:${d.quantity}`).join('|')}`,
      });

      if (res.success) {
        playAlertSound('sound3', 0.7);
        setDraftItems([]);
        setIsMobileCartOpen(false);
        showToast(`Pedido enviado com sucesso para a produção!`, 'success');
        setCurrentScreen('pedido');
      }
    } finally {
      setIsSendingOrder(false);
    }
  };

  // Close Table & Free (Screen 4)
  const handleCloseTableAction = async () => {
    if (!selectedTable) return;
    if (!currentTableOrder) {
      showToast('Esta mesa não possui comanda ativa para fechamento', 'error');
      setCurrentScreen('mesas');
      return;
    }

    setIsClosingTable(true);
    try {
      const res = await closeTableOrder({
        orderId: currentTableOrder.id,
        tableNumber: selectedTable,
        paymentMethod,
        discount: discountAmount,
        serviceFee: serviceFeeAmount,
        total: finalBillTotal,
        splitCount,
        operatorName: waiterName,
        waiterNotes: waiterNotes.trim(),
      });

      if (res.success) {
        playAlertSound('sound3', 0.8);
        showToast(`Mesa ${selectedTable} fechada e liberada com sucesso!`, 'success');
        setSelectedTable(null);
        setDraftItems([]);
        setDiscountAmount(0);
        setCashGiven('');
        setWaiterNotes('');
        setCurrentScreen('mesas');
      }
    } finally {
      setIsClosingTable(false);
    }
  };

  return (
    // BUG CORRIGIDO (mesas cortadas / mesas que não aparecem): "min-h-screen"
    // não tem teto de altura, então esta tela criava rolagem de PÁGINA
    // inteira por cima da trava de viewport do shell (body.painel-app-shell
    // em src/utils/index.css), e cards de mesa ficavam parcialmente atrás
    // do rodapé/topo sem aviso de scroll. Agora "h-full overflow-hidden":
    // o cabeçalho, a barra de ambientes e as abas ficam fixos, e SÓ o
    // <main> abaixo rola internamente (flex-1 min-h-0 overflow-y-auto).
    <div className="h-full bg-[#07090E] text-slate-100 flex flex-col font-sans select-none overflow-hidden">
      {/* ========================================================================= */}
      {/* 1. SEPARAÇÃO VISUAL DE AMBIENTES (CLIENTE, GARÇOM/PDV, COZINHA, BAR, SUSHIBAR, ADMIN) */}
      {/* ========================================================================= */}
      <EnvironmentBar
        currentEnvironment="pdv"
        onSelectEnvironment={(env) => {
          if (onNavigateToEnvironment) {
            onNavigateToEnvironment(env);
          } else if (env === 'admin' && onOpenAdmin) {
            onOpenAdmin();
          } else if (env === 'cliente' && onBackToApp) {
            onBackToApp();
          }
        }}
      />

      {/* ========================================================================= */}
      {/* 2. TOP HEADER & OPERATOR BAR */}
      {/* ========================================================================= */}
      <header className="bg-[#0F131D] border-b border-slate-800 px-4 py-2.5 sm:px-6 flex items-center justify-between sticky top-0 z-30 shadow-2xl">
        <div className="flex items-center gap-3">
          {onBackToApp && (
            <button
              onClick={onBackToApp}
              className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-all active:scale-95"
              title="Voltar ao início"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}

          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-slate-950 border border-amber-500/40 overflow-hidden flex items-center justify-center shadow-lg shrink-0">
              {restaurant?.logo ? (
                <img src={restaurant.logo} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-xl">{restaurant?.emoji || '🍽️'}</span>
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-sm sm:text-base font-black text-white uppercase tracking-wider">
                  PDV TOUCH GARÇOM
                </h1>
                <span className="text-[10px] bg-amber-500/20 text-amber-300 font-bold px-2 py-0.5 rounded-full border border-amber-500/30 truncate max-w-[220px]">
                  {restaurant?.name || 'Salão'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate">
                Cardápio exclusivo desta casa • Cozinha • SushiBar • Bar
              </p>
            </div>
            {canSwitchRestaurant && (
              <select
                value={activeRestaurantSlug}
                onChange={(e) => setActiveRestaurantSlug(e.target.value as RestaurantSlug)}
                className="ml-1 max-w-[190px] bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-2 text-xs font-bold text-amber-300 focus:outline-none focus:border-amber-500"
                aria-label="Selecionar restaurante do PDV"
              >
                {Object.values(restaurants).filter((r) => r.isActive !== false).map((r) => (
                  <option key={r.slug} value={r.slug}>
                    {r.emoji} {r.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Waiter Name & Fast Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          <OfflineStatusIndicator />

          <div className="flex items-center gap-2 bg-[#171C28] px-3 py-1.5 rounded-xl border border-slate-700">
            <UserCheck className="w-4 h-4 text-amber-400" />
            <input
              type="text"
              value={waiterName}
              onChange={(e) => setWaiterName(e.target.value)}
              className="bg-transparent text-xs font-bold text-white focus:outline-none w-24 sm:w-32"
              placeholder="Garçom"
            />
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => setShowToolsMenu((v) => !v)}
              className={`text-xs font-black px-3 py-2 rounded-xl border transition-all flex items-center gap-1.5 ${showToolsMenu ? 'bg-amber-500 text-slate-950 border-amber-300' : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'}`}
              title="Ferramentas do salão"
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span>Ferramentas</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showToolsMenu ? 'rotate-180' : ''}`} />
            </button>
            {showToolsMenu && (
              <div className="absolute right-0 top-full mt-2 w-64 rounded-2xl border border-slate-700 bg-[#0D131F] shadow-2xl p-2 z-[80]">
                <div className="px-3 py-2 text-[9px] uppercase tracking-[.18em] font-black text-slate-500">Ferramentas — fora da venda</div>
                <button type="button" onClick={() => { setShowToolsMenu(false); openTableManager(); }} className="w-full text-left px-3 py-3 rounded-xl hover:bg-amber-500/10 text-white flex items-center gap-3">
                  <SlidersHorizontal className="w-4 h-4 text-amber-400" />
                  <span><b className="block text-xs">Cadastro de Mesas</b><small className="text-[10px] text-slate-500">Adicionar, excluir e atualizar</small></span>
                </button>
                {onOpenAdmin && (
                  <button type="button" onClick={() => { setShowToolsMenu(false); onOpenAdmin(); }} className="w-full text-left px-3 py-3 rounded-xl hover:bg-slate-800 text-white flex items-center gap-3">
                    <Layers className="w-4 h-4 text-violet-400" />
                    <span><b className="block text-xs">Painel Administrativo</b><small className="text-[10px] text-slate-500">Configurações, usuários e sistema</small></span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* 3. NAVEGAÇÃO ENTRE AS 4 TELAS OBRIGATÓRIAS (TOUCH TABS) */}
      {/* ========================================================================= */}
      <nav className="bg-[#111624] border-b border-slate-800 px-3 py-2 sm:px-6 sticky top-[57px] z-20 overflow-x-auto no-scrollbar">
        <div className="flex items-center justify-between min-w-[540px] sm:min-w-0 max-w-7xl mx-auto gap-2">
          {/* TELA 1: MESAS */}
          <button
            onClick={() => setCurrentScreen('mesas')}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all active:scale-95 border ${
              currentScreen === 'mesas'
                ? 'bg-amber-500 text-slate-950 border-amber-300 shadow-md scale-[1.02]'
                : 'bg-[#181E2E] text-slate-400 border-slate-800 hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>1. Mesas</span>
            {selectedTable && (
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-black/20 font-mono">
                {selectedTable}
              </span>
            )}
          </button>

          {/* TELA 2: CARDÁPIO PDV */}
          <button
            onClick={() => {
              if (!selectedTable) {
                showToast('Selecione uma mesa na Tela 1 antes de abrir o cardápio', 'info');
                setCurrentScreen('mesas');
                return;
              }
              setCurrentScreen('cardapio');
            }}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all active:scale-95 border ${
              currentScreen === 'cardapio'
                ? 'bg-amber-500 text-slate-950 border-amber-300 shadow-md scale-[1.02]'
                : 'bg-[#181E2E] text-slate-400 border-slate-800 hover:text-white'
            }`}
          >
            <Utensils className="w-4 h-4" />
            <span>2. Cardápio PDV</span>
            {selectedTable && (
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-black/20 font-mono">
                M{selectedTable}
              </span>
            )}
          </button>

          {/* TELA 3: PEDIDO / ITENS */}
          <button
            onClick={() => {
              if (!selectedTable) {
                showToast('Selecione uma mesa para revisar o pedido', 'info');
                setCurrentScreen('mesas');
                return;
              }
              setCurrentScreen('pedido');
            }}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all active:scale-95 border relative ${
              currentScreen === 'pedido'
                ? 'bg-amber-500 text-slate-950 border-amber-300 shadow-md scale-[1.02]'
                : 'bg-[#181E2E] text-slate-400 border-slate-800 hover:text-white'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>3. Pedido / Itens</span>
            {draftItemsCount > 0 && (
              <span className="w-5 h-5 rounded-full bg-red-500 text-white font-black text-[10px] flex items-center justify-center shadow-lg">
                {draftItemsCount}
              </span>
            )}
          </button>

          {/* TELA 4: FECHAMENTO */}
          <button
            onClick={() => {
              if (!selectedTable) {
                showToast('Selecione uma mesa para realizar o fechamento', 'info');
                setCurrentScreen('mesas');
                return;
              }
              setCurrentScreen('fechamento');
            }}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all active:scale-95 border ${
              currentScreen === 'fechamento'
                ? 'bg-amber-500 text-slate-950 border-amber-300 shadow-md scale-[1.02]'
                : 'bg-[#181E2E] text-slate-400 border-slate-800 hover:text-white'
            }`}
          >
            <Receipt className="w-4 h-4" />
            <span>4. Fechamento</span>
          </button>
        </div>
      </nav>

      {/* ========================================================================= */}
      {/* 4. CONTEÚDO PRINCIPAL (TELAS SEPARADAS) */}
      {/* ========================================================================= */}
      <main className={`flex-1 min-h-0 max-w-7xl w-full mx-auto p-3 sm:p-4 lg:p-5 pb-4 ${currentScreen === 'mesas' ? 'overflow-hidden' : 'overflow-y-auto'}`}>
        {/* --------------------------------------------------------------------- */}
        {/* TELA 1: MESAS */}
        {/* --------------------------------------------------------------------- */}
        {currentScreen === 'mesas' && (
          <div className="space-y-6">
            {/* Header & Status Filters */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#111624] p-4 rounded-3xl border border-slate-800 shadow-xl">
              <div>
                <h2 className="text-lg font-black text-white uppercase tracking-wider flex items-center gap-2">
                  <span>SALÃO DE MESAS</span>
                  <span className="text-xs bg-slate-800 text-amber-400 px-2.5 py-0.5 rounded-full font-mono">
                    {tableNumbers.length} Mesas
                  </span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Toque em qualquer mesa para abrir o atendimento ou conferir comanda
                </p>
              </div>

              {/* Status Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 no-scrollbar">
                {(
                  [
                    { key: 'todos', label: 'Todas' },
                    { key: 'livre', label: 'Livre' },
                    { key: 'atendimento', label: 'Em Atendimento' },
                    { key: 'pronto', label: 'Pronto / Servir' },
                    { key: 'fechamento', label: 'Fechamento' },
                  ] as const
                ).map((f) => (
                  <button
                    key={f.key}
                    onClick={() => setTableFilter(f.key)}
                    className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider whitespace-nowrap transition-all border ${
                      tableFilter === f.key
                        ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md font-black'
                        : 'bg-[#181E2E] text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Cadastro removido do fluxo de venda: fica em Ferramentas no topo. */}
            <div className="table-isometric-canvas rounded-3xl border border-slate-800/90 bg-[radial-gradient(circle_at_50%_0%,rgba(245,158,11,.08),transparent_42%),#080C14] p-2 sm:p-3 overflow-hidden h-[calc(100dvh-17rem)] min-h-0">
              <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-2 sm:gap-3 h-full auto-rows-fr">
                {tableNumbers.map((tableNum) => {
                  const status = getTableStatus(tableNum);
                  const order = activeOrdersByTable[tableNum];
                  if (tableFilter !== 'todos' && status.key !== tableFilter) return null;
                  const isCurrent = selectedTable === tableNum;
                  const closed = status.key === 'fechamento';
                  const inUse = status.key !== 'livre';
                  return (
                    <button key={tableNum} type="button" onClick={() => handleSelectTable(tableNum)} className={`group relative min-h-0 h-full rounded-2xl border-2 p-2 text-left overflow-hidden transition-all active:scale-[.98] ${status.cardBg} ${isCurrent ? 'ring-2 ring-amber-400/90 shadow-[0_0_28px_rgba(245,158,11,.25)]' : 'shadow-lg'}`}>
                      <div className="absolute inset-0 bg-gradient-to-b from-white/[.035] to-transparent pointer-events-none" />
                      <div className="relative z-10 flex items-start justify-between gap-1">
                        <div>
                          <div className="text-xl sm:text-2xl font-black text-white font-mono leading-none">{tableNum}</div>
                          <div className="text-[8px] text-slate-500 uppercase font-black tracking-[.14em] mt-0.5">Mesa</div>
                        </div>
                        <span className={`w-2.5 h-2.5 rounded-full shrink-0 mt-1 ${closed ? 'bg-red-500' : inUse ? 'bg-white' : 'bg-emerald-500'}`} />
                      </div>
                      <img src={getTableVisual(status.key)} alt={`Mesa ${tableNum}`} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[88%] max-w-[120px] h-auto object-contain opacity-95 drop-shadow-[0_12px_14px_rgba(0,0,0,.5)] transition-transform duration-300 group-hover:scale-105" />
                      <div className="absolute left-2 right-2 bottom-2 z-10 flex items-center justify-between gap-1 border-t border-white/10 pt-1.5">
                        <span className={`text-[9px] sm:text-[10px] font-black uppercase truncate ${closed ? 'text-red-400' : inUse ? 'text-white' : 'text-emerald-400'}`}>{closed ? 'FECHADA' : inUse ? 'EM USO' : 'ABERTA'}</span>
                        {order ? <span className="text-[9px] font-mono font-black text-amber-400 truncate">R$ {order.total.toFixed(2)}</span> : <Plus className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}


        {/* --------------------------------------------------------------------- */}
        {/* TELA 2: CARDÁPIO PDV (VENDA RÁPIDA TOUCH, SPLIT OU FLUIDO) */}
        {/* --------------------------------------------------------------------- */}
        {currentScreen === 'cardapio' && (
          <div className="space-y-4">
            {/* ================================================================= */}
            {/* BARRA DE ATALHOS RÁPIDOS DO PDV */}
            {/* ================================================================= */}
            <div className="bg-[#111624] border border-slate-800 p-3 sm:p-4 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-lg">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setCurrentScreen('mesas')}
                  className="min-h-[42px] px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-black uppercase rounded-xl flex items-center gap-1.5 transition-all active:scale-95"
                  title="Voltar para a Tela de Mesas"
                >
                  <ArrowLeft className="w-4 h-4 text-amber-400" />
                  <span>Voltar Mesas</span>
                </button>

                <div className="flex items-center gap-2">
                  <span className="text-sm sm:text-base font-black text-white font-mono bg-black/40 px-3 py-1 rounded-xl border border-slate-700">
                    MESA {selectedTable}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowSwitchTableModal(true)}
                    className="text-xs text-amber-400 hover:underline font-bold px-2 py-1 bg-amber-500/10 hover:bg-amber-500/20 rounded-lg border border-amber-500/30"
                  >
                    Trocar Mesa
                  </button>
                </div>
              </div>

              {/* Atalhos Rápidos da Mesa */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    setDraftItems([]);
                    showToast('Nova rodada iniciada', 'info');
                  }}
                  className="min-h-[40px] px-3 py-2 bg-[#181E2E] hover:bg-[#20273D] text-slate-300 text-xs font-bold rounded-xl border border-slate-700 flex items-center gap-1.5 transition-all active:scale-95"
                  title="Limpar itens desta rodada"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
                  <span>Novo Pedido</span>
                </button>

                {currentTableOrder && (
                  <button
                    type="button"
                    onClick={() => setCurrentScreen('pedido')}
                    className="min-h-[40px] px-3.5 py-2 bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-500/40 text-xs font-black uppercase rounded-xl flex items-center gap-1.5 transition-all active:scale-95"
                  >
                    <Layers className="w-4 h-4" />
                    <span>Consultar Pedido</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setCurrentScreen('fechamento')}
                  className="min-h-[40px] px-3.5 py-2 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 border border-emerald-500/40 text-xs font-black uppercase rounded-xl flex items-center gap-1.5 transition-all active:scale-95"
                >
                  <Receipt className="w-4 h-4" />
                  <span>Fechamento</span>
                </button>
              </div>
            </div>

            {/* ================================================================= */}
            {/* LAYOUT PRINCIPAL: SPLIT DESKTOP/TABLET (GRID DE VENDA + CARRINHO FIXO) */}
            {/* ================================================================= */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              {/* COLUNA ESQUERDA + CENTRAL (PRODUTOS & CATEGORIAS - 8 colunas) */}
              <div className="lg:col-span-8 space-y-4">
                {/* Barra de Busca Rápida Touch */}
                <div className="relative">
                  <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar produto por nome, ingrediente ou código rápido..."
                    className="w-full pl-12 pr-10 py-3.5 bg-[#111624] border border-slate-800 rounded-2xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 shadow-inner"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-white bg-slate-800 rounded-xl"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Barra de Categorias e Acesso Rápido a Mais Vendidos */}
                <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
                  {/* Pills de Acesso Rápido */}
                  <button
                    type="button"
                    onClick={() => setSelectedCategory('all')}
                    className={`min-h-[44px] px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider whitespace-nowrap transition-all border flex items-center gap-1.5 ${
                      selectedCategory === 'all'
                        ? 'bg-amber-500 text-slate-950 border-amber-300 shadow-lg scale-105'
                        : 'bg-[#131826] text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    <span>Todos</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/30 font-mono">
                      {restaurantMenuItems.filter((i) => i.available).length}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedCategory('mais_vendidos')}
                    className={`min-h-[44px] px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider whitespace-nowrap transition-all border flex items-center gap-1.5 ${
                      selectedCategory === 'mais_vendidos'
                        ? 'bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 border-amber-300 shadow-lg scale-105'
                        : 'bg-[#131826] text-amber-400 border-amber-500/30 hover:border-amber-400'
                    }`}
                  >
                    <span>🔥 Mais Vendidos</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedCategory('destaque')}
                    className={`min-h-[44px] px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider whitespace-nowrap transition-all border flex items-center gap-1.5 ${
                      selectedCategory === 'destaque'
                        ? 'bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 border-amber-300 shadow-lg scale-105'
                        : 'bg-[#131826] text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    <span>✨ Destaques</span>
                  </button>

                  {/* Categorias originais do restaurante */}
                  {restaurantCategories.map((cat) => {
                    const count = restaurantMenuItems.filter(
                      (i) => i.categoryId === cat.id && i.available
                    ).length;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setSelectedCategory(cat.id)}
                        className={`min-h-[44px] px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider whitespace-nowrap transition-all border flex items-center gap-1.5 ${
                          selectedCategory === cat.id
                            ? 'bg-amber-500 text-slate-950 border-amber-300 shadow-lg scale-105'
                            : 'bg-[#131826] text-slate-400 border-slate-800 hover:text-white'
                        }`}
                      >
                        {cat.icon && <span>{cat.icon}</span>}
                        <span>{cat.name}</span>
                        {count > 0 && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/30 font-mono">
                            {count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Grid de Produtos com Fotos, Nomes, Preços e Botões Touch */}
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3.5">
                  {filteredMenuItems.map((item) => {
                    const station = determineStation(item);
                    const stationBadge = {
                      bar: { label: 'BAR', color: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
                      cozinha: { label: 'COZINHA', color: 'bg-orange-500/20 text-orange-300 border-orange-500/30' },
                      sushibar: { label: 'SUSHIBAR', color: 'bg-teal-500/20 text-teal-300 border-teal-500/30' },
                    }[station];

                    const inDraftCount = getItemDraftCount(item.id);
                    const itemPrice = item.promoPrice || item.price;

                    return (
                      <div
                        key={item.id}
                        onClick={() => handleOpenItem(item)}
                        className="bg-[#111624] border border-slate-800 hover:border-amber-500/60 rounded-3xl overflow-hidden flex flex-col justify-between text-left transition-all active:scale-[0.99] shadow-xl group cursor-pointer"
                      >
                        {/* Imagem do Produto Original */}
                        <div className="h-32 w-full bg-slate-800 relative overflow-hidden flex items-center justify-center">
                          {item.image || (item as any).imageUrl ? (
                            <img
                              src={item.image || (item as any).imageUrl}
                              alt={item.name}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 filter brightness-90"
                            />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-[#1E2638] to-[#121622] flex items-center justify-center">
                              {station === 'bar' ? (
                                <Beer className="w-8 h-8 text-purple-400/60" />
                              ) : station === 'sushibar' ? (
                                <Fish className="w-8 h-8 text-teal-400/60" />
                              ) : (
                                <Flame className="w-8 h-8 text-orange-400/60" />
                              )}
                            </div>
                          )}

                          {/* Badge de Praça de Produção */}
                          <span
                            className={`absolute top-2.5 left-2.5 text-[9px] font-black px-2 py-0.5 rounded-lg border backdrop-blur-md uppercase shadow-md ${stationBadge.color}`}
                          >
                            {stationBadge.label}
                          </span>

                          {/* Quantidade Visível no Card quando já adicionado */}
                          {inDraftCount > 0 && (
                            <span className="absolute top-2.5 right-2.5 bg-amber-500 text-slate-950 font-black text-xs px-2.5 py-1 rounded-full shadow-lg border border-amber-300 animate-bounce">
                              {inDraftCount}x no pedido
                            </span>
                          )}
                        </div>

                        {/* Detalhes do Produto */}
                        <div className="p-3.5 flex-1 flex flex-col justify-between">
                          <div>
                            <h3 className="text-sm font-black text-white group-hover:text-amber-400 transition-colors line-clamp-1">
                              {item.name}
                            </h3>
                            <p className="text-xs text-slate-400 line-clamp-2 mt-1 min-h-[32px]">
                              {item.description}
                            </p>
                          </div>

                          {/* Preço e Controles Rápidos Touch */}
                          <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                            <div>
                              <span className="text-[10px] text-slate-500 block uppercase font-bold">
                                Preço
                              </span>
                              <div className="flex items-baseline gap-1.5">
                                <span className="text-base font-black text-amber-400 font-mono">
                                  R$ {itemPrice.toFixed(2)}
                                </span>
                                {item.promoPrice && (
                                  <span className="text-[10px] text-slate-500 line-through">
                                    R$ {item.price.toFixed(2)}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Controles Touch: se já estiver no carrinho, mostra - QTD + para ajuste direto */}
                            {inDraftCount > 0 ? (
                              <div
                                onClick={(e) => e.stopPropagation()}
                                className="flex items-center gap-1.5 bg-[#181E2E] p-1 rounded-xl border border-amber-500/50"
                              >
                                <button
                                  type="button"
                                  onClick={(e) => handleQuickDecrement(e, item)}
                                  className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center font-black active:scale-90"
                                >
                                  <Minus className="w-3.5 h-3.5" />
                                </button>
                                <span className="text-xs font-black text-amber-300 font-mono w-5 text-center">
                                  {inDraftCount}
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) => handleQuickAdd(e, item)}
                                  className="w-8 h-8 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center justify-center font-black active:scale-90"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => handleQuickAdd(e, item)}
                                className="min-h-[38px] px-3 rounded-xl bg-amber-500/20 hover:bg-amber-500 text-amber-400 hover:text-slate-950 border border-amber-500/40 flex items-center justify-center gap-1 font-black text-xs transition-all active:scale-90 shadow-sm"
                                title="Adicionar rapidamente"
                              >
                                <Plus className="w-4 h-4" />
                                <span>Inserir</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* COLUNA DIREITA: CARRINHO FIXO E SEMPRE VISÍVEL (4 colunas no desktop) */}
              <div className="hidden lg:block lg:col-span-4 sticky top-2 self-start max-h-[calc(100dvh-8rem)] space-y-4">
                <div className="bg-[#111624] border border-slate-800 rounded-3xl p-4 shadow-2xl space-y-4 max-h-[calc(100dvh-8rem)] overflow-hidden flex flex-col">
                  {/* Cabeçalho do Carrinho Fixo */}
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-black">
                        <Layers className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-black text-white uppercase tracking-wider">
                          CARRINHO • MESA {selectedTable}
                        </h3>
                        <span className="text-[10px] text-slate-400">
                          {draftItemsCount} {draftItemsCount === 1 ? 'item' : 'itens'} nesta rodada
                        </span>
                      </div>
                    </div>

                    {draftItems.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setDraftItems([])}
                        className="text-[11px] text-red-400 hover:underline font-bold"
                      >
                        Limpar
                      </button>
                    )}
                  </div>

                  {/* Lista de Itens do Carrinho */}
                  {draftItems.length === 0 ? (
                    <div className="p-6 text-center border border-dashed border-slate-800 rounded-2xl text-slate-400">
                      <Utensils className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                      <p className="text-xs font-bold text-slate-300">
                        O carrinho desta mesa está vazio
                      </p>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        Toque nos produtos ao lado para lançar a rodada
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[min(42vh,380px)] overflow-y-auto pr-1 flex-1 min-h-0">
                      {draftItems.map((item) => (
                        <div
                          key={item.id}
                          className="bg-[#161C2B] border border-slate-800 p-2.5 rounded-2xl flex items-start justify-between gap-2 shadow-sm"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[8px] font-black px-1 rounded bg-slate-800 text-amber-400 uppercase">
                                {item.station}
                              </span>
                              <h4 className="text-xs font-black text-white truncate">
                                {item.menuItem.name}
                              </h4>
                            </div>

                            {/* Selected Options */}
                            {item.selectedOptions && item.selectedOptions.length > 0 && (
                              <div className="text-[10px] text-slate-400 mt-0.5">
                                {item.selectedOptions.map((o) => o.name).join(', ')}
                              </div>
                            )}

                            {/* Removed Ingredients / Notes */}
                            {item.notes && (
                              <div className="text-[10px] text-amber-300 font-semibold mt-0.5">
                                {item.notes}
                              </div>
                            )}

                            <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                              R$ {item.unitPrice.toFixed(2)} un
                            </div>
                          </div>

                          {/* Quantidade e Preço */}
                          <div className="flex flex-col items-end gap-1.5">
                            <div className="flex items-center gap-1 bg-[#0E121D] p-0.5 rounded-lg border border-slate-700">
                              <button
                                type="button"
                                onClick={() => {
                                  if (item.quantity > 1) {
                                    setDraftItems((prev) =>
                                      prev.map((d) =>
                                        d.id === item.id ? { ...d, quantity: d.quantity - 1 } : d
                                      )
                                    );
                                  } else {
                                    handleRemoveDraftItem(item.id);
                                  }
                                }}
                                className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center font-black text-xs active:scale-90"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className="text-xs font-black text-white font-mono w-5 text-center">
                                {item.quantity}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  setDraftItems((prev) =>
                                    prev.map((d) =>
                                      d.id === item.id ? { ...d, quantity: d.quantity + 1 } : d
                                    )
                                  );
                                }}
                                className="w-6 h-6 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center justify-center font-black text-xs active:scale-90"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>

                            <span className="text-xs font-black text-amber-400 font-mono">
                              R$ {(item.unitPrice * item.quantity).toFixed(2)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Resumo Financeiro do Carrinho em Tempo Real */}
                  <div className="pt-3 border-t border-slate-800 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Subtotal Rodada:</span>
                      <span className="font-mono font-bold text-white">
                        R$ {draftTotal.toFixed(2)}
                      </span>
                    </div>

                    {currentTableOrder && (
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span>Acumulado Mesa {currentTableOrder.shortCode}:</span>
                        <span className="font-mono font-bold text-amber-300">
                          R$ {currentTableOrder.total.toFixed(2)}
                        </span>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-sm font-black border-t border-slate-800/80 pt-2">
                      <span className="text-white uppercase">Total em Tempo Real:</span>
                      <span className="text-xl font-black text-amber-400 font-mono">
                        R$ {(draftTotal + (currentTableOrder?.total || 0)).toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* BOTÕES PRINCIPAIS DO CARRINHO */}
                  <div className="space-y-2 pt-2">
                    {/* Botão ENVIAR PEDIDO */}
                    <button
                      type="button"
                      onClick={handleSendOrderToProduction}
                      disabled={draftItems.length === 0 || isSendingOrder}
                      className="w-full min-h-[48px] bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-400 hover:brightness-110 disabled:opacity-40 text-slate-950 font-black text-xs uppercase tracking-wider rounded-2xl shadow-xl flex items-center justify-center gap-2 transition-all active:scale-98 cursor-pointer"
                    >
                      {isSendingOrder ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>ENVIANDO...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          <span>ENVIAR PEDIDO</span>
                        </>
                      )}
                    </button>

                    {/* Botões SALVAR & FECHAMENTO */}
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={handleSaveDraft}
                        disabled={draftItems.length === 0}
                        className="min-h-[42px] bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 font-black text-xs uppercase rounded-xl border border-slate-700 flex items-center justify-center gap-1.5 transition-all active:scale-95"
                      >
                        <BookmarkCheck className="w-3.5 h-3.5 text-amber-400" />
                        <span>SALVAR</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setCurrentScreen('fechamento')}
                        className="min-h-[42px] bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 border border-emerald-500/40 font-black text-xs uppercase rounded-xl flex items-center justify-center gap-1.5 transition-all active:scale-95"
                      >
                        <Receipt className="w-3.5 h-3.5" />
                        <span>FECHAMENTO</span>
                      </button>
                    </div>

                    {/* Botão + ADICIONAR ITEM */}
                    <button
                      type="button"
                      onClick={() => {
                        searchInputRef.current?.focus();
                        showToast('Selecione novos itens do cardápio', 'info', 1500);
                      }}
                      className="w-full py-2 bg-transparent hover:bg-slate-800/60 text-slate-400 hover:text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ ADICIONAR ITEM</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* BARRA FIXA MOBILE: CARRINHO SEMPRE ACESSÍVEL NO CELULAR / TABLET VERTICAL */}
            <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#111624]/95 backdrop-blur-xl border-t border-amber-500/40 p-3 shadow-2xl">
              <div className="flex items-center justify-between gap-3 max-w-lg mx-auto">
                <button
                  type="button"
                  onClick={() => setIsMobileCartOpen(true)}
                  className="flex items-center gap-2.5 text-left"
                >
                  <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-black relative">
                    <Layers className="w-5 h-5" />
                    {draftItemsCount > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-black border-2 border-slate-950">
                        {draftItemsCount}
                      </span>
                    )}
                  </div>
                  <div>
                    <span className="text-xs font-black text-white uppercase block">
                      Mesa {selectedTable}
                    </span>
                    <span className="text-sm font-black text-amber-400 font-mono">
                      R$ {(draftTotal + (currentTableOrder?.total || 0)).toFixed(2)}
                    </span>
                  </div>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsMobileCartOpen(true)}
                    className="px-3.5 py-2.5 bg-slate-800 text-slate-200 text-xs font-black rounded-xl border border-slate-700"
                  >
                    Ver Carrinho
                  </button>

                  <button
                    type="button"
                    onClick={handleSendOrderToProduction}
                    disabled={draftItems.length === 0 || isSendingOrder}
                    className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 text-xs font-black uppercase rounded-xl shadow-lg flex items-center gap-1.5 disabled:opacity-40"
                  >
                    <Send className="w-4 h-4" />
                    <span>ENVIAR</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* --------------------------------------------------------------------- */}
        {/* TELA 3: PEDIDO / ITENS (REVISAR ITENS, QTD, EDITAR, ACOMPANHAR) */}
        {/* --------------------------------------------------------------------- */}
        {currentScreen === 'pedido' && (
          <div className="space-y-6">
            {/* Top Table Summary */}
            <div className="bg-[#111624] border border-slate-800 p-4 rounded-3xl flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-black text-white font-mono">
                    MESA {selectedTable}
                  </span>
                  <span className="text-[10px] bg-amber-500/20 text-amber-300 font-black px-2 py-0.5 rounded-full border border-amber-500/30">
                    CONFERÊNCIA & ACOMPANHAMENTO
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Revise os itens da comanda e acompanhe o status nas praças de produção
                </p>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setCurrentScreen('cardapio')}
                  className="flex-1 sm:flex-none px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-black uppercase rounded-xl flex items-center justify-center gap-1.5 transition-all active:scale-95"
                >
                  <Plus className="w-4 h-4 text-amber-400" />
                  <span>Adicionar Mais Itens</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCurrentScreen('fechamento')}
                  className="flex-1 sm:flex-none px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase rounded-xl flex items-center justify-center gap-1.5 transition-all active:scale-95"
                >
                  <Receipt className="w-4 h-4" />
                  <span>Ir para Fechamento</span>
                </button>
              </div>
            </div>

            {/* Seção A: Novos Itens Desta Rodada (A Enviar) */}
            <div className="bg-[#111624] border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
                  <h3 className="text-sm font-black text-white uppercase tracking-wider">
                    Novos Itens a Enviar para Produção ({draftItems.length})
                  </h3>
                </div>
                {draftItems.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setDraftItems([])}
                    className="text-xs text-red-400 hover:underline font-bold"
                  >
                    Limpar Rodada
                  </button>
                )}
              </div>

              {draftItems.length === 0 ? (
                <div className="p-8 text-center border border-dashed border-slate-800 rounded-2xl text-slate-400">
                  <Utensils className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                  <p className="text-sm font-bold text-slate-300">
                    Nenhum novo item adicionado nesta rodada
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Toque em "Adicionar Mais Itens" para selecionar pratos e bebidas no Cardápio PDV.
                  </p>
                  <button
                    type="button"
                    onClick={() => setCurrentScreen('cardapio')}
                    className="mt-4 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase rounded-xl inline-flex items-center gap-2 active:scale-95"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Abrir Cardápio PDV</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {draftItems.map((item) => {
                    const stationBadge = {
                      bar: { label: 'BAR', color: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
                      cozinha: { label: 'COZINHA', color: 'bg-orange-500/20 text-orange-300 border-orange-500/30' },
                      sushibar: { label: 'SUSHIBAR', color: 'bg-teal-500/20 text-teal-300 border-teal-500/30' },
                    }[item.station];

                    return (
                      <div
                        key={item.id}
                        className="bg-[#161C2B] border border-slate-800 p-3.5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-md"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-[9px] font-black px-1.5 py-0.5 rounded border uppercase ${stationBadge.color}`}
                            >
                              {stationBadge.label}
                            </span>
                            <h4 className="text-sm font-black text-white truncate">
                              {item.menuItem.name}
                            </h4>
                          </div>

                          {item.notes && (
                            <p className="text-xs text-amber-300 mt-1 flex items-center gap-1">
                              <span className="font-bold">Obs:</span> {item.notes}
                            </p>
                          )}
                        </div>

                        {/* Controles de Quantidade & Preço */}
                        <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-4">
                          <div className="flex items-center gap-2 bg-[#0E121D] p-1 rounded-xl border border-slate-700">
                            <button
                              type="button"
                              onClick={() => {
                                if (item.quantity > 1) {
                                  setDraftItems((prev) =>
                                    prev.map((d) =>
                                      d.id === item.id ? { ...d, quantity: d.quantity - 1 } : d
                                    )
                                  );
                                } else {
                                  handleRemoveDraftItem(item.id);
                                }
                              }}
                              className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center font-black active:scale-90"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                            <span className="text-sm font-black text-white font-mono w-6 text-center">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setDraftItems((prev) =>
                                  prev.map((d) =>
                                    d.id === item.id ? { ...d, quantity: d.quantity + 1 } : d
                                  )
                                );
                              }}
                              className="w-8 h-8 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center justify-center font-black active:scale-90"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="text-right min-w-[90px]">
                            <span className="text-sm font-black text-amber-400 font-mono block">
                              R$ {(item.unitPrice * item.quantity).toFixed(2)}
                            </span>
                            <span className="text-[10px] text-slate-500 block">
                              (R$ {item.unitPrice.toFixed(2)} un)
                            </span>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleOpenItem(item.menuItem, item.id)}
                              className="p-2 text-slate-400 hover:text-white bg-slate-800/60 rounded-xl"
                              title="Editar observação"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveDraftItem(item.id)}
                              className="p-2 text-slate-400 hover:text-red-400 bg-slate-800/60 rounded-xl"
                              title="Remover item"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Botão Enviar Pedido */}
              {draftItems.length > 0 && (
                <div className="pt-3 border-t border-slate-800 space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400 font-bold">Subtotal Desta Rodada:</span>
                    <span className="text-xl font-black text-amber-400 font-mono">
                      R$ {draftTotal.toFixed(2)}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleSendOrderToProduction}
                    disabled={isSendingOrder}
                    className="w-full py-4 bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-400 hover:brightness-110 disabled:opacity-50 text-slate-950 font-black text-sm uppercase tracking-wider rounded-2xl shadow-2xl flex items-center justify-center gap-2 transition-all active:scale-98"
                  >
                    {isSendingOrder ? (
                      <>
                        <RefreshCw className="w-5 h-5 animate-spin" />
                        <span>ENVIANDO ÀS PRAÇAS...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-5 h-5" />
                        <span>ENVIAR PEDIDO PARA PRODUÇÃO (SEM DUPLICAR)</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Seção B: Itens Já em Produção / Entregues na Mesa (Comanda Acumulada) */}
            {currentTableOrder && (
              <div className="bg-[#111624] border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    <h3 className="text-sm font-black text-white uppercase tracking-wider">
                      Itens Já Enviados na Comanda ({currentTableOrder.items.length}) • #{currentTableOrder.shortCode}
                    </h3>
                  </div>
                  <span className="text-xs font-mono font-bold text-amber-400">
                    Total Acumulado: R$ {currentTableOrder.total.toFixed(2)}
                  </span>
                </div>

                <div className="space-y-2">
                  {currentTableOrder.items.map((it, idx) => {
                    const st = it.station || determineStation({ name: it.name } as any);
                    const stBadge = {
                      bar: { label: 'BAR', color: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
                      cozinha: { label: 'COZINHA', color: 'bg-orange-500/20 text-orange-300 border-orange-500/30' },
                      sushibar: { label: 'SUSHIBAR', color: 'bg-teal-500/20 text-teal-300 border-teal-500/30' },
                    }[st];

                    return (
                      <div
                        key={idx}
                        className="bg-[#141926] border border-slate-800/80 p-3 rounded-xl flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[9px] font-black px-1.5 py-0.5 rounded border uppercase ${stBadge.color}`}
                          >
                            {stBadge.label}
                          </span>
                          <span className="font-bold text-slate-200">
                            {it.quantity}x {it.name}
                          </span>
                          {it.notes && (
                            <span className="text-amber-300 text-[11px] hidden sm:inline">
                              ({it.notes})
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-slate-400 uppercase font-bold">
                            {it.stationStatus || currentTableOrder.status}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleEditSentItem(it)}
                            className="px-2 py-1 rounded-lg bg-blue-500/15 text-blue-300 border border-blue-500/30 font-black uppercase text-[9px]"
                          >
                            Editar
                          </button>
                          <span className="font-mono font-black text-slate-300">
                            R$ {(it.quantity * it.unitPrice).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* --------------------------------------------------------------------- */}
        {/* TELA 4: FECHAMENTO (RESUMO DA MESA, SUBTOTAL, DESCONTOS, TAXA, DIVIDIR, PAGAMENTO, LIBERAR) */}
        {/* --------------------------------------------------------------------- */}
        {currentScreen === 'fechamento' && (
          <div className="space-y-6 max-w-3xl mx-auto">
            {/* Header de Fechamento */}
            <div className="bg-[#111624] border border-slate-800 p-5 rounded-3xl shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center font-black text-xl">
                  <Receipt className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-black text-white uppercase tracking-wider font-mono">
                      FECHAMENTO • MESA {selectedTable}
                    </h2>
                    {currentTableOrder && (
                      <span className="text-xs bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded font-mono font-bold">
                        {currentTableOrder.shortCode}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Conferência, aplicação de desconto, divisão de conta e liberação de mesa
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowPrintModal(true)}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs font-black rounded-xl border border-slate-700 flex items-center gap-2 transition-all active:scale-95"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimir Conferência</span>
              </button>
            </div>

            {/* Resumo dos Itens Consumidos */}
            <div className="bg-[#111624] border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider border-b border-slate-800 pb-2 flex items-center justify-between">
                <span>Itens Consumidos ({tableItems.length})</span>
                <span>Subtotal: R$ {tableSubtotal.toFixed(2)}</span>
              </h3>

              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {tableItems.length === 0 ? (
                  <p className="text-xs text-slate-500 py-2">
                    Nenhum item consumido registrado ainda nesta mesa.
                  </p>
                ) : (
                  tableItems.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between text-xs py-1.5 border-b border-slate-800/50 last:border-0"
                    >
                      <span className="text-slate-200">
                        {item.quantity}x {item.name}
                      </span>
                      <span className="font-mono font-bold text-slate-300">
                        R$ {(item.quantity * item.unitPrice).toFixed(2)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Finalizar Comanda — ferramentas financeiras recolhidas por padrão */}
            <div className="bg-[#111624] border border-slate-800 rounded-3xl shadow-xl overflow-hidden">
              <button type="button" onClick={() => setIsFinalizeExpanded((v) => !v)} className="w-full p-4 sm:p-5 flex items-center justify-between gap-3 text-left hover:bg-white/[.02]">
                <div>
                  <span className="text-sm font-black text-white uppercase tracking-wider">Finalizar Comanda</span>
                  <p className="text-[10px] text-slate-500 mt-1">Taxa de serviço, desconto e forma de pagamento</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-black text-amber-400 font-mono">R$ {finalBillTotal.toFixed(2)}</span>
                  <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${isFinalizeExpanded ? 'rotate-180' : ''}`} />
                </div>
              </button>

              <div className="px-4 sm:px-5 pb-4">
                <div className="flex items-center justify-between py-3 border-t border-slate-800">
                  <span className="text-[11px] uppercase font-black text-slate-400">TOTAL A PAGAR</span>
                  <span className="text-xl font-black text-amber-400 font-mono">R$ {finalBillTotal.toFixed(2)}</span>
                </div>

                {isFinalizeExpanded && (
                  <div className="space-y-3 pt-2">
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div className="rounded-2xl bg-[#0B1019] border border-slate-800 p-3 space-y-2">
                        <div className="flex items-center justify-between"><span className="text-[10px] uppercase font-black text-slate-400">Desconto</span>{discountAmount > 0 && <button type="button" onClick={() => setDiscountAmount(0)} className="text-[10px] text-red-400">Remover</button>}</div>
                        <input type="number" min="0" max={tableSubtotal} value={discountAmount || ''} onChange={(e) => setDiscountAmount(Math.max(0, Number(e.target.value)))} placeholder="0,00" className="w-full p-2.5 bg-[#181E2E] border border-slate-700 rounded-xl text-sm text-white font-mono" />
                        <div className="flex gap-1.5">{[5,10,15,20].map((val) => <button key={val} type="button" onClick={() => setDiscountAmount(val)} className="px-2 py-1 rounded-lg bg-slate-800 text-[9px] text-slate-300 font-bold">R$ {val}</button>)}</div>
                      </div>

                      <div className="rounded-2xl bg-[#0B1019] border border-slate-800 p-3 space-y-2">
                        <div className="flex items-center justify-between"><span className="text-[10px] uppercase font-black text-slate-400">Taxa de Serviço 10%</span><button type="button" onClick={() => setServiceFeeEnabled((v) => !v)} className={`px-2.5 py-1 rounded-lg text-[9px] font-black ${serviceFeeEnabled ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-400'}`}>{serviceFeeEnabled ? 'Ativada' : 'Dispensada'}</button></div>
                        <div className="text-lg font-black font-mono text-emerald-400">+ R$ {serviceFeeAmount.toFixed(2)}</div>
                        <p className="text-[9px] text-slate-500">Opcional e removível conforme a operação.</p>
                      </div>
                    </div>

                    <div className="rounded-2xl bg-[#0B1019] border border-slate-800 p-3 space-y-2">
                      <span className="text-[10px] uppercase font-black text-slate-400">Forma de Pagamento</span>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {[{key:'pix',label:'PIX',icon:QrCode,color:'text-emerald-400'},{key:'credito',label:'Crédito',icon:CreditCard,color:'text-sky-400'},{key:'debito',label:'Débito',icon:CreditCard,color:'text-amber-400'},{key:'dinheiro',label:'Dinheiro',icon:DollarSign,color:'text-emerald-300'}].map((pm) => { const Icon=pm.icon; const isSel=paymentMethod===pm.key; return <button key={pm.key} type="button" onClick={() => setPaymentMethod(pm.key)} className={`min-h-[46px] p-2 rounded-xl border flex items-center justify-center gap-1.5 text-[10px] font-black ${isSel ? 'bg-amber-500 text-slate-950 border-amber-300' : 'bg-[#181E2E] border-slate-700 text-slate-300'}`}><Icon className={`w-4 h-4 ${isSel ? 'text-slate-950' : pm.color}`} />{pm.label}</button>; })}
                      </div>
                      {paymentMethod === 'dinheiro' && <div className="pt-2 border-t border-slate-800 flex items-center gap-2"><input type="text" value={cashGiven} onChange={(e) => setCashGiven(e.target.value)} placeholder="Valor recebido" className="flex-1 p-2.5 bg-[#181E2E] border border-slate-700 rounded-xl text-sm font-mono text-white" />{cashChange > 0 && <span className="text-xs font-black text-emerald-300">Troco R$ {cashChange.toFixed(2)}</span>}</div>}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Divisão de Conta Touch */}
            <div className="bg-[#111624] border border-slate-800 rounded-3xl p-5 shadow-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-amber-400" />
                  <span>Dividir Conta entre Pessoas</span>
                </span>
                <span className="text-xs font-bold text-amber-400">
                  {splitCount} {splitCount === 1 ? 'pessoa' : 'pessoas'}
                </span>
              </div>

              <div className="flex items-center justify-between bg-[#181E2E] p-3 rounded-2xl border border-slate-700">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSplitCount((c) => Math.max(1, c - 1))}
                    className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center font-black active:scale-95"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="text-base font-black text-white font-mono w-8 text-center">
                    {splitCount}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSplitCount((c) => c + 1)}
                    className="w-10 h-10 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center justify-center font-black active:scale-95"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">
                    Por Pessoa
                  </span>
                  <span className="text-lg font-black text-amber-400 font-mono">
                    R$ {splitPerPerson.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* Formas de Pagamento Touch (Cards Grandes) */}
            <div className="bg-[#111624] border border-slate-800 rounded-3xl p-5 shadow-xl space-y-3">
              <span className="text-xs font-black text-slate-300 uppercase tracking-wider block">
                Selecione a Forma de Pagamento
              </span>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {[
                  { key: 'pix', label: 'PIX', icon: QrCode, color: 'text-emerald-400' },
                  { key: 'credito', label: 'Crédito', icon: CreditCard, color: 'text-sky-400' },
                  { key: 'debito', label: 'Débito', icon: CreditCard, color: 'text-amber-400' },
                  { key: 'dinheiro', label: 'Dinheiro', icon: DollarSign, color: 'text-emerald-300' },
                ].map((pm) => {
                  const Icon = pm.icon;
                  const isSel = paymentMethod === pm.key;
                  return (
                    <button
                      key={pm.key}
                      type="button"
                      onClick={() => setPaymentMethod(pm.key)}
                      className={`min-h-[56px] p-3 rounded-2xl border-2 flex flex-col items-center justify-center gap-1 transition-all active:scale-95 ${
                        isSel
                          ? 'bg-amber-500 text-slate-950 border-amber-300 shadow-xl font-black'
                          : 'bg-[#181E2E] border-slate-700 text-slate-300 hover:text-white'
                      }`}
                    >
                      <Icon className={`w-5 h-5 ${isSel ? 'text-slate-950' : pm.color}`} />
                      <span className="text-xs font-black">{pm.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Se Dinheiro: Campo de Troco */}
              {paymentMethod === 'dinheiro' && (
                <div className="pt-3 border-t border-slate-800 flex items-center gap-3">
                  <div className="flex-1">
                    <label className="text-[11px] text-slate-400 block font-bold mb-1">
                      Valor Recebido em Dinheiro:
                    </label>
                    <input
                      type="text"
                      value={cashGiven}
                      onChange={(e) => setCashGiven(e.target.value)}
                      placeholder="Ex: 100,00"
                      className="w-full p-2.5 bg-[#181E2E] border border-slate-700 rounded-xl text-sm font-mono text-white"
                    />
                  </div>

                  {cashChange > 0 && (
                    <div className="bg-emerald-500/10 border border-emerald-500/30 p-2.5 rounded-xl text-right">
                      <span className="text-[10px] text-emerald-400 font-bold block uppercase">
                        Troco a Devolver:
                      </span>
                      <span className="text-base font-black text-emerald-300 font-mono">
                        R$ {cashChange.toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Ação principal: cobrar. Ações secundárias ficam discretas no rodapé. */}
            <div className="bg-[#111624] border border-slate-800 rounded-3xl p-4 shadow-2xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-black uppercase">Total a pagar</span>
                <span className="text-2xl font-black text-amber-400 font-mono">R$ {finalBillTotal.toFixed(2)}</span>
              </div>
              <button type="button" onClick={handleCloseTableAction} disabled={isClosingTable || tableItems.length === 0} className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-teal-400 hover:brightness-110 disabled:opacity-50 text-slate-950 font-black text-sm uppercase rounded-2xl shadow-xl flex items-center justify-center gap-2">
                {isClosingTable ? <><RefreshCw className="w-5 h-5 animate-spin" /> PROCESSANDO...</> : <><CheckCircle2 className="w-5 h-5" /> COBRAR MESA</>}
              </button>
              <div className="flex items-center justify-end gap-3 pt-1">
                <button type="button" onClick={() => setCurrentScreen('pedido')} className="text-[10px] font-bold text-slate-500 hover:text-slate-300">Cancelar</button>
                <button type="button" onClick={handleSaveDraft} disabled={!draftItems.length} className="px-3 py-1.5 rounded-lg border border-slate-600 text-[10px] font-black text-slate-300 disabled:opacity-40">Salvar</button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ========================================================================= */}
      {/* 5. PAINEL RÁPIDO TOUCH AO TOCAR NO PRODUTO (QUANTIDADE, MODIFICADORES, REMOVER INGREDIENTES, OBS) */}
      {/* ========================================================================= */}
      {editingItem && (
        <div className="modal-viewport fixed inset-0 z-50 bg-black/95 backdrop-blur-sm flex items-center justify-center p-4">
          {/* Modal compacto: HEADER FIXO / CONTEÚDO COM SCROLL INTERNO / AÇÃO FIXA — nunca ultrapassa o viewport */}
          <div className="bg-[#121622] border border-slate-800 rounded-3xl max-w-lg w-full max-h-[92vh] shadow-2xl animate-fadeIn flex flex-col overflow-hidden">
            <div className="flex items-start justify-between border-b border-slate-800 p-5 sm:p-6 pb-3 shrink-0">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  Praça: {determineStation(editingItem).toUpperCase()}
                </span>
                <h3 className="text-lg font-black text-white mt-1">{editingItem.name}</h3>
                <p className="text-xs text-slate-400 mt-0.5">{editingItem.description}</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800/60"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-5 sm:p-6 space-y-5">
            {/* Quantidade (+ / - com botões touch grandes) */}
            <div className="bg-[#181E2E] p-3.5 rounded-2xl border border-slate-800 flex items-center justify-between">
              <span className="text-sm font-bold text-slate-300">Quantidade:</span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setEditQty((q) => Math.max(1, q - 1))}
                  className="w-12 h-12 rounded-xl bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center font-black text-lg active:scale-95"
                >
                  <Minus className="w-5 h-5" />
                </button>
                <span className="text-xl font-mono font-black text-white w-8 text-center">
                  {editQty}
                </span>
                <button
                  type="button"
                  onClick={() => setEditQty((q) => q + 1)}
                  className="w-12 h-12 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center justify-center font-black text-lg active:scale-95"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Adicionais & Modificadores (Se existirem no cadastro original do item) */}
            {editingItem.optionGroups && editingItem.optionGroups.length > 0 && (
              <div className="space-y-3">
                {editingItem.optionGroups.map((group) => (
                  <div key={group.id} className="bg-[#181E2E] p-3 rounded-2xl border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                      <span>{group.title}</span>
                      {group.required && (
                        <span className="text-[10px] text-amber-400 font-normal">Obrigatório</span>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {group.options.map((opt) => {
                        const isSelected = editSelectedOptions.some((o) => o.id === opt.id);
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => {
                              if (isSelected) {
                                setEditSelectedOptions((prev) => prev.filter((o) => o.id !== opt.id));
                              } else {
                                setEditSelectedOptions((prev) => [...prev, opt]);
                              }
                            }}
                            className={`p-2.5 rounded-xl text-left border text-xs flex items-center justify-between transition-all ${
                              isSelected
                                ? 'bg-amber-500/20 border-amber-400 text-amber-300 font-bold'
                                : 'bg-slate-900 border-slate-800 text-slate-300'
                            }`}
                          >
                            <span>{opt.name}</span>
                            {opt.price > 0 && (
                              <span className="font-mono text-[11px] text-amber-400">
                                + R$ {opt.price.toFixed(2)}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Remover Ingredientes (Atalhos Touch Rápidos) */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Ban className="w-3.5 h-3.5 text-red-400" />
                <span>Remover Ingredientes:</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {[
                  'Sem Cebola',
                  'Sem Tomate',
                  'Sem Pimenta',
                  'Sem Gelo',
                  'Sem Molho',
                  'Sem Queijo',
                  'Sem Alho',
                  'Sem Lactose',
                ].map((ing) => {
                  const isRemoved = editRemovedIngredients.includes(ing);
                  return (
                    <button
                      key={ing}
                      type="button"
                      onClick={() => handleToggleRemoveIngredient(ing)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all active:scale-95 flex items-center gap-1 ${
                        isRemoved
                          ? 'bg-red-500 text-white border-red-400 shadow-md'
                          : 'bg-slate-800 text-slate-300 border-slate-700 hover:border-slate-600'
                      }`}
                    >
                      <span>{ing}</span>
                      {isRemoved && <Check className="w-3.5 h-3.5" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Observações com Tags Rápidas de Produção */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 block">
                Observações Adicionais para a Praça:
              </label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {['Bem Passado', 'Ao Ponto', 'Mal Passado', 'Com Limão', 'Separar Molho', 'Caprichar no Gelo'].map(
                  (tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setEditNotes((prev) => (prev ? `${prev}, ${tag}` : tag))}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 border border-slate-700 font-medium active:scale-95"
                    >
                      + {tag}
                    </button>
                  )
                )}
              </div>
              <textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Ex: Ponto da carne, talheres extras, etc..."
                className="w-full p-3 bg-[#181E2E] border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 h-16"
              />
            </div>

            </div>

            {/* Preço e Confirmação Touch — ação fixa, sempre visível mesmo com conteúdo rolando acima */}
            <div className="shrink-0 border-t border-slate-800 p-5 sm:p-6 pt-3 space-y-2 bg-[#121622]">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Preço Unitário: R$ {currentEditingUnitPrice.toFixed(2)}</span>
                <span className="font-mono font-black text-amber-400 text-base">
                  Total: R$ {(currentEditingUnitPrice * editQty).toFixed(2)}
                </span>
              </div>

              <button
                type="button"
                onClick={handleConfirmItem}
                className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-black text-sm uppercase rounded-2xl shadow-xl flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
              >
                <Check className="w-5 h-5" />
                <span>+ ADICIONAR AO PEDIDO • R$ {(currentEditingUnitPrice * editQty).toFixed(2)}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. DRAWER DO CARRINHO MOBILE EXPANSÍVEL */}
      {/* ========================================================================= */}
      {isMobileCartOpen && (
        <div className="modal-viewport fixed inset-0 z-50 bg-black/95 backdrop-blur-sm flex flex-col justify-end lg:hidden">
          <div className="bg-[#121622] border-t border-amber-500/50 rounded-t-3xl p-5 max-h-[85vh] flex flex-col space-y-4 animate-slideUp">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-black text-white uppercase">
                  CARRINHO • MESA {selectedTable}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileCartOpen(false)}
                className="p-2 text-slate-400 hover:text-white bg-slate-800 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Lista de itens no mobile */}
            <div className="flex-1 overflow-y-auto space-y-2.5 max-h-[45vh] pr-1">
              {draftItems.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-6">
                  Nenhum item adicionado no carrinho desta mesa.
                </p>
              ) : (
                draftItems.map((item) => (
                  <div
                    key={item.id}
                    className="bg-[#181E2E] p-3 rounded-2xl border border-slate-800 flex items-center justify-between gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[8px] font-black px-1 rounded bg-slate-800 text-amber-400 uppercase">
                          {item.station}
                        </span>
                        <h4 className="text-xs font-black text-white truncate">
                          {item.menuItem.name}
                        </h4>
                      </div>
                      {item.notes && (
                        <p className="text-[10px] text-amber-300 mt-0.5">{item.notes}</p>
                      )}
                      <span className="text-[10px] text-slate-400 font-mono">
                        R$ {item.unitPrice.toFixed(2)} un
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 bg-[#0E121D] p-1 rounded-xl">
                        <button
                          type="button"
                          onClick={() => {
                            if (item.quantity > 1) {
                              setDraftItems((prev) =>
                                prev.map((d) =>
                                  d.id === item.id ? { ...d, quantity: d.quantity - 1 } : d
                                )
                              );
                            } else {
                              handleRemoveDraftItem(item.id);
                            }
                          }}
                          className="w-7 h-7 rounded-lg bg-slate-800 text-white flex items-center justify-center font-black text-xs"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-xs font-black text-white font-mono w-5 text-center">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setDraftItems((prev) =>
                              prev.map((d) =>
                                d.id === item.id ? { ...d, quantity: d.quantity + 1 } : d
                              )
                            );
                          }}
                          className="w-7 h-7 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center font-black text-xs"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <span className="text-xs font-black text-amber-400 font-mono min-w-[60px] text-right">
                        R$ {(item.unitPrice * item.quantity).toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Subtotais e Botões */}
            <div className="pt-3 border-t border-slate-800 space-y-3">
              <div className="flex items-center justify-between text-sm font-black">
                <span className="text-slate-300">TOTAL DA RODADA:</span>
                <span className="text-xl font-mono text-amber-400">
                  R$ {draftTotal.toFixed(2)}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleSaveDraft}
                  disabled={draftItems.length === 0}
                  className="py-3 bg-slate-800 text-slate-200 text-xs font-black uppercase rounded-xl border border-slate-700"
                >
                  Salvar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileCartOpen(false);
                    setCurrentScreen('fechamento');
                  }}
                  className="py-3 bg-emerald-600 text-white text-xs font-black uppercase rounded-xl"
                >
                  Fechamento
                </button>
              </div>

              <button
                type="button"
                onClick={handleSendOrderToProduction}
                disabled={draftItems.length === 0 || isSendingOrder}
                className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-black text-sm uppercase rounded-xl shadow-xl flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4" />
                <span>ENVIAR PEDIDO PARA PRODUÇÃO</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 7. MODAL DETALHES DA MESA */}
      {/* ========================================================================= */}
      {tableModalOption !== null && (() => {
        const table = tableModalOption;
        const order = activeOrdersByTable[table];
        const status = getTableStatus(table);
        const tableItems = order?.items || [];
        const totalItems = tableItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
        return (
          <div className="modal-viewport fixed inset-0 z-[80] bg-black/90 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-hidden">
            <div className="w-full max-w-6xl h-[min(94dvh,900px)] bg-[#0D121D] border border-slate-700/80 rounded-3xl shadow-[0_30px_100px_rgba(0,0,0,.7)] overflow-hidden flex flex-col">
              <div className="shrink-0 px-4 sm:px-6 py-3 border-b border-slate-800 bg-[#101622] flex items-center justify-between gap-3">
                <div>
                  <div className="text-lg sm:text-xl font-black text-white uppercase">Detalhes da Mesa {table}</div>
                  <div className="text-[11px] text-slate-400">{status.label} • {order ? `${totalItems} itens na comanda` : 'sem comanda ativa'}</div>
                </div>
                <button type="button" onClick={() => setTableModalOption(null)} className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:border-amber-400 flex items-center justify-center" aria-label="Fechar">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-5">
                <div className="grid lg:grid-cols-[1.15fr_.85fr] gap-5">
                  <div className="rounded-3xl border border-slate-800 bg-[#090D15] min-h-[330px] flex items-center justify-center overflow-hidden relative">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(245,158,11,.12),transparent_48%)]" />
                    <img src={getTableVisual(status.key)} alt={`Representação visual da Mesa ${table}`} className="relative z-10 w-[min(82%,560px)] h-auto max-h-[430px] object-contain drop-shadow-[0_30px_35px_rgba(0,0,0,.65)] scale-125" />
                    <div className="absolute left-5 top-5 z-20 px-3 py-1.5 rounded-full bg-black/60 border border-amber-400/30 text-amber-300 text-[10px] font-black uppercase">Mesa {table} • {status.label}</div>
                  </div>

                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-2xl bg-[#141B29] border border-slate-800 p-3"><span className="text-[9px] uppercase text-slate-500 font-black">Cliente</span><div className="text-sm font-black text-white mt-1">{order?.customerName || `Mesa ${table}`}</div></div>
                      <div className="rounded-2xl bg-[#141B29] border border-slate-800 p-3"><span className="text-[9px] uppercase text-slate-500 font-black">Garçom</span><div className="text-sm font-black text-white mt-1">{waiterName}</div></div>
                      <div className="rounded-2xl bg-[#141B29] border border-slate-800 p-3"><span className="text-[9px] uppercase text-slate-500 font-black">Itens</span><div className="text-sm font-black text-white mt-1">{totalItems}</div></div>
                      <div className="rounded-2xl bg-[#141B29] border border-slate-800 p-3"><span className="text-[9px] uppercase text-slate-500 font-black">Total</span><div className="text-sm font-black text-amber-400 mt-1">R$ {(order?.total || 0).toFixed(2)}</div></div>
                    </div>

                    <div className="rounded-2xl border border-slate-800 bg-[#0A0F18] overflow-hidden">
                      <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between"><span className="text-xs font-black uppercase text-white">Comanda</span><span className="text-[10px] text-slate-500">{order?.id || 'Sem pedido'}</span></div>
                      <div className="max-h-[300px] overflow-y-auto p-3 space-y-2">
                        {tableItems.length ? tableItems.map((item, idx) => (
                          <div key={`${item.name}-${idx}`} className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-[#121927] border border-slate-800">
                            <div className="min-w-0"><div className="text-xs font-black text-white truncate">{item.quantity}x {item.name}</div><div className="text-[10px] text-slate-500">{item.station || 'produção'}</div></div>
                            <span className="text-xs font-mono font-black text-amber-400">R$ {(item.totalPrice || item.unitPrice * item.quantity).toFixed(2)}</span>
                          </div>
                        )) : <div className="py-10 text-center text-xs text-slate-500">Nenhum item lançado nesta mesa.</div>}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="shrink-0 border-t border-slate-800 bg-[#0B1019] px-4 sm:px-6 py-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
                <div className="text-sm font-black text-white">TOTAL: <span className="text-amber-400 font-mono">R$ {(order?.total || 0).toFixed(2)}</span></div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => { setSelectedTable(table); setTableModalOption(null); setCurrentScreen('cardapio'); }} className="px-4 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-xs font-black">Adicionar Itens</button>
                  <button type="button" disabled={!order} onClick={() => { setSelectedTable(table); setTableModalOption(null); setCurrentScreen('fechamento'); }} className="px-5 py-2 rounded-xl bg-amber-500 text-slate-950 text-xs font-black uppercase disabled:opacity-40">Cobrar Mesa</button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ========================================================================= */}
      {/* 7B. MODAL CADASTRO DE MESAS */}
      {/* ========================================================================= */}
      {showTableManagerModal && (
        <div className="modal-viewport fixed inset-0 z-[90] bg-black/92 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-hidden">
          <div className="w-full max-w-3xl max-h-[94dvh] bg-[#101622] border border-slate-700 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
            <div className="shrink-0 p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between"><div><h3 className="text-lg font-black text-white">Cadastro de Mesas</h3><p className="text-[11px] text-slate-500">Inclua, exclua e atualize os números sem sair do PDV.</p></div><button type="button" onClick={() => setShowTableManagerModal(false)} className="w-10 h-10 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center"><X className="w-5 h-5" /></button></div>
            <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
              <div className="flex flex-col sm:flex-row gap-2"><input value={newTableNumber} onChange={(e) => setNewTableNumber(e.target.value.replace(/\D/g, ''))} onKeyDown={(e) => e.key === 'Enter' && addTableToDraft()} inputMode="numeric" placeholder="Número da nova mesa" className="flex-1 px-4 py-3 rounded-xl bg-[#0A0F18] border border-slate-700 text-white outline-none focus:border-amber-400" /><button type="button" onClick={addTableToDraft} className="px-5 py-3 rounded-xl bg-amber-500 text-slate-950 font-black text-xs uppercase"><Plus className="w-4 h-4 inline mr-1" /> Incluir</button></div>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                {tableDraft.map((table) => (
                  <div key={table} className="rounded-xl border border-slate-800 bg-[#0B1019] p-2 flex items-center justify-between gap-2">
                    {editingTableNumber === table ? <input autoFocus value={editingTableValue} onChange={(e) => setEditingTableValue(e.target.value.replace(/\D/g, ''))} onKeyDown={(e) => e.key === 'Enter' && applyEditTable()} className="w-16 bg-slate-900 rounded-lg px-2 py-1 text-white text-sm font-mono" /> : <span className="font-black text-white">Mesa {table}</span>}
                    <div className="flex gap-1">
                      {editingTableNumber === table ? <button type="button" onClick={applyEditTable} className="w-7 h-7 rounded-lg bg-emerald-500 text-slate-950"><Check className="w-3.5 h-3.5 mx-auto" /></button> : <button type="button" onClick={() => startEditTable(table)} className="w-7 h-7 rounded-lg bg-slate-800 text-slate-300"><Edit3 className="w-3.5 h-3.5 mx-auto" /></button>}
                      <button type="button" onClick={() => removeTableFromDraft(table)} className="w-7 h-7 rounded-lg bg-red-500/10 text-red-300 border border-red-500/20"><Trash2 className="w-3.5 h-3.5 mx-auto" /></button>
                    </div>
                  </div>
                ))}
              </div>
              {!tableDraft.length && <div className="py-12 text-center rounded-2xl border border-dashed border-slate-700 text-slate-500 text-sm">Nenhuma mesa cadastrada. Adicione a primeira acima.</div>}
            </div>
            <div className="shrink-0 border-t border-slate-800 p-3 flex justify-end gap-2"><button type="button" onClick={() => setShowTableManagerModal(false)} className="px-4 py-2 text-xs font-bold text-slate-400">Cancelar</button><button type="button" onClick={saveTableManager} className="px-5 py-2 rounded-xl border border-amber-400 text-amber-300 text-xs font-black">Salvar alterações</button></div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 8. MODAL DE TROCAR MESA RÁPIDO */}
      {/* ========================================================================= */}
      {showSwitchTableModal && (
        <div className="modal-viewport fixed inset-0 z-50 bg-black/95 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#121622] border border-slate-800 rounded-3xl max-w-sm w-full max-h-[92vh] overflow-y-auto p-5 shadow-2xl space-y-4 animate-fadeIn my-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-black text-white">Trocar Mesa de Atendimento</h3>
              <button
                type="button"
                onClick={() => setShowSwitchTableModal(false)}
                className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800/60"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Selecione o novo número de mesa para continuar o atendimento:
            </p>

            <div className="grid grid-cols-4 gap-2 max-h-64 overflow-y-auto pr-1">
              {tableNumbers.map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => {
                    setSelectedTable(num);
                    setShowSwitchTableModal(false);
                    showToast(`Mesa trocada para ${num}`, 'info');
                  }}
                  className={`py-2.5 rounded-xl font-bold font-mono text-xs border transition-all ${
                    selectedTable === num
                      ? 'bg-amber-500 text-slate-950 border-amber-300 font-black'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                  }`}
                >
                  {num}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 9. MODAL DE IMPRESSÃO TÉRMICA */}
      {/* ========================================================================= */}
      {showPrintModal && currentTableOrder && (
        <ThermalTicketModal
          order={currentTableOrder}
          restaurant={restaurant}
          onClose={() => setShowPrintModal(false)}
        />
      )}
    </div>
  );
};
