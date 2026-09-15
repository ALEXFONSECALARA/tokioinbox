import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { CustomerSession, CustomerLoginMode } from '../types/customerAuth';
import { BRAND_NAME, BRAND_SHORT_NAME } from '../config/brand';
import {
  X,
  User,
  Phone,
  Gift,
  CheckCircle2,
  MapPin,
  Clock,
  Sparkles,
  ShoppingBag,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';

interface CustomerAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectCustomer?: (customer: CustomerSession) => void;
}

export const CustomerAuthModal: React.FC<CustomerAuthModalProps> = ({
  isOpen,
  onClose,
  onSelectCustomer,
}) => {
  const { currentRestaurant, orders } = useStore();
  const [phoneInput, setPhoneInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [activeSession, setActiveSession] = useState<CustomerSession | null>(() => {
    try {
      const stored = localStorage.getItem('aura_customer_session');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [isLoading, setIsLoading] = useState(false);
  const [bonusClaimMsg, setBonusClaimMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneInput.trim()) return;

    setIsLoading(true);
    try {
      const res = await fetch('/api/customer/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: phoneInput.trim(),
          name: nameInput.trim() || undefined,
          restaurantSlug: currentRestaurant.slug,
        }),
      });
      const data = await res.json();
      if (data.success && data.customer) {
        setActiveSession(data.customer);
        localStorage.setItem('aura_customer_session', JSON.stringify(data.customer));
        if (onSelectCustomer) onSelectCustomer(data.customer);
      }
    } catch (err) {
      console.error('Customer login error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClaimBonus = async () => {
    if (!activeSession) return;
    setIsLoading(true);
    try {
      const res = await fetch('/api/customer/claim-bonus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: activeSession.id,
          phone: activeSession.phone,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setBonusClaimMsg(data.message);
        const updated = {
          ...activeSession,
          hasClaimedInstallBonus: true,
          installBonusCouponCode: data.couponCode,
        };
        setActiveSession(updated);
        localStorage.setItem('aura_customer_session', JSON.stringify(updated));
      } else {
        setBonusClaimMsg(data.message || 'Bônus já resgatado.');
      }
    } catch {
      setBonusClaimMsg('Erro ao resgatar bônus.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    setActiveSession(null);
    localStorage.removeItem('aura_customer_session');
    setBonusClaimMsg(null);
  };

  // Customer previous orders
  const myOrders = orders.filter(
    (o) =>
      activeSession &&
      o.customerPhone.replace(/\D/g, '') === activeSession.phone.replace(/\D/g, '')
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-[#0E121B] border border-[#E3BD6A]/30 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.9)] overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-[#121622] via-[#0E121B] to-[#0A0D14] border-b border-[#E3BD6A]/20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#E3BD6A]/10 border border-[#E3BD6A]/30 flex items-center justify-center text-[#E3BD6A]">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-white tracking-tight flex items-center gap-2">
                Área do Cliente • {BRAND_SHORT_NAME}
              </h2>
              <p className="text-[11px] text-slate-400">
                Acesse seus pedidos, endereços e cupons exclusivos
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {activeSession ? (
            <div className="space-y-5">
              {/* Profile Card */}
              <div className="p-4 rounded-xl bg-[#121622] border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-bold text-white">{activeSession.name}</span>
                    <span className="px-2 py-0.5 rounded-md bg-[#E3BD6A]/15 text-[#E3BD6A] text-[10px] font-black uppercase">
                      Cliente VIP
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">{activeSession.phone}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="text-xs text-rose-400 hover:text-rose-300 font-semibold px-2.5 py-1 rounded-lg border border-rose-500/30 hover:bg-rose-950/30 transition-colors"
                >
                  Sair
                </button>
              </div>

              {/* Installation Bonus Card */}
              <div className="p-4 rounded-xl bg-gradient-to-br from-[#1c180e] via-[#121622] to-[#0A0D14] border border-[#E3BD6A]/40 space-y-2">
                <div className="flex items-center gap-2 text-[#E3BD6A] font-bold text-sm">
                  <Gift className="w-4 h-4" />
                  <span>Bônus de Instalação Aura PWA</span>
                </div>
                <p className="text-xs text-slate-300">
                  {activeSession.hasClaimedInstallBonus
                    ? `Seu cupom exclusivo está ativo: ${activeSession.installBonusCouponCode || 'AURAAPP15'}`
                    : 'Ative o aplicativo no seu celular ou desktop e ganhe 15% OFF no seu próximo pedido!'}
                </p>

                {bonusClaimMsg && (
                  <div className="p-2.5 rounded-lg bg-[#E3BD6A]/10 border border-[#E3BD6A]/30 text-xs font-bold text-[#E3BD6A]">
                    {bonusClaimMsg}
                  </div>
                )}

                {!activeSession.hasClaimedInstallBonus && (
                  <button
                    onClick={handleClaimBonus}
                    disabled={isLoading}
                    className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#E3BD6A] to-[#C99C3D] hover:brightness-110 text-slate-950 font-black text-xs shadow-md flex items-center justify-center gap-2 transition-all"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>{isLoading ? 'Validando...' : 'Resgatar 15% OFF de Boas-Vindas'}</span>
                  </button>
                )}
              </div>

              {/* Order History */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-slate-400">
                  <span>Meus Pedidos Recentes ({myOrders.length})</span>
                </div>

                {myOrders.length === 0 ? (
                  <div className="p-6 text-center border border-dashed border-slate-800 rounded-xl">
                    <ShoppingBag className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                    <p className="text-xs text-slate-400">Nenhum pedido realizado com este número ainda.</p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {myOrders.slice(0, 5).map((order) => (
                      <div
                        key={order.id}
                        className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between hover:border-slate-700 transition-colors"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-[#E3BD6A]">{order.shortCode}</span>
                            <span className="text-xs font-bold text-slate-200">{order.restaurantName}</span>
                          </div>
                          <p className="text-[11px] text-slate-400">
                            {order.items.map((i) => `${i.quantity}x ${i.name}`).join(', ')}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-bold text-white block">
                            R$ {order.total.toFixed(2)}
                          </span>
                          <span className="text-[10px] uppercase font-bold text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-500/20">
                            {order.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="p-3.5 rounded-xl bg-[#E3BD6A]/10 border border-[#E3BD6A]/20 text-xs text-slate-300 leading-relaxed">
                Entre com seu número de WhatsApp para acompanhar pedidos, resgatar cupons de bônus e salvar seus endereços favoritos com segurança.
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Número de WhatsApp ou Celular:
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="tel"
                    required
                    placeholder="(11) 98765-4321"
                    value={phoneInput}
                    onChange={(e) => setPhoneInput(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-900/90 border border-slate-700 text-white text-sm focus:border-[#E3BD6A] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Seu Nome (Opcional):
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    placeholder="Ex: Carolina Silva"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-900/90 border border-slate-700 text-white text-sm focus:border-[#E3BD6A] focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading || !phoneInput.trim()}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-[#E3BD6A] via-[#D8AE56] to-[#C99C3D] hover:brightness-110 text-slate-950 font-black text-sm shadow-[0_0_20px_rgba(227,189,106,0.3)] transition-all flex items-center justify-center gap-2"
              >
                <span>{isLoading ? 'Acessando...' : 'Acessar Minha Conta'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
