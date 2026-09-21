import React from 'react';
import { DeliveryOnlineOrdersView } from '../../components/DeliveryOnlineOrdersView';

interface DeliveryModuleProps {
  onBackToApp?: () => void;
}

/**
 * MÓDULO 4: DELIVERY / PEDIDOS ONLINE
 * Ambiente dedicado para gestão de pedidos recebidos via app, cardápio online, iFood e despacho para entregadores.
 */
export const DeliveryModule: React.FC<DeliveryModuleProps> = ({ onBackToApp }) => {
  return (
    <div className="w-full h-full min-h-screen bg-[#07090E]">
      <DeliveryOnlineOrdersView onBackToApp={onBackToApp} />
    </div>
  );
};
