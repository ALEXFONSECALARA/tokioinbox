// Backend de dados em arquivos JSON — é exatamente a lógica que já existia
// em server/index.js antes da Fase 2, só movida pra cá sem NENHUMA mudança
// de comportamento. Continua sendo o fallback automático quando o Supabase
// não está configurado (ver server/lib/db.js e server/lib/supabaseClient.js).
import path from 'path';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';
import { readFile, writeFile, mkdir } from 'fs/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const RESTAURANTS_FILE = path.join(DATA_DIR, 'restaurants.json');
const PLATFORM_FILE = path.join(DATA_DIR, 'platform.json');
const ADMIN_USERS_FILE = path.join(DATA_DIR, 'admin-users.json');
const CUSTOMERS_FILE = path.join(DATA_DIR, 'customers.json');
const CUSTOMER_ADDRESSES_FILE = path.join(DATA_DIR, 'customer-addresses.json');
const ADMIN_LOGIN_LOGS_FILE = path.join(DATA_DIR, 'admin-login-logs.json');
const ERROR_LOGS_FILE = path.join(DATA_DIR, 'error-logs.json');

const DEFAULT_PLATFORM_SETTINGS = {
  landingTitle: 'Escolha seu restaurante',
  landingSubtitle: 'Cada loja tem seu próprio cardápio e pedidos',
  landingLayout: 'galeria-gourmet',
};

async function readJson(filePath, fallback) {
  try {
    const raw = await readFile(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT' && fallback !== undefined) return fallback;
    throw err;
  }
}

async function writeJson(filePath, data) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

function menuPath(slug) {
  return path.join(DATA_DIR, 'restaurants', slug, 'menu.json');
}
function configPath(slug) {
  return path.join(DATA_DIR, 'restaurants', slug, 'config.json');
}
function ordersPath(slug) {
  return path.join(DATA_DIR, 'restaurants', slug, 'orders.json');
}

// Lista bruta (todos os restaurantes, ativos ou não) já enriquecida com os
// campos de identidade visual do config.json de cada um. Uso interno — as
// funções públicas abaixo decidem o que filtrar pra cada consumidor.
async function getAllRestaurantsRaw() {
  const list = await readJson(RESTAURANTS_FILE, []);
  return Promise.all(
    list.map(async (r) => {
      const config = await readJson(configPath(r.slug), null);
      // `active` mora em restaurants.json (lista mestre do super-admin), não
      // no config.json de cada restaurante — restaurantes antigos sem o campo
      // são tratados como ativos (default true), nunca somem silenciosamente.
      const active = r.active !== false;
      if (!config) return { ...r, active };
      return {
        slug: r.slug,
        publicSlug: (config?.name || r.name || r.slug).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'') || r.slug,
        name: config.name || r.name,
        emoji: r.emoji,
        color: config.color || r.color,
        secondaryColor: config.secondaryColor,
        tagline: config.tagline,
        logo: config.logo,
        bannerImage: config.bannerImage,
        bannerPositionX: config.bannerPositionX,
        bannerPositionY: config.bannerPositionY,
        bannerZoom: config.bannerZoom,
        layout: config.layout,
        active,
      };
    })
  );
}

// Lista pública (vitrine "/"): só restaurantes ativos. O super-admin usa
// getRestaurantsAdmin() pra ver todos, inclusive os desativados.
export async function getRestaurants() {
  const all = await getAllRestaurantsRaw();
  return all.filter((r) => r.active);
}

export async function getRestaurantsAdmin() {
  return getAllRestaurantsRaw();
}

export async function setRestaurantActive(slug, active) {
  const list = await readJson(RESTAURANTS_FILE, []);
  const idx = list.findIndex((r) => r.slug === slug);
  if (idx === -1) return null;
  list[idx] = { ...list[idx], active: !!active };
  await writeJson(RESTAURANTS_FILE, list);
  const all = await getAllRestaurantsRaw();
  return all.find((r) => r.slug === slug) || null;
}

