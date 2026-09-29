// V9 PLUS ULTRA 01 — teste de integração: Fiscal, Pausa, Dispositivos, Permissões Caixa/Garçom.
// Uso: node scripts/v9-plus-ultra-01-test.mjs
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PORT = 5400 + Math.floor(Math.random() * 400);
const B = `http://127.0.0.1:${PORT}`;
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'pdv-v9p01-'));
const LOG = '/tmp/v9p01-server.log';
const out = fs.openSync(LOG, 'w');
const child = spawn('npx', ['tsx', 'server.ts'], {
  env: { ...process.env, NODE_ENV: 'production', PORT: String(PORT), ADMIN_PASSWORD: 'admin', DATA_DIR: DATA, GEMINI_API_KEY: '' },
  stdio: ['ignore', out, out],
});
let failed = 0, passed = 0;
const t = (name, ok, extra = '') => { (ok ? passed++ : failed++); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  -> ' + extra}`); };
const j = async (p, method = 'GET', data, token) => {
  const r = await fetch(B + p, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: data ? JSON.stringify(data) : undefined });
  let body = null; try { body = await r.json(); } catch {}
  return { status: r.status, body };
};
async function waitUp() {
  for (let i = 0; i < 90; i++) { try { if ((await fetch(B + '/api/health')).ok) return; } catch {} await new Promise(r => setTimeout(r, 500)); }
  throw new Error('servidor não subiu: ' + fs.readFileSync(LOG, 'utf8').slice(-1500));
}
const login = async (u, p) => (await j('/api/auth/login', 'POST', { username: u, password: p })).body?.token;

