import React, { useState, useEffect } from 'react';
import { BRAND_NAME, BRAND_SHORT_NAME } from '../config/brand';
import { Download, X, Gift, Smartphone, Share2, PlusSquare, Sparkles } from 'lucide-react';

interface PwaInstallationBannerProps {
  onOpenCustomerArea?: () => void;
}

export const PwaInstallationBanner: React.FC<PwaInstallationBannerProps> = ({
  onOpenCustomerArea,
}) => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);
  const [isIosDevice, setIsIosDevice] = useState(false);

  useEffect(() => {
    // Check if dismissed recently
    const dismissed = localStorage.getItem('aura_pwa_banner_dismissed');
    if (dismissed) {
      const dismissTime = parseInt(dismissed, 10);
      if (Date.now() - dismissTime < 3 * 24 * 3600000) {
        return; // dismissed within last 3 days
      }
    }

    // Check if running in standalone mode (already installed)
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;

    if (isStandalone) return;

    // Detect iOS
    const ua = window.navigator.userAgent.toLowerCase();
    const isIos = /iphone|ipad|ipod/.test(ua);
    setIsIosDevice(isIos);

    const handleBeforeInstall = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    // If iOS and not installed, show banner after a gentle 3s delay
    if (isIos && !isStandalone) {
      const timer = setTimeout(() => setShowBanner(true), 3000);
      return () => clearTimeout(timer);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleInstallClick = async () => {
    if (isIosDevice) {
      setShowIosGuide(true);
      return;
    }

    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setShowBanner(false);
        if (onOpenCustomerArea) onOpenCustomerArea();
      }
      setDeferredPrompt(null);
    } else {
      // Fallback guide if browser blocked the prompt
      setShowIosGuide(true);
    }
  };

  const handleDismiss = () => {
    setShowBanner(false);
    localStorage.setItem('aura_pwa_banner_dismissed', Date.now().toString());
  };

  if (!showBanner) return null;

  return (
    <>
      <aside aria-label="Instalação do Aplicativo" className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-40 bg-[#0E121B]/95 backdrop-blur-xl border border-[#E3BD6A]/50 rounded-2xl p-4 shadow-[0_10px_35px_rgba(0,0,0,0.85)] animate-in slide-in-from-bottom duration-300">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#E3BD6A] to-[#8F6A1E] flex items-center justify-center text-slate-950 font-black text-xl shadow-[0_0_15px_rgba(227,189,106,0.4)] shrink-0">
            👑
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <h4 className="text-xs font-black text-white uppercase tracking-wider">
                Instale o App {BRAND_SHORT_NAME}
              </h4>
              <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-[#E3BD6A]/20 text-[#E3BD6A]">
                15% OFF
              </span>
            </div>
            <p className="text-[11px] text-slate-300 mt-0.5 leading-snug">
              Tenha acesso mais rápido, rastreio em tempo real e resgate seu cupom exclusivo de boas-vindas!
            </p>

            <div className="flex items-center gap-2 mt-2.5">
              <button
                onClick={handleInstallClick}
                className="py-1.5 px-3 rounded-lg bg-gradient-to-r from-[#E3BD6A] to-[#C99C3D] hover:brightness-110 text-slate-950 font-black text-xs shadow flex items-center gap-1.5 transition-transform active:scale-95"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Instalar Aplicativo</span>
              </button>

              <button
                onClick={handleDismiss}
                className="py-1.5 px-2.5 rounded-lg text-slate-400 hover:text-white text-xs font-medium transition-colors"
              >
                Agora não
              </button>
            </div>
          </div>

          <button
            onClick={handleDismiss}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* iOS Installation Instructions Modal */}
      {showIosGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto">
          <div className="relative w-full max-w-sm max-h-[92vh] overflow-y-auto my-auto bg-[#0E121B] border border-[#E3BD6A]/40 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-[#E3BD6A]" />
                <span>Como Instalar no iPhone / iPad</span>
              </h3>
              <button
                onClick={() => setShowIosGuide(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-300">
              <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                <span className="w-5 h-5 rounded-full bg-[#E3BD6A]/20 text-[#E3BD6A] font-bold flex items-center justify-center shrink-0">
                  1
                </span>
                <p>
                  Toque no ícone de <strong>Compartilhar</strong> (<Share2 className="w-3.5 h-3.5 inline text-cyan-400" />) na barra inferior do Safari.
                </p>
              </div>

              <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                <span className="w-5 h-5 rounded-full bg-[#E3BD6A]/20 text-[#E3BD6A] font-bold flex items-center justify-center shrink-0">
                  2
                </span>
                <p>
                  Role a lista para baixo e toque em <strong>"Adicionar à Tela de Início"</strong> (<PlusSquare className="w-3.5 h-3.5 inline text-[#E3BD6A]" />).
                </p>
              </div>

              <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                <span className="w-5 h-5 rounded-full bg-[#E3BD6A]/20 text-[#E3BD6A] font-bold flex items-center justify-center shrink-0">
                  3
                </span>
                <p>
                  Confirme em <strong>"Adicionar"</strong> no canto superior direito para abrir o app sempre em tela cheia!
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                setShowIosGuide(false);
                setShowBanner(false);
              }}
              className="w-full py-2.5 rounded-xl bg-[#E3BD6A] text-slate-950 font-black text-xs hover:brightness-110 transition-colors"
            >
              Entendido!
            </button>
          </div>
        </div>
      )}
    </>
  );
};
