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
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      // ignora corpo não-JSON
    }
    throw new Error(message);
  }
  return res.json();
}

function authHeaders(token: string): HeadersInit {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

// ---------- Público ----------

export async function fetchRestaurants(): Promise<RestaurantSummary[]> {
  const res = await fetch(`${API_PREFIX}/restaurants`);
  return handleResponse<RestaurantSummary[]>(res);
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
  const res = await fetch(`${API_PREFIX}/${slug}/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(customerToken ? { Authorization: `Bearer ${customerToken}` } : {}),
    },
    body: JSON.stringify(order),
  });
  await handleResponse(res);
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

export async function fetchOrdersAdmin(slug: string, token: string): Promise<Order[]> {
  const res = await fetch(`${API_PREFIX}/${slug}/orders`, { headers: authHeaders(token) });
  return handleResponse<Order[]>(res);
}

export async function updateOrderAdmin(
  slug: string,
  token: string,
  orderId: string,
  patch: Partial<Order>
): Promise<Order> {
  const res = await fetch(`${API_PREFIX}/${slug}/orders/${orderId}`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(patch),
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
