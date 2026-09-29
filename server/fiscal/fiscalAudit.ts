import fs from 'fs';
import path from 'path';
import { FiscalAuditEntry } from './types';
import { DATA_DIR } from '../dataDir';

const AUDIT_FILE = path.join(DATA_DIR, 'fiscal', 'audit_logs.json'); // V9.3: respeita DATA_DIR (disco persistente)

function ensureAuditFile() {
  const dir = path.dirname(AUDIT_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(AUDIT_FILE)) {
    fs.writeFileSync(AUDIT_FILE, JSON.stringify([], null, 2), 'utf-8');
  }
}

export function logFiscalAction(entry: Omit<FiscalAuditEntry, 'id' | 'timestamp'>): FiscalAuditEntry {
  ensureAuditFile();
  try {
    const raw = fs.readFileSync(AUDIT_FILE, 'utf-8');
    const logs: FiscalAuditEntry[] = JSON.parse(raw);

    const fullEntry: FiscalAuditEntry = {
      id: `fisc-audit-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      timestamp: new Date().toISOString(),
      ...entry,
    };

    logs.unshift(fullEntry);

    // Keep up to 2000 entries
    if (logs.length > 2000) {
      logs.splice(2000);
    }

    fs.writeFileSync(AUDIT_FILE, JSON.stringify(logs, null, 2), 'utf-8');
    return fullEntry;
  } catch (err) {
    console.error('Falha ao registrar auditoria fiscal:', err);
    return {
      id: `err-${Date.now()}`,
      timestamp: new Date().toISOString(),
      ...entry,
    };
  }
}

export function getFiscalAuditLogs(limit = 100, restaurantSlug?: string): FiscalAuditEntry[] {
  ensureAuditFile();
  try {
    const raw = fs.readFileSync(AUDIT_FILE, 'utf-8');
    let logs: FiscalAuditEntry[] = JSON.parse(raw);
    if (restaurantSlug) {
      logs = logs.filter((l) => l.restaurantSlug === restaurantSlug);
    }
    return logs.slice(0, limit);
  } catch {
    return [];
  }
}
