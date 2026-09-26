import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { RestaurantConfig, RestaurantSlug, MenuCategory, MenuItem } from '../types/restaurant';
import {
  getRestaurantDirectUrl,
  getRestaurantPath,
  generateSlugFromRestaurantName,
  copyToClipboard,
  OFFICIAL_RENDER_DOMAIN,
  getCurrentOrigin,
} from '../utils/urlRouting';
import { RestaurantDirectLinkModal } from './RestaurantDirectLinkModal';
import {
  Globe,
  Copy,
  Check,
  Plus,
  QrCode,
  ExternalLink,
  Store,
  Sparkles,
  Trash2,
  Edit3,
  Clock,
  Bike,
  Phone,
  MessageCircle,
  MapPin,
  CheckCircle2,
  AlertCircle,
  X,
  Share2,
} from 'lucide-react';

const SUGGESTED_LOGOS = [
  'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=200&auto=format&fit=crop&q=80', // Japones
  'https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=200&auto=format&fit=crop&q=80', // Italiano
  'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=200&auto=format&fit=crop&q=80', // Pizza
  'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=200&auto=format&fit=crop&q=80', // Burger
  'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=200&auto=format&fit=crop&q=80', // Trattoria
  'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=200&auto=format&fit=crop&q=80', // Doceria / Padaria
  'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=200&auto=format&fit=crop&q=80', // BBQ
  'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=200&auto=format&fit=crop&q=80', // Mexicano
];

const SUGGESTED_BANNERS = [
  'https://images.unsplash.com/photo-1611143669185-af224c5e3252?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1590947132387-155cc02f3212?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1550547660-d9450f859349?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1552566626-52f8b828add9?w=1200&auto=format&fit=crop&q=80',
];

interface AdminRestaurantsManagerProps {
  onOpenStorePreview?: (slug: RestaurantSlug) => void;
}

