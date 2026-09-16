import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { StaffLoginScreen } from './StaffLoginScreen';
import { ToastProvider } from '../context/ToastContext';
import { WaiterView } from './WaiterView';
import { CaixaView } from './CaixaView';
import { KitchenView } from './KitchenView';
import { DeliveryView } from './DeliveryView';
import { AdminLayout } from './AdminLayout';
import { Loader2 } from 'lucide-react';

/**
 * FASE 3 — Seção 5 do briefing: em vez de várias URLs diferentes, uma única
 * rota /operacao que identifica o usuário logado (via sessão real do Supabase
 * Auth, não um atalho de teclado) e mostra automaticamente a interface certa:
 * garçom → mesas, caixa → balcão+kanban+delivery, cozinha/sushibar → só os
 * pedidos daquela estação, motoboy → entregas, gerente/super admin → painel completo.
 */
export function OperacaoRouter() {
  return (
    <ToastProvider>
      <OperacaoRouterInner />
    </ToastProvider>
  );
}

function OperacaoRouterInner() {
  const { loading, isAuthenticated, isCustomer, profile, restaurants, logout } = useAuth();
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#07090E] flex items-center justify-center text-white">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) return <StaffLoginScreen />;

  if (isCustomer) {
    return (
      <div className="min-h-screen bg-[#07090E] text-white flex items-center justify-center p-6 text-center">
        <div>
          <p className="mb-4">Esta área é exclusiva para a equipe do restaurante.</p>
          <button onClick={() => logout()} className="underline text-white/60 text-sm">Sair</button>
        </div>
      </div>
    );
  }

  if (restaurants.length === 0) {
    return (
      <div className="min-h-screen bg-[#07090E] text-white flex items-center justify-center p-6 text-center">
        <div>
          <p className="mb-4">Seu usuário ainda não está vinculado a nenhum restaurante. Fale com o Super Admin.</p>
          <button onClick={() => logout()} className="underline text-white/60 text-sm">Sair</button>
        </div>
      </div>
    );
  }

  const activeRestaurant =
    restaurants.find((r) => r.id === selectedRestaurantId) ?? (restaurants.length === 1 ? restaurants[0] : null);

  if (!activeRestaurant) {
    return (
      <div className="min-h-screen bg-[#07090E] text-white p-6">
        <h1 className="text-lg font-semibold mb-4">Escolha o restaurante</h1>
        <div className="grid gap-3 sm:grid-cols-2">
          {restaurants.map((r) => (
            <button
              key={r.id}
              onClick={() => setSelectedRestaurantId(r.id)}
              className="rounded-xl border border-white/10 p-4 text-left hover:bg-white/5"
            >
              <p className="font-medium">{r.name}</p>
              <p className="text-xs text-white/40 uppercase">{r.roleKey}</p>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const roleKey = activeRestaurant.roleKey;
  const commonProps = { restaurantId: activeRestaurant.id, restaurantName: activeRestaurant.name, userId: profile!.id };

  switch (roleKey) {
    case 'super_admin':
    case 'gerente':
      return <AdminLayout onBackToApp={() => {}} initialTab="dashboard" />;
    case 'caixa':
      return <CaixaView {...commonProps} />;
    case 'garcom':
      return <WaiterView {...commonProps} />;
    case 'cozinha':
      return <KitchenView restaurantId={activeRestaurant.id} destination="cozinha" />;
    case 'sushibar':
      return <KitchenView restaurantId={activeRestaurant.id} destination="sushibar" />;
    case 'motoboy':
      return <DeliveryView restaurantId={activeRestaurant.id} />;
    default:
      return (
        <div className="min-h-screen bg-[#07090E] text-white flex items-center justify-center">
          <p>Papel "{roleKey}" sem interface definida ainda.</p>
        </div>
      );
  }
}
