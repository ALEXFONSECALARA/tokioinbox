import { supabase } from './supabaseClient';
import { fetchWithRetry } from './fetchWithRetry';

async function authHeader(extra: Record<string, string> = {}) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Sessão expirada. Faça login novamente.');
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...extra };
}

// Cache em memória do último ETag por restaurante — usado pra requisição
// condicional do Kanban (item 1/2 do pedido de otimização de rede): se o
// servidor responder 304, reaproveitamos os dados já em memória em vez de
// re-baixar o JSON inteiro de novo.
const etagCache = new Map<string, { etag: string; data: any }>();

export interface CreateOrderPayload {
  restaurantId: string;
  source: 'mesa' | 'balcao' | 'delivery' | 'online';
  orderType: 'delivery' | 'retirada' | 'mesa' | 'balcao';
  tableId?: string;
  customerName?: string;
  customerPhone?: string;
  deliveryAddress?: Record<string, unknown>;
  paymentMethod?: string;
  deliveryFee?: number;
  discount?: number;
  idempotencyKey?: string;
  items: Array<{ productId: string; quantity: number; notes?: string; optionIds?: string[] }>;
}

export async function apiCreateOrder(payload: CreateOrderPayload) {
  const res = await fetchWithRetry('/api/v2/orders', { method: 'POST', headers: await authHeader(), body: JSON.stringify(payload) });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Falha ao criar pedido.');
  return res.json();
}

export async function apiListOrders(restaurantId: string, statuses?: string[]) {
  const qs = new URLSearchParams({ restaurantId, ...(statuses ? { status: statuses.join(',') } : {}) });
  const cacheKey = qs.toString();
  const cached = etagCache.get(cacheKey);

  const res = await fetchWithRetry(`/api/v2/orders?${qs.toString()}`, {
    headers: await authHeader(cached ? { 'If-None-Match': cached.etag } : {}),
  });

  if (res.status === 304 && cached) {
    return cached.data; // nada mudou no servidor — reaproveita o que já temos, sem re-baixar
  }
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Falha ao listar pedidos.');

  const data = await res.json();
  const etag = res.headers.get('ETag');
  if (etag) etagCache.set(cacheKey, { etag, data });
  return data;
}

export async function apiUpdateOrderStatus(orderId: string, restaurantId: string, status: string, note?: string) {
  const res = await fetchWithRetry(`/api/v2/orders/${orderId}/status`, {
    method: 'PATCH',
    headers: await authHeader(),
    body: JSON.stringify({ restaurantId, status, note }),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Falha ao mudar status.');
  return res.json();
}

/** Gera uma chave de idempotência estável por "intenção de compra" (evita pedido duplicado por clique duplo / reenvio). */
export function newIdempotencyKey() {
  return `idem-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
