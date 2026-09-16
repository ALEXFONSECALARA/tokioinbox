import { useEffect, useState } from 'react';

/** true quando a aba está em primeiro plano, false quando o usuário troca de aba/minimiza. */
export function usePageVisibility(): boolean {
  const [visible, setVisible] = useState(() => document.visibilityState === 'visible');

  useEffect(() => {
    const handler = () => setVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, []);

  return visible;
}
