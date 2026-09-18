import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { CashRegisterMovement, Order, OrderType } from '../types/restaurant';
import { ThermalTicketModal } from './ThermalTicketModal';
import {
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  DollarSign,
  CreditCard,
  QrCode,
  Lock,
  Printer,
  Sparkles,
  AlertCircle,
  FileSpreadsheet,
  Utensils,
  Store,
  Bike,
  Receipt,
  Search,
} from 'lucide-react';

export const AdminCashRegister: React.FC = () => {
  const { cashShift, addCashMovement, closeCashShift, currentUser, orders, restaurants, showToast } = useStore();

  const [movementType, setMovementType] = useState<CashRegisterMovement['type']>('sangria');
  const [movementAmount, setMovementAmount] = useState<string>('');
  const [movementDesc, setMovementDesc] = useState<string>('');
  const [isConfirmingClose, setIsConfirmingClose] = useState<boolean>(false);

  // Filter for orders list in Cash Register
  const [orderCategoryFilter, setOrderCategoryFilter] = useState<'all' | 'mesa' | 'balcao' | 'delivery'>('all');
  const [orderSearchTerm, setOrderSearchTerm] = useState<string>('');
  const [ticketOrder, setTicketOrder] = useState<Order | null>(null);

  // Compute live order revenue since shift opening
  const deliveredOrders = orders.filter((o) => o.status === 'entregue' || o.status === 'pronto');
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

  // Cash in drawer = initial + cash sales + extra cash supply - withdrawals (sangrias)
  const saldoGaveta = cashShift.initialAmount + revenueDinheiro + (suprimentos - cashShift.initialAmount) - sangrias;
  const faturamentoTotal = revenueDinheiro + revenuePix + revenueCartao;

  // Filtered orders in shift
  const filteredOrders = orders.filter((o) => {
    if (orderCategoryFilter === 'mesa' && o.orderType !== 'mesa') return false;
    if (orderCategoryFilter === 'balcao' && o.orderType !== 'balcao' && o.orderType !== 'retirada') return false;
    if (orderCategoryFilter === 'delivery' && o.orderType !== 'delivery') return false;

    if (orderSearchTerm) {
      const q = orderSearchTerm.toLowerCase();
      const matchCode = o.shortCode.toLowerCase().includes(q);
      const matchCustomer = o.customerName.toLowerCase().includes(q);
      const matchTable = o.tableNumber ? o.tableNumber.toString().includes(q) : false;
      const matchPickup = o.pickupNumber ? o.pickupNumber.toString().includes(q) : false;
      return matchCode || matchCustomer || matchTable || matchPickup;
    }
    return true;
  });

  const mesaCount = orders.filter((o) => o.orderType === 'mesa').length;
  const balcaoCount = orders.filter((o) => o.orderType === 'balcao' || o.orderType === 'retirada').length;
  const deliveryCount = orders.filter((o) => o.orderType === 'delivery').length;

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
    showToast(`Movimentação de ${movementType === 'sangria' ? 'Sangria' : 'Suprimento'} registrada com sucesso!`, 'success');
  };

  const handleExecuteClose = () => {
    closeCashShift();
    setIsConfirmingClose(false);
    showToast('Turno de caixa fechado e registrado com sucesso!', 'success');
  };

  return (
    <div className="space-y-6 animate-fadeIn text-slate-100">
      {/* Header */}
      <div className="bg-[#12151C] border border-[#222836] rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-slate-950 font-black shadow-lg">
            <Wallet className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-black text-white uppercase tracking-wider">
                Fechamento de Caixa do Dia
              </h2>
              <span
                className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase border ${
                  cashShift.isClosed
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                    : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                }`}
              >
                {cashShift.isClosed ? 'Turno Encerrado' : 'Caixa Aberto'}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Aberto em: {cashShift.openedAt} • Operador:{' '}
              <strong className="text-white">{currentUser?.name || 'Caixa'}</strong>
            </p>
          </div>
        </div>

        {/* Action Button to close shift */}
        {!cashShift.isClosed && (
          <button
            onClick={() => setIsConfirmingClose(true)}
            className="px-4 py-2.5 bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white font-black text-xs rounded-xl shadow transition-all flex items-center gap-2"
          >
            <Lock className="w-4 h-4" />
            <span>Encerrar Turno &amp; Fechar Caixa</span>
          </button>
        )}
      </div>

      {/* Financial Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Faturamento Total */}
        <div className="bg-[#151922] border border-slate-800 p-4 rounded-2xl shadow-lg space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <DollarSign className="w-3.5 h-3.5 text-emerald-400" /> Faturamento Total
          </span>
          <div className="text-xl sm:text-2xl font-black text-white font-mono">
            R$ {faturamentoTotal.toFixed(2)}
          </div>
          <span className="text-[10px] text-slate-500 block">Vendas confirmadas do dia</span>
        </div>

        {/* Saldo em Gaveta (Dinheiro) */}
        <div className="bg-[#151922] border border-slate-800 p-4 rounded-2xl shadow-lg space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Wallet className="w-3.5 h-3.5 text-amber-400" /> Saldo Gaveta (Dinheiro)
          </span>
          <div className="text-xl sm:text-2xl font-black text-amber-400 font-mono">
            R$ {saldoGaveta.toFixed(2)}
          </div>
          <span className="text-[10px] text-slate-500 block">
            Troco inicial R$ {cashShift.initialAmount.toFixed(2)} + entradas
          </span>
        </div>

        {/* Vendas PIX */}
        <div className="bg-[#151922] border border-slate-800 p-4 rounded-2xl shadow-lg space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <QrCode className="w-3.5 h-3.5 text-teal-400" /> Recebido via PIX
          </span>
          <div className="text-xl sm:text-2xl font-black text-teal-400 font-mono">
            R$ {revenuePix.toFixed(2)}
          </div>
          <span className="text-[10px] text-slate-500 block">Direto em conta bancária</span>
        </div>

        {/* Vendas Cartão */}
        <div className="bg-[#151922] border border-slate-800 p-4 rounded-2xl shadow-lg space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <CreditCard className="w-3.5 h-3.5 text-sky-400" /> Cartão Débito / Crédito
          </span>
          <div className="text-xl sm:text-2xl font-black text-sky-400 font-mono">
            R$ {revenueCartao.toFixed(2)}
          </div>
          <span className="text-[10px] text-slate-500 block">Processado em maquininhas</span>
        </div>
      </div>

      {/* Movements Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Form: Add Sangria or Suprimento */}
        {!cashShift.isClosed && (
          <div className="bg-[#151922] border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-amber-400" />
              <span>Lançar Sangria / Suprimento</span>
            </h3>

            <form onSubmit={handleAddMovement} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">
                  Tipo de Operação
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setMovementType('sangria')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
                      movementType === 'sangria'
                        ? 'bg-red-500/20 text-red-300 border-red-500/50'
                        : 'bg-[#1A1F2B] text-slate-400 border-slate-800'
                    }`}
                  >
                    <ArrowDownRight className="w-4 h-4 text-red-400" />
                    <span>Sangria (Retirada)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMovementType('suprimento')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
                      movementType === 'suprimento'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                        : 'bg-[#1A1F2B] text-slate-400 border-slate-800'
                    }`}
                  >
                    <ArrowUpRight className="w-4 h-4 text-emerald-400" />
                    <span>Suprimento (Entrada)</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">
                  Valor (R$)
                </label>
                <input
                  type="text"
                  required
                  placeholder="0,00"
                  value={movementAmount}
                  onChange={(e) => setMovementAmount(e.target.value)}
                  className="w-full bg-[#0E1015] border border-slate-800 rounded-xl px-4 py-2 text-white font-mono text-sm focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">
                  Motivo / Observação
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Pagamento fornecedor, troco extra..."
                  value={movementDesc}
                  onChange={(e) => setMovementDesc(e.target.value)}
                  className="w-full bg-[#0E1015] border border-slate-800 rounded-xl px-4 py-2 text-white text-xs focus:outline-none focus:border-amber-500"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs rounded-xl shadow transition-all"
              >
                Confirmar Lançamento
              </button>
            </form>
          </div>
        )}

        {/* Right Table: Movements History */}
        <div
          className={`${
            cashShift.isClosed ? 'lg:col-span-3' : 'lg:col-span-2'
          } bg-[#151922] border border-slate-800 rounded-2xl p-5 shadow-lg space-y-3`}
        >
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span>Extrato de Movimentações do Turno</span>
            </h3>
            <span className="text-xs text-slate-400">
              Total de lançamentos: {cashShift.movements.length}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800/80 text-slate-400 font-bold uppercase">
                  <th className="py-2.5 px-3">Hora</th>
                  <th className="py-2.5 px-3">Tipo</th>
                  <th className="py-2.5 px-3">Descrição</th>
                  <th className="py-2.5 px-3">Operador</th>
                  <th className="py-2.5 px-3 text-right">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {cashShift.movements.map((mov) => {
                  const isPositive = mov.type === 'suprimento' || mov.type === 'venda_dinheiro';
                  return (
                    <tr key={mov.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-2.5 px-3 text-slate-400">{mov.timestamp}</td>
                      <td className="py-2.5 px-3 font-sans">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            mov.type === 'sangria'
                              ? 'bg-red-500/20 text-red-300'
                              : mov.type === 'suprimento'
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : 'bg-blue-500/20 text-blue-300'
                          }`}
                        >
                          {mov.type.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-sans text-slate-300">{mov.description}</td>
                      <td className="py-2.5 px-3 font-sans text-slate-400">{mov.operator}</td>
                      <td
                        className={`py-2.5 px-3 text-right font-black ${
                          isPositive ? 'text-emerald-400' : 'text-red-400'
                        }`}
                      >
                        {isPositive ? '+' : '-'} R$ {mov.amount.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* CATEGORIZAÇÃO DE PEDIDOS NO CAIXA (MESA, DELIVERY E RETIRADA) */}
      <div className="bg-[#151922] border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                <span>Categorização de Pedidos no Caixa &amp; Expedição</span>
                <span className="text-[10px] font-mono bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full">
                  {orders.length} pedidos
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Visualização por modalidade (Mesa, Retirada no Balcão ou Delivery) com impressão de comanda térmica
              </p>
            </div>
          </div>

          {/* Search bar */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Buscar comanda, cliente, mesa..."
              value={orderSearchTerm}
              onChange={(e) => setOrderSearchTerm(e.target.value)}
              className="w-full bg-[#0E1015] border border-slate-700 rounded-xl pl-9 pr-3 py-1.5 text-white text-xs focus:border-amber-500 placeholder:text-slate-500"
            />
          </div>
        </div>

        {/* Modalidade Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setOrderCategoryFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              orderCategoryFilter === 'all'
                ? 'bg-amber-500 text-slate-950 font-black shadow'
                : 'bg-[#1A1F2B] text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            Todos os Pedidos ({orders.length})
          </button>
          <button
            onClick={() => setOrderCategoryFilter('mesa')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              orderCategoryFilter === 'mesa'
                ? 'bg-purple-600 text-white font-black shadow'
                : 'bg-[#1A1F2B] text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Utensils className="w-3.5 h-3.5 text-purple-300" />
            <span>Atendimento em Mesa ({mesaCount})</span>
          </button>
          <button
            onClick={() => setOrderCategoryFilter('balcao')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              orderCategoryFilter === 'balcao'
                ? 'bg-amber-600 text-white font-black shadow'
                : 'bg-[#1A1F2B] text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Store className="w-3.5 h-3.5 text-amber-300" />
            <span>Retirada no Balcão ({balcaoCount})</span>
          </button>
          <button
            onClick={() => setOrderCategoryFilter('delivery')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              orderCategoryFilter === 'delivery'
                ? 'bg-emerald-600 text-white font-black shadow'
                : 'bg-[#1A1F2B] text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Bike className="w-3.5 h-3.5 text-emerald-300" />
            <span>Expedição Delivery ({deliveryCount})</span>
          </button>
        </div>

        {/* Categorized Orders List */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px] font-bold">
                <th className="py-2.5 px-3">Comanda / Hora</th>
                <th className="py-2.5 px-3">Modalidade / Destino</th>
                <th className="py-2.5 px-3">Cliente / Detalhes</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Pagamento</th>
                <th className="py-2.5 px-3 font-mono text-right">Total</th>
                <th className="py-2.5 px-3 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-slate-500">
                    Nenhum pedido encontrado com os filtros selecionados.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((ord) => {
                  const isMesa = ord.orderType === 'mesa';
                  const isBalcao = ord.orderType === 'balcao' || ord.orderType === 'retirada';
                  const isDelivery = ord.orderType === 'delivery';

                  return (
                    <tr key={ord.id} className="hover:bg-white/[0.02] transition-colors">
                      {/* Code & Time */}
                      <td className="py-2.5 px-3">
                        <span className="font-mono font-black text-white block">
                          {ord.shortCode}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {new Date(ord.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </td>

                      {/* Prominent Modality Badge */}
                      <td className="py-2.5 px-3">
                        {isMesa && (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-500/20 text-purple-300 border border-purple-500/40 font-black text-xs">
                            <Utensils className="w-3.5 h-3.5" />
                            <span>MESA {ord.tableNumber ?? 'S/N'}</span>
                          </div>
                        )}
                        {isBalcao && (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 font-black text-xs">
                            <Store className="w-3.5 h-3.5" />
                            <span>BALCÃO - RETIRADA #{ord.pickupNumber ?? (ord.shortCode.replace(/\D/g, '') || '01')}</span>
                          </div>
                        )}
                        {isDelivery && (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-black text-xs">
                            <Bike className="w-3.5 h-3.5" />
                            <span>DELIVERY EXPEDIÇÃO</span>
                          </div>
                        )}
                      </td>

                      {/* Customer & Items preview */}
                      <td className="py-2.5 px-3 max-w-[200px]">
                        <span className="font-bold text-white block truncate">{ord.customerName}</span>
                        <span className="text-[11px] text-slate-400 block truncate">
                          {ord.items.map((i) => `${i.quantity}x ${i.name}`).join(', ')}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-2.5 px-3">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded capitalize ${
                            ord.status === 'entregue'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : ord.status === 'pronto'
                              ? 'bg-blue-500/20 text-blue-400'
                              : ord.status === 'em_preparo'
                              ? 'bg-amber-500/20 text-amber-400'
                              : 'bg-slate-800 text-slate-300'
                          }`}
                        >
                          {ord.status}
                        </span>
                      </td>

                      {/* Payment */}
                      <td className="py-2.5 px-3">
                        <span className="text-[10px] font-mono text-slate-300 uppercase bg-slate-800/80 px-2 py-0.5 rounded">
                          {ord.paymentMethod === 'pix'
                            ? 'PIX'
                            : ord.paymentMethod === 'dinheiro'
                            ? 'Dinheiro'
                            : ord.paymentMethod === 'cartao_credito'
                            ? 'Crédito'
                            : 'Débito'}
                        </span>
                      </td>

                      {/* Total */}
                      <td className="py-2.5 px-3 text-right font-mono font-black text-white text-xs">
                        R$ {ord.total.toFixed(2)}
                      </td>

                      {/* Thermal Print Action */}
                      <td className="py-2.5 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => setTicketOrder(ord)}
                          className="px-2.5 py-1 rounded-lg bg-[#1A1F2B] hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-amber-400 font-bold text-[11px] inline-flex items-center gap-1.5 transition-all shadow-sm"
                          title="Imprimir comanda térmica destacada"
                        >
                          <Printer className="w-3.5 h-3.5 text-amber-400" />
                          <span>Comanda Térmica</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal for Thermal Print from Caixa */}
      {ticketOrder && (
        <ThermalTicketModal
          isOpen={!!ticketOrder}
          order={ticketOrder}
          restaurant={restaurants[ticketOrder.restaurantSlug] || Object.values(restaurants)[0]}
          onClose={() => setTicketOrder(null)}
        />
      )}
      {isConfirmingClose && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#151922] border border-slate-700 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-red-500/20 text-red-400 flex items-center justify-center mx-auto">
              <Lock className="w-6 h-6" />
            </div>

            <div className="text-center">
              <h3 className="text-base font-black text-white">Fechar Caixa e Encerrar Turno?</h3>
              <p className="text-xs text-slate-400 mt-1">
                Ao fechar, os totais serão consolidados e as movimentações deste turno serão
                arquivadas para auditoria.
              </p>
            </div>

            <div className="bg-[#0E1015] p-3.5 rounded-2xl border border-slate-800 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Total Vendas:</span>
                <strong className="text-white font-mono">R$ {faturamentoTotal.toFixed(2)}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Dinheiro Físico em Gaveta:</span>
                <strong className="text-amber-400 font-mono">R$ {saldoGaveta.toFixed(2)}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Total PIX:</span>
                <strong className="text-teal-400 font-mono">R$ {revenuePix.toFixed(2)}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Total Cartão:</span>
                <strong className="text-sky-400 font-mono">R$ {revenueCartao.toFixed(2)}</strong>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsConfirmingClose(false)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={handleExecuteClose}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white font-black text-xs rounded-xl shadow"
              >
                Confirmar Fechamento
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
