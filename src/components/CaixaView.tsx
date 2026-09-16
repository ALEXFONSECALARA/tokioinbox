import React, { useState } from 'react';
import { Utensils, LayoutGrid, Bike, ShoppingBag } from 'lucide-react';
import { KanbanBoard } from './KanbanBoard';
import { WaiterView } from './WaiterView';
import { DeliveryView } from './DeliveryView';
import { BalcaoDeliveryView } from './BalcaoDeliveryView';

interface CaixaViewProps {
  restaurantId: string;
  restaurantName: string;
  userId: string;
}

type CaixaTab = 'kanban' | 'mesas' | 'balcao' | 'delivery';

/** Seção 13: botões principais do balcão/caixa, tudo sobre a mesma base de dados do Kanban central. */
export function CaixaView({ restaurantId, restaurantName, userId }: CaixaViewProps) {
  const [tab, setTab] = useState<CaixaTab>('kanban');

  return (
    <div className="min-h-screen bg-[#07090E] text-white">
      <nav className="sticky top-0 z-10 bg-[#07090E]/95 backdrop-blur border-b border-white/10 flex gap-1 p-2 overflow-x-auto">
        <TabButton active={tab === 'kanban'} onClick={() => setTab('kanban')} icon={<LayoutGrid size={16} />} label="Kanban" />
        <TabButton active={tab === 'mesas'} onClick={() => setTab('mesas')} icon={<Utensils size={16} />} label="Mesas" />
        <TabButton active={tab === 'balcao'} onClick={() => setTab('balcao')} icon={<ShoppingBag size={16} />} label="Balcão / Delivery" />
        <TabButton active={tab === 'delivery'} onClick={() => setTab('delivery')} icon={<Bike size={16} />} label="Entregas" />
      </nav>
      {tab === 'kanban' && <KanbanBoard restaurantId={restaurantId} />}
      {tab === 'mesas' && <WaiterView restaurantId={restaurantId} restaurantName={restaurantName} userId={userId} />}
      {tab === 'balcao' && <BalcaoDeliveryView restaurantId={restaurantId} />}
      {tab === 'delivery' && <DeliveryView restaurantId={restaurantId} />}
    </div>
  );
}

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${
        active ? 'bg-white text-black' : 'text-white/60 hover:bg-white/5'
      }`}
    >
      {icon} {label}
    </button>
  );
}
