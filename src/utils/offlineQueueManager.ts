import { Order, OrderStatus, ProductionStation, StationItemStatus } from '../types/restaurant';

export type OfflineOperationType =
  | 'CREATE_ORDER'
  | 'APPEND_TABLE_ITEMS'
  | 'CLOSE_TABLE'
  | 'UPDATE_STATUS'
  | 'UPDATE_STATION_STATUS';

export interface OfflineOperation {
  id: string;
  type: OfflineOperationType;
  idempotencyKey: string;
  timestamp: string;
  payload: any;
  retryCount: number;
  status: 'pending' | 'syncing' | 'failed';
  error?: string;
}

const STORAGE_KEY = 'tokio_offline_operations_v2';
const SIMULATION_KEY = 'tokio_simulated_offline_mode';

export function getSimulatedOffline(): boolean {
  try {
    return localStorage.getItem(SIMULATION_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setSimulatedOffline(val: boolean): void {
  try {
    localStorage.setItem(SIMULATION_KEY, val ? 'true' : 'false');
    window.dispatchEvent(new CustomEvent('tokio-offline-mode-change', { detail: { isOffline: val } }));
  } catch {
    // Ignore storage errors
  }
}

export function getOfflineQueue(): OfflineOperation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveOfflineQueue(queue: OfflineOperation[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
    window.dispatchEvent(new CustomEvent('tokio-offline-queue-change', { detail: { count: queue.length } }));
  } catch (e) {
    console.warn('[OFFLINE QUEUE] Falha ao salvar fila localmente:', e);
  }
}

export function enqueueOfflineOperation(
  type: OfflineOperationType,
  payload: any,
  idempotencyKey?: string
): OfflineOperation {
  const queue = getOfflineQueue();
  const key = idempotencyKey || `idem-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  // Idempotency check: prevent duplicate insertion of identical key
  const existing = queue.find((op) => op.idempotencyKey === key);
  if (existing) {
    console.log(`[OFFLINE QUEUE] Operação com chave idempotente ${key} já existe na fila.`);
    return existing;
  }

  const newOp: OfflineOperation = {
    id: `op-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    type,
    idempotencyKey: key,
    timestamp: new Date().toISOString(),
    payload,
    retryCount: 0,
    status: 'pending',
  };

  const updatedQueue = [...queue, newOp];
  saveOfflineQueue(updatedQueue);
  console.log(`[OFFLINE QUEUE] Operação ${type} enfileirada com chave: ${key}. Total pendentes: ${updatedQueue.length}`);
  return newOp;
}

export function removeOfflineOperation(opId: string): void {
  const queue = getOfflineQueue();
  const updated = queue.filter((op) => op.id !== opId);
  saveOfflineQueue(updated);
}

export function clearAllOfflineQueue(): void {
  saveOfflineQueue([]);
}
