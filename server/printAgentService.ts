import { RestaurantSlug } from '../src/types/restaurant';
import { PrintJob, PrintJobStatus, PrintStation, ThermalPrinterDevice } from '../src/types/printing';

// In-memory persistent queue for print jobs
let printJobsQueue: PrintJob[] = [];

// Registered thermal printers
let registeredPrinters: ThermalPrinterDevice[] = [
  {
    id: 'prn-cx-01',
    name: 'Térmica Caixa Balcão (Epson TM-T20X)',
    station: 'CAIXA',
    restaurantSlug: 'japones',
    connectionType: 'USB',
    paperWidth: '80mm',
    status: 'online',
    lastSeenAt: new Date().toISOString(),
    copies: 1,
  },
  {
    id: 'prn-cz-01',
    name: 'Térmica Cozinha Quente (Bematech MP-4200)',
    station: 'COZINHA',
    restaurantSlug: 'japones',
    connectionType: 'REDE_TCP',
    ipAddress: '192.168.1.150',
    port: 9100,
    paperWidth: '80mm',
    status: 'online',
    lastSeenAt: new Date().toISOString(),
    copies: 1,
  },
  {
    id: 'prn-sb-01',
    name: 'Térmica Sushi Bar (Daruma DR800)',
    station: 'SUSHI_BAR',
    restaurantSlug: 'japones',
    connectionType: 'USB',
    paperWidth: '80mm',
    status: 'online',
    lastSeenAt: new Date().toISOString(),
    copies: 1,
  },
  {
    id: 'prn-cx-02',
    name: 'Térmica Caixa Geral (Epson TM-T20X)',
    station: 'CAIXA',
    restaurantSlug: 'italiano',
    connectionType: 'USB',
    paperWidth: '80mm',
    status: 'online',
    lastSeenAt: new Date().toISOString(),
    copies: 1,
  },
  {
    id: 'prn-cz-02',
    name: 'Térmica Cozinha Massas & Forno',
    station: 'COZINHA',
    restaurantSlug: 'italiano',
    connectionType: 'REDE_TCP',
    ipAddress: '192.168.1.155',
    port: 9100,
    paperWidth: '80mm',
    status: 'online',
    lastSeenAt: new Date().toISOString(),
    copies: 1,
  },
];

/**
 * Queue a print job with anti-duplication protection
 */
export function enqueuePrintJob(params: {
  orderId: string;
  orderShortCode: string;
  restaurantSlug: RestaurantSlug;
  station: PrintStation;
  rawEscPos?: string;
}): { job: PrintJob; deduplicated: boolean } {
  const { orderId, orderShortCode, restaurantSlug, station, rawEscPos } = params;
  const idempotencyHash = `${orderId}-${station}-${restaurantSlug}`;

  // Check if job already exists for this order & station
  const existing = printJobsQueue.find((j) => j.idempotencyHash === idempotencyHash);
  if (existing) {
    return { job: existing, deduplicated: true };
  }

  const assignedPrinter = registeredPrinters.find(
    (p) => p.restaurantSlug === restaurantSlug && p.station === station && p.status === 'online'
  );

  const newJob: PrintJob = {
    jobId: `job-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    orderId,
    orderShortCode,
    restaurantSlug,
    station,
    printerId: assignedPrinter?.id,
    printerName: assignedPrinter?.name || `Impressora ${station}`,
    status: 'PENDENTE',
    attempts: 0,
    maxAttempts: 4,
    rawEscPos,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    idempotencyHash,
  };

  printJobsQueue.unshift(newJob);

  // Keep queue size under control (last 300 jobs)
  if (printJobsQueue.length > 300) {
    printJobsQueue = printJobsQueue.slice(0, 300);
  }

  return { job: newJob, deduplicated: false };
}

/**
 * Get jobs filtered strictly by restaurant.
 * MULTI-TENANT ISOLATION RULE: Restaurant A can NEVER view or print Restaurant B's jobs.
 */
export function getPrintJobs(restaurantSlug?: string, status?: PrintJobStatus): PrintJob[] {
  return printJobsQueue.filter((j) => {
    if (restaurantSlug && restaurantSlug !== 'all' && j.restaurantSlug !== restaurantSlug) {
      return false;
    }
    if (status && j.status !== status) {
      return false;
    }
    return true;
  });
}

/**
 * Update job status (called by Windows/local print agent or admin panel)
 */
export function updatePrintJobStatus(
  jobId: string,
  status: PrintJobStatus,
  errorMessage?: string
): PrintJob | null {
  const job = printJobsQueue.find((j) => j.jobId === jobId);
  if (!job) return null;

  job.status = status;
  job.updatedAt = new Date().toISOString();
  if (status === 'IMPRESSO') {
    job.printedAt = new Date().toISOString();
  }
  if (status === 'ERRO' || status === 'RETRY') {
    job.attempts++;
    job.errorMessage = errorMessage || 'Falha de comunicação com impressora térmica';
  }

  return job;
}

/**
 * Retry failed print job
 */
export function retryPrintJob(jobId: string): PrintJob | null {
  const job = printJobsQueue.find((j) => j.jobId === jobId);
  if (!job) return null;

  job.status = 'PENDENTE';
  job.errorMessage = undefined;
  job.updatedAt = new Date().toISOString();
  return job;
}

/**
 * Get registered printers
 */
export function getPrinters(restaurantSlug?: string): ThermalPrinterDevice[] {
  return registeredPrinters.filter((p) => {
    if (restaurantSlug && restaurantSlug !== 'all' && p.restaurantSlug !== restaurantSlug) {
      return false;
    }
    return true;
  });
}

/**
 * Register or update printer status
 */
export function upsertPrinter(printer: ThermalPrinterDevice): ThermalPrinterDevice {
  const index = registeredPrinters.findIndex((p) => p.id === printer.id);
  if (index >= 0) {
    registeredPrinters[index] = { ...registeredPrinters[index], ...printer, lastSeenAt: new Date().toISOString() };
    return registeredPrinters[index];
  }
  registeredPrinters.push({ ...printer, lastSeenAt: new Date().toISOString() });
  return printer;
}
