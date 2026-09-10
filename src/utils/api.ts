import { Category, MenuItem, Order, RestaurantConfig, LayoutId, CustomerAccount, SavedAddress } from '../types';

const API_BASE = String(import.meta.env.VITE_API_URL || '')
  .trim()
  .replace(/\/+$/, '')
  .replace(/\/api$/i, '');
const API_PREFIX = API_BASE ? `${API_BASE}/api` : '/api';

// Dados usados pela vitrine multi-restaurantes "/". `emoji` é mantido só por
// compatibilidade retroativa (restaurantes antigos sem foto configurada);
// a Landing prioriza sempre `logo`/`bannerImage` quando existirem.
export interface RestaurantSummary {
  slug: string;
  name: string;
  emoji?: string;
  color: string;
  secondaryColor?: string;
  tagline?: string;
  logo?: string;
  bannerImage?: string;
  bannerPositionX?: number;
  bannerPositionY?: number;
  bannerZoom?: number;
  layout?: LayoutId;
  // Só vem preenchido de fato quando a lista foi buscada via
  // fetchRestaurantsAdmin — a lista pública (fetchRestaurants) já vem
  // pré-filtrada só com os ativos.
  active?: boolean;
  publicSlug?: string;
}

// Configuração global da vitrine multi-restaurantes "/" — título, subtítulo
// e layout escolhidos pelo super-admin. Não pertence a nenhum restaurante.
export interface PlatformSettings {
  landingTitle: string;
  landingSubtitle: string;
  landingLayout: LayoutId;
}

export interface MenuData {
  categories: Category[];
  menuItems: MenuItem[];
  restaurantConfig: RestaurantConfig;
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = `Erro na requisição (${res.status})`;
    let code = '';
    let requestId = res.headers.get('x-request-id') || '';
    try {
      const body = await res.json();
      if (body?.error) message = String(body.error);
      if (body?.code) code = String(body.code);
      if (body?.requestId) requestId = String(body.requestId);
    } catch {
      // ignora corpo não-JSON
    }
    const suffix = [code && `código: ${code}`, requestId && `pedido/solicitação: ${requestId}`].filter(Boolean).join(' | ');
    throw new Error(suffix ? `${message} (${suffix})` : message);
  }
  return res.json();
}

function authHeaders(token: string): HeadersInit {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}


export function toPublicSlug(name: string): string {
  return String(name || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'restaurante';
}

export interface OrderRealtimeEvent {
  type: 'created' | 'updated' | 'deleted' | 'history-cleared' | 'menu-updated' | 'config-updated' | 'print-job-created' | 'print-job-updated' | 'connected';
  orderId?: string;
  orderNumber?: number;
  status?: string;
  updatedAt?: string;
  version?: number;
}

export function subscribeToOrderEvents(
  slug: string,
  token: string,
  onEvent: (event: OrderRealtimeEvent) => void,
  signal?: AbortSignal,
  audience: 'admin' | 'customer' = 'admin',
  onState?: (state: 'connecting' | 'online' | 'reconnecting' | 'offline') => void
): () => void {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  let stopped = false;
  const run = async () => {
    let retry = 1000;
    onState?.('connecting');
    while (!stopped && !controller.signal.aborted) {
      try {
        const res = await fetch(`${API_PREFIX}/${encodeURIComponent(slug)}/order-events?audience=${audience}`, {
          headers: authHeaders(token), signal: controller.signal, cache: 'no-store'
        });
        if (!res.ok || !res.body) {
          if (res.status === 401 || res.status === 403) break;
          throw new Error(`SSE ${res.status}`);
        }
        retry = 1000;
        onState?.('online');
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        while (!stopped && !controller.signal.aborted) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const chunks = buffer.split('\n\n');
          buffer = chunks.pop() || '';
          for (const chunk of chunks) {
            const line = chunk.split('\n').find(x => x.startsWith('data:'));
            if (!line) continue;
            try { onEvent(JSON.parse(line.slice(5).trim())); } catch {}
          }
        }
      } catch (err) {
        if (controller.signal.aborted || stopped) break;
      }
      if (!stopped && !controller.signal.aborted) {
        onState?.('reconnecting');
        await new Promise(r => setTimeout(r, retry));
        retry = Math.min(retry * 2, 8000);
      }
    }
  };
  void run();
  return () => { stopped = true; controller.abort(); onState?.('offline'); signal?.removeEventListener('abort', abort); };
}

