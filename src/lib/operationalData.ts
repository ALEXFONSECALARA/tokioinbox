import { get as idbGet, set as idbSet } from 'idb-keyval';
import { supabase } from './supabaseClient';

/**
 * Leituras/escritas simples (mesas, cardápio) vão direto no Supabase pelo
 * navegador: a segurança não vem de "esconder a chamada", vem das políticas
 * de RLS que já filtram por restaurante e por permissão (table.view/table.manage).
 * Pedidos continuam passando pelo backend (server/orderRoutes.ts) porque ali
 * tem lógica de preço/idempotência que não deve rodar no cliente.
 */

export interface TableRow {
  id: string;
  restaurant_id: string;
  number: number;
  label: string | null;
  status: 'livre' | 'ocupada' | 'aguardando_conta' | 'fechando';
}

export async function listTables(restaurantId: string): Promise<TableRow[]> {
  const { data, error } = await supabase
    .from('tables')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .order('number');
  if (error) throw new Error(error.message);
  return data as TableRow[];
}

export async function updateTableStatus(tableId: string, status: TableRow['status']) {
  const { error } = await supabase.from('tables').update({ status }).eq('id', tableId);
  if (error) throw new Error(error.message);
}

/**
 * Seção "Pedido à Mesa (Mesas 1 a 50)" do pedido de POS: em vez de obrigar o
 * restaurante a pré-cadastrar 50 mesas, o garçom já vê a grade completa 1-50
 * e a mesa só é criada de fato no banco no instante em que é tocada pela
 * primeira vez (upsert por número).
 */
export async function ensureTableExists(restaurantId: string, number: number): Promise<TableRow> {
  const { data: existing } = await supabase
    .from('tables')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .eq('number', number)
    .maybeSingle();
  if (existing) return existing as TableRow;

  const { data, error } = await supabase
    .from('tables')
    .insert({ restaurant_id: restaurantId, number, status: 'livre' })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as TableRow;
}

/** Mescla as mesas já existentes no banco com números 1..max ainda não criados (como "livre" virtual). */
export function buildTableGrid(existingTables: TableRow[], max = 50): (TableRow & { virtual?: boolean })[] {
  const byNumber = new Map(existingTables.map((t) => [t.number, t]));
  const grid: (TableRow & { virtual?: boolean })[] = [];
  for (let n = 1; n <= max; n++) {
    const found = byNumber.get(n);
    grid.push(
      found ?? {
        id: `virtual-${n}`,
        restaurant_id: existingTables[0]?.restaurant_id ?? '',
        number: n,
        label: null,
        status: 'livre',
        virtual: true,
      }
    );
  }
  return grid;
}

export interface CategoryRow {
  id: string;
  name: string;
  sort_order: number;
}
export interface ProductRow {
  id: string;
  category_id: string | null;
  name: string;
  price: number;
  image_url: string | null;
  is_active: boolean;
}

export async function listMenu(restaurantId: string): Promise<{ categories: CategoryRow[]; products: ProductRow[] }> {
  const [{ data: categories, error: catErr }, { data: products, error: prodErr }] = await Promise.all([
    supabase.from('categories').select('id, name, sort_order').eq('restaurant_id', restaurantId).eq('is_active', true).order('sort_order'),
    supabase.from('products').select('id, category_id, name, price, image_url, is_active').eq('restaurant_id', restaurantId).eq('is_active', true),
  ]);
  if (catErr) throw new Error(catErr.message);
  if (prodErr) throw new Error(prodErr.message);
  return { categories: categories ?? [], products: products ?? [] };
}

/**
 * Item 4 do pedido de otimização de rede: cardápio fica em IndexedDB.
 * `getMenuInstant` devolve o que já está salvo localmente na hora (tela some
 * o "carregando" pro cliente/garçom), e dispara uma revalidação em segundo
 * plano que atualiza o cache e chama `onFresh` quando o dado novo chegar —
 * é o padrão "stale-while-revalidate", sem precisar rebaixar do zero toda vez
 * que a tela abre.
 */
const MENU_CACHE_KEY = (restaurantId: string) => `menu-cache:${restaurantId}`;

export async function getMenuInstant(
  restaurantId: string,
  onFresh?: (menu: { categories: CategoryRow[]; products: ProductRow[] }) => void
): Promise<{ categories: CategoryRow[]; products: ProductRow[] } | null> {
  const cached = await idbGet(MENU_CACHE_KEY(restaurantId)).catch(() => undefined);

  // revalida em segundo plano sempre, mesmo que já tenha cache (garante que
  // preço/estoque nunca fiquem desatualizados por muito tempo)
  listMenu(restaurantId)
    .then((fresh) => {
      idbSet(MENU_CACHE_KEY(restaurantId), fresh).catch(() => {});
      onFresh?.(fresh);
    })
    .catch(() => {
      /* offline ou erro de rede: quem já tem cache continua funcionando */
    });

  return cached ?? null;
}
