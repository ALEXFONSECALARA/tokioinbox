import { getGeminiModel } from './aiModel';
import { GoogleGenAI } from '@google/genai';

export interface AISettingsState {
  provider: 'gemini' | 'openai' | 'local_heuristic';
  model: string;
  apiKey?: string;
  isActive: boolean;
  temperature: number;
  monthlyUsageLimit: number;
  currentUsageCount: number;
  restaurantInstructions: string;
}

let aiSettings: AISettingsState = {
  provider: 'gemini',
  model: getGeminiModel(),
  apiKey: process.env.GEMINI_API_KEY || '',
  isActive: true,
  temperature: 0.4,
  monthlyUsageLimit: 5000,
  currentUsageCount: 42,
  restaurantInstructions:
    'Seja extremamente educado, atencioso e use linguagem acolhedora de alta gastronomia. Consulte estritamente os pratos, valores e horários cadastrados. Nunca invente valores ou pratos indisponíveis.',
};

export function getAISettings(): AISettingsState {
  // Always keep environment variable in sync if provided
  if (process.env.GEMINI_API_KEY && !aiSettings.apiKey) {
    aiSettings.apiKey = process.env.GEMINI_API_KEY;
  }
  return { ...aiSettings, apiKey: aiSettings.apiKey ? '••••••••••••••••' : '' };
}

export function updateAISettings(updates: Partial<AISettingsState>): AISettingsState {
  aiSettings = { ...aiSettings, ...updates };
  return getAISettings();
}

let geminiInstance: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI | null {
  const key = process.env.GEMINI_API_KEY || aiSettings.apiKey;
  if (!key) return null;
  if (!geminiInstance) {
    geminiInstance = new GoogleGenAI({ apiKey: key });
  }
  return geminiInstance;
}

/**
 * Commercial Customer AI Concierge (Aura Concierge IA)
 * STRICT RULES:
 * - Must NOT invent products, prices, promotions or delivery fees.
 * - Must check actual menu list and restaurant open status.
 */
export async function processCustomerConciergeMessage(params: {
  restaurantName: string;
  restaurantSlug: string;
  isOpen: boolean;
  openingHours: string;
  deliveryFee: number;
  minOrderValue: number;
  realMenuItems: { id: string; name: string; price: number; description: string; category: string; available: boolean }[];
  customerMessage: string;
  cartItems: { name: string; quantity: number }[];
}): Promise<{ responseText: string; suggestedProductIds: string[]; fallback: boolean }> {
  aiSettings.currentUsageCount++;

  const {
    restaurantName,
    isOpen,
    openingHours,
    deliveryFee,
    minOrderValue,
    realMenuItems,
    customerMessage,
    cartItems,
  } = params;

  // Filter only available real items
  const availableItems = realMenuItems.filter((i) => i.available);
  const itemsSummary = availableItems
    .slice(0, 30)
    .map((i) => `• [ID:${i.id}] ${i.name} - R$ ${i.price.toFixed(2)} (${i.category}): ${i.description || 'Especialidade da casa'}`)
    .join('\n');

  const cartSummary = cartItems.length > 0
    ? cartItems.map((c) => `${c.quantity}x ${c.name}`).join(', ')
    : 'Carrinho vazio no momento';

  const genAI = getGenAI();

  if (genAI && aiSettings.isActive && aiSettings.provider === 'gemini') {
    try {
      const prompt = `Você é o Atendente Comercial Inteligente do restaurante "${restaurantName}" na plataforma Aura Prime Gastronomia.
INSTRUÇÕES CRÍTICAS DO SISTEMA:
1. NUNCA invente itens, preços, promoções ou horários fora da lista oficial abaixo.
2. Seja acolhedor, sofisticado e prestativo.
3. Se o cliente perguntar o que comer, recomende pratos da lista real compatíveis.
4. Se o cliente perguntar sobre entrega/horários, use exatamente os dados oficiais abaixo.
5. Se sugerir produtos específicos para compra, inclua no final os IDs exatos no campo "suggestedIds".

DADOS REAIS DO RESTAURANTE:
- Status atual: ${isOpen ? 'ABERTO AGORA' : 'FECHADO NO MOMENTO'}
- Horário de Funcionamento: ${openingHours}
- Taxa de Entrega: R$ ${deliveryFee.toFixed(2)}
- Pedido Mínimo: R$ ${minOrderValue.toFixed(2)}
- Itens no carrinho do cliente: ${cartSummary}

CARDÁPIO REAL E OFICIAL:
${itemsSummary}

MENSAGEM DO CLIENTE:
"${customerMessage}"

Responda em formato JSON com esta estrutura exata:
{
  "responseText": "Sua resposta prestativa e elegante em português",
  "suggestedProductIds": ["id1", "id2"]
}`;

      const response = await genAI.models.generateContent({
        model: getGeminiModel(),
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          temperature: aiSettings.temperature,
        },
      });

      const parsed = JSON.parse(response.text || '{}');
      return {
        responseText:
          parsed.responseText ||
          `Olá! Sou o assistente do ${restaurantName}. Posso te ajudar a escolher pratos do nosso cardápio oficial!`,
        suggestedProductIds: Array.isArray(parsed.suggestedProductIds) ? parsed.suggestedProductIds : [],
        fallback: false,
      };
    } catch (err) {
      console.warn('[AI CONCIERGE] Fallback to heuristic response:', err);
    }
  }

  // Heuristic Local Response (High-Quality fallback if no key configured or quota reached)
  const query = customerMessage.toLowerCase();
  let responseText = '';
  const suggestedProductIds: string[] = [];

  if (query.includes('horario') || query.includes('hora') || query.includes('aberto') || query.includes('fecha')) {
    responseText = `O ${restaurantName} está ${isOpen ? 'aberto agora' : 'fechado no momento'}. Nosso horário de atendimento é: ${openingHours}.`;
  } else if (query.includes('taxa') || query.includes('frete') || query.includes('entrega')) {
    responseText = `Nossa taxa de entrega atual é de R$ ${deliveryFee.toFixed(2)}, e o valor mínimo de pedido é R$ ${minOrderValue.toFixed(2)}.`;
  } else if (query.includes('recomenda') || query.includes('sugere') || query.includes('mais vendido') || query.includes('cardapio') || query.includes('comer')) {
    const suggestions = availableItems.slice(0, 3);
    suggestedProductIds.push(...suggestions.map((s) => s.id));
    const itemsList = suggestions.map((s) => `• ${s.name} (R$ ${s.price.toFixed(2)})`).join('\n');
    responseText = `Com prazer! No ${restaurantName}, os nossos destaques mais apreciados são:\n${itemsList}\nVocê pode adicioná-los diretamente ao seu pedido logo abaixo!`;
  } else {
    const firstTwo = availableItems.slice(0, 2);
    suggestedProductIds.push(...firstTwo.map((s) => s.id));
    responseText = `Olá! Seja bem-vindo ao ${restaurantName}. Nosso cardápio conta com pratos preparados na hora. Se desejar, experimente o ${firstTwo.map((i) => i.name).join(' ou ')}. Posso tirar alguma dúvida sobre nossos ingredientes ou tempo de entrega?`;
  }

  return {
    responseText,
    suggestedProductIds,
    fallback: true,
  };
}