// Existência bruta (ignora ativo/inativo) — usada pelas rotas de admin e de
// leitura de cardápio, que precisam continuar funcionando pra um restaurante
// desativado (o admin ainda edita/reativa; só a vitrine e novos pedidos são
// bloqueados). Quem precisa saber "posso vender aqui agora?" usa
// restaurantIsActive(slug) separadamente.
export async function restaurantExists(slug) {
  const list = await readJson(RESTAURANTS_FILE, []);
  return list.some((r) => r.slug === slug);
}

export async function restaurantIsActive(slug) {
  const list = await readJson(RESTAURANTS_FILE, []);
  const entry = list.find((r) => r.slug === slug);
  if (!entry) return false;
  return entry.active !== false;
}

export async function readRestaurantData(slug) {
  const [menu, config, active] = await Promise.all([
    readJson(menuPath(slug), { menuItems: [], categories: [] }),
    readJson(configPath(slug), null),
    restaurantIsActive(slug),
  ]);
  return {
    menuItems: menu.menuItems || [],
    categories: menu.categories || [],
    // `active` (ativo/inativo no super-admin) é injetado aqui em vez de
    // morar no config.json — assim o cardápio do cliente sabe se deve
    // bloquear pedidos sem o admin precisar duplicar o campo em dois lugares.
    restaurantConfig: config ? { ...config, active } : config,
  };
}

export async function listOrders(slug) {
  const orders = await readJson(ordersPath(slug), []);
  return orders.map((order) => ({ ...order, restaurantSlug: slug }));
}

export async function getOrder(slug, id) {
  const orders = await readJson(ordersPath(slug), []);
  const order = orders.find((o) => o.id === id) || null;
  return order ? { ...order, restaurantSlug: slug } : null;
}

export async function createOrder(slug, order) {
  const orders = await readJson(ordersPath(slug), []);
  orders.unshift({ ...order, restaurantSlug: slug, updatedAt: order.updatedAt || order.createdAt || new Date().toISOString() });
  await writeJson(ordersPath(slug), orders);
  return order;
}

export async function deleteOrder(slug, id) {
  const orders = await readJson(ordersPath(slug), []);
  const idx = orders.findIndex((o) => o.id === id);
  if (idx === -1) return null;
  const [removed] = orders.splice(idx, 1);
  await writeJson(ordersPath(slug), orders);
  return removed;
}

export async function clearFinishedOrders(slug) {
  const orders = await readJson(ordersPath(slug), []);
  const kept = orders.filter((o) => !['entregue', 'cancelado'].includes(o.status));
  const removed = orders.length - kept.length;
  if (removed) await writeJson(ordersPath(slug), kept);
  return { removed };
}

export async function updateOrder(slug, id, patch, expectedUpdatedAt) {
  const orders = await readJson(ordersPath(slug), []);
  const idx = orders.findIndex((o) => o.id === id);
  if (idx === -1) return null;
  const current = orders[idx];
  if (expectedUpdatedAt && current.updatedAt && current.updatedAt !== expectedUpdatedAt) {
    const err = new Error('Pedido foi alterado em outro dispositivo.');
    err.code = 'ORDER_CONFLICT';
    err.currentOrder = current;
    throw err;
  }
  const next = { ...current, ...patch, id: current.id, updatedAt: new Date().toISOString() };
  if (patch.status && patch.status !== current.status && !patch.statusHistory) {
    next.statusHistory = [
      ...(Array.isArray(current.statusHistory) ? current.statusHistory : []),
      { status: patch.status, timestamp: next.updatedAt, note: patch.status === 'cancelado' ? (patch.cancelReason || 'Cancelado pelo restaurante') : undefined },
    ];
  }
  orders[idx] = next;
  await writeJson(ordersPath(slug), orders);
  return orders[idx];
}

export async function updateMenuItems(slug, menuItems) {
  const menu = await readJson(menuPath(slug), { menuItems: [], categories: [] });
  menu.menuItems = menuItems;
  await writeJson(menuPath(slug), menu);
  return menuItems;
}

export async function updateCategories(slug, categories) {
  const menu = await readJson(menuPath(slug), { menuItems: [], categories: [] });
  menu.categories = categories;
  await writeJson(menuPath(slug), menu);
  return categories;
}

