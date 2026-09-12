import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { mkdir, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import * as db from './lib__db.js';
import { mediaStorageMode, saveImage, removeStoredImage } from './lib__mediaStorage.js';
import { hashPassword, verifyPassword } from './lib__passwords.js';
import { sanitizePermissions } from './lib__permissions.js';
import { getVapidPublicKey, sendPushToMany } from './lib__webPush.js';
import { isCampaignDueNow, currentWindowKey } from './lib__campaignScheduler.js';
import { buildRestaurantContext, buildOrderContext } from './lib__aiContext.js';
import { generateChatReply, generateCampaignSuggestion, generateSalesAnalysis, isAiConfigured } from './lib__aiAssistant.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INSTANCE_ID = process.env.RENDER_INSTANCE_ID || crypto.randomUUID();
const DATA_DIR = __dirname;
const DIST_DIR = path.join(__dirname, '..', 'dist');
const UPLOADS_DIR = DATA_DIR;

async function logServerError(context, err, meta = {}) {
  const message = err?.message || String(err || 'Erro desconhecido');
  try { await db.createErrorLog({ context, message, stack: err?.stack || null, restaurantSlug: meta.restaurantSlug || null, details: meta.details || {} }); }
  catch (logErr) { process.stderr.write(`[error-log-failed] ${logErr?.message || logErr}\n`); }
  process.stderr.write(`[${context}] ${message}\n`);
}

// Resposta padrão pra erro de banco (Supabase/Postgres) — usada em qualquer
// rota que hoje só devolvia um "Não foi possível..." genérico sem logar nem
// devolver código/requestId. Isso escondia problemas reais (schema cache do
// PostgREST desatualizado, tabela/coluna faltando etc.) atrás de uma
// mensagem que parecia erro de dados do usuário, quando na verdade era
// infraestrutura — foi a causa real de "Não foi possível listar backups"
// e afins não darem nenhuma pista do que checar no Supabase.
//
// PGRST205/PGRST204 (PostgREST não encontra a tabela/coluna no cache de
// schema) acontecem sobretudo quando uma migration é aplicada direto no
// SQL Editor do Supabase sem recarregar o cache da API — a correção nesse
// caso é rodar `NOTIFY pgrst, 'reload schema';` no SQL Editor (ou Settings →
// API → "Reload schema" no painel do Supabase), não mexer no código.
function sendDbError(res, err, req, fallbackMessage, context, meta = {}) {
  logServerError(context || fallbackMessage, err, { ...meta, details: { requestId: req?.requestId || null, code: err?.code || null, ...(meta.details || {}) } });
  const code = String(err?.code || '');
  const message = String(err?.message || '');
  const schemaCacheStale = ['PGRST205', 'PGRST204'].includes(code) || /schema cache/i.test(message);
  const schemaProblem = schemaCacheStale ||
    ['42P01', '42703', '42883', '23502'].includes(code) ||
    /relation .* does not exist|column .* does not exist|function .* does not exist/i.test(message);
  if (schemaCacheStale) {
    return res.status(503).json({
      error: 'O Supabase ainda não atualizou o cache de schema depois da última migration. No painel do Supabase, rode "NOTIFY pgrst, \'reload schema\';" no SQL Editor (ou Settings → API → Reload schema) e tente de novo.',
      code: code || 'SCHEMA_CACHE_STALE',
      requestId: req?.requestId || null,
    });
  }
  if (schemaProblem) {
    return res.status(503).json({
      // Cita um exemplo de nome de arquivo pra quem for procurar na pasta
      // database/ (ex: 0022_production_repair.sql,
      // 0023_restaurant_config_extras.sql) — sem certeza de qual delas
      // exatamente falta, mas já direciona pra pasta certa em vez de só
      // dizer "banco desatualizado" sem nenhuma pista de onde olhar.
      error: 'O banco ainda não está atualizado para esta operação. Confira se todas as migrations de database/ (ex: 0022_production_repair.sql, 0023_restaurant_config_extras.sql) foram executadas no Supabase.',
      code: code || 'SCHEMA_PROBLEM',
      requestId: req?.requestId || null,
    });
  }
  return res.status(500).json({
    error: fallbackMessage,
    code: code || undefined,
    requestId: req?.requestId || null,
  });
}



// Senha única do super-admin. Em produção, defina ADMIN_PASSWORD nas variáveis
// de ambiente do Render. Em desenvolvimento local, usa "admin123" por padrão.
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || (process.env.NODE_ENV === 'production' ? '' : 'admin123');
if (process.env.NODE_ENV === 'production' && !ADMIN_PASSWORD) {
  throw new Error('ADMIN_PASSWORD é obrigatório em produção.');
}

// Sessões assinadas e independentes de instância. O V21 guardava os tokens
// somente em memória; em Render com mais de uma instância, um login feito em
// uma instância podia chegar à outra e virar 401. O token abaixo contém apenas
// tipo/usuário/expiração e é validado por HMAC; nenhuma senha vai para o token.
const TOKEN_TTL_MS = 12 * 60 * 60 * 1000; // 12 horas
const SESSION_SECRET = process.env.SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || ADMIN_PASSWORD;
const revokedTokens = new Map();

function b64url(value) { return Buffer.from(value).toString('base64url'); }
function signSession(payload) {
  const body = b64url(JSON.stringify(payload));
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(body).digest('base64url');
  return `${body}.${sig}`;
}
function verifySession(token) {
  if (!token || typeof token !== 'string') return null;
  if (revokedTokens.has(token)) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expected = crypto.createHmac('sha256', SESSION_SECRET).update(body).digest('base64url');
  try {
    if (Buffer.byteLength(sig) !== Buffer.byteLength(expected) || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch { return null; }
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (payload?.v !== 1 || !payload?.type || !Number.isFinite(payload.exp) || Date.now() > payload.exp) return null;
    return payload;
  } catch { return null; }
}
function revokeSession(token, exp) {
  if (!token) return;
  revokedTokens.set(token, Number(exp) || Date.now() + 60000);
}
setInterval(() => { const now=Date.now(); for (const [t,exp] of revokedTokens) if (exp <= now) revokedTokens.delete(t); }, 60000).unref();

function issueToken(userId = null) {
  const expiresAt = Date.now() + TOKEN_TTL_MS;
  return signSession({ v: 1, type: 'admin', userId, exp: expiresAt });
}

function getTokenSession(token) {
  const payload = verifySession(token);
  if (!payload || payload.type !== 'admin') return null;
  return { expiresAt: payload.exp, userId: payload.userId ?? null };
}

// Middleware base: exige um token válido (mestre OU de usuário individual) e
// popula req.adminUser com o que a rota precisa saber pra decidir permissão/
// isolamento. Mantém 100% de compatibilidade com o login mestre existente.
async function requireAdmin(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  const session = getTokenSession(token);
  if (!session) {
    return res.status(401).json({ error: 'Não autorizado. Faça login no admin novamente.' });
  }
  if (session.userId === null) {
    // Login mestre — acesso total, exatamente como sempre funcionou.
    req.adminUser = { isMaster: true, permissions: {}, restaurantSlug: null };
    return next();
  }
  try {
    const user = await db.getAdminUserById(session.userId);
    if (!user || !user.active) {
      revokeSession(token, session.expiresAt);
      return res.status(401).json({ error: 'Usuário desativado ou não encontrado. Faça login novamente.' });
    }
    req.adminUser = {
      isMaster: false,
      id: user.id,
      restaurantSlug: user.restaurantSlug || null,
      permissions: user.permissions || {},
    };
    next();
  } catch (err) {
    logServerError('Erro ao validar sessão do usuário:', err);
    res.status(500).json({ error: 'Não foi possível validar a sessão.' });
  }
}

function hasPermission(req, key) {
  return Boolean(req.adminUser?.isMaster || req.adminUser?.permissions?.[key]);
}

// Exige uma permissão específica (item 18). Login mestre sempre passa.
function requirePermission(key) {
  return (req, res, next) => {
    if (!hasPermission(req, key)) {
      return res.status(403).json({ error: 'Você não tem permissão para esta ação.' });
    }
    next();
  };
}

// Isolamento entre restaurantes (itens 19/44): um usuário vinculado a um
// restaurante não pode mexer em outro, a menos que tenha a permissão
// admin_gerenciar_restaurantes. Login mestre e usuários sem restaurante
// fixo (super-admin) não são afetados por essa checagem.
function requireOwnRestaurant(req, res, next) {
  const { slug } = req.params;
  const user = req.adminUser;
  if (!user || user.isMaster) return next();
  if (!user.restaurantSlug) return next(); // usuário de escopo super-admin
  if (user.restaurantSlug === slug) return next();
  if (hasPermission(req, 'admin_gerenciar_restaurantes')) return next();
  return res.status(403).json({ error: 'Você não tem acesso a este restaurante.' });
}

// ---------- Kanban com senha própria (evolução v24_2) ----------
// Dois acessos NOVOS, mais restritos que o login completo do admin — pra
// quem só precisa acompanhar/atualizar pedidos (cozinha, balcão, garçom),
// sem enxergar cardápio, configurações, usuários ou financeiro:
//   - Kanban INDIVIDUAL: senha própria de UM restaurante (kanbanPasswordHash
//     salvo na config daquele restaurante). Token só vale pra aquele slug.
//   - Kanban ÚNICO (todos os restaurantes): uma senha de autorização à parte
//     (KANBAN_ALL_PASSWORD, ou a própria ADMIN_PASSWORD) que enxerga os
//     pedidos de TODOS os restaurantes agrupados numa tela só.
// Os dois reaproveitam a mesma assinatura HMAC dos outros tokens (sem
// estado em memória, funciona em qualquer instância do Render).
const KANBAN_ALL_PASSWORD = process.env.KANBAN_ALL_PASSWORD || '';

function issueKanbanToken(slug) {
  return signSession({ v: 1, type: 'kanban', slug, exp: Date.now() + TOKEN_TTL_MS });
}
function issueKanbanAllToken() {
  return signSession({ v: 1, type: 'kanban-all', exp: Date.now() + TOKEN_TTL_MS });
}

// Autoriza a rota pra um admin normal (com todas as regras de sempre) OU
// pra um token de Kanban individual daquele MESMO restaurante. Nunca dá
// acesso a nada além do que as rotas abaixo explicitamente permitem.
async function requireAdminOrKanban(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  const payload = verifySession(token);
  if (payload?.type === 'kanban' && payload.slug === req.params.slug) {
    // Bug real corrigido aqui: esse token tinha `permissions: {}` (vazio),
    // e `updateOrderStatusHandler` exige a permissão 'cancelar_pedido' pra
    // qualquer cancelamento — resultado: quem usa o Kanban (cozinha/balcão,
    // o uso principal desta tela) NUNCA conseguia cancelar um pedido, sempre
    // batia em 403. Cancelar e limpar histórico de pedidos ENTREGUES/
    // CANCELADOS são parte normal de operar o quadro de pedidos — não são
    // "cardápio, configurações, usuários ou financeiro" (o que esse token
    // continua sem acessar, porque essas rotas exigem requireAdmin puro,
    // não requireAdminOrKanban).
    req.adminUser = { isMaster: false, isKanbanOnly: true, restaurantSlug: payload.slug, permissions: { cancelar_pedido: true, gerenciar_historico: true } };
    return next();
  }
  return requireAdmin(req, res, next);
}

// Mesma ideia, mas pro Kanban ÚNICO — não tem :slug na rota (vê todos os
// restaurantes), então não reaproveita requireOwnRestaurant.
async function requireAdminOrKanbanAll(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  const payload = verifySession(token);
  if (payload?.type === 'kanban-all') {
    // Mesmo ajuste do Kanban individual acima — cancelar pedido e limpar
    // histórico fazem parte de operar o quadro, não são acesso "extra".
    req.adminUser = { isMaster: false, isKanbanOnly: true, restaurantSlug: null, permissions: { cancelar_pedido: true, gerenciar_historico: true } };
    return next();
  }
  return requireAdmin(req, res, next);
}

// ---------- Sessão do CLIENTE final (Fase 4, itens 20-22) ----------
// Também é assinada para funcionar em qualquer instância do Render. A conta
// do cliente é global à plataforma e o token não depende de memória local.
const CUSTOMER_TOKEN_TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 dias

function issueCustomerToken(customerId) {
  return signSession({ v: 1, type: 'customer', customerId, exp: Date.now() + CUSTOMER_TOKEN_TTL_MS });
}

function getCustomerSession(token) {
  const payload = verifySession(token);
  if (!payload || payload.type !== 'customer' || !payload.customerId) return null;
  return { expiresAt: payload.exp, customerId: payload.customerId };
}

function bearerToken(req) {
  const auth = req.headers.authorization || '';
  return auth.startsWith('Bearer ') ? auth.slice(7) : null;
}

// Exige cliente logado.
function requireCustomer(req, res, next) {
  const session = getCustomerSession(bearerToken(req));
  if (!session) {
    return res.status(401).json({ error: 'Faça login para continuar.' });
  }
  req.customerId = session.customerId;
  next();
}

// Nunca devolve o hash da senha.
function publicCustomer(customer) {
  const { passwordHash, ...rest } = customer;
  return rest;
}

const app = express();
app.set('trust proxy', 1);

const allowedOrigins = String(process.env.CORS_ORIGINS || '').split(',').map(x=>x.trim()).filter(Boolean);
if (process.env.NODE_ENV === 'production' && !allowedOrigins.length) { throw new Error('CORS_ORIGINS é obrigatório em produção.'); }
app.use(cors(allowedOrigins.length ? { origin: (origin, cb) => !origin || allowedOrigins.includes(origin) ? cb(null,true) : cb(new Error('Origin não permitida.')) } : undefined));
const rateBuckets = new Map();
function rateLimit({windowMs=60000,max=120,key='global'}={}) { return (req,res,next)=>{ const k=`${key}:${req.ip}`; const now=Date.now(); let b=rateBuckets.get(k); if(!b || now-b.start>windowMs){b={start:now,count:0};rateBuckets.set(k,b)} b.count++; if(b.count>max)return res.status(429).json({error:'Muitas tentativas. Aguarde alguns segundos e tente novamente.'}); next(); }; }
setInterval(()=>{const now=Date.now();for(const [k,b] of rateBuckets)if(now-b.start>300000)rateBuckets.delete(k)},60000).unref();
app.use(rateLimit({windowMs:60000,max:300,key:'api'}));

// Detecção de novo deploy (evolução v24_2, item "atualização da página após
// deploy"). O Render reinicia o processo a cada deploy, então basta um valor
// gerado uma vez quando o processo sobe — se o cliente perceber que esse
// valor mudou desde a última vez que carregou a página, é sinal de que o
// servidor (e o bundle publicado junto) mudaram. Prioriza o hash do commit
// quando o Render expõe essa variável; cai pro timestamp de boot senão.
const SERVER_BOOT_ID = process.env.RENDER_GIT_COMMIT || String(Date.now());
app.get('/api/version', (req, res) => {
  res.json({ bootId: SERVER_BOOT_ID });
});


// Realtime de pedidos por restaurante. O payload é mínimo (sem dados pessoais);
// cada consumidor autenticado busca o pedido completo somente se necessário.
const orderEventClients = new Map();
function addOrderEventClient(slug, client) {
  if (!orderEventClients.has(slug)) orderEventClients.set(slug, new Set());
  orderEventClients.get(slug).add(client);
}
function removeOrderEventClient(slug, client) {
  const set = orderEventClients.get(slug);
  if (!set) return;
  set.delete(client);
  if (!set.size) orderEventClients.delete(slug);
}
function deliverOrderEvent(slug,event){ const set=orderEventClients.get(slug); if(!set)return; const payload=`data: ${JSON.stringify(event)}\n\n`; for(const client of set){if(client.role==='customer'&&client.customerId!==event.customerId)continue;try{client.res.write(payload)}catch{removeOrderEventClient(slug,client)}} }
function broadcastOrderEvent(slug, event) {
  const payload = { ...event, originInstanceId: INSTANCE_ID };
  deliverOrderEvent(slug, payload);
  void db.appendRealtimeEvent(slug, payload).catch(err=>logServerError(`Falha ao persistir realtime ${slug}`,err,{restaurantSlug:slug,details:{requestId:event.requestId||null}}));
}
const realtimeCursors = new Map();
setInterval(async()=>{ if(db.backendName!=='supabase')return; try{const restaurants=await db.getRestaurantsAdmin(); for(const r of restaurants||[]){const after=Number(realtimeCursors.get(r.slug)||0); const events=await db.listRealtimeEvents(r.slug,after); for(const e of events){realtimeCursors.set(r.slug,Math.max(Number(realtimeCursors.get(r.slug)||0),Number(e.id))); const payload=e.payload||{}; if(payload.originInstanceId===INSTANCE_ID) continue; deliverOrderEvent(r.slug,payload);}}}catch(err){logServerError('Falha no relay realtime compartilhado',err)} },1500).unref();

function publicSlug(name, fallback) {
  // Sem hífen entre palavras — o link público é tipo /sakurasushihouse, não
  // /sakura-sushi-house (item pedido: link curto, sem separadores).
  return String(name || fallback || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '') || fallback;
}


// Compatibilidade com builds antigos que receberam VITE_API_URL já terminado
// em /api e, por isso, ainda podem chamar /api/api/... durante uma transição
// de deploy. Normaliza antes das rotas para que esses clientes não recebam 404.
app.use((req, res, next) => {
  if (req.url === '/api/api' || req.url.startsWith('/api/api/')) {
    req.url = req.url.replace(/^\/api\/api(?=\/|$)/, '/api');
  }
  next();
});
app.use(express.json({ limit: '5mb' }));
app.use((req,res,next)=>{ req.requestId=req.get('x-request-id')||crypto.randomUUID(); res.set('X-Request-ID',req.requestId); next(); });

// ---------- Upload de fotos (logo, banner, splash, pratos, entregadores) ----------
// Fica em memória (multer.memoryStorage) em vez de ir direto pro disco — o
// arquivo só é gravado em algum lugar DEPOIS de decidirmos o destino:
//   • CLOUDINARY_* configurado (produção/Render): sobe pro Cloudinary,
//     nunca toca o disco local, URL retornada é https permanente.
//   • Sem Cloudinary configurado (dev local sem conta): cai automaticamente
//     pro disco local de sempre (backend/uploads/<slug>/...), exatamente
//     como funcionava antes — mesmo padrão de fallback automático já usado
//     pro Supabase neste projeto (backend/db.js).
// Isso preserva 100% do comportamento pra quem não configurar Cloudinary,
// e resolve o disco efêmero do Render pra quem configurar.
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 }, // 8MB por foto
  fileFilter: (req, file, cb) => {
    if (!/^image\//.test(file.mimetype)) {
      return cb(new Error('Apenas arquivos de imagem são permitidos.'));
    }
    cb(null, true);
  },
});

