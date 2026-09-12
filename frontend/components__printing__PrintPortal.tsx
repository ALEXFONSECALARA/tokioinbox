import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

// Por que um portal e não só "position:absolute + visibility:hidden" no resto
// da página? Porque o conteúdo a imprimir normalmente vive dentro de um modal
// com `position: fixed`, `overflow-y-auto` e `display:flex`. Em vários
// navegadores, um ancestral com overflow/flex/fixed corta ou distorce o
// conteúdo na hora de imprimir, mesmo que ele tenha "visibility: visible" —
// foi exatamente esse tipo de ancestral problemático que causava impressões
// em branco/cortadas aqui. Renderizando o conteúdo como IRMÃO da raiz do app
// (direto em <body>), ele fica isento de qualquer CSS problemático do modal.
export const PrintPortal = ({ children }: { children: ReactNode }) => {
  const [container] = useState(() => {
    const el = document.createElement('div');
    el.id = 'print-portal-root';
    return el;
  });

  useEffect(() => {
    document.body.appendChild(container);
    return () => {
      if (container.parentNode) container.parentNode.removeChild(container);
    };
  }, [container]);

  return createPortal(children, container);
};
