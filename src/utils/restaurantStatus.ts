/**
 * V9 PLUS ULTRA 01 — Pausa do restaurante (cardápio do cliente).
 * Fonte única da regra "este restaurante está recebendo novos pedidos?", espelhando o servidor
 * (server/orderService.ts + server/catalogService.ts::assertCanAcceptNewOrder).
 * A regra é POR RESTAURANTE: recebe apenas o objeto do restaurante consultado.
 */
export const PAUSED_ORDERS_MESSAGE = 'Restaurante temporariamente fechado para novos pedidos.';

export function isRestaurantAcceptingOrders(
  r?: { isActive?: boolean; isOpen?: boolean; vitrineStatus?: string; isActiveInVitrine?: boolean } | null
): boolean {
  if (!r) return false;
  if (r.isActive === false) return false;
  if (r.isOpen === false) return false;
  if (r.vitrineStatus && r.vitrineStatus !== 'ATIVO') return false;
  return true;
}
