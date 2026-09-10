// Monta o "chão de verdade" do restaurante — cardápio, categorias, status
// operacional, entrega — pra injetar no prompt da IA a cada resposta.
//
// Este é o mecanismo central do item 33 ("a IA nunca deve inventar
// preço/produto/promoção/taxa/horário — deve consultar os dados atuais").
// Em vez de function-calling multi-turno (mais frágil de acertar sem poder
// testar contra a API de verdade neste ambiente), a cada pergunta buscamos
// os dados reais do restaurante NESTE MOMENTO e colocamos no prompt como
// contexto — a IA só pode responder com o que está literalmente escrito
// ali, nunca com o que "lembra" de ter visto antes.
import * as db from './db.js';

export async function buildRestaurantContext(slug) {
  const { menuItems, categories, restaurantConfig: config } = await db.readRestaurantData(slug);

  const categoryNameById = new Map((categories || []).map((c) => [c.id, c.name]));

  const menuLines = (menuItems || [])
    .filter((item) => item.available !== false)
    .map((item) => {
      const categoryName = categoryNameById.get(item.categoryId) || 'Sem categoria';
      const price = Number(item.price || 0).toFixed(2).replace('.', ',');
      return `- ${item.name} (${categoryName}): R$ ${price}${item.description ? ` — ${item.description}` : ''}`;
    })
    .join('\n');

  const deliveryLines = [];
  if (config?.isOpen === false) deliveryLines.push('O restaurante está FECHADO no momento (não aceita pedidos).');
  deliveryLines.push(`Horário de funcionamento: ${config?.openingHours || 'não informado'}`);
  deliveryLines.push(`Endereço do restaurante: ${config?.address || 'não informado'}`);
  deliveryLines.push(`WhatsApp: ${config?.whatsapp || 'não informado'}`);
  if (config?.freeDeliveryEnabled && config?.freeDeliveryThreshold) {
    deliveryLines.push(
      `Entrega grátis acima de R$ ${Number(config.freeDeliveryThreshold).toFixed(2).replace('.', ',')}.`
    );
  }
  if (typeof config?.minimumOrder === 'number' && config.minimumOrder > 0) {
    deliveryLines.push(`Pedido mínimo: R$ ${config.minimumOrder.toFixed(2).replace('.', ',')}`);
  }
  deliveryLines.push(`Tempo estimado de entrega padrão: ${config?.estimatedDeliveryTime || 'não informado'}`);
  if (Array.isArray(config?.deliveryZones) && config.deliveryZones.length > 0) {
    const zoneLines = config.deliveryZones
      .filter((z) => z.active !== false)
      .map(
        (z) =>
          `  • ${z.neighborhood}: R$ ${Number(z.fee).toFixed(2).replace('.', ',')}${z.estimatedTime ? ` (${z.estimatedTime})` : ''}`
      )
      .join('\n');
    if (zoneLines) deliveryLines.push(`Bairros atendidos e taxas:\n${zoneLines}`);
  }

  const operationalLines = [];
  operationalLines.push(`Status operacional atual: ${config?.operationalStatus || 'normal'}`);
  if (typeof config?.operationalAdjustmentMinutes === 'number' && config.operationalAdjustmentMinutes > 0) {
    operationalLines.push(
      `Atraso adicional no momento: +${config.operationalAdjustmentMinutes} min sobre o tempo padrão de entrega.`
    );
  }

  return `
RESTAURANTE: ${config?.name || slug}
${config?.tagline ? `Slogan: ${config.tagline}` : ''}

CARDÁPIO DISPONÍVEL AGORA (é a ÚNICA fonte de preços e produtos — nunca use nenhum outro valor):
${menuLines || '(cardápio vazio no momento)'}

ENTREGA:
${deliveryLines.join('\n') || 'Sem informações de entrega configuradas.'}

STATUS OPERACIONAL:
${operationalLines.join('\n') || 'Operação normal, sem ajustes de tempo no momento.'}
`.trim();
}

// Contexto do pedido em andamento do cliente (item 36) — só incluído
// quando o frontend manda um orderId junto da pergunta. Sem isso, a IA não
// tem visibilidade de pedidos e deve dizer que não encontrou nenhum.
export async function buildOrderContext(slug, orderId) {
  if (!orderId) return null;
  const order = await db.getOrder(slug, orderId);
  if (!order) return null;
  return `
PEDIDO EM ANDAMENTO DO CLIENTE (use isso pra responder sobre status — nunca invente um status diferente):
Número: #${order.orderNumber}
Status atual: ${order.status}
Total: R$ ${Number(order.total).toFixed(2).replace('.', ',')}
`.trim();
}
