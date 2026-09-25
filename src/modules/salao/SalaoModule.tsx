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
    // BUG CORRIGIDO: "min-h-screen" aqui reintroduzia rolagem de PÁGINA
    // inteira (min-height não tem teto), quebrando a trava de viewport do
    // shell do painel (ver body.painel-app-shell em src/utils/index.css) —
    // era a causa real das "mesas cortadas / mesas que não aparecem".
    // Agora só "h-full": este módulo preenche exatamente a altura que o
    // #root já reserva, e quem rola internamente é só a área de conteúdo
    // dentro do WaiterPdvTouch (ver comentário lá).
    <div className="w-full h-full bg-[#07090E]">
      <WaiterPdvTouch
        onBackToApp={onBackToApp}
        onOpenAdmin={onOpenAdmin}
        onNavigateToEnvironment={onNavigateToEnvironment}
      />
    </div>
  );
};
