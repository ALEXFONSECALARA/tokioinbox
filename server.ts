import { getGeminiModel } from './server/aiModel';
import 'dotenv/config';
import { checkDataPersistence } from './server/dataDir';
import express from 'express';
import compression from 'compression';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import {
  getAllOrders,
  getOrderById,
  createOrderTransactional,
  updateOrderStatusTransactional,
  updateOrderStationStatusTransactional,
  appendItemsToTableOrderTransactional,
  closeTableOrderTransactional,
  updateOrderPrintStatusTransactional,
  updateOrderTableTransactional,
  updateOrderItemTransactional,
  deleteOrderTransactional,
  clearOrdersTransactional,
  masterResetOrdersTransactional,
  findOrderByDeliveryKey,
  getOrdersEtag,
  getOrdersVersion,
  getOrdersLastModified,
  getOrdersByCustomer,
  initializeOrders,
  toStaffView,
  toCustomerView,
  getOrderForTracking,
  OrderStatus,
  ProductionStation,
  StationItemStatus,
} from './server/orderService';
import {
  findUserByUsername,
  findUserById,
  verifyPassword,
  needsPasswordRehash,
  upgradeUserPasswordHash,
  getAllUsers,
  createUser,
  updateUser,
  deleteUser,
  requestPasswordReset,
  confirmPasswordReset,
  getAllDevices,
  generatePairingCode,
  registerOrPairDevice,
  updateDevicePing,
  updateDeviceSettings,
  disconnectDevice,
  getAuditLogs,
  logAuditAction,
  listUsersWithDefaultPassword,
  countActiveUsers,
} from './server/authAndDeviceService';
import {
  getAISettings,
  updateAISettings,
  processCustomerConciergeMessage,
  generateSalesSuggestions,
} from './server/aiService';
import { generateCmvEngineeringInsights } from './server/cmvAiService';
import {
  getRestaurantAIConfig,
  updateRestaurantAIConfig,
  getAIAuditLogs,
  getPriceSuggestions,
  resolvePriceSuggestion,
  AIModuleId,
} from './server/aiEngineService';
import {
  executeCustomerConcierge,
  executeSmartPairing,
  executeMenuEngineering,
  executeSmartKitchenKds,
  executeAiSimulation,
} from './server/aiModulesLogic';
import {
  enqueuePrintJob,
  getPrintJobs,
  updatePrintJobStatus,
  retryPrintJob,
  getPrinters,
  upsertPrinter,
  deletePrinter,
} from './server/printAgentService';
import {
  registerCustomer,
  loginCustomer,
  validateCustomerSession,
  logoutCustomerSession,
  requestCustomerPasswordReset,
  confirmCustomerPasswordReset,
  updateCustomerProfile,
  saveCustomerAddress,
  deleteCustomerAddress,
} from './server/customerAuthService';
import {
  isCloudinaryConfigured,
  getCloudinaryCloudName,
  uploadImageToCloudinary,
} from './server/cloudinaryService';
import {
  isSupabaseConfigured,
  getSupabaseUrl,
  testSupabaseConnection,
  syncOrderToSupabase,
} from './server/supabaseService';
import {
  authenticateStaff,
  authenticateStaffOrAgent,
  optionalStaffAuth,
  requireRole,
  requirePermission,
  createUserSession,
  revokeUserSession,
  revokeAllSessionsForUser,
  issueStreamTicket,
  consumeStreamTicket,
  resolveScopedSlug,
  canAccessRestaurant,
} from './server/authMiddleware';
import {
  corsMiddleware,
  securityHeaders,
  rateLimit,
  checkLoginLock,
  registerLoginFailure,
  clearLoginFailures,
  getClientIp,
  IS_PRODUCTION,
} from './server/security';
import { STATE_DOCS, isKnownKey, canAccess, readableKeys, getDoc, saveDoc } from './server/stateService';
import {
  initializeCatalog,
  getCatalog,
  getCatalogEtag,
  getPublicCatalog,
  saveCatalog,
  getRestaurant,
  restaurantExists,
} from './server/catalogService';
import { createTableAccessToken, verifyTableAccessToken } from './server/tableAccessService';

const app = express();
// Dynamic PORT: respects process.env.PORT on Render (e.g. 10000) or defaults to 3000 in local/dev
const PORT = process.env.PORT ? Number(process.env.PORT) : (process.env.NODE_ENV === 'production' && !process.env.AI_STUDIO ? 10000 : 3000);
const serverStartTime = Date.now();

// Disable powered-by header and enable gzip/brotli compression
app.disable('x-powered-by');
app.use(compression());

// Atrás de proxy (Render, Cloud Run, Nginx): necessário para IP real do cliente (rate limit)
app.set('trust proxy', 1);

// Segurança: headers + CORS restrito às origens de CORS_ORIGINS (mesma origem não precisa de CORS)
app.use(securityHeaders);
app.use(corsMiddleware);

// Parsers: limites pequenos por padrão; maiores só onde há upload/edição de catálogo (rotas de staff)
app.use('/api/upload', express.json({ limit: '12mb' }));
app.use('/api/catalog', express.json({ limit: '8mb' }));
app.use('/api/state', express.json({ limit: '2mb' }));
app.use(express.json({ limit: '256kb' }));

// Limites de abuso para rotas públicas
const publicWriteLimiter = rateLimit({ key: 'pub-write', max: 30, windowMs: 60 * 1000 });
const publicAiLimiter = rateLimit({ key: 'pub-ai', max: 15, windowMs: 10 * 60 * 1000, message: 'Muitas solicitações ao assistente. Tente novamente em alguns minutos.' });
const authLimiter = rateLimit({ key: 'auth', max: 20, windowMs: 10 * 60 * 1000 });
const resetLimiter = rateLimit({ key: 'reset', max: 5, windowMs: 15 * 60 * 1000, message: 'Muitas solicitações de recuperação. Aguarde 15 minutos.' });
const adminOnly = [authenticateStaff, requireRole('super_admin', 'administrador')] as const;

// Lazy-initialized Gemini Client
let geminiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!geminiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error('GEMINI_API_KEY environment variable is not configured');
    }
    geminiClient = new GoogleGenAI({ apiKey: key });
  }
  return geminiClient;
}

// Saúde do sistema (pública e mínima: sem detalhes internos)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    uptimeSeconds: Math.floor((Date.now() - serverStartTime) / 1000),
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/health/ready', (req, res) => {
  try {
    initializeCatalog();
    initializeOrders();
    res.json({ ready: true, time: new Date().toISOString() });
  } catch (err: any) {
    res.status(503).json({ ready: false, error: 'Armazenamento indisponível' });
  }
});

// Diagnóstico de persistência: só admin vê o caminho real do disco. Ajuda a
// detectar em produção se o sistema está gravando em um disco efêmero
// (sintoma: este endpoint reporta "primeira execução" a cada novo deploy).
app.get('/api/system/persistence-check', ...adminOnly, (req, res) => {
  const info = checkDataPersistence();
  res.json({
    dataDir: info.dataDir,
    dataDirFromEnv: Boolean(process.env.DATA_DIR?.trim()),
    looksLikeFreshDisk: !info.usersExisted && !info.markerExisted,
    warning: !process.env.DATA_DIR?.trim()
      ? 'DATA_DIR não está definida via variável de ambiente. Em plataformas com disco efêmero (ex.: Render sem Persistent Disk), os dados serão perdidos a cada deploy.'
      : null,
  });
});

// Token assinado para o QR físico de uma mesa. Somente a equipe autorizada pode gerar.
app.get('/api/table/access-token', authenticateStaff, requirePermission('can_configure_restaurant'), (req, res) => {
  const requestedSlug = String(req.query.slug || '');
  const scopedSlug = resolveScopedSlug(req, requestedSlug);
  const table = Number(req.query.table);

  if (!scopedSlug || !restaurantExists(scopedSlug)) {
    return res.status(404).json({ success: false, error: 'Restaurante não encontrado.' });
  }
  if (!Number.isInteger(table) || table < 1 || table > 999) {
    return res.status(400).json({ success: false, error: 'Mesa inválida.' });
  }

  const restaurant = getRestaurant(scopedSlug);
  try {
    const token = createTableAccessToken(scopedSlug, table);
    return res.json({ success: true, restaurantSlug: scopedSlug, tableNumber: table, token, restaurantName: restaurant?.name || scopedSlug });
  } catch (error: any) {
    return res.status(503).json({ success: false, error: error?.message || 'QR seguro indisponível: configure a chave da mesa.' });
  }
});

app.get('/api/:slug/health', (req, res) => {
  const { slug } = req.params;
  if (!restaurantExists(slug)) {
    return res.status(404).json({ error: 'Restaurante não encontrado' });
  }
  res.json({ restaurant: slug, status: 'healthy', timestamp: new Date().toISOString() });
});

// Diagnóstico de configuração (somente administradores)
app.get('/api/config/status', ...adminOnly, (req, res) => {
  res.json({
    status: 'ok',
    environment: {
      port: PORT,
      production: IS_PRODUCTION,
      timezone: process.env.TZ || 'America/Sao_Paulo',
      corsOrigins: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim()) : [],
      adminPasswordConfigured: Boolean(process.env.ADMIN_PASSWORD),
      cloudinary: {
        configured: isCloudinaryConfigured(),
        cloudName: getCloudinaryCloudName(),
      },
      supabase: {
        configured: isSupabaseConfigured(),
        url: getSupabaseUrl(),
      },
      gemini: {
        configured: Boolean(process.env.GEMINI_API_KEY),
      },
    },
    timestamp: new Date().toISOString(),
  });
});

// Cloudinary Image Upload Endpoint
app.post('/api/upload/image', ...adminOnly, async (req, res) => {
  try {
    const { image, folder } = req.body;
    if (!image) {
      return res.status(400).json({ success: false, error: 'Imagem não fornecida (formato base64 ou URL).' });
    }

    const result = await uploadImageToCloudinary({
      fileData: image,
      folder: folder || 'tokioinbox_cardapio',
    });

    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error });
    }

    res.json({
      success: true,
      url: result.url,
      publicId: result.publicId,
      format: result.format,
      bytes: result.bytes,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Erro ao realizar upload da imagem.' });
  }
});