// ---------- Público ----------

export async function fetchRestaurants(): Promise<RestaurantSummary[]> {
  const res = await fetch(`${API_PREFIX}/restaurants`);
  return handleResponse<RestaurantSummary[]>(res);
}


export interface RestaurantHealth {
  ok: boolean;
  status: 'healthy' | 'attention' | 'unhealthy';
  restaurant: { slug: string; name: string; active: boolean; operationalStatus: string };
  metrics: { products: number; categories: number; totalOrders: number; activeOrders: number; productsWithoutImages: number; realtimeClients: number };
  capabilities: { dataBackend: string; storageMode: string; pushConfigured: boolean; aiConfigured: boolean };
  issues: { key: string; severity: 'error' | 'warning' | 'info'; message: string }[];
  latencyMs?: number;
  timestamp?: string;
}

export async function fetchRestaurantHealth(slug: string, token: string): Promise<RestaurantHealth> {
  const res = await fetch(`${API_PREFIX}/${encodeURIComponent(slug)}/health`, { headers: authHeaders(token), cache: 'no-store' });
  return handleResponse<RestaurantHealth>(res);
}

export async function fetchPlatformSettings(): Promise<PlatformSettings> {
  const res = await fetch(`${API_PREFIX}/platform`);
  return handleResponse<PlatformSettings>(res);
}

// Consulta leve do ajuste operacional atual (Fase 4, itens 14-16) — usada em
// polling curto pelo cliente com pedido aberto, pra atualizar a previsão de
// entrega quase em tempo real sem recarregar o cardápio inteiro.
export async function fetchOperationalStatus(
  slug: string
): Promise<{ operationalStatus: string; operationalAdjustmentMinutes: number }> {
  const res = await fetch(`${API_PREFIX}/${slug}/operational-status`);
  return handleResponse(res);
}

export async function fetchMenu(slug: string): Promise<MenuData> {
  const res = await fetch(`${API_PREFIX}/${slug}/menu`);
  return handleResponse<MenuData>(res);
}

export async function createOrder(slug: string, order: Order, customerToken?: string): Promise<void> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`${API_PREFIX}/${encodeURIComponent(slug)}/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(customerToken ? { Authorization: `Bearer ${customerToken}` } : {}),
          'X-Request-ID': order.id,
        },
        cache: 'no-store',
        body: JSON.stringify(order),
      });
      if (!res.ok && res.status >= 400 && res.status < 500) {
        await handleResponse(res); // throws immediately; do not retry validation/schema errors
      }
      await handleResponse(res);
      return;
    } catch (err) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err || '');
      // Validation/auth/business errors are deterministic. Retrying them only
      // delays the real message and can make checkout look frozen.
      if (/Pedido inválido|Modalidade|Total do pedido|indisponível|Restaurante não encontrado|não autorizado|banco .*atualizado|migration/i.test(msg)) break;
      if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 700 * (attempt + 1)));
    }
  }
  const finalError = lastError instanceof Error ? lastError : new Error('Não foi possível enviar o pedido ao restaurante.');
  // Preserve the server's diagnostic message (and request id when present) so
  // support can identify the exact failed order instead of showing only a
  // generic connectivity alert.
  throw finalError;
}
export async function fetchOrder(slug: string, orderId: string): Promise<Order> {
  const res = await fetch(`${API_PREFIX}/${slug}/orders/${orderId}`);
  return handleResponse<Order>(res);
}

// ---------- Admin (super-admin único, com token) ----------

export async function adminLogin(password: string): Promise<string> {
  const res = await fetch(`${API_PREFIX}/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  const data = await handleResponse<{ token: string }>(res);
  return data.token;
}

