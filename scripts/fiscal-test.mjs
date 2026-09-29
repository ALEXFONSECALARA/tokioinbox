// V9.3 — teste de integração do módulo fiscal (certificado digital A1 em arquivo)
import { spawn, execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PORT = 4700 + Math.floor(Math.random() * 500);
const B = `http://127.0.0.1:${PORT}`;
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'pdv-fiscal-'));
const out = fs.openSync('/tmp/fiscal-server.log', 'w');
const FISCAL_KEY = 'test-fiscal-encryption-key-32chars!!';

// Gera um .pfx autoassinado válido (CN=Restaurante Teste) para o teste, sem depender de rede.
const pfxPath = path.join(DATA, 'cert.pfx');
execSync(`openssl req -x509 -newkey rsa:2048 -keyout ${DATA}/key.pem -out ${DATA}/cert.pem -days 365 -nodes -subj "/CN=Restaurante Teste LTDA/O=Teste"`, { stdio: 'ignore' });
execSync(`openssl pkcs12 -export -out ${pfxPath} -inkey ${DATA}/key.pem -in ${DATA}/cert.pem -passout pass:teste123`, { stdio: 'ignore' });
const pfxBase64 = fs.readFileSync(pfxPath).toString('base64');

const child = spawn('npx', ['tsx', 'server.ts'], {
  env: { ...process.env, NODE_ENV: 'production', PORT: String(PORT), ADMIN_PASSWORD: 'admin', DATA_DIR: DATA, GEMINI_API_KEY: '', FISCAL_ENCRYPTION_KEY: FISCAL_KEY },
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
  throw new Error('servidor não subiu: ' + fs.readFileSync('/tmp/fiscal-server.log', 'utf8').slice(-1500));
}
try {
  await waitUp();
  const login = await j('/api/auth/login', 'POST', { username: 'admin', password: 'admin' });
  const tok = login.body?.token;
  t('login admin', !!tok);

  const health = await j('/api/admin/system-audit', 'GET', null, tok);
  const fiscalCheck = health.body?.checks?.find((c) => c.id === 'fiscal');
  console.log('INFO health-check fiscal:', JSON.stringify(fiscalCheck));
  t('health-check reporta módulo fiscal PRONTO (não mais "desativada")', fiscalCheck && fiscalCheck.status === 'warn' && /pronto/i.test(fiscalCheck.detail), JSON.stringify(fiscalCheck));

  const noAuthCfg = await j('/api/fiscal/config/japones');
  t('config fiscal exige login', noAuthCfg.status === 401);

  const cfg0 = await j('/api/fiscal/config/japones', 'GET', null, tok);
  t('config inicial existe (mesmo vazia)', cfg0.body?.success === true, JSON.stringify(cfg0.body).slice(0, 200));

  const save = await j('/api/fiscal/config/japones', 'POST', {
    razaoSocial: 'Sakura Sushi House LTDA', nomeFantasia: 'Sakura Sushi House', cnpj: '12.345.678/0001-90',
    inscricaoEstadual: 'ISENTO', uf: 'SP', municipio: 'São Paulo', codigoMunicipioIbge: '3550308',
    cep: '01310-100', logradouro: 'Av. Paulista', numero: '1200', bairro: 'Bela Vista',
    regimeTributario: 'simples_nacional', aliquotaSimplesNacional: 6.8, ambiente: 'homologacao',
    serieNfce: 1, numeroAtualNfce: 1, serieNfe: 1, numeroAtualNfe: 1, cscId: '000001', cscToken: 'abc',
  }, tok);
  t('salva configuração fiscal (CNPJ, regime, ambiente)', save.body?.success === true, JSON.stringify(save.body).slice(0, 200));

  const certBefore = await j('/api/fiscal/certificate/japones', 'GET', null, tok);
  t('sem certificado ainda: status nao_configurado', certBefore.body?.metadata?.status === 'nao_configurado', JSON.stringify(certBefore.body));

  const badUpload = await j('/api/fiscal/certificate/upload', 'POST', { restaurantSlug: 'japones', pfxBase64: 'aW52YWxpZG8=', password: 'errado' }, tok);
  t('upload de certificado inválido é recusado', badUpload.status === 400, JSON.stringify(badUpload.body));

  const upload = await j('/api/fiscal/certificate/upload', 'POST', { restaurantSlug: 'japones', pfxBase64, password: 'teste123' }, tok);
  t('upload do certificado .pfx real é aceito', upload.body?.success === true, JSON.stringify(upload.body).slice(0, 300));
  t('metadados retornam o CN do certificado (não expõe a chave privada)', upload.body?.metadata?.subjectCommonName?.includes('Restaurante Teste'), JSON.stringify(upload.body?.metadata));
  t('resposta do upload não vaza a senha nem bytes do certificado', !JSON.stringify(upload.body).includes('teste123') && !JSON.stringify(upload.body).includes(pfxBase64.slice(0, 30)));

  const certAfter = await j('/api/fiscal/certificate/japones', 'GET', null, tok);
  t('status do certificado passa a "valido"', certAfter.body?.metadata?.status === 'valido', JSON.stringify(certAfter.body));

  const wrongPass = await j('/api/fiscal/certificate/upload', 'POST', { restaurantSlug: 'japones', pfxBase64, password: 'senha-errada' }, tok);
  t('senha errada no .pfx é recusada', wrongPass.status === 400);

  const health2 = await j('/api/admin/system-audit', 'GET', null, tok);
  const fiscalCheck2 = health2.body?.checks?.find((c) => c.id === 'fiscal');
  t('health-check passa a "ok" com CNPJ cadastrado', fiscalCheck2?.status === 'ok', JSON.stringify(fiscalCheck2));

  const sefaz = await j('/api/fiscal/sefaz-status?uf=SP&ambiente=homologacao', 'GET', null, tok);
  console.log('INFO sefaz-status:', JSON.stringify(sefaz.body).slice(0, 200));
  t('endpoint de status da SEFAZ responde', sefaz.status === 200);

  const docs = await j('/api/fiscal/documents?restaurantSlug=japones', 'GET', null, tok);
  t('lista de documentos fiscais responde vazia (nenhuma nota emitida)', docs.body?.success === true && Array.isArray(docs.body.documents) && docs.body.documents.length === 0, JSON.stringify(docs.body).slice(0, 200));

  // ---------- EMISSÃO REAL: bloqueia sem CSC, emite com tudo cadastrado ----------
  const items = [{ id: 'it1', name: 'Combo Sakura', quantity: 2, unitPrice: 45, totalPrice: 90, ncm: '21069090', cfop: '5102', csosn: '102', origem: 0 }];
  // zera o CSC (o passo "salva configuração fiscal" acima já tinha configurado um) para
  // provar que, sem CSC, o sistema recusa em vez de usar um token de exemplo.
  const cfgNow = (await j('/api/fiscal/config/japones', 'GET', null, tok)).body?.config || {};
  await j('/api/fiscal/config/japones', 'POST', { ...cfgNow, cscId: '', cscToken: '' }, tok);
  const emitNoCsc = await j('/api/fiscal/emit', 'POST', {
    restaurantSlug: 'japones', orderId: 'ord-fiscal-1', orderShortCode: 'A1B2',
    orderType: 'balcao', items, formaPagamento: 'pix', subtotal: 90, total: 90,
  }, tok);
  t('emissão de NFC-e sem CSC cadastrado é recusada (não fabrica CSC de exemplo)', emitNoCsc.status === 422 && /CSC/i.test(emitNoCsc.body?.error || ''), JSON.stringify(emitNoCsc.body));

  const saveCsc = await j('/api/fiscal/config/japones', 'GET', null, tok);
  const cur = saveCsc.body?.config || {};
  await j('/api/fiscal/config/japones', 'POST', { ...cur, cscId: '000001', cscToken: 'CSC-REAL-DE-TESTE-0001' }, tok);

  const emitOk = await j('/api/fiscal/emit', 'POST', {
    restaurantSlug: 'japones', orderId: 'ord-fiscal-1', orderShortCode: 'A1B2',
    orderType: 'balcao', items, formaPagamento: 'pix', subtotal: 90, total: 90,
  }, tok);
  t('com certificado + CNPJ + CSC reais, a emissão é aceita', emitOk.body?.success === true && emitOk.body.document?.accessKey?.length === 44, JSON.stringify(emitOk.body).slice(0, 300));
  t('QR Code gerado usa o CSC real (não o token de exemplo antigo)', !JSON.stringify(emitOk.body).includes('TOKIO'));

  const emitAgain = await j('/api/fiscal/emit', 'POST', {
    restaurantSlug: 'japones', orderId: 'ord-fiscal-1', orderShortCode: 'A1B2',
    orderType: 'balcao', items, formaPagamento: 'pix', subtotal: 90, total: 90,
  }, tok);
  t('reemitir o MESMO pedido é idempotente (devolve o documento já emitido)', emitAgain.body?.isExisting === true && emitAgain.body.document?.id === emitOk.body.document?.id);

  const noCertRest = await j('/api/fiscal/emit', 'POST', {
    restaurantSlug: 'italiano', orderId: 'ord-fiscal-2', orderType: 'balcao', items, formaPagamento: 'pix', subtotal: 90, total: 90,
  }, tok);
  t('outro restaurante sem certificado próprio continua bloqueado (não usa o certificado do japones)', noCertRest.status === 422 && /[Cc]ertificado|impressora fiscal/i.test(noCertRest.body?.error || ''), JSON.stringify(noCertRest.body));

  // ---------- AUTORIZAÇÃO ENTRE RESTAURANTES (bug corrigido) ----------
  // Cria um gerente vinculado SÓ ao restaurante "italiano" e confirma que ele não
  // consegue ler/alterar dados fiscais nem emitir nota em nome do "japones".
  const mkUser = await j('/api/users', 'POST', {
    name: 'Gerente Italiano', username: 'gerente.italiano.test', password: 'SenhaForte123!',
    role: 'administrador', restaurantSlug: 'italiano',
  }, tok);
  t('cria usuário restrito ao restaurante "italiano"', mkUser.body?.success === true, JSON.stringify(mkUser.body).slice(0, 200));
  const loginScoped = await j('/api/auth/login', 'POST', { username: 'gerente.italiano.test', password: 'SenhaForte123!' });
  const tokScoped = loginScoped.body?.token;
  t('login do usuário restrito funciona', !!tokScoped);

  const readOther = await j('/api/fiscal/config/japones', 'GET', null, tokScoped);
  t('BUG CORRIGIDO: gerente de "italiano" NÃO lê config fiscal de "japones"', readOther.status === 403, JSON.stringify(readOther.body));
  const readOwn = await j('/api/fiscal/config/italiano', 'GET', null, tokScoped);
  t('mas lê a config do PRÓPRIO restaurante normalmente', readOwn.status === 200);
  const writeOther = await j('/api/fiscal/config/japones', 'POST', { cnpj: '00.000.000/0001-00' }, tokScoped);
  t('BUG CORRIGIDO: não altera CNPJ de outra loja', writeOther.status === 403);
  const certOther = await j('/api/fiscal/certificate/japones', 'GET', null, tokScoped);
  t('BUG CORRIGIDO: não lê status do certificado de outra loja', certOther.status === 403);
  const uploadOther = await j('/api/fiscal/certificate/upload', 'POST', { restaurantSlug: 'japones', pfxBase64, password: 'teste123' }, tokScoped);
  t('BUG CORRIGIDO: não sobrescreve o certificado de outra loja', uploadOther.status === 403);
  const emitOther = await j('/api/fiscal/emit', 'POST', { restaurantSlug: 'japones', orderId: 'ord-invasao', orderType: 'balcao', items, formaPagamento: 'pix', subtotal: 10, total: 10 }, tokScoped);
  t('BUG CORRIGIDO: não emite nota fiscal em nome de outra loja', emitOther.status === 403, JSON.stringify(emitOther.body));

  const listOther = await j('/api/fiscal/documents?restaurantSlug=japones', 'GET', null, tokScoped);
  t('BUG CORRIGIDO: lista de documentos ignora o filtro e não vaza notas de outra loja', (listOther.body?.documents || []).every((d) => d.restaurantSlug !== 'japones'), JSON.stringify(listOther.body).slice(0, 200));
  const readDocOther = await j(`/api/fiscal/documents/${emitOk.body.document.id}`, 'GET', null, tokScoped);
  t('BUG CORRIGIDO: não abre um documento específico de outra loja pelo ID', readDocOther.status === 404);
} catch (e) {
  failed++; console.log('ERRO', e.message);
} finally {
  child.kill();
  console.log(`\n${passed} ok, ${failed} falhas`);
  process.exit(failed ? 1 : 0);
}
