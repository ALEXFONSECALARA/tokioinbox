import React from 'react';
import App from './App';
import { Landing } from './components/Landing';
import { AdminPortal } from './components/AdminPortal';

// Roteador bem simples baseado em window.location.pathname — não usamos uma
// biblioteca de rotas pra manter o projeto leve. Como cada navegação aqui é
// feita com <a href="..."> (recarrega a página), não precisamos de listener
// de mudança de URL.
export const Router: React.FC = () => {
  const path = window.location.pathname.replace(/\/+$/, ''); // remove barra final

  if (path === '' || path === '/') {
    return <Landing />;
  }

  if (path === '/admin') {
    return <AdminPortal />;
  }

  if (path.startsWith('/r/')) {
    const slug = path.split('/').filter(Boolean)[1];
    return <App restaurantSlug={slug} onExit={() => (window.location.href = '/')} />;
  }

  // Qualquer outro caminho: primeiro segmento é o slug do restaurante (ex: /japones)
  const slug = path.split('/').filter(Boolean)[0];
  return <App restaurantSlug={slug} onExit={() => (window.location.href = '/')} />;
};
