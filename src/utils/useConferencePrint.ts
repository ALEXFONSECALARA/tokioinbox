import { useCallback } from 'react';
import { useStore } from '../context/StoreContext';
import type { ConferenceSource, Order } from '../types/restaurant';
import { printConferenceAuto } from './conferencePrint';

/**
 * Hook único usado por todos os botões de FECHAMENTO (Garçom, Caixa, Salão,
 * Balcão, Retirada, Delivery e Pedidos). Imprime o cupom de conferência sozinho.
 */
export function useConferencePrint() {
  const { printerSettings, restaurants, activeRestaurantSlug, showToast, systemSettings } = useStore();

  return useCallback(
    async (order: Order | null | undefined, source: ConferenceSource, opts?: { force?: boolean; silentToast?: boolean; includeServiceFee?: boolean; kind?: 'conferencia' | 'comum' | 'fiscal'; paymentMethod?: string }) => {
      if (!order) return 'error' as const;
      const restaurant = (restaurants as any)?.[order.restaurantSlug || activeRestaurantSlug];
      const result = await printConferenceAuto({
        order,
        restaurant,
        settings: printerSettings,
        source,
        force: opts?.force,
        includeServiceFee: opts?.includeServiceFee,
        kind: opts?.kind,
        paymentMethod: opts?.paymentMethod,
        serviceFeeDefaultOn: systemSettings?.serviceFeeDefaultOn !== false,
      });
      if (!opts?.silentToast) {
        if (result === 'agent') showToast(`Conferência ${order.shortCode} enviada para a impressora do Caixa.`, 'success');
        else if (result === 'browser') showToast(`Conferência ${order.shortCode} enviada para impressão.`, 'success');
        else if (result === 'error') showToast('Não foi possível imprimir a conferência. Verifique a impressora.', 'error');
      }
      return result;
    },
    [printerSettings, restaurants, activeRestaurantSlug, showToast, systemSettings?.serviceFeeDefaultOn]
  );
}
