import {
  getAIEngineClient,
  getRestaurantAIConfig,
  sanitizePromptInput,
  PriceSuggestionItem,
  savePriceSuggestions,
  logAIAudit,
} from './aiEngineService';

export interface MenuItemData {
  id: string;
  name: string;
  price: number;
  cmvCost?: number;
  cost?: number;
  category?: string;
  categoryId?: string;
  description?: string;
  available?: boolean;
  isVegetarian?: boolean;
  isVegan?: boolean;
  isGlutenFree?: boolean;
  isLactoseFree?: boolean;
  isSpicy?: boolean;
  tags?: string[];
  preparationTime?: number;
}

export interface OrderItemData {
  id?: string;
  name: string;
  quantity: number;
  price?: number;
  selectedOptions?: { name: string; price?: number }[];
  notes?: string;
}

export interface OrderData {
  id: string;
  shortCode: string;
  restaurantSlug: string;
  restaurantName?: string;
  customerName: string;
  customerPhone?: string;
  orderType: 'delivery' | 'retirada' | 'mesa';
  tableNumber?: string;
  status: 'recebido' | 'aceito' | 'em_preparo' | 'pronto' | 'entregue' | 'cancelado';
  items: OrderItemData[];
  notes?: string;
  allergies?: string[];
  total: number;
  createdAt: string;
}

