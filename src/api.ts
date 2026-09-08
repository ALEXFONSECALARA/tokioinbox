export const ADMIN_TOKEN_KEY = 'tokioinbox_admin_token';

function getToken() { return localStorage.getItem(ADMIN_TOKEN_KEY) || ''; }

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers || {});
  headers.set('Content-Type', 'application/json');
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const res = await fetch(path, { ...init, headers, cache: 'no-store' });
  const text = await res.text();
  let body: any = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = { error: text }; }
  if (!res.ok) {
    const err = new Error(body?.error || `HTTP ${res.status}`) as Error & { code?: string; requestId?: string; status?: number };
    err.code = body?.code || res.statusText;
    err.requestId = body?.requestId || res.headers.get('x-request-id') || undefined;
    err.status = res.status;
    throw err;
  }
  return body as T;
}

export async function adminLogin(password: string) {
  const result = await apiFetch<{ token: string }>('/api/admin/login', { method: 'POST', body: JSON.stringify({ password }) });
  localStorage.setItem(ADMIN_TOKEN_KEY, result.token);
  return result;
}
export function adminLogout() { localStorage.removeItem(ADMIN_TOKEN_KEY); }
export function hasAdminToken() { return Boolean(getToken()); }
export function adminToken() { return getToken(); }

export function openAdminEvents(onEvent: (event: string, payload: any) => void) {
  const token = getToken();
  if (!token) return () => {};
  const es = new EventSource(`/api/events?token=${encodeURIComponent(token)}`);
  ['order-created','order-updated','order-deleted','history-cleared','menu-updated','config-updated'].forEach(name => {
    es.addEventListener(name, (e: MessageEvent) => { try { onEvent(name, JSON.parse(e.data)); } catch {} });
  });
  return () => es.close();
}
