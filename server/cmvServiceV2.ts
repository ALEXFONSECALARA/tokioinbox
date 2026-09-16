import { getAdminClient } from './db';

/**
 * Complementa server/cmvAiService.ts (já existente, continua funcionando).
 * A diferença: aqui o custo vem de ficha técnica real (ingredientes x
 * quantidade), e as "sugestões de IA" são baseadas em vendas reais dos
 * últimos 30 dias — não em uma simulação genérica de "tendência de mercado".
 * É uma engine de regras (baixa saída + margem) que dá o material bruto para
 * o texto explicativo poder (opcionalmente) ser lapidado pela Gemini via
 * generateCmvEngineeringInsights, reaproveitando o serviço que já existe.
 */

const MARGIN_ALERT_THRESHOLD = 30; // %
const MARGIN_CRITICAL_THRESHOLD = 35; // %
const LOW_SELLER_UNITS_THRESHOLD = 5; // unidades vendidas em 30 dias

export interface IngredientInput {
  name: string;
  unit: string;
  costPerUnit: number;
  supplier?: string;
}

export async function upsertIngredient(restaurantId: string, input: IngredientInput & { id?: string }) {
  const admin = getAdminClient();
  const payload = {
    restaurant_id: restaurantId,
    name: input.name,
    unit: input.unit,
    cost_per_unit: input.costPerUnit,
    supplier: input.supplier ?? null,
  };
  const query = input.id
    ? admin.from('ingredients').update(payload).eq('id', input.id).eq('restaurant_id', restaurantId)
    : admin.from('ingredients').insert(payload);
  const { data, error } = await query.select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function setProductRecipe(productId: string, items: { ingredientId: string; quantity: number }[]) {
  const admin = getAdminClient();
  await admin.from('product_recipe_items').delete().eq('product_id', productId);
  if (items.length === 0) return [];
  const { data, error } = await admin
    .from('product_recipe_items')
    .insert(items.map((i) => ({ product_id: productId, ingredient_id: i.ingredientId, quantity: i.quantity })))
    .select();
  if (error) throw new Error(error.message);
  return data;
}

/** Ficha de CMV calculada — o que alimenta o "Alerta de Margem" do painel. */
export async function listProductCmv(restaurantId: string) {
  const admin = getAdminClient();
  const { data, error } = await admin.from('product_cmv').select('*').eq('restaurant_id', restaurantId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    ...row,
    alert: row.cmv_percent > MARGIN_CRITICAL_THRESHOLD ? 'critico' : row.cmv_percent > MARGIN_ALERT_THRESHOLD ? 'alerta' : 'saudavel',
  }));
}

export interface MenuSuggestion {
  productId: string;
  name: string;
  kind: 'pausar_baixa_saida' | 'revisar_margem' | 'promover_alta_margem';
  reasoning: string;
}

/**
 * Rotina de sugestão baseada em REGRAS sobre dados reais de venda — não é
 * machine learning nem "IA autônoma" em sentido estrito, e a documentação
 * não deve vender como tal. É uma engine de heurísticas transparente:
 *  - CMV crítico (>35%) → revisar preço.
 *  - vendeu pouco nos últimos 30 dias E tem CMV alto → pausar.
 *  - vendeu muito E tem margem boa → promover / criar combo.
 */
export async function generateMenuSuggestions(restaurantId: string, days = 30): Promise<MenuSuggestion[]> {
  const admin = getAdminClient();
  const { data, error } = await admin.rpc('product_sales_performance', { p_restaurant_id: restaurantId, p_days: days });
  if (error) throw new Error(error.message);

  const suggestions: MenuSuggestion[] = [];
  for (const row of data ?? []) {
    if (row.cmv_percent > MARGIN_CRITICAL_THRESHOLD) {
      suggestions.push({
        productId: row.product_id,
        name: row.name,
        kind: 'revisar_margem',
        reasoning: `CMV em ${row.cmv_percent}% (acima do limite de ${MARGIN_CRITICAL_THRESHOLD}%). Vendeu ${row.units_sold} unidades em ${days} dias.`,
      });
    } else if (row.units_sold < LOW_SELLER_UNITS_THRESHOLD && row.cmv_percent > MARGIN_ALERT_THRESHOLD) {
      suggestions.push({
        productId: row.product_id,
        name: row.name,
        kind: 'pausar_baixa_saida',
        reasoning: `Só ${row.units_sold} unidades vendidas em ${days} dias e CMV de ${row.cmv_percent}% — baixo giro com margem apertada.`,
      });
    } else if (row.units_sold >= LOW_SELLER_UNITS_THRESHOLD * 3 && row.cmv_percent <= MARGIN_ALERT_THRESHOLD) {
      suggestions.push({
        productId: row.product_id,
        name: row.name,
        kind: 'promover_alta_margem',
        reasoning: `${row.units_sold} unidades vendidas em ${days} dias com CMV saudável (${row.cmv_percent}%) — bom candidato a combo ou destaque no cardápio.`,
      });
    }
  }
  return suggestions;
}
