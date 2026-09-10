import React, { useState } from 'react';
import { X, Smartphone, Monitor } from 'lucide-react';
import { getLayoutTheme } from '../utils/layouts';
import { RestaurantCard, RestaurantCardData } from './RestaurantCard';
import { LayoutId } from '../types';

// Prévia do layout escolhido, com alternância celular/desktop — usado tanto
// pelo seletor de layout de UM restaurante (dentro do card dele na vitrine)
// quanto pelo painel global "Vitrine Principal" (título/subtítulo/fundo).
// Não é uma página separada: renderiza os MESMOS componentes (RestaurantCard)
// que a Landing de verdade usa, só dentro de uma moldura de tamanho fixo.
interface LayoutPreviewModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  pageLayout?: LayoutId;
  restaurants: RestaurantCardData[];
  // Quando a prévia é de UM restaurante específico (não da vitrine toda),
  // esse slug/nome fica destacado com um selo "Este restaurante".
  highlightSlug?: string;
}

export const LayoutPreviewModal: React.FC<LayoutPreviewModalProps> = ({
  open,
  onClose,
  title,
  subtitle,
  pageLayout,
  restaurants,
  highlightSlug,
}) => {
  const [viewport, setViewport] = useState<'mobile' | 'desktop'>('desktop');
  if (!open) return null;
  const theme = getLayoutTheme(pageLayout);

  return (
    <div className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6">
      <div className="bg-stone-950 rounded-2xl overflow-hidden w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl">
        {/* Barra do modal: título + alternância celular/desktop + fechar */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-stone-800 shrink-0">
          <span className="text-white text-sm font-bold flex-1 truncate">Pré-visualização — {theme.label}</span>
          <div className="flex items-center gap-1 bg-stone-800 rounded-xl p-1">
            <button
              type="button"
              onClick={() => setViewport('mobile')}
              className={`p-1.5 rounded-lg transition-colors ${viewport === 'mobile' ? 'bg-white text-stone-900' : 'text-stone-400 hover:text-white'}`}
              title="Ver como celular"
            >
              <Smartphone className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewport('desktop')}
              className={`p-1.5 rounded-lg transition-colors ${viewport === 'desktop' ? 'bg-white text-stone-900' : 'text-stone-400 hover:text-white'}`}
              title="Ver como desktop"
            >
              <Monitor className="w-4 h-4" />
            </button>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800" title="Fechar">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Área rolável com a moldura do dispositivo escolhido */}
        <div className="flex-1 overflow-y-auto bg-stone-900 p-4 sm:p-8 flex justify-center">
          <div
            className={`transition-all duration-300 ${
              viewport === 'mobile' ? 'w-[375px] max-w-full' : 'w-full max-w-3xl'
            } rounded-xl overflow-hidden border-4 border-stone-800 shadow-2xl`}
          >
            <div className={theme.pageBg}>
              <div className="px-4 sm:px-6 py-8 text-center">
                <h1 className={`${theme.pageText} ${viewport === 'mobile' ? 'text-2xl' : 'text-3xl'} ${theme.heroFont} uppercase tracking-tight`}>
                  {title}
                </h1>
                {subtitle && <p className={`${theme.pageSubtext} text-xs sm:text-sm mt-2`}>{subtitle}</p>}
              </div>
              <div
                className={`px-4 sm:px-6 pb-8 grid gap-4 ${
                  viewport === 'mobile' ? 'grid-cols-1' : 'grid-cols-2 sm:grid-cols-3'
                }`}
              >
                {restaurants.map((r, idx) => (
                  <div key={r.slug || r.name + idx} className="relative">
                    {highlightSlug && r.slug === highlightSlug && (
                      <span className="absolute -top-2 -right-2 z-10 text-[9px] font-black bg-amber-400 text-stone-900 px-2 py-0.5 rounded-full shadow">
                        Este restaurante
                      </span>
                    )}
                    <RestaurantCard restaurant={{ ...r, slug: undefined }} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
