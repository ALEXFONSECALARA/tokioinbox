import { getGeminiModel } from './aiModel';
import { GoogleGenAI } from '@google/genai';

export interface CmvItemInput {
  id: string;
  name: string;
  price: number;
  cmvCost: number;
  category?: string;
  isTopSeller?: boolean;
  isLowSeller?: boolean;
}

export interface LucrativeComboSuggestion {
  id: string;
  title: string;
  description: string;
  itemsIncluded: string[];
  originalCombinedPrice: number;
  comboSuggestedPrice: number;
  comboTotalCmv: number;
  resultingMarginPercent: number;
  reasoning: string;
}

export interface CmvOptimizationAdvice {
  itemId: string;
  itemName: string;
  currentPrice: number;
  currentCmv: number;
  cmvPercent: number;
  status: 'safe' | 'warning' | 'critical'; // safe: <=30%, warning: 31-35%, critical: >35%
  suggestedPrice: number;
  potentialSavingsMonthly: string;
  actionableStep: string;
}

export interface CmvAiAnalysisResult {
  overallHealthScore: number; // 0 to 100
  averageCmvPercent: number;
  criticalItemsCount: number;
  warningItemsCount: number;
  safeItemsCount: number;
  executiveSummary: string;
  itemAdvices: CmvOptimizationAdvice[];
  lucrativeCombos: LucrativeComboSuggestion[];
  lowTurnoverActions: {
    itemId: string;
    itemName: string;
    strategy: string;
    suggestedPromoPrice: number;
  }[];
}