// --------------------------------------------------------------------------
// 1. ATENDENTE VIRTUAL & CONCIERGE DO CLIENTE
// --------------------------------------------------------------------------
export async function executeCustomerConcierge(params: {
  restaurantSlug: string;
  restaurantName: string;
  isOpen: boolean;
  openingHours: string;
  deliveryFee: number;
  minOrderValue: number;
  menuItems: MenuItemData[];
  customerMessage: string;
  cartItems: { name: string; quantity: number }[];
}): Promise<{
  responseText: string;
  suggestedProductIds: string[];
  suggestedProducts: { id: string; name: string; price: number; category?: string }[];
  hasAllergyNotice: boolean;
  fallback: boolean;
}> {
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
  } = params;

  const config = getRestaurantAIConfig(restaurantSlug).customer_concierge;
  const cleanMessage = sanitizePromptInput(customerMessage);

  // Check if disabled
  if (!config.enabled) {
    return {
      responseText: `Olá! Seja bem-vindo ao ${restaurantName}. Nosso atendimento de pedidos está disponível. Como podemos ajudar?`,
      suggestedProductIds: [],
      suggestedProducts: [],
      hasAllergyNotice: false,
      fallback: true,
    };
  }

  // Filter allowed items respecting whitelist, blacklist and availability
  let eligibleItems = menuItems.filter((m) => m.available !== false);
  if (config.allowedProductIds && config.allowedProductIds.length > 0) {
    eligibleItems = eligibleItems.filter((m) => config.allowedProductIds.includes(m.id));
  }
  if (config.blockedProductIds && config.blockedProductIds.length > 0) {
    eligibleItems = eligibleItems.filter((m) => !config.blockedProductIds.includes(m.id));
  }

  const itemsSummary = eligibleItems.slice(0, 35).map((m) => {
    const dietary = [
      m.isVegetarian ? 'Vegetariano' : null,
      m.isVegan ? 'Vegano' : null,
      m.isGlutenFree ? 'Sem Glúten' : null,
      m.isLactoseFree ? 'Sem Lactose' : null,
      m.isSpicy ? 'Picante' : null,
    ].filter(Boolean).join(', ');

    return `• [ID:${m.id}] ${m.name} - R$ ${m.price.toFixed(2)} (${m.category || m.categoryId || 'Geral'})${
      dietary ? ` [${dietary}]` : ''
    }: ${m.description || 'Especialidade da casa'}`;
  }).join('\n');

  const cartSummary = cartItems.length > 0
    ? cartItems.map((c) => `${c.quantity}x ${c.name}`).join(', ')
    : 'Carrinho vazio no momento';

  const isAskingAboutAllergies = /alergia|alérgic|intoler|celíac|glúten|lactose|amendoim|camarão|frutos do mar/i.test(cleanMessage);

  const { client, model } = getAIEngineClient();

  if (client) {
    try {
      const prompt = `Você é o "${config.botName}", Atendente Virtual do restaurante "${restaurantName}".
PERSONALIDADE E TOM DE VOZ:
- Personalidade: ${config.personality}
- Tom de voz: ${config.toneOfVoice}
- Regras de atendimento do restaurante: ${config.rules}

REGRAS MANDATÓRIAS DE SEGURANÇA:
1. NUNCA invente itens, preços, promoções ou ingredientes fora da lista oficial abaixo. Se uma informação não estiver cadastrada, informe educadamente que não possui essa informação cadastrada.
2. NUNCA diagnostique alergias ou condições médicas. Se o cliente citar alergias ou restrições graves, apresente a seguinte orientação oficial: "${config.allergyNotice}".
3. Se o cliente perguntar o que comer ou pedir sugestão, recomende até no máximo ${config.maxRecommendations} produtos da lista oficial.
4. Se o item estiver indisponível ou fora da lista, utilize a orientação: "${config.unavailableItemNotice}".
5. Sem respostas robóticas, sem excesso de emojis, linguagem simples, acolhedora e elegante. Não pressione o cliente para comprar.

DADOS REAIS DO RESTAURANTE:
- Status atual: ${isOpen ? 'ABERTO AGORA' : 'FECHADO NO MOMENTO'}
- Horário de Funcionamento: ${openingHours}
- Taxa de Entrega: R$ ${deliveryFee.toFixed(2)}
- Pedido Mínimo: R$ ${minOrderValue.toFixed(2)}
- Itens no carrinho do cliente: ${cartSummary}

CARDÁPIO OFICIAL REAL:
${itemsSummary}

MENSAGEM DO CLIENTE:
"${cleanMessage}"

Responda ESTRITAMENTE em formato JSON com a seguinte estrutura:
{
  "responseText": "Texto elegante, acolhedor e prestativo em português",
  "suggestedProductIds": ["id1", "id2"],
  "hasAllergyNotice": ${isAskingAboutAllergies ? 'true' : 'false'}
}`;

      const response = await client.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.3,
        },
      });

      const parsed = JSON.parse(response.text || '{}');
      const suggestedIds: string[] = Array.isArray(parsed.suggestedProductIds)
        ? parsed.suggestedProductIds.slice(0, config.maxRecommendations)
        : [];

      const matchedProducts = eligibleItems
        .filter((i) => suggestedIds.includes(i.id))
        .map((i) => ({ id: i.id, name: i.name, price: i.price, category: i.category || i.categoryId }));

      return {
        responseText: parsed.responseText || config.greetingMessage,
        suggestedProductIds: suggestedIds,
        suggestedProducts: matchedProducts,
        hasAllergyNotice: Boolean(parsed.hasAllergyNotice || isAskingAboutAllergies),
        fallback: false,
      };
    } catch (err) {
      console.warn('[AI ENGINE - Concierge] Error during Gemini generation, falling back to local heuristic:', err);
    }
  }

  // Local Heuristic Fallback
  const q = cleanMessage.toLowerCase();
  let text = '';
  const suggested: MenuItemData[] = [];

  if (isAskingAboutAllergies) {
    text = `${config.allergyNotice} Nossos pratos são preparados artesanalmente e nossa equipe terá o maior cuidado em esclarecer todos os detalhes da ficha técnica.`;
  } else if (q.includes('horario') || q.includes('hora') || q.includes('aberto') || q.includes('fecha')) {
    text = `O ${restaurantName} está ${isOpen ? 'aberto agora' : 'fechado no momento'}. Nosso horário de funcionamento é: ${openingHours}.`;
  } else if (q.includes('frete') || q.includes('taxa') || q.includes('entrega')) {
    text = `Nossa taxa de entrega para o seu endereço é de R$ ${deliveryFee.toFixed(2)}, com pedido mínimo de R$ ${minOrderValue.toFixed(2)}.`;
  } else if (q.includes('vegano') || q.includes('vegetariano') || q.includes('sem carne')) {
    const veg = eligibleItems.filter((i) => i.isVegan || i.isVegetarian).slice(0, 3);
    suggested.push(...veg);
    if (veg.length > 0) {
      text = `Temos excelentes opções vegetarianas/veganas cadastradas: ${veg.map((v) => v.name).join(', ')}. Posso adicionar alguma ao seu pedido?`;
    } else {
      text = `No momento, não temos itens marcados explicitamente como veganos no cardápio cadastrado. Consulte nossa equipe para personalização!`;
    }
  } else if (q.includes('recomenda') || q.includes('sugere') || q.includes('mais vendido') || q.includes('comer') || q.includes('leve')) {
    const picks = eligibleItems.slice(0, config.maxRecommendations);
    suggested.push(...picks);
    text = `Com certeza! Recomendo experimentar nossos destaques: ${picks.map((p) => `${p.name} (R$ ${p.price.toFixed(2)})`).join(', ')}. São preparados com ingredientes frescos da mais alta qualidade.`;
  } else {
    const picks = eligibleItems.slice(0, 2);
    suggested.push(...picks);
    text = `Olá! ${config.greetingMessage} Recomendo dar uma olhada em ${picks.map((p) => p.name).join(' ou ')}. Posso esclarecer detalhes de ingredientes ou tempos de preparo?`;
  }

  return {
    responseText: text,
    suggestedProductIds: suggested.map((s) => s.id),
    suggestedProducts: suggested.map((s) => ({ id: s.id, name: s.name, price: s.price, category: s.category })),
    hasAllergyNotice: isAskingAboutAllergies,
    fallback: true,
  };
}

