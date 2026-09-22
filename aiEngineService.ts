import { getGeminiModel } from './aiModel';
import fs from 'fs';
import path from 'path';
import { GoogleGenAI } from '@google/genai';

// Types for AI Engine Modular Architecture
export type AIModuleId = 'customer_concierge' | 'smart_pairing' | 'menu_engineering' | 'smart_kitchen';

export interface CustomerConciergeConfig {
  enabled: boolean;
  botName: string;
  personality: 'educado' | 'natural' | 'premium' | 'descontraido';
  toneOfVoice: string;
  greetingMessage: string;
  rules: string;
  allowedProductIds: string[]; // Whitelist (if empty, all available products are allowed)
  blockedProductIds: string[]; // Blacklist
  maxRecommendations: number;
  allergyNotice: string;
  unavailableItemNotice: string;
}

export interface SmartPairingConfig {
  enabled: boolean;
  suggestBeverages: boolean;
  suggestWines: boolean;
  suggestDesserts: boolean;
  respectLegalDrinkingAge: boolean;
  maxPairingSuggestions: number;
  ruleNotes: string;
}

export interface MenuEngineeringConfig {
  enabled: boolean;
  targetMarginPercent: number;
  defaultPeriodDays: 7 | 30 | 90;
  allowPriceSuggestions: boolean;
  maxPriceIncreasePercent: number;
  maxPriceDecreasePercent: number;
  requireSuperAdminApproval: boolean;
}

export interface SmartKitchenConfig {
  enabled: boolean;
  stations: string[]; // e.g. ['COZINHA', 'SUSHI BAR', 'BAR', 'SOBREMESAS', 'EXPEDICAO']
  soundAlertForAllergies: boolean;
  requireAllergyConfirmation: boolean;
  targetPrepTimeMinutes: number;
  delayThresholdMinutes: number;
}

export interface RestaurantAIConfig {
  restaurantSlug: string;
  customer_concierge: CustomerConciergeConfig;
  smart_pairing: SmartPairingConfig;
  menu_engineering: MenuEngineeringConfig;
  smart_kitchen: SmartKitchenConfig;
  updatedAt: string;
  updatedBy: string;
}

export interface AIAuditLog {
  id: string;
  timestamp: string;
  restaurantSlug: string;
  operatorUsername: string;
  operatorRole: string;
  moduleId: AIModuleId;
  action: string;
  previousValue: any;
  newValue: any;
  status: 'executado' | 'aprovado' | 'ignorado' | 'simulado';
  notes?: string;
}

export interface PriceSuggestionItem {
  id: string;
  productId: string;
  productName: string;
  category: string;
  restaurantSlug: string;
  currentPrice: number;
  suggestedPrice: number;
  currentCmvCost: number;
  currentCmvPercent: number;
  newCmvPercent: number;
  reasoning: string;
  estimatedImpact: string;
  matrixCategory: 'ESTRELA' | 'BURRO DE CARGA' | 'QUEBRA-CABEÇA' | 'CÃO';
  status: 'pendente' | 'aprovado' | 'ignorado';
  createdAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
}

import { DATA_DIR } from './dataDir'; // Caminho configurável via env DATA_DIR (ver server/dataDir.ts)
const CONFIG_FILE = path.join(DATA_DIR, 'ai_engine_config.json');
const LOGS_FILE = path.join(DATA_DIR, 'ai_audit_logs.json');
const SUGGESTIONS_FILE = path.join(DATA_DIR, 'ai_price_suggestions.json');

// Ensure data directory
if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (e) {
    console.error('Failed to create data dir:', e);
  }
}

