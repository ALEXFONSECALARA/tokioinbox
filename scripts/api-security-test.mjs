// Teste de integração das correções de segurança/catálogo. Uso: node scripts/api-security-test.mjs
import { spawn } from 'node:child_process';
import fs from 'node:fs';

const PORT = 4300 + Math.floor(Math.random() * 500);
const B = `http://127.0.0.1:${PORT}`;
const ADMIN_PASS = 'Test-Pass-12345';
const out = fs.openSync('/tmp/test-server.log', 'w');
const child = spawn('npx', ['tsx', 'server.ts'], {
  env: { ...process.env, NODE_ENV: 'production', PORT: String(PORT), ADMIN_PASSWORD: ADMIN_PASS, CORS_ORIGINS: 'https://meu-site.example', GEMINI_API_KEY: '' },
  stdio: ['ignore', out, out],
});
let failed = 0, passed = 0;
const t = (name, ok, extra = '') => { (ok ? passed++ : failed++); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  -> ' + extra}`); };
const j = async (path, opts = {}) => {
  const r = await fetch(B + path, opts);
  let body = null; try { body = await r.json(); } catch {}
  return { status: r.status, body, headers: r.headers };
};
const post = (path, data, headers = {}) => j(path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(data) });

async function waitUp() {
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch(B + '/api/health'); if (r.ok) return; } catch {}
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error('servidor não subiu:\n' + fs.readFileSync('/tmp/test-server.log', 'utf8').slice(-1500));
}