// Lista TODOS os restaurantes (ativos e inativos) — usada pela barra de
// troca do super-admin, que precisa mostrar e permitir reativar restaurantes
// desativados (diferente de fetchRestaurants, que é pública e só traz ativos).
export async function fetchRestaurantsAdmin(token: string): Promise<RestaurantSummary[]> {
  const res = await fetch(`${API_PREFIX}/admin/restaurants`, { headers: authHeaders(token) });
  return handleResponse<RestaurantSummary[]>(res);
}

export async function setRestaurantActive(
  token: string,
  slug: string,
  active: boolean
): Promise<RestaurantSummary | null> {
  const res = await fetch(`${API_PREFIX}/admin/restaurants/${slug}/active`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify({ active }),
  });
  const data = await handleResponse<{ ok: true; restaurant: RestaurantSummary | null }>(res);
  return data.restaurant;
}

// ---------- Usuários do painel + permissões granulares (Fase 4, itens 17-19) ----------

export interface AdminUser {
  id: string;
  name: string;
  login: string;
  role: string;
  active: boolean;
  restaurantSlug: string | null;
  permissions: Record<string, boolean>;
  createdAt?: string;
  updatedAt?: string;
}

// Login individual (login + senha) — alternativa ao adminLogin() por senha
// única. As duas formas convivem: nenhuma substitui a outra.
export async function adminUserLogin(
  login: string,
  password: string
): Promise<{ token: string; user: AdminUser }> {
  const res = await fetch(`${API_PREFIX}/admin/users/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login, password }),
  });
  return handleResponse(res);
}

export interface CustomerAdmin { id:string; name:string; phone:string; email?:string|null; createdAt?:string; updatedAt?:string; }
export async function fetchAdminCustomers(token:string):Promise<CustomerAdmin[]>{const res=await fetch(`${API_PREFIX}/admin/customers`,{headers:authHeaders(token)});return handleResponse(res);}
export async function deleteAdminCustomer(token:string,id:string):Promise<void>{await handleResponse(await fetch(`${API_PREFIX}/admin/customers/${id}`,{method:'DELETE',headers:authHeaders(token)}));}

export async function fetchAdminUsers(token: string): Promise<AdminUser[]> {
  const res = await fetch(`${API_PREFIX}/admin/users`, { headers: authHeaders(token) });
  return handleResponse<AdminUser[]>(res);
}

export async function createAdminUser(
  token: string,
  data: {
    name: string;
    login: string;
    password: string;
    restaurantSlug: string | null;
    role: string;
    permissions: Record<string, boolean>;
  }
): Promise<AdminUser> {
  const res = await fetch(`${API_PREFIX}/admin/users`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });
  const result = await handleResponse<{ ok: true; user: AdminUser }>(res);
  return result.user;
}

export async function updateAdminUser(
  token: string,
  id: string,
  patch: Partial<{
    name: string;
    restaurantSlug: string | null;
    role: string;
    active: boolean;
    permissions: Record<string, boolean>;
    newPassword: string;
  }>
): Promise<AdminUser> {
  const res = await fetch(`${API_PREFIX}/admin/users/${id}`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(patch),
  });
  const result = await handleResponse<{ ok: true; user: AdminUser }>(res);
  return result.user;
}

export interface PrintJob { id:string; restaurantSlug:string; orderId:string; orderNumber?:string|null; variant:'kitchen'|'delivery'|'customer'; status:'pendente'|'imprimindo'|'impresso'|'erro'|'cancelado'; attempts:number; createdAt:string; updatedAt:string; error?:string|null }
export async function fetchPrintJobs(slug:string, token:string):Promise<PrintJob[]>{const res=await fetch(`${API_PREFIX}/${slug}/print-jobs`,{headers:authHeaders(token)});return (await handleResponse<{jobs:PrintJob[]}>(res)).jobs;}
export async function createPrintJob(slug:string,token:string,orderId:string,orderNumber?:string,variant:'kitchen'|'delivery'|'customer'='customer'):Promise<PrintJob>{const res=await fetch(`${API_PREFIX}/${slug}/print-jobs`,{method:'POST',headers:authHeaders(token),body:JSON.stringify({orderId,orderNumber,variant})});return (await handleResponse<{job:PrintJob}>(res)).job;}
export async function updatePrintJob(slug:string,token:string,id:string,patch:Partial<Pick<PrintJob,'status'|'attempts'|'error'>>):Promise<PrintJob>{const res=await fetch(`${API_PREFIX}/${slug}/print-jobs/${id}`,{method:'PATCH',headers:authHeaders(token),body:JSON.stringify(patch)});return (await handleResponse<{job:PrintJob}>(res)).job;}

export async function fetchOrdersAdmin(slug: string, token: string): Promise<Order[]> {
  const res = await fetch(`${API_PREFIX}/${encodeURIComponent(slug)}/orders`, { headers: authHeaders(token), cache: 'no-store' });
  return handleResponse<Order[]>(res);
}

export async function deleteOrderAdmin(slug:string, token:string, orderId:string):Promise<Order>{ const res=await fetch(`${API_PREFIX}/${slug}/orders/${orderId}`,{method:'DELETE',headers:authHeaders(token)}); const data=await handleResponse<{order:Order}>(res); return data.order; }
export async function clearOrderHistory(slug:string, token:string, password?:string):Promise<number>{ const res=await fetch(`${API_PREFIX}/${slug}/orders/history`,{method:'DELETE',headers:authHeaders(token),body:JSON.stringify(password?{password}:{})}); const data=await handleResponse<{removed:number}>(res); return data.removed; }

// ---------- Kanban com senha própria (evolução v24_2) ----------
export async function kanbanLogin(slug: string, password: string): Promise<string> {
  const res = await fetch(`${API_PREFIX}/${encodeURIComponent(slug)}/kanban-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  const data = await handleResponse<{ token: string }>(res);
  return data.token;
}

export async function kanbanAllLogin(password: string): Promise<string> {
  const res = await fetch(`${API_PREFIX}/kanban-all/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  const data = await handleResponse<{ token: string }>(res);
  return data.token;
}

export interface KanbanAllOrder extends Order {
  restaurantSlug: string;
  restaurantName: string;
}

export async function fetchKanbanAllOrders(token: string): Promise<{ orders: KanbanAllOrder[]; restaurants: { slug: string; name: string }[] }> {
  const res = await fetch(`${API_PREFIX}/kanban-all/orders`, { headers: authHeaders(token), cache: 'no-store' });
  return handleResponse(res);
}

export async function updateKanbanAllOrderStatus(
  token: string,
  slug: string,
  orderId: string,
  patch: Partial<Order>
): Promise<Order> {
  const res = await fetch(`${API_PREFIX}/kanban-all/${slug}/orders/${orderId}`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(patch),
  });
  const data = await handleResponse<{ order: Order }>(res);
  return data.order;
}
export interface AdminLoginLog {id:string;createdAt:string;adminUserId?:string|null;login?:string|null;success:boolean;mode:string;ip?:string|null;userAgent?:string|null;details?:Record<string,unknown>}
export interface ErrorLog {id:string;createdAt:string;level:string;context?:string|null;message:string;stack?:string|null;restaurantSlug?:string|null;details?:Record<string,unknown>}
export async function fetchAdminLoginLogs(token:string):Promise<AdminLoginLog[]>{const res=await fetch(`${API_PREFIX}/admin/logs/login`,{headers:authHeaders(token)});return (await handleResponse<{logs:AdminLoginLog[]}>(res)).logs;}
export async function clearAdminLoginLogs(token:string):Promise<void>{await handleResponse(await fetch(`${API_PREFIX}/admin/logs/login`,{method:'DELETE',headers:authHeaders(token)}));}
export async function deleteAdminLoginLog(token:string,id:string):Promise<void>{await handleResponse(await fetch(`${API_PREFIX}/admin/logs/login/${id}`,{method:'DELETE',headers:authHeaders(token)}));}
export async function fetchErrorLogs(token:string):Promise<ErrorLog[]>{const res=await fetch(`${API_PREFIX}/admin/logs/errors`,{headers:authHeaders(token)});return (await handleResponse<{logs:ErrorLog[]}>(res)).logs;}
export async function clearErrorLogs(token:string):Promise<void>{await handleResponse(await fetch(`${API_PREFIX}/admin/logs/errors`,{method:'DELETE',headers:authHeaders(token)}));}
export async function deleteErrorLog(token:string,id:string):Promise<void>{await handleResponse(await fetch(`${API_PREFIX}/admin/logs/errors/${id}`,{method:'DELETE',headers:authHeaders(token)}));}

export async function updateOrderAdmin(
  slug: string,
  token: string,
  orderId: string,
  patch: Partial<Order>,
  expectedUpdatedAt?: string
): Promise<Order> {
  const res = await fetch(`${API_PREFIX}/${slug}/orders/${orderId}`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify({ ...patch, ...(expectedUpdatedAt ? { expectedUpdatedAt } : {}) }),
  });
  const data = await handleResponse<{ order: Order }>(res);
  return data.order;
}

export async function saveMenuItems(slug: string, token: string, menuItems: MenuItem[]): Promise<void> {
  const res = await fetch(`${API_PREFIX}/${slug}/menu-items`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(menuItems),
  });
  await handleResponse(res);
}

export async function saveCategories(slug: string, token: string, categories: Category[]): Promise<void> {
  const res = await fetch(`${API_PREFIX}/${slug}/categories`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(categories),
  });
  await handleResponse(res);
}

// Envia uma foto (logo, banner, splash, prato, entregador) do computador do
// restaurante para o backend, que sobe pro Cloudinary (produção) ou salva
// localmente como fallback, e devolve a URL pública já pronta pra usar.
export interface MediaAsset {
  id: string;
  restaurantSlug?: string;
  restaurantId?: string;
  storageProvider: string;
  bucket?: string;
  storagePath?: string;
  url: string;
  kind: string;
  entityType?: string;
  entityId?: string;
  originalName?: string;
  mimeType?: string;
  sizeBytes?: number;
  altText?: string;
  metadata?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

export async function uploadImage(
  slug: string,
  token: string,
  file: File,
  metadata: { kind?: string; entityType?: string; entityId?: string; altText?: string } = {}
): Promise<string> {
  const formData = new FormData();
  formData.append('image', file);
  if (metadata.kind) formData.append('kind', metadata.kind);
  if (metadata.entityType) formData.append('entityType', metadata.entityType);
  if (metadata.entityId) formData.append('entityId', metadata.entityId);
  if (metadata.altText) formData.append('altText', metadata.altText);
  const res = await fetch(`${API_PREFIX}/${slug}/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` }, // sem Content-Type: o browser define o boundary do multipart
    body: formData,
  });
  const data = await handleResponse<{ url: string; asset?: MediaAsset }>(res);
  // URL do Cloudinary já vem absoluta (https://res.cloudinary.com/...) — só
  // o fallback local devolve um caminho relativo (/uploads/...), que aí sim
  // precisa do prefixo do backend quando front e back estão em domínios
  // separados (VITE_API_URL definido).
  const isAbsolute = /^https?:\/\//i.test(data.url);
  return isAbsolute ? data.url : new URL(data.url, API_BASE || window.location.origin).toString();
}

export async function listMediaAssets(slug: string, token: string, kind?: string): Promise<MediaAsset[]> {
  const query = kind ? `?kind=${encodeURIComponent(kind)}` : '';
  const res = await fetch(`${API_PREFIX}/${slug}/media${query}`, { headers: authHeaders(token) });
  const data = await handleResponse<{ assets: MediaAsset[] }>(res);
  return data.assets || [];
}

export async function deleteMediaAsset(slug: string, token: string, assetId: string): Promise<MediaAsset | null> {
  const res = await fetch(`${API_PREFIX}/${slug}/media/${encodeURIComponent(assetId)}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  const data = await handleResponse<{ asset: MediaAsset }>(res);
  return data.asset || null;
}

export async function savePlatformSettings(token: string, settings: PlatformSettings): Promise<PlatformSettings> {
  const res = await fetch(`${API_PREFIX}/admin/platform`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(settings),
  });
  const data = await handleResponse<{ platform: PlatformSettings }>(res);
  return data.platform;
}

export async function saveRestaurantConfig(
  slug: string,
  token: string,
  config: RestaurantConfig
): Promise<void> {
  const res = await fetch(`${API_PREFIX}/${slug}/config`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(config),
  });
  await handleResponse(res);
}