function safeImageExt(originalname) {
  const ext = path.extname(originalname || '').toLowerCase().replace(/[^a-z0-9.]/g, '');
  return /^\.(jpg|jpeg|png|webp|gif|avif)$/.test(ext) ? ext : '.jpg';
}

// Fallback local (sem Cloudinary configurado): grava o buffer em disco e
// devolve a mesma URL relativa /uploads/... de sempre.
// O armazenamento local é somente fallback de desenvolvimento e usa arquivos
// com nome controlado. Não expomos a pasta inteira do backend via static.
app.get('/uploads/:filename', async (req, res) => {
  const filename = String(req.params.filename || '');
  if (!/^upload-[a-zA-Z0-9._-]+\.(jpg|jpeg|png|webp|gif|avif)$/.test(filename)) return res.status(404).end();
  try {
    const filePath = path.join(UPLOADS_DIR, filename);
    if (!filePath.startsWith(UPLOADS_DIR + path.sep) || !existsSync(filePath)) return res.status(404).end();
    return res.sendFile(filePath);
  } catch { return res.status(404).end(); }
});

// ---------- Rotas públicas ----------

app.post('/api/client-errors', async (req,res)=>{try{const message=String(req.body?.message||'Erro de cliente').slice(0,1000);await db.createErrorLog({level:'client',context:'frontend',message,details:req.body?.details||{}});res.status(204).end()}catch{res.status(204).end()}});
app.get('/api/pwa/manifest', async (req,res)=>{ try{const slug=String(req.query.slug||'').trim();if(!slug||!(await db.restaurantExists(slug)))return res.status(404).json({error:'Restaurante não encontrado.'});const data=await db.readRestaurantData(slug);const cfg=data.restaurantConfig||{};res.set('Cache-Control','no-store');res.json({name:cfg.name||slug,short_name:cfg.name||slug,start_url:`/${publicSlug(cfg.name,slug)}`,scope:`/${publicSlug(cfg.name,slug)}/`,display:'standalone',background_color:'#070908',theme_color:cfg.color||'#c9a227',description:cfg.tagline||'Delivery',icons:[{src:cfg.logo||'/tokioinbox-mark.svg',sizes:'512x512',type:cfg.logo?'image/png':'image/svg+xml',purpose:'any maskable'}]});}catch(err){logServerError('Erro ao gerar manifesto PWA',err);res.status(500).json({error:'Não foi possível gerar o aplicativo.'})} });

app.get('/api/version', (req, res) => {
  res.json({ ok: true, version: '24.2.0', release: 'V24.2', features: ['atomic-order-persistence','production-schema-repair','shared-realtime-per-restaurant','stateless-sessions','payment-conflict-control','request-correlation','error-observability','print-bridge-claim'] });
});

app.get('/api/health', async (req, res) => {
  const startedAt = Date.now();
  try {
    const restaurants = await db.getRestaurants();
    res.json({ ok: true, status: 'healthy', dataBackend: db.backendName, restaurants: restaurants.length, uptimeSeconds: Math.floor(process.uptime()), latencyMs: Date.now() - startedAt, realtimeClients: [...orderEventClients.values()].reduce((n, set) => n + set.size, 0), storageMode: mediaStorageMode(), pushConfigured: Boolean(getVapidPublicKey()), aiConfigured: isAiConfigured(), timestamp: new Date().toISOString() });
  } catch (err) {
    logServerError('Health check falhou', err);
    res.status(503).json({ ok: false, status: 'unhealthy', dataBackend: db.backendName, error: 'Backend indisponível.', latencyMs: Date.now() - startedAt, timestamp: new Date().toISOString() });
  }
});