// ---------- Vitrine principal "/" (config global, não por restaurante) ----------

export async function getPlatformSettings() {
  const saved = await readJson(PLATFORM_FILE, {});
  return { ...DEFAULT_PLATFORM_SETTINGS, ...saved };
}

export async function updatePlatformSettings(incoming) {
  const existing = await readJson(PLATFORM_FILE, DEFAULT_PLATFORM_SETTINGS);
  const merged = { ...existing, ...incoming };
  await writeJson(PLATFORM_FILE, merged);
  return merged;
}

export async function updateConfig(slug, incoming) {
  // Merge, não substituição — mesma regra de segurança que já existia:
  // um payload incompleto nunca apaga silenciosamente campos que faltaram.
  const existing = await readJson(configPath(slug), {});
  const merged = { ...existing, ...incoming };
  await writeJson(configPath(slug), merged);
  return merged;
}

// ---------- Usuários do painel + permissões granulares (Fase 4, itens 17-19) ----------

export async function listAdminUsers() {
  return readJson(ADMIN_USERS_FILE, []);
}

export async function getAdminUserByLogin(login) {
  const users = await readJson(ADMIN_USERS_FILE, []);
  return users.find((u) => u.login === login) || null;
}

export async function getAdminUserById(id) {
  const users = await readJson(ADMIN_USERS_FILE, []);
  return users.find((u) => u.id === id) || null;
}

export async function createAdminUser({ name, login, passwordHash, restaurantSlug, role, permissions }) {
  const users = await readJson(ADMIN_USERS_FILE, []);
  if (users.some((u) => u.login === login)) {
    const err = new Error('Já existe um usuário com esse login.');
    err.code = 'LOGIN_TAKEN';
    throw err;
  }
  const now = new Date().toISOString();
  const user = {
    id: randomUUID(),
    name,
    login,
    passwordHash,
    restaurantSlug: restaurantSlug || null,
    role: role || 'operador',
    active: true,
    permissions: permissions || {},
    createdAt: now,
    updatedAt: now,
  };
  users.push(user);
  await writeJson(ADMIN_USERS_FILE, users);
  return user;
}

export async function updateAdminUser(id, patch) {
  const users = await readJson(ADMIN_USERS_FILE, []);
  const idx = users.findIndex((u) => u.id === id);
  if (idx === -1) return null;
  users[idx] = { ...users[idx], ...patch, id: users[idx].id, updatedAt: new Date().toISOString() };
  await writeJson(ADMIN_USERS_FILE, users);
  return users[idx];
}

// ---------- Auditoria e logs administrativos ----------
export async function createAdminLoginLog(entry) { const logs=await readJson(ADMIN_LOGIN_LOGS_FILE,[]); logs.unshift({id:randomUUID(),createdAt:new Date().toISOString(),...entry}); await writeJson(ADMIN_LOGIN_LOGS_FILE,logs.slice(0,500)); }
export async function listAdminLoginLogs(limit=100) { const logs=await readJson(ADMIN_LOGIN_LOGS_FILE,[]); return logs.slice(0,Math.min(Number(limit)||100,500)); }
export async function clearAdminLoginLogs() { await writeJson(ADMIN_LOGIN_LOGS_FILE,[]); return true; }
export async function deleteAdminLoginLog(id) { const logs=await readJson(ADMIN_LOGIN_LOGS_FILE,[]); const idx=logs.findIndex(x=>x.id===id); if(idx<0)return null; const [r]=logs.splice(idx,1); await writeJson(ADMIN_LOGIN_LOGS_FILE,logs); return r; }
export async function createErrorLog(entry) { const logs=await readJson(ERROR_LOGS_FILE,[]); logs.unshift({id:randomUUID(),createdAt:new Date().toISOString(),...entry}); await writeJson(ERROR_LOGS_FILE,logs.slice(0,500)); }
export async function listErrorLogs(limit=100) { const logs=await readJson(ERROR_LOGS_FILE,[]); return logs.slice(0,Math.min(Number(limit)||100,500)); }
export async function clearErrorLogs() { await writeJson(ERROR_LOGS_FILE,[]); return true; }
export async function deleteErrorLog(id) { const logs=await readJson(ERROR_LOGS_FILE,[]); const idx=logs.findIndex(x=>x.id===id); if(idx<0)return null; const [r]=logs.splice(idx,1); await writeJson(ERROR_LOGS_FILE,logs); return r; }