// --------------------------------------------------------------------------
// 2. CHEF & SOMMELIER VIRTUAL (SMART PAIRING AI)
// --------------------------------------------------------------------------
export interface SmartPairingSuggestion {
  dishName: string;
  pairingType: 'bebida' | 'vinho' | 'sobremesa' | 'adicional';
  productId: string;
  productName: string;
  price: number;
  chefTitle: string; // "Sugestão do Chef"
  reason: string; // "Por que combina"
  badge: string; // e.g. "Harmonização Clássica", "Refrescância Perfeita"
}

export async function executeSmartPairing(params: {
  restaurantSlug: string;
  restaurantName: string;
  cartItems: OrderItemData[];
  menuItems: MenuItemData[];
}): Promise<{
  suggestions: SmartPairingSuggestion[];
  executiveChefNote: string;
  fallback: boolean;
}> {
  const { restaurantSlug, restaurantName, cartItems, menuItems } = params;
  const config = getRestaurantAIConfig(restaurantSlug).smart_pairing;

  if (!config.enabled || cartItems.length === 0) {
    return {
      suggestions: [],
      executiveChefNote: 'Adicione itens à sacola para receber harmonizações personalizadas do Chef.',
      fallback: false,
    };
  }

  // Available real drinks, wines, desserts in menu
  const availableItems = menuItems.filter((m) => m.available !== false);

  const drinksAndWines = availableItems.filter((m) => {
    const cat = (m.category || m.categoryId || '').toLowerCase();
    const name = m.name.toLowerCase();
    return cat.includes('bebid') || cat.includes('bebidas') || cat.includes('vinho') || cat.includes('wine') || cat.includes('drink') || cat.includes('cerveja') || cat.includes('suco') || name.includes('suco') || name.includes('refrigerante') || name.includes('cerveja') || name.includes('vinho') || name.includes('chá');
  });

  const desserts = availableItems.filter((m) => {
    const cat = (m.category || m.categoryId || '').toLowerCase();
    const name = m.name.toLowerCase();
    return cat.includes('sobremes') || cat.includes('doce') || cat.includes('sobremesa') || name.includes('sorvete') || name.includes('torta') || name.includes('pudim') || name.includes('brownie') || name.includes('petit gateau') || name.includes('mousse');
  });

  const cartItemNames = cartItems.map((c) => c.name);
  const { client, model } = getAIEngineClient();

  if (client && (drinksAndWines.length > 0 || desserts.length > 0)) {
    try {
      const prompt = `Você é o Chef & Sommelier Executivo do restaurante "${restaurantName}".
OBJETIVO:
Analisar o carrinho do cliente e sugerir combinações verdadeiramente harmoniosas baseadas APENAS nos produtos reais cadastrados.

ITENS NA SACOLA DO CLIENTE:
${JSON.stringify(cartItems.map((i) => ({ name: i.name, quantity: i.quantity, notes: i.notes })))}

BEBIDAS E VINHOS DISPONÍVEIS NO CARDÁPIO REAL:
${drinksAndWines.map((d) => `• [ID:${d.id}] ${d.name} - R$ ${d.price.toFixed(2)}`).join('\n') || 'Nenhum'}

SOBREMESAS DISPONÍVEIS NO CARDÁPIO REAL:
${desserts.map((d) => `• [ID:${d.id}] ${d.name} - R$ ${d.price.toFixed(2)}`).join('\n') || 'Nenhuma'}

REGRAS RÍGIDAS:
1. NUNCA invente bebida, vinho ou sobremesa. Use APENAS itens com os IDs e nomes acima.
2. Se o prato for sushi ou culinária oriental: sugira chá gelado, cerveja artesanal ou vinho branco/verde compatível.
3. Se o prato for carne ou hambúrguer: sugira bebida gelada encorpada ou vinho tinto se houver.
4. Se o prato for picante: sugira bebida refrescante ou doce que neutralize a capsaicina.
5. Se for prato principal: sugira uma sobremesa compatível para finalizar com chave de ouro.
6. Retorne no máximo ${config.maxPairingSuggestions} sugestões.
7. Não adicione nada ao carrinho automaticamente.

Responda ESTRITAMENTE em formato JSON:
{
  "executiveChefNote": "Comentário acolhedor do Chef sobre o equilíbrio do pedido",
  "suggestions": [
    {
      "dishName": "Nome do prato principal da sacola",
      "pairingType": "bebida" | "vinho" | "sobremesa",
      "productId": "ID exato do produto cadastrado",
      "productName": "Nome exato do produto",
      "price": 0.0,
      "chefTitle": "Sugestão do Chef",
      "reason": "Explicação sensorial elegante de por que combina",
      "badge": "Harmonização Perfeita"
    }
  ]
}`;

      const response = await client.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.2,
        },
      });

      const parsed = JSON.parse(response.text || '{}');
      const validSuggestions: SmartPairingSuggestion[] = [];

      if (Array.isArray(parsed.suggestions)) {
        for (const s of parsed.suggestions) {
          const match = availableItems.find((m) => m.id === s.productId || m.name.toLowerCase() === (s.productName || '').toLowerCase());
          if (match) {
            validSuggestions.push({
              dishName: s.dishName || cartItemNames[0] || 'Seu Pedido',
              pairingType: s.pairingType || 'bebida',
              productId: match.id,
              productName: match.name,
              price: match.price,
              chefTitle: s.chefTitle || 'Sugestão do Chef',
              reason: s.reason || 'Harmoniza perfeitamente com as notas e texturas do seu prato.',
              badge: s.badge || 'Harmonização do Chef',
            });
          }
        }
      }

      if (validSuggestions.length > 0) {
        return {
          suggestions: validSuggestions.slice(0, config.maxPairingSuggestions),
          executiveChefNote: parsed.executiveChefNote || 'Harmonização exclusiva desenhada pelo Chef para a sua seleção de pratos.',
          fallback: false,
        };
      }
    } catch (err) {
      console.warn('[AI ENGINE - Smart Pairing] Error during pairing generation:', err);
    }
  }

  // Heuristic Smart Pairing Fallback
  const fallbackSuggestions: SmartPairingSuggestion[] = [];
  const mainDishName = cartItemNames[0] || 'Prato Principal';

  if (drinksAndWines.length > 0) {
    const drink = drinksAndWines[0];
    fallbackSuggestions.push({
      dishName: mainDishName,
      pairingType: 'bebida',
      productId: drink.id,
      productName: drink.name,
      price: drink.price,
      chefTitle: 'Sugestão do Chef',
      reason: `Uma bebida fresca que equilibra e realça o sabor artesanal de "${mainDishName}".`,
      badge: 'Harmonização Clássica',
    });
  }

  if (desserts.length > 0 && fallbackSuggestions.length < config.maxPairingSuggestions) {
    const dessert = desserts[0];
    fallbackSuggestions.push({
      dishName: mainDishName,
      pairingType: 'sobremesa',
      productId: dessert.id,
      productName: dessert.name,
      price: dessert.price,
      chefTitle: 'Sugestão do Chef',
      reason: `Feche sua experiência gastronômica com a nossa tradicional sobremesa artesanal.`,
      badge: 'Final Doce Perfeito',
    });
  }

  return {
    suggestions: fallbackSuggestions,
    executiveChefNote: 'O Chef selecionou opções frescas para acompanhar sua escolha.',
    fallback: true,
  };
}

