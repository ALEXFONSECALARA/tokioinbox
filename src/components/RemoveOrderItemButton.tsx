import React, { useState } from 'react';
import { Trash2, X } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import type { Order } from '../types/restaurant';

interface Props {
  order?: Order | null;
  disabled?: boolean;
  className?: string;
}

/**
 * V9.2 — [ 🗑 EXCLUIR ITEM ]: exclui SOMENTE o item selecionado e a quantidade escolhida.
 * Nunca remove o pedido, cliente, mesa ou histórico. Sempre pede confirmação (impacto financeiro)
 * e a operação é gravada no histórico do pedido pelo servidor (auditoria).
 */
export const RemoveOrderItemButton: React.FC<Props> = ({ order, disabled, className }) => {
  const { removeOrderItem } = useStore();
  const [open, setOpen] = useState(false);
  const [itemId, setItemId] = useState('');
  const [qty, setQty] = useState(1);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const items = order?.items || [];
  const selected = items.find((i) => i.id === itemId);
  const unit = selected ? selected.totalPrice / Math.max(1, selected.quantity) : 0;
  const impact = selected ? unit * Math.min(qty, selected.quantity) : 0;

  const close = () => {
    setOpen(false);
    setItemId('');
    setQty(1);
    setReason('');
  };

  const confirm = async () => {
    if (!order || !selected || busy) return;
    const willRemoveAll = qty >= selected.quantity;
    const msg = `Excluir ${Math.min(qty, selected.quantity)}x ${selected.name} (R$ ${impact.toFixed(2)})?\n${
      willRemoveAll ? 'O item será removido por completo do pedido.' : `Restarão ${selected.quantity - qty}x no pedido.`
    }`;
    if (!window.confirm(msg)) return;
    setBusy(true);
    const res = await removeOrderItem({ orderId: order.id, itemId: selected.id, quantity: qty, reason: reason.trim() || undefined });
    setBusy(false);
    if (res?.success) close();
  };

  return (
    <>
      <button
        type="button"
        disabled={disabled || !order || items.length === 0}
        onClick={() => setOpen(true)}
        className={
          className ||
          'px-4 py-2 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-black disabled:opacity-40 flex items-center gap-1.5'
        }
      >
        <Trash2 className="w-3.5 h-3.5" />
        Excluir Item
      </button>

      {open && order && (
        <div className="fixed inset-0 z-[120] bg-black/85 flex items-center justify-center p-3" role="dialog" aria-modal="true">
          <div className="w-full max-w-md bg-[#101622] border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-black text-white uppercase">Excluir item do pedido</h3>
              <button type="button" onClick={close} aria-label="Fechar" className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-3 max-h-[60dvh] overflow-y-auto">
              <div className="space-y-1.5">
                {items.map((it) => (
                  <button
                    key={it.id}
                    type="button"
                    onClick={() => {
                      setItemId(it.id);
                      setQty(1);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-xl border text-xs font-bold flex justify-between gap-2 ${
                      itemId === it.id ? 'border-rose-400 bg-rose-500/10 text-white' : 'border-slate-800 bg-[#121927] text-slate-300'
                    }`}
                  >
                    <span className="truncate">{it.quantity}x {it.name}</span>
                    <span className="font-mono text-amber-400">R$ {it.totalPrice.toFixed(2)}</span>
                  </button>
                ))}
              </div>

              {selected && (
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between text-xs text-slate-300">
                    <span className="font-bold">Quantidade a excluir</span>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} className="w-8 h-8 rounded-lg bg-slate-800 text-white font-black">−</button>
                      <span className="w-8 text-center font-black text-white">{qty}</span>
                      <button type="button" onClick={() => setQty((q) => Math.min(selected.quantity, q + 1))} className="w-8 h-8 rounded-lg bg-slate-800 text-white font-black">+</button>
                    </div>
                  </div>
                  <input
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    maxLength={200}
                    placeholder="Motivo (opcional, fica no histórico)"
                    className="w-full bg-[#0E1015] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                  />
                  <p className="text-[11px] text-slate-400">
                    Impacto: −R$ {impact.toFixed(2)}. Somente este item é alterado; pedido, mesa e cliente permanecem.
                  </p>
                </div>
              )}
            </div>
            <div className="p-4 border-t border-slate-800 flex gap-2 justify-end">
              <button type="button" onClick={close} className="px-4 py-2 rounded-xl bg-slate-800 text-slate-200 text-xs font-bold">Cancelar</button>
              <button
                type="button"
                disabled={!selected || busy}
                onClick={confirm}
                className="px-4 py-2 rounded-xl bg-rose-500 text-white text-xs font-black disabled:opacity-40"
              >
                {busy ? 'Excluindo…' : 'Excluir item'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
