import fs from 'fs';
import path from 'path';
import { DATA_DIR } from './dataDir';

// V9 PLUS ULTRA 04 — MESAS E QR CODES
// Registro simples de mesas por restaurante: cada mesa tem um número e um
// estado "ativa" (aceitando pedidos) ou "bloqueada" (Caixa desativou). Isto
// NÃO substitui nada do fluxo de pedidos existente — é só o controle de
// "essa mesa pode receber pedido pelo QR agora?" usado pelo endpoint público
// de acesso por QR permanente. Persistido em arquivo, no mesmo padrão já
// usado para impressoras (printers.json / print_jobs.json).

export interface RestaurantTable {
  restaurantSlug: string;
  number: number;
  active: boolean; // true = 🟢 PEDIDOS ATIVOS · false = 🔴 PEDIDOS BLOQUEADOS
  createdAt: string;
  updatedAt: string;
}

const TABLES_FILE = path.join(DATA_DIR, 'tables.json');
let tables: RestaurantTable[] = [];
let initialized = false;

function initialize() {
  if (initialized) return;
  initialized = true;
  try {
    if (fs.existsSync(TABLES_FILE)) {
      const raw = fs.readFileSync(TABLES_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) tables = parsed;
    }
  } catch (error) {
    console.error('[TABLES] registro persistido inválido:', error);
    tables = [];
  }
}

function persist() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${TABLES_FILE}.tmp.${Date.now()}`;
  fs.writeFileSync(tmp, JSON.stringify(tables), 'utf8');
  fs.renameSync(tmp, TABLES_FILE);
}

function key(slug: string, number: number) {
  return `${slug.trim().toLowerCase()}|${Math.trunc(number)}`;
}

/** Retorna a mesa (criando-a como ATIVA por padrão se ainda não existir). */
export function ensureTable(restaurantSlug: string, number: number): RestaurantTable {
  initialize();
  const slug = restaurantSlug.trim().toLowerCase();
  const n = Math.trunc(number);
  let table = tables.find((t) => key(t.restaurantSlug, t.number) === key(slug, n));
  if (!table) {
    const now = new Date().toISOString();
    table = { restaurantSlug: slug, number: n, active: true, createdAt: now, updatedAt: now };
    tables.push(table);
    persist();
  }
  return table;
}

/** Lista as mesas já cadastradas explicitamente de um restaurante (ordenadas por número). */
export function listTables(restaurantSlug: string): RestaurantTable[] {
  initialize();
  const slug = restaurantSlug.trim().toLowerCase();
  return tables
    .filter((t) => t.restaurantSlug === slug)
    .sort((a, b) => a.number - b.number);
}

/** true = aceitando pedidos. Mesa nunca cadastrada explicitamente = ATIVA por padrão (não bloqueia sem intenção do Caixa). */
export function isTableActive(restaurantSlug: string, number: number): boolean {
  initialize();
  const slug = restaurantSlug.trim().toLowerCase();
  const n = Math.trunc(number);
  const table = tables.find((t) => key(t.restaurantSlug, t.number) === key(slug, n));
  return table ? table.active : true;
}

export function setTableActive(restaurantSlug: string, number: number, active: boolean): RestaurantTable {
  const table = ensureTable(restaurantSlug, number);
  table.active = active;
  table.updatedAt = new Date().toISOString();
  persist();
  return table;
}

export function regenerateTable(restaurantSlug: string, number: number): RestaurantTable {
  // "Regenerar" o QR permanente não muda o número da mesa (a URL é sempre
  // /{slug}/mesa/{numero}) — apenas reativa a mesa e marca o horário, para
  // uso em relatórios/depuração. O link em si é estável por design.
  return setTableActive(restaurantSlug, number, true);
}
