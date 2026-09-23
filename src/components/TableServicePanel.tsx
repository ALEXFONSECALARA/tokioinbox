import React, { useState, useMemo, useEffect } from 'react';
import { useServerDoc } from '../painel/useServerDoc';
import { useStore } from '../context/StoreContext';
import { Order, MenuItem, RestaurantSlug } from '../types/restaurant';
import {
  Utensils,
  Lock,
  Unlock,
  Users,
  Clock,
  Plus,
  Receipt,
  CheckCircle2,
  AlertCircle,
  Search,
  Printer,
  ChevronRight,
  ArrowLeft,
  X,
  Coffee,
  Wine,
  Sparkles,
  DollarSign,
  Share2,
  Trash2,
  Shield,
  ChefHat,
  QrCode,
  Bell,
  ArrowRightLeft,
  CreditCard,
  Banknote,
  History,
  Smartphone,
} from 'lucide-react';
import { BRAND_NAME } from '../config/brand';
import { getRestaurantPath, getQrCodeImageUrl } from '../utils/urlRouting';
import { playAlertSound } from '../utils/audioAlert';

interface TableServicePanelProps {
  onBackToApp: () => void;
  onOpenAdmin?: () => void;
}

interface TableState {
  id: number;
  capacity: number;
  label: string;
  customerName?: string;
  peopleCount?: number;
  openedAt?: string;
  notes?: string;
}

const INITIAL_TABLES: TableState[] = [];

