import React, { useState } from 'react';
import {
  Monitor,
  Smartphone,
  Tablet,
  RotateCw,
  ZoomIn,
  ZoomOut,
  RefreshCw,
  X,
  Sliders,
  Maximize2,
  Minimize2,
  ExternalLink,
  Layers,
  Sparkles,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';

interface DevicePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type DevicePreset =
  | 'mobile-sm'
  | 'mobile'
  | 'tablet'
  | 'tablet-landscape'
  | 'desktop'
  | 'desktop-lg'
  | 'side-by-side';

export const DevicePreviewModal: React.FC<DevicePreviewModalProps> = ({ isOpen, onClose }) => {
  const { activeRestaurantSlug } = useStore();
  const [activePreset, setActivePreset] = useState<DevicePreset>('mobile');
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [zoom, setZoom] = useState<number>(100);
  const [previewPath, setPreviewPath] = useState<'admin' | 'menu' | 'home'>('admin');
  const [iframeKey, setIframeKey] = useState<number>(0);

  // Custom dimensions
  const [customWidth, setCustomWidth] = useState<number>(375);
  const [customHeight, setCustomHeight] = useState<number>(812);
  const [isCustom, setIsCustom] = useState<boolean>(false);

  if (!isOpen) return null;

  // Preset dimension mapper
  const getDimensions = (preset: DevicePreset, isLandscape: boolean) => {
    switch (preset) {
      case 'mobile-sm':
        return isLandscape ? { width: 640, height: 360, name: 'Mobile Pequeno (360px)' } : { width: 360, height: 640, name: 'Mobile Pequeno (360px)' };
      case 'mobile':
        return isLandscape ? { width: 812, height: 375, name: 'Mobile Padrão (375px)' } : { width: 375, height: 812, name: 'Mobile Padrão (375px)' };
      case 'tablet':
        return isLandscape ? { width: 1024, height: 768, name: 'Tablet (768px)' } : { width: 768, height: 1024, name: 'Tablet (768px)' };
      case 'tablet-landscape':
        return { width: 1024, height: 768, name: 'Tablet Landscape (1024px)' };
      case 'desktop':
        return { width: 1280, height: 800, name: 'Desktop (1280px)' };
      case 'desktop-lg':
        return { width: 1440, height: 900, name: 'Desktop Grande (1440px)' };
      default:
        return { width: 375, height: 812, name: 'Personalizado' };
    }
  };

  const handleSelectPreset = (preset: DevicePreset) => {
    setActivePreset(preset);
    setIsCustom(false);
    if (preset === 'tablet-landscape') {
      setOrientation('landscape');
    }
  };

  const handleToggleOrientation = () => {
    setOrientation((prev) => (prev === 'portrait' ? 'landscape' : 'portrait'));
  };

  const currentDim = isCustom
    ? { width: customWidth, height: customHeight, name: 'Personalizado' }
    : getDimensions(activePreset, orientation === 'landscape');

  // Base URL for iframe preview
  const getIframeUrl = () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    if (previewPath === 'admin') {
      return `${origin}?view=admin&preview=true&rest=${activeRestaurantSlug}`;
    } else if (previewPath === 'menu') {
      return `${origin}?view=menu&rest=${activeRestaurantSlug}&preview=true`;
    } else {
      return `${origin}?view=home&preview=true`;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#08090C]/95 backdrop-blur-xl flex flex-col overflow-hidden text-slate-100 animate-fadeIn">
      {/* Top Controls Toolbar */}
      <header className="h-16 border-b border-[#232936] bg-[#12151C] px-4 flex items-center justify-between gap-3 shrink-0 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#FF5E1E] to-[#E5A93C] flex items-center justify-center text-slate-950 font-black text-sm shadow-md">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-xs font-black tracking-wider uppercase text-white flex items-center gap-1.5">
                Visualizar Como
                <span className="text-[10px] bg-[#FF5E1E]/20 text-[#FF5E1E] font-bold px-1.5 py-0.5 rounded border border-[#FF5E1E]/30">
                  REAL LIVE
                </span>
              </h2>
              <p className="text-[10px] text-slate-400">Preview Responsivo Multidispositivo em tempo real</p>
            </div>
          </div>

          <div className="h-6 w-px bg-slate-800 mx-1 hidden sm:block" />

          {/* View target selector */}
          <div className="hidden md:flex items-center bg-[#171B24] p-1 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setPreviewPath('admin')}
              className={`px-3 py-1 rounded-lg font-bold transition-all ${
                previewPath === 'admin'
                  ? 'bg-[#FF5E1E] text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Painel Admin
            </button>
            <button
              onClick={() => setPreviewPath('menu')}
              className={`px-3 py-1 rounded-lg font-bold transition-all ${
                previewPath === 'menu'
                  ? 'bg-[#FF5E1E] text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Cardápio Cliente
            </button>
            <button
              onClick={() => setPreviewPath('home')}
              className={`px-3 py-1 rounded-lg font-bold transition-all ${
                previewPath === 'home'
                  ? 'bg-[#FF5E1E] text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Vitrine Principal
            </button>
          </div>
        </div>

        {/* Device preset buttons */}
        <div className="flex items-center gap-1 bg-[#171B24] p-1 rounded-xl border border-slate-800 overflow-x-auto no-scrollbar">
          <button
            onClick={() => handleSelectPreset('mobile-sm')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all ${
              activePreset === 'mobile-sm' && !isCustom
                ? 'bg-[#FF5E1E] text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
            title="Mobile Pequeno 360px"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span className="hidden lg:inline text-[11px]">360px</span>
          </button>
          <button
            onClick={() => handleSelectPreset('mobile')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all ${
              activePreset === 'mobile' && !isCustom
                ? 'bg-[#FF5E1E] text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
            title="Mobile 375px"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span className="hidden lg:inline text-[11px]">375px</span>
          </button>
          <button
            onClick={() => handleSelectPreset('tablet')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all ${
              activePreset === 'tablet' && !isCustom
                ? 'bg-[#FF5E1E] text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
            title="Tablet 768px"
          >
            <Tablet className="w-3.5 h-3.5" />
            <span className="hidden lg:inline text-[11px]">768px</span>
          </button>
          <button
            onClick={() => handleSelectPreset('tablet-landscape')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all ${
              activePreset === 'tablet-landscape' && !isCustom
                ? 'bg-[#FF5E1E] text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
            title="Tablet Landscape 1024px"
          >
            <Tablet className="w-3.5 h-3.5 rotate-90" />
            <span className="hidden lg:inline text-[11px]">1024px</span>
          </button>
          <button
            onClick={() => handleSelectPreset('desktop')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all ${
              activePreset === 'desktop' && !isCustom
                ? 'bg-[#FF5E1E] text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
            title="Desktop 1280px"
          >
            <Monitor className="w-3.5 h-3.5" />
            <span className="hidden lg:inline text-[11px]">1280px</span>
          </button>
          <button
            onClick={() => handleSelectPreset('desktop-lg')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all ${
              activePreset === 'desktop-lg' && !isCustom
                ? 'bg-[#FF5E1E] text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
            title="Desktop Grande 1440px"
          >
            <Monitor className="w-3.5 h-3.5" />
            <span className="hidden lg:inline text-[11px]">1440px</span>
          </button>
          <button
            onClick={() => handleSelectPreset('side-by-side')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all ${
              activePreset === 'side-by-side'
                ? 'bg-[#E5A93C] text-slate-950 font-black shadow'
                : 'text-slate-400 hover:text-white'
            }`}
            title="Lado a Lado (Desktop + Tablet + Mobile)"
          >
            <Layers className="w-3.5 h-3.5" />
            <span className="hidden sm:inline text-[11px]">3 Telas Juntas</span>
          </button>
        </div>

        {/* Right tools: Orientation, Zoom, Refresh, Close */}
        <div className="flex items-center gap-2">
          {activePreset !== 'side-by-side' && (
            <button
              onClick={handleToggleOrientation}
              className="p-2 rounded-xl bg-[#171B24] hover:bg-[#202532] text-slate-300 hover:text-white border border-slate-800 transition-colors"
              title="Girar Orientação (Portrait / Landscape)"
            >
              <RotateCw className="w-4 h-4" />
            </button>
          )}

          {/* Zoom controls */}
          <div className="hidden xl:flex items-center bg-[#171B24] rounded-xl border border-slate-800 p-1 text-xs">
            <button
              onClick={() => setZoom((z) => Math.max(50, z - 15))}
              className="p-1 hover:text-white text-slate-400"
              title="Diminuir Zoom"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="px-1.5 text-[11px] font-mono text-[#E5A93C] font-bold">{zoom}%</span>
            <button
              onClick={() => setZoom((z) => Math.min(125, z + 15))}
              className="p-1 hover:text-white text-slate-400"
              title="Aumentar Zoom"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            onClick={() => setIframeKey((k) => k + 1)}
            className="p-2 rounded-xl bg-[#171B24] hover:bg-[#202532] text-slate-300 hover:text-white border border-slate-800 transition-colors"
            title="Recarregar Preview Real"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-red-950/40 hover:bg-red-900/60 text-red-300 border border-red-800/40 transition-colors"
            title="Fechar Visualizador"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main View Area */}
      <div className="flex-1 overflow-auto p-4 md:p-8 flex items-center justify-center bg-[#0A0B0E] relative select-none">
        {/* Background Grid Pattern */}
        <div
          className="absolute inset-0 opacity-10 pointer-events-none"
          style={{
            backgroundImage:
              'linear-gradient(#FF5E1E 1px, transparent 1px), linear-gradient(90deg, #FF5E1E 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />

        {activePreset === 'side-by-side' ? (
          /* Side-by-Side Mode: Desktop (scaled) + Tablet + Mobile */
          <div className="flex flex-wrap items-start justify-center gap-8 w-full max-w-[1800px] z-10 py-6">
            {/* 1. Mobile Frame */}
            <div className="flex flex-col items-center">
              <div className="text-xs font-bold text-slate-400 mb-2 flex items-center gap-1.5">
                <Smartphone className="w-4 h-4 text-[#FF5E1E]" /> Mobile (375 × 760)
              </div>
              <div
                className="rounded-[40px] bg-[#1A1D24] p-3 border-[4px] border-[#2E3544] shadow-2xl relative"
                style={{ width: 375 + 24, height: 760 + 24 }}
              >
                {/* Camera notch */}
                <div className="absolute top-4 left-1/2 -translate-x-1/2 w-28 h-4 bg-[#12141A] rounded-full z-20" />
                <iframe
                  key={`frame-mob-${iframeKey}`}
                  src={getIframeUrl()}
                  className="w-full h-full rounded-[30px] bg-[#09090D] border-0"
                  title="Mobile Real Preview"
                />
              </div>
            </div>

            {/* 2. Tablet Frame */}
            <div className="flex flex-col items-center">
              <div className="text-xs font-bold text-slate-400 mb-2 flex items-center gap-1.5">
                <Tablet className="w-4 h-4 text-[#E5A93C]" /> Tablet (640 × 760)
              </div>
              <div
                className="rounded-[36px] bg-[#1A1D24] p-3 border-[4px] border-[#2E3544] shadow-2xl relative"
                style={{ width: 640 + 24, height: 760 + 24 }}
              >
                <div className="absolute top-4 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-slate-800 z-20" />
                <iframe
                  key={`frame-tab-${iframeKey}`}
                  src={getIframeUrl()}
                  className="w-full h-full rounded-[26px] bg-[#09090D] border-0"
                  title="Tablet Real Preview"
                />
              </div>
            </div>

            {/* 3. Desktop Frame (scaled) */}
            <div className="flex flex-col items-center">
              <div className="text-xs font-bold text-slate-400 mb-2 flex items-center gap-1.5">
                <Monitor className="w-4 h-4 text-emerald-400" /> Desktop (1280px)
              </div>
              <div
                className="rounded-2xl bg-[#1A1D24] p-3 border-[4px] border-[#2E3544] shadow-2xl relative overflow-hidden"
                style={{ width: 720, height: 760 + 24 }}
              >
                <iframe
                  key={`frame-desk-${iframeKey}`}
                  src={getIframeUrl()}
                  className="w-[1280px] h-[1350px] origin-top-left rounded-lg bg-[#09090D] border-0"
                  style={{ transform: 'scale(0.55)', transformOrigin: 'top left' }}
                  title="Desktop Real Preview"
                />
              </div>
            </div>
          </div>
        ) : (
          /* Single Device Simulated Frame */
          <div
            className="transition-all duration-300 relative z-10"
            style={{
              transform: `scale(${zoom / 100})`,
              transformOrigin: 'center center',
            }}
          >
            {/* Device Frame Wrapper */}
            <div
              className={`bg-[#14171E] border-[4px] border-[#242A36] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9)] relative transition-all ${
                activePreset.startsWith('mobile')
                  ? 'rounded-[46px] p-3.5'
                  : activePreset.startsWith('tablet')
                  ? 'rounded-[36px] p-4'
                  : 'rounded-2xl p-2.5'
              }`}
              style={{
                width: currentDim.width + (activePreset.startsWith('mobile') ? 28 : 20),
                height: currentDim.height + (activePreset.startsWith('mobile') ? 28 : 20),
              }}
            >
              {/* Mobile Notch / Speaker */}
              {activePreset.startsWith('mobile') && orientation === 'portrait' && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 w-32 h-4 bg-[#0A0B0E] rounded-full z-20 flex items-center justify-center">
                  <div className="w-10 h-1 rounded-full bg-slate-800" />
                  <div className="w-2 h-2 rounded-full bg-slate-900 ml-2" />
                </div>
              )}

              {/* Tablet Camera Dot */}
              {activePreset.startsWith('tablet') && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-slate-800 z-20" />
              )}

              {/* Desktop Browser Bar */}
              {activePreset.startsWith('desktop') && (
                <div className="h-7 bg-[#1A1E26] rounded-t-lg border-b border-slate-800 px-3 flex items-center gap-2 mb-1">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
                  </div>
                  <div className="flex-1 max-w-sm mx-auto bg-[#0E1015] text-[11px] font-mono text-slate-400 px-3 py-0.5 rounded-md text-center truncate">
                    tokioinbox.com/{previewPath === 'admin' ? 'admin' : previewPath === 'menu' ? activeRestaurantSlug : 'vitrine'}
                  </div>
                </div>
              )}

              {/* Live Iframe */}
              <iframe
                key={`frame-single-${iframeKey}-${activePreset}-${previewPath}`}
                src={getIframeUrl()}
                className={`w-full h-full bg-[#09090D] border-0 ${
                  activePreset.startsWith('mobile')
                    ? 'rounded-[36px]'
                    : activePreset.startsWith('tablet')
                    ? 'rounded-[26px]'
                    : 'rounded-b-lg'
                }`}
                style={{
                  height: activePreset.startsWith('desktop') ? currentDim.height - 32 : '100%',
                }}
                title="Device Real Preview"
              />
            </div>

            {/* Bottom device info badge */}
            <div className="text-center mt-3">
              <span className="bg-[#14171E] text-slate-300 text-xs px-3 py-1 rounded-full border border-slate-800 shadow font-mono">
                {currentDim.name} — {currentDim.width} × {currentDim.height}px ({zoom}%)
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
