import React, { useCallback, useEffect, useRef, useState } from 'react';
import { OrderStatus } from '../types';
import { kanbanAllLogin, fetchKanbanAllOrders, updateKanbanAllOrderStatus, KanbanAllOrder } from '../utils/api';
import { playOrderAlertSound, unlockOrderAlertAudio, playSoundEffect } from '../utils/helpers';
import { ConnectionBanner } from './ConnectionBanner';
import { Lock, RefreshCw, LogOut } from 'lucide-react';

// Kanban ÚNICO (evolução v24_2) — todos os restaurantes agrupados numa tela
// só, pra quem administra várias lojas de um lugar central (ex: cozinha
// compartilhada / dark kitchen com várias marcas). Senha de autorização
// própria (KANBAN_ALL_PASSWORD), separada do login normal do admin — mas a
// senha mestre (ADMIN_PASSWORD) também sempre funciona aqui.
const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  recebido: 'em_preparo',
  em_preparo: 'pronto',
  pronto: 'saiu_entrega',
  saiu_entrega: 'entregue',
};

const TOKEN_KEY = 'tokioinbox_kanban_all_token';

export const UnifiedKanbanPortal: React.FC = () => {
  const [token, setToken] = useState<string | null>(() => sessionStorage.getItem(TOKEN_KEY));
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);
  const [orders, setOrders] = useState<KanbanAllOrder[]>([]);
  const [restaurantFilter, setRestaurantFilter] = useState<string>('all');
  const [restaurants, setRestaurants] = useState<{ slug: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const pendingAlertIds = useRef<Set<string>>(new Set());

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoggingIn(true);
    setLoginError(null);
    try {
      const t = await kanbanAllLogin(password);
      sessionStorage.setItem(TOKEN_KEY, t);
      unlockOrderAlertAudio();
      setToken(t);
    } catch (err: any) {
      setLoginError(err?.message || 'Senha incorreta.');
    } finally {
      setLoggingIn(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setOrders([]);
  };

  const refresh = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const { orders: list, restaurants: r } = await fetchKanbanAllOrders(token);
      const newOnes = list.filter((o) => o.status === 'recebido' && !pendingAlertIds.current.has(o.id));
      if (newOnes.length > 0) {
        newOnes.forEach((o) => pendingAlertIds.current.add(o.id));
        playOrderAlertSound();
        try { navigator.vibrate?.([250, 120, 250]); } catch {}
      }
      setOrders(list);
      setRestaurants(r);
    } catch (err: any) {
      if (String(err?.message || '').includes('401')) handleLogout();
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (!token) return;
    refresh();
    // Kanban único não tem um único :slug pra assinar via SSE — o polling
    // curto aqui cobre todos os restaurantes de uma vez com uma chamada só.
    const interval = setInterval(refresh, 6000);
    document.addEventListener('pointerdown', unlockOrderAlertAudio, { passive: true });
    return () => {
      clearInterval(interval);
      document.removeEventListener('pointerdown', unlockOrderAlertAudio);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleAdvance = async (order: KanbanAllOrder) => {
    const next = NEXT_STATUS[order.status];
    if (!next || !token) return;
    pendingAlertIds.current.delete(order.id);
    setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status: next } : o)));
    try {
      await updateKanbanAllOrderStatus(token, order.restaurantSlug, order.id, { status: next });
      playSoundEffect('success');
    } catch {
      refresh();
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-stone-900 flex items-center justify-center px-4">
        <form onSubmit={handleLogin} className="bg-white rounded-2xl p-8 w-full max-w-sm">
          <div className="w-12 h-12 rounded-xl bg-stone-900 text-white flex items-center justify-center mb-4">
            <Lock size={22} />
          </div>
          <h1 className="text-xl font-bold text-stone-900 mb-1">Kanban único</h1>
          <p className="text-sm text-stone-500 mb-6">Pedidos de todos os restaurantes numa tela só</p>
          <input
            type="password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Senha de autorização"
            className="w-full border border-stone-300 rounded-xl px-4 py-3 mb-3 focus:outline-none focus:ring-2 focus:ring-stone-800"
          />
          {loginError && <p className="text-sm text-red-600 mb-3">{loginError}</p>}
          <button
            type="submit"
            disabled={loggingIn || !password}
            className="w-full bg-stone-900 text-white rounded-xl py-3 font-medium disabled:opacity-50"
          >
            {loggingIn ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    );
  }

  const filtered = restaurantFilter === 'all' ? orders : orders.filter((o) => o.restaurantSlug === restaurantFilter);
  const columns: { status: OrderStatus; label: string; color: string }[] = [
    { status: 'recebido', label: '🆕 Novos', color: 'bg-amber-50 border-amber-200' },
    { status: 'em_preparo', label: '👨‍🍳 Em preparo', color: 'bg-blue-50 border-blue-200' },
    { status: 'pronto', label: '✅ Pronto', color: 'bg-purple-50 border-purple-200' },
    { status: 'saiu_entrega', label: '🛵 Saiu p/ entrega', color: 'bg-indigo-50 border-indigo-200' },
  ];

  return (
    <div className="min-h-screen bg-stone-100 p-4">
      <ConnectionBanner soundEnabled onReconnect={refresh} />
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h1 className="text-lg font-black text-stone-900">🍽️ Kanban único — todos os restaurantes</h1>
        <div className="flex items-center gap-2">
          <select
            value={restaurantFilter}
            onChange={(e) => setRestaurantFilter(e.target.value)}
            className="border border-stone-200 rounded-xl px-2 py-1.5 text-xs bg-white"
          >
            <option value="all">Todos os restaurantes</option>
            {restaurants.map((r) => (
              <option key={r.slug} value={r.slug}>{r.name}</option>
            ))}
          </select>
          <button onClick={refresh} className="p-2 rounded-xl bg-white border border-stone-200 text-stone-600" title="Atualizar">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={handleLogout} className="p-2 rounded-xl bg-white border border-stone-200 text-stone-600" title="Sair">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {columns.map((col) => {
          const columnOrders = filtered.filter((o) => o.status === col.status);
          return (
            <div key={col.status} className={`rounded-2xl border p-3 min-h-[300px] ${col.color}`}>
              <h2 className="font-black text-sm text-stone-800 mb-2">
                {col.label} ({columnOrders.length})
              </h2>
              <div className="space-y-2">
                {columnOrders.map((order) => (
                  <button
                    key={order.id}
                    onClick={() => handleAdvance(order)}
                    className="w-full text-left bg-white rounded-xl p-3 shadow-sm border border-stone-100 hover:shadow-md transition-shadow"
                  >
                    <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">{order.restaurantName}</p>
                    <p className="font-bold text-sm text-stone-900">#{order.orderNumber} — {order.customer?.name}</p>
                    <p className="text-xs text-stone-500">
                      {order.items?.length || 0} ite{order.items?.length === 1 ? 'm' : 'ns'} · Toque pra avançar
                    </p>
                  </button>
                ))}
                {columnOrders.length === 0 && <p className="text-xs text-stone-400">Nenhum pedido aqui.</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
