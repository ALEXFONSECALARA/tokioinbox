import { Request, Response, NextFunction } from 'express';
import {
  UserRole,
  UserPermissions,
  findUserById,
  initializeUsers,
  ROLE_DEFAULT_PERMISSIONS,
} from './authAndDeviceService';

export interface AuthenticatedUserSession {
  id: string;
  name: string;
  username: string;
  role: UserRole;
  restaurantSlug: string;
  permissions: UserPermissions;
}

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { secureToken, safeEqual } from './security';

// ---------------------------------------------------------------------------
// Sessões de colaboradores: persistidas em disco (sobrevivem a reinícios) e
// armazenadas apenas como hash SHA-256 do token. O usuário é sempre relido do
// cadastro, então desativar um usuário ou trocar seu perfil vale imediatamente.
// ---------------------------------------------------------------------------
interface StoredSession {
  userId: string;
  expiresAt: number;
  createdAt: number;
}

const SESSIONS_FILE = path.join(process.cwd(), 'data', 'staff_sessions.json');
let sessionsLoaded = false;
const activeSessions = new Map<string, StoredSession>(); // key = sha256(token)

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function loadSessions() {
  if (sessionsLoaded) return;
  sessionsLoaded = true;
  try {
    if (fs.existsSync(SESSIONS_FILE)) {
      const raw = fs.readFileSync(SESSIONS_FILE, 'utf-8').trim();
      if (raw) {
        const parsed: Record<string, StoredSession> = JSON.parse(raw);
        const now = Date.now();
        for (const [k, v] of Object.entries(parsed)) {
          if (v.expiresAt > now) activeSessions.set(k, v);
        }
      }
    }
  } catch (err) {
    console.warn('[AUTH] Não foi possível carregar sessões persistidas:', (err as Error).message);
  }
}

