import React from 'react';
import App from './App';
import { Landing } from './components/Landing';
import { AdminPortal } from './components/AdminPortal';
import { CustomerAccountPage } from './components/CustomerAccountPage';
import { fetchRestaurants, toPublicSlug } from './utils/api';

// Roteador bem simples baseado em window.location.pathname — não usamos uma
// biblioteca de rotas pra manter o projeto leve. Como cada navegação aqui é
// feita com <a href="..."> (recarrega a página), não precisamos de listener
// de mudança de URL.
const PublicRestaurantRoute: React.FC<{ pathSlug: string }> = ({ pathSlug }) => {
  const normalizedPath = toPublicSlug(decodeURIComponent(pathSlug || ''));
  const [resolvedSlug, setResolvedSlug] = React.useState<string | null>(() => {
    const known = ['japones', 'pizza', 'hamburgueria', 'italiano'];
    return known.includes(normalizedPath) ? normalizedPath : null;
  });
  const [loading, setLoading] = React.useState(true);
  React.useEffect(() => {
    let cancelled = false;
    if (resolvedSlug) { setLoading(false); return; }
    fetchRestaurants().then(list => {
      const found = list.find(r => (r.publicSlug || r.slug) === normalizedPath || r.slug === normalizedPath || r.slug === pathSlug);
      if (!cancelled) setResolvedSlug(found?.slug || null);
    }).catch(() => {}).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [pathSlug, normalizedPath, resolvedSlug]);
  if (loading) return <div className="min-h-screen bg-[#060908] text-white flex items-center justify-center">Carregando restaurante...</div>;
  if (!resolvedSlug) return <div className="min-h-screen bg-[#060908] text-white flex items-center justify-center px-6 text-center">Restaurante não encontrado.</div>;
  return <App restaurantSlug={resolvedSlug} onExit={() => (window.location.href = '/')} />;
};

export const Router: React.FC = () => {
  const path = window.location.pathname.replace(/\/+$/, ''); // remove barra final

  if (path === '' || path === '/') {
    return <Landing />;
  }

  if (path === '/admin') {
    return <AdminPortal />;
  }

  if (path === '/conta') {
    return <CustomerAccountPage />;
  }

  if (path.startsWith('/r/')) {
    const slug = path.split('/').filter(Boolean)[1];
    return <PublicRestaurantRoute pathSlug={slug} />;
  }

  // Qualquer outro caminho: primeiro segmento é o slug do restaurante (ex: /japones)
  const slug = path.split('/').filter(Boolean)[0];
  return <PublicRestaurantRoute pathSlug={slug} />;
};