// ---------- Conta do cliente + endereços salvos (Fase 4, itens 20-22) ----------
// Autenticação própria, separada da do painel (adminLogin/adminUserLogin) —
// aqui é o cliente final, não um usuário do painel.

function customerAuthHeaders(token: string): HeadersInit {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

export async function registerCustomer(data: {
  name: string;
  phone: string;
  email?: string;
  password: string;
}): Promise<{ token: string; customer: CustomerAccount }> {
  const res = await fetch(`${API_PREFIX}/customers/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return handleResponse(res);
}

export async function loginCustomer(
  phone: string,
  password: string
): Promise<{ token: string; customer: CustomerAccount }> {
  const res = await fetch(`${API_PREFIX}/customers/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, password }),
  });
  return handleResponse(res);
}

export async function fetchCustomerProfile(token: string): Promise<CustomerAccount> {
  const res = await fetch(`${API_PREFIX}/customers/me`, { headers: customerAuthHeaders(token) });
  return handleResponse(res);
}

export async function updateCustomerProfile(
  token: string,
  patch: Partial<{ name: string; email: string; newPassword: string }>
): Promise<CustomerAccount> {
  const res = await fetch(`${API_PREFIX}/customers/me`, {
    method: 'PATCH',
    headers: customerAuthHeaders(token),
    body: JSON.stringify(patch),
  });
  return handleResponse(res);
}