// --------------------------------------------------------------------------
// 3. ENGENHEIRO DE CARDÁPIO & CONSULTOR CMV (MATRIZ BCG)
// --------------------------------------------------------------------------
export interface MatrixBcgProduct {
  id: string;
  name: string;
  category: string;
  price: number;
  cost: number;
  cmvPercent: number; // (cost / price) * 100
  grossMargin: number; // price - cost
  grossMarginPercent: number; // ((price - cost) / price) * 100
  quantitySold: number;
  revenue: number;
  matrixCategory: 'ESTRELA' | 'BURRO DE CARGA' | 'QUEBRA-CABEÇA' | 'CÃO';
  suggestedPrice: number;
  suggestedAction: string;
  reasoning: string;
  potentialImpact: string;
}

export interface MenuEngineeringDiagnostic {
  periodDays: number;
  periodLabel: string;
  totalRevenue: number;
  averageCmvPercent: number;
  totalProductsAnalyzed: number;
  starsCount: number;
  plowhorsesCount: number;
  puzzlesCount: number;
  dogsCount: number;
  topMarginProducts: { id: string; name: string; margin: number }[];
  topSellingProducts: { id: string; name: string; qty: number }[];
  highCmvProducts: { id: string; name: string; cmv: number }[];
  attentionNeededProducts: { id: string; name: string; reason: string }[];
  categoryPerformance: { category: string; revenue: number; avgCmv: number; itemCount: number }[];
  products: MatrixBcgProduct[];
  priceSuggestions: PriceSuggestionItem[];
}

