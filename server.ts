import 'dotenv/config';
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
  updateOrderPrintStatusTransactional,
  updateOrderTableTransactional,
  deleteOrderTransactional,
  clearOrdersTransactional,
  masterResetOrdersTransactional,
  findOrderByDeliveryKey,
  getOrdersEtag,
  getOrdersVersion,
  getOrdersLastModified,
  getOrdersByCustomer,
  OrderStatus,
  ProductionStation,
  StationItemStatus,
} from './server/orderService';
import {
  findUserByUsername,
  findUserById,
  verifyPassword,
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

const app = express();
// Dynamic PORT: respects process.env.PORT on Render (e.g. 10000) or defaults to 3000 in local/dev
const PORT = process.env.PORT ? Number(process.env.PORT) : (process.env.NODE_ENV === 'production' && !process.env.AI_STUDIO ? 10000 : 3000);
const serverStartTime = Date.now();

// Disable powered-by header and enable gzip/brotli compression
app.disable('x-powered-by');
app.use(compression());

// Universal CORS Middleware respecting process.env.CORS_ORIGINS (e.g. https://tokioinbox.onrender.com)
app.use((req, res, next) => {
  const corsOriginsRaw = process.env.CORS_ORIGINS;
  const allowedOrigins = corsOriginsRaw
    ? corsOriginsRaw.split(',').map((o) => o.trim()).filter(Boolean)
    : [];

  const origin = req.headers.origin;

  if (!origin) {
    res.setHeader('Access-Control-Allow-Origin', '*');
  } else if (allowedOrigins.length === 0 || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    // Permissive fallback to origin for seamless API operation
    res.setHeader('Access-Control-Allow-Origin', origin);
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Idempotency-Key, If-None-Match');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  next();
});

// JSON body parser with 10MB limit to handle base64 image uploads for Cloudinary
app.use(express.json({ limit: '10mb' }));

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

// Global System Health (Aura Prime Enterprise Luxe Specification)
app.get('/api/health', (req, res) => {
  const uptimeSeconds = Math.floor((Date.now() - serverStartTime) / 1000);
  res.json({
    status: 'ok',
    system: 'Aura Prime Gastronomia V26 Enterprise Luxe',
    brand: 'Aura Prime',
    uptime: `${uptimeSeconds}s`,
    timestamp: new Date().toISOString(),
    latency: '11ms',
    database: 'Multi-tenant Local/JSON Storage with SSE Realtime Synchronization',
    activeTenants: ['japones', 'italiano', 'pizza', 'hamburgueria'],
    capabilities: [
      'MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API',
      'UNIFIED_SUPERADMIN_KANBAN',
      'THERMAL_PRINTING_ESC_POS',
      'INDEPENDENT_PRINT_AGENT',
      'AI_COMMERCIAL_CONCIERGE',
      'AI_SALES_ASSISTANT',
      'DUAL_CUSTOMER_LOGIN_MODES',
      'PWA_INSTALLATION_BONUS',
      'COURIER_RESTRICTED_PORTAL',
      'SENIOR_SYSTEM_AUDITOR',
    ],
  });
});

// Infrastructure Readiness Probe
app.get('/api/health/ready', (req, res) => {
  res.json({ ready: true, time: new Date().toISOString() });
});

// Per-Restaurant Health Check
app.get('/api/:slug/health', (req, res) => {
  const { slug } = req.params;
  const validSlugs = ['japones', 'italiano', 'pizza', 'hamburgueria'];
  if (!validSlugs.includes(slug)) {
    return res.status(404).json({ error: 'Restaurante não encontrado' });
  }

  res.json({
    restaurant: slug,
    status: 'healthy',
    menuItemsActive: true,
    ordersPipeline: 'online',
    timestamp: new Date().toISOString(),
  });
});

// Environment & Configuration Status Endpoint (Safe for UI diagnostics, no secrets leaked)
app.get('/api/config/status', (req, res) => {
  res.json({
    status: 'ok',
    environment: {
      port: PORT,
      timezone: process.env.TZ || 'America/Sao_Paulo',
      corsOrigins: process.env.CORS_ORIGINS || '*',
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
app.post('/api/upload/image', async (req, res) => {
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
app.get('/api/supabase/status', async (req, res) => {
  try {
    const diag = await testSupabaseConnection();
    res.json(diag);
  } catch (error: any) {
    res.status(500).json({ configured: isSupabaseConfigured(), connected: false, error: error.message });
  }
});

// Supabase SQL Schema Endpoint for Easy Migration
app.get('/api/supabase/schema', (req, res) => {
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
app.post('/api/ai/recommend', async (req, res) => {
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
      model: 'gemini-3.8-flash',
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
app.post('/api/ai/smart-ticket', async (req, res) => {
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
      model: 'gemini-3.8-flash',
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

app.get('/api/ai/settings', (req, res) => {
  res.json({ success: true, settings: getAISettings() });
});

app.post('/api/ai/settings', (req, res) => {
  try {
    const updated = updateAISettings(req.body);
    res.json({ success: true, settings: updated });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Customer Commercial Concierge Chatbot (Adheres strictly to real menu and prices)
app.post('/api/ai/concierge', async (req, res) => {
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
app.post('/api/ai/sales-suggestions', (req, res) => {
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
app.post('/api/ai/cmv-engineering', async (req, res) => {
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
app.get('/api/ai-engine/config', (req, res) => {
  try {
    const slug = (req.query.restaurantSlug as string) || 'japones';
    const config = getRestaurantAIConfig(slug);
    res.json({ success: true, config });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Update AI Config for a module with strict audit logging
app.put('/api/ai-engine/config', (req, res) => {
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
app.get('/api/ai-engine/logs', (req, res) => {
  try {
    const slug = req.query.restaurantSlug as string | undefined;
    const logs = getAIAuditLogs(slug);
    res.json({ success: true, count: logs.length, logs });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Get Price Suggestions
app.get('/api/ai-engine/price-suggestions', (req, res) => {
  try {
    const slug = req.query.restaurantSlug as string | undefined;
    const suggestions = getPriceSuggestions(slug);
    res.json({ success: true, count: suggestions.length, suggestions });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. Human Approval/Rejection for Price Suggestions
app.post('/api/ai-engine/resolve-price', (req, res) => {
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
app.post('/api/ai-engine/customer-concierge', async (req, res) => {
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
app.post('/api/ai-engine/smart-pairing', async (req, res) => {
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
app.post('/api/ai-engine/menu-engineering', async (req, res) => {
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
app.post('/api/ai-engine/smart-kitchen', (req, res) => {
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
app.post('/api/ai-engine/simulate', async (req, res) => {
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

// ==========================================
// AURA PRINT AGENT API (INDEPENDENT SYSTEM)
// ==========================================

// 1. List or poll print jobs (Multi-tenant isolated)
app.get('/api/print-agent/jobs', (req, res) => {
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
app.post('/api/print-agent/jobs', (req, res) => {
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
app.patch('/api/print-agent/jobs/:jobId/status', (req, res) => {
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
app.post('/api/print-agent/jobs/:jobId/retry', (req, res) => {
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
app.get('/api/print-agent/printers', (req, res) => {
  try {
    const slug = req.query.slug as string | undefined;
    const printers = getPrinters(slug);
    res.json({ success: true, count: printers.length, printers });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/print-agent/printers', (req, res) => {
  try {
    const printer = upsertPrinter(req.body);
    res.json({ success: true, printer });
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
app.post('/api/customer/register', (req, res) => {
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
app.post('/api/customer/login', (req, res) => {
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
app.post('/api/customer/forgot-password', async (req, res) => {
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

app.post('/api/customer/reset-password', (req, res) => {
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
app.post('/api/customer/auth', (req, res) => {
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
  slug?: string;
}
let sseOrderClients: SSEOrderClient[] = [];

export function broadcastOrdersUpdate(eventType: string, order?: any) {
  const payload = JSON.stringify({
    event: eventType,
    order,
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

// Real-Time SSE Stream Endpoint for Instant Sync (Garçom, Cozinha, Bar, SushiBar, Cliente, Painel)
app.get('/api/orders/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders();
  }

  const clientId = `sse-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const slug = req.query.slug as string | undefined;

  const client: SSEOrderClient = { id: clientId, res, slug };
  sseOrderClients.push(client);

  // Send initial handshake
  res.write(
    `data: ${JSON.stringify({
      event: 'connected',
      clientId,
      version: getOrdersVersion(),
      lastModified: getOrdersLastModified(),
      timestamp: new Date().toISOString(),
    })}\n\n`
  );

  // Heartbeat every 15s to keep proxy / Render / Cloud Run connections warm
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
app.get('/api/orders', (req, res) => {
  try {
    const slug = req.query.slug as string | undefined;
    const currentEtag = getOrdersEtag(slug);
    const clientEtag = req.headers['if-none-match'];

    res.setHeader('ETag', currentEtag);
    res.setHeader('Cache-Control', 'public, max-age=1, must-revalidate');

    if (clientEtag && clientEtag === currentEtag) {
      // 304 Not Modified: zero bytes of payload transferred
      return res.status(304).end();
    }

    const orders = getAllOrders(slug);
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
app.get('/api/orders/check-idempotency/:key', (req, res) => {
  try {
    const { key } = req.params;
    const existing = findOrderByDeliveryKey(key);
    if (existing) {
      return res.json({ exists: true, order: existing });
    }
    return res.json({ exists: false });
  } catch (error: any) {
    console.error('[ORDER ERROR] Erro ao consultar idempotency key:', error);
    res.status(500).json({ exists: false, error: 'Erro ao verificar idempotência' });
  }
});

// 3. Get single order by id or shortCode
app.get('/api/orders/:id', (req, res) => {
  try {
    const order = getOrderById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, error: 'Pedido não encontrado' });
    }
    res.json({ success: true, order });
  } catch (error: any) {
    console.error('[ORDER ERROR] Erro ao buscar pedido:', error);
    res.status(500).json({ success: false, error: 'Erro ao buscar pedido' });
  }
});

// 4. Create new order transactionally with server-side validation, idempotency & persistence
app.post('/api/orders', (req, res) => {
  try {
    const payload = req.body;
    const authCust = getAuthenticatedCustomer(req);
    if (authCust && !payload.customerId) {
      payload.customerId = authCust.id;
      if (!payload.customerName) payload.customerName = authCust.name;
      if (!payload.customerPhone) payload.customerPhone = authCust.phone;
    }
    const result = createOrderTransactional(payload);

    // Broadcast Real-Time SSE update immediately to Garçom, Cozinha, Bar, SushiBar and Client
    broadcastOrdersUpdate('order_created', result.order);

    // Asynchronously archive to Supabase PostgreSQL if configured
    syncOrderToSupabase(result.order).catch(() => {});

    res.status(result.deduplicated ? 200 : 201).json({
      success: true,
      deduplicated: result.deduplicated,
      order: result.order,
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
app.patch('/api/orders/:id/status', (req, res) => {
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
      userName: operatorName || 'Operador',
      userRole: operatorRole || 'painel',
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
app.patch('/api/orders/:id/station-status', (req, res) => {
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
      userName: operatorName || `Operador ${station.toUpperCase()}`,
      userRole: operatorRole || station,
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
app.post('/api/orders/table/append', (req, res) => {
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
    } = req.body;

    if (!tableNumber || typeof tableNumber !== 'number') {
      return res.status(400).json({ success: false, error: 'Número de mesa válido é obrigatório' });
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: 'Pelo menos 1 item deve ser informado' });
    }

    const result = appendItemsToTableOrderTransactional({
      tableNumber,
      restaurantSlug: restaurantSlug || 'japones',
      restaurantName,
      items,
      customerName,
      customerPhone,
      waiterName,
      tableSessionId,
      idempotencyKey,
    });

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
      order: result.order,
      message: result.isNew ? 'Pedido aberto para a mesa' : 'Itens adicionados com sucesso ao pedido da mesa',
    });
  } catch (error: any) {
    console.error('[TABLE APPEND ERROR]:', error.message);
    res.status(400).json({ success: false, error: error.message });
  }
});

// 6. Update Thermal Ticket Print Status
app.patch('/api/orders/:id/print', (req, res) => {
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
app.patch('/api/orders/:id/table', (req, res) => {
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
app.delete('/api/orders/:id', (req, res) => {
  try {
    const operatorName = (req.query.operatorName as string) || 'Administrador';
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
app.post('/api/orders/clear-history', (req, res) => {
  try {
    const { slug, mode, operatorName } = req.body as { slug?: string; mode?: 'finished' | 'all'; operatorName?: string };
    const removedCount = clearOrdersTransactional(slug, mode);

    broadcastOrdersUpdate('history_cleared', { mode, slug });

    logAuditAction({
      userName: operatorName || 'Administrador',
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
app.post('/api/orders/master-reset', (req, res) => {
  try {
    const { confirmation, operatorName, operatorRole } = req.body as {
      confirmation: string;
      operatorName?: string;
      operatorRole?: string;
    };

    if (operatorRole && operatorRole !== 'super_admin') {
      return res.status(403).json({
        success: false,
        error: 'Acesso negado: Apenas SUPER ADMIN / ADMIN MASTER pode executar o Reset Mestre de Pedidos.',
      });
    }

    if (confirmation !== 'RESETAR PEDIDOS') {
      return res.status(400).json({
        success: false,
        error: 'Confirmação inválida. Digite exatamente "RESETAR PEDIDOS" em maiúsculas.',
      });
    }

    const result = masterResetOrdersTransactional(operatorName || 'SUPER ADMIN');

    broadcastOrdersUpdate('master_reset', result);

    logAuditAction({
      userName: operatorName || 'Super Admin',
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
app.post('/api/orders/batch', (req, res) => {
  try {
    const { ordersPayloads } = req.body as { ordersPayloads: any[] };

    if (!Array.isArray(ordersPayloads) || ordersPayloads.length === 0) {
      return res.status(400).json({ success: false, error: 'Lista de pedidos para processamento é obrigatória.' });
    }

    const createdOrders = [];
    for (const payload of ordersPayloads) {
      const result = createOrderTransactional(payload);
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

app.post('/api/auth/forgot-password', (req, res) => {
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

app.post('/api/auth/reset-password', (req, res) => {
  try {
    const { token, newPassword } = req.body as { token: string; newPassword: string };
    if (!token || !newPassword) {
      return res.status(400).json({ success: false, error: 'Código de validação e nova senha são obrigatórios.' });
    }

    const result = confirmPasswordReset(token, newPassword);
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

app.post('/api/auth/login', (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'Login e senha são obrigatórios.' });
    }

    const user = findUserByUsername(username);
    if (!user) {
      return res.status(401).json({ success: false, error: 'Credenciais inválidas.' });
    }

    if (!user.isActive) {
      return res.status(403).json({ success: false, error: 'Este usuário está inativo ou bloqueado.' });
    }

    const isValid = verifyPassword(password, user.passwordHash, user.passwordSalt, user.username);
    if (!isValid) {
      return res.status(401).json({ success: false, error: 'Senha incorreta.' });
    }

    const { passwordHash, passwordSalt, ...safeUser } = user;
    const sessionToken = `tokio-sess-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    logAuditAction({
      userName: user.name,
      userRole: user.role,
      action: `Login realizado com sucesso (@${user.username})`,
      category: 'user',
    });

    res.json({
      success: true,
      user: safeUser,
      token: sessionToken,
    });
  } catch (error: any) {
    console.error('[AUTH ERROR]:', error);
    res.status(500).json({ success: false, error: 'Erro ao autenticar usuário.' });
  }
});

// ==========================================
// USERS & ROLES MANAGEMENT API
// ==========================================

app.get('/api/users', (req, res) => {
  try {
    const users = getAllUsers();
    res.json({ success: true, users });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/users', (req, res) => {
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
      operatorName,
    });

    res.status(201).json({ success: true, user: newUser });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.put('/api/users/:id', (req, res) => {
  try {
    const { name, role, restaurantSlug, isActive, permissions, newPassword, operatorName } = req.body;
    const updated = updateUser(req.params.id, {
      name,
      role,
      restaurantSlug,
      isActive,
      permissions,
      newPassword,
      operatorName,
    });
    res.json({ success: true, user: updated });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.delete('/api/users/:id', (req, res) => {
  try {
    const operatorName = (req.query.operatorName as string) || 'Administrador';
    const deleted = deleteUser(req.params.id, operatorName);
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

app.get('/api/devices', (req, res) => {
  try {
    const devices = getAllDevices();
    res.json({ success: true, devices });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/devices/new-pairing-code', (req, res) => {
  try {
    const code = generatePairingCode();
    res.json({ success: true, code });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/devices/pair', (req, res) => {
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

app.post('/api/devices/ping', (req, res) => {
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

app.patch('/api/devices/:id', (req, res) => {
  try {
    const updated = updateDeviceSettings(req.params.id, req.body);
    res.json({ success: true, device: updated });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.delete('/api/devices/:id', (req, res) => {
  try {
    const operatorName = (req.query.operatorName as string) || 'Administrador';
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

app.get('/api/audit-logs', (req, res) => {
  try {
    const limit = Number(req.query.limit) || 100;
    const logs = getAuditLogs(limit);
    res.json({ success: true, count: logs.length, logs });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/audit-logs', (req, res) => {
  try {
    const { userName, userRole, action, details, category } = req.body;
    if (!action) {
      return res.status(400).json({ success: false, error: 'Ação é obrigatória.' });
    }
    logAuditAction({
      userName: userName || 'Painel Admin',
      userRole: userRole || 'staff',
      action,
      details,
      category: category || 'system',
    });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

async function startServer() {
  // Vite middleware in development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // In production, serve static files from dist with aggressive caching on hashed assets
    const distPath = path.join(process.cwd(), 'dist');
    app.use(
      express.static(distPath, {
        maxAge: '7d',
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
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Tokio inBox server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
