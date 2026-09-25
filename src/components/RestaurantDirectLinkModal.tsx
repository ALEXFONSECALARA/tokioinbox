import React, { useState, useEffect } from 'react';
import { RestaurantConfig } from '../types/restaurant';
import {
  getRestaurantDirectUrl,
  getRestaurantPath,
  getWhatsAppShareUrl,
  copyToClipboard,
  OFFICIAL_RENDER_DOMAIN,
  getCurrentOrigin,
} from '../utils/urlRouting';
import { generateQrCodeDataUrl } from './QrCodeImage';
import {
  X,
  Copy,
  Check,
  ExternalLink,
  Share2,
  QrCode,
  Globe,
  Sparkles,
  Smartphone,
  Download,
  Info,
} from 'lucide-react';

interface RestaurantDirectLinkModalProps {
  restaurant: RestaurantConfig | null;
  isOpen: boolean;
  onClose: () => void;
  onNavigateDirect?: (restaurant: RestaurantConfig) => void;
}

export const RestaurantDirectLinkModal: React.FC<RestaurantDirectLinkModalProps> = ({
  restaurant,
  isOpen,
  onClose,
  onNavigateDirect,
}) => {
  const [copiedMode, setCopiedMode] = useState<'official' | 'preview' | null>(null);
  const [selectedDomainMode, setSelectedDomainMode] = useState<'official' | 'current'>('official');
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);

  const officialUrl = restaurant ? getRestaurantDirectUrl(restaurant, 'official') : '';
  const currentPreviewUrl = restaurant ? getRestaurantDirectUrl(restaurant, 'current') : '';
  const activeUrl = selectedDomainMode === 'official' ? officialUrl : currentPreviewUrl;

  // QR gerado localmente (sem depender de serviço externo) — recalcula
  // sempre que a URL ativa mudar (troca de domínio oficial/atual).
  useEffect(() => {
    let cancelled = false;
    if (!isOpen || !activeUrl) {
      setQrCodeUrl(null);
      return;
    }
    generateQrCodeDataUrl(activeUrl, 320)
      .then((dataUrl) => {
        if (!cancelled) setQrCodeUrl(dataUrl);
      })
      .catch(() => {
        if (!cancelled) setQrCodeUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, activeUrl]);

  if (!isOpen || !restaurant) return null;

  const handleCopy = async (mode: 'official' | 'preview') => {
    const targetUrl = mode === 'official' ? officialUrl : currentPreviewUrl;
    const success = await copyToClipboard(targetUrl);
    if (success) {
      setCopiedMode(mode);
      setTimeout(() => setCopiedMode(null), 2500);
    }
  };

  const handleOpenNewTab = () => {
    window.open(activeUrl, '_blank');
  };

  const handleOpenHere = () => {
    if (onNavigateDirect) {
      onNavigateDirect(restaurant);
    }
    onClose();
  };

  return (
    <div className="modal-viewport fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/95 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-[#0c0c10] border border-[#E3BD6A]/30 rounded-3xl shadow-[0_25px_70px_rgba(0,0,0,0.95)] overflow-hidden flex flex-col max-h-[92vh]">
        {/* Top Gold Shimmer Border */}
        <div className="h-1 bg-gradient-to-r from-transparent via-[#E3BD6A] to-transparent w-full" />

        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-800/80 flex items-center justify-between bg-[#111115]">
          <div className="flex items-center gap-3">
            <div className="relative">
              <img
                src={restaurant.logo}
                alt={restaurant.name}
                className="w-12 h-12 rounded-2xl object-cover border border-[#E3BD6A]/50 shadow"
              />
              <span className="absolute -bottom-1 -right-1 text-base">{restaurant.emoji}</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-white">{restaurant.name}</h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#E3BD6A]/10 text-[#E3BD6A] border border-[#E3BD6A]/30 uppercase">
                  HTTP Próprio
                </span>
              </div>
              <p className="text-xs text-slate-400">Link exclusivo e QR Code para acesso direto</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 text-xs text-slate-300">
          {/* Domain Mode Switcher */}
          <div className="flex items-center justify-between bg-[#16161c] p-1.5 rounded-2xl border border-slate-800">
            <button
              onClick={() => setSelectedDomainMode('official')}
              className={`flex-1 py-2 px-3 rounded-xl font-bold transition-all flex items-center justify-center gap-1.5 ${
                selectedDomainMode === 'official'
                  ? 'bg-gradient-to-r from-[#E3BD6A] via-[#FF7A00] to-[#A77A1C] text-slate-950 shadow font-black'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Domínio de Produção (Render)</span>
            </button>

            <button
              onClick={() => setSelectedDomainMode('current')}
              className={`flex-1 py-2 px-3 rounded-xl font-bold transition-all flex items-center justify-center gap-1.5 ${
                selectedDomainMode === 'current'
                  ? 'bg-gradient-to-r from-[#E3BD6A] via-[#FF7A00] to-[#A77A1C] text-slate-950 shadow font-black'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Ambiente Atual (Preview)</span>
            </button>
          </div>

          {/* URL Display & Copy Box */}
          <div className="space-y-2">
            <label className="block text-[11px] font-black uppercase tracking-wider text-[#E3BD6A] flex items-center justify-between">
              <span>Endereço HTTP Dedicado do Restaurante</span>
              <span className="text-[10px] text-slate-400 font-normal">
                Rota: <code className="text-[#E3BD6A]">{getRestaurantPath(restaurant)}</code>
              </span>
            </label>

            <div className="p-3.5 rounded-2xl bg-[#111115] border border-[#E3BD6A]/30 flex items-center justify-between gap-3 shadow-inner">
              <div className="flex items-center gap-2 min-w-0 flex-1 font-mono text-xs sm:text-sm text-white select-all overflow-x-auto no-scrollbar py-0.5">
                <Globe className="w-4 h-4 text-[#E3BD6A] shrink-0" />
                <span className="truncate">{activeUrl}</span>
              </div>

              <button
                onClick={() => handleCopy(selectedDomainMode === 'official' ? 'official' : 'preview')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold shrink-0 transition-all flex items-center gap-1.5 shadow ${
                  copiedMode
                    ? 'bg-emerald-600 text-white'
                    : 'bg-gradient-to-r from-[#E3BD6A] to-[#A77A1C] hover:brightness-110 text-slate-950 font-black'
                }`}
              >
                {copiedMode ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copiar Link</span>
                  </>
                )}
              </button>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed">
              💡 Ao divulgar este link no Instagram, WhatsApp ou panfletos, os clientes caem{' '}
              <strong className="text-white">diretamente no cardápio do {restaurant.name}</strong>, sem passar pela página inicial ou concorrentes.
            </p>
          </div>

          {/* QR Code Section */}
          <div className="p-4 rounded-2xl bg-[#14141a] border border-slate-800 flex flex-col sm:flex-row items-center gap-4">
            <div className="relative p-2 rounded-2xl bg-[#050505] border border-[#E3BD6A]/40 shadow-[0_0_20px_rgba(227,189,106,0.2)] shrink-0">
              {qrCodeUrl ? (
                <img
                  src={qrCodeUrl}
                  alt={`QR Code ${restaurant.name}`}
                  className="w-32 h-32 rounded-xl object-contain"
                  loading="lazy"
                />
              ) : (
                <div className="w-32 h-32 rounded-xl flex items-center justify-center bg-black/30 animate-pulse">
                  <span className="text-[10px] text-slate-500 font-bold uppercase">Gerando QR...</span>
                </div>
              )}
              <span className="absolute -top-2 -right-2 bg-[#E3BD6A] text-slate-950 text-[9px] font-black px-1.5 py-0.2 rounded-md shadow">
                QR CODE
              </span>
            </div>

            <div className="space-y-2 text-center sm:text-left flex-1">
              <h4 className="font-bold text-white text-sm flex items-center justify-center sm:justify-start gap-1.5">
                <QrCode className="w-4 h-4 text-[#E3BD6A]" />
                <span>QR Code para Mesas &amp; Balcão</span>
              </h4>
              <p className="text-[11px] text-slate-400">
                Imprima em displays de acrílico ou coloque em comandas para o cliente escanear e abrir o cardápio instantaneamente.
              </p>

              <div className="flex items-center justify-center sm:justify-start gap-2 pt-1">
                <a
                  href={qrCodeUrl || undefined}
                  target="_blank"
                  download={`qrcode-${restaurant.slug}.png`}
                  rel="noopener noreferrer"
                  aria-disabled={!qrCodeUrl}
                  onClick={(e) => { if (!qrCodeUrl) e.preventDefault(); }}
                  className={`px-3 py-1.5 rounded-xl bg-slate-800 text-white font-semibold text-[11px] flex items-center gap-1.5 transition-colors ${
                    qrCodeUrl ? 'hover:bg-slate-700 cursor-pointer' : 'opacity-50 cursor-not-allowed'
                  }`}
                >
                  <Download className="w-3.5 h-3.5 text-[#E3BD6A]" />
                  <span>Baixar Imagem</span>
                </a>

                <button
                  onClick={handleOpenHere}
                  className="px-3 py-1.5 rounded-xl bg-[#E3BD6A]/20 hover:bg-[#E3BD6A]/30 text-[#E3BD6A] font-bold text-[11px] flex items-center gap-1.5 transition-colors border border-[#E3BD6A]/30"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Testar no App</span>
                </button>
              </div>
            </div>
          </div>

          {/* Direct Share Options */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <a
              href={getWhatsAppShareUrl(restaurant, activeUrl)}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-3 rounded-2xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 font-bold flex items-center justify-center gap-2 transition-all"
            >
              <Share2 className="w-4 h-4" />
              <span>Enviar via WhatsApp</span>
            </a>

            <button
              onClick={handleOpenNewTab}
              className="px-4 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 font-bold flex items-center justify-center gap-2 transition-all"
            >
              <ExternalLink className="w-4 h-4 text-[#E3BD6A]" />
              <span>Abrir em Nova Aba</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#111115] border-t border-slate-800/80 flex items-center justify-between text-slate-400 text-[11px]">
          <span>Tokio inBox • Roteamento Dinâmico Multicardápio</span>
          <button onClick={onClose} className="text-white hover:underline font-semibold">
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
