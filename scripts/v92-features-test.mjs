// V9.2 — teste de integração: QR Code de dispositivos, Excluir Item, Caixa obrigatório para mesas.
// Uso: node scripts/v92-features-test.mjs
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PORT = 4900 + Math.floor(Math.random() * 500);
const B = `http://127.0.0.1:${PORT}`;
const PASS = 'admin'; // senha fixa do admin no código atual (ver relatório de riscos)
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'pdv-v92-'));
const out = fs.openSync('/tmp/v92-server.log', 'w');
const child = spawn('npx', ['tsx', 'server.ts'], {
  env: { ...process.env, NODE_ENV: 'production', PORT: String(PORT), ADMIN_PASSWORD: PASS, DATA_DIR: DATA, GEMINI_API_KEY: '' },
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
  for (let i = 0; i < 80; i++) { try { if ((await fetch(B + '/api/health')).ok) return; } catch {} await new Promise(r => setTimeout(r, 500)); }
  throw new Error('servidor não subiu: ' + fs.readFileSync('/tmp/v92-server.log', 'utf8').slice(-1500));
}
try {
  await waitUp();
  const login = await j('/api/auth/login', 'POST', { username: 'admin', password: PASS });
  const tok = login.body?.token || login.body?.user?.token;
  t('login admin', !!tok, JSON.stringify(login.body).slice(0, 200));

  // ---------- QR CODE ----------
  const bad = await j('/api/devices/pair', 'POST', { pairingCode: 'NX-000000', deviceName: 'x' });
  t('pair com código inventado é recusado', bad.status === 400, JSON.stringify(bad));
  const noAuth = await j('/api/devices/qr/create', 'POST', {});
  t('qr/create sem login => 401', noAuth.status === 401);
  const c = await j('/api/devices/qr/create', 'POST', { restaurantSlug: 'all' }, tok);
  t('admin gera QR (token + expiração)', c.body?.success && c.body.token?.length >= 40 && c.body.expiresAt, JSON.stringify(c.body));
  const claim = await j('/api/devices/qr/claim', 'POST', { token: c.body.token, deviceName: 'Celular Cozinha', deviceType: 'celular', platform: 'android' }, tok);
  t('celular consome token e abre solicitação', claim.body?.success && claim.body.claimId, JSON.stringify(claim.body));
  const reuse = await j('/api/devices/qr/claim', 'POST', { token: c.body.token, deviceName: 'Outro' }, tok);
  t('token é de USO ÚNICO (reuso recusado)', reuse.status === 400, JSON.stringify(reuse));
  const fake = await j('/api/devices/qr/claim', 'POST', { token: 'a'.repeat(48), deviceName: 'Fake' }, tok);
  t('token inventado é recusado', fake.status === 400);
  const st1 = await j(`/api/devices/qr/claim/${claim.body.claimId}`, 'GET', null, tok);
  t('status = pending antes da aprovação', st1.body?.status === 'pending');
  const pend = await j('/api/devices/qr/pending', 'GET', null, tok);
  t('admin vê solicitação pendente', pend.body?.claims?.length === 1);
  const dec = await j(`/api/devices/qr/claim/${claim.body.claimId}/decision`, 'POST', { approve: true }, tok);
  t('admin autoriza → dispositivo criado', dec.body?.success && dec.body.device?.connectedVia === 'qr', JSON.stringify(dec.body));
  const devId = dec.body?.device?.id;
  const st2 = await j(`/api/devices/qr/claim/${claim.body.claimId}`, 'GET', null, tok);
  t('status = approved com deviceId', st2.body?.status === 'approved' && st2.body.deviceId === devId);
  const ping1 = await j('/api/devices/ping', 'POST', { idOrCode: devId });
  t('ping do dispositivo aprovado => 200', ping1.status === 200);
  const ren = await j(`/api/devices/${devId}`, 'PATCH', { deviceName: 'Tablet Bar', revoked: false, pairingCode: 'HACK' }, tok);
  t('renomear funciona', ren.body?.device?.deviceName === 'Tablet Bar');
  t('PATCH ignora campos sensíveis (pairingCode)', ren.body?.device?.pairingCode !== 'HACK');
  const rev = await j(`/api/devices/${devId}/revoke`, 'POST', {}, tok);
  t('revogar', rev.body?.device?.revoked === true);
  const ping2 = await j('/api/devices/ping', 'POST', { idOrCode: devId });
  t('ping de dispositivo revogado => 403', ping2.status === 403, String(ping2.status));
  const back = await j(`/api/devices/${devId}/revoke`, 'POST', { reconnect: true }, tok);
  t('reconectar', back.body?.device?.revoked === false);
  const ping3 = await j('/api/devices/ping', 'POST', { idOrCode: devId });
  t('ping após reconectar => 200', ping3.status === 200);
  // recusa
  const c2 = await j('/api/devices/qr/create', 'POST', {}, tok);
  const cl2 = await j('/api/devices/qr/claim', 'POST', { token: c2.body.token, deviceName: 'Intruso' }, tok);
  await j(`/api/devices/qr/claim/${cl2.body.claimId}/decision`, 'POST', { approve: false }, tok);
  const st3 = await j(`/api/devices/qr/claim/${cl2.body.claimId}`, 'GET', null, tok);
  t('recusa registrada (rejected)', st3.body?.status === 'rejected');
  // código antigo emitido pelo servidor ainda funciona, uma vez
  const code = await j('/api/devices/new-pairing-code', 'GET', null, tok);
  const p1 = await j('/api/devices/pair', 'POST', { pairingCode: code.body.code, deviceName: 'Legacy' });
  t('código emitido pelo servidor pareia', p1.body?.success === true, JSON.stringify(p1.body));

  // ---------- CAIXA OBRIGATÓRIO PARA MESAS ----------
  const cash = await j('/api/state/cashShift', 'GET', null, tok);
  console.log('INFO cashShift doc status', cash.status);
  const closeNoCash = await j('/api/orders/qualquer/close-table', 'POST', { paymentMethod: 'pix', tableNumber: 1 }, tok);
  t('fechar mesa com caixa fechado => 409 CASH_CLOSED', closeNoCash.status === 409 && closeNoCash.body?.code === 'CASH_CLOSED', JSON.stringify(closeNoCash));
  const settings = await j('/api/state/systemSettings', 'GET', null, tok);
  t('documento systemSettings é aceito pelo servidor', settings.status !== 404 && settings.status !== 403, String(settings.status));

  // ---------- EXCLUIR ITEM (pedido real) ----------
  const cat = await j('/api/public/catalog');
  const slug = Object.keys(cat.body.restaurants)[0];
  const menu = (cat.body?.menuItems || []).filter((m) => m.restaurantSlug === slug && m.available !== false && !(m.optionGroups || []).some((g) => g.required));
  const two = menu.filter((m) => m.restaurantSlug === slug).slice(0, 2);
  const mk = await j('/api/orders', 'POST', {
    restaurantSlug: slug, orderType: 'mesa', tableNumber: 7, customerName: 'Teste', customerPhone: '22999998888',
    paymentMethod: 'dinheiro',
    items: [{ menuItemId: two[0].id, quantity: 3 }, { menuItemId: two[1].id, quantity: 1 }],
  }, tok);
  t('cria pedido de mesa com 2 itens', mk.body?.success && mk.body.order?.items?.length === 2, JSON.stringify(mk.body).slice(0, 300));
  const ord = mk.body?.order;
  const it0 = ord?.items?.[0];
  const noConfirm = await j(`/api/orders/${ord.id}/items/${it0.id}`, 'DELETE', { quantity: 1 }, tok);
  t('excluir sem confirmação => 400', noConfirm.status === 400);
  const del1 = await j(`/api/orders/${ord.id}/items/${it0.id}`, 'DELETE', { quantity: 1, confirmed: true, reason: 'cliente desistiu' }, tok);
  const o1 = del1.body?.order;
  t('exclui só 1 unidade (3 → 2)', del1.body?.success && o1.items.find((i) => i.id === it0.id)?.quantity === 2, JSON.stringify(del1.body).slice(0, 300));
  t('outro item intacto', o1.items.find((i) => i.id === ord.items[1].id)?.quantity === 1);
  t('total recalculado (menor que antes)', o1.total < ord.total, `${o1.total} vs ${ord.total}`);
  t('auditoria gravada no histórico', o1.statusHistory.some((h) => /ITEM EXCLU/.test(h.note || '')));
  const del2 = await j(`/api/orders/${ord.id}/items/${it0.id}`, 'DELETE', { quantity: 99, confirmed: true }, tok);
  t('quantidade total remove a linha do item', del2.body?.lineRemoved === true && del2.body.order.items.length === 1);
  const del3 = await j(`/api/orders/${ord.id}/items/${ord.items[1].id}`, 'DELETE', { quantity: 1, confirmed: true }, tok);
  t('não remove o único item restante (pedido preservado)', del3.status === 400, JSON.stringify(del3.body));

  // ---------- CAIXA ABERTO libera pagamento de mesa ----------
  const cur = await j('/api/state/cashShift', 'GET', null, tok);
  const ver = cur.body?.version ?? 0;
  const put = await j('/api/state/cashShift', 'PUT', { baseVersion: ver, value: { id: 'shift-test', openedAt: new Date().toISOString(), initialAmount: 100, movements: [], isClosed: false } }, tok);
  t('abre caixa (estado do servidor)', put.body?.success, JSON.stringify(put.body));
  const pay = await j(`/api/orders/${ord.id}/close-table`, 'POST', { paymentMethod: 'dinheiro', tableNumber: 7 }, tok);
  t('com caixa ABERTO o pagamento da mesa passa a ser aceito', pay.status !== 409, JSON.stringify(pay.body).slice(0, 200));
  const delPaid = await j(`/api/orders/${ord.id}/items/${ord.items[1].id}`, 'DELETE', { quantity: 1, confirmed: true }, tok);
  t('pedido pago/encerrado não aceita exclusão de item', delPaid.status === 400);
  // desliga a regra pelo documento e confirma que o servidor respeita
  const set0 = await j('/api/state/systemSettings', 'GET', null, tok);
  await j('/api/state/systemSettings', 'PUT', { baseVersion: set0.body?.version ?? 0, value: { kdsEnabled: false, reportKinds: ['pix'], requireCashForTables: false } }, tok);
  const cur2 = await j('/api/state/cashShift', 'GET', null, tok);
  await j('/api/state/cashShift', 'PUT', { baseVersion: cur2.body?.version ?? 0, value: { id: 'shift-test', openedAt: new Date().toISOString(), initialAmount: 100, movements: [], isClosed: true } }, tok);
  const off = await j('/api/orders/nao-existe/close-table', 'POST', { paymentMethod: 'pix', tableNumber: 1 }, tok);
  t('regra desligada: caixa fechado não bloqueia mais (chega a validar o pedido)', off.status !== 409, String(off.status));
  const persisted = await j('/api/state/systemSettings', 'GET', null, tok);
  t('KDS desativado persiste no servidor', persisted.body?.value?.kdsEnabled === false);

  // ---------- IMPRESSÃO COM MÚLTIPLOS DESTINOS + KDS DESATIVADO ----------
  const full = await j('/api/catalog', 'GET', null, tok);
  const target = full.body.menuItems.find((m) => m.restaurantSlug === slug && m.available !== false && !(m.optionGroups || []).some((g) => g.required));
  target.printStations = ['cozinha', 'bar', 'invalido'];
  const putCat = await j('/api/catalog', 'PUT', { restaurants: full.body.restaurants, categories: full.body.categories, menuItems: full.body.menuItems }, tok);
  t('catálogo salvo com printStations no produto', putCat.body?.success, JSON.stringify(putCat.body).slice(0, 200));
  const before = await j(`/api/print-agent/jobs?slug=${slug}`, 'GET', null, tok);
  const pr = await j('/api/orders', 'POST', {
    restaurantSlug: slug, orderType: 'balcao', customerName: 'Print', customerPhone: '22999998888', paymentMethod: 'pix',
    items: [{ menuItemId: target.id, quantity: 2 }],
  }, tok);
  t('pedido criado (KDS está desativado nas configurações)', pr.body?.success, JSON.stringify(pr.body).slice(0, 200));
  console.log('INFO item.printStations =', JSON.stringify(pr.body?.order?.items?.[0]?.printStations));
  t('valor inválido removido do item (só cozinha+bar)', JSON.stringify(pr.body?.order?.items?.[0]?.printStations) === JSON.stringify(['cozinha', 'bar']));
  const after = await j(`/api/print-agent/jobs?slug=${slug}`, 'GET', null, tok);
  const mine = (after.body?.jobs || []).filter((x) => x.orderId === pr.body.order.id);
  const stations = mine.map((x) => x.station).sort();
  console.log('INFO jobs do pedido:', JSON.stringify(stations), 'antes:', before.body?.count, 'depois:', after.body?.count);
  t('impressão gerada para COZINHA e BAR (2 destinos do mesmo item)', stations.includes('COZINHA') && stations.includes('BAR'), JSON.stringify(stations));
  t('setor não selecionado (SUSHI_BAR) não recebe o item', !stations.includes('SUSHI_BAR'));
} catch (e) {
  failed++; console.log('ERRO', e.message);
} finally {
  child.kill();
  console.log(`\n${passed} ok, ${failed} falhas`);
  process.exit(failed ? 1 : 0);
}