// ---------- Contas de cliente + endereços salvos (Fase 4, itens 20-22) ----------

export async function createCustomer({ name, phone, email, passwordHash }) {
  const customers = await readJson(CUSTOMERS_FILE, []);
  if (customers.some((c) => c.phone === phone)) {
    const err = new Error('Já existe uma conta com esse telefone.');
    err.code = 'PHONE_TAKEN';
    throw err;
  }
  const now = new Date().toISOString();
  const customer = {
    id: randomUUID(),
    name,
    phone,
    email: email || null,
    passwordHash,
    createdAt: now,
    updatedAt: now,
  };
  customers.push(customer);
  await writeJson(CUSTOMERS_FILE, customers);
  return customer;
}

export async function listCustomers() {
  const customers = await readJson(CUSTOMERS_FILE, []);
  return [...customers].sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function deleteCustomer(id) {
  const customers = await readJson(CUSTOMERS_FILE, []);
  const idx = customers.findIndex(c => c.id === id);
  if (idx === -1) return null;
  const [deleted] = customers.splice(idx, 1);
  await writeJson(CUSTOMERS_FILE, customers);
  const addresses = await readJson(CUSTOMER_ADDRESSES_FILE, []);
  await writeJson(CUSTOMER_ADDRESSES_FILE, addresses.filter(a => a.customerId !== id));
  return deleted;
}

export async function getCustomerByPhone(phone) {
  const customers = await readJson(CUSTOMERS_FILE, []);
  return customers.find((c) => c.phone === phone) || null;
}

export async function getCustomerById(id) {
  const customers = await readJson(CUSTOMERS_FILE, []);
  return customers.find((c) => c.id === id) || null;
}

export async function updateCustomer(id, patch) {
  const customers = await readJson(CUSTOMERS_FILE, []);
  const idx = customers.findIndex((c) => c.id === id);
  if (idx === -1) return null;
  customers[idx] = { ...customers[idx], ...patch, id: customers[idx].id, updatedAt: new Date().toISOString() };
  await writeJson(CUSTOMERS_FILE, customers);
  return customers[idx];
}

export async function listCustomerAddresses(customerId) {
  const addresses = await readJson(CUSTOMER_ADDRESSES_FILE, []);
  return addresses.filter((a) => a.customerId === customerId);
}

export async function createCustomerAddress(customerId, data) {
  const addresses = await readJson(CUSTOMER_ADDRESSES_FILE, []);
  const address = { id: randomUUID(), customerId, ...data, createdAt: new Date().toISOString() };
  addresses.push(address);
  await writeJson(CUSTOMER_ADDRESSES_FILE, addresses);
  return address;
}

export async function updateCustomerAddress(id, customerId, patch) {
  const addresses = await readJson(CUSTOMER_ADDRESSES_FILE, []);
  const idx = addresses.findIndex((a) => a.id === id && a.customerId === customerId);
  if (idx === -1) return null;
  addresses[idx] = { ...addresses[idx], ...patch, id: addresses[idx].id, customerId };
  await writeJson(CUSTOMER_ADDRESSES_FILE, addresses);
  return addresses[idx];
}

export async function deleteCustomerAddress(id, customerId) {
  const addresses = await readJson(CUSTOMER_ADDRESSES_FILE, []);
  const idx = addresses.findIndex((a) => a.id === id && a.customerId === customerId);
  if (idx === -1) return false;
  addresses.splice(idx, 1);
  await writeJson(CUSTOMER_ADDRESSES_FILE, addresses);
  return true;
}

// Histórico entre restaurantes (item 22) — no backend JSON, cada restaurante
// tem seu próprio arquivo de pedidos, então varremos a lista de restaurantes
// e juntamos os que pertencem a este cliente.
export async function listCustomerOrders(customerId) {
  const restaurants = await readJson(RESTAURANTS_FILE, []);
  const results = [];
  for (const r of restaurants) {
    const orders = await readJson(ordersPath(r.slug), []);
    for (const o of orders) {
      if (o.customerId === customerId) {
        results.push({ ...o, restaurantSlug: r.slug, restaurantName: r.name });
      }
    }
  }
  results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return results;
}

// ---------- Notificações push + campanhas automáticas (Fase 4, itens 27-30) ----------

const PUSH_SUBSCRIPTIONS_FILE = path.join(DATA_DIR, 'push-subscriptions.json');
const NOTIFICATION_CAMPAIGNS_FILE = path.join(DATA_DIR, 'notification-campaigns.json');

export async function createPushSubscription({ restaurantSlug, customerId, endpoint, p256dh, auth }) {
  const subs = await readJson(PUSH_SUBSCRIPTIONS_FILE, []);
  const existingIdx = subs.findIndex((s) => s.endpoint === endpoint);
  const record = {
    id: existingIdx >= 0 ? subs[existingIdx].id : randomUUID(),
    restaurantSlug,
    customerId: customerId || null,
    endpoint,
    p256dh,
    auth,
    createdAt: new Date().toISOString(),
  };
  if (existingIdx >= 0) subs[existingIdx] = record;
  else subs.push(record);
  await writeJson(PUSH_SUBSCRIPTIONS_FILE, subs);
  return record;
}

export async function deletePushSubscriptionByEndpoint(endpoint) {
  const subs = await readJson(PUSH_SUBSCRIPTIONS_FILE, []);
  const filtered = subs.filter((s) => s.endpoint !== endpoint);
  await writeJson(PUSH_SUBSCRIPTIONS_FILE, filtered);
  return filtered.length !== subs.length;
}

export async function deletePushSubscriptionsByIds(ids) {
  if (!ids || ids.length === 0) return;
  const idSet = new Set(ids);
  const subs = await readJson(PUSH_SUBSCRIPTIONS_FILE, []);
  await writeJson(PUSH_SUBSCRIPTIONS_FILE, subs.filter((s) => !idSet.has(s.id)));
}

export async function listPushSubscriptions(restaurantSlug, { onlyCustomers = false } = {}) {
  const subs = await readJson(PUSH_SUBSCRIPTIONS_FILE, []);
  return subs.filter((s) => s.restaurantSlug === restaurantSlug && (!onlyCustomers || Boolean(s.customerId)));
}

export async function listNotificationCampaigns(restaurantSlug) {
  const campaigns = await readJson(NOTIFICATION_CAMPAIGNS_FILE, []);
  return campaigns.filter((c) => c.restaurantSlug === restaurantSlug);
}

// Usado pelo agendador (varre TODAS as campanhas ativas de TODOS os
// restaurantes a cada tick, não só de um restaurante por vez).
export async function listAllActiveCampaigns() {
  const campaigns = await readJson(NOTIFICATION_CAMPAIGNS_FILE, []);
  return campaigns.filter((c) => c.active);
}

export async function createNotificationCampaign(restaurantSlug, data) {
  const campaigns = await readJson(NOTIFICATION_CAMPAIGNS_FILE, []);
  const campaign = {
    id: randomUUID(),
    restaurantSlug,
    active: true,
    lastSentAt: null,
    lastSentWindow: null,
    createdAt: new Date().toISOString(),
    ...data,
  };
  campaigns.push(campaign);
  await writeJson(NOTIFICATION_CAMPAIGNS_FILE, campaigns);
  return campaign;
}

export async function getNotificationCampaignById(id) {
  const campaigns = await readJson(NOTIFICATION_CAMPAIGNS_FILE, []);
  return campaigns.find((c) => c.id === id) || null;
}

export async function updateNotificationCampaign(id, patch) {
  const campaigns = await readJson(NOTIFICATION_CAMPAIGNS_FILE, []);
  const idx = campaigns.findIndex((c) => c.id === id);
  if (idx === -1) return null;
  campaigns[idx] = { ...campaigns[idx], ...patch, id: campaigns[idx].id };
  await writeJson(NOTIFICATION_CAMPAIGNS_FILE, campaigns);
  return campaigns[idx];
}

export async function deleteNotificationCampaign(id) {
  const campaigns = await readJson(NOTIFICATION_CAMPAIGNS_FILE, []);
  const filtered = campaigns.filter((c) => c.id !== id);
  await writeJson(NOTIFICATION_CAMPAIGNS_FILE, filtered);
  return filtered.length !== campaigns.length;
}

// ---------- Assistente de atendimento com IA (Fase 4, itens 32-39) ----------

const AI_CONVERSATIONS_FILE = path.join(DATA_DIR, 'ai-conversations.json');
const AI_MESSAGES_FILE = path.join(DATA_DIR, 'ai-messages.json');

// Reaproveita a conversa em aberto do mesmo cliente/sessão neste restaurante
// (se existir) em vez de começar do zero a cada mensagem — é isso que dá
// contexto de conversa e permite retomar o histórico (item 39).
export async function findOrCreateAiConversation({ restaurantSlug, customerId, sessionId }) {
  const conversations = await readJson(AI_CONVERSATIONS_FILE, []);
  const existing = conversations.find(
    (c) =>
      c.restaurantSlug === restaurantSlug &&
      c.status !== 'closed' &&
      ((customerId && c.customerId === customerId) || (sessionId && c.sessionId === sessionId))
  );
  if (existing) return existing;

  const now = new Date().toISOString();
  const conversation = {
    id: randomUUID(),
    restaurantSlug,
    customerId: customerId || null,
    sessionId: sessionId || null,
    status: 'bot',
    createdAt: now,
    updatedAt: now,
  };
  conversations.push(conversation);
  await writeJson(AI_CONVERSATIONS_FILE, conversations);
  return conversation;
}

export async function getAiConversation(id) {
  const conversations = await readJson(AI_CONVERSATIONS_FILE, []);
  return conversations.find((c) => c.id === id) || null;
}

export async function listAiConversations(restaurantSlug, { status } = {}) {
  const conversations = await readJson(AI_CONVERSATIONS_FILE, []);
  return conversations
    .filter((c) => c.restaurantSlug === restaurantSlug && (!status || c.status === status))
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export async function updateAiConversationStatus(id, status) {
  const conversations = await readJson(AI_CONVERSATIONS_FILE, []);
  const idx = conversations.findIndex((c) => c.id === id);
  if (idx === -1) return null;
  conversations[idx] = { ...conversations[idx], status, updatedAt: new Date().toISOString() };
  await writeJson(AI_CONVERSATIONS_FILE, conversations);
  return conversations[idx];
}

export async function addAiMessage(conversationId, role, content) {
  const messages = await readJson(AI_MESSAGES_FILE, []);
  const message = { id: randomUUID(), conversationId, role, content, createdAt: new Date().toISOString() };
  messages.push(message);
  await writeJson(AI_MESSAGES_FILE, messages);
  // Marca a conversa como recém-atualizada, pra ordenar a lista do admin
  // pelas mais recentes primeiro.
  const conversations = await readJson(AI_CONVERSATIONS_FILE, []);
  const idx = conversations.findIndex((c) => c.id === conversationId);
  if (idx !== -1) {
    conversations[idx].updatedAt = message.createdAt;
    await writeJson(AI_CONVERSATIONS_FILE, conversations);
  }
  return message;
}

export async function listAiMessages(conversationId) {
  const messages = await readJson(AI_MESSAGES_FILE, []);
  return messages.filter((m) => m.conversationId === conversationId);
}

// ---------- Biblioteca de imagens ----------
const MEDIA_FILE = path.join(DATA_DIR, 'media-library.json');

export async function createMediaAsset(asset) {
  const list = await readJson(MEDIA_FILE, []);
  const now = new Date().toISOString();
  const row = { id: asset.id || randomUUID(), ...asset, createdAt: asset.createdAt || now, updatedAt: now };
  list.unshift(row);
  await writeJson(MEDIA_FILE, list);
  return row;
}

export async function listMediaAssets(slug, options = {}) {
  const list = await readJson(MEDIA_FILE, []);
  return list.filter((a) => a.restaurantSlug === slug && (!options.kind || a.kind === options.kind));
}

export async function getMediaAssetById(slug, id) {
  const list = await readJson(MEDIA_FILE, []);
  return list.find((a) => a.restaurantSlug === slug && a.id === id) || null;
}

export async function deleteMediaAsset(slug, id) {
  const list = await readJson(MEDIA_FILE, []);
  const idx = list.findIndex((a) => a.restaurantSlug === slug && a.id === id);
  if (idx === -1) return null;
  const [removed] = list.splice(idx, 1);
  await writeJson(MEDIA_FILE, list);
  return removed;
}

const BACKUPS_DIR = path.join(DATA_DIR, 'backups');
const EVENTS_DIR = path.join(DATA_DIR, 'realtime-events');
export async function createRestaurantBackup(slug, payload, createdBy = null) {
  const id = randomUUID(); const now = new Date().toISOString();
  const row = { id, restaurantSlug: slug, version: '18.0.0', payload, createdAt: now, createdBy };
  const file = path.join(BACKUPS_DIR, `${slug}.json`); const rows = await readJson(file, []); rows.push(row); await writeJson(file, rows.slice(-20)); return row;
}
export async function listRestaurantBackups(slug) { return readJson(path.join(BACKUPS_DIR, `${slug}.json`), []); }
export async function getRestaurantBackup(slug,id) { return (await listRestaurantBackups(slug)).find(x=>x.id===id)||null; }
export async function appendRealtimeEvent(slug,event) { const file=path.join(EVENTS_DIR,`${slug}.json`); const rows=await readJson(file,[]); const row={id:Date.now()+Math.random(),restaurantSlug:slug,payload:event,createdAt:new Date().toISOString()}; rows.push(row); await writeJson(file,rows.slice(-500)); return row; }
export async function listRealtimeEvents(slug, afterId=0) { return (await readJson(path.join(EVENTS_DIR,`${slug}.json`),[])).filter(x=>Number(x.id)>Number(afterId)); }

const PRINT_JOBS_DIR = path.join(DATA_DIR, 'print-jobs');
function printJobsPath(slug) { return path.join(PRINT_JOBS_DIR, `${slug}.json`); }
export async function listPrintJobs(slug, limit = 100) {
  const jobs = await readJson(printJobsPath(slug), []);
  return jobs.slice(-Math.min(Math.max(Number(limit)||100,1),500)).reverse();
}
export async function createPrintJob(slug, input) {
  const jobs = await readJson(printJobsPath(slug), []);
  const now = new Date().toISOString();
  const job = { id: randomUUID(), restaurantSlug: slug, orderId: input.orderId, orderNumber: input.orderNumber, variant: input.variant || 'customer', status: 'pendente', attempts: 0, createdAt: now, updatedAt: now, error: null };
  jobs.push(job);
  await writeJson(printJobsPath(slug), jobs.slice(-1000));
  return job;
}
export async function updatePrintJob(slug, id, patch) {
  const jobs = await readJson(printJobsPath(slug), []);
  const idx = jobs.findIndex(j => j.id === id);
  if (idx < 0) return null;
  jobs[idx] = { ...jobs[idx], ...patch, id, updatedAt: new Date().toISOString() };
  await writeJson(printJobsPath(slug), jobs);
  return jobs[idx];
}
export async function claimNextPrintJob(slug, workerId='bridge') {
  const jobs = await readJson(printJobsPath(slug), []); const now=Date.now(); const leaseUntil=new Date(now+30000).toISOString();
  const idx=jobs.findIndex(j => j.status==='pendente' || (j.status==='imprimindo' && j.leaseUntil && new Date(j.leaseUntil).getTime()<now));
  if(idx<0)return null; const current=jobs[idx]; const next={...current,status:'imprimindo',attempts:Number(current.attempts||0)+1,workerId,leaseUntil,updatedAt:new Date(now).toISOString()}; jobs[idx]=next; await writeJson(printJobsPath(slug),jobs); return next;
}
