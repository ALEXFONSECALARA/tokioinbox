import React, { useState, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { MenuItem, RestaurantSlug, RecipeIngredient, TechnicalSheet } from '../types/restaurant';
import {
  Calculator,
  TrendingUp,
  Percent,
  DollarSign,
  AlertCircle,
  Sparkles,
  PieChart,
  CheckCircle2,
  Plus,
  Trash2,
  ChefHat,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  Scale,
  Package,
  RefreshCw,
  Layers,
  Zap,
} from 'lucide-react';

interface AdminPricingCmvProps {
  selectedFilterSlug: RestaurantSlug | 'all';
}

interface CmvAdvice {
  itemId: string;
  itemName: string;
  currentPrice: number;
  currentCmv: number;
  cmvPercent: number;
  status: 'safe' | 'warning' | 'critical';
  suggestedPrice: number;
  potentialSavingsMonthly: string;
  actionableStep: string;
}

interface LucrativeCombo {
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

interface LowTurnoverAction {
  itemId: string;
  itemName: string;
  strategy: string;
  suggestedPromoPrice: number;
}

export const AdminPricingCmv: React.FC<AdminPricingCmvProps> = ({ selectedFilterSlug }) => {
  const { menuItems, restaurants, updateMenuItem, checkPermission, showToast } = useStore();

  const [selectedItemId, setSelectedItemId] = useState<string>(menuItems[0]?.id || '');
  const [targetMarginPercent, setTargetMarginPercent] = useState<number>(65); // 65% standard restaurant margin
  const [activeTab, setActiveTab] = useState<'calculator' | 'ingredients' | 'ai_engineering'>('calculator');

  // AI Autonomous Engineering State
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiScore, setAiScore] = useState<number>(82);
  const [aiAvgCmv, setAiAvgCmv] = useState<number>(29.4);
  const [aiAdvices, setAiAdvices] = useState<CmvAdvice[]>([]);
  const [aiCombos, setAiCombos] = useState<LucrativeCombo[]>([]);
  const [aiLowTurnover, setAiLowTurnover] = useState<LowTurnoverAction[]>([]);
  const [aiSummary, setAiSummary] = useState<string>('');

  // Ingredients form state for technical sheet
  const [ingredientName, setIngredientName] = useState('');
  const [ingredientQty, setIngredientQty] = useState('');
  const [ingredientUnit, setIngredientUnit] = useState<RecipeIngredient['unit']>('g');
  const [ingredientUnitCost, setIngredientUnitCost] = useState('');

  // Packaging & labor
  const [packagingCost, setPackagingCost] = useState<number>(1.5);
  const [laborCost, setLaborCost] = useState<number>(1.2);
  const [yieldServings, setYieldServings] = useState<number>(1);

  // Filter items based on restaurant
  const filteredItems = menuItems.filter((item) => {
    if (selectedFilterSlug !== 'all' && item.restaurantSlug !== selectedFilterSlug) return false;
    return true;
  });

  const currentItem = menuItems.find((i) => i.id === selectedItemId) || filteredItems[0];

  // Initialize sheet state when current item changes
  useEffect(() => {
    if (currentItem?.technicalSheet) {
      setPackagingCost(currentItem.technicalSheet.packagingCost || 1.5);
      setLaborCost(currentItem.technicalSheet.laborCost || 1.2);
      setYieldServings(currentItem.technicalSheet.yieldServings || 1);
    }
  }, [currentItem?.id]);

  // Ingredients from item technical sheet (or auto-generated defaults if empty)
  const currentIngredients: RecipeIngredient[] = currentItem?.technicalSheet?.ingredients || [
    {
      id: 'ing-1',
      name: 'Insumo Base / Proteína',
      quantity: 180,
      unit: 'g',
      unitCost: 0.08,
      totalCost: 14.4,
    },
    {
      id: 'ing-2',
      name: 'Molho Especial & Temperos',
      quantity: 40,
      unit: 'ml',
      unitCost: 0.05,
      totalCost: 2.0,
    },
    {
      id: 'ing-3',
      name: 'Guarnição / Acompanhamento',
      quantity: 120,
      unit: 'g',
      unitCost: 0.02,
      totalCost: 2.4,
    },
  ];

  // Calculate real technical sheet cost
  const rawIngredientsCost = currentIngredients.reduce((sum, ing) => sum + ing.totalCost, 0);
  const realCmvPerPortion = Number(
    ((rawIngredientsCost + packagingCost + laborCost) / Math.max(1, yieldServings)).toFixed(2)
  );

  const estimatedCost = currentItem?.cmvCost || realCmvPerPortion;
  const sellingPrice = currentItem ? (currentItem.promoPrice ?? currentItem.price) : 0;
  const currentMarginAmount = sellingPrice - estimatedCost;
  const currentMarginPercent = sellingPrice > 0 ? (currentMarginAmount / sellingPrice) * 100 : 0;

  // Suggested selling price given desired margin: Price = Cost / (1 - Margin/100)
  const suggestedPrice =
    targetMarginPercent < 100
      ? Number((estimatedCost / (1 - targetMarginPercent / 100)).toFixed(2))
      : estimatedCost;

  // Load Autonomous AI Analysis
  const runAiMenuEngineering = async () => {
    setIsAiLoading(true);
    try {
      const itemsPayload = filteredItems.map((it) => ({
        id: it.id,
        name: it.name,
        price: it.promoPrice ?? it.price,
        cmvCost: it.cmvCost || Number((it.price * 0.32).toFixed(2)),
        category: it.categoryId,
        isTopSeller: it.tags?.includes('mais_vendido'),
      }));

      const res = await fetch('/api/ai/cmv-engineering', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantSlug: selectedFilterSlug === 'all' ? 'japones' : selectedFilterSlug,
          items: itemsPayload,
          targetMargin: targetMarginPercent,
        }),
      });

      if (!res.ok) {
        throw new Error('Falha ao comunicar com o motor de IA');
      }

      const data = await res.json();
      if (data.success) {
        setAiScore(data.overallHealthScore);
        setAiAvgCmv(data.averageCmvPercent);
        setAiAdvices(data.itemAdvices || []);
        setAiCombos(data.lucrativeCombos || []);
        setAiLowTurnover(data.lowTurnoverActions || []);
        setAiSummary(data.executiveSummary || '');
        showToast('Engenharia de Cardápio com IA atualizada com sucesso!', 'success');
      }
    } catch (e: any) {
      console.error(e);
      showToast(e.message || 'Erro ao processar análise de IA.', 'error');
    } finally {
      setIsAiLoading(false);
    }
  };

  // Run on mount or tab switch
  useEffect(() => {
    if (activeTab === 'ai_engineering' && aiAdvices.length === 0) {
      runAiMenuEngineering();
    }
  }, [activeTab]);

  const handleUpdateItemCost = (newCostStr: string) => {
    if (!currentItem || !checkPermission('can_edit_menu')) {
      showToast('Permissão insuficiente para alterar cardápio.', 'error');
      return;
    }
    const val = parseFloat(newCostStr.replace(',', '.'));
    if (!isNaN(val) && val >= 0) {
      updateMenuItem({
        ...currentItem,
        cmvCost: val,
      });
      showToast(`CMV do prato "${currentItem.name}" atualizado para R$ ${val.toFixed(2)}`, 'info');
    }
  };

  const handleApplySuggestedPrice = () => {
    if (!currentItem || !checkPermission('can_edit_menu')) {
      showToast('Permissão insuficiente para alterar cardápio.', 'error');
      return;
    }
    updateMenuItem({
      ...currentItem,
      price: Number(suggestedPrice.toFixed(2)),
    });
    showToast(
      `Preço de "${currentItem.name}" ajustado para R$ ${suggestedPrice.toFixed(2)} (${targetMarginPercent}% margem bruta).`,
      'success'
    );
  };

  // Add ingredient to technical sheet
  const handleAddIngredient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentItem || !checkPermission('can_edit_menu')) {
      showToast('Permissão insuficiente.', 'error');
      return;
    }

    const qty = parseFloat(ingredientQty.replace(',', '.'));
    const unitCost = parseFloat(ingredientUnitCost.replace(',', '.'));

    if (!ingredientName.trim() || isNaN(qty) || isNaN(unitCost)) {
      showToast('Preencha os dados do ingrediente corretamente.', 'warning');
      return;
    }

    const totalCost = Number((qty * unitCost).toFixed(2));
    const newIngredient: RecipeIngredient = {
      id: `ing-${Date.now()}`,
      name: ingredientName.trim(),
      quantity: qty,
      unit: ingredientUnit,
      unitCost,
      totalCost,
    };

    const updatedIngredients = [...currentIngredients, newIngredient];
    const newRawTotal = updatedIngredients.reduce((sum, ing) => sum + ing.totalCost, 0);
    const newCmvCalculated = Number(
      ((newRawTotal + packagingCost + laborCost) / Math.max(1, yieldServings)).toFixed(2)
    );

    const updatedSheet: TechnicalSheet = {
      itemId: currentItem.id,
      yieldServings,
      ingredients: updatedIngredients,
      packagingCost,
      laborCost,
      totalProductionCost: newCmvCalculated,
      recommendedPrice: Number((newCmvCalculated / (1 - targetMarginPercent / 100)).toFixed(2)),
      targetMarginPercent,
    };

    updateMenuItem({
      ...currentItem,
      cmvCost: newCmvCalculated,
      technicalSheet: updatedSheet,
    });

    setIngredientName('');
    setIngredientQty('');
    setIngredientUnitCost('');
    showToast(`Ingrediente "${newIngredient.name}" incluído na Ficha Técnica!`, 'success');
  };

  const handleRemoveIngredient = (ingId: string) => {
    if (!currentItem || !checkPermission('can_edit_menu')) return;
    const updatedIngredients = currentIngredients.filter((i) => i.id !== ingId);
    const newRawTotal = updatedIngredients.reduce((sum, ing) => sum + ing.totalCost, 0);
    const newCmvCalculated = Number(
      ((newRawTotal + packagingCost + laborCost) / Math.max(1, yieldServings)).toFixed(2)
    );

    const updatedSheet: TechnicalSheet = {
      itemId: currentItem.id,
      yieldServings,
      ingredients: updatedIngredients,
      packagingCost,
      laborCost,
      totalProductionCost: newCmvCalculated,
      recommendedPrice: Number((newCmvCalculated / (1 - targetMarginPercent / 100)).toFixed(2)),
      targetMarginPercent,
    };

    updateMenuItem({
      ...currentItem,
      cmvCost: newCmvCalculated,
      technicalSheet: updatedSheet,
    });
    showToast('Ingrediente removido da Ficha Técnica.', 'info');
  };

  const handleSyncTechnicalCmvToItem = () => {
    if (!currentItem || !checkPermission('can_edit_menu')) return;
    updateMenuItem({
      ...currentItem,
      cmvCost: realCmvPerPortion,
    });
    showToast(`CMV sincronizado com a Ficha Técnica: R$ ${realCmvPerPortion.toFixed(2)}`, 'success');
  };

  return (
    <div className="space-y-6 animate-fadeIn text-slate-100">
      {/* Header */}
      <div className="bg-[#12151C] border border-[#222836] rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-slate-950 font-black shadow-lg">
            <Calculator className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-black text-white uppercase tracking-wider">
                CMV, Ficha Técnica &amp; Inteligência de Cardápio
              </h2>
              <span className="bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[10px] font-black px-2 py-0.5 rounded-full uppercase flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-blue-400" />
                Engenharia de Cardápio
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Controle detalhado de insumos por prato, cálculo de CMV real e blindagem de margem com IA
            </p>
          </div>
        </div>

        {/* View mode buttons */}
        <div className="flex items-center bg-[#0E1015] p-1 rounded-xl border border-slate-800 text-xs font-bold">
          <button
            onClick={() => setActiveTab('calculator')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'calculator'
                ? 'bg-blue-600 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Precificação &amp; Margem</span>
          </button>
          <button
            onClick={() => setActiveTab('ingredients')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'ingredients'
                ? 'bg-blue-600 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <ChefHat className="w-3.5 h-3.5" />
            <span>Ficha Técnica</span>
          </button>
          <button
            onClick={() => setActiveTab('ai_engineering')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'ai_engineering'
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow'
                : 'text-purple-400 hover:text-purple-300'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>IA Autônoma de CMV</span>
          </button>
        </div>
      </div>

      {/* Main Content Areas based on Tab */}
      {activeTab === 'ai_engineering' ? (
        /* AI AUTONOMOUS ENGINEERING TAB */
        <div className="space-y-6 animate-fadeIn">
          {/* AI Overview Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-[#151922] border border-slate-800 rounded-2xl p-4 space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase">
                Saúde Financeira do Cardápio
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black font-mono text-emerald-400">{aiScore}/100</span>
                <span className="text-xs text-emerald-400/80 font-bold">Excelente</span>
              </div>
              <p className="text-[10px] text-slate-400">
                Baseado no CMV ponderado por volume de vendas
              </p>
            </div>

            <div className="bg-[#151922] border border-slate-800 rounded-2xl p-4 space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase">
                CMV Médio da Casa
              </span>
              <div className="flex items-baseline gap-2">
                <span
                  className={`text-3xl font-black font-mono ${
                    aiAvgCmv <= 30 ? 'text-emerald-400' : aiAvgCmv <= 35 ? 'text-amber-400' : 'text-rose-400'
                  }`}
                >
                  {aiAvgCmv}%
                </span>
                <span className="text-xs text-slate-400 font-bold">Ideal: 28-32%</span>
              </div>
              <p className="text-[10px] text-slate-400">
                Margem bruta média ponderada: {(100 - aiAvgCmv).toFixed(1)}%
              </p>
            </div>

            <div className="bg-[#151922] border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-[11px] font-bold text-purple-400 uppercase">Motor de IA</span>
                <h4 className="text-sm font-bold text-white">Análise Autônoma de Gastronomia</h4>
                <p className="text-[10px] text-slate-400">Atualize insights em tempo real</p>
              </div>
              <button
                onClick={runAiMenuEngineering}
                disabled={isAiLoading}
                className="px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 shadow"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isAiLoading ? 'animate-spin' : ''}`} />
                <span>{isAiLoading ? 'Analisando...' : 'Reavaliar'}</span>
              </button>
            </div>
          </div>

          {/* AI Executive Summary */}
          {aiSummary && (
            <div className="bg-gradient-to-r from-purple-950/40 via-indigo-950/30 to-slate-900 border border-purple-500/30 rounded-2xl p-4 space-y-1.5 shadow-lg">
              <div className="flex items-center gap-2 text-xs font-bold text-purple-300 uppercase">
                <Sparkles className="w-4 h-4 text-purple-400" />
                <span>Diagnóstico Executivo da IA</span>
              </div>
              <p className="text-xs text-slate-200 leading-relaxed font-sans">{aiSummary}</p>
            </div>
          )}

          {/* Critical CMV Items (>30% and >35%) */}
          <div className="bg-[#151922] border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  <span>Alertas de CMV Crítico (&gt;30% e &gt;35%)</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Pratos que ameaçam a margem e recomendações imediatas de otimização de porção e preço
                </p>
              </div>
              <span className="text-xs font-mono font-bold bg-slate-800 px-2 py-1 rounded text-slate-300">
                {aiAdvices.length} itens analisados
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {aiAdvices.map((advice) => {
                const isCritical = advice.status === 'critical';
                const isWarning = advice.status === 'warning';

                return (
                  <div
                    key={advice.itemId}
                    className={`p-4 rounded-xl border space-y-2.5 transition-all ${
                      isCritical
                        ? 'bg-rose-950/20 border-rose-600/50'
                        : isWarning
                        ? 'bg-amber-950/20 border-amber-500/40'
                        : 'bg-emerald-950/15 border-emerald-500/30'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-bold text-white text-xs">{advice.itemName}</h4>
                        <div className="flex items-center gap-2 text-[11px] font-mono mt-0.5">
                          <span className="text-slate-400">Preço: R$ {advice.currentPrice.toFixed(2)}</span>
                          <span className="text-slate-500">•</span>
                          <span className="text-slate-400">CMV: R$ {advice.currentCmv.toFixed(2)}</span>
                        </div>
                      </div>
                      <span
                        className={`text-xs font-black font-mono px-2 py-0.5 rounded ${
                          isCritical
                            ? 'bg-rose-500 text-slate-950'
                            : isWarning
                            ? 'bg-amber-500 text-slate-950'
                            : 'bg-emerald-500/20 text-emerald-300'
                        }`}
                      >
                        {advice.cmvPercent}% CMV
                      </span>
                    </div>

                    <div className="text-[11px] bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/80 text-slate-300 leading-snug">
                      <strong className="text-white block mb-0.5">Ação Recomendada pela IA:</strong>
                      {advice.actionableStep}
                    </div>

                    <div className="flex items-center justify-between text-[11px] pt-1">
                      <span className="text-emerald-400 font-mono font-bold">
                        {advice.potentialSavingsMonthly}
                      </span>
                      {advice.suggestedPrice > advice.currentPrice && (
                        <button
                          onClick={() => {
                            const it = menuItems.find((m) => m.id === advice.itemId);
                            if (it) {
                              updateMenuItem({ ...it, price: advice.suggestedPrice });
                              showToast(
                                `Preço de "${it.name}" reajustado para R$ ${advice.suggestedPrice.toFixed(2)}`,
                                'success'
                              );
                            }
                          }}
                          className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white font-bold text-[10px] flex items-center gap-1 shadow"
                        >
                          <span>Ajustar p/ R$ {advice.suggestedPrice.toFixed(2)}</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* AI Engineered Combos (Combos Lucrativos) */}
          <div className="bg-[#151922] border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
            <div className="border-b border-slate-800 pb-3">
              <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                <Package className="w-4 h-4 text-emerald-400" />
                <span>Combos Lucrativos Projetados pela IA (Menu Engineering)</span>
              </h3>
              <p className="text-xs text-slate-400">
                Combina pratos âncora com acompanhamentos de alta margem, diluindo o CMV total abaixo de 28%
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {aiCombos.map((combo) => (
                <div
                  key={combo.id}
                  className="bg-gradient-to-br from-[#181D28] to-[#12151E] border border-emerald-500/30 rounded-2xl p-4 space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded border border-emerald-500/30">
                        {combo.resultingMarginPercent}% Margem Líquida
                      </span>
                      <h4 className="text-sm font-bold text-white mt-1">{combo.title}</h4>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] line-through text-slate-500 block">
                        R$ {combo.originalCombinedPrice.toFixed(2)}
                      </span>
                      <span className="text-base font-black text-emerald-400 font-mono">
                        R$ {combo.comboSuggestedPrice.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed">{combo.reasoning}</p>

                  <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800 text-[11px] space-y-1">
                    <span className="text-slate-400 font-bold block">Itens Inclusos no Pacote:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {combo.itemsIncluded.map((it, idx) => (
                        <span key={idx} className="bg-slate-800 text-slate-200 px-2 py-0.5 rounded font-mono text-[10px]">
                          + {it}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Low Turnover Strategy */}
          <div className="bg-[#151922] border border-slate-800 rounded-2xl p-5 shadow-lg space-y-3">
            <div className="border-b border-slate-800 pb-2">
              <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-400" />
                <span>Estratégia para Itens Parados / Baixa Saída</span>
              </h3>
              <p className="text-xs text-slate-400">
                Reativação de estoque e estímulo de vendas cruzadas no carrinho
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {aiLowTurnover.map((item) => (
                <div key={item.itemId} className="bg-[#1A1F2B] p-3 rounded-xl border border-slate-800 space-y-1.5">
                  <h5 className="font-bold text-white text-xs truncate">{item.itemName}</h5>
                  <p className="text-[10px] text-slate-400 leading-tight">{item.strategy}</p>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] font-mono font-bold text-amber-400">
                      Promo: R$ {item.suggestedPromoPrice.toFixed(2)}
                    </span>
                    <button
                      onClick={() => {
                        const m = menuItems.find((x) => x.id === item.itemId);
                        if (m) {
                          updateMenuItem({ ...m, promoPrice: item.suggestedPromoPrice });
                          showToast(`Promoção aplicada para "${m.name}"!`, 'success');
                        }
                      }}
                      className="px-2 py-0.5 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[10px]"
                    >
                      Ativar Oferta
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* CALCULATOR & INGREDIENTS TABS */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Item Selector & Quick List */}
          <div className="bg-[#151922] border border-slate-800 rounded-2xl p-4 shadow-lg space-y-3">
            <label className="block text-xs font-black uppercase tracking-wider text-slate-300">
              Selecione o Prato para Simular
            </label>

            <div className="space-y-1.5 max-h-[500px] overflow-y-auto pr-1">
              {filteredItems.map((item) => {
                const isSelected = item.id === currentItem?.id;
                const itemCmv = item.cmvCost || Number((item.price * 0.32).toFixed(2));
                const itemMargin = ((item.price - itemCmv) / item.price) * 100;

                return (
                  <button
                    key={item.id}
                    onClick={() => setSelectedItemId(item.id)}
                    className={`w-full text-left p-2.5 rounded-xl border transition-all flex items-center justify-between gap-2 ${
                      isSelected
                        ? 'bg-blue-950/40 border-blue-500 text-white shadow'
                        : 'bg-[#1A1F2B] border-slate-800/80 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="min-w-0">
                      <span className="text-xs font-bold block truncate">{item.name}</span>
                      <span className="text-[10px] text-slate-400 block font-mono">
                        Venda: R$ {item.price.toFixed(2)} • CMV: R$ {itemCmv.toFixed(2)}
                      </span>
                    </div>
                    <span
                      className={`text-[10px] font-black font-mono px-2 py-0.5 rounded shrink-0 ${
                        itemMargin >= 60
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : itemMargin >= 40
                          ? 'bg-amber-500/20 text-amber-300'
                          : 'bg-red-500/20 text-red-300'
                      }`}
                    >
                      {itemMargin.toFixed(0)}% mg
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Center/Right 2 Columns */}
          {currentItem && (
            <div className="lg:col-span-2 space-y-6">
              {activeTab === 'calculator' ? (
                /* SIMULATOR & PRICING CARD */
                <div className="bg-[#151922] border border-slate-800 rounded-2xl p-5 shadow-lg space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                    <div>
                      <span className="text-[11px] text-blue-400 font-mono uppercase font-bold">
                        {restaurants[currentItem.restaurantSlug]?.name}
                      </span>
                      <h3 className="text-lg font-black text-white">{currentItem.name}</h3>
                    </div>
                    <div className="text-right">
                      <span className="text-[11px] text-slate-400 block">Preço de Venda Atual</span>
                      <span className="text-xl font-black text-white font-mono">
                        R$ {sellingPrice.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* CMV Cost Input & Target Margin Slider */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-[#1A1F2B] p-4 rounded-xl border border-slate-800 space-y-2">
                      <label className="text-xs font-bold text-slate-300 uppercase flex items-center justify-between">
                        <span>Custo Estimado dos Ingredientes (CMV)</span>
                        <DollarSign className="w-3.5 h-3.5 text-amber-400" />
                      </label>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-400">R$</span>
                        <input
                          type="number"
                          step="0.10"
                          value={estimatedCost}
                          onChange={(e) => handleUpdateItemCost(e.target.value)}
                          className="w-full bg-[#0E1015] border border-slate-700 rounded-lg px-3 py-1.5 text-white font-mono text-sm focus:outline-none focus:border-blue-500"
                        />
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-slate-400">
                        <span>Representa {((estimatedCost / Math.max(0.01, sellingPrice)) * 100).toFixed(1)}% do preço</span>
                        <button
                          type="button"
                          onClick={() => setActiveTab('ingredients')}
                          className="text-blue-400 hover:underline font-bold flex items-center gap-0.5"
                        >
                          Ver Ficha Técnica &rarr;
                        </button>
                      </div>
                    </div>

                    <div className="bg-[#1A1F2B] p-4 rounded-xl border border-slate-800 space-y-2">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-300 uppercase">
                        <span>Margem Bruta Alvo Desejada</span>
                        <span className="text-blue-400 font-mono text-sm font-black">
                          {targetMarginPercent}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="30"
                        max="85"
                        value={targetMarginPercent}
                        onChange={(e) => setTargetMarginPercent(Number(e.target.value))}
                        className="w-full accent-blue-500 cursor-pointer"
                      />
                      <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                        <span>30% (Popular)</span>
                        <span>65% (Padrão Gastronomia)</span>
                        <span>85% (Alta Margem)</span>
                      </div>
                    </div>
                  </div>

                  {/* Price Suggestion Output Box */}
                  <div className="bg-gradient-to-r from-blue-950/40 via-indigo-950/30 to-purple-950/40 border border-blue-500/40 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <span className="text-[10px] bg-blue-500/20 text-blue-300 font-black px-2 py-0.5 rounded uppercase border border-blue-500/30">
                        Sugestão de Preço Inteligente
                      </span>
                      <div className="text-2xl font-black text-white font-mono mt-1">
                        R$ {suggestedPrice.toFixed(2)}
                      </div>
                      <p className="text-xs text-slate-300 mt-0.5">
                        Garante margem bruta de <strong>{targetMarginPercent}%</strong> (Lucro bruto de{' '}
                        <strong className="text-emerald-400">
                          R$ {(suggestedPrice - estimatedCost).toFixed(2)}
                        </strong>{' '}
                        por prato vendido).
                      </p>
                    </div>

                    <button
                      onClick={handleApplySuggestedPrice}
                      className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-1.5 shrink-0"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Aplicar ao Cardápio</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* INGREDIENTS / TECHNICAL SHEET VIEW */
                <div className="bg-[#151922] border border-slate-800 rounded-2xl p-5 shadow-lg space-y-5">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div>
                      <h3 className="text-base font-black text-white">
                        Ficha Técnica: {currentItem.name}
                      </h3>
                      <p className="text-xs text-slate-400">
                        Detalhamento de gramaturas, insumos e custos de produção
                      </p>
                    </div>
                    <button
                      onClick={handleSyncTechnicalCmvToItem}
                      className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1.5 shadow"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Sincronizar CMV (R$ {realCmvPerPortion.toFixed(2)})</span>
                    </button>
                  </div>

                  {/* Yield, Packaging and Labor */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-[#1A1F2B] p-3 rounded-xl border border-slate-800">
                    <div>
                      <label className="text-[11px] font-bold text-slate-300 uppercase block mb-1">
                        Rendimento (Porções)
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={yieldServings}
                        onChange={(e) => setYieldServings(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full bg-[#0E1015] border border-slate-700 rounded-lg px-2.5 py-1 text-white font-mono text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-300 uppercase block mb-1">
                        Embalagem / Descartável (R$)
                      </label>
                      <input
                        type="number"
                        step="0.10"
                        value={packagingCost}
                        onChange={(e) => setPackagingCost(Math.max(0, parseFloat(e.target.value) || 0))}
                        className="w-full bg-[#0E1015] border border-slate-700 rounded-lg px-2.5 py-1 text-white font-mono text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-300 uppercase block mb-1">
                        Custo Operacional / Mão de Obra (R$)
                      </label>
                      <input
                        type="number"
                        step="0.10"
                        value={laborCost}
                        onChange={(e) => setLaborCost(Math.max(0, parseFloat(e.target.value) || 0))}
                        className="w-full bg-[#0E1015] border border-slate-700 rounded-lg px-2.5 py-1 text-white font-mono text-xs"
                      />
                    </div>
                  </div>

                  {/* Ingredients Table */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-slate-300 uppercase flex items-center gap-1.5">
                      <Scale className="w-3.5 h-3.5 text-blue-400" />
                      <span>Ingredientes Cadastrados</span>
                    </h4>

                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-[#0E1015] text-slate-400 uppercase text-[10px] font-bold">
                          <tr>
                            <th className="p-2">Ingrediente</th>
                            <th className="p-2">Quantidade</th>
                            <th className="p-2">Unidade</th>
                            <th className="p-2">Custo Unitário</th>
                            <th className="p-2">Subtotal</th>
                            <th className="p-2 text-right">Ação</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                          {currentIngredients.map((ing) => (
                            <tr key={ing.id} className="hover:bg-white/5">
                              <td className="p-2 font-semibold text-white">{ing.name}</td>
                              <td className="p-2 font-mono">{ing.quantity}</td>
                              <td className="p-2 text-slate-400 uppercase">{ing.unit}</td>
                              <td className="p-2 font-mono">R$ {ing.unitCost.toFixed(3)}</td>
                              <td className="p-2 font-mono font-bold text-amber-400">
                                R$ {ing.totalCost.toFixed(2)}
                              </td>
                              <td className="p-2 text-right">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveIngredient(ing.id)}
                                  className="text-rose-400 hover:text-rose-300 p-1 rounded hover:bg-rose-950/40"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Add Ingredient Form */}
                  <form
                    onSubmit={handleAddIngredient}
                    className="bg-[#1A1F2B] p-3 rounded-xl border border-slate-800 space-y-2"
                  >
                    <span className="text-[11px] font-bold text-slate-300 uppercase block">
                      Adicionar Novo Insumo
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
                      <input
                        type="text"
                        placeholder="Nome do insumo (ex: Salmão Fresco)"
                        value={ingredientName}
                        onChange={(e) => setIngredientName(e.target.value)}
                        className="sm:col-span-2 bg-[#0E1015] border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
                      />
                      <div className="grid grid-cols-2 gap-1">
                        <input
                          type="text"
                          placeholder="Qtd (ex: 150)"
                          value={ingredientQty}
                          onChange={(e) => setIngredientQty(e.target.value)}
                          className="bg-[#0E1015] border border-slate-700 rounded-lg px-2 py-1.5 text-white font-mono"
                        />
                        <select
                          value={ingredientUnit}
                          onChange={(e) => setIngredientUnit(e.target.value as any)}
                          className="bg-[#0E1015] border border-slate-700 rounded-lg px-2 py-1.5 text-white font-bold"
                        >
                          <option value="g">g</option>
                          <option value="kg">kg</option>
                          <option value="ml">ml</option>
                          <option value="l">l</option>
                          <option value="un">un</option>
                          <option value="fatia">fatia</option>
                        </select>
                      </div>
                      <div className="flex gap-1">
                        <input
                          type="text"
                          placeholder="Custo/un (ex: 0.08)"
                          value={ingredientUnitCost}
                          onChange={(e) => setIngredientUnitCost(e.target.value)}
                          className="w-full bg-[#0E1015] border border-slate-700 rounded-lg px-2 py-1.5 text-white font-mono"
                        />
                        <button
                          type="submit"
                          className="px-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold flex items-center justify-center shrink-0"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </form>

                  {/* Summary Footer */}
                  <div className="bg-[#0E1015] p-3 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
                    <div>
                      <span className="text-slate-400 block text-[10px]">Custo Real Total da Porção:</span>
                      <span className="text-lg font-black text-emerald-400 font-mono">
                        R$ {realCmvPerPortion.toFixed(2)}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-slate-400 block text-[10px]">Margem no Preço Atual:</span>
                      <span className="text-sm font-black text-white font-mono">
                        {sellingPrice > 0
                          ? (((sellingPrice - realCmvPerPortion) / sellingPrice) * 100).toFixed(1)
                          : 0}
                        %
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