export async function executeMenuEngineering(params: {
  restaurantSlug: string;
  restaurantName: string;
  periodDays?: number;
  menuItems: MenuItemData[];
  orders: OrderData[];
}): Promise<MenuEngineeringDiagnostic> {
  const { restaurantSlug, restaurantName, menuItems, orders } = params;
  const config = getRestaurantAIConfig(restaurantSlug).menu_engineering;
  const periodDays = params.periodDays || config.defaultPeriodDays || 30;

  // Filter orders by restaurant and period
  const cutoffTime = Date.now() - periodDays * 24 * 60 * 60 * 1000;
  const filteredOrders = orders.filter((o) => {
    if (o.status === 'cancelado') return false;
    if (o.restaurantSlug !== restaurantSlug) return false;
    const orderTime = new Date(o.createdAt).getTime();
    return orderTime >= cutoffTime;
  });

  // Calculate sales per product
  const salesMap: Record<string, { qty: number; revenue: number }> = {};
  filteredOrders.forEach((order) => {
    order.items.forEach((item) => {
      const match = menuItems.find((m) => m.name.toLowerCase() === item.name.toLowerCase() || m.id === item.id);
      const id = match ? match.id : item.name;
      if (!salesMap[id]) salesMap[id] = { qty: 0, revenue: 0 };
      salesMap[id].qty += item.quantity;
      salesMap[id].revenue += item.quantity * (item.price || match?.price || 0);
    });
  });

  // Calculate averages for the BCG threshold
  const analyzedProducts: MatrixBcgProduct[] = [];
  let totalCostSum = 0;
  let totalPriceSum = 0;
  let totalQtySum = 0;

  menuItems.forEach((item) => {
    const price = Math.max(0.01, item.price);
    // Real cost or reasonable default 30% if not yet configured in technical sheet
    const cost = item.cmvCost !== undefined ? item.cmvCost : item.cost !== undefined ? item.cost : Number((price * 0.32).toFixed(2));
    const sales = salesMap[item.id] || { qty: 0, revenue: 0 };

    totalCostSum += cost;
    totalPriceSum += price;
    totalQtySum += sales.qty;

    const cmvPercent = Number(((cost / price) * 100).toFixed(1));
    const grossMargin = Number((price - cost).toFixed(2));
    const grossMarginPercent = Number(((grossMargin / price) * 100).toFixed(1));

    analyzedProducts.push({
      id: item.id,
      name: item.name,
      category: item.category || item.categoryId || 'Geral',
      price,
      cost,
      cmvPercent,
      grossMargin,
      grossMarginPercent,
      quantitySold: sales.qty,
      revenue: Number((sales.qty * price).toFixed(2)),
      matrixCategory: 'ESTRELA', // will assign next
      suggestedPrice: price,
      suggestedAction: '',
      reasoning: '',
      potentialImpact: '',
    });
  });

  const avgQty = analyzedProducts.length > 0 ? totalQtySum / analyzedProducts.length : 1;
  const avgMargin = analyzedProducts.length > 0 ? (totalPriceSum - totalCostSum) / analyzedProducts.length : 15;

  // Classify products into BCG Matrix
  analyzedProducts.forEach((p) => {
    const isHighPopularity = p.quantitySold >= avgQty * 0.8;
    const isHighMargin = p.grossMargin >= avgMargin;

    if (isHighPopularity && isHighMargin) {
      p.matrixCategory = 'ESTRELA';
      p.suggestedAction = 'Manter qualidade estrita, dar destaque visual e preservar preço.';
      p.suggestedPrice = p.price;
      p.reasoning = 'Alta popularidade e alta margem de lucro. Produto campeão do cardápio.';
      p.potentialImpact = 'Garante o faturamento central e a fidelização do cliente.';
    } else if (isHighPopularity && !isHighMargin) {
      p.matrixCategory = 'BURRO DE CARGA';
      p.suggestedAction = 'Revisar ficha técnica dos insumos ou aplicar leve reajuste de preço.';
      // Suggest small price increase
      const newPrice = Number((p.price * 1.08).toFixed(2));
      p.suggestedPrice = newPrice;
      p.reasoning = `Muito vendido (${p.quantitySold} un.), mas margem de apenas R$ ${p.grossMargin.toFixed(2)} (CMV alto de ${p.cmvPercent}%). Um leve ajuste eleva o lucro líquido sem perder vendas.`;
      p.potentialImpact = `+R$ ${((newPrice - p.price) * p.quantitySold).toFixed(2)} de lucro adicional no período.`;
    } else if (!isHighPopularity && isHighMargin) {
      p.matrixCategory = 'QUEBRA-CABEÇA';
      p.suggestedAction = 'Melhorar visibilidade na vitrine, criar combo com item campeão ou foto promocional.';
      p.suggestedPrice = p.price;
      p.reasoning = `Excelente margem de lucro (R$ ${p.grossMargin.toFixed(2)}), porém baixa saída (${p.quantitySold} un.). Precisa de mais atratividade e posicionamento no cardápio.`;
      p.potentialImpact = 'Se dobrar o volume de vendas, gera forte impacto na rentabilidade líquida.';
    } else {
      p.matrixCategory = 'CÃO';
      p.suggestedAction = 'Avaliar substituição no cardápio, redução de desperdício ou promoção relâmpago de queima.';
      const promoPrice = Number((p.price * 0.9).toFixed(2));
      p.suggestedPrice = promoPrice;
      p.reasoning = 'Baixa saída e baixa margem de contribuição. Ocupa espaço operacional e gera risco de perda de estoque.';
      p.potentialImpact = 'Evita custos de estocagem e libera praça de preparo para pratos rentáveis.';
    }
  });

  // Prepare Diagnostics Summaries
  const topMargin = [...analyzedProducts].sort((a, b) => b.grossMargin - a.grossMargin).slice(0, 5);
  const topSelling = [...analyzedProducts].sort((a, b) => b.quantitySold - a.quantitySold).slice(0, 5);
  const highCmv = [...analyzedProducts].filter((p) => p.cmvPercent > 35).sort((a, b) => b.cmvPercent - a.cmvPercent).slice(0, 5);
  const attention = analyzedProducts
    .filter((p) => p.matrixCategory === 'BURRO DE CARGA' || p.matrixCategory === 'CÃO')
    .slice(0, 5)
    .map((p) => ({
      id: p.id,
      name: p.name,
      reason: p.matrixCategory === 'BURRO DE CARGA' ? `CMV elevado (${p.cmvPercent}%) exige revisão de custo ou preço.` : `Baixa saída (${p.quantitySold} un.) e baixa margem.`,
    }));

  // Categories performance
  const catMap: Record<string, { revenue: number; costSum: number; priceSum: number; count: number }> = {};
  analyzedProducts.forEach((p) => {
    if (!catMap[p.category]) catMap[p.category] = { revenue: 0, costSum: 0, priceSum: 0, count: 0 };
    catMap[p.category].revenue += p.revenue;
    catMap[p.category].costSum += p.cost;
    catMap[p.category].priceSum += p.price;
    catMap[p.category].count += 1;
  });

  const categoryPerformance = Object.entries(catMap).map(([category, data]) => ({
    category,
    revenue: Number(data.revenue.toFixed(2)),
    avgCmv: Number(((data.costSum / Math.max(0.01, data.priceSum)) * 100).toFixed(1)),
    itemCount: data.count,
  })).sort((a, b) => b.revenue - a.revenue);

  // Generate Price Suggestions for Burros de Carga and Cães
  const generatedSuggestions: PriceSuggestionItem[] = [];
  analyzedProducts
    .filter((p) => p.matrixCategory === 'BURRO DE CARGA' && p.suggestedPrice !== p.price)
    .forEach((p) => {
      generatedSuggestions.push({
        id: `sug-price-${p.id}`,
        productId: p.id,
        productName: p.name,
        category: p.category,
        restaurantSlug,
        currentPrice: p.price,
        suggestedPrice: p.suggestedPrice,
        currentCmvCost: p.cost,
        currentCmvPercent: p.cmvPercent,
        newCmvPercent: Number(((p.cost / p.suggestedPrice) * 100).toFixed(1)),
        reasoning: p.reasoning,
        estimatedImpact: p.potentialImpact,
        matrixCategory: p.matrixCategory,
        status: 'pendente',
        createdAt: new Date().toISOString(),
      });
    });

  // Save generated suggestions
  if (generatedSuggestions.length > 0) {
    savePriceSuggestions(generatedSuggestions);
  }

  const periodLabels: Record<number, string> = {
    1: 'Hoje',
    7: 'Últimos 7 dias',
    30: 'Últimos 30 dias',
    90: 'Últimos 90 dias',
  };

  return {
    periodDays,
    periodLabel: periodLabels[periodDays] || `Período de ${periodDays} dias`,
    totalRevenue: Number(analyzedProducts.reduce((acc, p) => acc + p.revenue, 0).toFixed(2)),
    averageCmvPercent: analyzedProducts.length > 0 ? Number(((totalCostSum / Math.max(0.01, totalPriceSum)) * 100).toFixed(1)) : 30,
    totalProductsAnalyzed: analyzedProducts.length,
    starsCount: analyzedProducts.filter((p) => p.matrixCategory === 'ESTRELA').length,
    plowhorsesCount: analyzedProducts.filter((p) => p.matrixCategory === 'BURRO DE CARGA').length,
    puzzlesCount: analyzedProducts.filter((p) => p.matrixCategory === 'QUEBRA-CABEÇA').length,
    dogsCount: analyzedProducts.filter((p) => p.matrixCategory === 'CÃO').length,
    topMarginProducts: topMargin.map((p) => ({ id: p.id, name: p.name, margin: p.grossMargin })),
    topSellingProducts: topSelling.map((p) => ({ id: p.id, name: p.name, qty: p.quantitySold })),
    highCmvProducts: highCmv.map((p) => ({ id: p.id, name: p.name, cmv: p.cmvPercent })),
    attentionNeededProducts: attention,
    categoryPerformance,
    products: analyzedProducts,
    priceSuggestions: generatedSuggestions,
  };
}