export async function generateCmvEngineeringInsights(
  restaurantSlug: string,
  items: CmvItemInput[],
  targetMarginPercent: number = 65,
  geminiClient?: GoogleGenAI | null
): Promise<CmvAiAnalysisResult> {
  if (!items || items.length === 0) {
    return {
      overallHealthScore: 100,
      averageCmvPercent: 28,
      criticalItemsCount: 0,
      warningItemsCount: 0,
      safeItemsCount: 0,
      executiveSummary: 'Nenhum item cadastrado para análise de CMV.',
      itemAdvices: [],
      lucrativeCombos: [],
      lowTurnoverActions: [],
    };
  }

  // 1. Analyze every item
  let totalCmvPercentSum = 0;
  let criticalCount = 0;
  let warningCount = 0;
  let safeCount = 0;

  const itemAdvices: CmvOptimizationAdvice[] = items.map((it) => {
    const price = Math.max(0.01, it.price);
    const cmv = Math.max(0, it.cmvCost);
    const cmvPercent = Number(((cmv / price) * 100).toFixed(1));
    totalCmvPercentSum += cmvPercent;

    let status: 'safe' | 'warning' | 'critical' = 'safe';
    if (cmvPercent > 35) {
      status = 'critical';
      criticalCount++;
    } else if (cmvPercent > 30) {
      status = 'warning';
      warningCount++;
    } else {
      safeCount++;
    }

    // Target price based on targetMarginPercent: Price = CMV / (1 - targetMargin / 100)
    const idealPrice =
      targetMarginPercent < 100 ? Number((cmv / (1 - targetMarginPercent / 100)).toFixed(2)) : price;

    let actionableStep = '';
    if (status === 'critical') {
      actionableStep = `Reduzir gramatura do ingrediente nobre em 10% ou reajustar preço para R$ ${idealPrice.toFixed(2)} para restabelecer a margem saudável.`;
    } else if (status === 'warning') {
      actionableStep = `CMV no limite seguro. Renegociar fornecedores de embalagem ou aplicar pequenas correções de centavos.`;
    } else {
      actionableStep = `Margem de alta performance (${(100 - cmvPercent).toFixed(0)}% bruta). Ideal para tracionar como item âncora de marketing.`;
    }

    return {
      itemId: it.id,
      itemName: it.name,
      currentPrice: price,
      currentCmv: cmv,
      cmvPercent,
      status,
      suggestedPrice: idealPrice,
      potentialSavingsMonthly: `R$ ${(Math.max(0, idealPrice - price) * 120).toFixed(0)}/mês (base 120 vendas)`,
      actionableStep,
    };
  });

  const averageCmvPercent = Number((totalCmvPercentSum / items.length).toFixed(1));
  const overallHealthScore = Math.max(
    10,
    Math.min(100, Math.round(100 - criticalCount * 15 - warningCount * 5))
  );

  // 2. Build Lucrative Combos (Pairing high-cost with high-margin items)
  const lucrativeCombos: LucrativeComboSuggestion[] = [];
  const highMarginItems = items.filter((it) => (it.cmvCost / Math.max(0.01, it.price)) * 100 <= 25);
  const anchorItems = items.filter((it) => it.isTopSeller || it.price >= 35);

  const mainAnchor = anchorItems[0] || items[0];
  const sideItem = highMarginItems[0] || items[1] || items[0];

  if (mainAnchor && sideItem && mainAnchor.id !== sideItem.id) {
    const origPrice = mainAnchor.price + sideItem.price;
    const comboPrice = Number((origPrice * 0.88).toFixed(2)); // 12% discount to customer
    const comboCmv = mainAnchor.cmvCost + sideItem.cmvCost;
    const comboMargin = Number((((comboPrice - comboCmv) / comboPrice) * 100).toFixed(1));

    lucrativeCombos.push({
      id: `combo-1-${Date.now()}`,
      title: `Combo Lucro Blindado: ${mainAnchor.name.split(' ')[0]} + ${sideItem.name.split(' ')[0]}`,
      description: `Agrega um item de alta procura com acompanhamento de margem elevada, diluindo o CMV e aumentando o ticket médio.`,
      itemsIncluded: [mainAnchor.name, sideItem.name],
      originalCombinedPrice: origPrice,
      comboSuggestedPrice: comboPrice,
      comboTotalCmv: comboCmv,
      resultingMarginPercent: comboMargin,
      reasoning: `O cliente percebe 12% de economia real, enquanto o restaurante mantém margem sólida de ${comboMargin}% e eleva o ticket médio em +R$ ${sideItem.price.toFixed(2)}.`,
    });
  }

  // 3. Low-turnover actions
  const lowSelling = items.filter((it) => it.isLowSeller || it.price < 30).slice(0, 3);
  const lowTurnoverActions = lowSelling.map((it) => ({
    itemId: it.id,
    itemName: it.name,
    strategy: 'Happy Hour / Sugestão de Fechamento de Carrinho (Up-sell de 1 Clique)',
    suggestedPromoPrice: Number((it.price * 0.85).toFixed(2)),
  }));

  // 4. Executive Summary
  let executiveSummary = `Cardápio analisado com sucesso. CMV Médio da casa está em ${averageCmvPercent}%. Identificamos ${criticalCount} item(ns) em zona de perigo (>35% CMV) e ${warningCount} em atenção (30-35%). Recomendamos foco na precificação inteligente e criação de combos agregados para elevar a lucratividade global.`;

  // 5. Try Gemini enrichment if available
  if (geminiClient && process.env.GEMINI_API_KEY) {
    try {
      const prompt = `Você é um consultor sênior de gastronomia e engenharia de cardápio (Menu Engineering). 
O restaurante ${restaurantSlug} possui CMV Médio de ${averageCmvPercent}% e os seguintes pratos críticos:
${itemAdvices
  .filter((a) => a.status === 'critical')
  .map((a) => `- ${a.itemName}: Preço R$ ${a.currentPrice}, CMV R$ ${a.currentCmv} (${a.cmvPercent}%)`)
  .join('\n')}

Forneça um parágrafo executivo e direto (máximo 3 frases em português) com uma orientação tática e pragmática para o proprietário blindar o caixa e a margem de lucro.`;

      const response = await geminiClient.models.generateContent({
        model: getGeminiModel(),
        contents: prompt,
      });

      if (response && response.text) {
        executiveSummary = response.text.trim();
      }
    } catch (e) {
      console.warn('[AI CMV] Gemini fallback to deterministic reasoning:', e);
    }
  }

  return {
    overallHealthScore,
    averageCmvPercent,
    criticalItemsCount: criticalCount,
    warningItemsCount: warningCount,
    safeItemsCount: safeCount,
    executiveSummary,
    itemAdvices,
    lucrativeCombos,
    lowTurnoverActions,
  };
}