// Default configs per restaurant
function getDefaultConfig(restaurantSlug: string): RestaurantAIConfig {
  const isJapones = restaurantSlug === 'japones';
  const isItaliano = restaurantSlug === 'italiano';
  const isPizza = restaurantSlug === 'pizza';
  const isBurger = restaurantSlug === 'hamburgueria';

  let stations = ['COZINHA', 'BAR', 'EXPEDIÇÃO'];
  if (isJapones) stations = ['SUSHI BAR', 'COZINHA QUENTE', 'BAR', 'EXPEDIÇÃO'];
  if (isPizza) stations = ['FORNO DE PIZZA', 'COZINHA', 'BAR', 'EXPEDIÇÃO'];
  if (isBurger) stations = ['CHAPA & BURGER', 'FRITADEIRA', 'BAR', 'EXPEDIÇÃO'];

  return {
    restaurantSlug,
    customer_concierge: {
      enabled: true,
      botName: isJapones ? 'Kenji Sommelier' : isItaliano ? 'Luigi Concierge' : 'Atendente Virtual',
      personality: 'premium',
      toneOfVoice: 'Educado, acolhedor, objetivo e prestativo. Sem excesso de emojis e sem pressionar o cliente.',
      greetingMessage: 'Olá! Sou o Atendente Virtual. Como posso te auxiliar com nosso cardápio oficial hoje?',
      rules: 'Nunca inventar pratos, preços ou ingredientes que não estejam na lista oficial. Jamais diagnosticar alergias médicas: orientar o cliente a confirmar restrições graves diretamente com a equipe do restaurante.',
      allowedProductIds: [],
      blockedProductIds: [],
      maxRecommendations: 3,
      allergyNotice: 'Informação importante: caso possua alergias graves ou intolerâncias severas, por gentileza contate diretamente nosso time pelo telefone ou WhatsApp para confirmação do preparo seguro.',
      unavailableItemNotice: 'Este item não está disponível no momento. Gostaria que eu sugerisse uma alternativa deliciosa do nosso cardápio?',
    },
    smart_pairing: {
      enabled: true,
      suggestBeverages: true,
      suggestWines: isItaliano || isJapones,
      suggestDesserts: true,
      respectLegalDrinkingAge: true,
      maxPairingSuggestions: 2,
      ruleNotes: 'Sugerir apenas bebidas, vinhos e sobremesas que estejam realmente cadastrados e disponíveis na loja.',
    },
    menu_engineering: {
      enabled: true,
      targetMarginPercent: 68,
      defaultPeriodDays: 30,
      allowPriceSuggestions: true,
      maxPriceIncreasePercent: 20,
      maxPriceDecreasePercent: 15,
      requireSuperAdminApproval: true,
    },
    smart_kitchen: {
      enabled: true,
      stations,
      soundAlertForAllergies: true,
      requireAllergyConfirmation: true,
      targetPrepTimeMinutes: 18,
      delayThresholdMinutes: 25,
    },
    updatedAt: new Date().toISOString(),
    updatedBy: 'system',
  };
}

// In-Memory Caches
let aiConfigsCache: Record<string, RestaurantAIConfig> = {};
let aiLogsCache: AIAuditLog[] = [];
let aiPriceSuggestionsCache: PriceSuggestionItem[] = [];

// Load config from disk
function loadConfigs() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
      aiConfigsCache = JSON.parse(raw);
    }
  } catch (err) {
    console.error('Error reading ai_engine_config.json:', err);
  }

  try {
    if (fs.existsSync(LOGS_FILE)) {
      const raw = fs.readFileSync(LOGS_FILE, 'utf-8');
      aiLogsCache = JSON.parse(raw);
    }
  } catch (err) {
    console.error('Error reading ai_audit_logs.json:', err);
  }

  try {
    if (fs.existsSync(SUGGESTIONS_FILE)) {
      const raw = fs.readFileSync(SUGGESTIONS_FILE, 'utf-8');
      aiPriceSuggestionsCache = JSON.parse(raw);
    }
  } catch (err) {
    console.error('Error reading ai_price_suggestions.json:', err);
  }
}

function persistConfigs() {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(aiConfigsCache, null, 2));
  } catch (err) {
    console.error('Error writing ai_engine_config.json:', err);
  }
}

function persistLogs() {
  try {
    // Keep max 500 logs
    if (aiLogsCache.length > 500) {
      aiLogsCache = aiLogsCache.slice(0, 500);
    }
    fs.writeFileSync(LOGS_FILE, JSON.stringify(aiLogsCache, null, 2));
  } catch (err) {
    console.error('Error writing ai_audit_logs.json:', err);
  }
}

function persistSuggestions() {
  try {
    fs.writeFileSync(SUGGESTIONS_FILE, JSON.stringify(aiPriceSuggestionsCache, null, 2));
  } catch (err) {
    console.error('Error writing ai_price_suggestions.json:', err);
  }
}

loadConfigs();

// Helpers to get Gemini Client with environment configuration
export function getAIEngineClient(): { client: GoogleGenAI | null; model: string; provider: string } {
  const apiKey = process.env.AI_API_KEY || process.env.GEMINI_API_KEY;
  const model = getGeminiModel();
  const provider = process.env.AI_PROVIDER || 'gemini';

  if (!apiKey) {
    return { client: null, model, provider };
  }

  return {
    client: new GoogleGenAI({ apiKey }),
    model,
    provider,
  };
}