try {
  await waitUp();
  const adm = await login('admin', 'admin');
  t('login admin', !!adm);

  const cat = await j('/api/public/catalog');
  const slugs = Object.keys(cat.body.restaurants);
  const [A, Bslug] = slugs;
  t('há ao menos 2 restaurantes', slugs.length >= 2, JSON.stringify(slugs));
  const itemOf = (s) => cat.body.menuItems.find((m) => m.restaurantSlug === s && m.available !== false && !(m.optionGroups || []).some((g) => g.required));

  // ---------- usuários ----------
  const mk = (username, role, slug) => j('/api/users', 'POST', { name: username, username, password: 'Senha' + username + '9', role, restaurantSlug: slug }, adm);
  const cg = await mk('caixa1', 'caixa', A);
  const gg = await mk('garcom1', 'garcom', A);
  const gOther = await mk('garcomb', 'garcom', Bslug);
  t('cria caixa e garçom', cg.body?.success && gg.body?.success, JSON.stringify([cg.body, gg.body]).slice(0, 200));
  t('caixa nasce com can_receive_payment', cg.body?.user?.permissions?.can_receive_payment === true);
  t('garçom nasce SEM can_receive_payment', gg.body?.user?.permissions?.can_receive_payment === false);
  const tCaixa = await login('caixa1', 'Senhacaixa19');
  const tGarcom = await login('garcom1', 'Senhagarcom19');
  const tGarcomB = await login('garcomb', 'Senhagarcomb9');
  t('logins caixa/garçom', !!tCaixa && !!tGarcom && !!tGarcomB);

  // garçom com permissão personalizada de pagamento continua bloqueado
  const gx = await j('/api/users', 'POST', { name: 'gx', username: 'garcomx', password: 'Senhagx9x', role: 'garcom', restaurantSlug: A, customPermissions: { can_receive_payment: true } }, adm);
  t('garçom nunca recebe can_receive_payment (nem personalizado)', gx.body?.user?.permissions?.can_receive_payment === false, JSON.stringify(gx.body?.user?.permissions));

  // ---------- 1. FISCAL ----------
  const fiscalOk = await j(`/api/fiscal/config/${A}`, 'GET', null, adm);
  t('Fiscal: config carrega com token real (200)', fiscalOk.status === 200 && fiscalOk.body?.success, String(fiscalOk.status));
  const fiscalDemo = await j(`/api/fiscal/config/${A}`, 'GET', null, 'token-demo');
  t('Fiscal: "token-demo" é 401 (causa do logout antigo)', fiscalDemo.status === 401);
  const fSave = await j(`/api/fiscal/config/${A}`, 'POST', { nomeFantasia: 'Loja A Teste', regimeTributario: 'simples_nacional' }, adm);
  t('Fiscal: salvar funciona', fSave.status === 200 && fSave.body?.success, JSON.stringify(fSave.body).slice(0, 200));
  const fCross = await j(`/api/fiscal/config/${Bslug}`, 'GET', null, tCaixa);
  t('Fiscal: usuário da loja A não lê fiscal da loja B (403)', fCross.status === 403, String(fCross.status));

  // ---------- 2. PAUSA ----------
  const full = await j('/api/catalog', 'GET', null, adm);
  const pause = (slug, open) => {
    const restaurants = JSON.parse(JSON.stringify(full.body.restaurants));
    restaurants[slug].isOpen = open;
    return j('/api/catalog', 'PUT', { restaurants, categories: full.body.categories, menuItems: full.body.menuItems }, adm);
  };
  const orderBody = (slug, extra = {}) => ({ restaurantSlug: slug, orderType: 'balcao', customerName: 'Cliente', customerPhone: '22999998888', paymentMethod: 'pix', items: [{ menuItemId: itemOf(slug).id, quantity: 1 }], ...extra });
  const before = await j('/api/orders', 'POST', orderBody(A));
  t('Pausa: restaurante ATIVO aceita pedido do cliente', before.body?.success, JSON.stringify(before.body).slice(0, 200));
  const pz = await pause(A, false);
  t('Pausa: admin pausa a loja A', pz.body?.success, JSON.stringify(pz.body).slice(0, 200));
  const blocked = await j('/api/orders', 'POST', orderBody(A));
  t('Pausa: loja A pausada RECUSA pedido do cliente', blocked.status >= 400 && !blocked.body?.success, JSON.stringify(blocked.body).slice(0, 200));
  const other = await j('/api/orders', 'POST', orderBody(Bslug));
  t('Pausa: loja B continua aceitando (A pausada ≠ B pausada)', other.body?.success, JSON.stringify(other.body).slice(0, 200));
  const pub = await j('/api/public/catalog');
  t('Pausa: catálogo público reflete A=pausada, B=aberta', pub.body.restaurants[A].isOpen === false && pub.body.restaurants[Bslug].isOpen !== false);
  const tk = await j(`/api/table/access-token?slug=${A}&table=3`, 'GET', null, adm);
  if (tk.body?.token) {
    const qr = await j('/api/orders/table/append', 'POST', { tableNumber: 3, restaurantSlug: A, items: [{ name: 'x', quantity: 1, unitPrice: 1 }], tableAccessToken: tk.body.token });
    t('Pausa: cliente na MESA (QR) também é bloqueado', qr.status >= 400 && !qr.body?.success, JSON.stringify(qr.body).slice(0, 200));
  } else t('Pausa: token de mesa obtido', false, JSON.stringify(tk.body));
  const staffOrder = await j('/api/orders', 'POST', orderBody(A), tCaixa);
  t('Pausa: equipe ainda pode lançar pedido na loja pausada', staffOrder.body?.success, JSON.stringify(staffOrder.body).slice(0, 200));
  await pause(A, true);
  const back = await j('/api/orders', 'POST', orderBody(A));
  t('Pausa: ao reativar, cliente volta a pedir', back.body?.success, JSON.stringify(back.body).slice(0, 200));

  // ---------- 3. DISPOSITIVOS ----------
  const c = await j('/api/devices/qr/create', 'POST', { restaurantSlug: A }, adm);
  const claim = await j('/api/devices/qr/claim', 'POST', { token: c.body.token, deviceName: 'Celular 01', deviceType: 'celular', platform: 'android' }, tGarcom);
  const dec = await j(`/api/devices/qr/claim/${claim.body.claimId}/decision`, 'POST', { approve: true, screenRole: 'garcom' }, adm);
  const dev = dec.body?.device;
  t('Dispositivo: nasce com a função escolhida na aprovação', dev?.screenRole === 'garcom', JSON.stringify(dec.body).slice(0, 200));
  for (const r of ['caixa', 'cliente', 'cozinha_kds', 'sushibar_kds', 'barra_kds', 'garcom']) {
    const p = await j(`/api/devices/${dev.id}`, 'PATCH', { screenRole: r }, adm);
    t(`Dispositivo: função ${r}`, p.body?.device?.screenRole === r, JSON.stringify(p.body).slice(0, 150));
  }
  const multi = await j(`/api/devices/${dev.id}`, 'PATCH', { screenRole: ['garcom', 'caixa'] }, adm);
  t('Dispositivo: várias funções ao mesmo tempo => recusado', multi.status === 400, JSON.stringify(multi.body));
  const inval = await j(`/api/devices/${dev.id}`, 'PATCH', { screenRole: 'admin' }, adm);
  t('Dispositivo: função inexistente => recusada', inval.status === 400);
  const ping = await j('/api/devices/ping', 'POST', { idOrCode: dev.id });
  t('Dispositivo: ping devolve a função única (para carregar só aquela tela)', ping.body?.device?.screenRole === 'garcom');
  const noAdmin = await j(`/api/devices/${dev.id}`, 'PATCH', { screenRole: 'caixa' }, tGarcom);
  t('Dispositivo: garçom não altera função (403)', noAdmin.status === 403);
  const bad = await j(`/api/devices/${dev.id}`, 'PATCH', { restaurantSlug: 'nao-existe' }, adm);
  t('Dispositivo: vincular a restaurante inexistente => 400', bad.status === 400);
  // multi-restaurante: admin restrito à loja B não vê/edita aparelho da loja A
  const admB = await j('/api/users', 'POST', { name: 'admB', username: 'admb', password: 'Senhaadmb9', role: 'administrador', restaurantSlug: Bslug }, adm);
  const tAdmB = await login('admb', 'Senhaadmb9');
  const listB = await j('/api/devices', 'GET', null, tAdmB);
  t('Multi-restaurante: admin da loja B não lista aparelho da loja A', listB.body?.devices?.every((d) => d.id !== dev.id), JSON.stringify(listB.body).slice(0, 200));
  const patchB = await j(`/api/devices/${dev.id}`, 'PATCH', { screenRole: 'caixa' }, tAdmB);
  t('Multi-restaurante: admin da loja B não altera aparelho da loja A (403)', patchB.status === 403, String(patchB.status));

  // ---------- 4-7. FLUXO GARÇOM → CAIXA ----------
  // abre caixa (regra: mesas exigem caixa aberto)
  const cur = await j('/api/state/cashShift', 'GET', null, adm);
  await j('/api/state/cashShift', 'PUT', { baseVersion: cur.body?.version ?? 0, value: { id: 'shift-p01', openedAt: new Date().toISOString(), initialAmount: 100, movements: [], isClosed: false } }, adm);

  const mesa = await j('/api/orders', 'POST', { ...orderBody(A, { orderType: 'mesa', tableNumber: 12, paymentMethod: 'dinheiro' }) }, tGarcom);
  t('Garçom abre atendimento/insere produtos na mesa', mesa.body?.success, JSON.stringify(mesa.body).slice(0, 200));
  const ord = mesa.body?.order;

  const payG = await j(`/api/orders/${ord.id}/close-table`, 'POST', { paymentMethod: 'dinheiro', tableNumber: 12 }, tGarcom);
  t('GARÇOM tentando PAGAMENTO por API => 403 PAYMENT_FORBIDDEN', payG.status === 403 && payG.body?.code === 'PAYMENT_FORBIDDEN', JSON.stringify(payG.body));
  const finG = await j(`/api/orders/${ord.id}/status`, 'PATCH', { status: 'finalizado' }, tGarcom);
  t('GARÇOM finalizando mesa via PATCH status => 403 (sem contorno)', finG.status === 403 && finG.body?.code === 'PAYMENT_FORBIDDEN', JSON.stringify(finG.body));
  const stillOpen = await j(`/api/orders/${ord.id}`, 'GET', null, tCaixa);
  t('mesa continua aberta após tentativas do garçom', stillOpen.body?.order?.status !== 'finalizado' && !stillOpen.body?.order?.paymentDetails?.paid, JSON.stringify(stillOpen.body?.order?.status));

  const bill = await j('/api/tables/12/request-bill', 'POST', { restaurantSlug: A }, tGarcom);
  t('GARÇOM faz FECHAMENTO → AGUARDANDO PAGAMENTO', bill.body?.success && bill.body.orders?.every((o) => o.awaitingPayment), JSON.stringify(bill.body).slice(0, 200));
  const add = await j('/api/orders/table/append', 'POST', { tableNumber: 12, restaurantSlug: A, items: [{ name: 'x', quantity: 1, unitPrice: 1 }] }, tGarcom);
  t('conta em fechamento não aceita novos itens', add.status >= 400 && !add.body?.success);

  const payOtherStore = await j(`/api/orders/${ord.id}/close-table`, 'POST', { paymentMethod: 'dinheiro', tableNumber: 12 }, tGarcomB);
  t('usuário de outra loja não paga (bloqueado)', payOtherStore.status === 403, String(payOtherStore.status));

  const payC = await j(`/api/orders/${ord.id}/close-table`, 'POST', { paymentMethod: 'dinheiro', tableNumber: 12 }, tCaixa);
  t('CAIXA confirma PAGAMENTO → conta finalizada', payC.body?.success && payC.body.order?.status === 'finalizado' && payC.body.order?.paymentDetails?.paid === true, JSON.stringify(payC.body).slice(0, 250));
  const dup = await j(`/api/orders/${ord.id}/close-table`, 'POST', { paymentMethod: 'dinheiro', tableNumber: 12 }, tCaixa);
  t('pagamento duplicado é recusado', dup.status === 400);
  const list = await j('/api/orders', 'GET', null, tCaixa);
  const live = (list.body?.orders || []).filter((o) => o.restaurantSlug === A && o.orderType === 'mesa' && o.tableNumber === 12 && !['finalizado', 'cancelado'].includes(o.status));
  t('MESA LIVRE: nenhuma comanda ativa na mesa 12', live.length === 0, JSON.stringify(live.map((o) => o.status)));

  // admin paga conforme configuração; admin sem permissão => bloqueado
  const m2 = await j('/api/orders', 'POST', { ...orderBody(A, { orderType: 'mesa', tableNumber: 13, paymentMethod: 'dinheiro' }) }, tGarcom);
  const payAdm = await j(`/api/orders/${m2.body.order.id}/close-table`, 'POST', { paymentMethod: 'pix', tableNumber: 13 }, adm);
  t('ADMIN (super) paga', payAdm.body?.success, JSON.stringify(payAdm.body).slice(0, 200));
  const m3 = await j('/api/orders', 'POST', { ...orderBody(A, { orderType: 'mesa', tableNumber: 14, paymentMethod: 'dinheiro' }) }, tGarcom);
  const rev = await j('/api/users', 'GET', null, adm);
  const caixaUser = (rev.body.users || []).find((u) => u.username === 'caixa1');
  await j(`/api/users/${caixaUser.id}`, 'PATCH', { permissions: { can_receive_payment: false } }, adm);
  const tCaixa2 = await login('caixa1', 'Senhacaixa19');
  const payNo = await j(`/api/orders/${m3.body.order.id}/close-table`, 'POST', { paymentMethod: 'pix', tableNumber: 14 }, tCaixa2);
  t('permissão configurável: caixa SEM can_receive_payment => 403', payNo.status === 403, String(payNo.status));
} catch (e) {
  failed++; console.log('ERRO', e.message);
} finally {
  child.kill('SIGTERM');
  console.log(`\n${passed} passaram, ${failed} falharam`);
  process.exit(failed ? 1 : 0);
}