app.get('/api/health/ready', async (req, res) => {
  try {
    const restaurants = await db.getRestaurants();
    res.json({ ok: true, ready: true, dataBackend: db.backendName, restaurants: restaurants.length, timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(503).json({ ok: false, ready: false, dataBackend: db.backendName, timestamp: new Date().toISOString() });
  }
});

app.get('/api/:slug/health', requireAdmin, requireOwnRestaurant, async (req, res) => {
  const { slug } = req.params;
  const startedAt = Date.now();
  try {
    if (!(await db.restaurantExists(slug))) return res.status(404).json({ error: 'Restaurante não encontrado.' });
    const [data, orders] = await Promise.all([db.readRestaurantData(slug), db.listOrders(slug)]);
    const config = data?.restaurantConfig || {};
    const menuItems = Array.isArray(data?.menuItems) ? data.menuItems : [];
    const categories = Array.isArray(data?.categories) ? data.categories : [];
    const activeOrders = orders.filter(o => !['entregue','cancelado'].includes(o.status)).length;
    const missingImages = menuItems.filter(i => !i.image).length;
    const issues = [];
    if (!config.name) issues.push({ key:'identity', severity:'error', message:'Nome do restaurante não configurado.' });
    if (!config.whatsapp) issues.push({ key:'whatsapp', severity:'warning', message:'WhatsApp do restaurante não configurado.' });
    if (!menuItems.length) issues.push({ key:'menu', severity:'error', message:'Cardápio sem produtos.' });
    if (!categories.length) issues.push({ key:'categories', severity:'warning', message:'Nenhuma categoria cadastrada.' });
    if (missingImages > 0) issues.push({ key:'images', severity:'info', message:`${missingImages} produto(s) sem foto.` });
    if (!['normal','lotado','pausado'].includes(config.operationalStatus || 'normal')) issues.push({ key:'operational', severity:'warning', message:'Status operacional desconhecido.' });
    res.json({ ok:true, status: issues.some(i=>i.severity==='error') ? 'attention' : 'healthy', restaurant:{ slug, name:config.name || slug, active:await db.restaurantIsActive(slug), operationalStatus:config.operationalStatus || 'normal' }, metrics:{ products:menuItems.length, categories:categories.length, totalOrders:orders.length, activeOrders, productsWithoutImages:missingImages, realtimeClients:orderEventClients.get(slug)?.size || 0 }, capabilities:{ dataBackend:db.backendName, storageMode:mediaStorageMode(), pushConfigured:Boolean(getVapidPublicKey()), aiConfigured:isAiConfigured() }, issues, latencyMs:Date.now()-startedAt, timestamp:new Date().toISOString() });
  } catch (err) {
    logServerError(`Health check do restaurante ${slug} falhou`, err, { restaurantSlug: slug });
    res.status(503).json({ ok:false, status:'unhealthy', error:'Não foi possível diagnosticar o restaurante.', latencyMs:Date.now()-startedAt, timestamp:new Date().toISOString() });
  }
});

// Lista os restaurantes disponíveis (pra tela inicial de escolha) — só os
// ATIVOS. Restaurante desativado não aparece aqui (mas continua no banco e
// visível em /api/admin/restaurants, pro super-admin poder reativar).
app.get('/api/restaurants', async (req, res) => {
  try {
    res.json(await db.getRestaurants());
  } catch (err) {
    logServerError('Erro ao listar restaurantes:', err);
    res.status(500).json({ error: 'Não foi possível carregar a lista de restaurantes.' });
  }
});

// Configuração da vitrine principal "/" (título, subtítulo, layout escolhido
// pelo super-admin) — global, não pertence a nenhum restaurante específico.
app.get('/api/platform', async (req, res) => {
  try {
    res.json(await db.getPlatformSettings());
  } catch (err) {
    logServerError('Erro ao carregar configuração da vitrine:', err);
    res.status(500).json({ error: 'Não foi possível carregar a configuração da vitrine.' });
  }
});

// Cardápio + configuração de UM restaurante específico (nunca de outro)
app.get('/api/:slug/menu', async (req, res) => {
  const { slug } = req.params;
  if (!(await db.restaurantExists(slug))) {
    return res.status(404).json({ error: 'Restaurante não encontrado.' });
  }
  try {
    const data = await db.readRestaurantData(slug);
    if (!data.restaurantConfig) {
      return res.status(500).json({ error: `Configuração de "${slug}" não encontrada (config.json ausente).` });
    }
    // Rota PÚBLICA (sem requireAdmin) — os hashes de senha do Kanban
    // individual e da limpeza de histórico NUNCA podem sair daqui, ou
    // qualquer visitante da loja teria o hash pra tentar quebrar offline.
    // Só um booleano indicando se a senha está configurada.
    const { kanbanPasswordHash, historyClearPasswordHash, ...safeConfig } = data.restaurantConfig;
    res.json({
      ...data,
      restaurantConfig: {
        ...safeConfig,
        kanbanPasswordSet: Boolean(kanbanPasswordHash),
        historyClearPasswordSet: Boolean(historyClearPasswordHash),
      },
    });
  } catch (err) {
    logServerError(`Erro ao ler cardápio de ${slug}:`, err);
    res.status(500).json({ error: 'Não foi possível carregar o cardápio.' });
  }
});

// Canal de atualização simultânea. Admin usa sua sessão; cliente usa a conta global.
app.get('/api/:slug/order-events', async (req, res, next) => {
  const { slug } = req.params;
  if (!(await db.restaurantExists(slug))) return res.status(404).json({ error: 'Restaurante não encontrado.' });
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  const adminSession = getTokenSession(token);
  const customerSession = getCustomerSession(token);
  const kanbanPayload = verifySession(token);
  let role = null; let customerId = null;
  if (adminSession) {
    try {
      if (adminSession.userId !== null) {
        const user = await db.getAdminUserById(adminSession.userId);
        if (!user || !user.active) return res.status(401).json({ error: 'Sessão administrativa expirada.' });
        if (user.restaurantSlug && user.restaurantSlug !== slug && !user.permissions?.admin_gerenciar_restaurantes) return res.status(403).json({ error: 'Sem acesso a este restaurante.' });
      }
      role = 'admin';
    } catch (err) { return next(err); }
  } else if (kanbanPayload?.type === 'kanban' && kanbanPayload.slug === slug) {
    role = 'admin'; // mesmo canal de eventos do admin — só enxerga pedidos deste restaurante mesmo
  } else if (kanbanPayload?.type === 'kanban-all') {
    role = 'admin';
  } else if (customerSession) {
    role = 'customer'; customerId = customerSession.customerId;
  } else {
    return res.status(401).json({ error: 'Faça login para receber atualizações em tempo real.' });
  }
  res.status(200); res.set({ 'Content-Type':'text/event-stream; charset=utf-8', 'Cache-Control':'no-cache, no-transform', 'Connection':'keep-alive', 'X-Accel-Buffering':'no' });
  res.flushHeaders?.();
  res.write(`data: ${JSON.stringify({type:'connected'})}\n\n`);
  const client = { res, role, customerId };
  addOrderEventClient(slug, client);
  const heartbeat = setInterval(() => { try { res.write(': heartbeat\n\n'); } catch {} }, 25000);
  req.on('close', () => { clearInterval(heartbeat); removeOrderEventClient(slug, client); });
});

// Kanban único — pedidos de TODOS os restaurantes numa lista só, cada um
// marcado com restaurantSlug/restaurantName pra o frontend agrupar/filtrar.
// Só pedidos ainda em andamento (evita carregar meses de histórico de
// vários restaurantes de uma vez só).
app.get('/api/kanban-all/orders', requireAdminOrKanbanAll, async (req, res) => {
  try {
    const restaurants = (await db.getRestaurantsAdmin()) || [];
    const active = restaurants.filter((r) => r.active !== false);
    const perRestaurant = await Promise.all(
      active.map(async (r) => {
        try {
          const orders = await db.listOrders(r.slug);
          return orders
            .filter((o) => !['entregue', 'cancelado'].includes(o.status))
            .map((o) => ({ ...o, restaurantSlug: r.slug, restaurantName: r.name }));
        } catch {
          return [];
        }
      })
    );
    res.json({ orders: perRestaurant.flat(), restaurants: active.map((r) => ({ slug: r.slug, name: r.name })) });
  } catch (err) {
    logServerError('Erro ao carregar Kanban único:', err);
    res.status(500).json({ error: 'Não foi possível carregar os pedidos de todos os restaurantes.' });
  }
});

// Atualizar status de um pedido a partir do Kanban único — mesma regra de
// transição e mesma proteção contra cancelamento sem permissão (reaproveita
// a função compartilhada acima, sem truques de reroteamento).
app.patch('/api/kanban-all/:slug/orders/:id', requireAdminOrKanbanAll, async (req, res) => {
  await updateOrderStatusHandler(req.params.slug, req.params.id, req, res);
});


app.post('/api/:slug/orders', async (req, res) => {
  const { slug } = req.params;
  if (!(await db.restaurantExists(slug))) {
    return res.status(404).json({ error: 'Restaurante não encontrado.' });
  }
  // Restaurante desativado pelo super-admin não pode receber novos pedidos —
  // reforçado aqui no backend (nunca só no frontend), mesmo que alguém chame
  // a API diretamente com o slug de um restaurante inativo.
  if (!(await db.restaurantIsActive(slug))) {
    return res.status(403).json({ error: 'Este restaurante está temporariamente indisponível para novos pedidos.' });
  }
  try {
    const order = req.body;
    if (!order || !order.id || !order.customer || !Array.isArray(order.items) || order.items.length === 0) {
      return res.status(400).json({ error: 'Pedido inválido. Confira os itens e os dados do cliente.', requestId: req.requestId });
    }
    if (!['delivery', 'takeaway'].includes(order.orderType)) {
      return res.status(400).json({ error: 'Modalidade de pedido inválida.', requestId: req.requestId });
    }
    if (!Number.isFinite(Number(order.total)) || Number(order.total) < 0) {
      return res.status(400).json({ error: 'Total do pedido inválido.', requestId: req.requestId });
    }
    // Vincula o pedido ao cliente logado (item 20/22) — nunca confia num
    // customerId enviado pelo corpo da requisição, sempre deriva do token.
    // Pedido de visitante sem conta continua funcionando normalmente
    // (customerId fica undefined, exatamente como sempre foi).
    const session = getCustomerSession(bearerToken(req));
    order.customerId = session ? session.customerId : undefined;
    const saved = await db.createOrder(slug, order);
    broadcastOrderEvent(slug, { type: 'created', orderId: saved.id, orderNumber: saved.orderNumber, status: saved.status, updatedAt: saved.updatedAt || saved.createdAt, customerId: saved.customerId || null, requestId: req.requestId });
    // Impressão automática (item pedido: sistema deve receber o pedido e
    // imprimir ao mesmo tempo em que aparece no app/Kanban, sem precisar de
    // clique manual). Se o restaurante ligou "Imprimir novos pedidos
    // automaticamente" (config.printAutoNewOrders), já cria o print-job de
    // cozinha na hora — o Print Bridge (agente rodando na impressora
    // térmica real) fica de olho na fila e imprime em segundos, e qualquer
    // Kanban/painel aberto também recebe o evento 'print-job-created' em
    // tempo real (SSE), então impressão física e tela do app ficam em
    // sincronia com o pedido chegando. Nunca deixa a criação do pedido
    // falhar por causa da impressão — só loga se algo der errado.
    try {
      const cfg = (await db.readRestaurantData(slug))?.restaurantConfig;
      if (cfg?.printAutoNewOrders) {
        const job = await db.createPrintJob(slug, { orderId: saved.id, orderNumber: saved.orderNumber, variant: 'kitchen' });
        if (job) broadcastOrderEvent(slug, { type: 'print-job-created', orderId: saved.id, printJobId: job.id, updatedAt: job.updatedAt, requestId: req.requestId });
      }
    } catch (printErr) {
      logServerError(`Falha ao criar impressão automática ${slug}/${saved.id}:`, printErr, { restaurantSlug: slug, details: { requestId: req.requestId, orderId: saved.id } });
    }
    res.status(201).json({ ok: true, order: saved });
  } catch (err) {
    sendDbError(res, err, req, 'Não foi possível registrar o pedido. Tente novamente.', `Erro ao salvar pedido de ${slug}:`, {
      restaurantSlug: slug,
      details: { orderId: req.body?.id || null },
    });
  }
});

// ---------- Contas de cliente + endereços salvos (Fase 4, itens 20-22) ----------

app.post('/api/customers/register', rateLimit({windowMs:60000,max:6,key:'customer-register'}), async (req, res) => {
  const { name, phone, email, password } = req.body || {};
  const cleanPhone = String(phone || '').replace(/\D/g, '');
  const cleanEmail = email ? String(email).trim().toLowerCase() : null;
  if (!name || !cleanPhone || !password) {
    return res.status(400).json({ error: 'Nome, telefone e senha são obrigatórios.' });
  }
  if (String(name).trim().length < 2) return res.status(400).json({ error: 'Informe seu nome completo.' });
  if (cleanPhone.length < 10 || cleanPhone.length > 13) return res.status(400).json({ error: 'Informe um telefone válido com DDD.' });
  // Senha do cliente = PIN numérico de 4 dígitos (mais rápido de digitar no
  // celular na hora do pedido do que uma senha alfanumérica tradicional).
  if (!/^\d{4}$/.test(String(password || ''))) return res.status(400).json({ error: 'A senha deve ter exatamente 4 dígitos numéricos.' });
  if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) return res.status(400).json({ error: 'Informe um e-mail válido ou deixe o campo vazio.' });
  try {
    const passwordHash = await hashPassword(password);
    const customer = await db.createCustomer({ name: String(name).trim(), phone: cleanPhone, email: cleanEmail, passwordHash });
    res.status(201).json({ token: issueCustomerToken(customer.id), customer: publicCustomer(customer) });
  } catch (err) {
    if (err.code === 'PHONE_TAKEN') {
      return res.status(409).json({ error: 'Já existe uma conta com esse telefone.' });
    }
    sendDbError(res, err, req, 'Não foi possível criar a conta. Tente novamente em instantes.', 'Erro ao criar conta de cliente', {
      details: { phoneLength: cleanPhone.length },
    });
  }
});

app.post('/api/customers/login', rateLimit({windowMs:60000,max:10,key:'customer-login'}), async (req, res) => {
  const { phone, password } = req.body || {};
  const cleanPhone = String(phone || '').replace(/\D/g, '');
  if (!cleanPhone || !password) {
    return res.status(400).json({ error: 'Informe telefone e senha.' });
  }
  if (cleanPhone.length < 10 || cleanPhone.length > 13) {
    return res.status(400).json({ error: 'Informe um telefone válido com DDD.' });
  }
  if (!/^\d{4}$/.test(String(password))) {
    return res.status(400).json({ error: 'A senha deve ter exatamente 4 dígitos numéricos.' });
  }
  try {
    const customer = await db.getCustomerByPhone(cleanPhone);
    if (!customer) return res.status(401).json({ error: 'Telefone ou senha incorretos.' });
    const ok = await verifyPassword(password, customer.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Telefone ou senha incorretos.' });
    res.json({ token: issueCustomerToken(customer.id), customer: publicCustomer(customer) });
  } catch (err) {
    logServerError('Erro no login de cliente:', err);
    res.status(500).json({ error: 'Não foi possível fazer login.' });
  }
});

app.get('/api/customers/me', requireCustomer, async (req, res) => {
  try {
    const customer = await db.getCustomerById(req.customerId);
    if (!customer) return res.status(404).json({ error: 'Conta não encontrada.' });
    res.json(publicCustomer(customer));
  } catch (err) {
    logServerError('Erro ao buscar cliente:', err);
    res.status(500).json({ error: 'Não foi possível carregar a conta.' });
  }
});

app.patch('/api/customers/me', requireCustomer, async (req, res) => {
  const { name, email, newPassword } = req.body || {};
  const patch = {};
  if (name !== undefined) patch.name = name;
  if (email !== undefined) patch.email = email;
  if (newPassword) {
    if (!/^\d{4}$/.test(String(newPassword))) {
      return res.status(400).json({ error: 'A senha deve ter exatamente 4 dígitos numéricos.' });
    }
    patch.passwordHash = await hashPassword(newPassword);
  }
  try {
    const updated = await db.updateCustomer(req.customerId, patch);
    res.json(publicCustomer(updated));
  } catch (err) {
    logServerError('Erro ao atualizar cliente:', err);
    res.status(500).json({ error: 'Não foi possível atualizar a conta.' });
  }
});

// 🏠 Casa / 🏢 Trabalho / 📍 Outro — vários endereços por cliente (item 21)
app.get('/api/customers/me/addresses', requireCustomer, async (req, res) => {
  try {
    res.json(await db.listCustomerAddresses(req.customerId));
  } catch (err) {
    logServerError('Erro ao listar endereços:', err);
    res.status(500).json({ error: 'Não foi possível carregar os endereços.' });
  }
});

app.post('/api/customers/me/addresses', requireCustomer, async (req, res) => {
  const { label, cep, street, number, neighborhood, city, state, unit, complement, reference, lat, lng, isDefault } =
    req.body || {};
  if (!street || !number || !neighborhood) {
    return res.status(400).json({ error: 'Rua, número e bairro são obrigatórios.' });
  }
  try {
    const address = await db.createCustomerAddress(req.customerId, {
      label,
      cep,
      street,
      number,
      neighborhood,
      city,
      state,
      unit,
      complement,
      reference,
      lat,
      lng,
      isDefault,
    });
    res.status(201).json(address);
  } catch (err) {
    logServerError('Erro ao criar endereço:', err);
    res.status(500).json({ error: 'Não foi possível salvar o endereço.' });
  }
});

app.patch('/api/customers/me/addresses/:id', requireCustomer, async (req, res) => {
  try {
    const updated = await db.updateCustomerAddress(req.params.id, req.customerId, req.body || {});
    if (!updated) return res.status(404).json({ error: 'Endereço não encontrado.' });
    res.json(updated);
  } catch (err) {
    logServerError('Erro ao atualizar endereço:', err);
    res.status(500).json({ error: 'Não foi possível atualizar o endereço.' });
  }
});

app.delete('/api/customers/me/addresses/:id', requireCustomer, async (req, res) => {
  try {
    const deleted = await db.deleteCustomerAddress(req.params.id, req.customerId);
    if (!deleted) return res.status(404).json({ error: 'Endereço não encontrado.' });
    res.json({ ok: true });
  } catch (err) {
    logServerError('Erro ao excluir endereço:', err);
    res.status(500).json({ error: 'Não foi possível excluir o endereço.' });
  }
});

// Histórico entre restaurantes (item 22) — pedidos, produtos, valores,
// desconto, taxa, pagamento, restaurante, endereço, data/hora e status já
// vêm de dentro do próprio pedido salvo; aqui só juntamos e ordenamos.
app.get('/api/customers/me/orders', requireCustomer, async (req, res) => {
  try {
    res.json(await db.listCustomerOrders(req.customerId));
  } catch (err) {
    logServerError('Erro ao buscar histórico do cliente:', err);
    res.status(500).json({ error: 'Não foi possível carregar o histórico de pedidos.' });
  }
});

// Cliente pode cancelar o próprio pedido somente antes de sair para entrega.
// Nunca aceita customerId vindo do navegador: a identidade vem exclusivamente do token.
app.post('/api/customers/me/orders/:slug/:id/cancel', requireCustomer, async (req, res) => {
  const { slug, id } = req.params;
  const reason = String(req.body?.reason || 'Cancelado pelo cliente').trim().slice(0, 300);
  try {
    const current = await db.getOrder(slug, id);
    if (!current) return res.status(404).json({ error: 'Pedido não encontrado.' });
    if (current.customerId !== req.customerId) return res.status(403).json({ error: 'Este pedido não pertence à sua conta.' });
    if (!['recebido', 'em_preparo'].includes(current.status)) {
      return res.status(409).json({ error: 'Este pedido não pode mais ser cancelado pelo cliente.' });
    }
    const statusHistory = [
      ...(Array.isArray(current.statusHistory) ? current.statusHistory : []),
      { status: 'cancelado', timestamp: new Date().toISOString(), note: reason || 'Cancelado pelo cliente' },
    ];
    const updated = await db.updateOrder(slug, id, { status: 'cancelado', cancelReason: reason || 'Cancelado pelo cliente', statusHistory }, current.updatedAt);
    if (!updated) return res.status(404).json({ error: 'Pedido não encontrado.' });
    broadcastOrderEvent(slug, { type: 'updated', orderId: updated.id, status: updated.status, updatedAt: updated.updatedAt || new Date().toISOString(), customerId: updated.customerId || null });
    res.json({ ok: true, order: updated });
  } catch (err) {
    if (err?.code === 'ORDER_CONFLICT') return res.status(409).json({ error: 'O pedido mudou enquanto você cancelava. Atualize e tente novamente.', order: err.currentOrder });
    logServerError('Erro ao cancelar pedido pelo cliente:', err, { restaurantSlug: slug, details: { orderId: id, customerId: req.customerId } });
    res.status(500).json({ error: 'Não foi possível cancelar o pedido.' });
  }
});

// Exclui TODO o histórico pertencente à conta do cliente. Exige a senha atual
// para evitar exclusão acidental caso alguém tenha acesso ao aparelho.
app.delete('/api/customers/me/orders/history', requireCustomer, async (req, res) => {
  const password = String(req.body?.password || '');
  if (!/^\d{4}$/.test(password)) return res.status(400).json({ error: 'Informe sua senha de 4 dígitos para excluir o histórico.' });
  try {
    const customer = await db.getCustomerById(req.customerId);
    if (!customer || !(await verifyPassword(password, customer.passwordHash))) {
      return res.status(401).json({ error: 'Senha incorreta.' });
    }
    const result = await db.clearCustomerOrderHistory(req.customerId);
    res.json({ ok: true, ...result });
  } catch (err) {
    logServerError('Erro ao excluir histórico do cliente:', err, { details: { customerId: req.customerId } });
    res.status(500).json({ error: 'Não foi possível excluir o histórico de pedidos.' });
  }
});

// ---------- Notificações push (Fase 4, itens 27-30) — lado público ----------

// Chave pública VAPID pra o frontend poder chamar pushManager.subscribe(...).
// Vem vazia se as variáveis de ambiente não estiverem configuradas — o
// frontend trata isso mostrando "notificações indisponíveis" em vez de quebrar.
app.get('/api/push/vapid-public-key', (req, res) => {
  res.json({ publicKey: getVapidPublicKey() });
});

app.post('/api/:slug/push/subscribe', async (req, res) => {
  const { slug } = req.params;
  const { endpoint, keys } = req.body?.subscription || req.body || {};
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return res.status(400).json({ error: 'Inscrição de push inválida.' });
  }
  if (!(await db.restaurantExists(slug))) {
    return res.status(404).json({ error: 'Restaurante não encontrado.' });
  }
  try {
    // Se o visitante estiver logado (item 27, segmento "clientes
    // cadastrados"), vincula a inscrição à conta dele.
    const session = getCustomerSession(bearerToken(req));
    const saved = await db.createPushSubscription({
      restaurantSlug: slug,
      customerId: session ? session.customerId : null,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
    });
    res.status(201).json({ ok: true, id: saved.id });
  } catch (err) {
    logServerError('Erro ao salvar inscrição de push:', err);
    res.status(500).json({ error: 'Não foi possível ativar as notificações.' });
  }
});

app.post('/api/:slug/push/unsubscribe', async (req, res) => {
  const { endpoint } = req.body || {};
  if (!endpoint) return res.status(400).json({ error: 'Informe o endpoint da inscrição.' });
  try {
    await db.deletePushSubscriptionByEndpoint(endpoint);
    res.json({ ok: true });
  } catch (err) {
    logServerError('Erro ao remover inscrição de push:', err);
    res.status(500).json({ error: 'Não foi possível desativar as notificações.' });
  }
});

// ---------- Notificações push + campanhas (Fase 4, itens 27-30) — painel ----------
// Ação de restaurante (não de plataforma inteira): exige acesso àquele
// restaurante (requireOwnRestaurant), sem uma permissão granular própria —
// o catálogo de permissões do item 18 não previu uma categoria específica
// de "notificações", então por ora qualquer usuário com acesso ao
// restaurante pode enviar/agendar, igual já podia mexer no cardápio dele.

app.get('/api/admin/:slug/push/campaigns', requireAdmin, requireOwnRestaurant, async (req, res) => {
  try {
    res.json(await db.listNotificationCampaigns(req.params.slug));
  } catch (err) {
    logServerError('Erro ao listar campanhas:', err);
    res.status(500).json({ error: 'Não foi possível carregar as campanhas.' });
  }
});

app.post('/api/admin/:slug/push/campaigns', requireAdmin, requireOwnRestaurant, async (req, res) => {
  const { name, title, message, imageUrl, audience, schedule } = req.body || {};
  if (!name || !title || !message) {
    return res.status(400).json({ error: 'Nome, título e mensagem são obrigatórios.' });
  }
  try {
    const campaign = await db.createNotificationCampaign(req.params.slug, {
      name,
      title,
      message,
      imageUrl,
      audience: audience === 'customers' ? 'customers' : 'all',
      schedule: schedule || {},
    });
    res.status(201).json(campaign);
  } catch (err) {
    logServerError('Erro ao criar campanha:', err);
    res.status(500).json({ error: 'Não foi possível criar a campanha.' });
  }
});

app.patch('/api/admin/:slug/push/campaigns/:id', requireAdmin, requireOwnRestaurant, async (req, res) => {
  try {
    // Reforço de isolamento (item 19/44): o :slug da URL já foi validado
    // por requireOwnRestaurant, mas isso não garante que o :id pertence a
    // ESTE restaurante — sem esta checagem, um usuário restrito a um
    // restaurante poderia mexer na campanha de outro só adivinhando/testando
    // ids. Aqui confirmamos posse antes de qualquer alteração.
    const existing = await db.getNotificationCampaignById(req.params.id);
    if (!existing || existing.restaurantSlug !== req.params.slug) {
      return res.status(404).json({ error: 'Campanha não encontrada.' });
    }
    const updated = await db.updateNotificationCampaign(req.params.id, req.body || {});
    res.json(updated);
  } catch (err) {
    logServerError('Erro ao atualizar campanha:', err);
    res.status(500).json({ error: 'Não foi possível atualizar a campanha.' });
  }
});

app.delete('/api/admin/:slug/push/campaigns/:id', requireAdmin, requireOwnRestaurant, async (req, res) => {
  try {
    const existing = await db.getNotificationCampaignById(req.params.id);
    if (!existing || existing.restaurantSlug !== req.params.slug) {
      return res.status(404).json({ error: 'Campanha não encontrada.' });
    }
    await db.deleteNotificationCampaign(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    logServerError('Erro ao excluir campanha:', err);
    res.status(500).json({ error: 'Não foi possível excluir a campanha.' });
  }
});

// Disparo manual imediato ("enviar agora", item 29) — reaproveita a mesma
// função de envio que o agendador usa pras campanhas recorrentes.
app.post('/api/admin/:slug/push/send', requireAdmin, requireOwnRestaurant, async (req, res) => {
  const { title, message, imageUrl, audience } = req.body || {};
  if (!title || !message) {
    return res.status(400).json({ error: 'Título e mensagem são obrigatórios.' });
  }
  try {
    const result = await sendNotificationToRestaurant(req.params.slug, {
      title,
      message,
      imageUrl,
      audience: audience === 'customers' ? 'customers' : 'all',
    });
    res.json({ ok: true, ...result });
  } catch (err) {
    logServerError('Erro ao enviar notificação:', err);
    res.status(500).json({ error: 'Não foi possível enviar a notificação.' });
  }
});

// Função compartilhada entre o envio manual e o agendador de campanhas —
// busca as inscrições do restaurante (todas ou só de clientes cadastrados,
// item 27), envia, e já limpa do banco as inscrições que o navegador
// cancelou (push expirado/desinstalado).
async function sendNotificationToRestaurant(slug, { title, message, imageUrl, audience }) {
  const subscriptions = await db.listPushSubscriptions(slug, { onlyCustomers: audience === 'customers' });
  if (subscriptions.length === 0) return { sentCount: 0, totalCount: 0 };
  const { sentCount, totalCount, expiredIds } = await sendPushToMany(subscriptions, {
    title,
    body: message,
    image: imageUrl || undefined,
  });
  if (expiredIds.length > 0) {
    await db.deletePushSubscriptionsByIds(expiredIds);
  }
  return { sentCount, totalCount };
}

// Agendador de campanhas (itens 29-30) — roda a cada minuto, verifica todas
// as campanhas ativas de todos os restaurantes e dispara as que estiverem
// na janela certa. Processo simples em memória (setInterval): funciona bem
// pro volume de campanhas de um sistema deste porte, sem precisar de fila
// externa (Redis/cron job separado) neste estágio do projeto.
async function runCampaignScheduler() {
  if (!isPushConfiguredForScheduler()) return;
  try {
    const campaigns = await db.listAllActiveCampaigns();
    const now = new Date();
    for (const campaign of campaigns) {
      if (!isCampaignDueNow(campaign, now)) continue;
      try {
        await sendNotificationToRestaurant(campaign.restaurantSlug, {
          title: campaign.title,
          message: campaign.message,
          imageUrl: campaign.imageUrl,
          audience: campaign.audience,
        });
        await db.updateNotificationCampaign(campaign.id, {
          lastSentAt: now.toISOString(),
          lastSentWindow: currentWindowKey(now),
        });
      } catch (err) {
        logServerError(`Erro ao disparar a campanha "${campaign.name}":`, err);
      }
    }
  } catch (err) {
    logServerError('Erro no agendador de campanhas:', err);
  }
}

function isPushConfiguredForScheduler() {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

setInterval(runCampaignScheduler, 60 * 1000);

// ---------- Assistente de atendimento com IA (Fase 4, itens 32-39) — lado público ----------

app.post('/api/:slug/ai/chat', async (req, res) => {
  const { slug } = req.params;
  const { sessionId, message, orderId } = req.body || {};
  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'Mensagem vazia.' });
  }
  if (!(await db.restaurantExists(slug))) {
    return res.status(404).json({ error: 'Restaurante não encontrado.' });
  }
  try {
    const session = getCustomerSession(bearerToken(req));
    const customerId = session ? session.customerId : null;
    if (!customerId && !sessionId) {
      return res.status(400).json({ error: 'Informe sessionId (visitante sem conta) ou faça login.' });
    }

    const conversation = await db.findOrCreateAiConversation({ restaurantSlug: slug, customerId, sessionId });
    await db.addAiMessage(conversation.id, 'user', message.trim());

    // Transferido pra humano (item 38): a IA para de responder — só
    // registra a mensagem, o atendente vê e responde pelo painel.
    if (conversation.status === 'human') {
      return res.json({ conversationId: conversation.id, status: 'human', reply: null });
    }

    const priorMessages = await db.listAiMessages(conversation.id);
    const history = priorMessages
      .slice(0, -1) // a última é a que acabamos de salvar — vai como userMessage separado
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({ role: m.role, content: m.content }));

    const [restaurantContext, orderContext] = await Promise.all([
      buildRestaurantContext(slug),
      buildOrderContext(slug, orderId),
    ]);

    const result = await generateChatReply({
      restaurantContext,
      orderContext,
      history,
      userMessage: message.trim(),
    });

    await db.addAiMessage(conversation.id, 'assistant', result.reply);

    if (result.requestHumanHandoff) {
      await db.updateAiConversationStatus(conversation.id, 'human');
    }

    res.json({
      conversationId: conversation.id,
      status: result.requestHumanHandoff ? 'human' : 'bot',
      reply: result.reply,
      cartAction: result.cartAction,
    });
  } catch (err) {
    logServerError(`Erro no assistente de IA de ${slug}:`, err);
    res.status(500).json({ error: 'Não foi possível falar com o assistente agora.' });
  }
});