try {
  await waitUp();

  // --- exposição pública ---
  t('GET /api/orders sem login => 401', (await j('/api/orders')).status === 401);
  t('stream sem ticket => 401', (await j('/api/orders/stream')).status === 401);
  t('PATCH status sem login => 401', (await j('/api/orders/x/status', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: '{"status":"em_preparo"}' })).status === 401);
  t('print-agent sem login => 401', (await j('/api/print-agent/jobs')).status === 401);
  t('PUT ai-engine/config sem login => 401', (await j('/api/ai-engine/config', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status === 401);
  t('upload sem login => 401', (await post('/api/upload/image', { image: 'x' })).status === 401);
  t('audit-logs POST sem login => 401', (await post('/api/audit-logs', { action: 'x' })).status === 401);
  t('system-audit sem login => 401', (await j('/api/admin/system-audit')).status === 401);
  t('config/status sem login => 401', (await j('/api/config/status')).status === 401);
  t('PUT catalog sem login => 401', (await j('/api/catalog', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status === 401);

  // --- CORS ---
  const evil = await fetch(B + '/api/health', { headers: { Origin: 'https://evil.example' } });
  t('CORS não reflete origem estranha', !evil.headers.get('access-control-allow-origin'));
  const good = await fetch(B + '/api/health', { headers: { Origin: 'https://meu-site.example' } });
  t('CORS libera origem configurada', good.headers.get('access-control-allow-origin') === 'https://meu-site.example');
  t('sem Allow-Credentials', !evil.headers.get('access-control-allow-credentials'));

  // --- senhas padrão ---
  for (const [u, p] of [['admin', 'admin123'], ['cozinha', 'cozinha123'], ['caixa', 'caixa123'], ['gerente', 'gerente123']]) {
    const r = await post('/api/auth/login', { username: u, password: p });
    t(`login padrão ${u}/${p} recusado`, r.status === 401, JSON.stringify(r.body));
  }
  const login = await post('/api/auth/login', { username: 'admin', password: ADMIN_PASS });
  t('login admin com ADMIN_PASSWORD', login.status === 200 && login.body?.token, JSON.stringify(login.body));
  const token = login.body?.token;
  const auth = { Authorization: `Bearer ${token}` };
  t('token não é Math.random legado', /^nx-staff-[0-9a-f]{64}$/.test(token || ''));
  t('/api/auth/me valida sessão', (await j('/api/auth/me', { headers: auth })).status === 200);

  // --- brute force ---
  let last;
  for (let i = 0; i < 8; i++) last = await post('/api/auth/login', { username: 'admin', password: 'errada' + i });
  t('bloqueio após tentativas erradas (429)', last.status === 429, String(last.status));

  // --- catálogo público sem dados internos ---
  const cat = await j('/api/public/catalog');
  t('catálogo público disponível', cat.status === 200 && Object.keys(cat.body.restaurants).length > 0);
  const items = cat.body.menuItems;
  t('catálogo público sem cmvCost/ficha técnica/fiscal', items.every(i => !('cmvCost' in i) && !('technicalSheet' in i) && !('ncm' in i)));
  const slug = Object.keys(cat.body.restaurants)[0];
  const item = items.find(i => i.restaurantSlug === slug && i.available !== false && !(i.optionGroups || []).some(g => g.required));
  const unit = typeof item.promoPrice === 'number' ? item.promoPrice : item.price;

  // --- preço no servidor ---
  const base = { restaurantSlug: slug, customerName: 'Teste', customerPhone: '22999998888', orderType: 'retirada', paymentMethod: 'pix' };
  const tamper = await post('/api/orders', { ...base, items: [{ menuItemId: item.id, name: 'x', quantity: 2, unitPrice: 0.01 }] });
  t('preço adulterado é ignorado (usa catálogo)', tamper.status === 201 && Math.abs(tamper.body.order.subtotal - unit * 2) < 0.01, JSON.stringify(tamper.body).slice(0, 200));
  const fake = await post('/api/orders', { ...base, items: [{ id: 'nao-existe', name: 'Item falso', quantity: 1, unitPrice: 1 }] });
  t('item inexistente recusado para público', fake.status === 400, JSON.stringify(fake.body));
  const badSlug = await post('/api/orders', { ...base, restaurantSlug: 'novo-restaurante', items: [{ menuItemId: item.id, quantity: 1 }] });
  t('restaurante inexistente recusado (não cai em outro)', badSlug.status === 400, JSON.stringify(badSlug.body));
  const trk = tamper.body?.order;
  t('resposta traz trackingToken ao cliente', typeof trk?.trackingToken === 'string' && trk.trackingToken.length > 10);

  // --- rastreio público por token ---
  const ok = await j(`/api/public/orders/${trk.id}?t=${trk.trackingToken}`);
  t('rastreio com token correto', ok.status === 200 && ok.body.order.id === trk.id);
  t('rastreio sem token => 404', (await j(`/api/public/orders/${trk.id}`)).status === 404);
  t('rastreio com token errado => 404', (await j(`/api/public/orders/${trk.id}?t=trk-000000000000000000000000`)).status === 404);
  t('rastreio não expõe trackingToken/idempotencyKey', ok.body.order.idempotencyKey === undefined);

  // --- área staff ---
  const list = await j('/api/orders', { headers: auth });
  t('lista de pedidos com login', list.status === 200 && Array.isArray(list.body.orders));
  t('lista de staff sem trackingToken', list.body.orders.every(o => !('trackingToken' in o)));
  const st = await j(`/api/orders/${trk.id}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', ...auth }, body: JSON.stringify({ status: 'aceito' }) });
  t('staff altera status', st.status === 200, JSON.stringify(st.body).slice(0, 160));
  const tk = await post('/api/orders/stream-ticket', {}, auth);
  t('ticket SSE emitido a staff', tk.status === 200 && tk.body.ticket);
  const sse = await fetch(`${B}/api/orders/stream?ticket=${tk.body.ticket}`);
  t('SSE abre com ticket', sse.status === 200); sse.body?.cancel();
  const sse2 = await fetch(`${B}/api/orders/stream?ticket=${tk.body.ticket}`);
  t('ticket SSE é de uso único', sse2.status === 401);

  // --- catálogo: staff grava, cliente lê ---
  const full = await j('/api/catalog', { headers: auth });
  t('catálogo completo (staff) tem custos', full.status === 200 && full.body.menuItems.length > 0);
  const edited = JSON.parse(JSON.stringify(full.body));
  const target = edited.menuItems.find(i => i.id === item.id); target.price = 99.9; delete target.promoPrice;
  const put = await j('/api/catalog', { method: 'PUT', headers: { 'Content-Type': 'application/json', ...auth }, body: JSON.stringify(edited) });
  t('staff salva catálogo', put.status === 200 && put.body.success, JSON.stringify(put.body));
  const cat2 = await j('/api/public/catalog');
  t('cliente enxerga alteração do cardápio', cat2.body.menuItems.find(i => i.id === item.id)?.price === 99.9);
  const o2 = await post('/api/orders', { ...base, items: [{ menuItemId: item.id, quantity: 1 }] });
  t('novo preço já vale nos pedidos', o2.body?.order?.subtotal === 99.9, JSON.stringify(o2.body).slice(0, 160));
  const badPut = await j('/api/catalog', { method: 'PUT', headers: { 'Content-Type': 'application/json', ...auth }, body: JSON.stringify({ restaurants: {}, categories: [], menuItems: [] }) });
  t('catálogo inválido recusado', badPut.status === 400);

  // --- reset de senha do cliente ---
  await post('/api/customer/register', { name: 'Vitima', phone: '22988887777', password: 'senha123', confirmPassword: 'senha123' });
  const fp = await post('/api/customer/forgot-password', { phone: '22988887777' });
  t('forgot-password não devolve código em produção', !('debugCode' in (fp.body || {})) || !fp.body.debugCode, JSON.stringify(fp.body));
  const fp2 = await post('/api/customer/forgot-password', { phone: '22911112222' });
  t('forgot-password igual p/ conta inexistente (sem enumeração)', fp2.status === fp.status, `${fp.status} vs ${fp2.status}`);

  // --- estado compartilhado (caixa, mesas, CRM, entregadores, configurações) ---
  t('GET /api/state sem login => 401', (await j('/api/state')).status === 401);
  t('GET /api/state/cashShift sem login => 401', (await j('/api/state/cashShift')).status === 401);
  const g0 = await j('/api/state/cashShift', { headers: auth });
  t('documento novo começa na versão 0', g0.status === 200 && g0.body.version === 0 && g0.body.exists === false, JSON.stringify(g0.body));
  const shift = { id: 'shift-1', openedAt: 'agora', initialAmount: 150, isClosed: false, movements: [{ id: 'm1', type: 'suprimento', amount: 150, description: 'troco', timestamp: '10:00', operator: 'admin' }] };
  const putDoc = (key, value, baseVersion, hdr = auth) => j(`/api/state/${key}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', ...hdr }, body: JSON.stringify({ value, baseVersion }) });
  const p1 = await putDoc('cashShift', shift, 0);
  t('grava caixa (versão 1)', p1.status === 200 && p1.body.version === 1, JSON.stringify(p1.body));
  const p2 = await putDoc('cashShift', { ...shift, movements: [] }, 0);
  t('gravação com versão desatualizada => 409 com o valor atual', p2.status === 409 && p2.body.version === 1 && p2.body.value?.movements?.length === 1, JSON.stringify(p2.body).slice(0, 200));
  const p3 = await putDoc('cashShift', { ...shift, movements: [...shift.movements, { id: 'm2', type: 'sangria', amount: 20, description: 's', timestamp: '10:05', operator: 'admin' }] }, 1);
  t('regravação com a versão correta (versão 2)', p3.status === 200 && p3.body.version === 2);
  t('documento desconhecido => 404', (await putDoc('naoexiste', {}, 0)).status === 404);
  t('baseVersion obrigatório', (await j('/api/state/cashShift', { method: 'PUT', headers: { 'Content-Type': 'application/json', ...auth }, body: JSON.stringify({ value: {} }) })).status === 400);
  const cook = await post('/api/users', { name: 'Cozinha API', username: 'cozinha_api', password: 'Cozinha-Forte-88', role: 'cozinha', restaurantSlug: 'all', isActive: true }, auth);
  const cookLogin = await post('/api/auth/login', { username: 'cozinha_api', password: 'Cozinha-Forte-88' });
  const cookAuth = { Authorization: `Bearer ${cookLogin.body?.token}` };
  t('cozinha NÃO lê o caixa (403)', (await j('/api/state/cashShift', { headers: cookAuth })).status === 403);
  t('cozinha NÃO grava o caixa (403)', (await putDoc('cashShift', shift, 2, cookAuth)).status === 403);
  t('cozinha lê configurações de impressão', (await j('/api/state/printerSettings', { headers: cookAuth })).status === 200);
  t('cozinha NÃO altera configurações (403)', (await putDoc('printerSettings', { x: 1 }, 0, cookAuth)).status === 403);
  const vers = await j('/api/state', { headers: cookAuth });
  t('lista de versões respeita o perfil', vers.status === 200 && !('cashShift' in vers.body.versions) && 'printerSettings' in vers.body.versions, JSON.stringify(vers.body));
  // tempo real: gravar dispara evento "state_updated" no stream
  const tk2 = await post('/api/orders/stream-ticket', {}, auth);
  const ctl = new AbortController();
  const stream = await fetch(`${B}/api/orders/stream?ticket=${tk2.body.ticket}`, { signal: ctl.signal });
  const reader = stream.body.getReader();
  await reader.read(); // evento "connected"
  await putDoc('deliveryStaff', [{ id: 'd1', name: 'Entregador Real', phone: '', vehicle: 'moto', status: 'disponivel', activeOrders: [], totalDeliveries: 0, commissionRate: 5, rating: 5 }], 0);
  let gotState = false;
  const deadline = Date.now() + 4000;
  while (Date.now() < deadline && !gotState) {
    const { value } = await Promise.race([reader.read(), new Promise(r => setTimeout(() => r({ value: null }), 1000))]);
    if (value && Buffer.from(value).toString().includes('state_updated')) gotState = true;
  }
  ctl.abort();
  t('gravação de estado é avisada em tempo real (SSE)', gotState);

  // --- diagnóstico real ---
  const audit = await j('/api/admin/system-audit', { headers: auth });
  t('auditoria real retorna checks', audit.status === 200 && audit.body.checks.length > 5);
  t('auditoria não acusa senha padrão', audit.body.checks.find(c => c.id === 'default-passwords')?.status === 'ok');

  // --- fiscal ---
  t('public-order fiscal sem token => sem doc', (await j(`/api/fiscal/public-order/${trk.id}`)).body?.hasFiscalDoc === false);
  t('rota /api inexistente => JSON 404', (await j('/api/nao-existe')).status === 404);

  // --- separação cardápio do cliente x painel da equipe (requer `npm run build`) ---
  if (fs.existsSync('dist/index.html') && fs.existsSync('dist/painel.html')) {
    const page = async (p) => { const r = await fetch(B + p); return { status: r.status, text: await r.text(), robots: r.headers.get('x-robots-tag') }; };
    const isPainel = (h) => h.includes('src="/assets/painel-') || h.includes('/assets/painel-');
    for (const p of ['/', '/SakuraSushiHouse', '/BarDoZe', '/mesa/3', '/SakuraSushiHouse/mesa/3', '/login', '/pedido/abc']) {
      const r = await page(p);
      t(`cliente: ${p} => cardápio (não painel)`, r.status === 200 && !isPainel(r.text), r.text.slice(0, 120));
    }
    for (const p of ['/PAINELRESTAURANTE', '/painelrestaurante', '/admin', '/cozinha', '/bar', '/sushibar', '/pdv', '/caixa', '/entregador', '/mesas']) {
      const r = await page(p);
      t(`equipe: ${p} => painel (login)`, r.status === 200 && isPainel(r.text) && r.robots?.includes('noindex'), r.text.slice(0, 120));
    }
    const home = await page('/');
    t('HTML do cliente não cita rotas do painel', !/PAINELRESTAURANTE|painel\.html/i.test(home.text));
  } else {
    console.log('SKIP  testes de separação (rode npm run build antes)');
  }

  const h = await j('/api/health');
  t('health sem latência falsa', h.body && !('latency' in h.body) && h.body.status === 'ok');
} catch (e) {
  failed++; console.log('ERRO:', e.message);
} finally {
  child.kill('SIGTERM');
  console.log(`\n${passed} passaram, ${failed} falharam`);
  setTimeout(() => process.exit(failed ? 1 : 0), 300);
}