// Supabase Live Status & Diagnostic Endpoint
app.get('/api/supabase/status', ...adminOnly, async (req, res) => {
  try {
    const diag = await testSupabaseConnection();
    res.json(diag);
  } catch (error: any) {
    res.status(500).json({ configured: isSupabaseConfigured(), connected: false, error: error.message });
  }
});

// Supabase SQL Schema Endpoint for Easy Migration
app.get('/api/supabase/schema', ...adminOnly, (req, res) => {
  try {
    const schemaPath = path.join(process.cwd(), 'server', 'supabase_schema.sql');
    if (fs.existsSync(schemaPath)) {
      const sql = fs.readFileSync(schemaPath, 'utf-8');
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      return res.send(sql);
    }
    res.status(404).send('-- Schema file not found');
  } catch (error: any) {
    res.status(500).send(`-- Error reading schema: ${error.message}`);
  }
});

// AI Pairing and Recommendation API (Chef / Sommelier AI)
app.post('/api/ai/recommend', publicAiLimiter, async (req, res) => {
  try {
    const { restaurantSlug, currentItems, preference } = req.body;

    if (!process.env.GEMINI_API_KEY) {
      // Graceful fallback recommendations if API key is not yet set
      return res.json({
        recommendation:
          'Sugestão do Chef: Experimente harmonizar seu pedido com uma bebida artesanal gelada ou finalize com uma das nossas sobremesas tradicionais da casa!',
        fallback: true,
      });
    }

    const ai = getGeminiClient();
    const prompt = `Você é o Chef e Sommelier do restaurante "${restaurantSlug}" na plataforma Tokio inBox.
Itens no carrinho do cliente: ${JSON.stringify(currentItems || [])}.
Preferência do cliente: ${preference || 'Geral'}.
Responda em português brasileiro de forma acolhedora, objetiva e sucinta (máximo 2 a 3 frases) recomendando uma harmonização perfeita de bebida ou sobremesa que combine idealmente com os pratos escolhidos.`;

    const response = await ai.models.generateContent({
      model: getGeminiModel(),
      contents: prompt,
    });

    res.json({
      recommendation: response.text || 'Recomendação indisponível no momento.',
      fallback: false,
    });
  } catch (error: any) {
    console.error('Gemini AI error:', error);
    res.json({
      recommendation:
        'Sugestão do Chef: Aproveite para adicionar uma bebida refrescante ou nossa sobremesa artesanal para uma experiência gastronômica completa!',
      fallback: true,
    });
  }
});

