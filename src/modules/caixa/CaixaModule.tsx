import React from 'react';
import { CashierStationView } from '../../components/CashierStationView';

interface CaixaModuleProps {
  onBackToApp?: () => void;
}

/**
 * MÓDULO 5: CAIXA / FECHAMENTO DE CONTA / SANGRIA / SUPRIMENTO
 * Ambiente financeiro e operacional com controle de turno, divisões de conta, PIX, cartões e emissão de cupom fiscal.
 */
export const CaixaModule: React.FC<CaixaModuleProps> = ({ onBackToApp }) => {
  return (
    // "h-full" apenas — sem min-h-screen (ver correção em CashierStationView).
    <div className="w-full h-full bg-[#07090E]">
      <CashierStationView onBackToApp={onBackToApp} />
    </div>
  );
};
