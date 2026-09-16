import React, { useEffect, useState } from 'react';
import { getMenuInstant, CategoryRow, ProductRow } from '../lib/operationalData';
import { BalcaoDeliveryQuickEntry } from './BalcaoDeliveryQuickEntry';
import { Plus, Minus } from 'lucide-react';

interface BalcaoDeliveryViewProps {
  restaurantId: string;
}

/**
 * Junta o cardápio (com cache instantâneo em IndexedDB) ao fluxo de 1 clique
 * de Balcão/Delivery — completa a seção "Fluxo de Atendimento Rápido" do
 * pedido de POS pro caso que não é mesa.
 */
export function BalcaoDeliveryView({ restaurantId }: BalcaoDeliveryViewProps) {
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
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
  }, [restaurantId, refreshKey]);

  const addToCart = (productId: string, delta: number) => {
    setCart((prev) => {
      const next = { ...prev, [productId]: Math.max(0, (prev[productId] ?? 0) + delta) };
      if (next[productId] === 0) delete next[productId];
      return next;
    });
  };

  const cartItems = (Object.entries(cart) as [string, number][]).map(([productId, quantity]) => {
    const product = products.find((p) => p.id === productId)!;
    return { productId, name: product?.name ?? '—', price: product?.price ?? 0, quantity };
  });

  const visibleProducts = products.filter((p) => !activeCategory || p.category_id === activeCategory);

  return (
    <div className="p-4 pb-6 space-y-4">
      <div className="flex gap-2 overflow-x-auto">
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

      <div className="space-y-2 max-h-[45vh] overflow-y-auto">
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

      <BalcaoDeliveryQuickEntry
        restaurantId={restaurantId}
        cart={cartItems}
        onOrderSent={() => {
          setCart({});
          setRefreshKey((k) => k + 1);
        }}
      />
    </div>
  );
}
