/**
 * Anexa automaticamente o token de sessão do colaborador (Authorization: Bearer) a todas as
 * chamadas /api/ feitas pelo PAINEL. Instalado apenas em painel/main.tsx: o cardápio do
 * cliente não carrega este arquivo.
 */
const STAFF_TOKEN_KEY = 'tokio_staff_token';

export function installStaffAuthFetch() {
  const w = window as any;
  if (w.__nxStaffFetchInstalled) return;
  w.__nxStaffFetchInstalled = true;

  const nativeFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const isApi = url.startsWith('/api/') || url.startsWith(`${window.location.origin}/api/`);
    const isPublicAuth = /\/api\/(auth\/(login|forgot-password|reset-password)|customer\/)/.test(url);
    const token = isApi && !isPublicAuth ? sessionStorage.getItem(STAFF_TOKEN_KEY) : null;

    let finalInit = init;
    if (token) {
      const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
      if (!headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);
      finalInit = { ...init, headers };
    }

    const res = await nativeFetch(input as any, finalInit);
    if (token && res.status === 401) {
      window.dispatchEvent(new Event('nx-staff-unauthorized'));
    }
    return res;
  };
}
