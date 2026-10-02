import { RestaurantSlug } from '../src/types/restaurant';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { PrintJob, PrintJobStatus, PrintStation, ThermalPrinterDevice } from '../src/types/printing';

// In-memory persistent queue for print jobs
import { DATA_DIR } from './dataDir'; // Caminho configurável via env DATA_DIR (ver server/dataDir.ts)
const PRINT_JOBS_FILE = path.join(DATA_DIR, 'print_jobs.json');
const PRINTERS_FILE = path.join(DATA_DIR, 'printers.json');
let printJobsQueue: PrintJob[] = [];
let printQueueInitialized = false;

function initializePrintQueue() {
  if (printQueueInitialized) return;
  printQueueInitialized = true;
  try {
    if (fs.existsSync(PRINT_JOBS_FILE)) {
      const raw = fs.readFileSync(PRINT_JOBS_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) printJobsQueue = parsed;
    }
  } catch (error) {
    console.error('[PRINT] fila persistida inválida:', error);
    printJobsQueue = [];
  }
}

function persistPrintQueue() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${PRINT_JOBS_FILE}.tmp.${Date.now()}`;
  fs.writeFileSync(tmp, JSON.stringify(printJobsQueue), 'utf8');
  fs.renameSync(tmp, PRINT_JOBS_FILE);
}

// Registered thermal printers
let registeredPrinters: ThermalPrinterDevice[] = [
  {
    id: 'prn-cx-01',
    name: 'Térmica Caixa Balcão (Epson TM-T20X)',
    stations: ['CAIXA'],
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
    stations: ['COZINHA'],
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
    stations: ['SUSHI_BAR'],
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
    stations: ['CAIXA'],
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
    stations: ['COZINHA'],
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


function initializePrinters() {
  try {
    if (fs.existsSync(PRINTERS_FILE)) {
      const raw = fs.readFileSync(PRINTERS_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) registeredPrinters = parsed;
    }
  } catch (error) {
    console.error('[PRINT] cadastro de impressoras inválido:', error);
  }

  // Compatibilidade: cadastros antigos salvos com "station" (string única)
  // são migrados automaticamente para "stations" (array), sem perder o
  // roteamento já configurado por ninguém precisar recadastrar nada.
  registeredPrinters = registeredPrinters.map((p: any) => {
    if (Array.isArray(p.stations) && p.stations.length > 0) return p;
    if (p.station) {
      const { station, ...rest } = p;
      return { ...rest, stations: [station] };
    }
    return { ...p, stations: p.stations || [] };
  });
}
function persistPrinters() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${PRINTERS_FILE}.tmp.${Date.now()}`;
  fs.writeFileSync(tmp, JSON.stringify(registeredPrinters), 'utf8');
  fs.renameSync(tmp, PRINTERS_FILE);
}
initializePrinters();

/**
 * Queue a print job with anti-duplication protection.
 * Se mais de uma impressora estiver marcada para a mesma estação (ou uma
 * impressora estiver marcada para várias estações), o pedido é enviado para
 * TODAS elas — não só para a primeira encontrada.
 */
