import React, { useEffect, useState } from 'react';
import { CustomerAccount, SavedAddress, Order } from './types';
import { formatCurrency } from './utils__helpers';
import {
  registerCustomer,
  loginCustomer,
  fetchCustomerAddresses,
  saveCustomerAddress,
  updateCustomerAddress,
  deleteCustomerAddress,
  fetchCustomerOrders,
  cancelCustomerOrder,
  clearCustomerOrderHistory,
} from './utils__api';
import { X, User, MapPin, Package, LogOut, Plus, Trash2, Star, Loader2, Ban } from 'lucide-react';

// Rótulos sugeridos (item 21) — o cliente também pode digitar outro texto.
const ADDRESS_LABELS = ['🏠 Casa', '🏢 Trabalho', '📍 Outro'];

const EMPTY_ADDRESS_FORM = {
  label: ADDRESS_LABELS[0],
  cep: '',
  street: '',
  number: '',
  unit: '',
  complement: '',
  neighborhood: '',
  city: '',
  state: '',
};

interface CustomerAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: string | null;
  customer: CustomerAccount | null;
  onLoggedIn: (token: string, customer: CustomerAccount) => void;
  onLoggedOut: () => void;
  // Permite ao checkout aproveitar o endereço escolhido aqui, se o cliente
  // abrir "Minha Conta" a partir do próprio checkout.
  onUseAddress?: (address: SavedAddress) => void;
}

type Tab = 'perfil' | 'enderecos' | 'pedidos';

