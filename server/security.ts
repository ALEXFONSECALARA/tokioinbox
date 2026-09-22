import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';

export const IS_PRODUCTION = process.env.NODE_ENV === 'production';

/** Token opaco criptograficamente seguro (substitui Math.random). */
export function secureToken(prefix = '', bytes = 32): string {
  return `${prefix}${crypto.randomBytes(bytes).toString('hex')}`;
}

/** Código numérico de N dígitos criptograficamente seguro. */
export function secureNumericCode(digits = 6): string {
  const max = 10 ** digits;
  return String(crypto.randomInt(0, max)).padStart(digits, '0');
}

/** Comparação em tempo constante para segredos. */
export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

// ---------------------------------------------------------------------------
// CORS: só origens explicitamente permitidas. Requisições same-origin (o painel
// e o cardápio são servidos pelo próprio servidor) não precisam de CORS.
// ---------------------------------------------------------------------------
export function corsMiddleware(req: Request, res: Response, next: NextFunction) {
  const allowed = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  const origin = req.headers.origin;

  if (origin && allowed.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, X-Requested-With, Idempotency-Key, If-None-Match, X-Agent-Key'
    );
    // Autenticação é por Bearer token: não há necessidade de cookies cross-site.
  }

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  next();
}

// ---------------------------------------------------------------------------
// Headers de segurança básicos (equivalente enxuto ao helmet).
// ---------------------------------------------------------------------------
export function securityHeaders(req: Request, res: Response, next: NextFunction) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self)');
  if (IS_PRODUCTION) {
    res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
  }
  // Dados de API nunca devem ser cacheados por proxies/CDN compartilhados.
  if (req.path.startsWith('/api/')) {
    res.setHeader('Cache-Control', 'no-store');
  }
  next();
}

// ---------------------------------------------------------------------------
// Rate limit em memória (janela deslizante simples), por IP + chave.
// ---------------------------------------------------------------------------
interface Bucket {
  hits: number[];
}
const buckets = new Map<string, Bucket>();

function clientIp(req: Request): string {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length > 0) return fwd.split(',')[0].trim();
  return req.socket.remoteAddress || 'unknown';
}

export function rateLimit(opts: { key: string; max: number; windowMs: number; message?: string }) {
  return (req: Request, res: Response, next: NextFunction) => {
    const id = `${opts.key}:${clientIp(req)}`;
    const now = Date.now();
    const bucket = buckets.get(id) || { hits: [] };
    bucket.hits = bucket.hits.filter((t) => now - t < opts.windowMs);
    if (bucket.hits.length >= opts.max) {
      const retryAfter = Math.ceil((opts.windowMs - (now - bucket.hits[0])) / 1000);
      res.setHeader('Retry-After', String(retryAfter));
      return res.status(429).json({
        success: false,
        error: opts.message || 'Muitas tentativas. Aguarde um instante e tente novamente.',
        code: 'RATE_LIMITED',
        retryAfterSeconds: retryAfter,
      });
    }
    bucket.hits.push(now);
    buckets.set(id, bucket);
    next();
  };
}

// Limpeza periódica para não vazar memória.
setInterval(() => {
  const now = Date.now();
  for (const [k, b] of buckets) {
    b.hits = b.hits.filter((t) => now - t < 60 * 60 * 1000);
    if (b.hits.length === 0) buckets.delete(k);
  }
}, 10 * 60 * 1000).unref();

// ---------------------------------------------------------------------------
// Bloqueio progressivo de login por usuário+IP (anti brute force).
// ---------------------------------------------------------------------------
const loginFailures = new Map<string, { count: number; lockedUntil: number }>();

export function checkLoginLock(key: string): { locked: boolean; retryAfterSeconds: number } {
  const rec = loginFailures.get(key);
  if (!rec) return { locked: false, retryAfterSeconds: 0 };
  if (rec.lockedUntil > Date.now()) {
    return { locked: true, retryAfterSeconds: Math.ceil((rec.lockedUntil - Date.now()) / 1000) };
  }
  return { locked: false, retryAfterSeconds: 0 };
}

export function registerLoginFailure(key: string) {
  const rec = loginFailures.get(key) || { count: 0, lockedUntil: 0 };
  rec.count += 1;
  if (rec.count >= 5) {
    // 5 falhas -> bloqueio de 1min, dobrando a cada nova falha (máx 30min)
    const minutes = Math.min(30, 2 ** (rec.count - 5));
    rec.lockedUntil = Date.now() + minutes * 60 * 1000;
  }
  loginFailures.set(key, rec);
}

export function clearLoginFailures(key: string) {
  loginFailures.delete(key);
}

export function getClientIp(req: Request): string {
  return clientIp(req);
}
