import React, { useEffect, useRef, useState } from 'react';

// Fica de olho em /api/version (um valor que só muda quando o processo do
// servidor reinicia, ou seja, a cada deploy no Render) e avisa o usuário
// quando percebe que mudou desde que a página carregou. Não recarrega
// sozinho — quem está no meio de um pedido, imprimindo ou preenchendo um
// formulário não pode perder o que está fazendo só porque saiu um deploy.
const CHECK_INTERVAL_MS = 3 * 60 * 1000; // 3 minutos

export const DeployWatcher: React.FC = () => {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const knownBootId = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      try {
        const res = await fetch('/api/version', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        if (knownBootId.current === null) {
          knownBootId.current = data.bootId;
        } else if (data.bootId !== knownBootId.current) {
          setUpdateAvailable(true);
        }
      } catch {
        // Falha de rede aqui não é motivo pra incomodar ninguém — só tenta de novo depois.
      }
    };

    check();
    const interval = setInterval(check, CHECK_INTERVAL_MS);
    // Também confere assim que a aba volta a ficar visível — é exatamente
    // quando um celular/tablet que ficou parado (tela bloqueada) volta a
    // ser usado, o momento mais provável de ter perdido um deploy no meio.
    const onVisible = () => { if (document.visibilityState === 'visible') check(); };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  if (!updateAvailable) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[9999] bg-stone-900 text-white rounded-2xl shadow-2xl px-4 py-3 flex items-center gap-3 text-sm max-w-[92vw]">
      <span>🔄 Uma nova versão do sistema está disponível.</span>
      <button
        onClick={() => window.location.reload()}
        className="bg-amber-500 text-stone-950 font-bold px-3 py-1.5 rounded-xl whitespace-nowrap"
      >
        Atualizar agora
      </button>
    </div>
  );
};