export const CustomerAccountModal: React.FC<CustomerAccountModalProps> = ({
  isOpen,
  onClose,
  token,
  customer,
  onLoggedIn,
  onLoggedOut,
  onUseAddress,
}) => {
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [tab, setTab] = useState<Tab>('perfil');

  // Login/cadastro
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  // Endereços salvos
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [loadingAddresses, setLoadingAddresses] = useState(false);
  const [addressForm, setAddressForm] = useState<typeof EMPTY_ADDRESS_FORM | null>(null);
  const [savingAddress, setSavingAddress] = useState(false);

  // Histórico entre restaurantes
  const [orders, setOrders] = useState<(Order & { restaurantSlug: string; restaurantName: string })[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [orderActionId, setOrderActionId] = useState<string | null>(null);
  const [historyPassword, setHistoryPassword] = useState('');
  const [historyDeleting, setHistoryDeleting] = useState(false);

  useEffect(() => {
    if (isOpen && token) {
      setTab('perfil');
    }
  }, [isOpen, token]);

  useEffect(() => {
    if (isOpen && token && tab === 'enderecos') {
      setLoadingAddresses(true);
      fetchCustomerAddresses(token)
        .then(setAddresses)
        .catch(() => {})
        .finally(() => setLoadingAddresses(false));
    }
    if (isOpen && token && tab === 'pedidos') {
      setLoadingOrders(true);
      fetchCustomerOrders(token)
        .then(setOrders)
        .catch(() => {})
        .finally(() => setLoadingOrders(false));
    }
  }, [isOpen, token, tab]);

  if (!isOpen) return null;

  const normalizePhone = (value: string) => value.replace(/\D/g, '');

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError(null);
    try {
      if (authMode === 'login') {
        const res = await loginCustomer(normalizePhone(phone), password);
        onLoggedIn(res.token, res.customer);
      } else {
        const cleanName=name.trim(); const cleanPhone=normalizePhone(phone); const cleanEmail=email.trim().toLowerCase(); if(cleanName.length<2) throw new Error('Informe seu nome completo.'); if(cleanPhone.length<10||cleanPhone.length>13) throw new Error('Informe um telefone válido com DDD.'); if(!/^\d{4}$/.test(password)) throw new Error('A senha deve ter exatamente 4 dígitos numéricos.'); const res = await registerCustomer({ name:cleanName, phone:cleanPhone, email:cleanEmail||undefined, password });
        onLoggedIn(res.token, res.customer);
      }
      setPassword('');
    } catch (err: any) {
      setAuthError(err?.message || 'Não foi possível entrar.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSaveAddress = async () => {
    if (!token || !addressForm) return;
    if (!addressForm.street.trim() || !addressForm.number.trim() || !addressForm.neighborhood.trim()) return;
    setSavingAddress(true);
    try {
      const saved = await saveCustomerAddress(token, addressForm);
      setAddresses((prev) => [...prev, saved]);
      setAddressForm(null);
    } catch (err) {
      // erro silencioso na UI compacta — o formulário continua aberto pro cliente tentar de novo
    } finally {
      setSavingAddress(false);
    }
  };

  const handleDeleteAddress = async (id: string) => {
    if (!token) return;
    try {
      await deleteCustomerAddress(token, id);
      setAddresses((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      // idem
    }
  };

  const handleSetDefault = async (id: string) => {
    if (!token) return;
    try {
      await updateCustomerAddress(token, id, { isDefault: true });
      setAddresses((prev) => prev.map((a) => ({ ...a, isDefault: a.id === id })));
    } catch (err) {
      // idem
    }
  };

  const handleCancelOrder = async (order: Order & { restaurantSlug: string; restaurantName: string }) => {
    if (!token || orderActionId) return;
    if (!['recebido', 'em_preparo'].includes(order.status)) return;
    const confirmed = window.confirm(`Cancelar o pedido #${order.orderNumber}? Essa ação não pode ser desfeita.`);
    if (!confirmed) return;
    setOrderActionId(order.id);
    try {
      const updated = await cancelCustomerOrder(token, order.restaurantSlug, order.id);
      setOrders((prev) => prev.map((item) => item.id === updated.id ? { ...item, ...updated } : item));
    } catch (err: any) {
      window.alert(err?.message || 'Não foi possível cancelar o pedido.');
      try {
        const fresh = await fetchCustomerOrders(token);
        setOrders(fresh);
      } catch {}
    } finally {
      setOrderActionId(null);
    }
  };

  const handleDeleteHistory = async () => {
    if (!token || historyDeleting) return;
    if (!/^\d{4}$/.test(historyPassword)) {
      window.alert('Digite sua senha de 4 dígitos.');
      return;
    }
    if (!window.confirm('Excluir todo o seu histórico de pedidos? Essa ação não pode ser desfeita.')) return;
    setHistoryDeleting(true);
    try {
      const removed = await clearCustomerOrderHistory(token, historyPassword);
      setOrders([]);
      setHistoryPassword('');
      window.alert(`${removed} pedido(s) removido(s) do histórico.`);
    } catch (err: any) {
      window.alert(err?.message || 'Não foi possível excluir o histórico.');
    } finally {
      setHistoryDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center">
      <div className="bg-white w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl max-h-[92dvh] overflow-y-auto p-4 sm:p-5 space-y-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center justify-between border-b border-stone-100 pb-3">
          <h2 className="font-black text-lg text-stone-900 flex items-center gap-2">
            <User className="w-5 h-5" /> {customer ? `Olá, ${customer.name.split(' ')[0]} 👋` : 'Minha Conta'}
          </h2>
          <button onClick={onClose} className="p-1 text-stone-400 hover:text-stone-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        {!token || !customer ? (
          <form onSubmit={handleAuthSubmit} className="space-y-3">
            <div className="rounded-xl bg-stone-50 border border-stone-200 p-3 text-xs text-stone-600"><strong className="text-stone-900">Conta única do cliente</strong><br/>Use o mesmo telefone e senha em qualquer restaurante do multicardápio. Esta conta é separada do login administrativo.</div>
            <div className="flex gap-2 bg-stone-100 rounded-xl p-1">
              <button
                type="button"
                onClick={() => setAuthMode('login')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold ${authMode === 'login' ? 'bg-white shadow-sm text-stone-900' : 'text-stone-500'}`}
              >
                Entrar
              </button>
              <button
                type="button"
                onClick={() => setAuthMode('register')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold ${authMode === 'register' ? 'bg-white shadow-sm text-stone-900' : 'text-stone-500'}`}
              >
                Criar conta
              </button>
            </div>

            {authMode === 'register' && (
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nome"
                className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm"
              />
            )}
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Telefone (com DDD)"
              className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm"
            />
            {authMode === 'register' && (
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="E-mail (opcional)"
                className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm"
              />
            )}
            <input
              type="password"
              inputMode="numeric"
              pattern="\d*"
              maxLength={4}
              value={password}
              onChange={(e) => setPassword(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder={authMode === 'register' ? 'Crie uma senha de 4 dígitos' : 'Senha (4 dígitos)'}
              className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm tracking-[0.5em] text-center"
            />
            {authError && <p className="text-xs text-red-600">{authError}</p>}
            <button
              type="submit"
              disabled={
                authLoading ||
                !phone ||
                password.length !== 4 ||
                (authMode === 'register' && !name)
              }
              className="w-full bg-stone-900 text-white rounded-xl py-2.5 font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {authLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              {authMode === 'login' ? 'Entrar' : 'Criar conta'}
            </button>
            <p className="text-[11px] text-stone-400 text-center">
              {authMode === 'register'
                ? 'Sua senha é um PIN de 4 dígitos — fácil de digitar e lembrar na hora do pedido.'
                : 'Guarde seus dados pra pedir mais rápido nas próximas vezes.'}
            </p>
          </form>
        ) : (
          <>
            <div className="flex gap-1 bg-stone-100 rounded-xl p-1">
              {(
                [
                  ['perfil', 'Perfil', User],
                  ['enderecos', 'Endereços', MapPin],
                  ['pedidos', 'Pedidos', Package],
                ] as const
              ).map(([id, label, Icon]) => (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 ${
                    tab === id ? 'bg-white shadow-sm text-stone-900' : 'text-stone-500'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" /> {label}
                </button>
              ))}
            </div>

            {tab === 'perfil' && (
              <div className="space-y-2">
                <p className="text-sm text-stone-700">
                  <span className="font-bold">Nome:</span> {customer.name}
                </p>
                <p className="text-sm text-stone-700">
                  <span className="font-bold">Telefone:</span> {customer.phone}
                </p>
                {customer.email && (
                  <p className="text-sm text-stone-700">
                    <span className="font-bold">E-mail:</span> {customer.email}
                  </p>
                )}
                <button
                  onClick={onLoggedOut}
                  className="w-full mt-2 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-stone-200 text-stone-600 text-xs font-bold hover:bg-stone-50"
                >
                  <LogOut className="w-3.5 h-3.5" /> Sair da conta
                </button>
              </div>
            )}

            {tab === 'enderecos' && (
              <div className="space-y-2">
                {loadingAddresses && <p className="text-xs text-stone-400">Carregando...</p>}
                {!loadingAddresses &&
                  addresses.map((addr) => (
                    <div key={addr.id} className="border border-stone-200 rounded-xl p-3 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-stone-800">{addr.label}</span>
                        <div className="flex items-center gap-1.5">
                          {!addr.isDefault && (
                            <button
                              onClick={() => handleSetDefault(addr.id)}
                              title="Tornar padrão"
                              className="p-1 text-stone-400 hover:text-amber-500"
                            >
                              <Star className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {addr.isDefault && <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />}
                          <button
                            onClick={() => handleDeleteAddress(addr.id)}
                            title="Excluir"
                            className="p-1 text-stone-400 hover:text-red-500"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <p className="text-xs text-stone-500">
                        {addr.street}, {addr.number} {addr.unit ? `- ${addr.unit}` : ''} · {addr.neighborhood}
                      </p>
                      {onUseAddress && (
                        <button
                          onClick={() => onUseAddress(addr)}
                          className="text-[11px] font-bold text-stone-700 underline"
                        >
                          Usar este endereço
                        </button>
                      )}
                    </div>
                  ))}

                {addressForm ? (
                  <div className="border border-stone-200 rounded-xl p-3 space-y-2">
                    <div className="flex gap-1.5 flex-wrap">
                      {ADDRESS_LABELS.map((l) => (
                        <button
                          key={l}
                          type="button"
                          onClick={() => setAddressForm({ ...addressForm, label: l })}
                          className={`px-2 py-1 rounded-lg text-[11px] font-bold border ${
                            addressForm.label === l ? 'bg-stone-900 text-white border-stone-900' : 'border-stone-200 text-stone-600'
                          }`}
                        >
                          {l}
                        </button>
                      ))}
                    </div>
                    <input
                      value={addressForm.cep}
                      onChange={(e) => setAddressForm({ ...addressForm, cep: e.target.value })}
                      placeholder="CEP"
                      className="w-full border border-stone-200 rounded-lg px-2.5 py-2 text-xs"
                    />
                    <div className="grid grid-cols-3 gap-1.5">
                      <input
                        value={addressForm.street}
                        onChange={(e) => setAddressForm({ ...addressForm, street: e.target.value })}
                        placeholder="Rua"
                        className="col-span-2 border border-stone-200 rounded-lg px-2.5 py-2 text-xs"
                      />
                      <input
                        value={addressForm.number}
                        onChange={(e) => setAddressForm({ ...addressForm, number: e.target.value })}
                        placeholder="Número"
                        className="border border-stone-200 rounded-lg px-2.5 py-2 text-xs"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <input
                        value={addressForm.unit}
                        onChange={(e) => setAddressForm({ ...addressForm, unit: e.target.value })}
                        placeholder="Apto/Bloco"
                        className="border border-stone-200 rounded-lg px-2.5 py-2 text-xs"
                      />
                      <input
                        value={addressForm.neighborhood}
                        onChange={(e) => setAddressForm({ ...addressForm, neighborhood: e.target.value })}
                        placeholder="Bairro"
                        className="border border-stone-200 rounded-lg px-2.5 py-2 text-xs"
                      />
                    </div>
                    <input
                      value={addressForm.complement}
                      onChange={(e) => setAddressForm({ ...addressForm, complement: e.target.value })}
                      placeholder="Complemento (opcional)"
                      className="w-full border border-stone-200 rounded-lg px-2.5 py-2 text-xs"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => setAddressForm(null)}
                        className="flex-1 py-2 rounded-lg text-stone-500 text-xs font-bold"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleSaveAddress}
                        disabled={savingAddress}
                        className="flex-1 py-2 rounded-lg bg-stone-900 text-white text-xs font-bold disabled:opacity-50"
                      >
                        {savingAddress ? 'Salvando...' : 'Salvar endereço'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setAddressForm({ ...EMPTY_ADDRESS_FORM })}
                    className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-dashed border-stone-300 text-stone-600 text-xs font-bold hover:bg-stone-50"
                  >
                    <Plus className="w-3.5 h-3.5" /> Adicionar novo endereço
                  </button>
                )}
              </div>
            )}

            {tab === 'pedidos' && (
              <div className="space-y-2">
                {loadingOrders && <p className="text-xs text-stone-400">Carregando...</p>}
                {!loadingOrders && orders.length === 0 && (
                  <p className="text-xs text-stone-400">Você ainda não fez nenhum pedido com esta conta.</p>
                )}
                {orders.map((order) => (
                  <div key={order.id} className="border border-stone-200 rounded-xl p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-stone-800">
                        #{order.orderNumber} · {order.restaurantName}
                      </span>
                      <span className="text-xs font-bold text-stone-900">{formatCurrency(order.total)}</span>
                    </div>
                    <p className="text-[11px] text-stone-500">
                      {new Date(order.createdAt).toLocaleDateString('pt-BR')} · {order.status}
                    </p>
                    {['recebido', 'em_preparo'].includes(order.status) && (
                      <button onClick={() => handleCancelOrder(order)} disabled={orderActionId === order.id} className="w-full py-2 rounded-lg border border-red-200 text-red-700 text-[11px] font-bold flex items-center justify-center gap-1.5 disabled:opacity-50">
                        {orderActionId === order.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Ban className="w-3.5 h-3.5" />}
                        {orderActionId === order.id ? 'Cancelando...' : 'Cancelar pedido'}
                      </button>
                    )}
                  </div>
                ))}
                {!loadingOrders && orders.length > 0 && (
                  <div className="border-t border-stone-100 pt-3 mt-3 space-y-2">
                    <p className="text-[11px] text-stone-500">Excluir o histórico remove permanentemente os pedidos desta conta.</p>
                    <input value={historyPassword} onChange={(e) => setHistoryPassword(e.target.value.replace(/\D/g, '').slice(0, 4))} inputMode="numeric" maxLength={4} type="password" placeholder="Senha de 4 dígitos" className="w-full border border-stone-200 rounded-lg px-2.5 py-2 text-xs" />
                    <button onClick={handleDeleteHistory} disabled={historyDeleting} className="w-full py-2 rounded-lg bg-red-50 text-red-700 text-[11px] font-bold disabled:opacity-50">
                      {historyDeleting ? 'Excluindo histórico...' : 'Excluir histórico de pedidos'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
