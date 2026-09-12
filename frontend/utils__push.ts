// Ativa/desativa notificações push do navegador pra um restaurante (Fase 4,
// item 27). Fica isolado num helper próprio porque mexe com APIs do
// navegador (Service Worker, Push API) que não têm nada a ver com o resto
// de src/utils/api.ts (que é só fetch pro nosso backend).
const API_BASE = String(import.meta.env.VITE_API_URL || '')
  .trim()
  .replace(/\/+$/, '')
  .replace(/\/api$/i, '');
const API_PREFIX = API_BASE ? `${API_BASE}/api` : '/api';

export function isPushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export async function isPushSubscribed(): Promise<boolean> {
  if (!isPushSupported()) return false;
  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) return false;
  const sub = await registration.pushManager.getSubscription();
  return Boolean(sub);
}

// Pede permissão, registra o service worker e envia a inscrição pro backend
// deste restaurante. Silencioso em qualquer falha (permissão negada,
// navegador sem suporte, push não configurado no servidor) — notificação é
// um recurso opcional, nunca deve travar o resto do app.
export async function subscribeToPush(slug: string, token?: string): Promise<boolean> {
  if (!isPushSupported()) return false;
  try {
    const keyRes = await fetch(`${API_PREFIX}/push/vapid-public-key`);
    const { publicKey } = await keyRes.json();
    if (!publicKey) return false; // servidor sem VAPID configurado ainda

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return false;

    const registration = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });

    await fetch(`${API_PREFIX}/${slug}/push/subscribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(subscription.toJSON()),
    });
    return true;
  } catch (err) {
    console.error('Não foi possível ativar as notificações:', err);
    return false;
  }
}

export async function unsubscribeFromPush(slug: string): Promise<void> {
  if (!isPushSupported()) return;
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    const sub = await registration?.pushManager.getSubscription();
    if (!sub) return;
    const endpoint = sub.endpoint;
    await sub.unsubscribe();
    await fetch(`${API_PREFIX}/${slug}/push/unsubscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint }),
    });
  } catch (err) {
    console.error('Não foi possível desativar as notificações:', err);
  }
}