export async function fetchCustomerAddresses(token: string): Promise<SavedAddress[]> {
  const res = await fetch(`${API_PREFIX}/customers/me/addresses`, { headers: customerAuthHeaders(token) });
  return handleResponse(res);
}

export async function saveCustomerAddress(
  token: string,
  address: Omit<SavedAddress, 'id' | 'customerId'>
): Promise<SavedAddress> {
  const res = await fetch(`${API_PREFIX}/customers/me/addresses`, {
    method: 'POST',
    headers: customerAuthHeaders(token),
    body: JSON.stringify(address),
  });
  return handleResponse(res);
}

export async function updateCustomerAddress(
  token: string,
  id: string,
  patch: Partial<Omit<SavedAddress, 'id' | 'customerId'>>
): Promise<SavedAddress> {
  const res = await fetch(`${API_PREFIX}/customers/me/addresses/${id}`, {
    method: 'PATCH',
    headers: customerAuthHeaders(token),
    body: JSON.stringify(patch),
  });
  return handleResponse(res);
}

export async function deleteCustomerAddress(token: string, id: string): Promise<void> {
  const res = await fetch(`${API_PREFIX}/customers/me/addresses/${id}`, {
    method: 'DELETE',
    headers: customerAuthHeaders(token),
  });
  await handleResponse(res);
}

export async function fetchCustomerOrders(
  token: string
): Promise<(Order & { restaurantSlug: string; restaurantName: string })[]> {
  const res = await fetch(`${API_PREFIX}/customers/me/orders`, { headers: customerAuthHeaders(token) });
  return handleResponse(res);
}

export async function fetchDrivers(slug:string,token:string){const res=await fetch(`${API_PREFIX}/${encodeURIComponent(slug)}/drivers`,{headers:authHeaders(token)});return handleResponse<{drivers:any[]}>(res);}
export async function fetchBackups(slug:string,token:string){const res=await fetch(`${API_PREFIX}/${encodeURIComponent(slug)}/backups`,{headers:authHeaders(token)});return handleResponse<{backups:any[]}>(res);}
export async function createBackup(slug:string,token:string){const res=await fetch(`${API_PREFIX}/${encodeURIComponent(slug)}/backup`,{headers:authHeaders(token)});return handleResponse(res);}
export async function restoreBackup(slug:string,token:string,id:string){const res=await fetch(`${API_PREFIX}/${encodeURIComponent(slug)}/backups/${id}/restore`,{method:'POST',headers:authHeaders(token)});return handleResponse(res);}
