import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { mkdir, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import * as db from './lib/db.js';
import { mediaStorageMode, saveImage, removeStoredImage } from './lib/mediaStorage.js';
import { hashPassword, verifyPassword } from './lib/passwords.js';
import { sanitizePermissions } from './lib/permissions.js';
import { getVapidPublicKey, sendPushToMany } from './lib/webPush.js';
import { isCampaignDueNow, currentWindowKey } from './lib/campaignScheduler.js';
import { buildRestaurantContext, buildOrderContext } from './lib/aiContext.js';
import { generateChatReply, generateCampaignSuggestion, generateSalesAnalysis, isAiConfigured } from './lib/aiAssistant.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'data');
const DIST_DIR = path.join(__dirname, '..', 'dist');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');

async function logServerError(context, err, meta = {}) {
  const message = err?.message || String(err || 'Erro desconhecido');
  try { await db.createErrorLog({ context, message, stack: err?.stack || null, restaurantSlug: meta.restaurantSlug || null, details: meta.details || {} }); }
  catch (logErr) { process.stderr.write(`[error-log-failed] ${logErr?.message || logErr}\n`); }
  process.stderr.write(`[${context}] ${message}\n`);
}


// Senha única do super-admin. Em produção, defina ADMIN_PASSWORD nas variáveis
// de ambiente do Render. Em desenvolvimento local, usa "admin123" por padrão.
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

// Tokens de sessão do admin ficam em memória (somem se o servidor reiniciar,
// então o admin só precisa logar de novo — nada grave).
//
// Fase 4 (itens 17-19): cada token agora guarda também QUEM logou.
// userId === null → login mestre (senha única ADMIN_PASSWORD, comportamento
// de sempre, acesso total, nada muda pra quem já usa isso). userId
// preenchido → usuário individual, com permissões e restaurante próprios
// (ver server/lib/permissions.js e requirePermission/requireOwnRestaurant
// abaixo).
const adminTokens = new Map(); // token -> { expiresAt, userId }
const TOKEN_TTL_MS = 12 * 60 * 60 * 1000; // 12 horas

function issueToken(userId = null) {
  const token = crypto.randomBytes(24).toString('hex');
  adminTokens.set(token, { expiresAt: Date.now() + TOKEN_TTL_MS, userId });
  return token;
}

function getTokenSession(token) {
  if (!token) return null;
  const session = adminTokens.get(token);
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    adminTokens.delete(token);
    return null;
  }
  return session;
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
      adminTokens.delete(token);
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

// ---------- Sessão do CLIENTE final (Fase 4, itens 20-22) ----------
// Autenticação separada da do painel (adminTokens) — token mais duradouro
// (cliente não quer logar de novo a cada pedido) e sem nenhuma noção de
// permissão/restaurante: uma conta de cliente é global à plataforma.
const customerTokens = new Map(); // token -> { expiresAt, customerId }
const CUSTOMER_TOKEN_TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 dias

function issueCustomerToken(customerId) {
  const token = crypto.randomBytes(24).toString('hex');
  customerTokens.set(token, { expiresAt: Date.now() + CUSTOMER_TOKEN_TTL_MS, customerId });
  return token;
}

function getCustomerSession(token) {
  if (!token) return null;
  const session = customerTokens.get(token);
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    customerTokens.delete(token);
    return null;
  }
  return session;
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
app.use(cors());

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

// ---------- Upload de fotos (logo, banner, splash, pratos, entregadores) ----------
// Fica em memória (multer.memoryStorage) em vez de ir direto pro disco — o
// arquivo só é gravado em algum lugar DEPOIS de decidirmos o destino:
//   • CLOUDINARY_* configurado (produção/Render): sobe pro Cloudinary,
//     nunca toca o disco local, URL retornada é https permanente.
//   • Sem Cloudinary configurado (dev local sem conta): cai automaticamente
//     pro disco local de sempre (server/data/uploads/<slug>/...), exatamente
//     como funcionava antes — mesmo padrão de fallback automático já usado
//     pro Supabase neste projeto (server/lib/db.js).
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
async function saveImageToDisk(file, slug) {
  const dir = path.join(UPLOADS_DIR, slug);
  await mkdir(dir, { recursive: true });
  const filename = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${safeImageExt(file.originalname)}`;
  await writeFile(path.join(dir, filename), file.buffer);
  return `/uploads/${slug}/${filename}`;
}

// Serve as fotos enviadas localmente (fallback sem Cloudinary, e qualquer
// URL /uploads/... antiga já salva antes desta migração continua funcionando).
app.use('/uploads', express.static(UPLOADS_DIR));

// ---------- Rotas públicas ----------

app.post('/api/client-errors', async (req,res)=>{try{const message=String(req.body?.message||'Erro de cliente').slice(0,1000);await db.createErrorLog({level:'client',context:'frontend',message,details:req.body?.details||{}});res.status(204).end()}catch{res.status(204).end()}});
app.get('/api/pwa/manifest', async (req,res)=>{ try{const slug=String(req.query.slug||'').trim();if(!slug||!(await db.restaurantExists(slug)))return res.status(404).json({error:'Restaurante não encontrado.'});const data=await db.readRestaurantData(slug);const cfg=data.restaurantConfig||{};res.set('Cache-Control','no-store');res.json({name:cfg.name||slug,short_name:cfg.name||slug,start_url:`/r/${slug}`,scope:`/r/${slug}/`,display:'standalone',background_color:'#070908',theme_color:cfg.color||'#c9a227',description:cfg.tagline||'Delivery',icons:[{src:cfg.logo||'/tokioinbox-mark.svg',sizes:'512x512',type:cfg.logo?'image/png':'image/svg+xml',purpose:'any maskable'}]});}catch(err){logServerError('Erro ao gerar manifesto PWA',err);res.status(500).json({error:'Não foi possível gerar o aplicativo.'})} });

app.get('/api/health', (req, res) => res.json({ ok: true, dataBackend: db.backendName }));

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
    res.json(data);
  } catch (err) {
    logServerError(`Erro ao ler cardápio de ${slug}:`, err);
    res.status(500).json({ error: 'Não foi possível carregar o cardápio.' });
  }
});

// Cliente cria um pedido (não precisa de login)
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
    if (!order || !order.id) {
      return res.status(400).json({ error: 'Pedido inválido.' });
    }
    // Vincula o pedido ao cliente logado (item 20/22) — nunca confia num
    // customerId enviado pelo corpo da requisição, sempre deriva do token.
    // Pedido de visitante sem conta continua funcionando normalmente
    // (customerId fica undefined, exatamente como sempre foi).
    const session = getCustomerSession(bearerToken(req));
    order.customerId = session ? session.customerId : undefined;
    const saved = await db.createOrder(slug, order);
    res.status(201).json({ ok: true, order: saved });
  } catch (err) {
    logServerError(`Erro ao salvar pedido de ${slug}:`, err);
    res.status(500).json({ error: 'Não foi possível registrar o pedido.' });
  }
});

// ---------- Contas de cliente + endereços salvos (Fase 4, itens 20-22) ----------

app.post('/api/customers/register', async (req, res) => {
  const { name, phone, email, password } = req.body || {};
  const cleanPhone = String(phone || '').replace(/\D/g, '');
  const cleanEmail = email ? String(email).trim().toLowerCase() : null;
  if (!name || !cleanPhone || !password) {
    return res.status(400).json({ error: 'Nome, telefone e senha são obrigatórios.' });
  }
  try {
    const passwordHash = await hashPassword(password);
    const customer = await db.createCustomer({ name: String(name).trim(), phone: cleanPhone, email: cleanEmail, passwordHash });
    res.status(201).json({ token: issueCustomerToken(customer.id), customer: publicCustomer(customer) });
  } catch (err) {
    if (err.code === 'PHONE_TAKEN') {
      return res.status(409).json({ error: 'Já existe uma conta com esse telefone.' });
    }
    logServerError('Erro ao criar conta de cliente', err);
    if (err.code === '42P01' || /relation .*customers.* does not exist/i.test(String(err.message || ''))) return res.status(503).json({ error: 'O cadastro de clientes ainda não foi ativado no banco. Execute a migração 0013_customers.sql.' });
    res.status(500).json({ error: 'Não foi possível criar a conta. Verifique os dados e tente novamente.' });
  }
});

app.post('/api/customers/login', async (req, res) => {
  const { phone, password } = req.body || {};
  const cleanPhone = String(phone || '').replace(/\D/g, '');
  if (!cleanPhone || !password) {
    return res.status(400).json({ error: 'Informe telefone e senha.' });
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
  if (newPassword) patch.passwordHash = await hashPassword(newPassword);
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

app.post('/api/admin/login', (req, res) => {
  const { password } = req.body || {};
  if (password !== ADMIN_PASSWORD) {
    void db.createAdminLoginLog({login:'master',success:false,mode:'master',ip:req.ip,userAgent:req.get('user-agent'),details:{reason:'invalid_password'}}).catch(()=>{});
    return res.status(401).json({ error: 'Senha incorreta.' });
  }
  void db.createAdminLoginLog({login:'master',success:true,mode:'master',ip:req.ip,userAgent:req.get('user-agent')}).catch(()=>{});
  res.json({ token: issueToken() });
});

// Login individual (Fase 4, item 17) — login + senha de um usuário criado
// pelo super-admin em /api/admin/users. Convive com o login mestre acima
// sem substituí-lo: a tela de login do painel pode continuar usando a senha
// única, ou usar login+senha de um usuário específico.
app.post('/api/admin/users/login', async (req, res) => {
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
      logServerError('Tabela admin_users ausente. Execute supabase/migrations/0012_admin_users.sql no Supabase.');
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
    // Atualização segura: faz MERGE com a configuração já salva deste restaurante
    // (tanto no backend JSON quanto no Supabase), em vez de substituir tudo —
    // um payload incompleto nunca apaga silenciosamente campos que não vieram.
    const merged = await db.updateConfig(slug, incoming);
    res.json({ ok: true, restaurantConfig: merged });
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
app.get('/api/:slug/orders', requireAdmin, requireOwnRestaurant, async (req, res) => {
  const { slug } = req.params;
  if (!(await db.restaurantExists(slug))) return res.status(404).json({ error: 'Restaurante não encontrado.' });
  try {
    res.json(await db.listOrders(slug));
  } catch (err) {
    logServerError(`Erro ao listar pedidos de ${slug}:`, err);
    res.status(500).json({ error: 'Não foi possível carregar os pedidos.' });
  }
});

// Exclusão consciente: somente histórico finalizado/cancelado.
app.delete('/api/:slug/orders/:id', requireAdmin, requireOwnRestaurant, async (req,res)=>{ const {slug,id}=req.params; if(!hasPermission(req,'gerenciar_historico')&&!req.adminUser?.isMaster)return res.status(403).json({error:'Você não tem permissão para excluir histórico.'}); try{const existing=await db.getOrder(slug,id);if(!existing)return res.status(404).json({error:'Pedido não encontrado.'});if(!['entregue','cancelado'].includes(existing.status))return res.status(409).json({error:'Só pedidos finalizados ou cancelados podem ser excluídos.'});const order=await db.deleteOrder(slug,id);res.json({ok:true,order});}catch(err){logServerError(`Erro ao excluir pedido ${slug}/${id}`,err,{restaurantSlug:slug});res.status(500).json({error:'Não foi possível excluir o pedido.'});} });
app.delete('/api/:slug/orders/history', requireAdmin, requireOwnRestaurant, async (req,res)=>{ const {slug}=req.params; if(!hasPermission(req,'gerenciar_historico')&&!req.adminUser?.isMaster)return res.status(403).json({error:'Você não tem permissão para excluir histórico.'}); try{const result=await db.clearFinishedOrders(slug);res.json({ok:true,...result});}catch(err){logServerError(`Erro ao limpar histórico ${slug}`,err,{restaurantSlug:slug});res.status(500).json({error:'Não foi possível limpar o histórico.'});} });

// Admin atualiza um pedido (status, entregador, etc)
app.patch('/api/:slug/orders/:id', requireAdmin, requireOwnRestaurant, async (req, res) => {
  const { slug, id } = req.params;
  if (!(await db.restaurantExists(slug))) return res.status(404).json({ error: 'Restaurante não encontrado.' });
  // Cancelamento é uma ação sensível (item 18/23-25): exige a permissão
  // específica, mesmo que o usuário já tenha acesso de escrita ao pedido.
  // Login mestre continua com acesso total, sem mudança de comportamento.
  if (req.body?.status === 'cancelado' && !hasPermission(req, 'cancelar_pedido')) {
    return res.status(403).json({ error: 'Você não tem permissão para cancelar pedidos.' });
  }
  try {
    const order = await db.updateOrder(slug, id, req.body);
    if (!order) return res.status(404).json({ error: 'Pedido não encontrado.' });
    res.json({ ok: true, order });
  } catch (err) {
    logServerError(`Erro ao atualizar pedido de ${slug}:`, err);
    res.status(500).json({ error: 'Não foi possível atualizar o pedido.' });
  }
});

// Em produção, o mesmo processo também serve os arquivos estáticos de dist/
if (existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
  app.get(/^(?!\/api|\/uploads).*/, (req, res) => {
    res.sendFile(path.join(DIST_DIR, 'index.html'));
  });
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Servidor multicardápio rodando na porta ${PORT} — backend de dados: ${db.backendName}`);
  if (db.backendName === 'json' && !process.env.ADMIN_PASSWORD) {
    console.log('⚠️  ADMIN_PASSWORD não definido — usando senha padrão "admin123". Configure isso no Render em produção.');
  }
});