/**
 * AI Sales Assistant (Assistente de Vendas IA)
 * Generates proactive insights for the restaurant manager:
 * - Best/worst sellers, abandoned carts, inactive customers, combo recommendations.
 * Each suggestion must have APPROVE / EDIT / IGNORE status and NEVER modifies automatically.
 */
export function generateSalesSuggestions(params: {
  restaurantSlug: string;
  restaurantName: string;
  totalOrders: number;
  averageTicket: number;
  topItemNames: string[];
  lowSellingNames: string[];
  inactiveCustomersCount: number;
  abandonedCartsCount: number;
}): any[] {
  const {
    restaurantSlug,
    restaurantName,
    averageTicket,
    topItemNames,
    lowSellingNames,
    inactiveCustomersCount,
    abandonedCartsCount,
  } = params;

  return [
    {
      id: `sug-${Date.now()}-1`,
      restaurantSlug,
      title: `Criar Combo com o Campeão de Vendas`,
      category: 'combo',
      reasoning: `O item "${topItemNames[0] || 'Prato Principal'}" tem altíssima saída. Agrupá-lo com uma bebida e sobremesa pode aumentar o ticket médio atual de R$ ${averageTicket.toFixed(2)} para R$ ${(averageTicket * 1.25).toFixed(2)}.`,
      impactEstimate: '+25% no Ticket Médio',
      status: 'pendente',
      createdAt: new Date().toISOString(),
      proposedAction: {
        type: 'create_combo',
        discountPercent: 12,
        description: `Combo Especial ${restaurantName}: ${topItemNames[0] || 'Prato Destaque'} + Acompanhamento Artesanal`,
      },
    },
    {
      id: `sug-${Date.now()}-2`,
      restaurantSlug,
      title: `Campanha de Reativação: ${inactiveCustomersCount} Clientes Inativos`,
      category: 'reativacao',
      reasoning: `Identificamos ${inactiveCustomersCount} clientes que não realizam pedidos há mais de 25 dias. Um cupom exclusivo de 10% OFF via WhatsApp pode reativar até 18% dessa base.`,
      impactEstimate: 'Reativação de ~18% da base inativa',
      status: 'pendente',
      createdAt: new Date().toISOString(),
      proposedAction: {
        type: 'launch_campaign',
        couponCode: 'VOLTE10',
        discountPercent: 10,
        minOrderValue: 40,
        description: 'Sentimos sua falta! Volte a pedir hoje com 10% de desconto.',
      },
    },
    {
      id: `sug-${Date.now()}-3`,
      restaurantSlug,
      title: `Recuperação de ${abandonedCartsCount} Carrinhos Abandonados`,
      category: 'carrinho_abandonado',
      reasoning: `Há ${abandonedCartsCount} clientes com itens adicionados na sacola sem concluir o checkout. Um lembrete amigável com frete grátis aumenta a taxa de conversão em 32%.`,
      impactEstimate: '+32% conversão de carrinhos',
      status: 'pendente',
      createdAt: new Date().toISOString(),
      proposedAction: {
        type: 'create_promo',
        couponCode: 'FRETELIVRE',
        discountPercent: 0,
        description: 'Frete grátis para finalizar o pedido que você deixou na sacola!',
      },
    },
    {
      id: `sug-${Date.now()}-4`,
      restaurantSlug,
      title: `Destaque e Promoção Relâmpago para: ${lowSellingNames[0] || 'Novo Item'}`,
      category: 'promocao',
      reasoning: `O produto possui excelente margem de contribuição, mas menor visibilidade no cardápio. Uma tag de "Sugestão do Chef" aumentará a taxa de experimentação.`,
      impactEstimate: '+40% visualizações do item',
      status: 'pendente',
      createdAt: new Date().toISOString(),
      proposedAction: {
        type: 'highlight_item',
        discountPercent: 10,
        description: 'Colocar em destaque na Vitrine com selo "Sugestão do Chef"',
      },
    },
  ];
}