// "👨‍💼 Falar com atendente" (item 38) — o próprio cliente pode pedir a
// transferência por um botão, sem precisar escrever isso na conversa.
app.post('/api/:slug/ai/handoff', async (req, res) => {
  const { conversationId } = req.body || {};
  if (!conversationId) return res.status(400).json({ error: 'Informe conversationId.' });
  try {
    const updated = await db.updateAiConversationStatus(conversationId, 'human');
    if (!updated) return res.status(404).json({ error: 'Conversa não encontrada.' });
    res.json({ ok: true });
  } catch (err) {
    logServerError('Erro ao transferir conversa:', err);
    res.status(500).json({ error: 'Não foi possível transferir a conversa.' });
  }
});

app.get('/api/:slug/ai/conversations/:id/messages', async (req, res) => {
  // Consulta pública do próprio histórico (item 39) — o id da conversa é um
  // UUID praticamente impossível de adivinhar, mesmo padrão já usado pra
  // consulta pública de pedidos neste arquivo.
  try {
    res.json(await db.listAiMessages(req.params.id));
  } catch (err) {
    logServerError('Erro ao buscar histórico da conversa:', err);
    res.status(500).json({ error: 'Não foi possível carregar o histórico.' });
  }
});

// ---------- IA — painel administrativo (itens 31, 38, 40) ----------

