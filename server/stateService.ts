import fs from 'fs';
import path from 'path';

/**
 * ESTADO OPERACIONAL COMPARTILHADO (equipe)
 *
 * Caixa/turno, mesas do salão, entregadores, CRM e configurações de operação deixam de viver
 * no navegador de cada aparelho e passam a ser documentos versionados no servidor.
 * Cada documento tem `version`; gravações enviam `baseVersion` (controle otimista de
 * concorrência): se outro aparelho gravou antes, o servidor responde 409 com o valor atual
 * e o cliente reaplica a sua alteração em cima dele (ver src/painel/useServerDoc.ts).
 */

export type StateAccess = 'read' | 'write';

interface DocSpec {
  /** perfis que podem ler / gravar (super_admin sempre pode) */
  read: string[];
  write: string[];
}

const ADMINS = ['administrador'];
const FRONT = ['administrador', 'caixa', 'garcom'];
const ALL_STAFF = ['administrador', 'caixa', 'garcom', 'cozinha', 'sushi_bar', 'bar', 'entrega'];

export const STATE_DOCS: Record<string, DocSpec> = {
  customers: { read: FRONT, write: FRONT },
  deliveryStaff: { read: [...FRONT, 'entrega'], write: [...ADMINS, 'caixa', 'entrega'] },
  cashShift: { read: [...ADMINS, 'caixa'], write: [...ADMINS, 'caixa'] },
  cashShiftHistory: { read: [...ADMINS, 'caixa'], write: [...ADMINS, 'caixa'] },
  salonTables: { read: FRONT, write: FRONT },
  salonShiftHistory: { read: FRONT, write: FRONT },
  waiterCalls: { read: FRONT, write: FRONT },
  printerSettings: { read: ALL_STAFF, write: ADMINS },
  delaySettings: { read: ALL_STAFF, write: ADMINS },
  salesChannels: { read: ALL_STAFF, write: ADMINS },
};

interface StoredDoc {
  value: unknown;
  version: number;
  updatedAt: string;
  updatedBy: string;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const STATE_FILE = path.join(DATA_DIR, 'state.json');
const MAX_DOC_BYTES = 1_500_000;

let docs: Record<string, StoredDoc> | null = null;

function load(): Record<string, StoredDoc> {
  if (docs) return docs;
  try {
    const raw = fs.existsSync(STATE_FILE) ? fs.readFileSync(STATE_FILE, 'utf-8').trim() : '';
    docs = raw ? JSON.parse(raw) : {};
  } catch (err) {
    const backup = `${STATE_FILE}.corrupt-${Date.now()}`;
    try { fs.copyFileSync(STATE_FILE, backup); } catch {}
    console.error(`[STATE] state.json ilegível (${(err as Error).message}). Cópia em ${backup}. Recomeçando vazio.`);
    docs = {};
  }
  return docs!;
}

function persist() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${STATE_FILE}.tmp.${Date.now()}`;
  fs.writeFileSync(tmp, JSON.stringify(docs), 'utf-8');
  fs.renameSync(tmp, STATE_FILE);
}

export function isKnownKey(key: string): boolean {
  return Object.prototype.hasOwnProperty.call(STATE_DOCS, key);
}

export function canAccess(role: string, key: string, mode: StateAccess): boolean {
  if (!isKnownKey(key)) return false;
  if (role === 'super_admin') return true;
  return STATE_DOCS[key][mode].includes(role);
}

export function readableKeys(role: string): string[] {
  return Object.keys(STATE_DOCS).filter((k) => canAccess(role, k, 'read'));
}

export function getDoc(key: string): StoredDoc | null {
  return load()[key] || null;
}

export type SaveResult =
  | { ok: true; version: number; updatedAt: string }
  | { ok: false; conflict: true; current: StoredDoc | null }
  | { ok: false; conflict?: false; error: string };

export function saveDoc(key: string, value: unknown, baseVersion: number, operator: string): SaveResult {
  const all = load();
  const current = all[key] || null;
  const currentVersion = current?.version ?? 0;

  if (baseVersion !== currentVersion) {
    return { ok: false, conflict: true, current };
  }
  let size = 0;
  try {
    size = Buffer.byteLength(JSON.stringify(value ?? null), 'utf-8');
  } catch {
    return { ok: false, error: 'Valor não serializável.' };
  }
  if (size > MAX_DOC_BYTES) return { ok: false, error: 'Documento grande demais.' };
  if (value === undefined) return { ok: false, error: 'Valor ausente.' };

  const next: StoredDoc = {
    value,
    version: currentVersion + 1,
    updatedAt: new Date().toISOString(),
    updatedBy: operator,
  };
  all[key] = next;
  persist();
  return { ok: true, version: next.version, updatedAt: next.updatedAt };
}
