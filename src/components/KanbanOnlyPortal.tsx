import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Order, OrderStatus } from '../types';
import { kanbanLogin, fetchOrdersAdmin, updateOrderAdmin, subscribeToOrderEvents } from '../utils/api';
import { playOrderAlertSound, unlockOrderAlertAudio, playSoundEffect } from '../utils/helpers';
import { ConnectionBanner } from './ConnectionBanner';
import { Lock, RefreshCw, LogOut } from 'lucide-react';

// Kanban INDIVIDUAL (evolução v24_2) — acesso restrito a UM restaurante só
// com uma senha própria (não é o login completo do admin): pensado pra
// cozinha/balcão acompanhar e avançar pedidos sem enxergar cardápio,
// configurações, usuários ou financeiro. A senha é definida em
// Configurações → 🔒 Senhas de segurança, dentro do painel completo.
const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  recebido: 'em_preparo',
  em_preparo: 'pronto',
  pronto: 'saiu_entrega',
  saiu_entrega: 'entregue',
};

const COLUMN_DEFS: { status: OrderStatus; label: string; color: string }[] = [
  { status: 'recebido', label: '🆕 Novos', color: 'bg-amber-50 border-amber-200' },
  { status: 'em_preparo', label: '👨‍🍳 Em preparo', color: 'bg-blue-50 border-blue-200' },
  { status: 'pronto', label: '✅ Pronto', color: 'bg-purple-50 border-purple-200' },
  { status: 'saiu_entrega', label: '🛵 Saiu p/ entrega', color: 'bg-indigo-50 border-indigo-200' },
];

function tokenKey(slug: string) {
  return `tokioinbox_kanban_token_${slug}`;
}

export const KanbanOnlyPortal: React.FC<{ slug: string }> = ({ slug }) => {
  const [token, setToken] = useState<string | null>(() => sessionStorage.getItem(tokenKey(slug)));
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const pendingAlertIds = useRef<Set<string>>(new Set());

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoggingIn(true);
    setLoginError(null);
    try {
      const t = await kanbanLogin(slug, password);
      sessionStorage.setItem(tokenKey(slug), t);
      unlockOrderAlertAudio(); // toque no botão = gesto do usuário, destrava o áudio
      setToken(t);
    } catch (err: any) {
      setLoginError(err?.message || 'Senha incorreta.');
    } finally {
      setLoggingIn(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem(tokenKey(slug));
    setToken(null);
    setOrders([]);
  };

  const refresh = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const list = await fetchOrdersAdmin(slug, token);
      const newOnes = list.filter((o) => o.status === 'recebido' && !pendingAlertIds.current.has(o.id));
      if (newOnes.length > 0) {
        newOnes.forEach((o) => pendingAlertIds.current.add(o.id));
        playOrderAlertSound();
        try { navigator.vibrate?.([250, 120, 250]); } catch {}
      }
      setOrders(list);
    } catch (err: any) {
      if (String(err?.message || '').includes('401')) handleLogout();
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, token]);

  useEffect(() => {
    if (!token) return;
    refresh();
    const interval = setInterval(refresh, 8000); // fallback caso o SSE caia
    const controller = new AbortController();
    subscribeToOrderEvents(slug, token, (event) => {
      if (event.type === 'created' || event.type === 'updated') refresh();
    }, controller.signal);
    document.addEventListener('pointerdown', unlockOrderAlertAudio, { passive: true });
    return () => {
      clearInterval(interval);
      controller.abort();
      document.removeEventListener('pointerdown', unlockOrderAlertAudio);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, slug]);

  const handleAdvance = async (order: Order) => {
    const next = NEXT_STATUS[order.status];
    if (!next || !token) return;
    pendingAlertIds.current.delete(order.id);
    setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status: next } : o)));
    try {
      await updateOrderAdmin(slug, token, order.id, { status: next });
      playSoundEffect('success');
    } catch {
      refresh(); // desfaz a atualização otimista se der erro
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-stone-900 flex items-center justify-center px-4">
        <form onSubmit={handleLogin} className="bg-white rounded-2xl p-8 w-full max-w-sm">
          <div className="w-12 h-12 rounded-xl bg-stone-900 text-white flex items-center justify-center mb-4">
            <Lock size={22} />
          </div>
          <h1 className="text-xl font-bold text-stone-900 mb-1">Kanban — {slug}</h1>
          <p className="text-sm text-stone-500 mb-6">Acesso restrito só ao quadro de pedidos deste restaurante</p>
          <input
            type="password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Senha do Kanban"
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

  return (
    <div className="min-h-screen bg-stone-100 p-4">
      <ConnectionBanner soundEnabled onReconnect={refresh} />
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-black text-stone-900">🍽️ Kanban — {slug}</h1>
        <div className="flex items-center gap-2">
          <button onClick={refresh} className="p-2 rounded-xl bg-white border border-stone-200 text-stone-600" title="Atualizar">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={handleLogout} className="p-2 rounded-xl bg-white border border-stone-200 text-stone-600" title="Sair">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {COLUMN_DEFS.map((col) => {
          const columnOrders = orders.filter((o) => o.status === col.status);
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
