// Chamadas reais ao Gemini (via @google/genai, já presente nas dependências
// do projeto desde antes desta fase). Isoladas neste arquivo de propósito:
// é o único lugar do backend que fala com a IA, então qualquer ajuste de
// modelo/formato fica concentrado aqui.
//
// IMPORTANTE sobre o que foi e não foi testado nesta entrega: este ambiente
// de build não tem acesso à internet nem a uma GEMINI_API_KEY de verdade,
// então as chamadas abaixo NÃO foram exercitadas contra a API real do
// Gemini. O que testei isoladamente foi tudo que não depende da rede: o
// contexto real injetado no prompt (aiContext.js) e a validação/parsing das
// respostas. Recomendo testar esta parte manualmente após configurar
// GEMINI_API_KEY.
import { GoogleGenAI, Type } from '@google/genai';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const MODEL = 'gemini-2.5-flash';

export function isAiConfigured() {
  return Boolean(GEMINI_API_KEY);
}

let _client = null;
function client() {
  if (!_client) _client = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  return _client;
}

// ---------- Assistente de atendimento (itens 32-38) ----------

const CHAT_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    reply: {
      type: Type.STRING,
      description: 'Resposta em português, natural e curta, pra mostrar direto ao cliente no chat.',
    },
    cartAction: {
      type: Type.OBJECT,
      description: 'Ação sugerida no carrinho, se o cliente pediu pra adicionar algo. "none" se não houver ação.',
      properties: {
        type: { type: Type.STRING, enum: ['add_item', 'none'] },
        itemName: {
          type: Type.STRING,
          description: 'Nome EXATO do item do cardápio (copiado do contexto), quando type=add_item.',
        },
        quantity: { type: Type.INTEGER },
      },
      required: ['type'],
    },
    requestHumanHandoff: {
      type: Type.BOOLEAN,
      description: 'true se o cliente pediu explicitamente pra falar com um atendente humano.',
    },
  },
  required: ['reply', 'requestHumanHandoff'],
};

function buildChatSystemInstruction(restaurantContext, orderContext) {
  return `
Você é o assistente virtual de atendimento deste restaurante dentro do app TokioInbox.

REGRAS ABSOLUTAS (item 33 — nunca invente informação):
- Você SÓ pode citar preços, produtos, promoções, taxas, horários e status usando exatamente o que está no bloco "DADOS REAIS" abaixo.
- Se a informação não estiver lá, diga que não tem certeza e sugira falar com um atendente — nunca chute um valor.
- Nunca finalize um pedido sozinho: você só pode SUGERIR itens (cartAction), quem confirma e envia o pedido é sempre o cliente, na tela de checkout.
- Se o cliente pedir claramente para falar com uma pessoa/atendente/humano, marque requestHumanHandoff=true e diga que vai transferir.
- Seja breve, direto e simpático. Respostas de 1-3 frases, como uma conversa de WhatsApp.

DADOS REAIS:
${restaurantContext}
${orderContext ? `\n${orderContext}` : ''}
`.trim();
}

// history: [{ role: 'user'|'assistant', content: string }]
export async function generateChatReply({ restaurantContext, orderContext, history, userMessage }) {
  if (!isAiConfigured()) {
    return {
      reply: 'O assistente virtual ainda não foi configurado pelo restaurante (falta a chave de IA). Posso te ajudar a falar com um atendente?',
      cartAction: { type: 'none' },
      requestHumanHandoff: false,
      unavailable: true,
    };
  }

  const contents = [
    ...history.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
    { role: 'user', parts: [{ text: userMessage }] },
  ];

  try {
    const response = await client().models.generateContent({
      model: MODEL,
      contents,
      config: {
        systemInstruction: buildChatSystemInstruction(restaurantContext, orderContext),
        responseMimeType: 'application/json',
        responseSchema: CHAT_RESPONSE_SCHEMA,
        temperature: 0.4,
      },
    });
    const parsed = JSON.parse(response.text);
    return {
      reply: parsed.reply,
      cartAction: parsed.cartAction || { type: 'none' },
      requestHumanHandoff: Boolean(parsed.requestHumanHandoff),
      unavailable: false,
    };
  } catch (err) {
    console.error('Erro ao chamar a IA de atendimento:', err.message);
    return {
      reply: 'Desculpa, tive um problema aqui. Quer que eu chame um atendente pra te ajudar?',
      cartAction: { type: 'none' },
      requestHumanHandoff: false,
      unavailable: true,
      error: err.message,
    };
  }
}

// ---------- IA para marketing (item 31) — sugestão, nunca envio automático ----------

const CAMPAIGN_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: 'Título curto e chamativo da notificação, com emoji.' },
    message: { type: Type.STRING, description: 'Mensagem da notificação, 1-2 frases.' },
    suggestedTime: { type: Type.STRING, description: 'Horário sugerido no formato HH:MM.' },
    suggestedAudience: { type: Type.STRING, enum: ['all', 'customers'] },
  },
  required: ['title', 'message', 'suggestedTime', 'suggestedAudience'],
};

export async function generateCampaignSuggestion(brief, restaurantContext) {
  if (!isAiConfigured()) {
    throw Object.assign(new Error('IA não configurada (falta GEMINI_API_KEY).'), { code: 'AI_NOT_CONFIGURED' });
  }
  const response = await client().models.generateContent({
    model: MODEL,
    contents: [{ role: 'user', parts: [{ text: brief }] }],
    config: {
      systemInstruction: `Você ajuda o dono de um restaurante a rascunhar uma notificação push de marketing a partir de um pedido curto dele. Use os dados reais abaixo só como referência de cardápio/identidade — nunca invente promoções que não foram mencionadas pelo dono. Isto é só uma SUGESTÃO: o dono revisa, edita e decide se envia.\n\nDADOS REAIS:\n${restaurantContext}`,
      responseMimeType: 'application/json',
      responseSchema: CAMPAIGN_SCHEMA,
      temperature: 0.7,
    },
  });
  return JSON.parse(response.text);
}

// ---------- IA administrativa (item 40) — só analisa e sugere, nunca aplica mudanças ----------

export async function generateSalesAnalysis(salesSummaryText) {
  if (!isAiConfigured()) {
    throw Object.assign(new Error('IA não configurada (falta GEMINI_API_KEY).'), { code: 'AI_NOT_CONFIGURED' });
  }
  const response = await client().models.generateContent({
    model: MODEL,
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: `Analise estes números reais de vendas do restaurante e traga 2-4 observações objetivas + sugestões práticas. Nunca proponha alterar preço, produto, promoção ou configuração diretamente — só sugerir, quem decide é o dono.\n\n${salesSummaryText}`,
          },
        ],
      },
    ],
    config: { temperature: 0.5 },
  });
  return response.text;
}