export const TableServicePanel: React.FC<TableServicePanelProps> = ({
  onBackToApp,
  onOpenAdmin,
}) => {
  const {
    orders,
    menuItems,
    categories,
    restaurants,
    activeRestaurantSlug,
    currentUser,
    loginUser,
    updateOrderStatus,
    showToast,
    soundSettings,
    updateRestaurantConfig,
  } = useStore();

  // Authentication State
  // O acesso ao painel já exige login no servidor; o "bloqueio de tela" só pede a senha
  // do PRÓPRIO usuário logado (validada no servidor). Nenhuma senha/PIN fixo no navegador.
  const [isUnlocked, setIsUnlocked] = useState<boolean>(true);

  // PIN / Password inputs
  const [enteredPin, setEnteredPin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [passwordMode, setPasswordMode] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');

  // Table Management State
  // Mesas, chamados e histórico do turno: documentos compartilhados no servidor (todos os aparelhos do salão veem o mesmo)
  const [tables, setTables] = useServerDoc<TableState[]>('salonTables', INITIAL_TABLES, { enabled: true, onError: (m) => showToast(m, 'error') });

  const [activeTableId, setActiveTableId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'livre' | 'ocupada' | 'preparando' | 'conta'>('all');
  const [tableRangeFilter, setTableRangeFilter] = useState<'all' | '1-15' | '16-30'>('all');
  const [activeTab, setActiveTab] = useState<'pedidos' | 'lancar' | 'conta'>('pedidos');

  // New Item Tray State for active table
  const [trayItems, setTrayItems] = useState<{ menuItem: MenuItem; quantity: number; notes: string }[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchItemFilter, setSearchItemFilter] = useState('');
  const [tableServicePeople, setTableServicePeople] = useState(2);
  const [includeServiceFee, setIncludeServiceFee] = useState(true);
  const [splitCount, setSplitCount] = useState(2);
  const [isSendingOrder, setIsSendingOrder] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);

  // New Features: QR Code Stand, Waiter Calls, Transfer, Payment & Shift History
  const [showQrPlatesModal, setShowQrPlatesModal] = useState(false);
  const [selectedQrTable, setSelectedQrTable] = useState<number>(1);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferTargetTable, setTransferTargetTable] = useState<number>(1);
  const [showShiftHistoryModal, setShowShiftHistoryModal] = useState(false);
  const [showTableManager, setShowTableManager] = useState(false);
  const [tableDraft, setTableDraft] = useState<number[]>([]);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'pix' | 'cartao_credito' | 'cartao_debito' | 'dinheiro'>('pix');
  const [cashReceived, setCashReceived] = useState('');
  const [tableQrUrl, setTableQrUrl] = useState<string | null>(null);
  const [isLoadingTableQr, setIsLoadingTableQr] = useState(false);
  
  // Waiter Calls tracking
  const [waiterCalls, setWaiterCalls] = useServerDoc<Record<number, { timestamp: number; table: number }>>('waiterCalls', {}, { enabled: true, onError: (m) => showToast(m, 'error') });

  // Shift History of closed tables
  type ShiftHistoryItem = { id: string; tableId: number; total: number; closedAt: string; paymentMethod: string; waiter: string };
  const [shiftHistory, setShiftHistory] = useServerDoc<ShiftHistoryItem[]>('salonShiftHistory', [], { enabled: true, onError: (m) => showToast(m, 'error') });

  const handleAcknowledgeCall = (tableNum: number) => {
    setWaiterCalls((prev) => {
      const copy = { ...prev };
      delete copy[tableNum];
      return copy;
    });
    showToast(`Chamado da Mesa ${tableNum} atendido!`, 'info');
  };

  const restaurant = restaurants[activeRestaurantSlug] || Object.values(restaurants)[0];

  // Sincroniza o cadastro de mesas do restaurante com o estado operacional do salão.
  // Não cria mesas fictícias fora do cadastro: usa exatamente as mesas configuradas.
  useEffect(() => {
    const configured = Array.isArray(restaurant?.activeTables)
      ? restaurant.activeTables.filter((n) => Number.isInteger(n) && n > 0)
      : [];
    // O salão inicia com 30 mesas padrão (1 a 30), preservando mesas adicionais
    // que já tenham pedidos ativos para evitar qualquer perda de dados.
    const defaultTables = Array.from({ length: 30 }, (_, i) => i + 1);
    const normalized = Array.from(new Set([...defaultTables, ...configured])).sort((a, b) => a - b);
    if (!normalized.length) return;
    setTables((prev) => {
      const byId = new Map(prev.map((t) => [t.id, t]));
      const next = normalized.map((id) => byId.get(id) || ({ id, capacity: 4, label: `Mesa ${id}` } as TableState));
      const same = prev.length === next.length && prev.every((t, i) => t.id === next[i].id);
      return same ? prev : next;
    });
  }, [restaurant?.activeTables, setTables]);

  const restaurantMenuItems = useMemo(
    () => menuItems.filter((item) => item.restaurantSlug === restaurant?.slug),
    [menuItems, restaurant?.slug]
  );
  const restaurantCategories = useMemo(
    () => categories.filter((cat) => cat.restaurantSlug === restaurant?.slug),
    [categories, restaurant?.slug]
  );

  useEffect(() => {
    setCategoryFilter('all');
    setSearchItemFilter('');
    setTrayItems([]);
    setActiveTableId(null);
    setSelectedQrTable(1);
  }, [activeRestaurantSlug]);

  useEffect(() => {
    if (!showQrPlatesModal) return;
    let cancelled = false;
    const loadTableQr = async () => {
      if (!restaurant?.slug || !selectedQrTable || !currentUser?.token) {
        setTableQrUrl(null);
        return;
      }
      setIsLoadingTableQr(true);
      try {
        const res = await fetch(`/api/table/access-token?slug=${encodeURIComponent(restaurant.slug)}&table=${selectedQrTable}`, {
          headers: { Authorization: `Bearer ${currentUser.token}` },
        });
        const data = await res.json();
        if (!res.ok || !data.success || !data.token) throw new Error(data.error || 'Não foi possível gerar o QR da mesa.');
        if (!cancelled) {
          const path = `${getRestaurantPath(restaurant)}/mesa/${selectedQrTable}`;
          const url = `${window.location.origin}${path}?mesa_token=${encodeURIComponent(data.token)}`;
          setTableQrUrl(url);
        }
      } catch (err: any) {
        if (!cancelled) {
            setTableQrUrl(null);
          showToast(err?.message || 'Falha ao gerar QR Code seguro da mesa.', 'error');
        }
      } finally {
        if (!cancelled) setIsLoadingTableQr(false);
      }
    };
    loadTableQr();
    return () => { cancelled = true; };
  }, [showQrPlatesModal, selectedQrTable, restaurant?.slug, currentUser?.token, showToast]);

  // Orders associated with each table
  const tableOrdersMap = useMemo(() => {
    const map: Record<number, Order[]> = {};
    for (const order of orders) {
      if (order.restaurantSlug !== activeRestaurantSlug) continue;
      if (order.orderType === 'mesa' && order.tableNumber) {
        if (!map[order.tableNumber]) {
          map[order.tableNumber] = [];
        }
        map[order.tableNumber].push(order);
      }
    }
    return map;
  }, [orders, activeRestaurantSlug]);

  // Calculate table dynamic status and totals
  const getTableStatus = (tableId: number) => {
    const tableOrders = tableOrdersMap[tableId] || [];
    const activeOrders = tableOrders.filter((o) => o.status !== 'entregue' && o.status !== 'cancelado');

    if (activeOrders.length === 0) {
      return 'livre';
    }
    if (activeOrders.some((o) => o.status === 'recebido' || o.status === 'em_preparo')) {
      return 'preparando';
    }
    if (activeOrders.some((o) => o.notes?.toLowerCase().includes('conta') || o.notes?.toLowerCase().includes('fechar'))) {
      return 'conta';
    }
    return 'ocupada';
  };

  const getTableTotal = (tableId: number) => {
    const tableOrders = tableOrdersMap[tableId] || [];
    const activeOrders = tableOrders.filter((o) => o.status !== 'cancelado');
    return activeOrders.reduce((sum, order) => sum + (order.total || 0), 0);
  };

  // PIN validation
  const handleKeypadPress = (val: string) => {
    setPinError(null);
    if (enteredPin.length < 4) {
      const next = enteredPin + val;
      setEnteredPin(next);
      if (next.length === 4) {
        validatePin(next);
      }
    }
  };

  const handleBackspace = () => {
    setEnteredPin((prev) => prev.slice(0, -1));
    setPinError(null);
  };

  const validatePin = (_pinToTest: string) => {
    setPinError('PIN local desativado. Use a senha do seu usuário para desbloquear.');
    setEnteredPin('');
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError(null);
    const pass = passwordInput.trim();
    if (!currentUser || !pass) {
      setPinError('Informe a senha do seu usuário.');
      return;
    }
    const res = await loginUser(currentUser.username, pass);
    if (res.success) {
      setIsUnlocked(true);
      showToast('Painel do salão desbloqueado!', 'success');
      setPasswordInput('');
    } else {
      setPinError(res.error || 'Senha inválida.');
    }
  };

  const handleLockPanel = () => {
    setIsUnlocked(false);
    setActiveTableId(null);
    showToast('Painel do salão bloqueado com segurança.', 'info');
  };

  // Quick Open Table
  const handleOpenTable = (tableId: number) => {
    setActiveTableId(tableId);
    setActiveTab('lancar');
    setTrayItems([]);
  };

  // Add Item to Waiter Tray
  const handleAddToTray = (item: MenuItem) => {
    setTrayItems((prev) => {
      const existingIdx = prev.findIndex((t) => t.menuItem.id === item.id);
      if (existingIdx >= 0) {
        const next = [...prev];
        next[existingIdx].quantity += 1;
        return next;
      }
      return [...prev, { menuItem: item, quantity: 1, notes: '' }];
    });
    showToast(`+1 ${item.name}`, 'info');
  };

  const handleUpdateTrayQty = (index: number, delta: number) => {
    setTrayItems((prev) => {
      const next = [...prev];
      const newQty = next[index].quantity + delta;
      if (newQty <= 0) {
        return next.filter((_, i) => i !== index);
      }
      next[index].quantity = newQty;
      return next;
    });
  };

  const handleUpdateTrayNotes = (index: number, notes: string) => {
    setTrayItems((prev) => {
      const next = [...prev];
      next[index].notes = notes;
      return next;
    });
  };

  // Submit Tray Order to Kitchen
  const handleSendOrderToKitchen = async () => {
    if (!activeTableId || trayItems.length === 0) return;

    setIsSendingOrder(true);
    try {
      const activeRest = restaurants[activeRestaurantSlug] || restaurants.japones;
      const subtotal = trayItems.reduce((acc, t) => acc + t.menuItem.price * t.quantity, 0);

      const itemsPayload = trayItems.map((t) => ({
        id: `table-item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        name: t.menuItem.name,
        quantity: t.quantity,
        unitPrice: t.menuItem.price,
        totalPrice: t.menuItem.price * t.quantity,
        notes: t.notes || undefined,
      }));

      const payload = {
        restaurantSlug: activeRestaurantSlug,
        restaurantName: activeRest.name,
        customerName: `Mesa ${String(activeTableId).padStart(2, '0')}`,
        customerPhone: '(Salão Presencial)',
        orderType: 'mesa',
        tableNumber: activeTableId,
        items: itemsPayload,
        subtotal,
        deliveryFee: 0,
        discount: 0,
        total: subtotal,
        paymentMethod: 'presencial',
        paymentDetails: { paid: false },
        notes: `Comanda presencial lançada por Garçom (Mesa ${activeTableId})`,
        idempotencyKey: `mesa-${activeTableId}-${Date.now()}`,
      };

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error('Falha ao gravar pedido da mesa no servidor');
      }

      const data = await res.json();
      if (data.order) {
        if (soundSettings.enabled) {
          playAlertSound(soundSettings.soundType, soundSettings.volume);
        }
        setTrayItems([]);
        setActiveTab('pedidos');
        showToast(`Pedido enviado para a Cozinha! Mesa ${activeTableId}`, 'success');
      }
    } catch (e: any) {
      console.error(e);
      showToast('Erro ao enviar pedido para a cozinha', 'error');
    } finally {
      setIsSendingOrder(false);
    }
  };

  // Close and Free Table
  const handleCloseTable = async (tableId: number) => {
    const tableOrders = tableOrdersMap[tableId] || [];
    const activeOrders = tableOrders.filter((o) => o.status !== 'entregue' && o.status !== 'cancelado');

    if (activeOrders.length === 0) {
      setActiveTableId(null);
      showToast(`Mesa ${tableId} liberada.`, 'info');
      return;
    }

    const totalToClose = includeServiceFee ? activeTableSubtotal * 1.1 : activeTableSubtotal;

    if (confirm(`Confirmar fechamento e liberação da Mesa ${tableId}? Total: R$ ${totalToClose.toFixed(2)} via ${selectedPaymentMethod.toUpperCase()}.`)) {
      for (const order of activeOrders) {
        await updateOrderStatus(order.id, 'entregue', `Conta fechada via ${selectedPaymentMethod} e mesa liberada pelo garçom`);
      }

      // Record in Shift History
      const historyItem = {
        id: `shift-${Date.now()}`,
        tableId,
        total: totalToClose,
        closedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        paymentMethod: selectedPaymentMethod,
        waiter: currentUser?.name || 'Garçom Salão',
      };
      setShiftHistory((prev) => [historyItem, ...prev]);

      setActiveTableId(null);
      showToast(`Mesa ${tableId} fechada e liberada com sucesso!`, 'success');
    }
  };

  // Transfer Active Orders to another Table
  const handleTransferTable = async (fromTable: number, toTable: number) => {
    if (fromTable === toTable) {
      showToast('A mesa de destino deve ser diferente da mesa atual.', 'error');
      return;
    }
    const tableOrders = tableOrdersMap[fromTable] || [];
    const activeOrders = tableOrders.filter((o) => o.status !== 'entregue' && o.status !== 'cancelado');
    if (activeOrders.length === 0) {
      showToast(`Mesa ${fromTable} não possui pedidos ativos para transferir.`, 'info');
      return;
    }

    try {
      for (const order of activeOrders) {
        await fetch(`/api/orders/${order.id}/table`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tableNumber: toTable }),
        });
      }
      setShowTransferModal(false);
      setActiveTableId(toTable);
      showToast(`Comanda transferida da Mesa ${fromTable} para a Mesa ${toTable}!`, 'success');
    } catch (e) {
      showToast('Erro ao transferir comanda de mesa', 'error');
    }
  };

  // Generate instant test order for the active table
  const handleGenerateTestOrderForTable = async (tableNum: number) => {
    try {
      const activeRest = restaurants[activeRestaurantSlug] || restaurants.japones;
      const sampleItem = restaurantMenuItems[0];
      const sampleDrink = restaurantMenuItems.find((m) => m.categoryId === 'bebidas') || restaurantMenuItems[1] || restaurantMenuItems[0];
      
      const payload = {
        restaurantSlug: activeRestaurantSlug,
        restaurantName: activeRest.name,
        customerName: `Mesa ${String(tableNum).padStart(2, '0')}`,
        customerPhone: '(Salão Presencial)',
        orderType: 'mesa',
        tableNumber: tableNum,
        items: [
          {
            id: `test-m-${Date.now()}-1`,
            name: sampleItem.name,
            quantity: 2,
            unitPrice: sampleItem.price,
            totalPrice: sampleItem.price * 2,
            notes: 'Ponto ao ponto (Pedido Teste)',
          },
          {
            id: `test-m-${Date.now()}-2`,
            name: sampleDrink.name,
            quantity: 1,
            unitPrice: sampleDrink.price,
            totalPrice: sampleDrink.price,
            notes: 'Com gelo e limão',
          },
        ],
        subtotal: sampleItem.price * 2 + sampleDrink.price,
        deliveryFee: 0,
        discount: 0,
        total: sampleItem.price * 2 + sampleDrink.price,
        paymentMethod: 'presencial',
        paymentDetails: { paid: false },
        notes: `Comanda de teste lançada no Salão (Mesa ${tableNum})`,
        idempotencyKey: `mesa-test-${tableNum}-${Date.now()}`,
      };

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        showToast(`Pedido de teste lançado com sucesso na Mesa ${tableNum}!`, 'success');
      }
    } catch (e) {
      showToast('Erro ao criar pedido de teste', 'error');
    }
  };

  // Active table calculations
  const activeTableOrders = activeTableId ? tableOrdersMap[activeTableId] || [] : [];
  const activeTableSubtotal = activeTableId ? getTableTotal(activeTableId) : 0;
  const serviceFeeValue = includeServiceFee ? activeTableSubtotal * 0.1 : 0;
  const activeTableGrandTotal = activeTableSubtotal + serviceFeeValue;
  const perPersonTotal = splitCount > 0 ? activeTableGrandTotal / splitCount : activeTableGrandTotal;

  // Render Lock Screen if not authenticated
  if (!isUnlocked) {
    return (
      <div className="h-full bg-[#07090E] text-slate-100 flex flex-col justify-center items-center p-4 selection:bg-amber-500 selection:text-black">
        <div className="w-full max-w-md bg-stone-900/90 backdrop-blur-2xl border border-stone-800 rounded-3xl p-6 sm:p-8 shadow-[0_20px_60px_rgba(0,0,0,0.8)] text-center space-y-6">
          {/* Header */}
          <div className="space-y-2">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-600 to-amber-400 text-stone-950 flex items-center justify-center mx-auto shadow-lg shadow-amber-500/20">
              <Utensils className="w-8 h-8" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-amber-400 tracking-wide">
              Serviço Físico de Mesas
            </h1>
            <p className="text-xs text-stone-400">
              Atendimento presencial e gestão de salão exclusivo para colaboradores
            </p>
          </div>

          {/* PIN Display or Password Form */}
          {!passwordMode ? (
            <div className="space-y-6">
              {/* Dots representation */}
              <div className="flex justify-center items-center gap-4 py-3 bg-stone-950/70 rounded-2xl border border-stone-800">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className={`w-4 h-4 rounded-full transition-all duration-200 ${
                      enteredPin.length > i
                        ? 'bg-amber-400 scale-110 shadow-[0_0_10px_rgba(251,191,36,0.8)]'
                        : 'bg-stone-700'
                    }`}
                  />
                ))}
              </div>

              {pinError && (
                <p className="text-xs font-semibold text-rose-400 flex items-center justify-center gap-1.5 animate-shake">
                  <AlertCircle className="w-4 h-4" /> {pinError}
                </p>
              )}

              {/* Touch Keypad */}
              <div className="grid grid-cols-3 gap-3">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => handleKeypadPress(num)}
                    className="min-h-[52px] rounded-2xl bg-stone-800/80 hover:bg-stone-700 active:bg-amber-500 active:text-stone-950 font-black text-lg text-slate-100 border border-stone-700/60 shadow-sm transition-all"
                  >
                    {num}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={handleBackspace}
                  className="min-h-[52px] rounded-2xl bg-stone-800/40 hover:bg-stone-800 text-stone-400 font-bold text-xs border border-stone-800 transition-all flex items-center justify-center"
                >
                  Apagar
                </button>
                <button
                  type="button"
                  onClick={() => handleKeypadPress('0')}
                  className="min-h-[52px] rounded-2xl bg-stone-800/80 hover:bg-stone-700 active:bg-amber-500 active:text-stone-950 font-black text-lg text-slate-100 border border-stone-700/60 shadow-sm transition-all"
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={() => validatePin(enteredPin)}
                  className="min-h-[52px] rounded-2xl bg-amber-500 hover:bg-amber-400 active:scale-95 text-stone-950 font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center shadow-md shadow-amber-500/20"
                >
                  Entrar
                </button>
              </div>

              {/* Default PIN Helper Badge */}
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-2.5 text-[11px] text-amber-300 font-medium">
                💡 <span className="font-bold">PIN de Demonstração:</span> 1234
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-stone-800 text-xs text-stone-400">
                <button
                  type="button"
                  onClick={() => setPasswordMode(true)}
                  className="hover:text-amber-400 underline underline-offset-4"
                >
                  Entrar com Senha
                </button>
                <button
                  type="button"
                  onClick={onBackToApp}
                  className="hover:text-stone-200"
                >
                  Voltar ao Cardápio
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div className="text-left space-y-1">
                <label className="text-xs font-semibold text-stone-300">
                  Senha do seu usuário:
                </label>
                <input
                  type="password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="Senha do seu usuário"
                  className="w-full px-4 py-3 rounded-xl bg-stone-950 border border-stone-700 text-white focus:outline-none focus:border-amber-400 text-sm"
                  autoFocus
                />
              </div>

              {pinError && (
                <p className="text-xs font-semibold text-rose-400 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4" /> {pinError}
                </p>
              )}

              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-black text-sm uppercase tracking-wider transition-all shadow-md shadow-amber-500/20"
              >
                Acessar Salão
              </button>

              <div className="flex items-center justify-between text-xs text-stone-400 pt-2 border-t border-stone-800">
                <button
                  type="button"
                  onClick={() => setPasswordMode(false)}
                  className="hover:text-amber-400 underline underline-offset-4"
                >
                  Usar PIN Numérico (4 dígitos)
                </button>
                <button
                  type="button"
                  onClick={onBackToApp}
                  className="hover:text-stone-200"
                >
                  Voltar ao Cardápio
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    );
  }

  // Active Tables Count Statistics
  const totalTables = tables.length;
  const occupiedTables = tables.filter((t) => getTableStatus(t.id) === 'ocupada').length;
  const kitchenTables = tables.filter((t) => getTableStatus(t.id) === 'preparando').length;
  const billingTables = tables.filter((t) => getTableStatus(t.id) === 'conta').length;
  const freeTables = totalTables - (occupiedTables + kitchenTables + billingTables);
  const salonRevenue = tables.reduce((acc, t) => acc + getTableTotal(t.id), 0);

  // Filtered tables for the grid (Mesas 1 a 50 com filtro de zonas)
  const filteredTables = tables.filter((table) => {
    const status = getTableStatus(table.id);
    if (statusFilter !== 'all' && status !== statusFilter) return false;
    if (tableRangeFilter === '1-15' && (table.id < 1 || table.id > 15)) return false;
    if (tableRangeFilter === '16-30' && (table.id < 16 || table.id > 30)) return false;
    return true;
  });

  const openTableManager = () => {
    const configured = Array.isArray(restaurant?.activeTables) ? restaurant.activeTables : [];
    const normalized = Array.from(new Set(configured.filter((n) => Number.isInteger(n) && n > 0))).sort((a, b) => a - b);
    setTableDraft(normalized.length ? normalized : Array.from({ length: 30 }, (_, i) => i + 1));
    setShowTableManager(true);
  };

  const saveTableManager = () => {
    if (!restaurant?.slug) return;
    const next = Array.from(new Set(tableDraft.filter((n) => Number.isInteger(n) && n > 0 && n <= 999))).sort((a, b) => a - b);
    if (!next.length) {
      showToast('Cadastre pelo menos uma mesa.', 'warning');
      return;
    }
    updateRestaurantConfig(restaurant.slug, { activeTables: next });
    setShowTableManager(false);
    showToast(`${next.length} mesas cadastradas com sucesso.`, 'success');
  };

  return (
    <div className="h-full bg-[#07090E] text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-black overflow-hidden">
      {/* Top Header Bar for Table Service */}
      <header className="sticky top-0 z-30 bg-[#0B0907]/95 backdrop-blur-xl border-b border-stone-800 px-4 py-3 shadow-lg">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onBackToApp}
              className="p-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-stone-300 border border-stone-800 transition-colors"
              title="Voltar ao Cardápio"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <button
              onClick={openTableManager}
              className="px-3 py-2 rounded-xl bg-amber-500/15 text-amber-300 border border-amber-500/30 text-xs font-black hover:bg-amber-500/25 transition-colors"
              title="Cadastrar e configurar mesas"
            >
              <span className="hidden sm:inline">Cadastro de Mesas</span>
              <span className="sm:hidden">Mesas</span>
            </button>
            <div className="w-10 h-10 rounded-xl bg-stone-800 border border-amber-500/30 flex items-center justify-center overflow-hidden shadow-md">
              {restaurant?.logo ? (
                <img src={restaurant.logo} alt={restaurant.name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-xl font-black text-amber-400">{restaurant?.emoji || '🍣'}</span>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-black text-white">
                  {restaurant?.name || 'Restaurante'}
                </h1>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 text-[10px] font-black uppercase tracking-wider border border-emerald-500/30">
                  Salão Ativo
                </span>
              </div>
              <p className="text-xs text-stone-400">
                Cardápio exclusivo desta casa • Operação Presencial de Garçons
              </p>
            </div>
          </div>

          {/* Quick Metrics Header */}
          <div className="hidden md:flex items-center gap-4 text-xs font-semibold">
            <div className="px-3 py-1.5 rounded-xl bg-stone-900 border border-stone-800 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span className="text-stone-300">{freeTables} Livres</span>
            </div>
            <div className="px-3 py-1.5 rounded-xl bg-stone-900 border border-stone-800 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              <span className="text-stone-300">{occupiedTables} Ocupadas</span>
            </div>
            <div className="px-3 py-1.5 rounded-xl bg-stone-900 border border-stone-800 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 animate-pulse" />
              <span className="text-stone-300">{kitchenTables} Na Cozinha</span>
            </div>
            <div className="px-3 py-1.5 rounded-xl bg-stone-900 border border-stone-800 text-amber-400 font-bold">
              Consumo Salão: R$ {salonRevenue.toFixed(2)}
            </div>
          </div>

          {/* Actions: Placas QR, Histórico, Lock, Switch Admin */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowQrPlatesModal(true)}
              className="px-3 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-stone-300 text-xs font-semibold border border-stone-700 flex items-center gap-1.5 transition-colors"
              title="Gerar e Imprimir Placas QR Code das Mesas"
            >
              <QrCode className="w-4 h-4 text-amber-400" />
              <span className="hidden sm:inline">Placas QR</span>
            </button>

            <button
              onClick={() => setShowShiftHistoryModal(true)}
              className="px-3 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-stone-300 text-xs font-semibold border border-stone-700 flex items-center gap-1.5 transition-colors"
              title="Ver Histórico de Mesas Fechadas Hoje"
            >
              <History className="w-4 h-4 text-amber-400" />
              <span className="hidden sm:inline">Turno ({shiftHistory.length})</span>
            </button>

            {onOpenAdmin && (
              <button
                onClick={onOpenAdmin}
                className="px-3 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-stone-300 text-xs font-semibold border border-stone-700 flex items-center gap-1.5 transition-colors"
                title="Ir para o Painel Administrativo Geral"
              >
                <ChefHat className="w-4 h-4 text-amber-400" />
                <span className="hidden sm:inline">KDS / Admin</span>
              </button>
            )}
            <button
              onClick={handleLockPanel}
              className="px-3 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-bold flex items-center gap-1.5 transition-colors"
              title="Bloquear painel com senha"
            >
              <Lock className="w-4 h-4" />
              <span className="hidden sm:inline">Bloquear Salão</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Body */}
      <main className="max-w-7xl mx-auto w-full p-4 sm:p-6 space-y-6 flex-1 min-h-0 overflow-y-auto">
        {/* Active Waiter Calls Alert Strip */}
        {Object.keys(waiterCalls).length > 0 && (
          <div className="bg-gradient-to-r from-rose-950 via-rose-900 to-amber-950 border border-rose-500/60 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 animate-pulse shadow-xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500 text-white flex items-center justify-center font-black shadow-lg">
                <Bell className="w-6 h-6 animate-bounce" />
              </div>
              <div>
                <h4 className="text-sm font-black text-rose-100 uppercase tracking-wider flex items-center gap-2">
                  <span>{Object.keys(waiterCalls).length} Chamado(s) de Garçom Ativo(s)!</span>
                </h4>
                <p className="text-xs text-rose-300">
                  Mesas solicitando atenção:{' '}
                  <strong>{Object.keys(waiterCalls).map((m) => `Mesa ${m}`).join(', ')}</strong>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {Object.keys(waiterCalls).map((tNum) => (
                <button
                  key={tNum}
                  onClick={() => {
                    handleAcknowledgeCall(Number(tNum));
                    setActiveTableId(Number(tNum));
                  }}
                  className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black flex items-center gap-1.5 shadow"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Atender Mesa {tNum}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        {/* Filters Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-stone-900/60 p-3 rounded-2xl border border-stone-800/80">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                statusFilter === 'all'
                  ? 'bg-amber-500 text-stone-950 shadow-sm'
                  : 'bg-stone-800/80 text-stone-300 hover:text-white'
              }`}
            >
              Todas ({totalTables})
            </button>
            <button
              onClick={() => setStatusFilter('livre')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                statusFilter === 'livre'
                  ? 'bg-emerald-500 text-stone-950 shadow-sm'
                  : 'bg-stone-800/80 text-stone-300 hover:text-white'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              Livres ({freeTables})
            </button>
            <button
              onClick={() => setStatusFilter('ocupada')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                statusFilter === 'ocupada'
                  ? 'bg-amber-500 text-stone-950 shadow-sm'
                  : 'bg-stone-800/80 text-stone-300 hover:text-white'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              Ocupadas ({occupiedTables})
            </button>
            <button
              onClick={() => setStatusFilter('preparando')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                statusFilter === 'preparando'
                  ? 'bg-cyan-500 text-stone-950 shadow-sm'
                  : 'bg-stone-800/80 text-stone-300 hover:text-white'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
              Cozinha ({kitchenTables})
            </button>
            <button
              onClick={() => setStatusFilter('conta')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                statusFilter === 'conta'
                  ? 'bg-purple-500 text-white shadow-sm'
                  : 'bg-stone-800/80 text-stone-300 hover:text-white'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-purple-400" />
              Conta ({billingTables})
            </button>
          </div>

          {/* Quick Zone / Range Selector for 50 Tables */}
          <div className="flex items-center gap-1.5 bg-stone-950/80 px-2.5 py-1 rounded-xl border border-stone-800 text-xs">
            <span className="text-[11px] font-bold text-stone-400 mr-1">Faixa:</span>
            <button
              onClick={() => setTableRangeFilter('all')}
              className={`px-2 py-0.5 rounded-lg text-[11px] font-semibold transition-colors ${
                tableRangeFilter === 'all' ? 'bg-amber-400 text-black font-bold' : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              Todas (1-30)
            </button>
            <button
              onClick={() => setTableRangeFilter('1-15')}
              className={`px-2 py-0.5 rounded-lg text-[11px] font-semibold transition-colors ${
                tableRangeFilter === '1-15' ? 'bg-amber-400 text-black font-bold' : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              1 a 15
            </button>
            <button
              onClick={() => setTableRangeFilter('16-30')}
              className={`px-2 py-0.5 rounded-lg text-[11px] font-semibold transition-colors ${
                tableRangeFilter === '16-30' ? 'bg-amber-400 text-black font-bold' : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              16 a 30
            </button>
          </div>
        </div>

        {/* Tables Grid (01 to 30+) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {filteredTables.map((table) => {
            const status = getTableStatus(table.id);
            const total = getTableTotal(table.id);
            const tableOrders = tableOrdersMap[table.id] || [];
            const activeOrders = tableOrders.filter((o) => o.status !== 'entregue' && o.status !== 'cancelado');
            const totalItemsCount = activeOrders.reduce(
              (acc, o) => acc + o.items.reduce((s, it) => s + it.quantity, 0),
              0
            );

            // Status Card Colors
            const borderColors = {
              livre: 'border-stone-800 hover:border-emerald-500/60 bg-stone-900/40',
              ocupada: 'border-amber-500/60 bg-amber-950/10 hover:border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.15)]',
              preparando: 'border-cyan-500/60 bg-cyan-950/10 hover:border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.15)]',
              conta: 'border-purple-500/60 bg-purple-950/10 hover:border-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.15)]',
            };

            const badgeStyles = {
              livre: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
              ocupada: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
              preparando: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30 animate-pulse',
              conta: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
            };

            const statusLabels = {
              livre: 'Livre',
              ocupada: 'Ocupada',
              preparando: 'Cozinha',
              conta: 'Aguardando Conta',
            };

            return (
              <div
                key={table.id}
                onClick={() => handleOpenTable(table.id)}
                className={`cursor-pointer rounded-2xl p-4 border transition-all duration-200 flex flex-col justify-between min-h-[160px] group ${borderColors[status]}`}
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-xl font-black text-white group-hover:text-amber-400 transition-colors">
                      {table.label}
                    </span>
                    <p className="text-[11px] text-stone-400 flex items-center gap-1 mt-0.5">
                      <Users className="w-3 h-3" />
                      {table.capacity} Lugares
                    </p>
                  </div>
                  <span
                    className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${badgeStyles[status]}`}
                  >
                    {statusLabels[status]}
                  </span>
                </div>

                {/* Middle info */}
                <div className="py-2">
                  {status === 'livre' ? (
                    <p className="text-xs text-stone-500 italic">Disponível para atendimento</p>
                  ) : (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-stone-400">{totalItemsCount} itens</span>
                        <span className="font-black text-amber-400">
                          R$ {total.toFixed(2)}
                        </span>
                      </div>
                      {activeOrders.length > 0 && (
                        <p className="text-[11px] text-stone-400 truncate">
                          {activeOrders[0].items.map((i) => `${i.quantity}x ${i.name}`).join(', ')}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Card Footer Actions */}
                <div className="pt-2 border-t border-stone-800/80 flex items-center justify-between text-xs">
                  {status === 'livre' ? (
                    <span className="text-emerald-400 font-bold group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                      <Plus className="w-3.5 h-3.5" /> Abrir Comanda
                    </span>
                  ) : (
                    <span className="text-amber-400 font-bold group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                      Comanda &gt;
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* Active Table Drawer / Modal */}
      {activeTableId && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex justify-end animate-fadeIn">
          <div className="w-full max-w-xl bg-stone-900 border-l border-stone-800 h-full flex flex-col shadow-2xl overflow-hidden">
            {/* Drawer Header */}
            <div className="p-4 sm:p-5 bg-stone-950 border-b border-stone-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-500 text-stone-950 flex items-center justify-center font-black text-lg shadow-md">
                  M{activeTableId}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-black text-white">
                      Mesa {String(activeTableId).padStart(2, '0')}
                    </h2>
                    <span className="px-2 py-0.5 rounded-full bg-stone-800 text-amber-400 text-xs font-bold">
                      {getTableStatus(activeTableId).toUpperCase()}
                    </span>
                  </div>
                  <p className="text-xs text-stone-400">
                    Consumo Atual: R$ {activeTableGrandTotal.toFixed(2)}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setActiveTableId(null)}
                className="p-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-stone-800 bg-stone-950/50 px-4 pt-2 gap-2">
              <button
                onClick={() => setActiveTab('pedidos')}
                className={`px-4 py-2.5 text-xs font-bold rounded-t-xl border-b-2 transition-all flex items-center gap-1.5 ${
                  activeTab === 'pedidos'
                    ? 'border-amber-500 text-amber-400 bg-stone-900'
                    : 'border-transparent text-stone-400 hover:text-white'
                }`}
              >
                <Receipt className="w-4 h-4" />
                Consumo da Mesa ({activeTableOrders.length})
              </button>
              <button
                onClick={() => setActiveTab('lancar')}
                className={`px-4 py-2.5 text-xs font-bold rounded-t-xl border-b-2 transition-all flex items-center gap-1.5 ${
                  activeTab === 'lancar'
                    ? 'border-amber-500 text-amber-400 bg-stone-900'
                    : 'border-transparent text-stone-400 hover:text-white'
                }`}
              >
                <Plus className="w-4 h-4" />
                Lançar Pedidos {trayItems.length > 0 && `(${trayItems.length})`}
              </button>
              <button
                onClick={() => setActiveTab('conta')}
                className={`px-4 py-2.5 text-xs font-bold rounded-t-xl border-b-2 transition-all flex items-center gap-1.5 ${
                  activeTab === 'conta'
                    ? 'border-amber-500 text-amber-400 bg-stone-900'
                    : 'border-transparent text-stone-400 hover:text-white'
                }`}
              >
                <DollarSign className="w-4 h-4" />
                Pré-Conta &amp; Fechar
              </button>
            </div>

            {/* Quick Actions Bar for Active Table */}
            <div className="bg-stone-950/90 border-b border-stone-800 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleGenerateTestOrderForTable(activeTableId)}
                  className="px-2.5 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30 flex items-center gap-1.5 transition-colors"
                  title="Gera um pedido de teste imediato para simular a comanda"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>+ Testar Pedido</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setTransferTargetTable(activeTableId === 1 ? 2 : 1);
                    setShowTransferModal(true);
                  }}
                  disabled={activeTableOrders.length === 0}
                  className="px-2.5 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 font-semibold border border-stone-700 flex items-center gap-1.5 disabled:opacity-40 transition-colors"
                  title="Mover pedidos desta mesa para outra mesa"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Transferir Mesa</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedQrTable(activeTableId);
                    setShowQrPlatesModal(true);
                  }}
                  className="px-2.5 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 font-semibold border border-stone-700 flex items-center gap-1.5 transition-colors"
                  title="Ver e Imprimir Placa QR Code desta Mesa"
                >
                  <QrCode className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Placa QR</span>
                </button>
              </div>

              {waiterCalls[activeTableId] && (
                <button
                  type="button"
                  onClick={() => handleAcknowledgeCall(activeTableId)}
                  className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs flex items-center gap-1.5 shadow animate-pulse"
                >
                  <Bell className="w-3.5 h-3.5" />
                  <span>Atender Chamado!</span>
                </button>
              )}
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
              {/* TAB 1: Consumo da Mesa */}
              {activeTab === 'pedidos' && (
                <div className="space-y-4">
                  {activeTableOrders.length === 0 ? (
                    <div className="py-12 text-center text-stone-500 space-y-3">
                      <Receipt className="w-12 h-12 mx-auto text-stone-600" />
                      <p className="text-sm">Nenhum pedido lançado nesta mesa ainda.</p>
                      <button
                        onClick={() => setActiveTab('lancar')}
                        className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-black text-xs"
                      >
                        + Lançar Primeiro Pedido
                      </button>
                    </div>
                  ) : (
                    activeTableOrders.map((order) => (
                      <div
                        key={order.id}
                        className="bg-stone-950/80 border border-stone-800 rounded-2xl p-4 space-y-3"
                      >
                        <div className="flex items-center justify-between text-xs pb-2 border-b border-stone-800">
                          <div>
                            <span className="font-black text-amber-400">
                              {order.shortCode || order.id.slice(-4)}
                            </span>
                            <span className="text-stone-500 ml-2">
                              {order.createdAt ? new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Agora'}
                            </span>
                          </div>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            order.status === 'pronto'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : order.status === 'em_preparo'
                              ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                              : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          }`}>
                            {order.status.replace('_', ' ')}
                          </span>
                        </div>

                        {/* Items list */}
                        <div className="space-y-2">
                          {order.items.map((it, idx) => (
                            <div key={idx} className="flex justify-between text-xs">
                              <div>
                                <span className="font-bold text-white mr-2">
                                  {it.quantity}x
                                </span>
                                <span className="text-stone-200">{it.name}</span>
                                {it.notes && (
                                  <p className="text-[11px] text-amber-400/80 italic ml-4">
                                    Obs: {it.notes}
                                  </p>
                                )}
                              </div>
                              <span className="text-stone-300 font-medium">
                                R$ {(it.totalPrice || it.unitPrice * it.quantity).toFixed(2)}
                              </span>
                            </div>
                          ))}
                        </div>

                        <div className="pt-2 border-t border-stone-800/80 flex justify-between items-center text-xs font-bold text-amber-300">
                          <span>Subtotal deste envio:</span>
                          <span>R$ {(order.total || 0).toFixed(2)}</span>
                        </div>
                      </div>
                    ))
                  )}

                  {/* Summary Bar */}
                  {activeTableOrders.length > 0 && (
                    <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between">
                      <div>
                        <p className="text-xs text-amber-300 font-semibold">Total Consumido:</p>
                        <p className="text-xl font-black text-amber-400">
                          R$ {activeTableGrandTotal.toFixed(2)}
                        </p>
                      </div>
                      <button
                        onClick={() => setActiveTab('conta')}
                        className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-black text-xs"
                      >
                        Fechar Conta &gt;
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: Lançar Pedidos */}
              {activeTab === 'lancar' && (
                <div className="space-y-4">
                  {/* Category Filter */}
                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
                    <button
                      onClick={() => setCategoryFilter('all')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap ${
                        categoryFilter === 'all'
                          ? 'bg-amber-500 text-stone-950'
                          : 'bg-stone-800 text-stone-300'
                      }`}
                    >
                      Todos os Itens
                    </button>
                    {restaurantCategories.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => setCategoryFilter(c.id)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap ${
                          categoryFilter === c.id
                            ? 'bg-amber-500 text-stone-950'
                            : 'bg-stone-800 text-stone-300'
                        }`}
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>

                  {/* Search */}
                  <div className="relative">
                    <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchItemFilter}
                      onChange={(e) => setSearchItemFilter(e.target.value)}
                      placeholder="Buscar por nome do prato ou bebida..."
                      className="w-full pl-9 pr-4 py-2 rounded-xl bg-stone-950 border border-stone-800 text-xs text-white placeholder-stone-500 focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  {/* Items to click */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[300px] overflow-y-auto pr-1">
                    {restaurantMenuItems
                      .filter((item) => {
                        if (!item.available) return false;
                        if (categoryFilter !== 'all' && item.categoryId !== categoryFilter) return false;
                        if (
                          searchItemFilter &&
                          !item.name.toLowerCase().includes(searchItemFilter.toLowerCase())
                        ) {
                          return false;
                        }
                        return true;
                      })
                      .map((item) => (
                        <div
                          key={item.id}
                          onClick={() => handleAddToTray(item)}
                          className="p-2.5 rounded-xl bg-stone-950/70 border border-stone-800/80 hover:border-amber-500/60 cursor-pointer flex items-center justify-between gap-2 group transition-colors"
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-white group-hover:text-amber-400 truncate">
                              {item.name}
                            </p>
                            <p className="text-[11px] text-amber-400 font-semibold">
                              R$ {item.price.toFixed(2)}
                            </p>
                          </div>
                          <span className="p-1.5 rounded-lg bg-stone-800 group-hover:bg-amber-500 group-hover:text-stone-950 text-stone-300">
                            <Plus className="w-3.5 h-3.5" />
                          </span>
                        </div>
                      ))}
                  </div>

                  {/* Tray for items to be sent */}
                  <div className="pt-3 border-t border-stone-800 space-y-3">
                    <h3 className="text-xs font-black uppercase text-amber-400 tracking-wider flex items-center justify-between">
                      <span>Bandeja do Garçom ({trayItems.length} tipos)</span>
                      {trayItems.length > 0 && (
                        <button
                          onClick={() => setTrayItems([])}
                          className="text-[10px] text-rose-400 hover:underline"
                        >
                          Limpar Bandeja
                        </button>
                      )}
                    </h3>

                    {trayItems.length === 0 ? (
                      <p className="text-xs text-stone-500 italic py-2 text-center">
                        Toque nos itens acima para montar o pedido da mesa.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {trayItems.map((tray, idx) => (
                          <div
                            key={idx}
                            className="bg-stone-950 p-3 rounded-xl border border-stone-800 space-y-2"
                          >
                            <div className="flex items-center justify-between text-xs">
                              <div>
                                <span className="font-bold text-white">{tray.menuItem.name}</span>
                                <p className="text-[11px] text-amber-400">
                                  R$ {(tray.menuItem.price * tray.quantity).toFixed(2)}
                                </p>
                              </div>

                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleUpdateTrayQty(idx, -1)}
                                  className="w-6 h-6 rounded-lg bg-stone-800 hover:bg-stone-700 text-white font-bold flex items-center justify-center text-xs"
                                >
                                  -
                                </button>
                                <span className="text-xs font-black text-amber-400 w-4 text-center">
                                  {tray.quantity}
                                </span>
                                <button
                                  onClick={() => handleUpdateTrayQty(idx, 1)}
                                  className="w-6 h-6 rounded-lg bg-stone-800 hover:bg-stone-700 text-white font-bold flex items-center justify-center text-xs"
                                >
                                  +
                                </button>
                              </div>
                            </div>

                            {/* Note Input */}
                            <input
                              type="text"
                              value={tray.notes}
                              onChange={(e) => handleUpdateTrayNotes(idx, e.target.value)}
                              placeholder="Observação (ex: bem passado, sem gelo)..."
                              className="w-full px-2.5 py-1 rounded-lg bg-stone-900 border border-stone-800 text-[11px] text-stone-200 placeholder-stone-600 focus:outline-none focus:border-amber-400"
                            />
                          </div>
                        ))}

                        {/* Send Button */}
                        <button
                          onClick={handleSendOrderToKitchen}
                          disabled={isSendingOrder}
                          className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-stone-950 font-black text-sm uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20"
                        >
                          <ChefHat className="w-4 h-4" />
                          {isSendingOrder ? 'Enviando...' : `Enviar p/ Cozinha (R$ ${trayItems.reduce((acc, t) => acc + t.menuItem.price * t.quantity, 0).toFixed(2)})`}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: Pré-Conta & Fechamento */}
              {activeTab === 'conta' && (
                <div className="space-y-5">
                  <div className="bg-stone-950 border border-stone-800 rounded-2xl p-4 space-y-3">
                    <h3 className="text-xs font-black uppercase text-amber-400 tracking-wider">
                      Extrato da Conferência
                    </h3>

                    <div className="space-y-1.5 text-xs text-stone-300 divide-y divide-stone-900">
                      <div className="flex justify-between py-1">
                        <span>Subtotal de Alimentos &amp; Bebidas:</span>
                        <span className="font-bold text-white">
                          R$ {activeTableSubtotal.toFixed(2)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between py-2">
                        <label className="flex items-center gap-2 cursor-pointer text-xs">
                          <input
                            type="checkbox"
                            checked={includeServiceFee}
                            onChange={(e) => setIncludeServiceFee(e.target.checked)}
                            className="rounded text-amber-500 focus:ring-amber-500"
                          />
                          <span>Taxa de Serviço do Salão (10%)</span>
                        </label>
                        <span className="font-bold text-amber-400">
                          {includeServiceFee ? `R$ ${serviceFeeValue.toFixed(2)}` : 'R$ 0,00'}
                        </span>
                      </div>

                      <div className="flex justify-between py-2 text-sm font-black text-amber-400">
                        <span>Total Geral da Mesa:</span>
                        <span>R$ {activeTableGrandTotal.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Bill Splitter Calculator */}
                  <div className="bg-stone-950 border border-stone-800 rounded-2xl p-4 space-y-3">
                    <h3 className="text-xs font-black uppercase text-stone-300 tracking-wider flex items-center justify-between">
                      <span>Divisão de Conta por Pessoas</span>
                      <span className="text-amber-400 font-bold">{splitCount} Pessoas</span>
                    </h3>

                    <div className="flex gap-2">
                      {[1, 2, 3, 4, 5, 6].map((cnt) => (
                        <button
                          key={cnt}
                          onClick={() => setSplitCount(cnt)}
                          className={`flex-1 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
                            splitCount === cnt
                              ? 'bg-amber-500 text-stone-950 border-amber-400'
                              : 'bg-stone-900 text-stone-300 border-stone-800'
                          }`}
                        >
                          {cnt}x
                        </button>
                      ))}
                    </div>

                    <div className="p-3 bg-stone-900/80 rounded-xl flex items-center justify-between text-xs">
                      <span className="text-stone-400">Valor individual por pagante:</span>
                      <span className="text-base font-black text-amber-400">
                        R$ {perPersonTotal.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Payment Method Selector */}
                  <div className="bg-stone-950 border border-stone-800 rounded-2xl p-4 space-y-3">
                    <h3 className="text-xs font-black uppercase text-amber-400 tracking-wider">
                      Forma de Pagamento para Fechamento
                    </h3>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedPaymentMethod('pix')}
                        className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                          selectedPaymentMethod === 'pix'
                            ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400 shadow-sm'
                            : 'bg-stone-900 border-stone-800 text-stone-300 hover:border-stone-700'
                        }`}
                      >
                        <Smartphone className="w-4 h-4 text-emerald-400" />
                        <span>PIX Instantâneo</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSelectedPaymentMethod('cartao_credito')}
                        className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                          selectedPaymentMethod === 'cartao_credito'
                            ? 'bg-amber-500/20 border-amber-500 text-amber-400 shadow-sm'
                            : 'bg-stone-900 border-stone-800 text-stone-300 hover:border-stone-700'
                        }`}
                      >
                        <CreditCard className="w-4 h-4 text-amber-400" />
                        <span>Cartão Crédito</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSelectedPaymentMethod('cartao_debito')}
                        className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                          selectedPaymentMethod === 'cartao_debito'
                            ? 'bg-cyan-500/20 border-cyan-500 text-cyan-400 shadow-sm'
                            : 'bg-stone-900 border-stone-800 text-stone-300 hover:border-stone-700'
                        }`}
                      >
                        <CreditCard className="w-4 h-4 text-cyan-400" />
                        <span>Cartão Débito</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSelectedPaymentMethod('dinheiro')}
                        className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                          selectedPaymentMethod === 'dinheiro'
                            ? 'bg-amber-500/20 border-amber-500 text-amber-400 shadow-sm'
                            : 'bg-stone-900 border-stone-800 text-stone-300 hover:border-stone-700'
                        }`}
                      >
                        <Banknote className="w-4 h-4 text-emerald-400" />
                        <span>Dinheiro / Espécie</span>
                      </button>
                    </div>

                    {selectedPaymentMethod === 'dinheiro' && (
                      <div className="pt-2 border-t border-stone-900 space-y-2">
                        <label className="text-[11px] text-stone-400 block">
                          Valor Entregue pelo Cliente (R$):
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="number"
                            step="0.01"
                            value={cashReceived}
                            onChange={(e) => setCashReceived(e.target.value)}
                            placeholder={activeTableGrandTotal.toFixed(2)}
                            className="flex-1 px-3 py-2 rounded-xl bg-stone-900 border border-stone-800 text-sm text-white focus:outline-none focus:border-amber-400 font-bold"
                          />
                          {Number(cashReceived) > activeTableGrandTotal && (
                            <div className="px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-black flex items-center">
                              Troco: R$ {(Number(cashReceived) - activeTableGrandTotal).toFixed(2)}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions: Print, Fiscal and Close */}
                  <div className="space-y-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowPrintModal(true)}
                      className="w-full py-3 rounded-xl bg-stone-800 hover:bg-stone-700 text-white font-bold text-xs flex items-center justify-center gap-2 border border-stone-700 transition-colors"
                    >
                      <Printer className="w-4 h-4 text-amber-400" />
                      Imprimir Pré-Conta / Conferência Térmica
                    </button>

                    <button
                      type="button"
                      onClick={() => handleCloseTable(activeTableId)}
                      className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-colors shadow-md shadow-emerald-600/20"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Encerrar Atendimento &amp; Liberar Mesa
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Thermal Pre-Bill Print Simulation Modal */}
      {showPrintModal && activeTableId && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white text-black font-mono w-full max-w-sm max-h-[92vh] overflow-y-auto rounded-2xl p-6 space-y-4 text-xs shadow-2xl my-auto">
            {/* Destaque Máximo no Topo da Comanda / Pré-Conta */}
            <div className="bg-neutral-950 text-white p-3 rounded-xl text-center space-y-0.5">
              <div className="text-[10px] font-black tracking-widest text-amber-400 uppercase">
                ATENDIMENTO EM SALÃO
              </div>
              <div className="text-xl font-black tracking-wider">
                🔹 MESA {String(activeTableId).padStart(2, '0')}
              </div>
              <div className="text-[10px] text-neutral-400 font-mono">
                CONFERÊNCIA DE MESA • NÃO É DOCUMENTO FISCAL
              </div>
            </div>

            <div className="text-center border-b pb-3 border-dashed border-neutral-400 space-y-1">
              <p className="font-bold text-base uppercase">{BRAND_NAME}</p>
              <p className="text-[10px] text-neutral-500">
                Data: {new Date().toLocaleDateString('pt-BR')} {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>

            {/* Consumed Items */}
            <div className="space-y-1.5 border-b pb-3 border-dashed border-neutral-400">
              {activeTableOrders.flatMap((o) => o.items).map((it, idx) => (
                <div key={idx} className="flex justify-between">
                  <span>{it.quantity}x {it.name}</span>
                  <span>R$ {(it.totalPrice || it.unitPrice * it.quantity).toFixed(2)}</span>
                </div>
              ))}
            </div>

            {/* Subtotal and Fees */}
            <div className="space-y-1 text-xs border-b pb-3 border-dashed border-neutral-400">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>R$ {activeTableSubtotal.toFixed(2)}</span>
              </div>
              {includeServiceFee && (
                <div className="flex justify-between text-neutral-700">
                  <span>Serviço Sugerido (10%):</span>
                  <span>R$ {serviceFeeValue.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-sm pt-1">
                <span>TOTAL A PAGAR:</span>
                <span>R$ {activeTableGrandTotal.toFixed(2)}</span>
              </div>
              {splitCount > 1 && (
                <div className="flex justify-between text-[11px] text-neutral-700 pt-1">
                  <span>Divisão ({splitCount} pessoas):</span>
                  <span className="font-bold">R$ {perPersonTotal.toFixed(2)} / pessoa</span>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="text-center text-[10px] text-neutral-600 space-y-1">
              <p>Obrigado pela preferência!</p>
              <p>Volte sempre à nossa casa.</p>
            </div>

            <div className="flex gap-2 pt-2 border-t border-neutral-200">
              <button
                onClick={() => {
                  window.print();
                  setShowPrintModal(false);
                }}
                className="flex-1 py-2 rounded-xl bg-black text-white font-bold text-xs"
              >
                Imprimir
              </button>
              <button
                onClick={() => setShowPrintModal(false)}
                className="py-2 px-4 rounded-xl bg-neutral-200 text-neutral-800 font-bold text-xs"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transfer Orders to Another Table Modal */}
      {showTransferModal && activeTableId && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-stone-900 border border-stone-800 rounded-3xl p-6 w-full max-w-md max-h-[92vh] overflow-y-auto space-y-5 shadow-2xl my-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold">
                  <ArrowRightLeft className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">Transferir Comanda</h3>
                  <p className="text-xs text-stone-400">Origem: Mesa {activeTableId}</p>
                </div>
              </div>
              <button
                onClick={() => setShowTransferModal(false)}
                className="p-2 rounded-xl bg-stone-800 text-stone-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-bold text-stone-300 block">
                Selecione a Mesa de Destino:
              </label>
              <select
                value={transferTargetTable}
                onChange={(e) => setTransferTargetTable(Number(e.target.value))}
                className="w-full px-4 py-3 rounded-xl bg-stone-950 border border-stone-800 text-white font-bold text-sm focus:outline-none focus:border-cyan-400"
              >
                {tables
                  .filter((t) => t.id !== activeTableId)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label} ({getTableStatus(t.id).toUpperCase()})
                    </option>
                  ))}
              </select>

              <div className="p-3 bg-stone-950 rounded-xl border border-stone-800 text-xs text-stone-400 space-y-1">
                <p>
                  Pedidos a transferir:{' '}
                  <strong className="text-white">{activeTableOrders.length} comanda(s)</strong>
                </p>
                <p>
                  Valor acumulado:{' '}
                  <strong className="text-amber-400">R$ {activeTableGrandTotal.toFixed(2)}</strong>
                </p>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => handleTransferTable(activeTableId, transferTargetTable)}
                className="flex-1 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-stone-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20"
              >
                <ArrowRightLeft className="w-4 h-4" />
                Confirmar Transferência
              </button>
              <button
                type="button"
                onClick={() => setShowTransferModal(false)}
                className="px-4 py-3 rounded-xl bg-stone-800 text-stone-300 font-bold text-xs"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR Code Acrylic Stand Modal */}
      {showQrPlatesModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-stone-900 border border-stone-800 rounded-3xl p-6 w-full max-w-lg space-y-5 shadow-2xl my-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                  <QrCode className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">Placa QR Code de Mesa</h3>
                  <p className="text-xs text-stone-400">Display acrílico para pedido na mesa</p>
                </div>
              </div>
              <button
                onClick={() => setShowQrPlatesModal(false)}
                className="p-2 rounded-xl bg-stone-800 text-stone-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Selector */}
            <div className="flex items-center gap-3 bg-stone-950 p-3 rounded-2xl border border-stone-800">
              <label className="text-xs font-bold text-stone-300 whitespace-nowrap">
                Visualizar Mesa:
              </label>
              <select
                value={selectedQrTable}
                onChange={(e) => setSelectedQrTable(Number(e.target.value))}
                className="flex-1 px-3 py-1.5 rounded-xl bg-stone-900 border border-stone-700 text-amber-400 font-bold text-xs focus:outline-none"
              >
                {tables.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label} ({t.capacity} Lugares)
                  </option>
                ))}
              </select>
            </div>

            {/* Acrylic Stand Preview Card */}
            <div className="bg-gradient-to-b from-stone-950 to-stone-900 border-2 border-amber-500/40 rounded-3xl p-6 text-center space-y-4 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r from-amber-500 via-amber-300 to-amber-500" />
              
              <div className="pt-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-amber-400">
                  {BRAND_NAME}
                </p>
                <h4 className="text-2xl font-black text-white tracking-tight">
                  MESA {String(selectedQrTable).padStart(2, '0')}
                </h4>
                <p className="text-xs text-stone-400 mt-1">
                  Cardápio Digital &amp; Atendimento na Mesa
                </p>
              </div>

              {/* QR Code real e assinado da mesa */}
              <div className="bg-white p-4 rounded-2xl mx-auto w-52 shadow-inner border-4 border-stone-800">
                {isLoadingTableQr ? (
                  <div className="w-44 h-44 mx-auto flex items-center justify-center text-stone-600 text-xs font-bold text-center">
                    Gerando QR seguro da Mesa {selectedQrTable}...
                  </div>
                ) : tableQrUrl ? (
                  <img
                    src={getQrCodeImageUrl(tableQrUrl, 320)}
                    alt={`QR Code da Mesa ${selectedQrTable}`}
                    className="w-44 h-44 mx-auto object-contain"
                  />
                ) : (
                  <div className="w-44 h-44 mx-auto flex items-center justify-center text-rose-700 text-xs font-bold text-center">
                    Não foi possível gerar o QR desta mesa.
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <p className="text-[10px] text-stone-400 max-w-xs mx-auto">
                  Este QR abre somente o cardápio da <strong className="text-stone-200">{restaurant?.name || 'casa'} • Mesa {selectedQrTable}</strong>. O servidor valida o token antes de aceitar qualquer pedido da mesa.
                </p>
              </div>

              <div className="pt-2 text-[10px] text-stone-500 font-mono break-all">
                {tableQrUrl ? `Link seguro: ${tableQrUrl}` : 'Link seguro indisponível enquanto o QR não for gerado.'}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20"
              >
                <Printer className="w-4 h-4" />
                Imprimir Placa da Mesa
              </button>
              <button
                type="button"
                onClick={() => setShowQrPlatesModal(false)}
                className="px-4 py-3 rounded-xl bg-stone-800 text-stone-300 font-bold text-xs"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Shift History Modal */}
      {showShiftHistoryModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-stone-900 border border-stone-800 rounded-3xl p-6 w-full max-w-xl space-y-5 shadow-2xl my-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
                  <History className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">Histórico do Turno (Salão)</h3>
                  <p className="text-xs text-stone-400">Atendimentos e fechamentos de mesas hoje</p>
                </div>
              </div>
              <button
                onClick={() => setShowShiftHistoryModal(false)}
                className="p-2 rounded-xl bg-stone-800 text-stone-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Summary KPI Cards */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3.5 rounded-2xl bg-stone-950 border border-stone-800">
                <p className="text-[11px] text-stone-400">Mesas Fechadas</p>
                <p className="text-lg font-black text-white">{shiftHistory.length}</p>
              </div>
              <div className="p-3.5 rounded-2xl bg-stone-950 border border-stone-800">
                <p className="text-[11px] text-stone-400">Total Faturado</p>
                <p className="text-lg font-black text-amber-400">
                  R$ {shiftHistory.reduce((acc, h) => acc + h.total, 0).toFixed(2)}
                </p>
              </div>
              <div className="p-3.5 rounded-2xl bg-stone-950 border border-stone-800">
                <p className="text-[11px] text-stone-400">Ticket Médio</p>
                <p className="text-lg font-black text-cyan-400">
                  R${' '}
                  {shiftHistory.length > 0
                    ? (shiftHistory.reduce((acc, h) => acc + h.total, 0) / shiftHistory.length).toFixed(2)
                    : '0.00'}
                </p>
              </div>
            </div>

            {/* History Table */}
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {shiftHistory.length === 0 ? (
                <div className="py-12 text-center text-stone-500 text-xs">
                  Nenhuma mesa fechada neste turno ainda.
                </div>
              ) : (
                shiftHistory.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 bg-stone-950 rounded-xl border border-stone-800 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">Mesa {item.tableId}</span>
                        <span className="px-2 py-0.5 rounded-full bg-stone-800 text-stone-300 text-[10px] uppercase font-bold">
                          {item.paymentMethod.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="text-[11px] text-stone-400 mt-0.5">
                        Encerrado às {item.closedAt} • {item.waiter}
                      </p>
                    </div>
                    <span className="text-sm font-black text-amber-400">
                      R$ {item.total.toFixed(2)}
                    </span>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-stone-800">
              {shiftHistory.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    if (confirm('Zerar histórico do turno?')) {
                      setShiftHistory([]);
                      showToast('Histórico do turno limpo com sucesso.', 'info');
                    }
                  }}
                  className="text-xs text-rose-400 hover:underline"
                >
                  Limpar Histórico
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowShiftHistoryModal(false)}
                className="ml-auto px-5 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-white font-bold text-xs"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {showTableManager && (
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-[#111624] border border-amber-500/30 rounded-3xl shadow-2xl p-5">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-lg font-black text-white">Cadastro de Mesas</h3>
                <p className="text-xs text-slate-400 mt-1">Cadastre, remova ou restaure as 30 mesas do salão.</p>
              </div>
              <button onClick={() => setShowTableManager(false)} className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex flex-wrap gap-2 mb-4">
              {tableDraft.map((num) => (
                <button key={num} type="button" onClick={() => setTableDraft((prev) => prev.filter((n) => n !== num))} className="min-w-12 px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white font-black text-sm hover:bg-rose-900/40 hover:border-rose-500/40">
                  Mesa {num} ×
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 border-t border-slate-800 pt-4">
              <button type="button" onClick={() => setTableDraft(Array.from({ length: 30 }, (_, i) => i + 1))} className="px-4 py-2.5 rounded-xl bg-amber-500 text-slate-950 font-black text-xs">Restaurar 30 Mesas</button>
              <button type="button" onClick={() => { const max = tableDraft.length ? Math.max(...tableDraft) : 0; setTableDraft([...tableDraft, max + 1]); }} className="px-4 py-2.5 rounded-xl bg-slate-800 text-white font-bold text-xs border border-slate-700">+ Adicionar Mesa</button>
              <button type="button" onClick={saveTableManager} className="ml-auto px-5 py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-black text-xs">Salvar Cadastro</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