app.get('/api/admin/:slug/ai/conversations', requireAdmin, requireOwnRestaurant, async (req, res) => {
  try {
    res.json(await db.listAiConversations(req.params.slug, { status: req.query.status }));
  } catch (err) {
    logServerError('Erro ao listar conversas:', err);
    res.status(500).json({ error: 'Não foi possível carregar as conversas.' });
  }
});

app.get('/api/admin/:slug/ai/conversations/:id/messages', requireAdmin, requireOwnRestaurant, async (req, res) => {
  try {
    // Mesmo reforço de isolamento explicado na rota de campanhas acima —
    // o :id de uma conversa de outro restaurante nunca deve ser legível
    // só porque o admin tem acesso a ESTE restaurante.
    const conversation = await db.getAiConversation(req.params.id);
    if (!conversation || conversation.restaurantSlug !== req.params.slug) {
      return res.status(404).json({ error: 'Conversa não encontrada.' });
    }
    res.json(await db.listAiMessages(req.params.id));
  } catch (err) {
    logServerError('Erro ao buscar mensagens:', err);
    res.status(500).json({ error: 'Não foi possível carregar as mensagens.' });
  }
});

// Atendente humano assume e responde (item 38) — a partir daqui a IA já
// parou de responder sozinha (status já virou 'human' na hora do handoff).
app.post('/api/admin/:slug/ai/conversations/:id/reply', requireAdmin, requireOwnRestaurant, async (req, res) => {
  const { message } = req.body || {};
  if (!message || !message.trim()) return res.status(400).json({ error: 'Mensagem vazia.' });
  try {
    const conversation = await db.getAiConversation(req.params.id);
    if (!conversation || conversation.restaurantSlug !== req.params.slug) {
      return res.status(404).json({ error: 'Conversa não encontrada.' });
    }
    const saved = await db.addAiMessage(req.params.id, 'human_agent', message.trim());
    res.status(201).json(saved);
  } catch (err) {
    logServerError('Erro ao responder conversa:', err);
    res.status(500).json({ error: 'Não foi possível enviar a resposta.' });
  }
});

// Devolve a conversa pra IA responder de novo sozinha.
app.patch('/api/admin/:slug/ai/conversations/:id', requireAdmin, requireOwnRestaurant, async (req, res) => {
  const { status } = req.body || {};
  if (!['bot', 'human', 'closed'].includes(status)) {
    return res.status(400).json({ error: 'Status inválido.' });
  }
  try {
    const conversation = await db.getAiConversation(req.params.id);
    if (!conversation || conversation.restaurantSlug !== req.params.slug) {
      return res.status(404).json({ error: 'Conversa não encontrada.' });
    }
    const updated = await db.updateAiConversationStatus(req.params.id, status);
    res.json(updated);
  } catch (err) {
    logServerError('Erro ao atualizar conversa:', err);
    res.status(500).json({ error: 'Não foi possível atualizar a conversa.' });
  }
});

// "✨ Criar campanha com IA" (item 31) — só sugere, nunca envia sozinha; o
// resultado preenche o formulário de campanha pro dono revisar e decidir.
app.post('/api/admin/:slug/ai/campaign-suggest', requireAdmin, requireOwnRestaurant, async (req, res) => {
  const { brief } = req.body || {};
  if (!brief || !brief.trim()) return res.status(400).json({ error: 'Descreva o que você quer divulgar.' });
  if (!isAiConfigured()) {
    return res.status(503).json({ error: 'IA não configurada neste servidor (falta GEMINI_API_KEY).' });
  }
  try {
    const restaurantContext = await buildRestaurantContext(req.params.slug);
    const suggestion = await generateCampaignSuggestion(brief.trim(), restaurantContext);
    res.json(suggestion);
  } catch (err) {
    logServerError('Erro ao gerar sugestão de campanha:', err);
    res.status(500).json({ error: 'Não foi possível gerar a sugestão agora.' });
  }
});

// IA administrativa (item 40) — só analisa pedidos reais e sugere; nunca
// altera preço, produto, promoção ou configuração sozinha.
app.get('/api/admin/:slug/ai/analyze', requireAdmin, requireOwnRestaurant, async (req, res) => {
  if (!isAiConfigured()) {
    return res.status(503).json({ error: 'IA não configurada neste servidor (falta GEMINI_API_KEY).' });
  }
  try {
    const orders = await db.listOrders(req.params.slug);
    const delivered = orders.filter((o) => o.status !== 'cancelado');
    const totalRevenue = delivered.reduce((sum, o) => sum + Number(o.total || 0), 0);
    const avgTicket = delivered.length ? totalRevenue / delivered.length : 0;
    const cancelledCount = orders.length - delivered.length;
    const itemCounts = new Map();
    for (const order of delivered) {
      for (const item of order.items || []) {
        const name = item.menuItem?.name || item.name || 'item';
        itemCounts.set(name, (itemCounts.get(name) || 0) + (item.quantity || 1));
      }
    }
    const topItems = [...itemCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

    const summary = `
Total de pedidos: ${orders.length} (${cancelledCount} cancelados)
Faturamento (excluindo cancelados): R$ ${totalRevenue.toFixed(2).replace('.', ',')}
Ticket médio: R$ ${avgTicket.toFixed(2).replace('.', ',')}
Produtos mais pedidos: ${topItems.map(([name, qty]) => `${name} (${qty}x)`).join(', ') || 'sem dados suficientes'}
`.trim();

    const analysis = await generateSalesAnalysis(summary);
    res.json({ summary, analysis });
  } catch (err) {
    logServerError('Erro na análise administrativa de IA:', err);
    res.status(500).json({ error: 'Não foi possível gerar a análise agora.' });
  }
});

// Cliente consulta o status do próprio pedido (id é praticamente impossível de adivinhar)
app.get('/api/:slug/orders/:id', async (req, res) => {
  const { slug, id } = req.params;
  if (!(await db.restaurantExists(slug))) {
    return res.status(404).json({ error: 'Restaurante não encontrado.' });
  }
  try {
    const order = await db.getOrder(slug, id);
    if (!order) return res.status(404).json({ error: 'Pedido não encontrado.' });
    res.json(order);
  } catch (err) {
    logServerError(`Erro ao buscar pedido de ${slug}:`, err);
    res.status(500).json({ error: 'Não foi possível buscar o pedido.' });
  }
});

// ---------- Login do super-admin ----------

app.post('/api/admin/login', rateLimit({windowMs:60000,max:10,key:'admin-login'}), (req, res) => {
  const { password } = req.body || {};
  if (password !== ADMIN_PASSWORD) {
    void db.createAdminLoginLog({login:'master',success:false,mode:'master',ip:req.ip,userAgent:req.get('user-agent'),details:{reason:'invalid_password'}}).catch(()=>{});
    return res.status(401).json({ error: 'Senha incorreta.' });
  }
  void db.createAdminLoginLog({login:'master',success:true,mode:'master',ip:req.ip,userAgent:req.get('user-agent')}).catch(()=>{});
  res.json({ token: issueToken() });
});

// Kanban individual (senha própria de UM restaurante, evolução v24_2).
app.post('/api/:slug/kanban-login', rateLimit({windowMs:60000,max:10,key:'kanban-login'}), async (req, res) => {
  const { slug } = req.params;
  const { password } = req.body || {};
  if (!password) return res.status(400).json({ error: 'Informe a senha do Kanban.' });
  try {
    if (!(await db.restaurantExists(slug))) return res.status(404).json({ error: 'Restaurante não encontrado.' });
    const { restaurantConfig } = await db.readRestaurantData(slug);
    const hash = restaurantConfig?.kanbanPasswordHash;
    if (!hash) {
      return res.status(400).json({ error: 'Este restaurante ainda não tem uma senha de Kanban configurada. Peça ao administrador pra definir uma em Configurações.' });
    }
    const ok = await verifyPassword(password, hash);
    void db.createAdminLoginLog({login:`kanban:${slug}`,success:ok,mode:'kanban',ip:req.ip,userAgent:req.get('user-agent')}).catch(()=>{});
    if (!ok) return res.status(401).json({ error: 'Senha incorreta.' });
    res.json({ token: issueKanbanToken(slug) });
  } catch (err) {
    logServerError(`Erro no login do Kanban individual de ${slug}:`, err);
    res.status(500).json({ error: 'Não foi possível entrar no Kanban.' });
  }
});

// Kanban único — todos os restaurantes numa tela só (evolução v24_2).
// Senha de autorização própria (KANBAN_ALL_PASSWORD), com ADMIN_PASSWORD
// sempre aceita também, já que quem tem acesso mestre óbvio tem acesso a
// isto também.
app.post('/api/kanban-all/login', rateLimit({windowMs:60000,max:10,key:'kanban-all-login'}), (req, res) => {
  const { password } = req.body || {};
  const ok = Boolean(password) && (password === ADMIN_PASSWORD || (KANBAN_ALL_PASSWORD && password === KANBAN_ALL_PASSWORD));
  void db.createAdminLoginLog({login:'kanban-all',success:ok,mode:'kanban-all',ip:req.ip,userAgent:req.get('user-agent')}).catch(()=>{});
  if (!ok) return res.status(401).json({ error: 'Senha incorreta.' });
  res.json({ token: issueKanbanAllToken() });
});

// Login individual (Fase 4, item 17) — login + senha de um usuário criado
// pelo super-admin em /api/admin/users. Convive com o login mestre acima
// sem substituí-lo: a tela de login do painel pode continuar usando a senha
// única, ou usar login+senha de um usuário específico.
app.post('/api/admin/users/login', rateLimit({windowMs:60000,max:10,key:'admin-user-login'}), async (req, res) => {
  const { login, password } = req.body || {};
  if (!login || !password) {
    return res.status(400).json({ error: 'Informe login e senha.' });
  }
  try {
    const user = await db.getAdminUserByLogin(login);
    if (!user || !user.active) {
      void db.createAdminLoginLog({login:String(login).trim(),success:false,mode:'user',ip:req.ip,userAgent:req.get('user-agent'),details:{reason:'invalid_login'}}).catch(()=>{});
      return res.status(401).json({ error: 'Login ou senha incorretos.' });
    }
    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) {
      void db.createAdminLoginLog({adminUserId:user.id,login:user.login,success:false,mode:'user',ip:req.ip,userAgent:req.get('user-agent'),details:{reason:'invalid_password'}}).catch(()=>{});
      return res.status(401).json({ error: 'Login ou senha incorretos.' });
    }
    void db.createAdminLoginLog({adminUserId:user.id,login:user.login,success:true,mode:'user',ip:req.ip,userAgent:req.get('user-agent')}).catch(()=>{});
    res.json({
      token: issueToken(user.id),
      user: {
        id: user.id,
        name: user.name,
        login: user.login,
        role: user.role,
        restaurantSlug: user.restaurantSlug,
        permissions: user.permissions,
      },
    });
  } catch (err) {
    logServerError('Erro no login de usuário:', err);
    res.status(500).json({ error: 'Não foi possível fazer login.' });
  }
});

