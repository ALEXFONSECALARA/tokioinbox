import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { RestaurantSlug } from '../types/restaurant';
import {
  Users,
  ShoppingBag,
  MessageCircle,
  Phone,
  Clock,
  Sparkles,
  Award,
  ArrowUpRight,
  Search,
} from 'lucide-react';

interface AdminCrmRecoveryProps {
  selectedSlug: RestaurantSlug | 'all';
}

interface CrmCustomer {
  id: string;
  name: string;
  phone: string;
  ordersCount: number;
  totalSpent: number;
  lastOrderDaysAgo: number;
  favoriteDish: string;
  segment: 'VIP' | 'RECORRENTE' | 'NOVO' | 'EM_RISCO' | 'INATIVO';
}

interface AbandonedCartItem {
  id: string;
  customerName: string;
  phone: string;
  itemsSummary: string;
  totalValue: number;
  abandonedHoursAgo: number;
}

export const AdminCrmRecovery: React.FC<AdminCrmRecoveryProps> = ({ selectedSlug }) => {
  const { restaurants } = useStore();
  const targetSlug = selectedSlug === 'all' ? 'japones' : selectedSlug;
  const currentRestaurant = restaurants[targetSlug] || restaurants.japones;

  const [activeTab, setActiveTab] = useState<'crm' | 'carrinhos'>('carrinhos');
  const [searchTerm, setSearchTerm] = useState('');

  // Sample CRM data with realistic gastronomic customers
  const customers: CrmCustomer[] = [
    {
      id: 'c-1',
      name: 'Carolina Mendes',
      phone: '5511988887711',
      ordersCount: 14,
      totalSpent: 1840.5,
      lastOrderDaysAgo: 3,
      favoriteDish: 'Combinado Salmão Prime Especial',
      segment: 'VIP',
    },
    {
      id: 'c-2',
      name: 'Rodrigo Alves',
      phone: '5511977776622',
      ordersCount: 6,
      totalSpent: 620.0,
      lastOrderDaysAgo: 12,
      favoriteDish: 'Uramaki Ebi Furai Especial',
      segment: 'RECORRENTE',
    },
    {
      id: 'c-3',
      name: 'Camila Duarte',
      phone: '5511966665533',
      ordersCount: 1,
      totalSpent: 115.0,
      lastOrderDaysAgo: 5,
      favoriteDish: 'Temaki Salmão Completo',
      segment: 'NOVO',
    },
    {
      id: 'c-4',
      name: 'Fernando Guimarães',
      phone: '5511955554444',
      ordersCount: 8,
      totalSpent: 910.0,
      lastOrderDaysAgo: 28,
      favoriteDish: 'Sashimi Misto Nobre',
      segment: 'EM_RISCO',
    },
    {
      id: 'c-5',
      name: 'Juliana Paes',
      phone: '5511944443355',
      ordersCount: 4,
      totalSpent: 480.0,
      lastOrderDaysAgo: 52,
      favoriteDish: 'Yakisoba Misto Especial',
      segment: 'INATIVO',
    },
  ];

  // Abandoned carts list
  const abandonedCarts: AbandonedCartItem[] = [
    {
      id: 'ac-1',
      customerName: 'Mariana Costa',
      phone: '5511981234567',
      itemsSummary: '1x Combinado Especial (32 pcs), 1x Coca-Cola Zero',
      totalValue: 148.0,
      abandonedHoursAgo: 2,
    },
    {
      id: 'ac-2',
      customerName: 'Lucas Ferreira',
      phone: '5511998765432',
      itemsSummary: '2x Temaki Salmão Spicy, 1x Hot Roll Cream Cheese',
      totalValue: 84.5,
      abandonedHoursAgo: 4,
    },
    {
      id: 'ac-3',
      customerName: 'Beatriz Lima',
      phone: '5511974125896',
      itemsSummary: '1x Sashimi Salmão Trufado, 1x Água San Pellegrino',
      totalValue: 112.0,
      abandonedHoursAgo: 6,
    },
  ];

  const handleRecoverCartWhatsapp = (cart: AbandonedCartItem) => {
    const text = `Olá ${cart.customerName}! 🍣 Vimos que você estava preparando um pedido especial no *${currentRestaurant.name}*:\n\n${cart.itemsSummary}\n\nPara te ajudar a finalizar essa experiência deliciosa, liberamos um cupom especial de *FRETE GRÁTIS*: Use *FRETELIVRE* no checkout!\n\nToque para concluir seu pedido: ${window.location.origin}/?slug=${targetSlug}`;
    window.open(`https://api.whatsapp.com/send?phone=${cart.phone}&text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleReactivateCustomerWhatsapp = (cust: CrmCustomer) => {
    const text = `Olá ${cust.name}! Sentimos sua falta no *${currentRestaurant.name}*! 🍱\n\nQue tal reviver aquela experiência com o seu prato favorito *${cust.favoriteDish}*?\n\nPreparamos 15% de desconto exclusivo para o seu retorno com o cupom *VOLTE15*.\n\nAcesse nosso cardápio oficial: ${window.location.origin}/?slug=${targetSlug}`;
    window.open(`https://api.whatsapp.com/send?phone=${cust.phone}&text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-5 rounded-2xl bg-gradient-to-br from-[#18130B] via-[#121622] to-[#0A0D14] border border-[#E3BD6A]/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#E3BD6A] to-[#8F6A1E] flex items-center justify-center text-slate-950 font-black shadow-[0_0_20px_rgba(227,189,106,0.3)] shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-black text-white tracking-tight">
              CRM, Retenção &amp; Recuperação de Carrinhos • {currentRestaurant.name}
            </h2>
            <p className="text-xs text-slate-400">
              Disparos personalizados para carrinhos abandonados e campanhas de reativação para clientes em risco
            </p>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-700/80">
          <button
            onClick={() => setActiveTab('carrinhos')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              activeTab === 'carrinhos'
                ? 'bg-[#E3BD6A] text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Carrinhos Abandonados ({abandonedCarts.length})
          </button>
          <button
            onClick={() => setActiveTab('crm')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              activeTab === 'crm'
                ? 'bg-[#E3BD6A] text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Base de Clientes ({customers.length})
          </button>
        </div>
      </div>

      {activeTab === 'carrinhos' ? (
        <div className="space-y-3">
          <h3 className="text-xs font-black uppercase tracking-wider text-[#E3BD6A] flex items-center gap-1.5">
            <ShoppingBag className="w-4 h-4" />
            <span>Oportunidades de Recuperação Imediata</span>
          </h3>

          <div className="space-y-3">
            {abandonedCarts.map((cart) => (
              <div
                key={cart.id}
                className="p-4 rounded-xl bg-[#121622] border border-slate-800 hover:border-[#E3BD6A]/40 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">{cart.customerName}</span>
                    <span className="text-xs text-slate-400 font-mono">{cart.phone}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-400">
                      há {cart.abandonedHoursAgo}h
                    </span>
                  </div>
                  <p className="text-xs text-slate-300">{cart.itemsSummary}</p>
                  <p className="text-xs font-black text-[#E3BD6A]">
                    Valor do Carrinho: R$ {cart.totalValue.toFixed(2)}
                  </p>
                </div>

                <button
                  onClick={() => handleRecoverCartWhatsapp(cart)}
                  className="py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow transition-colors shrink-0"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Recuperar via WhatsApp (Cupom Automático)</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
            <Award className="w-4 h-4 text-[#E3BD6A]" />
            <span>Segmentação e Histórico de Compras</span>
          </h3>

          <div className="space-y-2">
            {customers.map((cust) => {
              const isAtRisk = cust.segment === 'EM_RISCO' || cust.segment === 'INATIVO';

              return (
                <div
                  key={cust.id}
                  className="p-4 rounded-xl bg-[#121622] border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-700 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white">{cust.name}</span>
                      <span
                        className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                          cust.segment === 'VIP'
                            ? 'bg-[#E3BD6A]/20 text-[#E3BD6A]'
                            : cust.segment === 'RECORRENTE'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : isAtRisk
                            ? 'bg-rose-500/20 text-rose-400'
                            : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        {cust.segment}
                      </span>
                    </div>

                    <p className="text-xs text-slate-400">
                      {cust.ordersCount} pedidos • LTV: <strong className="text-white">R$ {cust.totalSpent.toFixed(2)}</strong> • Último pedido: há {cust.lastOrderDaysAgo} dias
                    </p>
                    <p className="text-[11px] text-[#E3BD6A]">
                      Prato Favorito: {cust.favoriteDish}
                    </p>
                  </div>

                  {isAtRisk && (
                    <button
                      onClick={() => handleReactivateCustomerWhatsapp(cust)}
                      className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-[#E3BD6A] border border-[#E3BD6A]/30 text-xs font-bold flex items-center gap-1.5 transition-colors self-start sm:self-auto shrink-0"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Reativar com 15% OFF</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
