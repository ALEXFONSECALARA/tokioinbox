import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { MenuItem } from '../types/restaurant';
import { AIChatMessage } from '../types/ai';
import { BRAND_SHORT_NAME } from '../config/brand';
import {
  Sparkles,
  X,
  Send,
  Plus,
  ShoppingBag,
  Bot,
  User,
  Clock,
  Check,
  AlertCircle,
} from 'lucide-react';

interface CustomerAiConciergeModalProps {
  isOpen?: boolean;
  onClose: () => void;
  onAddToCart?: (item: MenuItem) => void;
  restaurantSlug?: string;
  restaurantName?: string;
}

export const CustomerAiConciergeModal: React.FC<CustomerAiConciergeModalProps> = ({
  isOpen = true,
  onClose,
  onAddToCart,
}) => {
  const { currentRestaurant, cart, addToCart, menuItems } = useStore();

  const restaurantMenuItems = menuItems.filter(
    (m) => m.restaurantSlug === currentRestaurant.slug
  );

  const [inputMessage, setInputMessage] = useState('');
  const [messages, setMessages] = useState<AIChatMessage[]>([
    {
      id: 'msg-welcome',
      sender: 'assistant',
      text: `Olá! Sou o Concierge Gastronômico do ${currentRestaurant.name}. Posso te recomendar nossos melhores pratos oficiais, consultar tempos de preparo ou tirar dúvidas sobre o cardápio! O que você gostaria de saborear hoje?`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const [addedItemIds, setAddedItemIds] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  if (!isOpen) return null;

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || isTyping) return;

    const userText = inputMessage.trim();
    const userMsg: AIChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'customer',
      text: userText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputMessage('');
    setIsTyping(true);

    try {
      // Gather real available items from current restaurant
      const realMenuItems = restaurantMenuItems.map((m) => ({
        id: m.id,
        name: m.name,
        price: m.price,
        description: m.description,
        category: m.categoryId,
        available: m.available !== false,
      }));

      const res = await fetch('/api/ai/concierge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantName: currentRestaurant.name,
          restaurantSlug: currentRestaurant.slug,
          isOpen: currentRestaurant.isOpen,
          openingHours: currentRestaurant.openingHours || '18:00 às 23:30',
          deliveryFee: currentRestaurant.deliveryFee,
          minOrderValue: currentRestaurant.minOrderValue,
          realMenuItems,
          customerMessage: userText,
          cartItems: cart.map((c) => ({ name: c.menuItem.name, quantity: c.quantity })),
        }),
      });

      const data = await res.json();
      const botMsg: AIChatMessage = {
        id: `bot-${Date.now()}`,
        sender: 'assistant',
        text: data.responseText || 'Estou à disposição para apresentar nossos pratos.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        suggestedProductIds: data.suggestedProductIds || [],
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `bot-err-${Date.now()}`,
          sender: 'assistant',
          text: `Desculpe pelo instante de espera. Nosso cardápio do ${currentRestaurant.name} está aberto e pronto para o seu pedido!`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleAddToCart = (item: MenuItem) => {
    addToCart(item, 1, [], '');
    setAddedItemIds((prev) => [...prev, item.id]);
    setTimeout(() => {
      setAddedItemIds((prev) => prev.filter((id) => id !== item.id));
    }, 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-[#0E121B] border border-[#E3BD6A]/30 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.9)] overflow-hidden flex flex-col h-[650px] max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-[#121622] via-[#0E121B] to-[#0A0D14] border-b border-[#E3BD6A]/20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-[#E3BD6A] to-[#8F6A1E] flex items-center justify-center text-slate-950 font-bold shadow-[0_0_10px_rgba(227,189,106,0.3)]">
              <Sparkles className="w-5 h-5 text-slate-950" />
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border border-slate-950" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h2 className="text-sm sm:text-base font-black text-white tracking-tight">
                  Concierge IA • {currentRestaurant.name}
                </h2>
                <span className="text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#E3BD6A]/15 text-[#E3BD6A]">
                  Oficial
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Respostas baseadas estritamente no cardápio e preços reais cadastrados
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Suggestion Chips */}
        <div className="px-4 py-2 bg-[#090C12] border-b border-slate-800 flex items-center gap-2 overflow-x-auto no-scrollbar">
          <span className="text-[10px] font-bold text-slate-500 uppercase shrink-0">Perguntas Rápidas:</span>
          {[
            'O que você recomenda hoje?',
            'Qual o prato mais pedido?',
            'Qual o horário e taxa de entrega?',
            'Opções para compartilhar?',
          ].map((promptText, idx) => (
            <button
              key={idx}
              onClick={() => {
                setInputMessage(promptText);
              }}
              className="text-xs px-2.5 py-1 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 whitespace-nowrap transition-colors"
            >
              {promptText}
            </button>
          ))}
        </div>

        {/* Chat Messages */}
        <div className="p-4 overflow-y-auto space-y-4 flex-1 bg-[#090C12]/50">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.sender === 'customer' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl p-3.5 text-xs sm:text-sm leading-relaxed ${
                  msg.sender === 'customer'
                    ? 'bg-gradient-to-r from-[#E3BD6A] to-[#C99C3D] text-slate-950 font-medium rounded-tr-none'
                    : 'bg-[#121622] border border-slate-800 text-slate-100 rounded-tl-none shadow-sm'
                }`}
              >
                <div className="whitespace-pre-line">{msg.text}</div>
                <span
                  className={`text-[9px] mt-1.5 block text-right ${
                    msg.sender === 'customer' ? 'text-slate-800 font-bold' : 'text-slate-500'
                  }`}
                >
                  {msg.timestamp}
                </span>
              </div>

              {/* Render real product recommendation cards if suggested by AI */}
              {msg.suggestedProductIds && msg.suggestedProductIds.length > 0 && (
                <div className="mt-2.5 space-y-2 w-full max-w-[90%]">
                  <span className="text-[10px] font-bold text-[#E3BD6A] uppercase tracking-wider block">
                    Itens Recomendados do Cardápio:
                  </span>
                  <div className="grid grid-cols-1 gap-2">
                    {msg.suggestedProductIds.map((pid) => {
                      const item = restaurantMenuItems.find((m) => m.id === pid);
                      if (!item) return null;
                      const isAdded = addedItemIds.includes(item.id);

                      return (
                        <div
                          key={item.id}
                          className="p-2.5 rounded-xl bg-[#141A28] border border-[#E3BD6A]/30 flex items-center justify-between gap-3 hover:border-[#E3BD6A] transition-colors"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {item.image && (
                              <img
                                src={item.image}
                                alt={item.name}
                                className="w-10 h-10 rounded-lg object-cover border border-slate-800 shrink-0"
                              />
                            )}
                            <div className="min-w-0">
                              <h4 className="text-xs font-bold text-white truncate">{item.name}</h4>
                              <p className="text-[11px] font-black text-[#E3BD6A]">
                                R$ {item.price.toFixed(2)}
                              </p>
                            </div>
                          </div>

                          <button
                            onClick={() => handleAddToCart(item)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 flex items-center gap-1 transition-all ${
                              isAdded
                                ? 'bg-emerald-500 text-slate-950'
                                : 'bg-[#E3BD6A] hover:bg-[#F5D38A] text-slate-950 shadow-sm'
                            }`}
                          >
                            {isAdded ? (
                              <>
                                <Check className="w-3.5 h-3.5" />
                                <span>Adicionado!</span>
                              </>
                            ) : (
                              <>
                                <Plus className="w-3.5 h-3.5" />
                                <span>Adicionar</span>
                              </>
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ))}

          {isTyping && (
            <div className="flex items-center gap-2 text-xs text-slate-400 p-2 bg-[#121622] rounded-xl border border-slate-800 w-fit">
              <Sparkles className="w-3.5 h-3.5 text-[#E3BD6A] animate-spin" />
              <span>Consultando cardápio oficial...</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <form
          onSubmit={handleSendMessage}
          className="p-3 bg-[#0C0F17] border-t border-slate-800 flex items-center gap-2"
        >
          <input
            type="text"
            placeholder={`Pergunte algo ao Concierge do ${currentRestaurant.name}...`}
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            className="flex-1 px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs sm:text-sm focus:border-[#E3BD6A] focus:outline-none"
          />
          <button
            type="submit"
            disabled={!inputMessage.trim() || isTyping}
            className="p-2.5 rounded-xl bg-gradient-to-r from-[#E3BD6A] to-[#C99C3D] hover:brightness-110 disabled:opacity-50 text-slate-950 font-bold transition-all shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