// ---------- Usuários do painel + permissões granulares (Fase 4, itens 17-19) ----------
// Sempre exige admin_gerenciar_usuarios (ou restaurante_usuarios pra um
// usuário mexer só na sua própria lista/restaurante) — login mestre sempre
// passa, sem mudar nada de como ele já funcionava.
function canManageUsers(req) {
  return hasPermission(req, 'admin_gerenciar_usuarios') || hasPermission(req, 'restaurante_usuarios');
}

// Nunca devolve o hash da senha pro frontend.
function publicAdminUser(user) {
  const { passwordHash, ...rest } = user;
  return rest;
}

app.get('/api/admin/customers', requireAdmin, async (req, res) => {
  if (!req.adminUser?.isMaster) return res.status(403).json({ error: 'Somente o super-admin pode gerenciar contas de clientes.' });
  try {
    const customers = await db.listCustomers();
    res.json(customers.map(({ passwordHash, ...safe }) => safe));
  } catch (err) { logServerError('Erro ao listar clientes:', err); res.status(500).json({ error: 'Não foi possível carregar os clientes.' }); }
});
app.delete('/api/admin/customers/:id', requireAdmin, async (req, res) => {
  if (!req.adminUser?.isMaster) return res.status(403).json({ error: 'Somente o super-admin pode excluir contas de clientes.' });
  try {
    const deleted = await db.deleteCustomer(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Cliente não encontrado.' });
    res.json({ ok: true, customer: { id: deleted.id, name: deleted.name, phone: deleted.phone } });
  } catch (err) { logServerError('Erro ao excluir cliente:', err); res.status(500).json({ error: 'Não foi possível excluir a conta do cliente.' }); }
});

app.get('/api/admin/users', requireAdmin, async (req, res) => {
  if (!canManageUsers(req)) return res.status(403).json({ error: 'Você não tem permissão para ver usuários.' });
  try {
    let users = await db.listAdminUsers();
    // Usuário sem escopo de super-admin (restaurante_usuarios, não
    // admin_gerenciar_usuarios) só vê os usuários do próprio restaurante.
    if (!req.adminUser.isMaster && !hasPermission(req, 'admin_gerenciar_usuarios') && req.adminUser.restaurantSlug) {
      users = users.filter((u) => u.restaurantSlug === req.adminUser.restaurantSlug);
    }
    res.json(users.map(publicAdminUser));
  } catch (err) {
    logServerError('Erro ao listar usuários:', err);
    res.status(500).json({ error: 'Não foi possível carregar os usuários.' });
  }
});

app.post('/api/admin/users', requireAdmin, async (req, res) => {
  if (!canManageUsers(req)) return res.status(403).json({ error: 'Você não tem permissão para criar usuários.' });
  const { name, login, password, restaurantSlug, role, permissions } = req.body || {};
  if (!name || !login || !password) {
    return res.status(400).json({ error: 'Nome, login e senha inicial são obrigatórios.' });
  }
  // Usuário não-mestre sem escopo global só pode criar usuários pro próprio
  // restaurante (reforço de isolamento — item 19).
  let finalRestaurantSlug = restaurantSlug || null;
  if (!req.adminUser.isMaster && !hasPermission(req, 'admin_gerenciar_usuarios')) {
    finalRestaurantSlug = req.adminUser.restaurantSlug;
  }
  if (finalRestaurantSlug && !(await db.restaurantExists(finalRestaurantSlug))) {
    return res.status(404).json({ error: 'Restaurante não encontrado.' });
  }
  try {
    const passwordHash = await hashPassword(password);
    const user = await db.createAdminUser({
      name,
      login,
      passwordHash,
      restaurantSlug: finalRestaurantSlug,
      role,
      permissions: sanitizePermissions(permissions),
    });
    res.status(201).json({ ok: true, user: publicAdminUser(user) });
  } catch (err) {
    if (err.code === 'LOGIN_TAKEN') {
      return res.status(409).json({ error: 'Já existe um usuário com esse login.' });
    }

    // Supabase: quando a migração 0012 ainda não foi executada, a tabela
    // admin_users não existe e o erro original acabava escondido atrás de
    // "Não foi possível criar o usuário". Retornamos uma mensagem acionável
    // sem expor a chave, SQL ou detalhes internos do banco.
    if (err.code === '42P01' || /relation .*admin_users.* does not exist/i.test(String(err.message || ''))) {
      logServerError('Tabela admin_users ausente. Execute database/0012_admin_users.sql no Supabase.');
      return res.status(503).json({
        error: 'O banco ainda não está preparado para Usuários e Permissões. Execute a migração 0012_admin_users.sql no Supabase e faça um novo deploy.'
      });
    }

    logServerError('Erro ao criar usuário:', {
      message: err?.message,
      code: err?.code,
      details: err?.details,
      hint: err?.hint,
    });
    res.status(500).json({ error: 'Não foi possível criar o usuário. Verifique o log do servidor para identificar o erro do banco.' });
  }
});

// Editar dados, permissões, ativar/desativar e (opcionalmente) redefinir a
// senha de um usuário. O super-admin nunca vê a senha original — só pode
// definir uma nova (item 19).
app.patch('/api/admin/users/:id', requireAdmin, async (req, res) => {
  if (!canManageUsers(req)) return res.status(403).json({ error: 'Você não tem permissão para editar usuários.' });
  const { id } = req.params;
  const existing = await db.getAdminUserById(id).catch(() => null);
  if (!existing) return res.status(404).json({ error: 'Usuário não encontrado.' });
  // Isolamento: quem não é mestre/gerenciar_usuarios global só edita usuários
  // do próprio restaurante.
  if (
    !req.adminUser.isMaster &&
    !hasPermission(req, 'admin_gerenciar_usuarios') &&
    existing.restaurantSlug !== req.adminUser.restaurantSlug
  ) {
    return res.status(403).json({ error: 'Você não tem acesso a este usuário.' });
  }
  // Ninguém edita a PRÓPRIA permissão/escopo/status, exceto o login mestre
  // (evolução — item "usuário não pode alterar a própria permissão").
  // Sem isso, um usuário com admin_gerenciar_usuarios ou restaurante_usuarios
  // poderia se auto-promover chamando esta mesma rota no próprio id.
  const isEditingSelf = !req.adminUser.isMaster && req.adminUser.id === id;
  if (isEditingSelf && (req.body?.permissions !== undefined || req.body?.restaurantSlug !== undefined || req.body?.active !== undefined)) {
    return res.status(403).json({ error: 'Você não pode alterar suas próprias permissões, restaurante ou status. Peça a outro administrador.' });
  }
  const { name, restaurantSlug, role, active, permissions, newPassword } = req.body || {};
  const patch = {};
  if (name !== undefined) patch.name = name;
  if (role !== undefined) patch.role = role;
  if (active !== undefined) patch.active = Boolean(active);
  if (permissions !== undefined) patch.permissions = sanitizePermissions(permissions);
  // Só quem tem escopo global pode mudar o restaurante de um usuário.
  if (restaurantSlug !== undefined && (req.adminUser.isMaster || hasPermission(req, 'admin_gerenciar_usuarios'))) {
    patch.restaurantSlug = restaurantSlug || null;
  }
  if (newPassword) {
    patch.passwordHash = await hashPassword(newPassword);
  }
  try {
    const updated = await db.updateAdminUser(id, patch);
    res.json({ ok: true, user: publicAdminUser(updated) });
  } catch (err) {
    logServerError('Erro ao atualizar usuário:', err);
    res.status(500).json({ error: 'Não foi possível atualizar o usuário.' });
  }
});

// ---------- Rotas do admin (protegidas) ----------

// Auditoria e manutenção
app.get('/api/admin/logs/errors', requireAdmin, async (req,res)=>{ try{res.json({ok:true,logs:await db.listErrorLogs(100)});}catch(err){logServerError('Erro ao listar logs de erro',err);res.status(500).json({error:'Não foi possível carregar os logs de erro.'});} });
app.delete('/api/admin/logs/errors/:id', requireAdmin, async (req,res)=>{if(!req.adminUser?.isMaster&&!hasPermission(req,'admin_gerenciar_usuarios'))return res.status(403).json({error:'Sem permissão para apagar logs.'});try{await db.deleteErrorLog(req.params.id);res.json({ok:true});}catch(err){logServerError('Erro ao excluir log de erro',err);res.status(500).json({error:'Não foi possível excluir o log.'});}});
app.delete('/api/admin/logs/errors', requireAdmin, async (req,res)=>{ if(!req.adminUser?.isMaster&&!hasPermission(req,'admin_gerenciar_usuarios'))return res.status(403).json({error:'Sem permissão para apagar logs.'}); try{await db.clearErrorLogs();res.json({ok:true});}catch(err){logServerError('Erro ao limpar logs de erro',err);res.status(500).json({error:'Não foi possível limpar os logs de erro.'});} });
app.get('/api/admin/logs/login', requireAdmin, async (req,res)=>{ try{res.json({ok:true,logs:await db.listAdminLoginLogs(100)});}catch(err){logServerError('Erro ao listar histórico de login',err);res.status(500).json({error:'Não foi possível carregar o histórico de login.'});} });
app.delete('/api/admin/logs/login/:id', requireAdmin, async (req,res)=>{if(!req.adminUser?.isMaster&&!hasPermission(req,'admin_gerenciar_usuarios'))return res.status(403).json({error:'Sem permissão para apagar histórico.'});try{await db.deleteAdminLoginLog(req.params.id);res.json({ok:true});}catch(err){logServerError('Erro ao excluir histórico de login',err);res.status(500).json({error:'Não foi possível excluir o registro.'});}});
app.delete('/api/admin/logs/login', requireAdmin, async (req,res)=>{ if(!req.adminUser?.isMaster&&!hasPermission(req,'admin_gerenciar_usuarios'))return res.status(403).json({error:'Sem permissão para apagar histórico.'}); try{await db.clearAdminLoginLogs();res.json({ok:true});}catch(err){logServerError('Erro ao limpar histórico de login',err);res.status(500).json({error:'Não foi possível limpar o histórico de login.'});} });

// Lista TODOS os restaurantes (ativos e inativos) — usada pela barra de troca
// do super-admin em /admin, que precisa continuar mostrando (e permitindo
// reativar) restaurantes desativados. Diferente de GET /api/restaurants,
// que é pública e só traz os ativos.
app.get('/api/admin/restaurants', requireAdmin, async (req, res) => {
  try {
    res.json(await db.getRestaurantsAdmin());
  } catch (err) {
    logServerError('Erro ao listar restaurantes (admin):', err);
    res.status(500).json({ error: 'Não foi possível carregar a lista de restaurantes.' });
  }
});

// Ativa/desativa um restaurante. Nunca apaga nada — só some da vitrine
// pública e passa a recusar novos pedidos (ver POST /api/:slug/orders).
app.patch(
  '/api/admin/restaurants/:slug/active',
  requireAdmin,
  requirePermission('admin_ativar_desativar_restaurantes'),
  async (req, res) => {
  const { slug } = req.params;
  const { active } = req.body || {};
  if (typeof active !== 'boolean') {
    return res.status(400).json({ error: 'Campo "active" deve ser true ou false.' });
  }
  if (!(await db.restaurantExists(slug))) {
    return res.status(404).json({ error: 'Restaurante não encontrado.' });
  }
  try {
    const updated = await db.setRestaurantActive(slug, active);
    res.json({ ok: true, restaurant: updated });
  } catch (err) {
    logServerError(`Erro ao alterar status ativo de ${slug}:`, err);
    res.status(500).json({ error: 'Não foi possível alterar o status do restaurante.' });
  }
});

// Admin envia uma foto e registra a mídia na biblioteca do restaurante.
// Produção com Supabase: arquivo no Supabase Storage + metadata em media_assets.
// Compatibilidade: Cloudinary e, por último, disco local continuam funcionando.
app.post('/api/:slug/upload', requireAdmin, requireOwnRestaurant, (req, res) => {
  const { slug } = req.params;
  imageUpload.single('image')(req, res, async (err) => {
    if (err) {
      const message = err.code === 'LIMIT_FILE_SIZE'
        ? 'Imagem muito grande (máximo 8MB).'
        : (err.message || 'Não foi possível enviar a imagem.');
      return res.status(400).json({ error: message });
    }
    if (!(await db.restaurantExists(slug))) {
      return res.status(404).json({ error: 'Restaurante não encontrado.' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhuma imagem enviada.' });
    }

    try {
      const stored = await saveImage(req.file, slug);
      let url = stored.urlPath;
      if (url.startsWith('/uploads/')) {
        url = `${req.protocol}://${req.get('host')}${url}`;
      }

      const kind = String(req.body?.kind || 'other').slice(0, 40);
      const entityType = req.body?.entityType ? String(req.body.entityType).slice(0, 60) : null;
      const entityId = req.body?.entityId ? String(req.body.entityId).slice(0, 120) : null;
      const altText = req.body?.altText ? String(req.body.altText).slice(0, 240) : null;

      let asset;
      try {
        asset = await db.createMediaAsset({
          restaurantSlug: slug,
          storageProvider: stored.provider,
          bucket: stored.bucket,
          storagePath: stored.path,
          url,
          kind,
          entityType,
          entityId,
          originalName: req.file.originalname,
          mimeType: req.file.mimetype,
          sizeBytes: req.file.size,
          altText,
          metadata: {
            storageMode: mediaStorageMode(),
            uploadSource: 'admin',
          },
        });
      } catch (dbErr) {
        // Não deixa um arquivo recém-criado no Storage sem registro no
        // catálogo. Para Supabase Storage a remoção é segura e imediata.
        try { await removeStoredImage({ provider: stored.provider, bucket: stored.bucket, path: stored.path }); } catch (cleanupErr) {
          logServerError('Falha ao limpar mídia órfã:', cleanupErr?.message || cleanupErr);
        }
        throw dbErr;
      }

      res.status(201).json({
        ok: true,
        url,
        asset,
        storage: {
          provider: stored.provider,
          bucket: stored.bucket || undefined,
          path: stored.path || undefined,
        },
      });
    } catch (uploadErr) {
      logServerError(`Erro ao enviar imagem (${slug}):`, uploadErr);
      res.status(500).json({ error: 'Não foi possível salvar a imagem. Tente novamente.' });
    }
  });
});

// Biblioteca de imagens do restaurante — nunca cruza o slug recebido na URL.
app.get('/api/:slug/media', requireAdmin, requireOwnRestaurant, async (req, res) => {
  const { slug } = req.params;
  try {
    if (!(await db.restaurantExists(slug))) return res.status(404).json({ error: 'Restaurante não encontrado.' });
    const kind = req.query.kind ? String(req.query.kind) : undefined;
    res.json({ ok: true, assets: await db.listMediaAssets(slug, { kind }) });
  } catch (err) {
    logServerError(`Erro ao listar mídia (${slug}):`, err);
    res.status(500).json({ error: 'Não foi possível carregar a biblioteca de imagens.' });
  }
});

app.delete('/api/:slug/media/:assetId', requireAdmin, requireOwnRestaurant, async (req, res) => {
  const { slug, assetId } = req.params;
  try {
    const asset = await db.getMediaAssetById(slug, assetId);
    if (!asset) return res.status(404).json({ error: 'Imagem não encontrada.' });

    // Remove primeiro o objeto do Supabase Storage quando aplicável. Se o
    // storage falhar, não apagamos o registro do catálogo: evita mídia órfã.
    await removeStoredImage(asset);
    const deleted = await db.deleteMediaAsset(slug, assetId);
    res.json({ ok: true, asset: deleted });
  } catch (err) {
    logServerError(`Erro ao remover mídia (${slug}/${assetId}):`, err);
    res.status(500).json({ error: 'Não foi possível remover a imagem.' });
  }
});

app.put('/api/:slug/menu-items', requireAdmin, requireOwnRestaurant, async (req, res) => {
  const { slug } = req.params;
  if (!(await db.restaurantExists(slug))) return res.status(404).json({ error: 'Restaurante não encontrado.' });
  const menuItems = req.body;
  if (!Array.isArray(menuItems)) return res.status(400).json({ error: 'Corpo deve ser um array de itens.' });
  try {
    const saved = await db.updateMenuItems(slug, menuItems);
    broadcastOrderEvent(slug, { type: 'menu-updated', updatedAt: new Date().toISOString() });
    res.json({ ok: true, menuItems: saved });
  } catch (err) {
    logServerError(`Erro ao salvar itens de ${slug}:`, err);
    res.status(500).json({ error: 'Não foi possível salvar os itens.' });
  }
});

app.put('/api/:slug/categories', requireAdmin, requireOwnRestaurant, async (req, res) => {
  const { slug } = req.params;
  if (!(await db.restaurantExists(slug))) return res.status(404).json({ error: 'Restaurante não encontrado.' });
  const categories = req.body;
  if (!Array.isArray(categories)) return res.status(400).json({ error: 'Corpo deve ser um array de categorias.' });
  try {
    const saved = await db.updateCategories(slug, categories);
    broadcastOrderEvent(slug, { type: 'menu-updated', updatedAt: new Date().toISOString() });
    res.json({ ok: true, categories: saved });
  } catch (err) {
    logServerError(`Erro ao salvar categorias de ${slug}:`, err);
    res.status(500).json({ error: 'Não foi possível salvar as categorias.' });
  }
});

// Consulta leve e pública do ajuste operacional atual (Fase 4, item 15) —
// usada pelo cliente em polling curto pra saber, quase em tempo real, se o
// restaurante aumentou o tempo de entrega enquanto o pedido dele está aberto.
// Não exige :slug/menu inteiro (cardápio) só pra pegar 2 campos pequenos.
app.get('/api/:slug/operational-status', async (req, res) => {
  const { slug } = req.params;
  if (!(await db.restaurantExists(slug))) {
    return res.status(404).json({ error: 'Restaurante não encontrado.' });
  }
  try {
    const { restaurantConfig } = await db.readRestaurantData(slug);
    res.json({
      operationalStatus: restaurantConfig?.operationalStatus || 'normal',
      operationalAdjustmentMinutes: restaurantConfig?.operationalAdjustmentMinutes || 0,
    });
  } catch (err) {
    logServerError(`Erro ao consultar status operacional de ${slug}:`, err);
    res.status(500).json({ error: 'Não foi possível consultar o status operacional.' });
  }
});

app.put('/api/:slug/config', requireAdmin, requireOwnRestaurant, async (req, res) => {
  const { slug } = req.params;
  if (!(await db.restaurantExists(slug))) return res.status(404).json({ error: 'Restaurante não encontrado.' });
  const incoming = req.body;
  if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) {
    return res.status(400).json({ error: 'Corpo deve ser um objeto de configuração.' });
  }
  try {
    // Senhas específicas deste restaurante (Kanban individual e limpeza de
    // histórico) nunca são salvas em texto puro — se vier uma senha nova em
    // texto plano, convertemos pra hash aqui e nunca deixamos o campo de
    // texto puro chegar ao merge/gravação. Campo vazio ("") remove a senha
    // (desativa a exigência); campo ausente mantém o que já estava salvo.
    if (typeof incoming.kanbanPassword === 'string') {
      incoming.kanbanPasswordHash = incoming.kanbanPassword ? await hashPassword(incoming.kanbanPassword) : null;
      delete incoming.kanbanPassword;
    }
    if (typeof incoming.historyClearPassword === 'string') {
      incoming.historyClearPasswordHash = incoming.historyClearPassword
        ? await hashPassword(incoming.historyClearPassword)
        : null;
      delete incoming.historyClearPassword;
    }
    // Atualização segura: faz MERGE com a configuração já salva deste restaurante
    // (tanto no backend JSON quanto no Supabase), em vez de substituir tudo —
    // um payload incompleto nunca apaga silenciosamente campos que não vieram.
    const merged = await db.updateConfig(slug, incoming);
    broadcastOrderEvent(slug, { type: 'config-updated', updatedAt: new Date().toISOString() });
    // Os hashes nunca voltam pro frontend — só um booleano "isSet" pra
    // desenhar o campo como preenchido sem expor nada sensível.
    const { kanbanPasswordHash, historyClearPasswordHash, ...safeMerged } = merged;
    res.json({
      ok: true,
      restaurantConfig: {
        ...safeMerged,
        kanbanPasswordSet: Boolean(kanbanPasswordHash),
        historyClearPasswordSet: Boolean(historyClearPasswordHash),
      },
    });
  } catch (err) {
    logServerError(`Erro ao salvar configuração de ${slug}:`, err);
    res.status(500).json({ error: 'Não foi possível salvar a configuração.' });
  }
});

// Super-admin atualiza a configuração global da vitrine "/"
app.put('/api/admin/platform', requireAdmin, async (req, res) => {
  const incoming = req.body;
  if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) {
    return res.status(400).json({ error: 'Corpo deve ser um objeto de configuração.' });
  }
  try {
    const merged = await db.updatePlatformSettings(incoming);
    res.json({ ok: true, platform: merged });
  } catch (err) {
    logServerError('Erro ao salvar configuração da vitrine:', err);
    res.status(500).json({ error: 'Não foi possível salvar a configuração da vitrine.' });
  }
});

// Admin lista todos os pedidos de um restaurante
app.get('/api/:slug/orders', requireAdminOrKanban, requireOwnRestaurant, async (req, res) => {
  const { slug } = req.params;
  if (!(await db.restaurantExists(slug))) return res.status(404).json({ error: 'Restaurante não encontrado.' });
  try {
    res.json(await db.listOrders(slug));
  } catch (err) {
    logServerError(`Erro ao listar pedidos de ${slug}:`, err);
    res.status(500).json({ error: 'Não foi possível carregar os pedidos.' });
  }
});

// Fila persistente de impressão V13. O navegador continua sendo quem imprime,
// mas o pedido de impressão deixa de depender apenas do localStorage do dispositivo.
app.get('/api/:slug/print-jobs', requireAdminOrKanban, requireOwnRestaurant, async (req,res)=>{ const {slug}=req.params; try{res.json({jobs:await db.listPrintJobs(slug, Number(req.query.limit)||100)});}catch(err){logServerError(`Erro ao listar fila de impressão ${slug}`,err,{restaurantSlug:slug});res.status(500).json({error:'Não foi possível carregar a fila de impressão.'});} });
app.post('/api/:slug/print-jobs', requireAdminOrKanban, requireOwnRestaurant, async (req,res)=>{ const {slug}=req.params; const {orderId,orderNumber,variant}=req.body||{}; if(!orderId)return res.status(400).json({error:'orderId é obrigatório.'}); try{const order=await db.getOrder(slug,orderId);if(!order)return res.status(404).json({error:'Pedido não encontrado.'});const job=await db.createPrintJob(slug,{orderId,orderNumber:orderNumber||order.orderNumber,variant:variant||'customer'});broadcastOrderEvent(slug,{type:'print-job-created',orderId,printJobId:job.id,updatedAt:job.updatedAt});res.status(201).json({job});}catch(err){logServerError(`Erro ao criar trabalho de impressão ${slug}/${orderId}`,err,{restaurantSlug:slug});res.status(500).json({error:'Não foi possível registrar a impressão.'});} });
app.patch('/api/:slug/print-jobs/:id', requireAdminOrKanban, requireOwnRestaurant, async (req,res)=>{ const {slug,id}=req.params; const allowed=['pendente','imprimindo','impresso','erro','cancelado']; const status=req.body?.status; const patch={}; if(status&&allowed.includes(status))patch.status=status; if(req.body?.error!==undefined)patch.error=String(req.body.error||'').slice(0,1000); if(req.body?.attempts!==undefined)patch.attempts=Math.max(0,Number(req.body.attempts)||0); if(req.body?.workerId!==undefined)patch.workerId=String(req.body.workerId).slice(0,128); if(req.body?.leaseUntil!==undefined)patch.leaseUntil=req.body.leaseUntil; if(!Object.keys(patch).length)return res.status(400).json({error:'Nenhuma alteração válida.'}); try{const job=await db.updatePrintJob(slug,id,patch);if(!job)return res.status(404).json({error:'Trabalho de impressão não encontrado.'});broadcastOrderEvent(slug,{type:'print-job-updated',orderId:job.orderId,printJobId:job.id,status:job.status,updatedAt:job.updatedAt});res.json({job});}catch(err){logServerError(`Erro ao atualizar trabalho de impressão ${slug}/${id}`,err,{restaurantSlug:slug,details:{requestId:req.requestId}});res.status(500).json({error:'Não foi possível atualizar a fila de impressão.'});} });
app.post('/api/:slug/print-jobs/claim', requireAdmin, requireOwnRestaurant, async (req,res)=>{ try { const job=await db.claimNextPrintJob(req.params.slug,String(req.body?.workerId||'bridge').slice(0,128)); if(!job)return res.status(204).end(); broadcastOrderEvent(req.params.slug,{type:'print-job-updated',orderId:job.orderId,printJobId:job.id,status:job.status,updatedAt:job.updatedAt}); res.json({job}); } catch(err){ logServerError(`Erro ao reservar trabalho de impressão ${req.params.slug}`,err,{restaurantSlug:req.params.slug,details:{requestId:req.requestId}}); res.status(500).json({error:'Não foi possível reservar a impressão.'}); }});

// Exclusão consciente: somente histórico finalizado/cancelado.
app.delete('/api/:slug/orders/:id', requireAdmin, requireOwnRestaurant, async (req,res)=>{ const {slug,id}=req.params; if(!hasPermission(req,'gerenciar_historico')&&!req.adminUser?.isMaster)return res.status(403).json({error:'Você não tem permissão para excluir histórico.'}); try{const existing=await db.getOrder(slug,id);if(!existing)return res.status(404).json({error:'Pedido não encontrado.'});if(!['entregue','cancelado'].includes(existing.status))return res.status(409).json({error:'Só pedidos finalizados ou cancelados podem ser excluídos.'});const order=await db.deleteOrder(slug,id);broadcastOrderEvent(slug,{type:'deleted',orderId:id,updatedAt:new Date().toISOString(),customerId:order?.customerId||null});res.json({ok:true,order});}catch(err){logServerError(`Erro ao excluir pedido ${slug}/${id}`,err,{restaurantSlug:slug});res.status(500).json({error:'Não foi possível excluir o pedido.'});} });
app.delete('/api/:slug/orders/history', requireAdminOrKanban, requireOwnRestaurant, async (req,res)=>{ const {slug}=req.params; if(!hasPermission(req,'gerenciar_historico')&&!req.adminUser?.isMaster)return res.status(403).json({error:'Você não tem permissão para excluir histórico.'}); try{
  // Senha extra específica deste restaurante (evolução v24_2) — reforço
  // além da permissão de conta: útil quando várias pessoas compartilham o
  // mesmo dispositivo/login e não se quer que qualquer uma apague o
  // histórico sem confirmar de novo com uma senha separada.
  const { restaurantConfig } = await db.readRestaurantData(slug);
  if (restaurantConfig?.historyClearPasswordHash) {
    const provided = req.body?.password;
    if (!provided) return res.status(400).json({ error: 'Este restaurante exige uma senha pra limpar o histórico.', requiresPassword: true });
    const ok = await verifyPassword(provided, restaurantConfig.historyClearPasswordHash);
    if (!ok) return res.status(401).json({ error: 'Senha de limpeza de histórico incorreta.' });
  }
  const result=await db.clearFinishedOrders(slug);broadcastOrderEvent(slug,{type:'history-cleared',updatedAt:new Date().toISOString()});res.json({ok:true,...result});}catch(err){logServerError(`Erro ao limpar histórico ${slug}`,err,{restaurantSlug:slug});res.status(500).json({error:'Não foi possível limpar o histórico.'});} });

// Fluxo operacional V7: o pedido só avança pela sequência oficial.
// Cancelamento continua sendo uma ação paralela, protegida pela permissão própria.
const ORDER_FLOW = {
  recebido: ['em_preparo', 'cancelado'],
  em_preparo: ['pronto', 'cancelado'],
  pronto: ['saiu_entrega', 'cancelado'],
  saiu_entrega: ['entregue', 'cancelado'],
  entregue: [],
  cancelado: [],
};

// Admin atualiza um pedido (status, entregador, etc)
// Lógica compartilhada entre a rota normal (por restaurante) e a do Kanban
// único (todos os restaurantes) — evita duplicar a máquina de estados e a
// checagem de permissão de cancelamento em dois lugares.
async function updateOrderStatusHandler(slug, id, req, res) {
  if (!(await db.restaurantExists(slug))) return res.status(404).json({ error: 'Restaurante não encontrado.' });
  if (req.body?.status === 'cancelado' && !hasPermission(req, 'cancelar_pedido')) {
    return res.status(403).json({ error: 'Você não tem permissão para cancelar pedidos.' });
  }
  try {
    const { expectedUpdatedAt, ...incomingPatch } = req.body || {};
    const current = await db.getOrder(slug, id);
    if (!current) return res.status(404).json({ error: 'Pedido não encontrado.' });

    if (incomingPatch.status && incomingPatch.status !== current.status) {
      const allowed = ORDER_FLOW[current.status] || [];
      if (!allowed.includes(incomingPatch.status)) {
        return res.status(409).json({
          error: `Transição inválida: ${current.status} → ${incomingPatch.status}. Siga o fluxo operacional do pedido.`,
          order: current,
          code: 'INVALID_ORDER_TRANSITION',
        });
      }
      incomingPatch.statusHistory = [
        ...(Array.isArray(current.statusHistory) ? current.statusHistory : []),
        { status: incomingPatch.status, timestamp: new Date().toISOString(), note: incomingPatch.status === 'cancelado' ? (incomingPatch.cancelReason || 'Cancelado pelo restaurante') : undefined },
      ];
    }
    const order = await db.updateOrder(slug, id, incomingPatch, expectedUpdatedAt);
    if (!order) return res.status(404).json({ error: 'Pedido não encontrado.' });
    broadcastOrderEvent(slug, { type: 'updated', orderId: order.id, status: order.status, updatedAt: order.updatedAt || new Date().toISOString(), customerId: order.customerId || null });
    res.json({ ok: true, order });
  } catch (err) {
    if (err?.code === 'ORDER_CONFLICT') return res.status(409).json({ error: err.message, order: err.currentOrder });
    logServerError(`Erro ao atualizar pedido de ${slug}:`, err);
    res.status(500).json({ error: 'Não foi possível atualizar o pedido.' });
  }
}

app.patch('/api/:slug/orders/:id', requireAdminOrKanban, requireOwnRestaurant, async (req, res) => {
  await updateOrderStatusHandler(req.params.slug, req.params.id, req, res);
});

// V14-V18: backup/restore, entregadores e conciliação de pagamento
app.get('/api/:slug/backup', requireAdmin, requireOwnRestaurant, async (req,res)=>{try{const [data,orders,media]=await Promise.all([db.readRestaurantData(req.params.slug),db.listOrders(req.params.slug),db.listMediaAssets(req.params.slug)]);const payload={restaurantConfig:data.restaurantConfig,categories:data.categories||[],menuItems:data.menuItems||[],orders,media,exportedAt:new Date().toISOString()};const saved=await db.createRestaurantBackup(req.params.slug,payload,req.adminUser?.id||'master');res.json({ok:true,backup:saved});}catch(e){sendDbError(res,e,req,'Não foi possível gerar o backup.','Backup falhou',{restaurantSlug:req.params.slug});}});
app.get('/api/:slug/backups', requireAdmin, requireOwnRestaurant, async(req,res)=>{try{res.json({backups:await db.listRestaurantBackups(req.params.slug)})}catch(e){sendDbError(res,e,req,'Não foi possível listar backups.','Erro ao listar backups',{restaurantSlug:req.params.slug});}});
app.post('/api/:slug/backups/:id/restore', requireAdmin, requireOwnRestaurant, async(req,res)=>{let safety=null;try{const slug=req.params.slug;const b=await db.getRestaurantBackup(slug,req.params.id);if(!b)return res.status(404).json({error:'Backup não encontrado.'});const [data]=await Promise.all([db.readRestaurantData(slug)]);safety=await db.createRestaurantBackup(slug,{restaurantConfig:data.restaurantConfig,categories:data.categories||[],menuItems:data.menuItems||[],orders:[],media:[],exportedAt:new Date().toISOString(),safetyBackup:true},req.adminUser?.id||'master');const p=b.payload||{};if(p.restaurantConfig)await db.updateConfig(slug,p.restaurantConfig);if(Array.isArray(p.categories))await db.updateCategories(slug,p.categories);if(Array.isArray(p.menuItems))await db.updateMenuItems(slug,p.menuItems);broadcastOrderEvent(slug,{type:'config-updated',updatedAt:new Date().toISOString()});broadcastOrderEvent(slug,{type:'menu-updated',updatedAt:new Date().toISOString()});res.json({ok:true,safetyBackupId:safety?.id||null,message:'Configuração e cardápio restaurados com backup de segurança criado antes da operação.'})}catch(e){sendDbError(res,e,req,'Não foi possível restaurar o backup.','Restore falhou',{restaurantSlug:req.params.slug});}});
app.get('/api/:slug/drivers', requireAdmin, requireOwnRestaurant, async(req,res)=>{try{const d=(await db.readRestaurantData(req.params.slug)).restaurantConfig?.drivers||[];res.json({drivers:d})}catch(e){sendDbError(res,e,req,'Não foi possível carregar entregadores.','Erro ao carregar entregadores',{restaurantSlug:req.params.slug});}});
app.post('/api/:slug/drivers', requireAdmin, requireOwnRestaurant, async(req,res)=>{try{const data=await db.readRestaurantData(req.params.slug);const cfg=data.restaurantConfig||{};const d={id:crypto.randomUUID(),name:String(req.body?.name||'').trim(),phone:String(req.body?.phone||'').trim(),vehicle:String(req.body?.vehicle||'moto'),plate:String(req.body?.plate||'').trim(),photo:req.body?.photo||'',status:['available','busy','offline'].includes(req.body?.status)?req.body.status:'offline',rating:Number(req.body?.rating)||0};if(!d.name||!d.phone)return res.status(400).json({error:'Nome e telefone são obrigatórios.'});cfg.drivers=[...(cfg.drivers||[]),d];await db.updateConfig(req.params.slug,{drivers:cfg.drivers});res.status(201).json({driver:d})}catch(e){sendDbError(res,e,req,'Não foi possível criar entregador.','Erro ao criar entregador',{restaurantSlug:req.params.slug});}});
app.patch('/api/:slug/drivers/:id', requireAdmin, requireOwnRestaurant, async(req,res)=>{try{const data=await db.readRestaurantData(req.params.slug);const list=data.restaurantConfig?.drivers||[];const i=list.findIndex(x=>x.id===req.params.id);if(i<0)return res.status(404).json({error:'Entregador não encontrado.'});list[i]={...list[i],...req.body,id:list[i].id};await db.updateConfig(req.params.slug,{drivers:list});res.json({driver:list[i]})}catch(e){sendDbError(res,e,req,'Não foi possível atualizar entregador.','Erro ao atualizar entregador',{restaurantSlug:req.params.slug});}});
app.delete('/api/:slug/drivers/:id', requireAdmin, requireOwnRestaurant, async(req,res)=>{try{const data=await db.readRestaurantData(req.params.slug);const list=data.restaurantConfig?.drivers||[];const next=list.filter(x=>x.id!==req.params.id);if(next.length===list.length)return res.status(404).json({error:'Entregador não encontrado.'});await db.updateConfig(req.params.slug,{drivers:next});res.json({ok:true})}catch(e){sendDbError(res,e,req,'Não foi possível remover entregador.','Erro ao remover entregador',{restaurantSlug:req.params.slug});}});
app.patch('/api/:slug/orders/:id/payment', requireAdmin, requireOwnRestaurant, async(req,res)=>{try{const order=await db.getOrder(req.params.slug,req.params.id);if(!order)return res.status(404).json({error:'Pedido não encontrado.'});const status=['pendente','confirmado','recusado','reembolsado'].includes(req.body?.paymentStatus)?req.body.paymentStatus:null;if(!status)return res.status(400).json({error:'Status de pagamento inválido.'});const expectedUpdatedAt=req.body?.expectedUpdatedAt;const updated=await db.updateOrder(req.params.slug,req.params.id,{paymentStatus:status,paymentConfirmedAt:status==='confirmado'?new Date().toISOString():order.paymentConfirmedAt},expectedUpdatedAt);broadcastOrderEvent(req.params.slug,{type:'updated',orderId:updated.id,updatedAt:updated.updatedAt,customerId:updated.customerId||null});res.json({ok:true,order:updated})}catch(e){if(e?.code==='ORDER_CONFLICT')return res.status(409).json({error:e.message,order:e.currentOrder,code:e.code});logServerError('Erro ao atualizar pagamento',e,{restaurantSlug:req.params.slug,details:{requestId:req.requestId}});res.status(500).json({error:'Não foi possível atualizar o pagamento.'})}});
app.post('/api/admin/logout',(req,res)=>{const t=bearerToken(req);if(t){const p=verifySession(t);revokeSession(t,p?.exp)}res.json({ok:true})});
app.post('/api/customers/logout',(req,res)=>{const t=bearerToken(req);if(t){const p=verifySession(t);revokeSession(t,p?.exp)}res.json({ok:true})});

// Em produção, o mesmo processo também serve os arquivos estáticos de dist/
if (existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
  app.get(/^(?!\/api|\/uploads).*/, (req, res) => {
    res.sendFile(path.join(DIST_DIR, 'index.html'));
  });
}

// Última barreira: erros de JSON/middleware nunca devem virar HTML genérico.
// Mantém o diagnóstico correlacionado ao request e evita vazar stack em produção.
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  const requestId = req.requestId || req.get?.('x-request-id') || crypto.randomUUID();
  logServerError('Erro não tratado na API', err, { details: { requestId, method: req.method, path: req.path } });
  const parseError = err?.type === 'entity.parse.failed';
  res.status(parseError ? 400 : 500).json({
    error: parseError ? 'JSON inválido na requisição.' : 'Erro interno do servidor.',
    requestId,
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Servidor multicardápio rodando na porta ${PORT} — backend de dados: ${db.backendName}`);
  if (db.backendName === 'json' && !process.env.ADMIN_PASSWORD) {
    console.log('⚠️  ADMIN_PASSWORD não definido — usando senha padrão "admin123". Configure isso no Render em produção.');
  }
});
