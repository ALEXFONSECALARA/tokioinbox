import React, { useEffect, useState } from 'react';
import { X, RefreshCw, ExternalLink, QrCode, Loader2, Minus, Plus } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { getRestaurantPath } from '../utils/urlRouting';

interface ClientMenuPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Mesa inicial a pré-visualizar (padrão: 1) */
  initialTable?: number;
}

/**
 * BUG CORRIGIDO: o botão "Cliente" (👤 QR Code / Mesa) fazia
 * `window.location.assign('/')`, ou seja, SAÍA do painel da equipe,
 * derrubava a sessão do garçom/caixa e ainda jogava para a vitrine geral
 * (não para um cardápio de mesa pré-determinado).
 *
 * Agora o botão abre este modal, que carrega o cardápio de pedido REAL do
 * cliente (o mesmo endpoint/URL usada no QR Code impresso da mesa) dentro
 * de um iframe, sem nunca navegar a aba/sessão da equipe para fora do
 * painel. O operador consegue trocar a mesa pré-visualizada e fechar a
 * qualquer momento — o contexto (login, área atual) nunca se perde.
 */
export const ClientMenuPreviewModal: React.FC<ClientMenuPreviewModalProps> = ({
  isOpen,
  onClose,
  initialTable = 1,
}) => {
  const { currentUser, restaurants, activeRestaurantSlug } = useStore();
  const restaurant = restaurants[activeRestaurantSlug];

  const [tableNumber, setTableNumber] = useState<number>(initialTable);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (isOpen) setTableNumber(initialTable);
  }, [isOpen, initialTable]);

  useEffect(() => {
    if (!isOpen || !restaurant?.slug) return;
    let cancelled = false;

    const loadPreview = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/table/access-token?slug=${encodeURIComponent(restaurant.slug)}&table=${tableNumber}`,
          { headers: currentUser?.token ? { Authorization: `Bearer ${currentUser.token}` } : {} }
        );
        const data = await res.json();
        if (!res.ok || !data.success || !data.token) {
          throw new Error(data.error || 'Não foi possível carregar o cardápio desta mesa.');
        }
        if (!cancelled) {
          const path = `${getRestaurantPath(restaurant)}/mesa/${tableNumber}`;
          setPreviewUrl(`${window.location.origin}${path}?mesa_token=${encodeURIComponent(data.token)}`);
        }
      } catch (err: any) {
        if (!cancelled) {
          setPreviewUrl(null);
          setError(err?.message || 'Falha ao carregar o cardápio de pedido desta mesa.');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    loadPreview();
    return () => {
      cancelled = true;
    };
  }, [isOpen, restaurant, tableNumber, currentUser?.token, reloadKey]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4">
      <div className="w-full max-w-3xl max-h-[92vh] bg-[#0E121B] border border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header fixo */}
        <div className="shrink-0 flex items-center justify-between gap-3 border-b border-slate-800 p-4 sm:p-5">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
              <QrCode className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-black text-white truncate">
                Cardápio do Cliente • {restaurant?.name || 'Restaurante'}
              </h3>
              <p className="text-[11px] text-slate-400 truncate">
                Pré-visualização real do que o cliente vê ao escanear o QR da mesa — nada sai do painel.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Barra de mesa + ações — fixa */}
        <div className="shrink-0 flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-slate-950/40 px-4 sm:px-5 py-2.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-300">Mesa:</span>
            <button
              type="button"
              onClick={() => setTableNumber((n) => Math.max(1, n - 1))}
              className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center"
            >
              <Minus className="w-4 h-4" />
            </button>
            <span className="w-10 text-center text-sm font-mono font-black text-amber-400">
              {tableNumber}
            </span>
            <button
              type="button"
              onClick={() => setTableNumber((n) => n + 1)}
              className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setReloadKey((k) => k + 1)}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Atualizar
            </button>
            {previewUrl && (
              <a
                href={previewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-xs font-bold flex items-center gap-1.5"
                title="Abrir em nova aba (sem sair do painel)"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Nova aba
              </a>
            )}
          </div>
        </div>

        {/* Conteúdo com scroll/carregamento interno — nunca navega a aba */}
        <div className="flex-1 min-h-0 relative bg-slate-950">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center gap-2 text-slate-400 bg-slate-950/80 z-10">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-xs font-bold">Carregando cardápio da Mesa {tableNumber}...</span>
            </div>
          )}
          {error && !isLoading && (
            <div className="absolute inset-0 flex items-center justify-center p-6">
              <div className="text-center space-y-2 max-w-sm">
                <p className="text-sm font-bold text-rose-400">{error}</p>
                <button
                  type="button"
                  onClick={() => setReloadKey((k) => k + 1)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold"
                >
                  Tentar novamente
                </button>
              </div>
            </div>
          )}
          {previewUrl && (
            <iframe
              key={previewUrl}
              src={previewUrl}
              title="Cardápio do cliente"
              className="w-full h-full border-0"
            />
          )}
        </div>
      </div>
    </div>
  );
};
