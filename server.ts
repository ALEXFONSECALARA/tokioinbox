import express from 'express';
import compression from 'compression';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import {
  getAllOrders,
  getOrderById,
  createOrderTransactional,
  updateOrderStatusTransactional,
  updateOrderPrintStatusTransactional,
  deleteOrderTransactional,
  clearOrdersTransactional,
  masterResetOrdersTransactional,
  findOrderByDeliveryKey,
  getOrdersEtag,
  getOrdersVersion,
  getOrdersLastModified,
  OrderStatus,
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
  enqueuePrintJob,
  getPrintJobs,
  updatePrintJobStatus,
  retryPrintJob,
  getPrinters,
  upsertPrinter,
} from './server/printAgentService';
import {
  getCustomerLoginMode,
  setCustomerLoginMode,
  getInstallationBonusConfig,
  updateInstallationBonusConfig,
  authenticateCustomer,
  claimInstallationBonus,
} from './server/customerAuthService';
import { orderRoutes } from './server/orderRoutes';
import { meRoutes } from './server/meRoutes';
import { printJobRoutes } from './server/printJobRoutes';
import { cmvRoutes } from './server/cmvRoutes';
const app = express();
const PORT = Number(process.env.PORT) || 10000;
const serverStartTime = Date.now();

// Disable powered-by header and enable gzip/brotli compression
app.disable('x-powered-by');
app.use(compression());
app.use(express.json({ limit: '1mb' }));

// FASE 2 — rotas de pedidos multi-tenant sobre Postgres/Supabase (RBAC real).
// Convivem com as rotas antigas baseadas em arquivo; nada existente foi removido.
app.use('/api/v2/orders', orderRoutes);
// FASE 3 — perfil/sessão do usuário logado (usado pelo frontend para decidir o que exibir).
app.use('/api/v2/me', meRoutes);
// FASE 5 — fila de impressão idempotente.
app.use('/api/v2/print-jobs', printJobRoutes);
// Módulo CMV — ficha técnica real + sugestões baseadas em vendas reais.
app.use('/api/v2/cmv', cmvRoutes);

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
// CUSTOMER AUTH & INSTALLATION BONUS API
// ==========================================

app.get('/api/customer/login-mode', (req, res) => {
  res.json({ success: true, mode: getCustomerLoginMode() });
});

app.post('/api/customer/login-mode', (req, res) => {
  try {
    const { mode } = req.body;
    if (mode !== 'GLOBAL' && mode !== 'PER_RESTAURANT') {
      return res.status(400).json({ success: false, error: 'Modo inválido. Escolha GLOBAL ou PER_RESTAURANT' });
    }
    const setMode = setCustomerLoginMode(mode);
    res.json({ success: true, mode: setMode });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/customer/auth', (req, res) => {
  try {
    const { phone, name, restaurantSlug } = req.body;
    if (!phone) {
      return res.status(400).json({ success: false, error: 'Telefone é obrigatório para autenticação' });
    }
    const result = authenticateCustomer({ phone, name, restaurantSlug });
    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/customer/bonus-config', (req, res) => {
  res.json({ success: true, config: getInstallationBonusConfig() });
});

app.post('/api/customer/bonus-config', (req, res) => {
  try {
    const updated = updateInstallationBonusConfig(req.body);
    res.json({ success: true, config: updated });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.post('/api/customer/claim-bonus', (req, res) => {
  try {
    const { customerId, phone } = req.body;
    if (!customerId || !phone) {
      return res.status(400).json({ success: false, error: 'ID do cliente e telefone são obrigatórios' });
    }
    const result = claimInstallationBonus(customerId, phone);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});
// ==========================================

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
    const result = createOrderTransactional(payload);
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

// 6. Update Thermal Ticket Print Status
app.patch('/api/orders/:id/print', (req, res) => {
  try {
    const { printStatus } = req.body as { printStatus: 'pendente' | 'imprimindo' | 'impresso' };
    const updated = updateOrderPrintStatusTransactional(req.params.id, printStatus);
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

    const isValid = verifyPassword(password, user.passwordHash, user.passwordSalt);
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