// --------------------------------------------------------------------------
// 4. GERENTE DE COZINHA & SMART KDS
// --------------------------------------------------------------------------
export interface SmartStationItem {
  itemName: string;
  quantity: number;
  options?: string;
  notes?: string;
  station: string; // 'COZINHA' | 'SUSHI BAR' | 'BAR' | 'SOBREMESAS' | 'FORNO'
}

export interface SmartKdsOrderPlan {
  orderId: string;
  shortCode: string;
  customerName: string;
  orderType: string;
  tableNumber?: string;
  priorityScore: number;
  isDelayed: boolean;
  elapsedMinutes: number;
  estimatedPrepMinutes: number;
  stationsRouting: SmartStationItem[];
  preparationSequence: string[];
  allergyAlerts: string[];
  hasAllergyRisk: boolean;
  status: 'recebido' | 'aceito' | 'em_preparo' | 'pronto' | 'saiu_para_entrega' | 'entregue' | 'cancelado';
}

export function executeSmartKitchenKds(params: {
  restaurantSlug: string;
  orders: OrderData[];
}): {
  plans: SmartKdsOrderPlan[];
  delayedOrdersCount: number;
  criticalAllergyOrdersCount: number;
  stationLoad: Record<string, number>;
} {
  const { restaurantSlug, orders } = params;
  const config = getRestaurantAIConfig(restaurantSlug).smart_kitchen;

  const now = Date.now();
  const availableStations = config.stations || ['COZINHA', 'SUSHI BAR', 'BAR', 'EXPEDIÇÃO'];

  // Route each order item to station
  const stationLoad: Record<string, number> = {};
  availableStations.forEach((s) => (stationLoad[s] = 0));

  let delayedCount = 0;
  let allergyCount = 0;

  const activeOrders = orders.filter((o) => {
    if (o.restaurantSlug !== restaurantSlug) return false;
    return o.status === 'recebido' || o.status === 'aceito' || o.status === 'em_preparo';
  });

  const plans: SmartKdsOrderPlan[] = activeOrders.map((order) => {
    const elapsedMins = Math.floor((now - new Date(order.createdAt).getTime()) / (60 * 1000));
    const isDelayed = elapsedMins >= config.delayThresholdMinutes;
    if (isDelayed) delayedCount++;

    // Allergy detection in notes or customer declared allergies
    const noteText = `${order.notes || ''} ${order.items.map((i) => i.notes || '').join(' ')}`.toLowerCase();
    const declaredAllergies = order.allergies || [];
    const detectedKeywords = ['alergia', 'alérgic', 'celíaco', 'sem glúten', 'intolerância', 'lactose', 'amendoim', 'camarão', 'frutos do mar', 'castanha', 'ovo'];
    
    const matchedAlerts: string[] = [...declaredAllergies];
    detectedKeywords.forEach((kw) => {
      if (noteText.includes(kw) && !matchedAlerts.some((a) => a.toLowerCase().includes(kw))) {
        matchedAlerts.push(`Restrição identificada: "${kw.toUpperCase()}"`);
      }
    });

    const hasAllergyRisk = matchedAlerts.length > 0;
    if (hasAllergyRisk) allergyCount++;

    // Assign items to stations
    const stationsRouting: SmartStationItem[] = order.items.map((item) => {
      const name = item.name.toLowerCase();
      let targetStation = 'COZINHA';

      if (name.includes('sushi') || name.includes('sashimi') || name.includes('temaki') || name.includes('uramaki') || name.includes('niguiri') || name.includes('hot roll')) {
        targetStation = availableStations.includes('SUSHI BAR') ? 'SUSHI BAR' : 'COZINHA';
      } else if (name.includes('suco') || name.includes('cerveja') || name.includes('refrigerante') || name.includes('vinho') || name.includes('drink') || name.includes('água') || name.includes('chá')) {
        targetStation = availableStations.includes('BAR') ? 'BAR' : 'COZINHA';
      } else if (name.includes('pizza') || name.includes('calzone')) {
        targetStation = availableStations.includes('FORNO DE PIZZA') ? 'FORNO DE PIZZA' : 'COZINHA';
      } else if (name.includes('burger') || name.includes('hambúrguer') || name.includes('chapa') || name.includes('fritas')) {
        targetStation = availableStations.includes('CHAPA & BURGER') ? 'CHAPA & BURGER' : 'COZINHA';
      } else if (name.includes('sobremesa') || name.includes('sorvete') || name.includes('pudim') || name.includes('torta')) {
        targetStation = availableStations.includes('SOBREMESAS') ? 'SOBREMESAS' : 'COZINHA';
      }

      stationLoad[targetStation] = (stationLoad[targetStation] || 0) + item.quantity;

      return {
        itemName: item.name,
        quantity: item.quantity,
        options: item.selectedOptions?.map((o) => o.name).join(', '),
        notes: item.notes,
        station: targetStation,
      };
    });

    // Sequence of prep: Drinks first, then cold/sushi, then hot, then packaging
    const preparationSequence = [
      '1. Separar embalagens térmicas e bebidas no setor Bar',
      '2. Montagem e cocção nas praças designadas em sincronia',
      '3. Finalização, conferência de lacre e despacho com comanda',
    ];

    // Priority Score (Higher = more urgent)
    let priorityScore = 100 - elapsedMins;
    if (isDelayed) priorityScore += 50;
    if (hasAllergyRisk) priorityScore += 30;
    if (order.orderType === 'mesa') priorityScore += 10;

    return {
      orderId: order.id,
      shortCode: order.shortCode,
      customerName: order.customerName,
      orderType: order.orderType,
      tableNumber: order.tableNumber,
      priorityScore,
      isDelayed,
      elapsedMinutes: elapsedMins,
      estimatedPrepMinutes: config.targetPrepTimeMinutes,
      stationsRouting,
      preparationSequence,
      allergyAlerts: matchedAlerts,
      hasAllergyRisk,
      status: order.status,
    };
  });

  // Sort by priority (most urgent first)
  plans.sort((a, b) => b.priorityScore - a.priorityScore);

  return {
    plans,
    delayedOrdersCount: delayedCount,
    criticalAllergyOrdersCount: allergyCount,
    stationLoad,
  };
}