// Smart Kitchen Ticket & Thermal Printing AI Analysis
app.post('/api/ai/smart-ticket', authenticateStaff, async (req, res) => {
  try {
    const { order, restaurantName } = req.body;

    if (!order) {
      return res.status(400).json({ error: 'Dados do pedido são obrigatórios' });
    }

    if (!process.env.GEMINI_API_KEY) {
      // High-quality smart heuristic fallback if key is not yet set
      const itemsList: string[] = (order.items || []).map((i: any) => `${i.quantity}x ${i.name}`);
      const hasSpecialNotes = Boolean(order.notes || order.items?.some((i: any) => i.notes));
      return res.json({
        stationRouting: [
          `Estação Principal (${restaurantName || 'Cozinha'}): ${itemsList.slice(0, 3).join(', ')}`,
          'Estação de Expedição & Embalagem: Conferir lacre térmico e adicionais',
        ],
        allergyWarnings: hasSpecialNotes
          ? [`Atenção aos detalhes informados pelo cliente: "${order.notes || 'Ver observações nos itens'}"`]
          : ['Nenhuma restrição alimentar crítica indicada pelo cliente'],
        preparationSequence: [
          '1. Separar insumos refrigerados e pré-aquecer estação',
          '2. Montagem e cocção dos itens principais em lote',
          '3. Finalização, guarnição e despacho com comanda',
        ],
        estimatedPrepMinutes: 20,
        chefMessage: 'Preparado artesanalmente com ingredientes selecionados. Bom apetite!',
        fallback: true,
      });
    }

    const ai = getGeminiClient();
    const prompt = `Você é um Gerente de Cozinha Inteligente (Smart Kitchen AI) do sistema Tokio inBox.
Analise este pedido para o restaurante "${restaurantName || order.restaurantName}":
Código: ${order.shortCode}
Modalidade: ${order.orderType} (Mesa: ${order.tableNumber || 'N/A'})
Itens: ${JSON.stringify(order.items?.map((i: any) => ({ name: i.name, qty: i.quantity, notes: i.notes, options: i.selectedOptions })) || [])}
Observação Geral: ${order.notes || 'Nenhuma'}

Responda APENAS um objeto JSON válido (sem blocos markdown extras) com a seguinte estrutura:
{
  "stationRouting": ["Estação 1: ...", "Estação 2: ..."],
  "allergyWarnings": ["Atenção: ..."],
  "preparationSequence": ["1. ...", "2. ...", "3. ..."],
  "estimatedPrepMinutes": 20,
  "chefMessage": "Frase curta de agradecimento e carinho para imprimir no cupom do cliente"
}`;

    const response = await ai.models.generateContent({
      model: getGeminiModel(),
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    res.json({
      stationRouting: parsed.stationRouting || ['Cozinha Geral'],
      allergyWarnings: parsed.allergyWarnings || ['Verificar observações do pedido'],
      preparationSequence: parsed.preparationSequence || ['Iniciar preparo conforme ordem dos itens'],
      estimatedPrepMinutes: parsed.estimatedPrepMinutes || 22,
      chefMessage: parsed.chefMessage || 'Agradecemos sua preferência! Feito com carinho e dedicação.',
      fallback: false,
    });
  } catch (error: any) {
    console.error('Smart Ticket AI error:', error);
    res.json({
      stationRouting: ['Cozinha Central / Sushibar / Grelha'],
      allergyWarnings: ['Conferir observações manuais do cliente'],
      preparationSequence: ['1. Preparo dos pratos principais', '2. Embalagem e despacho'],
      estimatedPrepMinutes: 20,
      chefMessage: 'Feito com carinho por nossa equipe gastronômica!',
      fallback: true,
    });
  }
});

// ==========================================
// AURA AI DECOUPLED LAYER & CONCIERGE API
// ==========================================

app.get('/api/ai/settings', ...adminOnly, (req, res) => {
  res.json({ success: true, settings: getAISettings() });
});

app.post('/api/ai/settings', ...adminOnly, (req, res) => {
  try {
    const updated = updateAISettings(req.body);
    res.json({ success: true, settings: updated });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Customer Commercial Concierge Chatbot (Adheres strictly to real menu and prices)
app.post('/api/ai/concierge', publicAiLimiter, async (req, res) => {
  try {
    const {
      restaurantName,
      restaurantSlug,
      isOpen,
      openingHours,
      deliveryFee,
      minOrderValue,
      realMenuItems,
      customerMessage,
      cartItems,
    } = req.body;

    if (!customerMessage) {
      return res.status(400).json({ success: false, error: 'Mensagem do cliente é obrigatória' });
    }

    const result = await processCustomerConciergeMessage({
      restaurantName: restaurantName || 'Aura Prime Gastronomia',
      restaurantSlug: restaurantSlug || 'japones',
      isOpen: Boolean(isOpen),
      openingHours: openingHours || '18:00 às 23:30',
      deliveryFee: Number(deliveryFee) || 0,
      minOrderValue: Number(minOrderValue) || 0,
      realMenuItems: realMenuItems || [],
      customerMessage,
      cartItems: cartItems || [],
    });

    res.json({ success: true, ...result });
  } catch (error: any) {
    console.error('AI Concierge error:', error);
    res.json({
      success: true,
      responseText: 'Olá! Sou o assistente do restaurante. Como posso te ajudar com o cardápio de hoje?',
      suggestedProductIds: [],
      fallback: true,
    });
  }
});

// AI Sales Assistant Suggestions (Requires Admin Approval)
app.post('/api/ai/sales-suggestions', authenticateStaff, (req, res) => {
  try {
    const {
      restaurantSlug,
      restaurantName,
      totalOrders,
      averageTicket,
      topItemNames,
      lowSellingNames,
      inactiveCustomersCount,
      abandonedCartsCount,
    } = req.body;

    const suggestions = generateSalesSuggestions({
      restaurantSlug: restaurantSlug || 'japones',
      restaurantName: restaurantName || 'Restaurante',
      totalOrders: Number(totalOrders) || 0,
      averageTicket: Number(averageTicket) || 0,
      topItemNames: Array.isArray(topItemNames) ? topItemNames : [],
      lowSellingNames: Array.isArray(lowSellingNames) ? lowSellingNames : [],
      inactiveCustomersCount: Number(inactiveCustomersCount) || 0,
      abandonedCartsCount: Number(abandonedCartsCount) || 0,
    });

    res.json({ success: true, count: suggestions.length, suggestions });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Autonomous AI CMV & Menu Engineering
app.post('/api/ai/cmv-engineering', ...adminOnly, async (req, res) => {
  try {
    const { restaurantSlug, items, targetMargin } = req.body;
    const targetMarginPercent = Number(targetMargin) || 65;
    const ai = getGeminiClient();
    const result = await generateCmvEngineeringInsights(
      restaurantSlug || 'japones',
      Array.isArray(items) ? items : [],
      targetMarginPercent,
      ai
    );
    res.json({ success: true, ...result });
  } catch (error: any) {
    console.error('[AI CMV Error]', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// CENTRAL DE INTELIGÊNCIA DO SISTEMA (AI ENGINE)
// ==========================================

// 1. Get AI Config for a restaurant
app.get('/api/ai-engine/config', ...adminOnly, (req, res) => {
  try {
    const slug = (req.query.restaurantSlug as string) || 'japones';
    const config = getRestaurantAIConfig(slug);
    res.json({ success: true, config });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Update AI Config for a module with strict audit logging
app.put('/api/ai-engine/config', ...adminOnly, (req, res) => {
  try {
    const { restaurantSlug, moduleId, updates, operatorUsername, operatorRole } = req.body;
    if (!restaurantSlug || !moduleId || !updates) {
      return res.status(400).json({ success: false, error: 'restaurantSlug, moduleId e updates são obrigatórios' });
    }

    const updated = updateRestaurantAIConfig(
      restaurantSlug,
      moduleId as AIModuleId,
      updates,
      {
        username: operatorUsername || 'admin',
        role: operatorRole || 'superadmin',
      }
    );

    res.json({ success: true, config: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Get AI Audit Logs (data, hora, usuário, anterior, novo)
app.get('/api/ai-engine/logs', ...adminOnly, (req, res) => {
  try {
    const slug = req.query.restaurantSlug as string | undefined;
    const logs = getAIAuditLogs(slug);
    res.json({ success: true, count: logs.length, logs });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Get Price Suggestions
app.get('/api/ai-engine/price-suggestions', ...adminOnly, (req, res) => {
  try {
    const slug = req.query.restaurantSlug as string | undefined;
    const suggestions = getPriceSuggestions(slug);
    res.json({ success: true, count: suggestions.length, suggestions });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. Human Approval/Rejection for Price Suggestions
app.post('/api/ai-engine/resolve-price', ...adminOnly, (req, res) => {
  try {
    const { suggestionId, action, operatorUsername, operatorRole } = req.body;
    if (!suggestionId || !action) {
      return res.status(400).json({ success: false, error: 'suggestionId e action são obrigatórios' });
    }

    const result = resolvePriceSuggestion(
      suggestionId,
      action as 'aprovar' | 'ignorar',
      {
        username: operatorUsername || 'admin',
        role: operatorRole || 'gerente',
      }
    );

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6. Module 1: Customer Concierge
app.post('/api/ai-engine/customer-concierge', publicAiLimiter, async (req, res) => {
  try {
    const {
      restaurantSlug,
      restaurantName,
      isOpen,
      openingHours,
      deliveryFee,
      minOrderValue,
      menuItems,
      customerMessage,
      cartItems,
    } = req.body;

    const result = await executeCustomerConcierge({
      restaurantSlug: restaurantSlug || 'japones',
      restaurantName: restaurantName || 'Restaurante Tokio inBox',
      isOpen: Boolean(isOpen),
      openingHours: openingHours || '18:00 às 23:30',
      deliveryFee: Number(deliveryFee) || 0,
      minOrderValue: Number(minOrderValue) || 0,
      menuItems: Array.isArray(menuItems) ? menuItems : [],
      customerMessage: customerMessage || '',
      cartItems: Array.isArray(cartItems) ? cartItems : [],
    });

    res.json({ success: true, ...result });
  } catch (err: any) {
    console.error('[AI ENGINE] Concierge error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 7. Module 2: Smart Pairing (Chef & Sommelier)
app.post('/api/ai-engine/smart-pairing', publicAiLimiter, async (req, res) => {
  try {
    const { restaurantSlug, restaurantName, cartItems, menuItems } = req.body;
    const result = await executeSmartPairing({
      restaurantSlug: restaurantSlug || 'japones',
      restaurantName: restaurantName || 'Restaurante Tokio inBox',
      cartItems: Array.isArray(cartItems) ? cartItems : [],
      menuItems: Array.isArray(menuItems) ? menuItems : [],
    });

    res.json({ success: true, ...result });
  } catch (err: any) {
    console.error('[AI ENGINE] Smart Pairing error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 8. Module 3: Menu Engineering & CMV
app.post('/api/ai-engine/menu-engineering', ...adminOnly, async (req, res) => {
  try {
    const { restaurantSlug, restaurantName, periodDays, menuItems, orders } = req.body;
    const realOrders = Array.isArray(orders) ? orders : getAllOrders();

    const diagnostic = await executeMenuEngineering({
      restaurantSlug: restaurantSlug || 'japones',
      restaurantName: restaurantName || 'Restaurante Tokio inBox',
      periodDays: Number(periodDays) || 30,
      menuItems: Array.isArray(menuItems) ? menuItems : [],
      orders: realOrders,
    });

    res.json({ success: true, ...diagnostic });
  } catch (err: any) {
    console.error('[AI ENGINE] Menu Engineering error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 9. Module 4: Smart Kitchen KDS
app.post('/api/ai-engine/smart-kitchen', authenticateStaff, (req, res) => {
  try {
    const { restaurantSlug, orders } = req.body;
    const realOrders = Array.isArray(orders) ? orders : getAllOrders();

    const result = executeSmartKitchenKds({
      restaurantSlug: restaurantSlug || 'japones',
      orders: realOrders,
    });

    res.json({ success: true, ...result });
  } catch (err: any) {
    console.error('[AI ENGINE] Smart Kitchen error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 10. Simulation Mode ("SIMULAR IA")
app.post('/api/ai-engine/simulate', ...adminOnly, async (req, res) => {
  try {
    const { restaurantSlug, scenario, customInput, menuItems, orders } = req.body;
    const realOrders = Array.isArray(orders) ? orders : getAllOrders();

    const result = await executeAiSimulation({
      restaurantSlug: restaurantSlug || 'japones',
      scenario: scenario || 'cliente',
      customInput,
      menuItems: Array.isArray(menuItems) ? menuItems : [],
      orders: realOrders,
    });

    res.json({ success: true, ...result });
  } catch (err: any) {
    console.error('[AI ENGINE] Simulation error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

function routeOrderToPrint(order: any, sourceItems?: any[], operationKey?: string) {
  const jobs: any[] = [];
  const source = Array.isArray(sourceItems) && sourceItems.length ? sourceItems : (order.items || []);
  const byStation: Record<string, any[]> = {};
  for (const item of source) {
    const station = item.station || (String(item.name || '').toLowerCase().includes('sushi') ? 'sushibar' : 'cozinha');
    if (!byStation[station]) byStation[station] = [];
    byStation[station].push(item);
  }
  const stationMap: Record<string, any> = { cozinha: 'COZINHA', sushibar: 'SUSHI_BAR', bar: 'BAR' };
  for (const [stationKey, items] of Object.entries(byStation)) {
    const station = stationMap[stationKey];
    if (!station) continue;
    const body = items.map((i: any) => `${i.quantity}x ${i.name}${i.notes ? ` | ${i.notes}` : ''}`).join('\n');
    jobs.push(enqueuePrintJob({
      orderId: order.id,
      orderShortCode: order.shortCode,
      restaurantSlug: order.restaurantSlug,
      station,
      rawEscPos: `PEDIDO ${order.shortCode}\nOP ${operationKey || 'initial'}\nMESA ${order.tableNumber || '-'}\n${body}\n------------------------------\n`,
    }));
  }
  if (['delivery', 'balcao', 'retirada', 'online'].includes(order.orderType)) {
    const body = source.map((i: any) => `${i.quantity}x ${i.name}${i.notes ? ` | ${i.notes}` : ''}`).join('\n');
    jobs.push(enqueuePrintJob({
      orderId: order.id,
      orderShortCode: order.shortCode,
      restaurantSlug: order.restaurantSlug,
      station: 'CAIXA',
      rawEscPos: `CAIXA ${order.shortCode}\nOP ${operationKey || 'initial'}\n${body}\nTOTAL R$ ${Number(order.total || 0).toFixed(2)}\n------------------------------\n`,
    }));
  }
  return jobs;
}

// ==========================================
// AURA PRINT AGENT API (INDEPENDENT SYSTEM)
// ==========================================

// 1. List or poll print jobs (Multi-tenant isolated)
app.get('/api/print-agent/jobs', authenticateStaffOrAgent, (req, res) => {
  try {
    const slug = req.query.slug as string | undefined;
    const status = req.query.status as any;
    const jobs = getPrintJobs(slug, status);
    res.json({ success: true, count: jobs.length, jobs });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 2. Enqueue print job with idempotency
app.post('/api/print-agent/jobs', authenticateStaffOrAgent, (req, res) => {
  try {
    const { orderId, orderShortCode, restaurantSlug, station, rawEscPos } = req.body;
    if (!orderId || !restaurantSlug || !station) {
      return res.status(400).json({ success: false, error: 'Dados incompletos para envio de impressão' });
    }

    const result = enqueuePrintJob({
      orderId,
      orderShortCode: orderShortCode || `#${orderId.slice(0, 6)}`,
      restaurantSlug,
      station,
      rawEscPos,
    });

    res.status(result.deduplicated ? 200 : 201).json({
      success: true,
      deduplicated: result.deduplicated,
      job: result.job,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 3. Update print job status (agent report)
app.patch('/api/print-agent/jobs/:jobId/status', authenticateStaffOrAgent, (req, res) => {
  try {
    const { status, errorMessage } = req.body;
    if (!status) {
      return res.status(400).json({ success: false, error: 'Status é obrigatório' });
    }
    const updated = updatePrintJobStatus(req.params.jobId, status, errorMessage);
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Trabalho de impressão não encontrado' });
    }
    res.json({ success: true, job: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 4. Retry failed print job
app.post('/api/print-agent/jobs/:jobId/retry', authenticateStaffOrAgent, (req, res) => {
  try {
    const retried = retryPrintJob(req.params.jobId);
    if (!retried) {
      return res.status(404).json({ success: false, error: 'Trabalho de impressão não encontrado' });
    }
    res.json({ success: true, job: retried });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 5. Thermal Printers List & Register
app.get('/api/print-agent/printers', authenticateStaffOrAgent, (req, res) => {
  try {
    const slug = req.query.slug as string | undefined;
    const printers = getPrinters(slug);
    res.json({ success: true, count: printers.length, printers });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/print-agent/printers', authenticateStaffOrAgent, (req, res) => {
  try {
    const printer = upsertPrinter(req.body);
    res.json({ success: true, printer });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// BUG CORRIGIDO: 'can_manage_settings' não existe em UserPermissions (não é
// pego pelo bundler/esbuild em runtime, só pelo typecheck) — na prática a
// checagem de permissão falhava sempre e NINGUÉM conseguia excluir uma
// impressora, nem o administrador. Alinhado com a mesma permissão já usada
// para as demais configurações do restaurante (ex.: QR da mesa).
app.delete('/api/print-agent/printers/:printerId', authenticateStaff, requirePermission('can_configure_restaurant'), (req, res) => {
  try {
    const removed = deletePrinter(req.params.printerId, req.query.slug as string | undefined);
    if (!removed) return res.status(404).json({ success: false, error: 'Impressora não encontrada.' });
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// ==========================================
// CUSTOMER AUTH & SECURE SESSION API (WHATSAPP + SENHA)
// ==========================================

// Helper middleware: Extract authenticated customer from Authorization Bearer token
function getAuthenticatedCustomer(req: express.Request) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.substring(7).trim();
  return validateCustomerSession(token);
}

// 1. Customer Registration (Nome, WhatsApp, Senha, Confirmar Senha)
app.post('/api/customer/register', authLimiter, (req, res) => {
  try {
    const { name, phone, password, confirmPassword } = req.body;
    const result = registerCustomer({ name, phone, password, confirmPassword });
    if (!result.success) {
      return res.status(result.alreadyExists ? 409 : 400).json(result);
    }
    res.status(201).json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 2. Customer Login (WhatsApp + Senha)
app.post('/api/customer/login', authLimiter, (req, res) => {
  try {
    const { phone, password } = req.body;
    const result = loginCustomer({ phone, password });
    if (!result.success) {
      return res.status(result.notFound ? 404 : 401).json(result);
    }
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 3. Customer Logout (Encerramento de sessão segura)
app.post('/api/customer/logout', (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7).trim() : req.body.token;
    if (token) {
      logoutCustomerSession(token);
    }
    res.json({ success: true, message: 'Sessão encerrada com sucesso.' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 4. Get Current Customer Profile
app.get('/api/customer/me', (req, res) => {
  const customer = getAuthenticatedCustomer(req);
  if (!customer) {
    return res.status(401).json({ success: false, error: 'Sessão não autenticada ou expirada.' });
  }
  res.json({ success: true, customer });
});

// 5. Update Customer Profile (Nome)
app.patch('/api/customer/profile', (req, res) => {
  const customer = getAuthenticatedCustomer(req);
  if (!customer) {
    return res.status(401).json({ success: false, error: 'Sessão não autenticada.' });
  }
  const result = updateCustomerProfile(customer.id, req.body);
  res.json(result);
});

// 6. Customer Addresses
app.post('/api/customer/addresses', (req, res) => {
  const customer = getAuthenticatedCustomer(req);
  if (!customer) {
    return res.status(401).json({ success: false, error: 'Sessão não autenticada.' });
  }
  const result = saveCustomerAddress(customer.id, req.body);
  res.json(result);
});

app.delete('/api/customer/addresses/:id', (req, res) => {
  const customer = getAuthenticatedCustomer(req);
  if (!customer) {
    return res.status(401).json({ success: false, error: 'Sessão não autenticada.' });
  }
  const result = deleteCustomerAddress(customer.id, req.params.id);
  res.json(result);
});

// 7. Password Recovery Flow
app.post('/api/customer/forgot-password', resetLimiter, async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) {
      return res.status(400).json({ success: false, error: 'WhatsApp é obrigatório.' });
    }
    const result = await requestCustomerPasswordReset(phone);
    if (!result.success) {
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/customer/reset-password', resetLimiter, (req, res) => {
  try {
    const { phone, code, newPassword, confirmPassword } = req.body;
    const result = confirmCustomerPasswordReset({ phone, code, newPassword, confirmPassword });
    if (!result.success) {
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 8. Strict Customer Orders (Isolamento total: cliente só vê seus próprios pedidos)
app.get('/api/customer/my-orders', (req, res) => {
  const customer = getAuthenticatedCustomer(req);
  if (!customer) {
    return res.status(401).json({ success: false, error: 'Sessão não autenticada.' });
  }
  const orders = getOrdersByCustomer(customer.id, customer.phoneNormalized);
  res.json({ success: true, count: orders.length, orders });
});

// Backward compatibility alias
app.post('/api/customer/auth', authLimiter, (req, res) => {
  try {
    const { phone, name, password } = req.body;
    if (!phone) {
      return res.status(400).json({ success: false, error: 'Telefone é obrigatório.' });
    }
    // If password provided, attempt login or register
    if (password) {
      const loginRes = loginCustomer({ phone, password });
      if (loginRes.success) return res.json(loginRes);
      if (loginRes.notFound && name) {
        return res.json(registerCustomer({ name, phone, password }));
      }
      return res.status(400).json(loginRes);
    }
    // Fallback: invite to set up password
    return res.status(400).json({
      success: false,
      error: 'Autenticação segura ativa: Por favor, informe sua senha para entrar ou cadastre-se.',
      requiresPassword: true,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});
// ==========================================
// REAL-TIME SSE STREAM & ORDERS API
// ==========================================

interface SSEOrderClient {
  id: string;
  res: express.Response;
  slug?: string; // escopo do colaborador ('all' ou slug do restaurante)
}
let sseOrderClients: SSEOrderClient[] = [];

export function broadcastOrdersUpdate(eventType: string, order?: any) {
  // Somente colaboradores autenticados recebem o stream; nunca envia o token de rastreio.
  const safeOrder = order ? toStaffView(order) : undefined;
  const payload = JSON.stringify({
    event: eventType,
    order: safeOrder,
    version: getOrdersVersion(),
    lastModified: getOrdersLastModified(),
    timestamp: new Date().toISOString(),
  });

  sseOrderClients.forEach((client) => {
    try {
      if (
        !client.slug ||
        client.slug === 'all' ||
        !order?.restaurantSlug ||
        client.slug === order.restaurantSlug
      ) {
        client.res.write(`data: ${payload}\n\n`);
      }
    } catch {
      // client dropped connection
    }
  });
}

// Ticket de uso único (60s) para abrir o stream: EventSource não envia header Authorization.
app.post('/api/orders/stream-ticket', authenticateStaff, (req, res) => {
  res.json({ success: true, ticket: issueStreamTicket(req.userSession!.id) });
});

// Stream em tempo real: exige ticket válido emitido a um colaborador autenticado.
app.get('/api/orders/stream', (req, res) => {
  const user = consumeStreamTicket(String(req.query.ticket || ''));
  if (!user) {
    return res.status(401).json({ success: false, error: 'Ticket de stream inválido ou expirado.', code: 'INVALID_TICKET' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders();
  }

  const clientId = `sse-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const scope = user.restaurantSlug && user.restaurantSlug !== 'all' ? user.restaurantSlug : (req.query.slug as string | undefined) || 'all';

  const client: SSEOrderClient = { id: clientId, res, slug: scope };
  sseOrderClients.push(client);

  res.write(
    `data: ${JSON.stringify({
      event: 'connected',
      clientId,
      version: getOrdersVersion(),
      lastModified: getOrdersLastModified(),
      timestamp: new Date().toISOString(),
    })}\n\n`
  );

  const heartbeat = setInterval(() => {
    try {
      res.write(`: heartbeat\n\n`);
    } catch {
      clearInterval(heartbeat);
    }
  }, 15000);

  req.on('close', () => {
    clearInterval(heartbeat);
    sseOrderClients = sseOrderClients.filter((c) => c.id !== clientId);
  });
});

// 1. List all orders with optional restaurant slug filter and ETag 304 caching
app.get('/api/orders', authenticateStaff, requirePermission('can_view_orders'), (req, res) => {
  try {
    const slug = resolveScopedSlug(req, req.query.slug as string | undefined);
    const currentEtag = `${getOrdersEtag(slug)}-${req.userSession!.id}`;
    const clientEtag = req.headers['if-none-match'];

    res.setHeader('ETag', currentEtag);
    res.setHeader('Cache-Control', 'private, no-cache');

    if (clientEtag && clientEtag === currentEtag) {
      return res.status(304).end();
    }

    const orders = getAllOrders(slug).map(toStaffView);
    res.json({
      success: true,
      count: orders.length,
      orders,
      version: getOrdersVersion(),
      lastModified: getOrdersLastModified(),
    });
  } catch (error: any) {
    console.error('[ORDER ERROR] Erro ao listar pedidos:', error);
    res.status(500).json({ success: false, error: 'Erro interno ao consultar pedidos' });
  }
});

// 2. Check Idempotency Key (Wi-Fi / 4G reconnection recovery)
app.get('/api/orders/check-idempotency/:key', publicWriteLimiter, (req, res) => {
  try {
    const { key } = req.params;
    const existing = findOrderByDeliveryKey(key);
    if (existing) {
      return res.json({ exists: true, order: toCustomerView(existing) });
    }
    return res.json({ exists: false });
  } catch (error: any) {
    console.error('[ORDER ERROR] Erro ao consultar idempotency key:', error);
    res.status(500).json({ exists: false, error: 'Erro ao verificar idempotência' });
  }
});

// 3. Get single order by id or shortCode
// Rastreio público: exige id/código + token secreto do pedido (entregue só a quem fez o pedido)
app.get('/api/public/orders/:id', rateLimit({ key: 'track', max: 120, windowMs: 60 * 1000 }), (req, res) => {
  const order = getOrderForTracking(req.params.id, String(req.query.t || ''));
  if (!order) {
    return res.status(404).json({ success: false, error: 'Pedido não encontrado.' });
  }
  res.json({ success: true, order: toCustomerView(order) });
});

// Vários pedidos de uma vez (carrinho multi-restaurante). Body: { items: [{ id, t }] }
app.post('/api/public/orders/lookup', rateLimit({ key: 'track-bulk', max: 60, windowMs: 60 * 1000 }), (req, res) => {
  const list = Array.isArray(req.body?.items) ? req.body.items.slice(0, 20) : [];
  const orders = list
    .map((it: any) => getOrderForTracking(String(it?.id || ''), String(it?.t || '')))
    .filter(Boolean)
    .map((o: any) => toCustomerView(o));
  res.json({ success: true, orders });
});

app.get('/api/orders/:id', authenticateStaff, requirePermission('can_view_orders'), (req, res) => {
  try {
    const order = getOrderById(req.params.id);
    if (!order || !canAccessRestaurant(req, order.restaurantSlug)) {
      return res.status(404).json({ success: false, error: 'Pedido não encontrado' });
    }
    res.json({ success: true, order: toStaffView(order) });
  } catch (error: any) {
    console.error('[ORDER ERROR] Erro ao buscar pedido:', error);
    res.status(500).json({ success: false, error: 'Erro ao buscar pedido' });
  }
});

// 4. Create new order transactionally with server-side validation, idempotency & persistence
app.post('/api/orders', publicWriteLimiter, optionalStaffAuth, (req, res) => {
  try {
    const payload = req.body;
    const isStaff = Boolean(req.userSession);
    const restaurantSlug = String(payload?.restaurantSlug || '');
    if (isStaff && !canAccessRestaurant(req, restaurantSlug)) {
      return res.status(403).json({ success: false, error: 'Seu usuário não tem acesso a este restaurante.' });
    }

    // Cliente público só pode abrir/adicionar mesa usando o QR assinado daquela mesa.
    if (!isStaff && String(payload?.orderType || '').toLowerCase().includes('mesa')) {
      const tableNumber = Number(payload?.tableNumber);
      const tableToken = typeof payload?.tableAccessToken === 'string' ? payload.tableAccessToken : undefined;
      if (!verifyTableAccessToken(tableToken, restaurantSlug, tableNumber)) {
        return res.status(403).json({ success: false, error: 'Pedido de mesa permitido somente pelo QR Code da mesa.' });
      }
    }
    const authCust = getAuthenticatedCustomer(req);
    if (authCust && !payload.customerId) {
      payload.customerId = authCust.id;
      if (!payload.customerName) payload.customerName = authCust.name;
      if (!payload.customerPhone) payload.customerPhone = authCust.phone;
    }
    // Um cliente jamais define o id de outro cliente
    if (!authCust) delete payload.customerId;
    const result = createOrderTransactional(payload, { isStaff });
    if (!result.deduplicated) routeOrderToPrint(result.order);

    // Broadcast Real-Time SSE update immediately to Garçom, Cozinha, Bar, SushiBar and Client
    broadcastOrdersUpdate('order_created', result.order);

    // Asynchronously archive to Supabase PostgreSQL if configured
    syncOrderToSupabase(result.order).catch(() => {});

    res.status(result.deduplicated ? 200 : 201).json({
      success: true,
      deduplicated: result.deduplicated,
      // quem criou o pedido recebe o trackingToken; colaboradores recebem a visão de staff
      order: isStaff ? toStaffView(result.order) : result.order,
      message: result.deduplicated
        ? 'Pedido recuperado com sucesso (idempotente)'
        : 'Pedido salvo com sucesso no banco de dados',
    });
  } catch (error: any) {
    console.error('[ORDER ERROR] Falha crítica ao criar pedido:', error.message);
    res.status(400).json({
      success: false,
      error: error.message || 'Falha ao processar e salvar pedido no servidor',
    });
  }
});

// 5. Update Order Status with strict progression (recebido -> em_preparo -> pronto -> saiu_para_entrega -> entregue)
app.patch('/api/orders/:id/status', authenticateStaff, requirePermission('can_change_status'), (req, res) => {
  try {
    const { status, note, operatorName, operatorRole } = req.body as {
      status: OrderStatus;
      note?: string;
      operatorName?: string;
      operatorRole?: string;
    };
    if (!status) {
      return res.status(400).json({ success: false, error: 'Status é obrigatório' });
    }
    const updated = updateOrderStatusTransactional(req.params.id, status, note);

    // Broadcast Real-Time SSE update immediately
    broadcastOrdersUpdate('order_status_updated', updated);

    // Asynchronously update order in Supabase PostgreSQL
    syncOrderToSupabase(updated).catch(() => {});

    // Audit trail log
    logAuditAction({
      userName: req.userSession?.name || operatorName || 'Operador',
      userRole: req.userSession?.role || operatorRole || 'painel',
      action: `Alterou status do pedido ${updated.shortCode} para [${status.toUpperCase()}]`,
      details: note || `Transição para ${status}`,
      category: 'order',
    });

    res.json({ success: true, order: updated });
  } catch (error: any) {
    console.error('[ORDER STATUS ERROR]:', error.message);
    res.status(400).json({ success: false, error: error.message });
  }
});

// 5b. Update Order Station Status (KDS Praças: Bar, Cozinha, SushiBar)
// RECEBIDO -> EM PREPARO -> PEDIDO FEITO
app.patch('/api/orders/:id/station-status', authenticateStaff, requirePermission('can_change_status'), (req, res) => {
  try {
    const { station, status, operatorName, operatorRole } = req.body as {
      station: ProductionStation;
      status: StationItemStatus;
      operatorName?: string;
      operatorRole?: string;
    };

    if (!station || !['cozinha', 'sushibar', 'bar'].includes(station)) {
      return res.status(400).json({ success: false, error: 'Praça inválida (deve ser bar, cozinha ou sushibar)' });
    }
    if (!status || !['recebido', 'em_preparo', 'pedido_feito'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Status da praça inválido (deve ser recebido, em_preparo ou pedido_feito)' });
    }

    const updated = updateOrderStationStatusTransactional(req.params.id, station, status, operatorName);

    // Broadcast Real-Time SSE update immediately to all stations and dashboards
    broadcastOrdersUpdate('station_status_updated', updated);

    // Asynchronously archive status to Supabase PostgreSQL
    syncOrderToSupabase(updated).catch(() => {});

    // Audit log
    logAuditAction({
      userName: req.userSession?.name || operatorName || `Operador ${station.toUpperCase()}`,
      userRole: req.userSession?.role || operatorRole || station,
      action: `Praça [${station.toUpperCase()}] atualizada para [${status.toUpperCase()}] no pedido ${updated.shortCode}`,
      details: `Status geral do pedido: ${updated.status}`,
      category: 'order',
    });

    res.json({ success: true, order: updated });
  } catch (error: any) {
    console.error('[ORDER STATION ERROR]:', error.message);
    res.status(400).json({ success: false, error: error.message });
  }
});

// 5c. Append Items to Table Order (Garçom + Cliente synchronization on same table)
app.post('/api/orders/table/append', publicWriteLimiter, optionalStaffAuth, (req, res) => {
  try {
    const {
      tableNumber,
      restaurantSlug,
      restaurantName,
      items,
      customerName,
      customerPhone,
      waiterName,
      tableSessionId,
      idempotencyKey,
      tableAccessToken,
    } = req.body;

    const isStaff = Boolean(req.userSession);
    const scopedRestaurantSlug = String(restaurantSlug || '');
    if (isStaff && !canAccessRestaurant(req, scopedRestaurantSlug)) {
      return res.status(403).json({ success: false, error: 'Seu usuário não tem acesso a este restaurante.' });
    }
    if (!isStaff && !verifyTableAccessToken(tableAccessToken, scopedRestaurantSlug, Number(tableNumber))) {
      return res.status(403).json({ success: false, error: 'Mesa protegida: use o QR Code original desta mesa.' });
    }

    if (!tableNumber || typeof tableNumber !== 'number') {
      return res.status(400).json({ success: false, error: 'Número de mesa válido é obrigatório' });
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: 'Pelo menos 1 item deve ser informado' });
    }

    const result = appendItemsToTableOrderTransactional({
      tableNumber,
      restaurantSlug: String(restaurantSlug || ''),
      restaurantName,
      items,
      customerName,
      customerPhone,
      waiterName: req.userSession ? (waiterName || req.userSession.name) : undefined,
      tableSessionId,
      idempotencyKey,
    }, { isStaff });

    if (result.order) routeOrderToPrint(result.order, result.isNew ? result.order.items : req.body.items, req.body.idempotencyKey);

    // Broadcast Real-Time SSE update immediately to Garçom, Cozinha, Bar, SushiBar and Client
    broadcastOrdersUpdate(result.isNew ? 'order_created' : 'table_items_appended', result.order);

    // Asynchronously archive to Supabase
    syncOrderToSupabase(result.order).catch(() => {});

    // Audit log
    logAuditAction({
      userName: waiterName || customerName || `Mesa ${tableNumber}`,
      userRole: waiterName ? 'garcom' : 'cliente',
      action: `${result.isNew ? 'Criou novo pedido' : 'Adicionou itens'} na Mesa ${tableNumber} (${result.order.shortCode})`,
      details: `${items.length} item(s) adicionados`,
      category: 'order',
    });

    res.status(result.isNew ? 201 : 200).json({
      success: true,
      isNew: result.isNew,
      order: req.userSession ? toStaffView(result.order) : result.order,
      message: result.isNew ? 'Pedido aberto para a mesa' : 'Itens adicionados com sucesso ao pedido da mesa',
    });
  } catch (error: any) {
    console.error('[TABLE APPEND ERROR]:', error.message);
    res.status(400).json({ success: false, error: error.message });
  }
});

// 5d. Close Table Order & Free Table (Fechamento de Conta do Garçom / Salão)
app.post('/api/orders/:id/close-table', authenticateStaff, requirePermission('can_change_status'), (req, res) => {
  try {
    const {
      tableNumber,
      paymentMethod,
      discount,
      serviceFee,
      total,
      splitCount,
      operatorName,
      waiterNotes,
    } = req.body;

    if (!paymentMethod) {
      return res.status(400).json({ success: false, error: 'Forma de pagamento é obrigatória para fechar a conta' });
    }

    const closed = closeTableOrderTransactional({
      orderId: req.params.id,
      tableNumber: Number(tableNumber),
      paymentMethod,
      discount: Number(discount) || 0,
      serviceFee: Number(serviceFee) || 0,
      total: total !== undefined ? Number(total) : undefined,
      splitCount: Number(splitCount) || 1,
      operatorName,
      waiterNotes,
    });

    // Broadcast Real-Time SSE update so table map updates immediately to LIVRE
    broadcastOrdersUpdate('table_closed', closed);

    // Asynchronously archive to Supabase
    syncOrderToSupabase(closed).catch(() => {});

    // Audit log
    logAuditAction({
      userName: operatorName || 'Garçom',
      userRole: 'garcom',
      action: `Fechou conta da Mesa ${tableNumber} via ${paymentMethod.toUpperCase()} (${closed.shortCode})`,
      details: `Total R$ ${closed.total.toFixed(2)}${discount ? ` - Desc: R$ ${discount}` : ''}`,
      category: 'order',
    });

    res.json({
      success: true,
      order: closed,
      message: `Conta da Mesa ${tableNumber} fechada e mesa liberada com sucesso!`,
    });
  } catch (error: any) {
    console.error('[TABLE CLOSE ERROR]:', error.message);
    res.status(400).json({ success: false, error: error.message });
  }
});

// 6. Update Thermal Ticket Print Status
app.post('/api/orders/:id/conference', authenticateStaff, requirePermission('can_view_orders'), (req, res) => {
  try {
    const order = getOrderById(req.params.id);
    if (!order) return res.status(404).json({ success: false, error: 'Pedido não encontrado.' });
    const conference = {
      type: 'CONFERENCIA_NAO_FISCAL',
      orderId: order.id,
      shortCode: order.shortCode,
      tableNumber: order.tableNumber,
      items: order.items.map((i) => ({ id: i.id, name: i.name, quantity: i.quantity, unitPrice: i.unitPrice, totalPrice: i.totalPrice, selectedOptions: i.selectedOptions || [], notes: i.notes })),
      subtotal: order.subtotal, deliveryFee: order.deliveryFee, discount: order.discount, total: order.total,
      createdAt: new Date().toISOString(),
    };
    res.json({ success: true, conference });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.patch('/api/orders/:id/print', authenticateStaff, requirePermission('can_view_orders'), (req, res) => {
  try {
    const { printStatus } = req.body as { printStatus: 'pendente' | 'imprimindo' | 'impresso' };
    const updated = updateOrderPrintStatusTransactional(req.params.id, printStatus);
    broadcastOrdersUpdate('print_status_updated', updated);
    res.json({ success: true, order: updated });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// 7. Update/Transfer Order Table
app.patch('/api/orders/:id/items/:itemId', authenticateStaff, requirePermission('can_edit_orders'), (req, res) => {
  try {
    const { quantity, selectedOptions, notes, idempotencyKey } = req.body || {};
    const updated = updateOrderItemTransactional({
      orderId: req.params.id,
      itemId: req.params.itemId,
      quantity: Number(quantity),
      selectedOptions,
      notes,
      actor: { isStaff: true },
      idempotencyKey,
    });
    broadcastOrdersUpdate('order_item_updated', updated);
    syncOrderToSupabase(updated).catch(() => {});
    res.json({ success: true, order: updated });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.patch('/api/orders/:id/table', authenticateStaff, requirePermission('can_edit_orders'), (req, res) => {
  try {
    const { tableNumber } = req.body as { tableNumber: number };
    if (!tableNumber || typeof tableNumber !== 'number') {
      return res.status(400).json({ success: false, error: 'Número da mesa válido é obrigatório' });
    }
    const updated = updateOrderTableTransactional(req.params.id, tableNumber);
    broadcastOrdersUpdate('table_transferred', updated);
    syncOrderToSupabase(updated).catch(() => {});
    res.json({ success: true, order: updated });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// 7. Delete single order
app.delete('/api/orders/:id', authenticateStaff, requireRole('super_admin'), (req, res) => {
  try {
    const operatorName = (req.query.operatorName as string) || req.userSession?.name || 'Administrador';
    const deleted = deleteOrderTransactional(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Pedido não encontrado' });
    }

    broadcastOrdersUpdate('order_deleted', { id: req.params.id });

    logAuditAction({
      userName: operatorName,
      userRole: 'super_admin',
      action: `Excluiu o pedido ID "${req.params.id}"`,
      category: 'order',
    });

    res.json({ success: true, message: 'Pedido excluído com sucesso' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 8. Clear history (finished or all)
app.post('/api/orders/clear-history', authenticateStaff, requireRole('super_admin'), (req, res) => {
  try {
    const { slug, mode, operatorName } = req.body as { slug?: string; mode?: 'finished' | 'all'; operatorName?: string };
    const removedCount = clearOrdersTransactional(slug, mode);

    broadcastOrdersUpdate('history_cleared', { mode, slug });

    logAuditAction({
      userName: operatorName || req.userSession?.name || 'Administrador',
      userRole: 'super_admin',
      action: `Limpou histórico de pedidos (${removedCount} pedidos removidos - modo: ${mode || 'finished'})`,
      category: 'order',
    });

    res.json({ success: true, removedCount });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 9. MASTER RESET OF ORDERS (Super-Admin only, requires typed phrase "RESETAR PEDIDOS")
app.post('/api/orders/master-reset', authenticateStaff, requireRole('super_admin'), (req, res) => {
  try {
    const { confirmation, operatorName } = req.body as {
      confirmation: string;
      operatorName?: string;
    };

    if (confirmation !== 'RESETAR PEDIDOS') {
      return res.status(400).json({
        success: false,
        error: 'Confirmação inválida. Digite exatamente "RESETAR PEDIDOS" em maiúsculas.',
      });
    }

    const opName = operatorName || req.userSession?.name || 'SUPER ADMIN';
    const result = masterResetOrdersTransactional(opName);

    broadcastOrdersUpdate('master_reset', result);

    logAuditAction({
      userName: opName,
      userRole: 'super_admin',
      action: `[RESET MESTRE] Apagou permanentemente ${result.count} pedidos e histórico`,
      details: `Restaurantes afetados: ${result.affectedRestaurants.join(', ') || 'Nenhum'}. Clientes e cardápio preservados.`,
      category: 'order',
    });

    res.json({
      success: true,
      message: `Reset Mestre executado com sucesso: ${result.count} pedidos apagados.`,
      count: result.count,
      affectedRestaurants: result.affectedRestaurants,
      timestamp: result.timestamp,
    });
  } catch (error: any) {
    console.error('[MASTER RESET ERROR]:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 10. Multi-Restaurant Batch Order Creation
// Creates independent orders per restaurant from unified customer cart
app.post('/api/orders/batch', publicWriteLimiter, optionalStaffAuth, (req, res) => {
  try {
    const { ordersPayloads } = req.body as { ordersPayloads: any[] };

    if (!Array.isArray(ordersPayloads) || ordersPayloads.length === 0) {
      return res.status(400).json({ success: false, error: 'Lista de pedidos para processamento é obrigatória.' });
    }

    if (ordersPayloads.length > 10) {
      return res.status(400).json({ success: false, error: 'Máximo de 10 pedidos por lote.' });
    }
    const isStaffBatch = Boolean(req.userSession);
    const createdOrders = [];
    for (const payload of ordersPayloads) {
      const slug = String(payload?.restaurantSlug || '');
      if (isStaffBatch && !canAccessRestaurant(req, slug)) {
        return res.status(403).json({ success: false, error: 'Seu usuário não tem acesso a um dos restaurantes do lote.' });
      }
      if (!isStaffBatch) {
        if (String(payload?.orderType || '').toLowerCase().includes('mesa')) {
          const tableNumber = Number(payload?.tableNumber);
          if (!verifyTableAccessToken(payload?.tableAccessToken, slug, tableNumber)) {
            return res.status(403).json({ success: false, error: 'Pedido de mesa permitido somente pelo QR Code da mesa.' });
          }
        }
        delete payload.customerId;
      }
      const result = createOrderTransactional(payload, { isStaff: isStaffBatch });
      createdOrders.push(result.order);
      broadcastOrdersUpdate('order_created', result.order);
      syncOrderToSupabase(result.order).catch(() => {});
    }

    res.status(201).json({
      success: true,
      count: createdOrders.length,
      orders: createdOrders,
      message: `${createdOrders.length} pedido(s) gerados individualmente para cada restaurante com sucesso.`,
    });
  } catch (error: any) {
    console.error('[BATCH ORDERS ERROR]:', error.message);
    res.status(400).json({ success: false, error: error.message || 'Falha ao processar pedidos em lote.' });
  }
});

// ==========================================
// PASSWORD RECOVERY API
// ==========================================

app.post('/api/auth/forgot-password', resetLimiter, (req, res) => {
  try {
    const { channel, identifier } = req.body as { channel: 'email' | 'whatsapp'; identifier: string };
    if (!identifier) {
      return res.status(400).json({ success: false, error: 'Informe o e-mail ou WhatsApp cadastrado.' });
    }

    const result = requestPasswordReset(channel || 'email', identifier);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/auth/reset-password', resetLimiter, (req, res) => {
  try {
    const { token, newPassword } = req.body as { token: string; newPassword: string };
    if (!token || !newPassword) {
      return res.status(400).json({ success: false, error: 'Código de validação e nova senha são obrigatórios.' });
    }

    const result = confirmPasswordReset(token, newPassword, req.body?.identifier);
    if (!result.success) {
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// AUTHENTICATION & SESSIONS API
// ==========================================

// Recuperação administrativa: usa exclusivamente ADMIN_PASSWORD configurada
// no ambiente. Não existe senha fixa, senha mestre ou bypass público.
app.post('/api/auth/admin-reset', resetLimiter, (req, res) => {
  try {
    const configured = process.env.ADMIN_PASSWORD?.trim();
    if (!configured || configured.length < 8) {
      return res.status(503).json({
        success: false,
        error: 'Recuperação administrativa indisponível: configure ADMIN_PASSWORD com pelo menos 8 caracteres no ambiente.',
      });
    }

    const admin = findUserByUsername('admin');
    if (!admin) {
      return res.status(404).json({ success: false, error: 'Usuário admin não encontrado.' });
    }

    if (!verifyPassword(configured, admin.passwordHash, admin.passwordSalt)) {
      const updated = updateUser(admin.id, { newPassword: configured, operatorName: 'Recuperação administrativa' });
      revokeAllSessionsForUser(admin.id);
      logAuditAction({
        userName: 'Sistema',
        userRole: 'system',
        action: 'Senha do super administrador redefinida por ADMIN_PASSWORD',
        category: 'user',
      });
      return res.json({ success: true, message: 'Senha do administrador redefinida. Todas as sessões anteriores foram encerradas.', user: updated });
    }

    revokeAllSessionsForUser(admin.id);
    return res.json({ success: true, message: 'Senha do administrador já corresponde a ADMIN_PASSWORD. Sessões anteriores foram encerradas.' });
  } catch (error: any) {
    console.error('[ADMIN RESET ERROR]:', error);
    return res.status(500).json({ success: false, error: 'Não foi possível redefinir a senha do administrador.' });
  }
});

app.post('/api/auth/login', authLimiter, (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (typeof username !== 'string' || typeof password !== 'string' || !username || !password) {
      return res.status(400).json({ success: false, error: 'Login e senha são obrigatórios.' });
    }

    const lockKey = `${String(username).toLowerCase().trim()}|${getClientIp(req)}`;
    const lock = checkLoginLock(lockKey);
    if (lock.locked) {
      res.setHeader('Retry-After', String(lock.retryAfterSeconds));
      return res.status(429).json({
        success: false,
        error: `Muitas tentativas incorretas. Tente novamente em ${Math.ceil(lock.retryAfterSeconds / 60)} min.`,
        code: 'LOGIN_LOCKED',
      });
    }

    const user = findUserByUsername(username);
    // Mesma resposta para usuário inexistente, inativo ou senha errada (sem enumeração de contas)
    const invalid = () => {
      registerLoginFailure(lockKey);
      return res.status(401).json({ success: false, error: 'Login ou senha inválidos.' });
    };
    if (!user || !user.isActive) {
      return invalid();
    }
    if (!verifyPassword(password, user.passwordHash, user.passwordSalt)) {
      logAuditAction({ userName: user.name, userRole: user.role, action: `Tentativa de login falhou (@${user.username})`, details: `IP ${getClientIp(req)}`, category: 'user' });
      return invalid();
    }

    clearLoginFailures(lockKey);
    if (needsPasswordRehash(user.passwordHash)) {
      upgradeUserPasswordHash(user.id, password);
    }

    const { passwordHash, passwordSalt, ...safeUser } = user;
    const sessionToken = createUserSession(user.id);

    logAuditAction({
      userName: user.name,
      userRole: user.role,
      action: `Login realizado com sucesso (@${user.username})`,
      category: 'user',
    });

    res.json({ success: true, user: safeUser, token: sessionToken });
  } catch (error: any) {
    console.error('[AUTH ERROR]:', error);
    res.status(500).json({ success: false, error: 'Erro ao autenticar usuário.' });
  }
});

// Valida a sessão atual (usado pelo painel ao recarregar a página)
app.get('/api/auth/me', authenticateStaff, (req, res) => {
  const u = req.userSession!;
  res.json({ success: true, user: u });
});

// Staff Logout (Revoke active session token)
app.post('/api/auth/staff-logout', (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader) {
      revokeUserSession(authHeader.replace('Bearer ', '').trim());
    }
    res.json({ success: true, message: 'Sessão de colaborador encerrada com sucesso.' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// USERS & ROLES MANAGEMENT API (Super Admin Exclusive)
// ==========================================

app.get('/api/users', authenticateStaff, requireRole('super_admin'), (req, res) => {
  try {
    const users = getAllUsers();
    res.json({ success: true, users });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/users', authenticateStaff, requireRole('super_admin'), (req, res) => {
  try {
    const { name, username, password, role, restaurantSlug, customPermissions, operatorName } = req.body;
    if (!name || !username || !password || !role) {
      return res.status(400).json({ success: false, error: 'Nome, login, senha e função são obrigatórios.' });
    }

    const newUser = createUser({
      name,
      username,
      password,
      role,
      restaurantSlug,
      customPermissions,
      operatorName: operatorName || req.userSession?.name,
    });

    res.status(201).json({ success: true, user: newUser });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.put('/api/users/:id', authenticateStaff, requireRole('super_admin'), (req, res) => {
  try {
    const { name, role, restaurantSlug, restaurantAccess, isActive, permissions, newPassword, password, operatorName } = req.body;
    const updated = updateUser(req.params.id, {
      name,
      role,
      restaurantSlug: restaurantSlug || restaurantAccess,
      isActive,
      permissions,
      newPassword: newPassword || password,
      operatorName: operatorName || req.userSession?.name,
    });
    // Troca de senha, desativação ou mudança de função encerram as sessões abertas desse usuário
    if (newPassword || password || isActive === false || role) {
      revokeAllSessionsForUser(req.params.id);
    }
    res.json({ success: true, user: updated });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.patch('/api/users/:id', authenticateStaff, requireRole('super_admin'), (req, res) => {
  try {
    const { name, role, restaurantSlug, restaurantAccess, isActive, permissions, newPassword, password, operatorName } = req.body;
    const updated = updateUser(req.params.id, {
      name,
      role,
      restaurantSlug: restaurantSlug || restaurantAccess,
      isActive,
      permissions,
      newPassword: newPassword || password,
      operatorName: operatorName || req.userSession?.name,
    });
    // Troca de senha, desativação ou mudança de função encerram as sessões abertas desse usuário
    if (newPassword || password || isActive === false || role) {
      revokeAllSessionsForUser(req.params.id);
    }
    res.json({ success: true, user: updated });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.delete('/api/users/:id', authenticateStaff, requireRole('super_admin'), (req, res) => {
  try {
    const operatorName = (req.query.operatorName as string) || req.userSession?.name || 'Administrador';
    const deleted = deleteUser(req.params.id, operatorName);
    if (deleted) revokeAllSessionsForUser(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Usuário não encontrado.' });
    }
    res.json({ success: true, message: 'Usuário excluído com sucesso.' });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// ==========================================
// CONNECTED DEVICES (MOBILE RECEIVERS) API
// ==========================================

app.get('/api/devices', authenticateStaff, requireRole('super_admin', 'administrador'), (req, res) => {
  try {
    const devices = getAllDevices();
    res.json({ success: true, devices });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/devices/new-pairing-code', authenticateStaff, requireRole('super_admin', 'administrador'), (req, res) => {
  try {
    const code = generatePairingCode();
    res.json({ success: true, code });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/devices/pair', authLimiter, (req, res) => {
  try {
    const { pairingCode, deviceName, platform, soundType, volume } = req.body;
    if (!pairingCode) {
      return res.status(400).json({ success: false, error: 'Código de pareamento é obrigatório.' });
    }

    const device = registerOrPairDevice({
      pairingCode,
      deviceName: deviceName || 'Celular Alerta',
      platform,
      soundType,
      volume,
    });

    res.json({ success: true, device });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.post('/api/devices/ping', rateLimit({ key: 'dev-ping', max: 120, windowMs: 60 * 1000 }), (req, res) => {
  try {
    const { idOrCode } = req.body;
    if (!idOrCode) {
      return res.status(400).json({ success: false, error: 'Identificador do dispositivo é obrigatório.' });
    }
    const dev = updateDevicePing(idOrCode);
    res.json({ success: true, device: dev });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.patch('/api/devices/:id', authenticateStaff, requireRole('super_admin', 'administrador'), (req, res) => {
  try {
    const updated = updateDeviceSettings(req.params.id, req.body);
    res.json({ success: true, device: updated });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.delete('/api/devices/:id', authenticateStaff, requireRole('super_admin', 'administrador'), (req, res) => {
  try {
    const operatorName = (req.query.operatorName as string) || req.userSession?.name || 'Administrador';
    const disconnected = disconnectDevice(req.params.id, operatorName);
    if (!disconnected) {
      return res.status(404).json({ success: false, error: 'Dispositivo não encontrado.' });
    }
    res.json({ success: true, message: 'Dispositivo desconectado com sucesso.' });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// ==========================================
// AUDIT LOGS API
// ==========================================

app.get('/api/audit-logs', authenticateStaff, requireRole('super_admin', 'administrador'), (req, res) => {
  try {
    const limit = Number(req.query.limit) || 100;
    const logs = getAuditLogs(limit);
    res.json({ success: true, count: logs.length, logs });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/audit-logs', authenticateStaff, (req, res) => {
  try {
    const { action, details, category } = req.body;
    if (!action) {
      return res.status(400).json({ success: false, error: 'Ação é obrigatória.' });
    }
    logAuditAction({
      userName: req.userSession!.name,
      userRole: req.userSession!.role,
      action: String(action).slice(0, 300),
      details: details ? String(details).slice(0, 1000) : undefined,
      category: category || 'system',
    });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// CATÁLOGO (cardápio, restaurantes, categorias) — fonte única no servidor
// ==========================================

// Público: só o que o cliente precisa ver (sem custos, ficha técnica ou dados fiscais)
app.get('/api/public/catalog', (req, res) => {
  const etag = getCatalogEtag();
  res.setHeader('ETag', etag);
  res.setHeader('Cache-Control', 'no-cache');
  if (req.headers['if-none-match'] === etag) {
    return res.status(304).end();
  }
  res.json({ success: true, ...getPublicCatalog() });
});

// Painel: catálogo completo
app.get('/api/catalog', authenticateStaff, (req, res) => {
  const etag = `${getCatalogEtag()}-${req.userSession!.permissions?.can_view_menu ? 'f' : 'p'}`;
  res.setHeader('ETag', etag);
  res.setHeader('Cache-Control', 'private, no-cache');
  if (req.headers['if-none-match'] === etag) {
    return res.status(304).end();
  }
  // Perfis sem permissão de ver o cardápio interno (ex.: entregador) recebem só a versão pública
  if (req.userSession!.role !== 'super_admin' && !req.userSession!.permissions?.can_view_menu) {
    return res.json({ success: true, ...getPublicCatalog() });
  }
  const c = getCatalog();
  const scope = resolveScopedSlug(req);
  if (scope) {
    // Colaborador vinculado a um restaurante só recebe o próprio
    return res.json({
      success: true,
      version: c.version,
      restaurants: c.restaurants[scope] ? { [scope]: c.restaurants[scope] } : {},
      categories: c.categories.filter((x: any) => x.restaurantSlug === scope),
      menuItems: c.menuItems.filter((x: any) => x.restaurantSlug === scope),
      coupons: [],
    });
  }
  res.json({ success: true, ...c });
});

app.put('/api/catalog', authenticateStaff, requireRole('super_admin', 'administrador'), (req, res) => {
  try {
    const body = req.body || {};
    const scope = resolveScopedSlug(req);
    let input = body;

    if (scope) {
      // Usuário de um restaurante só altera o próprio: mescla com o restante já salvo
      const cur = getCatalog();
      input = {
        restaurants: { ...cur.restaurants, ...(body.restaurants?.[scope] ? { [scope]: body.restaurants[scope] } : {}) },
        categories: [
          ...cur.categories.filter((x: any) => x.restaurantSlug !== scope),
          ...(Array.isArray(body.categories) ? body.categories.filter((x: any) => x.restaurantSlug === scope) : []),
        ],
        menuItems: [
          ...cur.menuItems.filter((x: any) => x.restaurantSlug !== scope),
          ...(Array.isArray(body.menuItems) ? body.menuItems.filter((x: any) => x.restaurantSlug === scope) : []),
        ],
        coupons: cur.coupons,
      };
    } else if (req.userSession!.role !== 'super_admin') {
      // Administrador (não-super) não altera cupons
      input = { ...body, coupons: getCatalog().coupons };
    }

    const result = saveCatalog(input, req.userSession!.name);
    if (!result.success) {
      return res.status(400).json(result);
    }
    logAuditAction({
      userName: req.userSession!.name,
      userRole: req.userSession!.role,
      action: `Catálogo atualizado (versão ${result.version})`,
      category: 'system',
    });
    res.json(result);
  } catch (error: any) {
    console.error('[CATALOG ERROR]:', error);
    res.status(500).json({ success: false, error: 'Falha ao salvar o catálogo.' });
  }
});

// ==========================================
// ESTADO OPERACIONAL COMPARTILHADO (caixa, mesas, entregadores, CRM, configurações)
// ==========================================
function broadcastStateUpdate(key: string, version: number) {
  const payload = JSON.stringify({ event: 'state_updated', key, version, timestamp: new Date().toISOString() });
  sseOrderClients.forEach((client) => {
    try {
      client.res.write(`data: ${payload}\n\n`);
    } catch {
      /* cliente desconectado */
    }
  });
}

// Versões de todos os documentos que o usuário pode ler (barato: usado no polling de fallback)
app.get('/api/state', authenticateStaff, (req, res) => {
  const role = req.userSession!.role;
  const versions: Record<string, number> = {};
  for (const key of readableKeys(role)) versions[key] = getDoc(key)?.version ?? 0;
  res.json({ success: true, versions });
});

app.get('/api/state/:key', authenticateStaff, (req, res) => {
  const { key } = req.params;
  if (!isKnownKey(key)) return res.status(404).json({ success: false, error: 'Documento desconhecido.' });
  if (!canAccess(req.userSession!.role, key, 'read')) {
    return res.status(403).json({ success: false, error: 'Sem permissão para este documento.' });
  }
  const doc = getDoc(key);
  res.json({ success: true, key, exists: Boolean(doc), version: doc?.version ?? 0, value: doc?.value ?? null, updatedAt: doc?.updatedAt, updatedBy: doc?.updatedBy });
});

app.put('/api/state/:key', authenticateStaff, (req, res) => {
  const { key } = req.params;
  if (!isKnownKey(key)) return res.status(404).json({ success: false, error: 'Documento desconhecido.' });
  if (!canAccess(req.userSession!.role, key, 'write')) {
    return res.status(403).json({ success: false, error: 'Sem permissão para alterar este documento.' });
  }
  const { value, baseVersion } = req.body || {};
  if (typeof baseVersion !== 'number' || !Number.isInteger(baseVersion) || baseVersion < 0) {
    return res.status(400).json({ success: false, error: 'baseVersion (inteiro) é obrigatório.' });
  }
  const result: any = saveDoc(key, value, baseVersion, req.userSession!.name);
  if (result.ok) {
    broadcastStateUpdate(key, result.version);
    return res.json({ success: true, key, version: result.version, updatedAt: result.updatedAt });
  }
  if (result.conflict) {
    return res.status(409).json({
      success: false,
      conflict: true,
      error: 'Outro aparelho alterou este documento primeiro.',
      version: result.current?.version ?? 0,
      value: result.current?.value ?? null,
    });
  }
  return res.status(400).json({ success: false, error: result.error });
});

// ==========================================
// DIAGNÓSTICO REAL DE SEGURANÇA/CONFIGURAÇÃO (substitui checagens fixas "OK")
// ==========================================
app.get('/api/admin/system-audit', ...adminOnly, (req, res) => {
  type Check = { id: string; label: string; status: 'ok' | 'warn' | 'fail'; detail: string };
  const checks: Check[] = [];
  const add = (id: string, label: string, status: Check['status'], detail: string) => checks.push({ id, label, status, detail });

  add('production', 'Modo de execução', IS_PRODUCTION ? 'ok' : 'warn', IS_PRODUCTION ? 'NODE_ENV=production' : 'Executando em modo de desenvolvimento.');

  const defaults = listUsersWithDefaultPassword();
  add('default-passwords', 'Contas com senha padrão', defaults.length === 0 ? 'ok' : 'fail',
    defaults.length === 0 ? 'Nenhuma conta ativa usa senha padrão conhecida.' : `Troque a senha de: ${defaults.join(', ')}.`);

  add('admin-password', 'ADMIN_PASSWORD definida', process.env.ADMIN_PASSWORD && process.env.ADMIN_PASSWORD.length >= 8 ? 'ok' : 'warn',
    process.env.ADMIN_PASSWORD ? 'Definida no ambiente.' : 'Ausente: a senha inicial do admin foi gerada/definida no primeiro boot.');

  const cors = (process.env.CORS_ORIGINS || '').split(',').map((o) => o.trim()).filter(Boolean);
  add('cors', 'CORS restrito', 'ok', cors.length ? `Origens permitidas: ${cors.join(', ')}` : 'Somente mesma origem (recomendado quando cardápio e painel usam o mesmo domínio).');

  add('public-orders', 'Listagem de pedidos protegida', 'ok', 'GET /api/orders, stream e alterações exigem login de colaborador.');
  add('server-pricing', 'Preço validado no servidor', 'ok', 'Pedidos são recalculados a partir do catálogo do servidor.');

  add('fiscal', 'Emissão fiscal', 'warn', 'Desativada nesta versão. O sistema opera sem nota fiscal.');
  add('print-agent-key', 'Chave do agente de impressão', process.env.PRINT_AGENT_KEY ? 'ok' : 'warn', process.env.PRINT_AGENT_KEY ? 'Configurada.' : 'Sem PRINT_AGENT_KEY: apenas usuários logados acessam a fila de impressão.');
  add('gemini', 'IA (Gemini)', process.env.GEMINI_API_KEY ? 'ok' : 'warn', process.env.GEMINI_API_KEY ? 'Chave configurada.' : 'Sem chave: recursos de IA usam respostas locais.');
  add('cloudinary', 'Upload de imagens (Cloudinary)', isCloudinaryConfigured() ? 'ok' : 'warn', isCloudinaryConfigured() ? 'Configurado.' : 'Não configurado.');
  add('supabase', 'Backup em Supabase', isSupabaseConfigured() ? 'ok' : 'warn', isSupabaseConfigured() ? 'Configurado (cópia de pedidos).' : 'Não configurado: dados só em arquivos locais do servidor.');
  add('persistence', 'Persistência em disco', 'warn', `Dados em ${path.join(process.cwd(), 'data')}. Em hospedagens com disco efêmero (ex.: Render sem Persistent Disk) eles se perdem a cada deploy.`);

  const cat = getCatalog();
  add('catalog', 'Catálogo no servidor', 'ok', `Versão ${cat.version}: ${Object.keys(cat.restaurants).length} restaurante(s), ${cat.menuItems.length} itens.`);
  add('users', 'Usuários ativos', countActiveUsers() > 0 ? 'ok' : 'fail', `${countActiveUsers()} usuário(s) ativo(s).`);

  res.json({ success: true, generatedAt: new Date().toISOString(), checks });
});

// ==========================================
// FISCAL MODULE API (NFC-e, NF-e, CERTIFICADOS, CÁLCULO TRIBUTÁRIO)
// ==========================================
// Emissão fiscal desativada nesta versão: o sistema opera sem nota fiscal.

// Áreas internas (equipe) são servidas por um aplicativo SEPARADO (painel.html).
// Tudo o mais é o cardápio do cliente (index.html). Comparação por 1º segmento exato do caminho,
// então um restaurante chamado "BarDoZe" nunca cai no painel.
const STAFF_PATH_RE = /^\/(painelrestaurante|painel|admin|cozinha|bar|drinks|sushibar|pdv|garcom|mesas|salao|caixa|balcao|delivery|kanban|entregador|courier)(\/|$)/i;

async function startServer() {
  // Verifica se o diretório de dados persistentes parece "novo" em produção — sintoma
  // direto do bug de senha/usuários resetando a cada deploy (ver server/dataDir.ts).
  checkDataPersistence();
  // Falha rápido se os dados estiverem inconsistentes (em vez de subir com dados de exemplo)
  initializeCatalog();
  initializeOrders();
  countActiveUsers(); // inicializa usuários e aplica a migração de senhas padrão

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'custom',
    });
    app.use(vite.middlewares);
    app.get('*', async (req, res, next) => {
      if (req.path.startsWith('/api/')) return next();
      try {
        const isStaff = STAFF_PATH_RE.test(req.path) || req.path === '/painel.html';
        let html = fs.readFileSync(path.join(process.cwd(), isStaff ? 'painel.html' : 'index.html'), 'utf-8');
        html = await vite.transformIndexHtml(req.originalUrl, html);
        if (isStaff) res.setHeader('X-Robots-Tag', 'noindex, nofollow');
        res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
      } catch (e: any) {
        vite.ssrFixStacktrace(e);
        next(e);
      }
    });
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(
      express.static(distPath, {
        maxAge: '7d',
        index: false,
        setHeaders: (res, filePath) => {
          if (filePath.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          } else if (filePath.includes('/assets/')) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          }
        },
      })
    );
    app.get('*', (req, res) => {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      if (STAFF_PATH_RE.test(req.path) || req.path === '/painel.html') {
        res.setHeader('X-Robots-Tag', 'noindex, nofollow');
        return res.sendFile(path.join(distPath, 'painel.html'));
      }
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`NEXORO server running on http://0.0.0.0:${PORT}`);
  });
}

// Rotas /api inexistentes devolvem JSON 404 (nunca o HTML do app)
app.use('/api', (req, res) => {
  res.status(404).json({ success: false, error: 'Rota não encontrada.' });
});

startServer().catch((err) => {
  console.error('[FATAL] Falha ao iniciar o servidor:', err.message);
  process.exit(1);
});
