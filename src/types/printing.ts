import { RestaurantSlug, Order } from './restaurant';

export type PrintStation = 'CAIXA' | 'COZINHA' | 'SUSHI_BAR' | 'BAR' | 'ENTREGA';

export type PrintJobStatus =
  | 'PENDENTE'
  | 'IMPRIMINDO'
  | 'IMPRESSO'
  | 'ERRO'
  | 'RETRY'
  | 'CANCELADO';

export interface ThermalPrinterDevice {
  id: string;
  name: string;
  station: PrintStation;
  restaurantSlug: RestaurantSlug;
  connectionType: 'USB' | 'REDE_TCP' | 'BLUETOOTH' | 'VIRTUAL';
  ipAddress?: string;
  port?: number;
  paperWidth: '80mm' | '58mm';
  status: 'online' | 'offline' | 'sem_papel' | 'erro';
  lastSeenAt: string;
  copies: number;
}

export interface PrintJob {
  jobId: string;
  orderId: string;
  orderShortCode: string;
  restaurantSlug: RestaurantSlug;
  station: PrintStation;
  printerId?: string;
  printerName?: string;
  status: PrintJobStatus;
  attempts: number;
  maxAttempts: number;
  errorMessage?: string;
  rawEscPos?: string;
  createdAt: string;
  updatedAt: string;
  printedAt?: string;
  idempotencyHash: string;
}

export interface PrintAgentStatus {
  agentVersion: string;
  agentName: string;
  platform: 'windows' | 'linux' | 'macos';
  isConnected: boolean;
  isOfflineMode: boolean;
  localQueueCount: number;
  lastHeartbeat: string;
  printers: ThermalPrinterDevice[];
}
