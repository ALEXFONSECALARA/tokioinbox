import React, { useEffect, useState, useCallback } from 'react';
import { Plus, Minus, Receipt, ArrowLeft, Loader2 } from 'lucide-react';
import { listTables, updateTableStatus, ensureTableExists, buildTableGrid, getMenuInstant, TableRow, CategoryRow, ProductRow } from '../lib/operationalData';
import { apiCreateOrder, newIdempotencyKey } from '../lib/ordersApi';
import { useRealtimeOrders } from '../hooks/useRealtimeOrders';

const STATUS_LABEL: Record<TableRow['status'], string> = {
  livre: 'Livre',
  ocupada: 'Ocupada',
  aguardando_conta: 'Aguardando conta',
  fechando: 'Fechando',
};
const STATUS_COLOR: Record<TableRow['status'], string> = {
  livre: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  ocupada: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  aguardando_conta: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
  fechando: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
};

interface WaiterViewProps {
  restaurantId: string;
  restaurantName: string;
  userId: string;
}

/** Seção 12 do briefing: "Minhas Mesas" com poucos cliques, pensado pra celular primeiro. */
export function WaiterView({ restaurantId, restaurantName, userId }: WaiterViewProps) {
  const [tables, setTables] = useState<TableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTable, setSelectedTable] = useState<TableRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const rows = await listTables(restaurantId);
      setTables(rows);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const { connected } = useRealtimeOrders(restaurantId, reload);

  const tableGrid = buildTableGrid(tables, 50);

  const openTable = async (t: TableRow & { virtual?: boolean }) => {
    if (t.virtual) {
      // seção "Mesas 1 a 50": a mesa só é criada de fato no toque, sem cadastro prévio manual
      const created = await ensureTableExists(restaurantId, t.number);
      setSelectedTable(created);
    } else {
      setSelectedTable(t);
    }
  };

  if (selectedTable) {
    return (
      <TableOrderView
        table={selectedTable}
        restaurantId={restaurantId}
        userId={userId}
        onBack={() => {
          setSelectedTable(null);
          reload();
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#07090E] text-white pb-24">
      <header className="sticky top-0 z-10 bg-[#07090E]/95 backdrop-blur border-b border-white/10 px-4 py-4">
        <h1 className="text-lg font-semibold">Minhas Mesas</h1>
        <p className="text-sm text-white/50">{restaurantName}</p>
        <span className={`mt-1 inline-block text-xs ${connected ? 'text-emerald-400' : 'text-amber-400'}`}>
          {connected ? '● Ao vivo' : '○ Reconectando...'}
        </span>
      </header>

      <div className="p-4">
        {loading && <p className="text-white/50">Carregando mesas…</p>}
        {error && <p className="text-rose-400">{error}</p>}
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {tableGrid.map((t) => (
            <button
              key={t.id}
              onClick={() => openTable(t)}
              className={`rounded-xl border p-3 text-center active:scale-95 transition ${STATUS_COLOR[t.status]}`}
            >
              <div className="text-lg font-bold leading-tight">{t.number}</div>
              <span className="text-[10px] font-medium">{STATUS_LABEL[t.status]}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

interface TableOrderViewProps {
  table: TableRow;
  restaurantId: string;
  userId: string;
  onBack: () => void;
}

function TableOrderView({ table, restaurantId, userId, onBack }: TableOrderViewProps) {
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    // Item 4: cardápio carrega instantâneo do IndexedDB (se já visitou antes)
    // e revalida em segundo plano — o garçom não fica esperando o cardápio
    // baixar de novo toda vez que abre uma mesa.
    getMenuInstant(restaurantId, ({ categories, products }) => {
      setCategories(categories);
      setProducts(products);
      setActiveCategory((prev) => prev ?? categories[0]?.id ?? null);
    }).then((cached) => {
      if (cached) {
        setCategories(cached.categories);
        setProducts(cached.products);
        setActiveCategory(cached.categories[0]?.id ?? null);
      }
    });
  }, [restaurantId]);

  const addToCart = (productId: string, delta: number) => {
    setCart((prev) => {
      const next = { ...prev, [productId]: Math.max(0, (prev[productId] ?? 0) + delta) };
      if (next[productId] === 0) delete next[productId];
      return next;
    });
  };

  const itemCount = (Object.values(cart) as number[]).reduce((a, b) => a + b, 0);

  const sendOrder = async () => {
    if (itemCount === 0) return;
    setSending(true);
    setMessage(null);
    try {
      await apiCreateOrder({
        restaurantId,
        source: 'mesa',
        orderType: 'mesa',
        tableId: table.id,
        idempotencyKey: newIdempotencyKey(),
        items: (Object.entries(cart) as [string, number][]).map(([productId, quantity]) => ({ productId, quantity })),
      });
      if (table.status === 'livre') await updateTableStatus(table.id, 'ocupada');
      setCart({});
      setMessage('Pedido enviado para a cozinha! ✅');
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setSending(false);
    }
  };

  const requestBill = async () => {
    await updateTableStatus(table.id, 'aguardando_conta');
    onBack();
  };

  const visibleProducts = products.filter((p) => !activeCategory || p.category_id === activeCategory);

  return (
    <div className="min-h-screen bg-[#07090E] text-white pb-32">
      <header className="sticky top-0 z-10 bg-[#07090E]/95 backdrop-blur border-b border-white/10 px-4 py-4 flex items-center gap-3">
        <button onClick={onBack} className="p-1"><ArrowLeft size={20} /></button>
        <h1 className="text-lg font-semibold">Mesa {table.number}</h1>
      </header>

      <div className="flex gap-2 overflow-x-auto px-4 py-3">
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => setActiveCategory(c.id)}
            className={`shrink-0 px-4 py-2 rounded-full text-sm border ${
              activeCategory === c.id ? 'bg-white text-black border-white' : 'border-white/20 text-white/70'
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>

      <div className="px-4 space-y-2">
        {visibleProducts.map((p) => (
          <div key={p.id} className="flex items-center justify-between rounded-xl border border-white/10 p-3">
            <div>
              <p className="font-medium">{p.name}</p>
              <p className="text-sm text-white/50">R$ {p.price.toFixed(2)}</p>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => addToCart(p.id, -1)} className="p-2 rounded-full bg-white/10"><Minus size={16} /></button>
              <span className="w-5 text-center">{cart[p.id] ?? 0}</span>
              <button onClick={() => addToCart(p.id, 1)} className="p-2 rounded-full bg-white/10"><Plus size={16} /></button>
            </div>
          </div>
        ))}
      </div>

      {message && <p className="px-4 py-2 text-sm text-center text-white/70">{message}</p>}

      <div className="fixed bottom-0 inset-x-0 bg-[#07090E] border-t border-white/10 p-4 flex gap-3">
        <button
          onClick={requestBill}
          className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-white/20 py-3 text-sm font-medium"
        >
          <Receipt size={16} /> Solicitar Conta
        </button>
        <button
          onClick={sendOrder}
          disabled={itemCount === 0 || sending}
          className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-white text-black py-3 text-sm font-semibold disabled:opacity-40"
        >
          {sending ? <Loader2 className="animate-spin" size={16} /> : `Enviar Pedido (${itemCount})`}
        </button>
      </div>
    </div>
  );
}