export const AdminRestaurantsManager: React.FC<AdminRestaurantsManagerProps> = ({
  onOpenStorePreview,
}) => {
  const {
    restaurants,
    addRestaurant,
    updateRestaurantConfig,
    deleteRestaurant,
    addMenuItem,
  } = useStore();

  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);
  const [qrModalRestaurant, setQrModalRestaurant] = useState<RestaurantConfig | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [editingRestaurant, setEditingRestaurant] = useState<RestaurantConfig | null>(null);

  // New Restaurant Form State
  const [formName, setFormName] = useState('');
  const [formCustomUrlPath, setFormCustomUrlPath] = useState('');
  const [formCuisine, setFormCuisine] = useState('');
  const [formTagline, setFormTagline] = useState('');
  const [formEmoji, setFormEmoji] = useState('🍽️');
  const [formAccentColor, setFormAccentColor] = useState('#E3BD6A');
  const [formLogo, setFormLogo] = useState(SUGGESTED_LOGOS[0]);
  const [formBanner, setFormBanner] = useState(SUGGESTED_BANNERS[0]);
  const [formPhone, setFormPhone] = useState('(11) 98888-7777');
  const [formWhatsapp, setFormWhatsapp] = useState('5511988887777');
  const [formAddress, setFormAddress] = useState('Av. Paulista, 1000 - São Paulo, SP');
  const [formOpeningHours, setFormOpeningHours] = useState('Segunda a Domingo das 11h às 23h');
  const [formDeliveryFee, setFormDeliveryFee] = useState('7.00');
  const [formMinOrder, setFormMinOrder] = useState('35.00');
  const [formTimeMin, setFormTimeMin] = useState('30');
  const [formTimeMax, setFormTimeMax] = useState('45');
  const [formPixKey, setFormPixKey] = useState('contato@restaurante.com.br');
  const [formPixReceiver, setFormPixReceiver] = useState('Empresa Tokio Alimentação Ltda');

  // Handle Name change and auto-generate clean url path
  const handleNameChange = (name: string) => {
    setFormName(name);
    if (!editingRestaurant) {
      const generated = generateSlugFromRestaurantName(name);
      setFormCustomUrlPath(generated);
    }
  };

  const handleCopy = async (rest: RestaurantConfig) => {
    const url = getRestaurantDirectUrl(rest, 'official');
    const ok = await copyToClipboard(url);
    if (ok) {
      setCopiedSlug(rest.slug);
      setTimeout(() => setCopiedSlug(null), 2500);
    }
  };

  const resetForm = () => {
    setFormName('');
    setFormCustomUrlPath('');
    setFormCuisine('');
    setFormTagline('');
    setFormEmoji('🍽️');
    setFormAccentColor('#E3BD6A');
    setFormLogo(SUGGESTED_LOGOS[0]);
    setFormBanner(SUGGESTED_BANNERS[0]);
    setIsCreatingNew(false);
    setEditingRestaurant(null);
  };

  const handleStartEdit = (rest: RestaurantConfig) => {
    setEditingRestaurant(rest);
    setFormName(rest.name);
    setFormCustomUrlPath(rest.customUrlPath || rest.slug);
    setFormCuisine(rest.cuisine);
    setFormTagline(rest.tagline);
    setFormEmoji(rest.emoji);
    setFormAccentColor(rest.accentColor);
    setFormLogo(rest.logo);
    setFormBanner(rest.banner);
    setFormPhone(rest.phone);
    setFormWhatsapp(rest.whatsapp);
    setFormAddress(rest.address);
    setFormOpeningHours(rest.openingHours);
    setFormDeliveryFee(rest.deliveryFee.toString());
    setFormMinOrder(rest.minOrderValue.toString());
    setFormTimeMin(rest.estimatedTimeMin.toString());
    setFormTimeMax(rest.estimatedTimeMax.toString());
    setFormPixKey(rest.pixKey);
    setFormPixReceiver(rest.pixReceiverName);
    setIsCreatingNew(true);
  };

  const handleSaveRestaurant = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    const finalPath = formCustomUrlPath.trim() || generateSlugFromRestaurantName(formName) || 'Restaurante';

    if (editingRestaurant) {
      // Update existing
      updateRestaurantConfig(editingRestaurant.slug, {
        name: formName.trim(),
        customUrlPath: finalPath,
        cuisine: formCuisine.trim() || 'Gastronomia Nobre',
        tagline: formTagline.trim() || 'Pratos frescos preparados artesanalmente',
        emoji: formEmoji || '🍽️',
        accentColor: formAccentColor,
        logo: formLogo,
        banner: formBanner,
        phone: formPhone.trim(),
        whatsapp: formWhatsapp.trim(),
        address: formAddress.trim(),
        openingHours: formOpeningHours.trim(),
        deliveryFee: parseFloat(formDeliveryFee) || 0,
        minOrderValue: parseFloat(formMinOrder) || 0,
        estimatedTimeMin: parseInt(formTimeMin, 10) || 30,
        estimatedTimeMax: parseInt(formTimeMax, 10) || 45,
        pixKey: formPixKey.trim(),
        pixReceiverName: formPixReceiver.trim(),
      });
    } else {
      // Create New
      const newSlug = (finalPath.toLowerCase().replace(/[^a-z0-9]/g, '') || `rest_${Date.now()}`) as RestaurantSlug;
      const newConfig: RestaurantConfig = {
        slug: newSlug,
        customUrlPath: finalPath,
        name: formName.trim(),
        tagline: formTagline.trim() || 'Especialidades culinárias de alta qualidade e ingredientes selecionados',
        cuisine: formCuisine.trim() || 'Alta Gastronomia',
        emoji: formEmoji || '🍽️',
        color: 'amber',
        accentColor: formAccentColor,
        logo: formLogo,
        banner: formBanner,
        rating: 5.0,
        reviewCount: 1,
        estimatedTimeMin: parseInt(formTimeMin, 10) || 30,
        estimatedTimeMax: parseInt(formTimeMax, 10) || 45,
        deliveryFee: parseFloat(formDeliveryFee) || 6.0,
        freeDeliveryThreshold: 100.0,
        minOrderValue: parseFloat(formMinOrder) || 30.0,
        phone: formPhone.trim(),
        whatsapp: formWhatsapp.trim(),
        address: formAddress.trim(),
        openingHours: formOpeningHours.trim(),
        isOpen: true,
        pixKey: formPixKey.trim(),
        pixReceiverName: formPixReceiver.trim(),
        splashEnabled: true,
        splashSlides: [
          {
            image: formBanner,
            title: `Bem-vindo ao ${formName.trim()}`,
            subtitle: 'Ingredientes frescos e preparo autêntico com entrega rápida.',
          },
        ],
        activeTables: Array.from({ length: 30 }, (_, i) => i + 1),
      };

      addRestaurant(newConfig);

      // Add a starter sample dish so the new restaurant has items in its menu immediately
      addMenuItem({
        restaurantSlug: newSlug,
        categoryId: `${newSlug}_principais`,
        name: `Especial do Chef • ${formName.trim()}`,
        description: 'Prato assinatura exclusivo elaborado com os melhores ingredientes da casa.',
        price: 54.9,
        image: formBanner,
        available: true,
        tags: ['destaque', 'mais_vendido'],
        optionGroups: [],
      });
    }

    resetForm();
  };

  const restaurantList = Object.values(restaurants);

  return (
    <div className="space-y-6">
      {/* Top Banner with Summary */}
      <div className="bg-gradient-to-r from-[#111115] via-[#1a1710] to-[#111115] border border-[#E3BD6A]/30 rounded-3xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
              <Globe className="w-5 h-5 text-[#E3BD6A]" />
              <span>Gerenciador de Links HTTP Próprios &amp; Restaurantes</span>
            </h2>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#E3BD6A]/20 text-[#E3BD6A] border border-[#E3BD6A]/30">
              {restaurantList.length} Cozinhas Ativas
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
            Cada restaurante cadastrado possui sua própria URL dedicada HTTP (exemplo:{' '}
            <code className="text-[#E3BD6A] font-bold">{window.location.origin}/SakuraSushiHouse</code>).
            Novos restaurantes criados aqui recebem automaticamente um endereço HTTP exclusivo e QR Code para mesas.
          </p>
        </div>

        <button
          onClick={() => {
            resetForm();
            setIsCreatingNew(true);
          }}
          className="px-4 py-2.5 bg-gradient-to-r from-[#E3BD6A] via-[#FF7A00] to-[#A77A1C] hover:brightness-110 text-slate-950 font-black text-xs rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Cadastrar Novo Restaurante</span>
        </button>
      </div>

      {/* Modal / Inline Form for Creating or Editing Restaurant */}
      {isCreatingNew && (
        <div className="bg-[#111115] border border-[#E3BD6A]/40 rounded-3xl p-6 shadow-2xl space-y-5 animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-[#E3BD6A]/20 text-[#E3BD6A] border border-[#E3BD6A]/30 flex items-center justify-center font-black">
                {editingRestaurant ? <Edit3 className="w-4 h-4" /> : <Store className="w-4 h-4" />}
              </div>
              <h3 className="text-base font-black text-white">
                {editingRestaurant ? `Editar ${editingRestaurant.name}` : 'Cadastrar Nova Cozinha com Link HTTP'}
              </h3>
            </div>
            <button
              onClick={resetForm}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSaveRestaurant} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Nome */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-300 mb-1">
                  Nome do Restaurante *
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="Ex: Sakura Sushi House, Doceria Imperial"
                  className="w-full bg-[#050505] border border-slate-800 focus:border-[#E3BD6A] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none"
                />
              </div>

              {/* HTTP Slug / Path */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#E3BD6A] mb-1 flex items-center justify-between">
                  <span>Slug HTTP Próprio (Caminho da URL) *</span>
                  <span className="text-[10px] text-slate-400 font-normal">Ex: SakuraSushiHouse</span>
                </label>
                <input
                  type="text"
                  required
                  value={formCustomUrlPath}
                  onChange={(e) => setFormCustomUrlPath(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))}
                  placeholder="Ex: SakuraSushiHouse"
                  className="w-full bg-[#050505] border border-[#E3BD6A]/40 focus:border-[#E3BD6A] rounded-xl px-3.5 py-2.5 text-xs font-mono text-[#E3BD6A] placeholder-slate-500 focus:outline-none"
                />
                {formCustomUrlPath && (
                  <p className="text-[11px] text-slate-400 mt-1 font-mono">
                    🌐 Link Final: <span className="text-white font-bold">{OFFICIAL_RENDER_DOMAIN}/{formCustomUrlPath}</span>
                  </p>
                )}
              </div>

              {/* Culinária */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-300 mb-1">
                  Especialidade / Culinária
                </label>
                <input
                  type="text"
                  value={formCuisine}
                  onChange={(e) => setFormCuisine(e.target.value)}
                  placeholder="Ex: Japonesa &amp; Sushi Bar, Confeitaria Fina"
                  className="w-full bg-[#050505] border border-slate-800 focus:border-[#E3BD6A] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none"
                />
              </div>

              {/* Tagline */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-300 mb-1">
                  Slogan / Frase de Impacto
                </label>
                <input
                  type="text"
                  value={formTagline}
                  onChange={(e) => setFormTagline(e.target.value)}
                  placeholder="Ex: Pratos artesanais com ingredientes importados"
                  className="w-full bg-[#050505] border border-slate-800 focus:border-[#E3BD6A] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none"
                />
              </div>

              {/* Emoji & Cor */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-300 mb-1">
                    Emoji
                  </label>
                  <input
                    type="text"
                    value={formEmoji}
                    onChange={(e) => setFormEmoji(e.target.value)}
                    placeholder="🍣"
                    className="w-full bg-[#050505] border border-slate-800 focus:border-[#E3BD6A] rounded-xl px-3 py-2 text-center text-lg text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-300 mb-1">
                    Cor Destaque
                  </label>
                  <input
                    type="color"
                    value={formAccentColor}
                    onChange={(e) => setFormAccentColor(e.target.value)}
                    className="w-full h-10 bg-[#050505] border border-slate-800 rounded-xl cursor-pointer p-1"
                  />
                </div>
              </div>

              {/* Taxa & Tempo */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-300 mb-1">
                    Taxa (R$)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={formDeliveryFee}
                    onChange={(e) => setFormDeliveryFee(e.target.value)}
                    className="w-full bg-[#050505] border border-slate-800 rounded-xl px-2.5 py-2 text-xs text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-300 mb-1">
                    Min (min)
                  </label>
                  <input
                    type="number"
                    value={formTimeMin}
                    onChange={(e) => setFormTimeMin(e.target.value)}
                    className="w-full bg-[#050505] border border-slate-800 rounded-xl px-2.5 py-2 text-xs text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-300 mb-1">
                    Max (min)
                  </label>
                  <input
                    type="number"
                    value={formTimeMax}
                    onChange={(e) => setFormTimeMax(e.target.value)}
                    className="w-full bg-[#050505] border border-slate-800 rounded-xl px-2.5 py-2 text-xs text-white focus:outline-none"
                  />
                </div>
              </div>

              {/* WhatsApp e Telefone */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-300 mb-1">
                  WhatsApp (apenas números com DDI)
                </label>
                <input
                  type="text"
                  value={formWhatsapp}
                  onChange={(e) => setFormWhatsapp(e.target.value)}
                  placeholder="5511987654321"
                  className="w-full bg-[#050505] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                />
              </div>

              {/* Endereço */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-300 mb-1">
                  Endereço Físico
                </label>
                <input
                  type="text"
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  placeholder="Rua / Avenida, Número - Bairro, Cidade"
                  className="w-full bg-[#050505] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                />
              </div>

              {/* Chave PIX */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-300 mb-1">
                  Chave PIX
                </label>
                <input
                  type="text"
                  value={formPixKey}
                  onChange={(e) => setFormPixKey(e.target.value)}
                  placeholder="CNPJ, E-mail ou Celular"
                  className="w-full bg-[#050505] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                />
              </div>

              {/* Favorecido PIX */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-300 mb-1">
                  Nome do Favorecido PIX
                </label>
                <input
                  type="text"
                  value={formPixReceiver}
                  onChange={(e) => setFormPixReceiver(e.target.value)}
                  placeholder="Razão Social ou Nome do Titular"
                  className="w-full bg-[#050505] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                />
              </div>

              {/* URL do Logo */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-300 mb-1">
                  URL da Imagem do Logotipo
                </label>
                <input
                  type="text"
                  value={formLogo}
                  onChange={(e) => setFormLogo(e.target.value)}
                  className="w-full bg-[#050505] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none font-mono"
                />
              </div>

              {/* URL do Banner */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-300 mb-1">
                  URL da Imagem do Banner
                </label>
                <input
                  type="text"
                  value={formBanner}
                  onChange={(e) => setFormBanner(e.target.value)}
                  className="w-full bg-[#050505] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none font-mono"
                />
              </div>
            </div>

            {/* Submit buttons */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-gradient-to-r from-[#E3BD6A] to-[#FF7A00] text-slate-950 font-black rounded-xl text-xs shadow hover:brightness-110 transition-all flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{editingRestaurant ? 'Salvar Alterações' : 'Criar Restaurante & Ativar Link'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Grid of Existing Restaurants and their Dedicated HTTP links */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {restaurantList.map((rest) => {
          const directUrl = getRestaurantDirectUrl(rest, 'official');
          const previewUrl = getRestaurantDirectUrl(rest, 'current');
          const path = getRestaurantPath(rest);
          const isCopied = copiedSlug === rest.slug;

          return (
            <div
              key={rest.slug}
              className="bg-[#111115] border border-[#E3BD6A]/20 hover:border-[#E3BD6A]/50 rounded-2xl p-5 shadow-lg flex flex-col justify-between transition-all group"
            >
              {/* Header: Logo, Name, Badge */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <img
                      src={rest.logo}
                      alt={rest.name}
                      className="w-12 h-12 rounded-xl object-cover border border-[#E3BD6A]/40 shadow"
                    />
                    <span className="absolute -bottom-1 -right-1 text-sm">{rest.emoji}</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-sm group-hover:text-[#E3BD6A] transition-colors">
                      {rest.name}
                    </h4>
                    <span className="text-[10px] font-semibold text-slate-400">
                      {rest.cuisine} • Taxa R${rest.deliveryFee.toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleStartEdit(rest)}
                    className="p-1.5 text-slate-400 hover:text-[#E3BD6A] hover:bg-slate-800 rounded-lg transition-colors"
                    title="Editar informações e URL"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>

                  {/* Protect core 4 from accidental deletion */}
                  {!['japones', 'italiano', 'pizza', 'hamburgueria'].includes(rest.slug) && (
                    <button
                      onClick={() => {
                        if (confirm(`Excluir o restaurante "${rest.name}"?`)) {
                          deleteRestaurant(rest.slug);
                        }
                      }}
                      className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
                      title="Excluir restaurante"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Dedicated HTTP URL Display Box */}
              <div className="mt-4 p-3 bg-[#050505] border border-[#E3BD6A]/30 rounded-xl space-y-1.5">
                <div className="flex items-center justify-between text-[10px] uppercase font-bold text-[#E3BD6A]">
                  <span className="flex items-center gap-1">
                    <Globe className="w-3 h-3" />
                    <span>Link HTTP Próprio</span>
                  </span>
                  <span className="font-mono text-slate-400 lowercase">{path}</span>
                </div>

                <div className="flex items-center justify-between gap-2 font-mono text-xs text-white select-all overflow-hidden">
                  <span className="truncate text-slate-200">{directUrl}</span>

                  <button
                    onClick={() => handleCopy(rest)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold shrink-0 transition-all flex items-center gap-1 ${
                      isCopied
                        ? 'bg-emerald-600 text-white'
                        : 'bg-[#1a1710] hover:bg-[#E3BD6A] text-[#E3BD6A] hover:text-slate-950 border border-[#E3BD6A]/30'
                    }`}
                  >
                    {isCopied ? (
                      <>
                        <Check className="w-3 h-3" />
                        <span>Copiado</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copiar</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Quick Actions Footer */}
              <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                <button
                  onClick={() => setQrModalRestaurant(rest)}
                  className="flex-1 py-1.5 px-2 bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors border border-slate-700/50"
                >
                  <QrCode className="w-3.5 h-3.5 text-[#E3BD6A]" />
                  <span>QR Code</span>
                </button>

                <a
                  href={`https://wa.me/?text=${encodeURIComponent(
                    `Conheça o cardápio oficial de ${rest.name}: ${directUrl}`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-1.5 px-2 bg-emerald-950/40 hover:bg-emerald-900/50 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>WhatsApp</span>
                </a>

                <button
                  onClick={() => {
                    if (onOpenStorePreview) {
                      onOpenStorePreview(rest.slug);
                    } else {
                      window.open(previewUrl, '_blank');
                    }
                  }}
                  className="flex-1 py-1.5 px-2 bg-[#E3BD6A]/15 hover:bg-[#E3BD6A]/25 text-[#E3BD6A] border border-[#E3BD6A]/30 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Acessar</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* QR Code & Direct Link Modal */}
      {qrModalRestaurant && (
        <RestaurantDirectLinkModal
          restaurant={qrModalRestaurant}
          isOpen={!!qrModalRestaurant}
          onClose={() => setQrModalRestaurant(null)}
          onNavigateDirect={(r) => {
            if (onOpenStorePreview) {
              onOpenStorePreview(r.slug);
            }
          }}
        />
      )}
    </div>
  );
};