export function enqueuePrintJob(params: {
  orderId: string;
  orderShortCode: string;
  restaurantSlug: RestaurantSlug;
  station: PrintStation;
  rawEscPos?: string;
  /** Impressora específica (ex.: a escolhida no Caixa). Se não existir/estiver offline, usa as da estação. */
  printerId?: string;
  /** Chave estável da operação (ex.: id da operação + setor + itens). Evita duplicar a comanda em retry. */
  dedupeKey?: string;
}): { job: PrintJob; deduplicated: boolean; jobs: PrintJob[] } {
  initializePrintQueue();
  const { orderId, orderShortCode, restaurantSlug, station, rawEscPos, printerId, dedupeKey } = params;
  const contentHash = crypto.createHash('sha256').update(rawEscPos || '').digest('hex');
  // CORREÇÃO: o texto da comanda leva data/hora, então o hash do conteúdo muda a
  // cada segundo e o anti-duplicidade nunca funcionava. Se houver dedupeKey, é ela
  // (estável) que identifica a operação.
  const dedupeToken = dedupeKey ? crypto.createHash('sha256').update(dedupeKey).digest('hex') : contentHash;

  initializePrinters();
  // CORREÇÃO: antes, qualquer impressora "offline"/"sem_papel" fazia o setor cair em
  // "Nenhuma impressora configurada" e o pedido nunca era impresso, mesmo com a
  // impressora cadastrada. Agora: 1) usa as ONLINE do setor; 2) se não houver, enfileira
  // para as CADASTRADAS do setor (ficam PENDENTES e saem assim que voltarem);
  // 3) só gera ERRO se realmente não existe impressora para RESTAURANTE + SETOR.
  const forStation = registeredPrinters.filter(
    (p) => p.restaurantSlug === restaurantSlug && p.stations?.includes(station)
  );
  let matchingPrinters = forStation.filter((p) => p.status === 'online');
  if (matchingPrinters.length === 0) matchingPrinters = forStation;
  if (printerId) {
    const chosen = matchingPrinters.filter((p) => p.id === printerId);
    if (chosen.length > 0) matchingPrinters = chosen;
  }
  // Se não há impressora cadastrada para RESTAURANTE + SETOR, o trabalho NUNCA é
  // redirecionado para outra impressora (ex.: a do Caixa). Ele é registrado com
  // status ERRO e uma mensagem clara: "Nenhuma impressora configurada para este setor."
  const targets = matchingPrinters.length > 0 ? matchingPrinters : [null];

  const createdJobs: PrintJob[] = [];
  let anyDeduplicated = false;

  for (const printer of targets) {
    const idempotencyHash = `${orderId}-${station}-${restaurantSlug}-${printer?.id || 'sem-impressora'}-${dedupeToken}`;
    const existing = printJobsQueue.find((j) => j.idempotencyHash === idempotencyHash);
    if (existing) {
      createdJobs.push(existing);
      anyDeduplicated = true;
      continue;
    }

    const noPrinterConfigured = !printer;
    const newJob: PrintJob = {
      jobId: `job-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      orderId,
      orderShortCode,
      restaurantSlug,
      station,
      printerId: printer?.id,
      printerName: printer?.name || `Impressora ${station} (não configurada)`,
      status: noPrinterConfigured ? 'ERRO' : 'PENDENTE',
      attempts: 0,
      maxAttempts: 4,
      errorMessage: noPrinterConfigured ? 'Nenhuma impressora configurada para este setor.' : undefined,
      rawEscPos,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      idempotencyHash,
      contentHash,
    };

    printJobsQueue.unshift(newJob);
    createdJobs.push(newJob);
  }

  // Keep queue size under control (last 300 jobs) — ANTES de gravar em disco
  // (antes o arquivo guardava a fila sem o corte e crescia sem limite).
  if (printJobsQueue.length > 300) {
    printJobsQueue = printJobsQueue.slice(0, 300);
  }
  persistPrintQueue();

  return { job: createdJobs[0], deduplicated: anyDeduplicated, jobs: createdJobs };
}

/**
 * Get jobs filtered strictly by restaurant.
 * MULTI-TENANT ISOLATION RULE: Restaurant A can NEVER view or print Restaurant B's jobs.
 */
export function getPrintJobs(restaurantSlug?: string, status?: PrintJobStatus): PrintJob[] {
  initializePrintQueue();
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
  initializePrintQueue();
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
    // CORREÇÃO: maxAttempts existia mas nunca era aplicado — um trabalho com
    // falha ficava em RETRY para sempre, travando a fila do agente.
    if (status === 'RETRY' && job.attempts >= (job.maxAttempts || 4)) {
      job.status = 'ERRO';
      job.errorMessage = `${job.errorMessage} (esgotou ${job.maxAttempts || 4} tentativas — use "Reenviar")`;
    }
  }

  persistPrintQueue();
  return job;
}

/**
 * Retry failed print job
 */
/** Remove da fila os trabalhos AINDA NÃO impressos de um pedido (usado ao excluir o pedido). */
export function cancelPendingPrintJobsForOrder(orderId: string): number {
  initializePrinters();
  const before = printJobsQueue.length;
  printJobsQueue = printJobsQueue.filter(
    (j) => !(j.orderId === orderId && (j.status === 'PENDENTE' || j.status === 'RETRY' || j.status === 'ERRO'))
  );
  const removed = before - printJobsQueue.length;
  if (removed > 0) persistPrintQueue();
  return removed;
}

export function retryPrintJob(jobId: string): PrintJob | null {
  initializePrintQueue();
  const job = printJobsQueue.find((j) => j.jobId === jobId);
  if (!job) return null;

  // Se o trabalho não tinha impressora atribuída (setor sem impressora
  // configurada), tenta resolver novamente — o Admin pode ter cadastrado
  // uma impressora para o setor desde então. Nunca usa a impressora de
  // outro setor/estação como substituta.
  if (!job.printerId) {
    initializePrinters();
    const match = registeredPrinters.find(
      (p) => p.restaurantSlug === job.restaurantSlug && p.stations?.includes(job.station) && p.status === 'online'
    );
    if (!match) {
      job.status = 'ERRO';
      job.errorMessage = 'Nenhuma impressora configurada para este setor.';
      job.updatedAt = new Date().toISOString();
      persistPrintQueue();
      return job;
    }
    job.printerId = match.id;
    job.printerName = match.name;
  }

  job.status = 'PENDENTE';
  job.attempts = 0;
  job.errorMessage = undefined;
  job.updatedAt = new Date().toISOString();
  persistPrintQueue();
  return job;
}

/**
 * Get registered printers
 */
export function getPrinters(restaurantSlug?: string): ThermalPrinterDevice[] {
  initializePrintQueue();
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
  initializePrinters();
  const index = registeredPrinters.findIndex((p) => p.id === printer.id);
  if (index >= 0) {
    registeredPrinters[index] = { ...registeredPrinters[index], ...printer, lastSeenAt: new Date().toISOString() };
    persistPrinters();
    return registeredPrinters[index];
  }
  registeredPrinters.push({ ...printer, lastSeenAt: new Date().toISOString() });
  persistPrinters();
  return printer;
}

export function deletePrinter(printerId: string, restaurantSlug?: string): boolean {
  initializePrinters();
  const index = registeredPrinters.findIndex((p) => p.id === printerId && (!restaurantSlug || p.restaurantSlug === restaurantSlug));
  if (index < 0) return false;
  registeredPrinters.splice(index, 1);
  persistPrinters();
  return true;
}
