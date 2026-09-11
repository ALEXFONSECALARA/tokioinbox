import React from 'react';
import App from '@/src/App';
import { Landing } from '@/src/components/restaurant/Landing';
import { AdminPortal } from '@/src/components/admin/AdminPortal';
import { CustomerAccountPage } from '@/src/components/customer/CustomerAccountPage';
import { KanbanOnlyPortal, UnifiedKanbanPortal } from '@/src/components/kanban/KanbanPortal';
import { fetchRestaurants, toPublicSlug } from '@/src/utils/api';

// Roteador bem simples baseado em window.location.pathname — não usamos uma
// biblioteca de rotas pra manter o projeto leve. Como cada navegação aqui é
// feita com <a href="..."> (recarrega a página), não precisamos de listener
// de mudança de URL.
//
// Cache em memória (dura só a sessão do processo JS, não persiste entre
// reloads) do último resultado de fetchRestaurants(), pra qualquer slug já
// visto nesta sessão resolver sem piscar "Carregando restaurante..." de
// novo. Isso substitui uma lista fixa que existia antes
// (['japones','pizza','hamburgueria','italiano']) — o roteador não pode
// ficar preso a nomes de restaurante específicos; um restaurante novo
// cadastrado tem que funcionar exatamente do mesmo jeito, sem precisar
// tocar em código nenhum aqui.
type RestaurantListItem = { slug: string; publicSlug?: string };
let restaurantListCache: RestaurantListItem[] | null = null;

function findInList(list: RestaurantListItem[], normalizedPath: string, rawPathSlug: string) {
  return list.find(
    (r) => (r.publicSlug || r.slug) === normalizedPath || r.slug === normalizedPath || r.slug === rawPathSlug
  );
}

const PublicRestaurantRoute: React.FC<{ pathSlug: string }> = ({ pathSlug }) => {
  const normalizedPath = toPublicSlug(decodeURIComponent(pathSlug || ''));
  const [resolvedSlug, setResolvedSlug] = React.useState<string | null>(() =>
    restaurantListCache ? findInList(restaurantListCache, normalizedPath, pathSlug)?.slug || null : null
  );
  const [notFound, setNotFound] = React.useState(false);
  const [loading, setLoading] = React.useState(!restaurantListCache);

  React.useEffect(() => {
    let cancelled = false;
    if (restaurantListCache) { setLoading(false); return; }
    fetchRestaurants()
      .then((list) => {
        restaurantListCache = list;
        if (cancelled) return;
        const found = findInList(list, normalizedPath, pathSlug);
        setResolvedSlug(found?.slug || null);
        if (!found) setNotFound(true);
      })
      .catch(() => { if (!cancelled) setNotFound(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathSlug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#060908] text-white flex items-center justify-center">
        Carregando restaurante...
      </div>
    );
  }
  if (!resolvedSlug || notFound) {
    return (
      <div className="min-h-screen bg-[#060908] text-white flex items-center justify-center px-6 text-center">
        Restaurante não encontrado.
      </div>
    );
  }
  return <App restaurantSlug={resolvedSlug} onExit={() => (window.location.href = '/')} />;
};

export const Router: React.FC = () => {
  const path = window.location.pathname.replace(/\/+$/, ''); // remove barra final

  if (path === '' || path === '/') {
    return <Landing />;
  }

  // Endereço oficial do painel administrativo. /admin continua aceito logo
  // abaixo só por compatibilidade com links/favoritos antigos que já
  // apontam pra ele.
  if (path.toLowerCase() === '/painelrestaurante') {
    return <AdminPortal />;
  }

  if (path === '/admin') {
    return <AdminPortal />;
  }

  if (path === '/conta') {
    return <CustomerAccountPage />;
  }

  // Kanban único (evolução v24_2) — todos os restaurantes, senha própria.
  if (path === '/kanban-geral' || path === '/kanban') {
    return <UnifiedKanbanPortal />;
  }

  // Kanban individual (evolução v24_2) — /kanban/:slug, senha própria daquele restaurante.
  if (path.startsWith('/kanban/')) {
    const slug = path.split('/').filter(Boolean)[1];
    return <KanbanOnlyPortal slug={slug} />;
  }

  if (path.startsWith('/r/')) {
    const slug = path.split('/').filter(Boolean)[1];
    return <PublicRestaurantRoute pathSlug={slug} />;
  }

  // Qualquer outro caminho: primeiro segmento é o slug do restaurante (ex:
  // /tokio-sushi). Nenhuma lista fixa de restaurantes — resolve sempre
  // contra o que estiver cadastrado no banco via fetchRestaurants().
  const slug = path.split('/').filter(Boolean)[0];
  return <PublicRestaurantRoute pathSlug={slug} />;
};