// Sanitization to prevent prompt injection
export function sanitizePromptInput(input: string): string {
  if (!input || typeof input !== 'string') return '';
  return input
    .replace(/\[system\]/gi, '')
    .replace(/\[assistant\]/gi, '')
    .replace(/ignore all previous instructions/gi, '')
    .replace(/esqueça todas as instruções anteriores/gi, '')
    .replace(/desconsidere as regras/gi, '')
    .slice(0, 1000);
}

// Read Config for a Restaurant (strictly isolated)
export function getRestaurantAIConfig(restaurantSlug: string): RestaurantAIConfig {
  if (!aiConfigsCache[restaurantSlug]) {
    aiConfigsCache[restaurantSlug] = getDefaultConfig(restaurantSlug);
    persistConfigs();
  }
  return aiConfigsCache[restaurantSlug];
}

// Update Config for a Restaurant
export function updateRestaurantAIConfig(
  restaurantSlug: string,
  moduleId: AIModuleId,
  updates: any,
  operator: { username: string; role: string }
): RestaurantAIConfig {
  const current = getRestaurantAIConfig(restaurantSlug);
  const prevModuleConfig = { ...(current[moduleId] as any) };
  const newModuleConfig = { ...prevModuleConfig, ...updates };

  current[moduleId] = newModuleConfig as any;
  current.updatedAt = new Date().toISOString();
  current.updatedBy = operator.username;

  aiConfigsCache[restaurantSlug] = current;
  persistConfigs();

  // Log audit
  logAIAudit({
    restaurantSlug,
    operatorUsername: operator.username,
    operatorRole: operator.role,
    moduleId,
    action: `Atualização de configuração do módulo ${moduleId}`,
    previousValue: prevModuleConfig,
    newValue: newModuleConfig,
    status: 'executado',
  });

  return current;
}

// Audit Log Registration
export function logAIAudit(entry: Omit<AIAuditLog, 'id' | 'timestamp'>): AIAuditLog {
  const log: AIAuditLog = {
    id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    ...entry,
  };
  aiLogsCache.unshift(log);
  persistLogs();
  return log;
}

// Get Logs for a restaurant (or all if super admin)
export function getAIAuditLogs(restaurantSlug?: string): AIAuditLog[] {
  if (!restaurantSlug || restaurantSlug === 'all') {
    return aiLogsCache;
  }
  return aiLogsCache.filter((l) => l.restaurantSlug === restaurantSlug);
}

// Price Suggestions Store
export function getPriceSuggestions(restaurantSlug?: string): PriceSuggestionItem[] {
  if (!restaurantSlug || restaurantSlug === 'all') {
    return aiPriceSuggestionsCache;
  }
  return aiPriceSuggestionsCache.filter((s) => s.restaurantSlug === restaurantSlug);
}

export function savePriceSuggestions(suggestions: PriceSuggestionItem[]): void {
  // Replace or add
  suggestions.forEach((sug) => {
    const idx = aiPriceSuggestionsCache.findIndex((s) => s.id === sug.id || (s.productId === sug.productId && s.status === 'pendente'));
    if (idx >= 0) {
      aiPriceSuggestionsCache[idx] = sug;
    } else {
      aiPriceSuggestionsCache.unshift(sug);
    }
  });
  persistSuggestions();
}

export function resolvePriceSuggestion(
  suggestionId: string,
  action: 'aprovar' | 'ignorar',
  operator: { username: string; role: string }
): { success: boolean; suggestion?: PriceSuggestionItem; error?: string } {
  const sug = aiPriceSuggestionsCache.find((s) => s.id === suggestionId);
  if (!sug) {
    return { success: false, error: 'Sugestão não encontrada.' };
  }

  const prevStatus = sug.status;
  sug.status = action === 'aprovar' ? 'aprovado' : 'ignorado';
  sug.reviewedBy = operator.username;
  sug.reviewedAt = new Date().toISOString();

  persistSuggestions();

  logAIAudit({
    restaurantSlug: sug.restaurantSlug,
    operatorUsername: operator.username,
    operatorRole: operator.role,
    moduleId: 'menu_engineering',
    action: action === 'aprovar' ? 'Aprovação de alteração de preço sugerido pela IA' : 'Rejeição de sugestão de preço',
    previousValue: { price: sug.currentPrice, status: prevStatus },
    newValue: { price: action === 'aprovar' ? sug.suggestedPrice : sug.currentPrice, status: sug.status },
    status: action === 'aprovar' ? 'aprovado' : 'ignorado',
    notes: `Produto: ${sug.productName} (ID: ${sug.productId}). ${sug.reasoning}`,
  });

  return { success: true, suggestion: sug };
}
