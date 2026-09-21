import React from 'react';
import { WaiterPdvTouch } from '../../components/WaiterPdvTouch';
import { OperationalEnvironment } from '../../components/EnvironmentBar';

interface SalaoModuleProps {
  onBackToApp?: () => void;
  onOpenAdmin?: () => void;
  onNavigateToEnvironment?: (env: OperationalEnvironment, subOption?: string) => void;
}

/**
 * MÓDULO 1: SALÃO / MESAS / GARÇOM / PDV TOUCH
 * Ambiente operacional isolado e dedicado para garçons e salão.
 */
export const SalaoModule: React.FC<SalaoModuleProps> = ({
  onBackToApp,
  onOpenAdmin,
  onNavigateToEnvironment,
}) => {
  return (
    <div className="w-full h-full min-h-screen bg-[#07090E]">
      <WaiterPdvTouch
        onBackToApp={onBackToApp}
        onOpenAdmin={onOpenAdmin}
        onNavigateToEnvironment={onNavigateToEnvironment}
      />
    </div>
  );
};
