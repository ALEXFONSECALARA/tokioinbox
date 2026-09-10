// Central de notificações push (Fase 4, itens 27-30).
//
// Usa a biblioteca `web-push` (adicionada ao package.json) em vez de
// implementar a criptografia do protocolo Web Push (RFC 8291/8292) na mão —
// é código de segurança amplamente auditado e testado contra navegadores
// reais, e reimplementar isso manualmente seria um risco desnecessário
// numa área onde um bug sutil de criptografia não dá erro óbvio, só
// silenciosamente não entrega a notificação.
//
// Chaves VAPID: gere um par uma única vez com
//   node -e "console.log(require('web-push').generateVAPIDKeys())"
// e configure VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT no
// ambiente (.env / Render). Sem essas variáveis, o envio fica desativado
// (isPushConfigured() === false) — nada quebra, só não envia de verdade.
import webpush from 'web-push';

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:contato@tokioinbox.example';

export function isPushConfigured() {
  return Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);
}

if (isPushConfigured()) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

export function getVapidPublicKey() {
  return VAPID_PUBLIC_KEY;
}

// Envia pra uma única inscrição. Devolve { ok, expired } — expired=true
// significa que o navegador cancelou a inscrição (410/404, ex: usuário
// desinstalou o PWA) e o chamador deve apagar essa inscrição do banco.
export async function sendPushToSubscription(subscription, payload) {
  if (!isPushConfigured()) {
    return { ok: false, expired: false, error: 'Push não configurado (faltam as chaves VAPID).' };
  }
  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      },
      JSON.stringify(payload)
    );
    return { ok: true, expired: false };
  } catch (err) {
    const expired = err.statusCode === 404 || err.statusCode === 410;
    if (!expired) console.error('Erro ao enviar push:', err.message);
    return { ok: false, expired, error: err.message };
  }
}

// Envia pra uma lista de inscrições em paralelo e devolve quais expiraram
// (pra o chamador limpar do banco) e quantas foram entregues com sucesso.
export async function sendPushToMany(subscriptions, payload) {
  const results = await Promise.all(
    subscriptions.map(async (sub) => ({ sub, result: await sendPushToSubscription(sub, payload) }))
  );
  const expiredIds = results.filter((r) => r.result.expired).map((r) => r.sub.id);
  const sentCount = results.filter((r) => r.result.ok).length;
  return { sentCount, totalCount: subscriptions.length, expiredIds };
}
