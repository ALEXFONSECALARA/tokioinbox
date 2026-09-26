import React from 'react';
import { OrderType } from '../types/restaurant';
import { Utensils, Bike, Package, Store, Globe } from 'lucide-react';
import { useStore } from '../context/StoreContext';

interface OrderOriginBadgeProps {
  orderType: OrderType | string;
  tableNumber?: number;
  pickupNumber?: number;
  shortCode?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'box' | 'inline' | 'compact';
  className?: string;
}

export const OrderOriginBadge: React.FC<OrderOriginBadgeProps> = ({
  orderType,
  tableNumber,
  pickupNumber,
  shortCode,
  size = 'md',
  variant = 'box',
  className = '',
}) => {
  const { salesChannels } = useStore();

  const isMesa = orderType === 'mesa' || orderType === 'dine_in';
  const isBalcao = orderType === 'balcao' || orderType === 'counter';
  const isOnline = orderType === 'online';
  const isDelivery = orderType === 'delivery';
  const isRetirada = orderType === 'retirada' || orderType === 'takeaway';

  // Configured colors
  const mesaColor = salesChannels?.mesa?.color || '#D97706'; // Amber/Gold (COR 2)
  const balcaoColor = salesChannels?.balcao?.color || '#0284C7'; // Cyan/Blue (COR 1)
  const onlineColor = salesChannels?.online?.color || '#7C3AED'; // Purple (COR 3)
  const deliveryColor = salesChannels?.delivery?.color || '#059669'; // Emerald
  const retiradaColor = salesChannels?.retirada?.color || '#2563EB'; // Blue

  if (variant === 'box') {
    if (isBalcao) {
      return (
        <div
          style={{ borderColor: `${balcaoColor}99` }}
          className={`rounded-xl border-2 bg-gradient-to-b from-sky-950/70 to-slate-950 p-2.5 text-center shadow-lg ${className}`}
        >
          <div
            style={{ color: balcaoColor }}
            className="flex items-center justify-center gap-1.5 text-xs font-black tracking-wider uppercase"
          >
            <Store className="w-3.5 h-3.5" />
            <span>🚶 BALCÃO</span>
          </div>
          <div className="text-white font-black text-sm tracking-tight mt-0.5">
            {pickupNumber ? `SENHA #${pickupNumber}` : shortCode ? `SENHA #${shortCode.replace('#', '')}` : 'PEDIDO BALCÃO'}
          </div>
          <div className="text-[10px] text-sky-300/80 font-bold uppercase tracking-wider mt-0.5">
            VENDA DIRETA
          </div>
        </div>
      );
    }

    if (isOnline) {
      return (
        <div
          style={{ borderColor: `${onlineColor}99` }}
          className={`rounded-xl border-2 bg-gradient-to-b from-purple-950/70 to-slate-950 p-2.5 text-center shadow-lg ${className}`}
        >
          <div
            style={{ color: onlineColor }}
            className="flex items-center justify-center gap-1.5 text-xs font-black tracking-wider uppercase"
          >
            <Globe className="w-3.5 h-3.5" />
            <span>🌐 CARDÁPIO ONLINE</span>
          </div>
          {shortCode && (
            <div className="text-white font-black text-sm font-mono tracking-tight mt-0.5">
              PEDIDO #{shortCode.replace('#', '')}
            </div>
          )}
          <div className="text-[10px] text-purple-300/80 font-bold uppercase tracking-wider mt-0.5">
            PEDIDO WEB
          </div>
        </div>
      );
    }

    if (isMesa) {
      return (
        <div
          style={{ borderColor: `${mesaColor}99` }}
          className={`rounded-xl border-2 bg-gradient-to-b from-amber-950/70 to-slate-950 p-2.5 text-center shadow-lg ${className}`}
        >
          <div
            style={{ color: mesaColor }}
            className="flex items-center justify-center gap-1.5 text-xs font-black tracking-wider uppercase"
          >
            <Utensils className="w-3.5 h-3.5" />
            <span>🍽️ SALÃO / CASA</span>
          </div>
          <div className="text-white font-black text-sm tracking-tight mt-0.5">
            MESA {tableNumber !== undefined ? String(tableNumber).padStart(2, '0') : '--'}
          </div>
          {shortCode && (
            <div className="text-[11px] font-mono font-bold text-amber-300/80 mt-0.5">
              PEDIDO #{shortCode.replace('#', '')}
            </div>
          )}
        </div>
      );
    }

    if (isDelivery) {
      return (
        <div
          style={{ borderColor: `${deliveryColor}99` }}
          className={`rounded-xl border-2 bg-gradient-to-b from-emerald-950/70 to-slate-950 p-2.5 text-center shadow-lg ${className}`}
        >
          <div
            style={{ color: deliveryColor }}
            className="flex items-center justify-center gap-1.5 text-xs font-black tracking-wider uppercase"
          >
            <Bike className="w-3.5 h-3.5" />
            <span>🚚 DELIVERY</span>
          </div>
          {shortCode && (
            <div className="text-white font-black text-sm font-mono tracking-tight mt-0.5">
              PEDIDO #{shortCode.replace('#', '')}
            </div>
          )}
          <div className="text-[10px] text-emerald-300/80 font-bold uppercase tracking-wider mt-0.5">
            ENTREGA EM DOMICÍLIO
          </div>
        </div>
      );
    }

    // Retirada
    return (
      <div
        style={{ borderColor: `${retiradaColor}99` }}
        className={`rounded-xl border-2 bg-gradient-to-b from-blue-950/70 to-slate-950 p-2.5 text-center shadow-lg ${className}`}
      >
        <div
          style={{ color: retiradaColor }}
          className="flex items-center justify-center gap-1.5 text-xs font-black tracking-wider uppercase"
        >
          <Package className="w-3.5 h-3.5" />
          <span>📦 RETIRADA</span>
        </div>
        {shortCode && (
          <div className="text-white font-black text-sm font-mono tracking-tight mt-0.5">
            PEDIDO #{shortCode.replace('#', '')}
          </div>
        )}
        <div className="text-[10px] text-blue-300/80 font-bold uppercase tracking-wider mt-0.5">
          BALCÃO TAKEAWAY
        </div>
      </div>
    );
  }

  // Inline / Compact Badge
  if (isBalcao) {
    return (
      <span
        style={{ borderColor: `${balcaoColor}55`, backgroundColor: `${balcaoColor}15`, color: balcaoColor }}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-bold text-xs uppercase tracking-wide ${className}`}
      >
        <span>🚶</span>
        <span>BALCÃO {pickupNumber ? `#${pickupNumber}` : ''}</span>
        {shortCode && <span className="font-mono font-black">#{shortCode.replace('#', '')}</span>}
      </span>
    );
  }

  if (isOnline) {
    return (
      <span
        style={{ borderColor: `${onlineColor}55`, backgroundColor: `${onlineColor}15`, color: onlineColor }}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-bold text-xs uppercase tracking-wide ${className}`}
      >
        <span>🌐</span>
        <span>ONLINE</span>
        {shortCode && <span className="font-mono font-black">#{shortCode.replace('#', '')}</span>}
      </span>
    );
  }

  if (isMesa) {
    return (
      <span
        style={{ borderColor: `${mesaColor}55`, backgroundColor: `${mesaColor}15`, color: mesaColor }}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-bold text-xs uppercase tracking-wide ${className}`}
      >
        <span>🍽️</span>
        <span>MESA {tableNumber !== undefined ? String(tableNumber).padStart(2, '0') : '--'}</span>
        {shortCode && <span className="font-mono font-black">#{shortCode.replace('#', '')}</span>}
      </span>
    );
  }

  if (isDelivery) {
    return (
      <span
        style={{ borderColor: `${deliveryColor}55`, backgroundColor: `${deliveryColor}15`, color: deliveryColor }}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-bold text-xs uppercase tracking-wide ${className}`}
      >
        <span>🚚</span>
        <span>DELIVERY</span>
        {shortCode && <span className="font-mono font-black">#{shortCode.replace('#', '')}</span>}
      </span>
    );
  }

  return (
    <span
      style={{ borderColor: `${retiradaColor}55`, backgroundColor: `${retiradaColor}15`, color: retiradaColor }}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-bold text-xs uppercase tracking-wide ${className}`}
    >
      <span>📦</span>
      <span>RETIRADA</span>
      {shortCode && <span className="font-mono font-black">#{shortCode.replace('#', '')}</span>}
    </span>
  );
};
