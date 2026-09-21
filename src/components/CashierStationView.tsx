import React, { useState, useMemo } from 'react';
import { useStore } from '../context/StoreContext';
import { Order, PaymentMethod, CashRegisterMovement } from '../types/restaurant';
import { OrderOriginBadge } from './OrderOriginBadge';
import { ThermalTicketModal } from './ThermalTicketModal';
import { AdminFiscalModal } from './AdminFiscalModal';
import { OfflineStatusIndicator } from './OfflineStatusIndicator';
import {
  Wallet,
  DollarSign,
  CreditCard,
  QrCode,
  Users,
  Percent,
  Receipt,
  Printer,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowDownRight,
  ArrowUpRight,
  Lock,
  Search,
  ChevronRight,
  FileSpreadsheet,
  Split,
  Building2,
  Truck,
  Package,
  Utensils,
  ShieldAlert,
} from 'lucide-react';
import { playAlertSound } from '../utils/audioAlert';

interface CashierStationViewProps {
  onBackToApp?: () => void;
}

export const CashierStationView: React.FC<CashierStationViewProps> = ({ onBackToApp }) => {
  const {
    cashShift,
    addCashMovement,
    closeCashShift,
    currentUser,
    orders,
    closeTableOrder,
    updateOrderStatus,
    showToast,
  } = useStore();

  const [activeTab, setActiveTab] = useState<'mesas' | 'delivery' | 'retirada' | 'movimentacoes'>('mesas');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [ticketOrder, setTicketOrder] = useState<Order | null>(null);
  const [fiscalOrder, setFiscalOrder] = useState<Order | null>(null);

  // Payment dialog state
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cartao_credito');
  const [cashReceived, setCashReceived] = useState<string>('');
  const [splitCount, setSplitCount] = useState<number>(1);
  const [includeServiceFee, setIncludeServiceFee] = useState<boolean>(true);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [discountPassword, setDiscountPassword] = useState<string>('');
  const [isDiscountAuthorized, setIsDiscountAuthorized] = useState<boolean>(false);
  const [isAuthorizingDiscount, setIsAuthorizingDiscount] = useState<boolean>(false);

  // Cash movement modal
  const [showMovementModal, setShowMovementModal] = useState<boolean>(false);
  const [movementType, setMovementType] = useState<CashRegisterMovement['type']>('sangria');
  const [movementAmount, setMovementAmount] = useState<string>('');
  const [movementDesc, setMovementDesc] = useState<string>('');
  const [isConfirmingCloseShift, setIsConfirmingCloseShift] = useState<boolean>(false);

  // Separate active orders strictly by origin
  const mesaOrders = useMemo(() => {
    return orders.filter(
      (o) =>
        o.orderType === 'mesa' &&
        o.status !== 'finalizado' &&
        o.status !== 'cancelado'
    );
  }, [orders]);

  const deliveryOrders = useMemo(() => {
    return orders.filter(
      (o) =>
        o.orderType === 'delivery' &&
        o.status !== 'finalizado' &&
        o.status !== 'cancelado'
    );
  }, [orders]);

  const retiradaOrders = useMemo(() => {
    return orders.filter(
      (o) =>
        (o.orderType === 'retirada' || o.orderType === 'balcao') &&
        o.status !== 'finalizado' &&
        o.status !== 'cancelado'
    );
  }, [orders]);

  // Group mesa orders by table number for cumulative table balance
  const activeTableGroups = useMemo(() => {
    const map = new Map<number, { tableNumber: number; orders: Order[]; total: number; customerName: string }>();
    mesaOrders.forEach((o) => {
      const tNum = o.tableNumber || 1;
      if (!map.has(tNum)) {
        map.set(tNum, {
          tableNumber: tNum,
          orders: [o],
          total: o.total,
          customerName: o.customerName || `Mesa ${tNum}`,
        });
      } else {
        const entry = map.get(tNum)!;
        entry.orders.push(o);
        entry.total += o.total;
      }
    });
    return Array.from(map.values()).sort((a, b) => a.tableNumber - b.tableNumber);
  }, [mesaOrders]);

  // Financial summary of the shift
  const deliveredOrders = orders.filter((o) => o.status === 'entregue' || o.status === 'pronto' || o.status === 'finalizado');
  const revenueDinheiro = deliveredOrders
    .filter((o) => o.paymentMethod === 'dinheiro')
    .reduce((sum, o) => sum + o.total, 0);
  const revenuePix = deliveredOrders
    .filter((o) => o.paymentMethod === 'pix')
    .reduce((sum, o) => sum + o.total, 0);
  const revenueCartao = deliveredOrders
    .filter((o) => o.paymentMethod === 'cartao_credito' || o.paymentMethod === 'cartao_debito')
    .reduce((sum, o) => sum + o.total, 0);

  const sangrias = cashShift.movements
    .filter((m) => m.type === 'sangria')
    .reduce((sum, m) => sum + m.amount, 0);
  const suprimentos = cashShift.movements
    .filter((m) => m.type === 'suprimento')
    .reduce((sum, m) => sum + m.amount, 0);

  const saldoGaveta = cashShift.initialAmount + revenueDinheiro + (suprimentos - cashShift.initialAmount) - sangrias;
  const faturamentoTotal = revenueDinheiro + revenuePix + revenueCartao;

  // Selected Order / Table financial calculation
  const subtotalSelected = useMemo(() => {
    if (!selectedOrder) return 0;
    // If it's a table order, sum all active orders of that table
    if (selectedOrder.orderType === 'mesa' && selectedOrder.tableNumber) {
      const related = mesaOrders.filter((o) => o.tableNumber === selectedOrder.tableNumber);
      return related.reduce((acc, curr) => acc + curr.subtotal, 0);
    }
    return selectedOrder.subtotal || selectedOrder.total;
  }, [selectedOrder, mesaOrders]);

  const serviceFee = includeServiceFee ? subtotalSelected * 0.1 : 0;
  const finalTotal = Math.max(0, subtotalSelected + serviceFee - discountAmount);
  const valuePerPerson = splitCount > 0 ? finalTotal / splitCount : finalTotal;

  const cashReceivedNum = parseFloat(cashReceived.replace(',', '.')) || 0;
  const changeDue = cashReceivedNum > finalTotal ? cashReceivedNum - finalTotal : 0;

  // Authorize discount with manager password
  const handleAuthorizeDiscount = () => {
    if (
      discountPassword === '1234' ||
      discountPassword === 'admin' ||
      currentUser?.role === 'super_admin'
    ) {
      setIsDiscountAuthorized(true);
      setIsAuthorizingDiscount(false);
      showToast('Desconto autorizado com sucesso pelo Gerente!', 'success');
    } else {
      showToast('Senha de gerente incorreta. Use 1234 para teste.', 'error');
    }
  };

  // Complete Payment and Close Order / Table
  const handleConfirmPayment = async () => {
    if (!selectedOrder) return;

    if (paymentMethod === 'dinheiro' && cashReceivedNum < finalTotal) {
      showToast('O valor recebido em dinheiro é inferior ao total da conta.', 'warning');
      return;
    }

    if (selectedOrder.orderType === 'mesa' && selectedOrder.tableNumber) {
      // Close all orders of that table
      const related = mesaOrders.filter((o) => o.tableNumber === selectedOrder.tableNumber);
      for (const ord of related) {
        await closeTableOrder({
          orderId: ord.id,
          tableNumber: selectedOrder.tableNumber,
          paymentMethod,
          discount: discountAmount,
          serviceFee,
          total: finalTotal,
          splitCount,
          operatorName: currentUser?.name || 'Operador Caixa',
        });
      }
      playAlertSound('sound1', 0.8);
      showToast(`Conta da Mesa ${selectedOrder.tableNumber} recebida e fechada com sucesso!`, 'success');
    } else {
      // Delivery or Retirada
      await updateOrderStatus(selectedOrder.id, 'finalizado');
      playAlertSound('sound1', 0.8);
      showToast(`Pedido #${selectedOrder.shortCode} recebido e finalizado com sucesso!`, 'success');
    }

    // Reset selection and payment state
    setSelectedOrder(null);
    setCashReceived('');
    setDiscountAmount(0);
    setIsDiscountAuthorized(false);
    setSplitCount(1);
  };

  // Cash movement form
  const handleAddMovement = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(movementAmount.replace(',', '.'));
    if (isNaN(val) || val <= 0) {
      showToast('Informe um valor válido maior que zero.', 'warning');
      return;
    }
    if (!movementDesc.trim()) {
      showToast('Informe uma descrição ou motivo.', 'warning');
      return;
    }

    addCashMovement(movementType, val, movementDesc.trim());
    setMovementAmount('');
    setMovementDesc('');
    setShowMovementModal(false);
    showToast(`Movimentação de ${movementType === 'sangria' ? 'Sangria' : 'Suprimento'} registrada!`, 'success');
  };

  return (
    <div className="min-h-screen bg-[#07090E] text-slate-100 flex flex-col font-sans">
      {/* Top Header */}
      <header className="bg-[#0D111A] border-b border-slate-800/80 px-4 lg:px-8 py-4 sticky top-0 z-30 shadow-xl">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-lg shadow-amber-950/20">
              <Wallet className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black text-white tracking-tight">TERMINAL CAIXA &amp; PAGAMENTOS</h1>
                <span
                  className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border uppercase ${
                    cashShift.isClosed
                      ? 'bg-red-500/20 text-red-300 border-red-500/30'
                      : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                  }`}
                >
                  {cashShift.isClosed ? 'Turno Fechado' : 'Caixa Aberto'}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Operador: <strong className="text-white">{currentUser?.name || 'Operador Caixa'}</strong> • Turno desde: {cashShift.openedAt}
              </p>
            </div>
          </div>

          {/* Quick Metrics and Cash Shift Actions */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <OfflineStatusIndicator />

            <div className="bg-[#141923] border border-slate-800 px-3 py-1.5 rounded-xl">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Saldo em Gaveta</span>
              <span className="text-sm font-black text-amber-400 font-mono">
                R$ {saldoGaveta.toFixed(2)}
              </span>
            </div>

            <div className="bg-[#141923] border border-slate-800 px-3 py-1.5 rounded-xl">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Faturamento Hoje</span>
              <span className="text-sm font-black text-emerald-400 font-mono">
                R$ {faturamentoTotal.toFixed(2)}
              </span>
            </div>

            <button
              onClick={() => setShowMovementModal(true)}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 transition-colors flex items-center gap-1.5"
            >
              <DollarSign className="w-3.5 h-3.5 text-amber-400" />
              <span>Sangria / Suprimento</span>
            </button>

            {!cashShift.isClosed && (
              <button
                onClick={() => setIsConfirmingCloseShift(true)}
                className="px-3 py-2 bg-red-600/20 hover:bg-red-600 text-red-300 hover:text-white text-xs font-bold rounded-xl border border-red-500/30 transition-all flex items-center gap-1.5"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Fechar Turno</span>
              </button>
            )}
          </div>
        </div>

        {/* Categories / Modes Tabs */}
        <div className="max-w-7xl mx-auto mt-4 pt-4 border-t border-slate-800/60 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-1 bg-[#121622] p-1 rounded-xl border border-slate-800 w-full sm:w-auto">
            <button
              onClick={() => {
                setActiveTab('mesas');
                setSelectedOrder(null);
              }}
              className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg text-xs font-black flex items-center justify-center gap-2 transition-all ${
                activeTab === 'mesas'
                  ? 'bg-amber-500 text-slate-950 shadow-[0_0_12px_rgba(245,158,11,0.4)]'
                  : 'text-amber-400 hover:bg-amber-500/10'
              }`}
            >
              <Utensils className="w-4 h-4" />
              <span>🍽️ CONTAS DA MESA ({activeTableGroups.length})</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('delivery');
                setSelectedOrder(null);
              }}
              className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg text-xs font-black flex items-center justify-center gap-2 transition-all ${
                activeTab === 'delivery'
                  ? 'bg-emerald-500 text-slate-950 shadow-[0_0_12px_rgba(16,185,129,0.4)]'
                  : 'text-emerald-400 hover:bg-emerald-500/10'
              }`}
            >
              <Truck className="w-4 h-4" />
              <span>🚚 DELIVERY ({deliveryOrders.length})</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('retirada');
                setSelectedOrder(null);
              }}
              className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg text-xs font-black flex items-center justify-center gap-2 transition-all ${
                activeTab === 'retirada'
                  ? 'bg-sky-500 text-slate-950 shadow-[0_0_12px_rgba(14,165,233,0.4)]'
                  : 'text-sky-400 hover:bg-sky-500/10'
              }`}
            >
              <Package className="w-4 h-4" />
              <span>📦 RETIRADA ({retiradaOrders.length})</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('movimentacoes');
                setSelectedOrder(null);
              }}
              className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg text-xs font-black flex items-center justify-center gap-2 transition-all ${
                activeTab === 'movimentacoes'
                  ? 'bg-slate-700 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>📜 HISTÓRICO &amp; EXTRATO</span>
            </button>
          </div>

          {/* Search */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar mesa, pedido, cliente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-[#121622] border border-slate-800 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto p-4 lg:p-8 flex-1 w-full">
        {/* VIEW 1: CONTAS DA MESA */}
        {activeTab === 'mesas' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Tables List */}
            <div className={`${selectedOrder ? 'lg:col-span-6' : 'lg:col-span-12'} space-y-4`}>
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-black text-amber-400 uppercase tracking-wider flex items-center gap-2">
                  <Utensils className="w-4 h-4" />
                  <span>Mesas com Consumo Pendente de Pagamento</span>
                </h2>
                <span className="text-xs text-slate-400">{activeTableGroups.length} mesas ativas</span>
              </div>

              {activeTableGroups.length === 0 ? (
                <div className="bg-[#10141F] border border-slate-800 rounded-3xl p-12 text-center">
                  <Utensils className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                  <h3 className="text-base font-bold text-white">Nenhuma mesa com conta aberta</h3>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                    Todas as contas das mesas foram encerradas ou não há pedidos no momento.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {activeTableGroups.map((group) => {
                    const isSelected = selectedOrder?.tableNumber === group.tableNumber;
                    const primaryOrder = group.orders[0];

                    return (
                      <div
                        key={group.tableNumber}
                        onClick={() => setSelectedOrder(primaryOrder)}
                        className={`bg-[#121622] rounded-2xl border-2 p-4 cursor-pointer transition-all hover:scale-[1.01] flex flex-col justify-between ${
                          isSelected
                            ? 'border-amber-500 shadow-lg shadow-amber-950/40 bg-[#161C2C]'
                            : 'border-slate-800/80 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <OrderOriginBadge
                            orderType="mesa"
                            tableNumber={group.tableNumber}
                            variant="inline"
                          />
                          <span className="text-[10px] font-mono bg-slate-800 text-slate-300 px-2 py-0.5 rounded">
                            {group.orders.length} comanda{group.orders.length > 1 ? 's' : ''}
                          </span>
                        </div>

                        <div className="my-3">
                          <div className="text-xs text-slate-400">Cliente: <strong className="text-white">{group.customerName}</strong></div>
                          <div className="text-xs text-slate-400">Garçom: <strong className="text-slate-300">{primaryOrder.waiterName || 'Salão'}</strong></div>
                        </div>

                        <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
                          <div>
                            <span className="text-[10px] text-slate-500 uppercase font-bold block">Total Consumo</span>
                            <span className="text-lg font-black text-amber-400 font-mono">
                              R$ {group.total.toFixed(2)}
                            </span>
                          </div>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedOrder(primaryOrder);
                            }}
                            className="px-3 py-1.5 rounded-xl bg-amber-500 text-slate-950 text-xs font-black flex items-center gap-1 shadow hover:bg-amber-400"
                          >
                            <span>Cobrar Mesa</span>
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Right: Payment & Split Checkout Panel */}
            {selectedOrder && (
              <div className="lg:col-span-6 bg-[#121622] border-2 border-amber-500/60 rounded-3xl p-5 shadow-2xl space-y-4 animate-fadeIn">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div>
                    <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest block">
                      Recebimento Presencial
                    </span>
                    <h3 className="text-lg font-black text-white flex items-center gap-2">
                      <span>MESA {selectedOrder.tableNumber}</span>
                      <span className="text-xs font-normal text-slate-400">({selectedOrder.customerName})</span>
                    </h3>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setTicketOrder(selectedOrder)}
                      className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl border border-slate-700 text-xs font-bold flex items-center gap-1.5"
                      title="Imprimir conferência de mesa para o cliente"
                    >
                      <Printer className="w-4 h-4" />
                      <span>Conferência</span>
                    </button>

                    <button
                      onClick={() => setFiscalOrder(selectedOrder)}
                      className="p-2 bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-400 rounded-xl border border-emerald-500/30 text-xs font-bold flex items-center gap-1.5 transition-colors"
                      title="Emitir Cupom Fiscal (NFC-e / SEFAZ) com ou sem CPF na nota"
                    >
                      <Receipt className="w-4 h-4 text-emerald-400" />
                      <span>NFC-e</span>
                    </button>

                    <button
                      onClick={() => setSelectedOrder(null)}
                      className="text-xs text-slate-400 hover:text-white px-2 py-1"
                    >
                      Fechar
                    </button>
                  </div>
                </div>

                {/* Split Bill Calculator */}
                <div className="bg-[#181E2E] p-3.5 rounded-2xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                      <Split className="w-4 h-4 text-amber-400" />
                      <span>Dividir Conta por Pessoas</span>
                    </span>
                    <span className="text-xs font-mono font-bold text-amber-400">
                      R$ {valuePerPerson.toFixed(2)} / pessoa
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {[1, 2, 3, 4, 5, 6].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setSplitCount(num)}
                        className={`flex-1 py-1.5 rounded-xl text-xs font-black transition-all ${
                          splitCount === num
                            ? 'bg-amber-500 text-slate-950 font-black'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        {num}x
                      </button>
                    ))}
                  </div>
                </div>

                {/* Service Fee (10%) and Discount */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-[#181E2E] p-3 rounded-2xl border border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-white block">Taxa Serviço 10%</span>
                      <span className="text-[10px] text-slate-400">R$ {serviceFee.toFixed(2)}</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={includeServiceFee}
                      onChange={(e) => setIncludeServiceFee(e.target.checked)}
                      className="w-5 h-5 rounded text-amber-500 cursor-pointer"
                    />
                  </div>

                  <div className="bg-[#181E2E] p-3 rounded-2xl border border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-white block">Desconto</span>
                      <span className="text-[10px] text-emerald-400">
                        {discountAmount > 0 ? `- R$ ${discountAmount.toFixed(2)}` : 'Sem desconto'}
                      </span>
                    </div>
                    {isDiscountAuthorized ? (
                      <button
                        onClick={() => {
                          const val = prompt('Informe o valor do desconto em R$:', '5.00');
                          if (val) setDiscountAmount(parseFloat(val) || 0);
                        }}
                        className="text-xs font-bold text-amber-400 underline"
                      >
                        Ajustar
                      </button>
                    ) : (
                      <button
                        onClick={() => setIsAuthorizingDiscount(true)}
                        className="text-xs font-bold text-slate-400 hover:text-amber-400 flex items-center gap-1"
                      >
                        <Lock className="w-3 h-3" />
                        <span>Liberar</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Manager Password Prompt if requested */}
                {isAuthorizingDiscount && (
                  <div className="bg-amber-950/40 border border-amber-500/40 p-3 rounded-2xl space-y-2">
                    <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                      <ShieldAlert className="w-4 h-4" />
                      <span>Senha de Gerente para Desconto</span>
                    </span>
                    <div className="flex gap-2">
                      <input
                        type="password"
                        placeholder="Senha do gerente..."
                        value={discountPassword}
                        onChange={(e) => setDiscountPassword(e.target.value)}
                        className="flex-1 bg-slate-900 border border-slate-700 px-3 py-1.5 rounded-xl text-xs text-white"
                      />
                      <button
                        onClick={handleAuthorizeDiscount}
                        className="px-3 py-1.5 bg-amber-500 text-slate-950 text-xs font-black rounded-xl"
                      >
                        Autorizar
                      </button>
                    </div>
                  </div>
                )}

                {/* Financial Summary */}
                <div className="bg-[#0E121C] p-4 rounded-2xl border border-slate-800 space-y-1.5 text-xs font-mono">
                  <div className="flex justify-between text-slate-400">
                    <span>Subtotal Consumido:</span>
                    <span>R$ {subtotalSelected.toFixed(2)}</span>
                  </div>
                  {includeServiceFee && (
                    <div className="flex justify-between text-slate-400">
                      <span>Serviço (10%):</span>
                      <span>+ R$ {serviceFee.toFixed(2)}</span>
                    </div>
                  )}
                  {discountAmount > 0 && (
                    <div className="flex justify-between text-emerald-400">
                      <span>Desconto Gerente:</span>
                      <span>- R$ {discountAmount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-base font-black text-amber-400 pt-2 border-t border-slate-800">
                    <span>TOTAL A PAGAR:</span>
                    <span>R$ {finalTotal.toFixed(2)}</span>
                  </div>
                </div>

                {/* Payment Methods */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase block">
                    Forma de Pagamento
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('cartao_credito')}
                      className={`p-2.5 rounded-xl text-xs font-bold border flex flex-col items-center gap-1 transition-all ${
                        paymentMethod === 'cartao_credito'
                          ? 'bg-sky-500/20 text-sky-300 border-sky-500'
                          : 'bg-slate-800/60 text-slate-400 border-slate-800'
                      }`}
                    >
                      <CreditCard className="w-4 h-4" />
                      <span>Crédito</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentMethod('cartao_debito')}
                      className={`p-2.5 rounded-xl text-xs font-bold border flex flex-col items-center gap-1 transition-all ${
                        paymentMethod === 'cartao_debito'
                          ? 'bg-sky-500/20 text-sky-300 border-sky-500'
                          : 'bg-slate-800/60 text-slate-400 border-slate-800'
                      }`}
                    >
                      <CreditCard className="w-4 h-4" />
                      <span>Débito</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentMethod('pix')}
                      className={`p-2.5 rounded-xl text-xs font-bold border flex flex-col items-center gap-1 transition-all ${
                        paymentMethod === 'pix'
                          ? 'bg-teal-500/20 text-teal-300 border-teal-500'
                          : 'bg-slate-800/60 text-slate-400 border-slate-800'
                      }`}
                    >
                      <QrCode className="w-4 h-4" />
                      <span>PIX</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentMethod('dinheiro')}
                      className={`p-2.5 rounded-xl text-xs font-bold border flex flex-col items-center gap-1 transition-all ${
                        paymentMethod === 'dinheiro'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500'
                          : 'bg-slate-800/60 text-slate-400 border-slate-800'
                      }`}
                    >
                      <DollarSign className="w-4 h-4" />
                      <span>Dinheiro</span>
                    </button>
                  </div>
                </div>

                {/* Cash Change Calculator */}
                {paymentMethod === 'dinheiro' && (
                  <div className="bg-[#141A28] p-3.5 rounded-2xl border border-emerald-500/30 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-300">Valor Entregue pelo Cliente:</span>
                      <input
                        type="text"
                        placeholder="R$ 0,00"
                        value={cashReceived}
                        onChange={(e) => setCashReceived(e.target.value)}
                        className="w-32 text-right bg-slate-900 border border-slate-700 px-3 py-1.5 rounded-xl font-mono text-sm text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    {cashReceivedNum > 0 && (
                      <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800">
                        <span className="text-slate-400">Troco a Devolver:</span>
                        <span className="font-mono font-black text-emerald-400 text-sm">
                          R$ {changeDue.toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Action Confirmation Button */}
                <button
                  onClick={handleConfirmPayment}
                  className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-sm uppercase tracking-wider rounded-2xl shadow-xl shadow-emerald-950/40 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  <span>Confirmar Recebimento &amp; Liberar Mesa</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* VIEW 2: DELIVERY */}
        {activeTab === 'delivery' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                <Truck className="w-4 h-4" />
                <span>Cobranças &amp; Expedição de Delivery</span>
              </h2>
              <span className="text-xs text-slate-400">{deliveryOrders.length} pedidos</span>
            </div>

            {deliveryOrders.length === 0 ? (
              <div className="bg-[#10141F] border border-slate-800 rounded-3xl p-12 text-center">
                <Truck className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <h3 className="text-base font-bold text-white">Nenhum pedido de delivery aguardando caixa</h3>
                <p className="text-xs text-slate-400 mt-1">Todos os pedidos de delivery foram quitados ou estão em trânsito.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {deliveryOrders.map((order) => (
                  <div
                    key={order.id}
                    className="bg-[#121622] rounded-2xl border border-slate-800 p-4 flex flex-col justify-between shadow-xl space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <OrderOriginBadge
                        orderType="delivery"
                        shortCode={order.shortCode}
                        variant="inline"
                      />
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                        {order.status}
                      </span>
                    </div>

                    <div className="text-xs text-slate-300 space-y-1">
                      <div className="font-bold text-white">{order.customerName}</div>
                      <div>{order.customerPhone}</div>
                      {order.deliveryAddress && (
                        <div className="text-[11px] text-slate-400">
                          {order.deliveryAddress.street}, {order.deliveryAddress.number}
                        </div>
                      )}
                    </div>

                    <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase font-bold block">
                          Forma: {order.paymentMethod}
                        </span>
                        <span className="text-base font-black text-emerald-400 font-mono">
                          R$ {order.total.toFixed(2)}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setTicketOrder(order)}
                          className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl"
                          title="Imprimir comanda"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setFiscalOrder(order)}
                          className="p-2 bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-400 rounded-xl border border-emerald-500/30"
                          title="Emitir Cupom Fiscal (NFC-e / SEFAZ)"
                        >
                          <Receipt className="w-4 h-4" />
                        </button>
                        <button
                          onClick={async () => {
                            await updateOrderStatus(order.id, 'finalizado');
                            showToast(`Pedido #${order.shortCode} quitado e finalizado!`, 'success');
                          }}
                          className="px-3 py-1.5 bg-emerald-500 text-slate-950 text-xs font-black rounded-xl hover:bg-emerald-400"
                        >
                          Quitar Pedido
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* VIEW 3: RETIRADA */}
        {activeTab === 'retirada' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black text-sky-400 uppercase tracking-wider flex items-center gap-2">
                <Package className="w-4 h-4" />
                <span>Cobranças de Retirada no Balcão</span>
              </h2>
              <span className="text-xs text-slate-400">{retiradaOrders.length} pedidos</span>
            </div>

            {retiradaOrders.length === 0 ? (
              <div className="bg-[#10141F] border border-slate-800 rounded-3xl p-12 text-center">
                <Package className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <h3 className="text-base font-bold text-white">Nenhum pedido de retirada pendente</h3>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {retiradaOrders.map((order) => (
                  <div
                    key={order.id}
                    className="bg-[#121622] rounded-2xl border border-slate-800 p-4 flex flex-col justify-between shadow-xl space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <OrderOriginBadge
                        orderType="retirada"
                        shortCode={order.shortCode}
                        variant="inline"
                      />
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                        {order.status}
                      </span>
                    </div>

                    <div className="text-xs text-slate-300 space-y-1">
                      <div className="font-bold text-white">{order.customerName}</div>
                      <div>Tel: {order.customerPhone}</div>
                    </div>

                    <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase font-bold block">
                          Forma: {order.paymentMethod}
                        </span>
                        <span className="text-base font-black text-sky-400 font-mono">
                          R$ {order.total.toFixed(2)}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setTicketOrder(order)}
                          className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl"
                          title="Imprimir comanda"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setFiscalOrder(order)}
                          className="p-2 bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-400 rounded-xl border border-emerald-500/30"
                          title="Emitir Cupom Fiscal (NFC-e / SEFAZ)"
                        >
                          <Receipt className="w-4 h-4" />
                        </button>
                        <button
                          onClick={async () => {
                            await updateOrderStatus(order.id, 'finalizado');
                            showToast(`Retirada #${order.shortCode} entregue e finalizada!`, 'success');
                          }}
                          className="px-3 py-1.5 bg-sky-500 text-slate-950 text-xs font-black rounded-xl hover:bg-sky-400"
                        >
                          Entregar &amp; Quitar
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* VIEW 4: MOVIMENTAÇÕES E HISTÓRICO */}
        {activeTab === 'movimentacoes' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-[#121622] p-4 rounded-2xl border border-slate-800">
                <span className="text-xs text-slate-400 block">Dinheiro (Gaveta)</span>
                <span className="text-xl font-black text-amber-400 font-mono">R$ {saldoGaveta.toFixed(2)}</span>
              </div>
              <div className="bg-[#121622] p-4 rounded-2xl border border-slate-800">
                <span className="text-xs text-slate-400 block">Cartões</span>
                <span className="text-xl font-black text-sky-400 font-mono">R$ {revenueCartao.toFixed(2)}</span>
              </div>
              <div className="bg-[#121622] p-4 rounded-2xl border border-slate-800">
                <span className="text-xs text-slate-400 block">PIX</span>
                <span className="text-xl font-black text-teal-400 font-mono">R$ {revenuePix.toFixed(2)}</span>
              </div>
              <div className="bg-[#121622] p-4 rounded-2xl border border-slate-800">
                <span className="text-xs text-slate-400 block">Total Faturado</span>
                <span className="text-xl font-black text-emerald-400 font-mono">R$ {faturamentoTotal.toFixed(2)}</span>
              </div>
            </div>

            <div className="bg-[#121622] rounded-2xl border border-slate-800 p-5 shadow-xl">
              <h3 className="text-xs font-black text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                <span>Extrato Completo do Turno</span>
              </h3>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 font-bold uppercase font-sans">
                      <th className="py-2.5 px-3">Hora</th>
                      <th className="py-2.5 px-3">Tipo</th>
                      <th className="py-2.5 px-3">Descrição</th>
                      <th className="py-2.5 px-3">Operador</th>
                      <th className="py-2.5 px-3 text-right">Valor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {cashShift.movements.map((mov) => (
                      <tr key={mov.id}>
                        <td className="py-2.5 px-3 text-slate-400">{mov.timestamp}</td>
                        <td className="py-2.5 px-3 uppercase text-[10px] font-bold">
                          <span
                            className={`px-2 py-0.5 rounded ${
                              mov.type === 'sangria'
                                ? 'bg-red-500/20 text-red-300'
                                : mov.type === 'suprimento'
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : 'bg-blue-500/20 text-blue-300'
                            }`}
                          >
                            {mov.type}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-sans text-slate-300">{mov.description}</td>
                        <td className="py-2.5 px-3 font-sans text-slate-400">{mov.operator}</td>
                        <td
                          className={`py-2.5 px-3 text-right font-black ${
                            mov.type === 'sangria' ? 'text-red-400' : 'text-emerald-400'
                          }`}
                        >
                          {mov.type === 'sangria' ? '-' : '+'} R$ {mov.amount.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Sangria / Suprimento Modal */}
      {showMovementModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121622] border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-scaleUp">
            <h3 className="text-base font-black text-white uppercase flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-amber-400" />
              <span>Lançar Movimentação no Caixa</span>
            </h3>

            <form onSubmit={handleAddMovement} className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setMovementType('sangria')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 ${
                    movementType === 'sangria'
                      ? 'bg-red-500/20 text-red-300 border-red-500'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                >
                  <ArrowDownRight className="w-4 h-4 text-red-400" />
                  <span>Sangria (Retirada)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMovementType('suprimento')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 ${
                    movementType === 'suprimento'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                >
                  <ArrowUpRight className="w-4 h-4 text-emerald-400" />
                  <span>Suprimento (Entrada)</span>
                </button>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">Valor (R$)</label>
                <input
                  type="text"
                  required
                  placeholder="0,00"
                  value={movementAmount}
                  onChange={(e) => setMovementAmount(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-white font-mono text-base"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">Motivo / Descrição</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Troco extra, pagamento de fornecedor..."
                  value={movementDesc}
                  onChange={(e) => setMovementDesc(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-xs text-white"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowMovementModal(false)}
                  className="flex-1 py-2.5 bg-slate-800 text-slate-300 rounded-xl text-xs font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-amber-500 text-slate-950 rounded-xl text-xs font-black shadow hover:bg-amber-400"
                >
                  Confirmar Lançamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Close Shift Confirmation Modal */}
      {isConfirmingCloseShift && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121622] border border-red-500/40 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <Lock className="w-5 h-5 text-red-400" />
              <span>Encerrar Turno &amp; Fechar Caixa?</span>
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Esta ação registrará o fechamento oficial do turno. O saldo em dinheiro na gaveta no momento é de{' '}
              <strong className="text-amber-400">R$ {saldoGaveta.toFixed(2)}</strong> e o total faturado é{' '}
              <strong className="text-emerald-400">R$ {faturamentoTotal.toFixed(2)}</strong>.
            </p>

            <div className="flex gap-2 pt-3">
              <button
                onClick={() => setIsConfirmingCloseShift(false)}
                className="flex-1 py-2.5 bg-slate-800 text-slate-300 rounded-xl text-xs font-bold"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  closeCashShift();
                  setIsConfirmingCloseShift(false);
                  showToast('Turno de caixa encerrado com sucesso!', 'success');
                }}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-black"
              >
                Sim, Fechar Caixa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Thermal Ticket Modal */}
      {ticketOrder && (
        <ThermalTicketModal
          order={ticketOrder}
          onClose={() => setTicketOrder(null)}
        />
      )}

      {/* Official Fiscal NFC-e Modal */}
      {fiscalOrder && (
        <AdminFiscalModal
          order={fiscalOrder}
          isOpen={!!fiscalOrder}
          onClose={() => setFiscalOrder(null)}
          restaurantSlug={fiscalOrder.restaurantSlug}
        />
      )}
    </div>
  );
};
