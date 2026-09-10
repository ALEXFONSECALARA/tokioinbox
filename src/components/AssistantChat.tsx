import React, { useEffect, useRef, useState } from 'react';
import { MenuItem } from '../types';
import { MessageCircle, X, Send, UserRound, Loader2 } from 'lucide-react';

const API_BASE = String((import.meta as any).env.VITE_API_URL || '')
  .trim()
  .replace(/\/+$/, '')
  .replace(/\/api$/i, '');
const API_PREFIX = API_BASE ? `${API_BASE}/api` : '/api';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface AssistantChatProps {
  slug: string;
  restaurantName: string;
  customerToken?: string | null;
  activeOrderId?: string | null;
  // Deixa o widget realmente "montar pedido" (item 34) — encontra o item
  // pelo nome exato que a IA devolveu e adiciona ao carrinho já existente,
  // sem duplicar a lógica de carrinho que o App.tsx já tem.
  menuItems: MenuItem[];
  onAddItemToCart: (item: MenuItem, quantity: number) => void;
}

// Chave global (não por restaurante) só pra identificar o navegador do
// visitante sem conta perante o backend — não é um dado sensível, é só um
// identificador de sessão de chat.
const SESSION_ID_KEY = 'tokioinbox_ai_session_id';

function getOrCreateSessionId(): string {
  let id = localStorage.getItem(SESSION_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(SESSION_ID_KEY, id);
  }
  return id;
}

export const AssistantChat: React.FC<AssistantChatProps> = ({
  slug,
  restaurantName,
  customerToken,
  activeOrderId,
  menuItems,
  onAddItemToCart,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<'bot' | 'human'>('bot');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, isOpen]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    setSending(true);
    try {
      const res = await fetch(`${API_PREFIX}/${slug}/ai/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(customerToken ? { Authorization: `Bearer ${customerToken}` } : {}),
        },
        body: JSON.stringify({
          sessionId: getOrCreateSessionId(),
          message: text,
          orderId: activeOrderId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha ao enviar mensagem.');

      setConversationId(data.conversationId);
      setStatus(data.status);

      if (data.status === 'human' && !data.reply) {
        setMessages((prev) => [
          ...prev,
          { role: 'system', content: '👨‍💼 Você foi transferido para um atendente. Aguarde a resposta por aqui.' },
        ]);
        return;
      }

      if (data.reply) {
        setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }]);
      }

      if (data.status === 'human') {
        setMessages((prev) => [
          ...prev,
          { role: 'system', content: '👨‍💼 Transferindo você para um atendente humano...' },
        ]);
      }

      // item 34 — a IA só SUGERE; quem confirma de fato é o cliente, aqui
      // apenas adicionamos ao carrinho pra ele revisar e finalizar sozinho.
      if (data.cartAction?.type === 'add_item' && data.cartAction.itemName) {
        const found = menuItems.find(
          (m) => m.name.toLowerCase() === String(data.cartAction.itemName).toLowerCase()
        );
        if (found) {
          onAddItemToCart(found, data.cartAction.quantity || 1);
          setMessages((prev) => [
            ...prev,
            { role: 'system', content: `🛒 Adicionei "${found.name}" ao seu carrinho.` },
          ]);
        }
      }
    } catch (err: any) {
      setMessages((prev) => [...prev, { role: 'system', content: 'Não consegui enviar sua mensagem agora. Tente de novo em instantes.' }]);
    } finally {
      setSending(false);
    }
  };

  const handleRequestHuman = async () => {
    setMessages((prev) => [...prev, { role: 'system', content: '👨‍💼 Pedido de atendimento humano enviado.' }]);
    setStatus('human');
    if (conversationId) {
      try {
        await fetch(`${API_PREFIX}/${slug}/ai/handoff`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ conversationId }),
        });
      } catch {
        // silencioso — o pedido de handoff é best-effort na UI
      }
    }
  };

  return (
    <>
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-24 right-4 z-40 bg-stone-900 text-white rounded-full p-4 shadow-xl hover:scale-105 transition-transform"
          title="Assistente do restaurante"
        >
          <MessageCircle className="w-5 h-5" />
        </button>
      )}

      {isOpen && (
        <div className="fixed inset-x-4 bottom-4 sm:inset-auto sm:bottom-24 sm:right-4 sm:w-96 z-40 bg-white rounded-2xl shadow-2xl border border-stone-200 flex flex-col max-h-[70vh]">
          <div className="flex items-center justify-between p-3 border-b border-stone-100 bg-stone-900 text-white rounded-t-2xl">
            <span className="text-sm font-bold">🤖 Assistente do {restaurantName}</span>
            <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-white/10 rounded-lg">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2">
            {messages.length === 0 && (
              <p className="text-xs text-stone-400 text-center py-4">
                Pergunte sobre o cardápio, promoções, taxa de entrega ou status do seu pedido.
              </p>
            )}
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`text-xs rounded-2xl px-3 py-2 max-w-[85%] ${
                  m.role === 'user'
                    ? 'bg-stone-900 text-white ml-auto'
                    : m.role === 'system'
                      ? 'bg-amber-50 text-amber-800 mx-auto text-center'
                      : 'bg-stone-100 text-stone-800'
                }`}
              >
                {m.content}
              </div>
            ))}
            {sending && (
              <div className="flex items-center gap-1.5 text-xs text-stone-400">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Digitando...
              </div>
            )}
          </div>

          {status === 'human' && (
            <p className="text-[11px] text-center text-amber-600 pb-1">
              Um atendente vai responder por aqui — pode continuar escrevendo.
            </p>
          )}

          <div className="p-2 border-t border-stone-100 flex items-center gap-1.5">
            <button
              onClick={handleRequestHuman}
              title="Falar com atendente"
              className="p-2 rounded-xl text-stone-500 hover:bg-stone-100"
            >
              <UserRound className="w-4 h-4" />
            </button>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Digite sua mensagem..."
              className="flex-1 border border-stone-200 rounded-xl px-3 py-2 text-xs"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || sending}
              className="p-2 rounded-xl bg-stone-900 text-white disabled:opacity-40"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
};