function persistSessions() {
  try {
    const dir = path.dirname(SESSIONS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const tmp = `${SESSIONS_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(Object.fromEntries(activeSessions)), { encoding: 'utf-8', mode: 0o600 });
    fs.renameSync(tmp, SESSIONS_FILE);
  } catch (err) {
    console.warn('[AUTH] Falha ao persistir sessões:', (err as Error).message);
  }
}

function toSessionUser(userId: string): AuthenticatedUserSession | null {
  const u = findUserById(userId);
  if (!u || !u.isActive) return null;
  return {
    id: u.id,
    name: u.name,
    username: u.username,
    role: u.role,
    restaurantSlug: u.restaurantSlug,
    permissions: u.permissions,
  };
}

/** Cria uma sessão nova e devolve o token opaco (mostrado uma única vez). */
export function createUserSession(userId: string, ttlHours = 12): string {
  loadSessions();
  const token = secureToken('nx-staff-');
  activeSessions.set(hashToken(token), {
    userId,
    createdAt: Date.now(),
    expiresAt: Date.now() + ttlHours * 60 * 60 * 1000,
  });
  persistSessions();
  return token;
}

/** Mantido por compatibilidade com o server.ts antigo. */
export function registerUserSession(token: string, user: AuthenticatedUserSession, ttlHours = 12) {
  loadSessions();
  activeSessions.set(hashToken(token), {
    userId: user.id,
    createdAt: Date.now(),
    expiresAt: Date.now() + ttlHours * 60 * 60 * 1000,
  });
  persistSessions();
}

export function revokeUserSession(token: string) {
  loadSessions();
  const clean = token.replace('Bearer ', '').trim();
  if (activeSessions.delete(hashToken(clean))) persistSessions();
}

/** Encerra todas as sessões de um usuário (troca de senha, desativação). */
export function revokeAllSessionsForUser(userId: string) {
  loadSessions();
  let changed = false;
  for (const [k, v] of activeSessions) {
    if (v.userId === userId) {
      activeSessions.delete(k);
      changed = true;
    }
  }
  if (changed) persistSessions();
}

/**
 * Resolve o usuário a partir do header Authorization
 */
export function resolveUserFromToken(token: string): AuthenticatedUserSession | null {
  if (!token) return null;
  loadSessions();
  const clean = token.replace('Bearer ', '').trim();
  const key = hashToken(clean);
  const session = activeSessions.get(key);
  if (!session) return null;

  if (Date.now() > session.expiresAt) {
    activeSessions.delete(key);
    persistSessions();
    return null;
  }
  const user = toSessionUser(session.userId);
  if (!user) {
    activeSessions.delete(key);
    persistSessions();
    return null;
  }
  return user;
}

// ---------------------------------------------------------------------------
// Ticket de uso único para o stream SSE (EventSource não envia headers).
// ---------------------------------------------------------------------------
const streamTickets = new Map<string, { userId: string; expiresAt: number }>();

export function issueStreamTicket(userId: string): string {
  const ticket = secureToken('nx-sse-', 16);
  streamTickets.set(ticket, { userId, expiresAt: Date.now() + 60 * 1000 });
  return ticket;
}

export function consumeStreamTicket(ticket: string): AuthenticatedUserSession | null {
  const rec = streamTickets.get(ticket);
  streamTickets.delete(ticket);
  if (!rec || rec.expiresAt < Date.now()) return null;
  return toSessionUser(rec.userId);
}

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of streamTickets) if (v.expiresAt < now) streamTickets.delete(k);
}, 60 * 1000).unref();

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      userSession?: AuthenticatedUserSession;
    }
  }
}

/**
 * Authentication Middleware:
 * Inspects `Authorization: Bearer <token>` and attaches userSession to `req`.
 * Fallback to test/demo super_admin if running in test environment or headers specify dev bypass.
 */
export function authenticateStaff(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({
      success: false,
      error: 'Autenticação obrigatória: cabeçalho Authorization não fornecido.',
      code: 'UNAUTHENTICATED',
    });
  }

  const token = authHeader.replace('Bearer ', '').trim();
  const user = resolveUserFromToken(token);

  if (!user) {
    return res.status(401).json({
      success: false,
      error: 'Sessão inválida ou expirada. Faça login novamente.',
      code: 'INVALID_SESSION',
    });
  }

  req.userSession = user;
  next();
}

/**
 * Optional authentication: attaches user if token is present, does not reject if missing
 */
export function optionalStaffAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const token = authHeader.replace('Bearer ', '').trim();
    const user = resolveUserFromToken(token);
    if (user) {
      req.userSession = user;
    }
  }
  next();
}

/**
 * Role-Based Access Control (RBAC) Guard Middleware
 * Strict validation: verifies if the authenticated user has the required permission OR role.
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.userSession;
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Acesso negado: Usuário não autenticado.',
        code: 'UNAUTHENTICATED',
      });
    }

    // Super Admin has universal access
    if (user.role === 'super_admin') {
      return next();
    }

    if (!allowedRoles.includes(user.role)) {
      return res.status(403).json({
        success: false,
        error: `Acesso proibido: Seu perfil (${user.role.toUpperCase()}) não tem permissão para esta ação. Requer: [${allowedRoles.map((r) => r.toUpperCase()).join(', ')}].`,
        code: 'FORBIDDEN_ROLE',
      });
    }

    next();
  };
}

/**
 * Permission Guard: Checks granular permission flag
 */
export function requirePermission(permissionKey: keyof UserPermissions) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.userSession;
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Acesso negado: Usuário não autenticado.',
        code: 'UNAUTHENTICATED',
      });
    }

    if (user.role === 'super_admin') {
      return next();
    }

    if (!user.permissions?.[permissionKey]) {
      return res.status(403).json({
        success: false,
        error: `Acesso proibido: Usuário não possui a permissão requerida [${permissionKey}].`,
        code: 'FORBIDDEN_PERMISSION',
      });
    }

    next();
  };
}

/**
 * Station Production Guard:
 * Only allows operators of a specific production station (e.g. 'cozinha' can only update kitchen station)
 */
export function requireStationAccess(station: 'cozinha' | 'sushibar' | 'bar') {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.userSession;
    if (!user) {
      return res.status(401).json({ success: false, error: 'Acesso negado.' });
    }

    if (user.role === 'super_admin' || user.role === 'administrador') {
      return next();
    }

    // Map role to station
    const roleStationMap: Record<string, string> = {
      cozinha: 'cozinha',
      sushi_bar: 'sushibar',
      bar: 'bar',
    };

    const allowed = roleStationMap[user.role] === station;
    if (!allowed) {
      return res.status(403).json({
        success: false,
        error: `Acesso proibido: Operadores do perfil ${user.role.toUpperCase()} não podem alterar a praça ${station.toUpperCase()}.`,
        code: 'FORBIDDEN_STATION',
      });
    }

    next();
  };
}

/**
 * Agente de impressão: aceita sessão de colaborador OU a chave do agente
 * (variável PRINT_AGENT_KEY, enviada no header X-Agent-Key).
 */
export function authenticateStaffOrAgent(req: Request, res: Response, next: NextFunction) {
  const key = process.env.PRINT_AGENT_KEY;
  const provided = req.headers['x-agent-key'];
  if (key && typeof provided === 'string' && safeEqual(provided, key)) {
    return next();
  }
  return authenticateStaff(req, res, next);
}

/**
 * Escopo por restaurante: colaboradores vinculados a um restaurante específico
 * só enxergam/alteram pedidos dele. Perfis com restaurantSlug "all" veem tudo.
 */
export function resolveScopedSlug(req: Request, requested?: string): string | undefined {
  const user = req.userSession;
  if (user && user.restaurantSlug && user.restaurantSlug !== 'all') {
    return user.restaurantSlug;
  }
  return requested && requested !== 'all' ? requested : undefined;
}

export function canAccessRestaurant(req: Request, slug: string): boolean {
  const user = req.userSession;
  if (!user) return false;
  return !user.restaurantSlug || user.restaurantSlug === 'all' || user.restaurantSlug === slug;
}
