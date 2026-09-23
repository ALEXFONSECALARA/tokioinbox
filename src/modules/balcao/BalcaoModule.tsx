import React from 'react';
import { CounterTouchView } from '../../components/CounterTouchView';

interface BalcaoModuleProps {
  onBackToApp?: () => void;
  onOpenAdmin?: () => void;
}

/**
 * MÓDULO 3: BALCÃO / PDV TOUCH / SENHA
 * Ambiente para atendimento rápido presencial no balcão com senhas automáticas e comanda rápida.
 */
export const BalcaoModule: React.FC<BalcaoModuleProps> = ({
  onBackToApp,
  onOpenAdmin,
}) => {
  return (
    <div className="w-full h-full bg-[#07090E]">
      <CounterTouchView
        onBackToApp={onBackToApp}
        onOpenAdmin={onOpenAdmin}
      />
    </div>
  );
};
