// Teste: envio automático aos setores, impressão por setor, anti-duplicidade, Kanban/10% (configurações).
// Uso: node scripts/stations-print-test.mjs
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PORT = 5800 + Math.floor(Math.random() * 300);
const B = `http://127.0.0.1:${PORT}`;
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'pdv-stations-'));
const LOG = '/tmp/stations-server.log';
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
const jobsOf = async (slug, orderId, tok) => ((await j(`/api/print-agent/jobs?slug=${slug}`, 'GET', null, tok)).body?.jobs || []).filter((x) => x.orderId === orderId);
const setSettings = async (value, tok) => {
  const cur = await j('/api/state/systemSettings', 'GET', null, tok);
  const r = await j('/api/state/systemSettings', 'PUT', { baseVersion: cur.body?.version ?? 0, value }, tok);
  return r.body?.success;
};

try {
  await waitUp();
  const tok = (await j('/api/auth/login', 'POST', { username: 'admin', password: 'admin' })).body?.token;
  t('login admin', !!tok);
  const full = await j('/api/catalog', 'GET', null, tok);
  const slug = 'japones';
  const pick = (st) => full.body.menuItems.find((m) => m.restaurantSlug === slug && m.available !== false && m.station === st && !(m.optionGroups || []).some((g) => g.required));
  // itens por setor (por nome, para não depender do cadastro): sushi/bebida/prato quente
  const any = (re) => full.body.menuItems.find((m) => m.restaurantSlug === slug && m.available !== false && re.test(m.name) && !(m.optionGroups || []).some((g) => g.required));
  const itSushi = pick('sushibar') || any(/temaki|sashimi|nigiri|niguiri|hot roll|combinado/i);
  const itBar = pick('bar') || any(/cerveja|refrigerante|suco|sake|saquê|coca/i);
  const itCoz = pick('cozinha') || any(/yakissoba|tempur|frango|ramen|gyoza/i);
  console.log('INFO itens:', itSushi?.name, '|', itBar?.name, '|', itCoz?.name);
  t('catálogo tem itens de cozinha, sushi bar e bar', !!(itSushi && itBar && itCoz));

  await setSettings({ requireCashForTables: false }, tok);

  // 1) Mesa nova com 3 setores -> 3 comandas automáticas
  const idem1 = 'mesa-t1-' + Date.now();
  const r1 = await j('/api/orders/table/append', 'POST', {
    tableNumber: 7, restaurantSlug: slug, idempotencyKey: idem1,
    items: [{ menuItemId: itSushi.id, name: itSushi.name, quantity: 1, unitPrice: itSushi.price }, { menuItemId: itBar.id, name: itBar.name, quantity: 1, unitPrice: itBar.price }, { menuItemId: itCoz.id, name: itCoz.name, quantity: 1, unitPrice: itCoz.price }],
  }, tok);
  t('mesa aberta com itens', r1.body?.success, JSON.stringify(r1.body).slice(0, 200));
  const orderId = r1.body.order.id;
  let jobs = await jobsOf(slug, orderId, tok);
  let st = jobs.map((x) => x.station).sort();
  console.log('INFO setores 1ª comanda:', JSON.stringify(st));
  t('envio automático: COZINHA + SUSHI_BAR + BAR recebem comanda', st.includes('COZINHA') && st.includes('SUSHI_BAR') && st.includes('BAR'), JSON.stringify(st));
  t('nenhum trabalho em ERRO nos setores com impressora', jobs.filter((x) => x.station !== 'BAR').every((x) => x.status !== 'ERRO'), JSON.stringify(jobs.map((x) => [x.station, x.status])));

  // 2) Adicionar itens (mesa já aberta): item vai pro setor CERTO (antes tudo ia p/ cozinha)
  const before = (await jobsOf(slug, orderId, tok)).length;
  const idem2 = 'mesa-t2-' + Date.now();
  const add = { tableNumber: 7, restaurantSlug: slug, idempotencyKey: idem2, items: [{ menuItemId: itBar.id, name: itBar.name, quantity: 2, unitPrice: itBar.price }] };
  const r2 = await j('/api/orders/table/append', 'POST', add, tok);
  t('itens adicionados à mesa', r2.body?.success && r2.body?.isNew === false);
  jobs = await jobsOf(slug, orderId, tok);
  const novos = jobs.slice(0, jobs.length - before);
  console.log('INFO novos trabalhos:', JSON.stringify(novos.map((x) => x.station)));
  t('bebida adicionada imprime SÓ no BAR (não na cozinha)', novos.length >= 1 && novos.every((x) => x.station === 'BAR'), JSON.stringify(novos.map((x) => x.station)));

  // 3) Retry com a mesma chave NÃO reimprime
  const cnt = (await jobsOf(slug, orderId, tok)).length;
  await j('/api/orders/table/append', 'POST', add, tok);
  t('retry com mesma idempotencyKey não duplica comanda', (await jobsOf(slug, orderId, tok)).length === cnt);

  // 4) Impressão desativada em um setor
  await setSettings({ requireCashForTables: false, stationPrint: { cozinha: true, sushibar: false, bar: true, caixa: true } }, tok);
  const r4 = await j('/api/orders/table/append', 'POST', { tableNumber: 8, restaurantSlug: slug, idempotencyKey: 'mesa-t4-' + Date.now(), items: [{ menuItemId: itSushi.id, name: itSushi.name, quantity: 1, unitPrice: itSushi.price }, { menuItemId: itCoz.id, name: itCoz.name, quantity: 1, unitPrice: itCoz.price }] }, tok);
  const st4 = (await jobsOf(slug, r4.body.order.id, tok)).map((x) => x.station);
  t('setor com impressão desativada (SUSHI_BAR) não imprime; cozinha imprime', !st4.includes('SUSHI_BAR') && st4.includes('COZINHA'), JSON.stringify(st4));

  // 5) Envio automático desligado
  await setSettings({ requireCashForTables: false, autoSendToStations: false }, tok);
  const r5 = await j('/api/orders/table/append', 'POST', { tableNumber: 9, restaurantSlug: slug, idempotencyKey: 'mesa-t5-' + Date.now(), items: [{ menuItemId: itCoz.id, name: itCoz.name, quantity: 1, unitPrice: itCoz.price }] }, tok);
  t('envio automático desativado: nenhuma comanda é gerada', (await jobsOf(slug, r5.body.order.id, tok)).length === 0);
  await setSettings({ requireCashForTables: false }, tok);

  // 6) Fechamento com 10% (padrão) e com 10% desativado
  const sub = r1.body.order.subtotal;
  const o1 = (await j(`/api/orders/${orderId}`, 'GET', null, tok)).body.order;
  const subNow = o1.subtotal;
  const c1 = await j(`/api/orders/${orderId}/close-table`, 'POST', { tableNumber: 7, paymentMethod: 'pix' }, tok);
  t('fechamento sem informar taxa: 10% incluído por padrão no servidor', c1.body?.success && Math.abs((c1.body.order.serviceFee || 0) - Number((subNow * 0.1).toFixed(2))) < 0.01 && Math.abs(c1.body.order.total - Number((subNow * 1.1).toFixed(2))) < 0.02, JSON.stringify([c1.body?.order?.serviceFee, c1.body?.order?.total, subNow]));
  const o8 = r4.body.order;
  const c2 = await j(`/api/orders/${o8.id}/close-table`, 'POST', { tableNumber: 8, paymentMethod: 'pix', serviceFee: 0, total: o8.subtotal }, tok);
  t('10% desativado (serviceFee 0) é respeitado', c2.body?.success && (c2.body.order.serviceFee || 0) === 0 && Math.abs(c2.body.order.total - o8.subtotal) < 0.01, JSON.stringify([c2.body?.order?.serviceFee, c2.body?.order?.total]));

  // 7) Configurações novas persistem
  await setSettings({ kanbanEnabled: false, requireCashForTables: false }, tok);
  const cur = await j('/api/state/systemSettings', 'GET', null, tok);
  t('Kanban desativado persiste no servidor', cur.body?.value?.kanbanEnabled === false);
} catch (e) {
  failed++; console.log('ERRO', e.message);
} finally {
  child.kill();
  console.log(`\n${passed} ok, ${failed} falhas`);
  process.exit(failed ? 1 : 0);
}
