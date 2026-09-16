import React, { useState } from 'react';
import { ShoppingBag, Bike, Zap } from 'lucide-react';
import { apiCreateOrder, newIdempotencyKey } from '../lib/ordersApi';
import { useToast } from '../context/ToastContext';

interface QuickCartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
}

interface BalcaoDeliveryQuickEntryProps {
  restaurantId: string;
  cart: QuickCartItem[];
  onOrderSent: () => void;
}

/**
 * Seção "Delivery / Retirada no Balcão (1 a 100)" do pedido de POS:
 *  - o campo numérico começa OCULTO — só um botão "Balcão/Retirada";
 *  - assim que o operador toca, o campo aparece e o teclado numérico já
 *    focado, sem tela intermediária;
 *  - "Enviar Pedido" fecha em 1 clique: cria e já envia pro Kanban/cozinha
 *    de uma vez, sem confirmação extra (a única confirmação é o próprio toque).
 */
export function BalcaoDeliveryQuickEntry({ restaurantId, cart, onOrderSent }: BalcaoDeliveryQuickEntryProps) {
  const [mode, setMode] = useState<'balcao' | 'delivery' | null>(null);
  const [code, setCode] = useState('');
  const [sending, setSending] = useState(false);
  const { showToast } = useToast();

  const total = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);

  const codeValid = code !== '' && Number(code) >= 1 && Number(code) <= 100;

  const sendOneClick = async () => {
    if (!mode || cart.length === 0) return;
    setSending(true);
    try {
      await apiCreateOrder({
        restaurantId,
        source: mode === 'delivery' ? 'delivery' : 'balcao',
        orderType: mode === 'delivery' ? 'delivery' : 'retirada',
        pickupCode: codeValid ? Number(code) : undefined,
        idempotencyKey: newIdempotencyKey(),
        items: cart.map((i) => ({ productId: i.productId, quantity: i.quantity })),
      } as any);
      showToast(
        mode === 'delivery' ? 'Pedido de delivery enviado! 🛵' : `Retirada #${code || '—'} enviada pro caixa! ✅`,
        'success'
      );
      setMode(null);
      setCode('');
      onOrderSent();
    } catch (err) {
      showToast((err as Error).message, 'error');
    } finally {
      setSending(false);
    }
  };

  if (!mode) {
    return (
      <div className="flex gap-3">
        <button
          onClick={() => setMode('balcao')}
          className="flex-1 flex flex-col items-center gap-2 rounded-xl border border-white/10 py-4 hover:bg-white/5"
        >
          <ShoppingBag size={20} />
          <span className="text-sm font-medium">Balcão / Retirada</span>
        </button>
        <button
          onClick={() => setMode('delivery')}
          className="flex-1 flex flex-col items-center gap-2 rounded-xl border border-white/10 py-4 hover:bg-white/5"
        >
          <Bike size={20} />
          <span className="text-sm font-medium">Delivery</span>
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/10 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="font-medium">{mode === 'delivery' ? 'Delivery' : 'Balcão / Retirada'}</span>
        <button onClick={() => setMode(null)} className="text-xs text-white/40 underline">
          voltar
        </button>
      </div>

      {/* Campo oculto por padrão: só existe DEPOIS que o operador escolheu o modo,
          e mesmo assim é opcional digitar — não trava o fluxo. */}
      <input
        autoFocus
        type="number"
        min={1}
        max={100}
        inputMode="numeric"
        placeholder="Número (1-100, opcional)"
        value={code}
        onChange={(e) => setCode(e.target.value.slice(0, 3))}
        className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-3 text-lg text-center tracking-widest"
      />

      <div className="flex items-center justify-between text-sm text-white/60">
        <span>{cart.length} {cart.length === 1 ? 'item' : 'itens'}</span>
        <span className="font-semibold text-white">R$ {total.toFixed(2)}</span>
      </div>

      <button
        onClick={sendOneClick}
        disabled={sending || cart.length === 0}
        className="w-full flex items-center justify-center gap-2 rounded-xl bg-white text-black py-3 font-semibold disabled:opacity-40"
      >
        <Zap size={16} /> {sending ? 'Enviando…' : 'Enviar Pedido'}
      </button>
    </div>
  );
}