// --------------------------------------------------------------------------
// 5. MODO SIMULAÇÃO ("SIMULAR IA")
// --------------------------------------------------------------------------
export async function executeAiSimulation(params: {
  restaurantSlug: string;
  scenario: 'cliente' | 'carrinho' | 'cmv' | 'cozinha';
  customInput?: string;
  menuItems: MenuItemData[];
  orders: OrderData[];
}): Promise<{
  scenario: string;
  inputSimulated: string;
  outputSummary: any;
  disclaimer: string;
}> {
  const { restaurantSlug, scenario, customInput, menuItems, orders } = params;
  const disclaimer = 'MODO SIMULAÇÃO: Esta execução é isolada e NÃO realizou nenhuma alteração em produtos, preços, estoque ou pedidos reais.';

  if (scenario === 'cliente') {
    const input = customInput || 'Estou procurando algo leve e sem glúten.';
    const result = await executeCustomerConcierge({
      restaurantSlug,
      restaurantName: 'Restaurante Tokio inBox',
      isOpen: true,
      openingHours: '18:00 às 23:30',
      deliveryFee: 5.0,
      minOrderValue: 30.0,
      menuItems,
      customerMessage: input,
      cartItems: [],
    });

    logAIAudit({
      restaurantSlug,
      operatorUsername: 'simulador',
      operatorRole: 'teste',
      moduleId: 'customer_concierge',
      action: 'Simulação de Atendimento do Cliente',
      previousValue: null,
      newValue: { input, response: result.responseText },
      status: 'simulado',
    });

    return {
      scenario: 'Atendente Virtual (Cliente)',
      inputSimulated: input,
      outputSummary: result,
      disclaimer,
    };
  }

  if (scenario === 'carrinho') {
    const input = customInput || 'Analise meu pedido e sugira uma bebida ou harmonização ideal.';
    const sampleCart: OrderItemData[] = menuItems.slice(0, 2).map((m) => ({
      name: m.name,
      quantity: 1,
      price: m.price,
    }));

    const result = await executeSmartPairing({
      restaurantSlug,
      restaurantName: 'Restaurante Tokio inBox',
      cartItems: sampleCart,
      menuItems,
    });

    logAIAudit({
      restaurantSlug,
      operatorUsername: 'simulador',
      operatorRole: 'teste',
      moduleId: 'smart_pairing',
      action: 'Simulação de Harmonização do Chef',
      previousValue: null,
      newValue: { cart: sampleCart, suggestions: result.suggestions },
      status: 'simulado',
    });

    return {
      scenario: 'Chef & Sommelier Virtual (Carrinho)',
      inputSimulated: input,
      outputSummary: result,
      disclaimer,
    };
  }

  if (scenario === 'cmv') {
    const input = customInput || 'Analise os produtos dos últimos 30 dias.';
    const result = await executeMenuEngineering({
      restaurantSlug,
      restaurantName: 'Restaurante Tokio inBox',
      periodDays: 30,
      menuItems,
      orders,
    });

    logAIAudit({
      restaurantSlug,
      operatorUsername: 'simulador',
      operatorRole: 'teste',
      moduleId: 'menu_engineering',
      action: 'Simulação de Engenharia de Cardápio & CMV',
      previousValue: null,
      newValue: { period: 30, revenue: result.totalRevenue, stars: result.starsCount },
      status: 'simulado',
    });

    return {
      scenario: 'Engenheiro de Cardápio & CMV',
      inputSimulated: input,
      outputSummary: {
        totalRevenue: result.totalRevenue,
        averageCmvPercent: result.averageCmvPercent,
        starsCount: result.starsCount,
        plowhorsesCount: result.plowhorsesCount,
        puzzlesCount: result.puzzlesCount,
        dogsCount: result.dogsCount,
        priceSuggestionsCount: result.priceSuggestions.length,
        priceSuggestions: result.priceSuggestions,
      },
      disclaimer,
    };
  }

  // scenario === 'cozinha'
  const input = customInput || 'Organize estes pedidos por praça de produção e destaque alertas.';
  const result = executeSmartKitchenKds({
    restaurantSlug,
    orders,
  });

  logAIAudit({
    restaurantSlug,
    operatorUsername: 'simulador',
    operatorRole: 'teste',
    moduleId: 'smart_kitchen',
    action: 'Simulação de Gestão KDS da Cozinha',
    previousValue: null,
    newValue: { ordersActive: result.plans.length, delayed: result.delayedOrdersCount },
    status: 'simulado',
  });

  return {
    scenario: 'Gerente de Cozinha & Smart KDS',
    inputSimulated: input,
    outputSummary: result,
    disclaimer,
  };
}
