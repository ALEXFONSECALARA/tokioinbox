import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { RestaurantSlug } from '../types/restaurant';
import { MarketingChannel, CampaignGoal, MarketingContentDraft } from '../types/marketing';
import { BRAND_NAME, BRAND_SHORT_NAME } from '../config/brand';
import {
  Megaphone,
  Share2,
  Copy,
  Check,
  Sparkles,
  Instagram,
  Send,
  MessageCircle,
  Image as ImageIcon,
  ExternalLink,
  Plus,
} from 'lucide-react';

interface AdminMarketingCenterProps {
  selectedSlug: RestaurantSlug | 'all';
}

export const AdminMarketingCenter: React.FC<AdminMarketingCenterProps> = ({ selectedSlug }) => {
  const { restaurants } = useStore();
  const targetSlug = selectedSlug === 'all' ? 'japones' : selectedSlug;
  const currentRestaurant = restaurants[targetSlug] || restaurants.japones;

  const [channel, setChannel] = useState<MarketingChannel>('whatsapp_broadcast');
  const [goal, setGoal] = useState<CampaignGoal>('promocao');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Pre-configured campaigns and AI generator
  const [drafts, setDrafts] = useState<MarketingContentDraft[]>([
    {
      id: 'mkt-1',
      restaurantSlug: targetSlug,
      channel: 'whatsapp_broadcast',
      goal: 'promocao',
      title: 'Quinta Especial com Sashimis e Vinhos Nobres',
      copyText: `🏮 *NOITE GOURMET NO ${currentRestaurant.name.toUpperCase()}*\n\nHoje é o dia perfeito para uma experiência gastronômica memorável no conforto do seu lar.\n\n✨ *Destaque do Chef:* Peça nosso Combo Especial e ganhe 15% OFF com o cupom *AURAPRO15*.\n\n🛵 Entregas ultra-rápidas e embalagens térmicas exclusivas.`,
      callToAction: 'Toque no link abaixo e faça seu pedido direto no cardápio oficial:',
      hashtags: ['#GastronomiaPremium', '#DeliveryDeLuxo', '#AuraPrime', '#JantarEspecial'],
      suggestedImagePrompt:
        'Professional cinematic photography of an exquisite sushi platter with tuna, salmon sashimi, candlelight ambiance, golden reflections, dark background, 8k',
      restaurantLink: `${window.location.origin}/?slug=${targetSlug}`,
      status: 'aprovado',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'mkt-2',
      restaurantSlug: targetSlug,
      channel: 'instagram_post',
      goal: 'horario_fraco',
      title: 'Happy Hour Gastronômico das 18h às 20h',
      copyText: `Antecipe seu pedido e aproveite uma experiência sem filas e com preparo prioritário do nosso sushiman.\n\nExperimente nossos pratos selecionados e celebre os pequenos momentos com alta gastronomia.`,
      callToAction: 'Link na bio para pedir direto no cardápio digital!',
      hashtags: ['#HappyHour', '#GastronomiaDeAutor', '#SaborUnico'],
      suggestedImagePrompt:
        'Luxury restaurant bar cocktail and freshly made gourmet appetizers, warm dramatic lighting, shallow depth of field',
      restaurantLink: `${window.location.origin}/?slug=${targetSlug}`,
      status: 'rascunho',
      createdAt: new Date().toISOString(),
    },
  ]);

  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerateNew = () => {
    setIsGenerating(true);
    setTimeout(() => {
      const newDraft: MarketingContentDraft = {
        id: `mkt-${Date.now()}`,
        restaurantSlug: targetSlug,
        channel,
        goal,
        title: `Especial ${goal.replace('_', ' ').toUpperCase()} • ${currentRestaurant.name}`,
        copyText: `✨ *Sabores Que Surpreendem no ${currentRestaurant.name}*\n\nNossos ingredientes frescos e cortes nobres estão prontos para transformar sua refeição em um momento inesquecível.\n\n🔥 Peça agora pelo app oficial com entrega rastreada em tempo real!`,
        callToAction: 'Acesse nosso cardápio oficial e peça agora:',
        hashtags: ['#AuraPrime', '#AltaGastronomia', '#DeliveryPremium', '#SaborEspecial'],
        suggestedImagePrompt: `Fine dining food presentation of ${currentRestaurant.name} signature dish, luxury dark marble tabletop, studio lighting`,
        restaurantLink: `${window.location.origin}/?slug=${targetSlug}`,
        status: 'rascunho',
        createdAt: new Date().toISOString(),
      };
      setDrafts((prev) => [newDraft, ...prev]);
      setIsGenerating(false);
    }, 900);
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-5 rounded-2xl bg-gradient-to-br from-[#18130B] via-[#121622] to-[#0A0D14] border border-[#E3BD6A]/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#E3BD6A] to-[#8F6A1E] flex items-center justify-center text-slate-950 font-black shadow-[0_0_20px_rgba(227,189,106,0.3)] shrink-0">
            <Megaphone className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-black text-white tracking-tight flex items-center gap-2">
              Central de Marketing IA • {currentRestaurant.name}
            </h2>
            <p className="text-xs text-slate-400">
              Geração de cópias persuasivas, títulos, hashtags e artes para WhatsApp, Instagram e Redes
            </p>
          </div>
        </div>

        <button
          onClick={handleGenerateNew}
          disabled={isGenerating}
          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#E3BD6A] to-[#C99C3D] hover:brightness-110 text-slate-950 font-black text-xs shadow flex items-center gap-2 transition-all self-start sm:self-auto"
        >
          <Sparkles className="w-4 h-4" />
          <span>{isGenerating ? 'Criando Campanha...' : 'Gerar Nova Campanha IA'}</span>
        </button>
      </div>

      {/* Campaign Controls */}
      <div className="p-4 rounded-xl bg-[#121622] border border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-slate-300 mb-1.5">Canal de Destino:</label>
          <select
            value={channel}
            onChange={(e) => setChannel(e.target.value as MarketingChannel)}
            className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:outline-none focus:border-[#E3BD6A]"
          >
            <option value="whatsapp_broadcast">WhatsApp (Disparo / Lista de Transmissão)</option>
            <option value="instagram_post">Instagram (Post Feed)</option>
            <option value="instagram_story">Instagram (Stories com Link)</option>
            <option value="telegram_channel">Telegram (Canal de Ofertas)</option>
            <option value="google_business">Google Meu Negócio (Post de Atualização)</option>
            <option value="pwa_push">Notificação Push PWA</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-300 mb-1.5">Objetivo da Campanha:</label>
          <select
            value={goal}
            onChange={(e) => setGoal(e.target.value as CampaignGoal)}
            className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:outline-none focus:border-[#E3BD6A]"
          >
            <option value="promocao">Promoção / Desconto Especial</option>
            <option value="horario_fraco">Impulsionar Horário Fraco</option>
            <option value="lancamento">Lançamento de Novo Prato</option>
            <option value="retorno_cliente">Reativação de Clientes Inativos</option>
            <option value="carrinho_abandonado">Recuperação de Carrinho</option>
          </select>
        </div>
      </div>

      {/* Campaigns List */}
      <div className="space-y-4">
        {drafts.map((draft) => {
          const fullMessageText = `${draft.title}\n\n${draft.copyText}\n\n${draft.callToAction}\n${draft.restaurantLink}\n\n${draft.hashtags.join(' ')}`;
          const whatsappShareUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(fullMessageText)}`;

          return (
            <div
              key={draft.id}
              className="p-5 rounded-2xl bg-[#121622] border border-slate-800 hover:border-[#E3BD6A]/30 transition-colors space-y-4"
            >
              <div className="flex items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 text-[10px] font-black uppercase tracking-wider border border-emerald-500/20">
                    {draft.channel.replace('_', ' ')}
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-400 text-[10px] font-black uppercase tracking-wider border border-amber-500/20">
                    {draft.goal.replace('_', ' ')}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 font-bold uppercase">
                    Status: <strong className="text-white">{draft.status}</strong>
                  </span>
                  {draft.status === 'rascunho' && (
                    <button
                      onClick={() =>
                        setDrafts((prev) =>
                          prev.map((d) => (d.id === draft.id ? { ...d, status: 'aprovado' } : d))
                        )
                      }
                      className="px-2.5 py-1 rounded-lg bg-emerald-500 text-slate-950 font-black text-xs hover:bg-emerald-400"
                    >
                      Aprovar
                    </button>
                  )}
                </div>
              </div>

              {/* Title & Copy Text */}
              <div className="space-y-2">
                <h3 className="text-base font-bold text-white">{draft.title}</h3>
                <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 text-xs sm:text-sm text-slate-200 whitespace-pre-line leading-relaxed font-sans">
                  {draft.copyText}
                </div>
              </div>

              {/* CTA & Link */}
              <div className="p-3 rounded-xl bg-[#181E2E] border border-slate-700/60 text-xs space-y-1">
                <span className="text-[10px] font-bold text-[#E3BD6A] uppercase block">
                  Chamada para Ação (CTA) e Link:
                </span>
                <p className="text-slate-300">{draft.callToAction}</p>
                <a
                  href={draft.restaurantLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan-400 hover:underline flex items-center gap-1 mt-1 font-mono text-xs"
                >
                  <span>{draft.restaurantLink}</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              {/* Image Prompt for Designer/Midjourney */}
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-xs space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
                  <ImageIcon className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Prompt Sugerido para Geração de Imagem:</span>
                </span>
                <p className="text-slate-400 italic text-[11px]">{draft.suggestedImagePrompt}</p>
              </div>

              {/* Hashtags */}
              <div className="flex flex-wrap gap-1.5">
                {draft.hashtags.map((tag, idx) => (
                  <span
                    key={idx}
                    className="text-xs px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 font-mono"
                  >
                    {tag}
                  </span>
                ))}
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex flex-wrap items-center gap-2">
                <button
                  onClick={() => handleCopy(fullMessageText, draft.id)}
                  className="py-2 px-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 border border-slate-700 transition-colors"
                >
                  {copiedId === draft.id ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Texto Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copiar Conteúdo</span>
                    </>
                  )}
                </button>

                <a
                  href={whatsappShareUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-2 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black flex items-center gap-1.5 shadow transition-colors"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>Disparar via WhatsApp</span>
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
