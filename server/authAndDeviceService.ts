import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { secureNumericCode, IS_PRODUCTION } from './security';

export type UserRole =
  | 'super_admin'
  | 'administrador'
  | 'caixa'
  | 'cozinha'
  | 'sushi_bar'
  | 'bar'
  | 'entrega'
  | 'garcom';

export interface UserPermissions {
  can_view_orders: boolean;
  can_create_orders: boolean;
  can_edit_orders: boolean;
  can_cancel_orders: boolean;
  can_change_status: boolean;
  can_view_menu: boolean;
  can_edit_menu: boolean;
  can_change_prices: boolean;
  can_manage_categories: boolean;
  can_manage_users: boolean;
  can_manage_permissions: boolean;
  can_configure_alerts: boolean;
  can_connect_devices: boolean;
  can_view_reports: boolean;
  can_configure_restaurant: boolean;
  can_manage_notifications: boolean;
}

export const ROLE_DEFAULT_PERMISSIONS: Record<UserRole, UserPermissions> = {
  super_admin: {
    can_view_orders: true,
    can_create_orders: true,
    can_edit_orders: true,
    can_cancel_orders: true,
    can_change_status: true,
    can_view_menu: true,
    can_edit_menu: true,
    can_change_prices: true,
    can_manage_categories: true,
    can_manage_users: true,
    can_manage_permissions: true,
    can_configure_alerts: true,
    can_connect_devices: true,
    can_view_reports: true,
    can_configure_restaurant: true,
    can_manage_notifications: true,
  },
  administrador: {
    can_view_orders: true,
    can_create_orders: true,
    can_edit_orders: true,
    can_cancel_orders: true,
    can_change_status: true,
    can_view_menu: true,
    can_edit_menu: true,
    can_change_prices: false,
    can_manage_categories: true,
    can_manage_users: false,
    can_manage_permissions: false,
    can_configure_alerts: true,
    can_connect_devices: true,
    can_view_reports: true,
    can_configure_restaurant: false,
    can_manage_notifications: true,
  },
  caixa: {
    can_view_orders: true,
    can_create_orders: true,
    can_edit_orders: false,
    can_cancel_orders: false,
    can_change_status: true,
    can_view_menu: true,
    can_edit_menu: false,
    can_change_prices: false,
    can_manage_categories: false,
    can_manage_users: false,
    can_manage_permissions: false,
    can_configure_alerts: false,
    can_connect_devices: false,
    can_view_reports: false,
    can_configure_restaurant: false,
    can_manage_notifications: false,
  },
  cozinha: {
    can_view_orders: true,
    can_create_orders: false,
    can_edit_orders: false,
    can_cancel_orders: false,
    can_change_status: true, // only recebido -> em_preparo -> pronto
    can_view_menu: true,
    can_edit_menu: false,
    can_change_prices: false,
    can_manage_categories: false,
    can_manage_users: false,
    can_manage_permissions: false,
    can_configure_alerts: true,
    can_connect_devices: false,
    can_view_reports: false,
    can_configure_restaurant: false,
    can_manage_notifications: false,
  },
  sushi_bar: {
    can_view_orders: true,
    can_create_orders: false,
    can_edit_orders: false,
    can_cancel_orders: false,
    can_change_status: true,
    can_view_menu: true,
    can_edit_menu: false,
    can_change_prices: false,
    can_manage_categories: false,
    can_manage_users: false,
    can_manage_permissions: false,
    can_configure_alerts: true,
    can_connect_devices: false,
    can_view_reports: false,
    can_configure_restaurant: false,
    can_manage_notifications: false,
  },
  bar: {
    can_view_orders: true,
    can_create_orders: false,
    can_edit_orders: false,
    can_cancel_orders: false,
    can_change_status: true,
    can_view_menu: true,
    can_edit_menu: false,
    can_change_prices: false,
    can_manage_categories: false,
    can_manage_users: false,
    can_manage_permissions: false,
    can_configure_alerts: true,
    can_connect_devices: false,
    can_view_reports: false,
    can_configure_restaurant: false,
    can_manage_notifications: false,
  },
  entrega: {
    can_view_orders: true,
    can_create_orders: false,
    can_edit_orders: false,
    can_cancel_orders: false,
    can_change_status: true, // only saiu_para_entrega -> entregue
    can_view_menu: false,
    can_edit_menu: false,
    can_change_prices: false,
    can_manage_categories: false,
    can_manage_users: false,
    can_manage_permissions: false,
    can_configure_alerts: false,
    can_connect_devices: false,
    can_view_reports: false,
    can_configure_restaurant: false,
    can_manage_notifications: false,
  },
  garcom: {
    can_view_orders: true,
    can_create_orders: true,
    can_edit_orders: true,
    can_cancel_orders: false,
    can_change_status: true,
    can_view_menu: true,
    can_edit_menu: false,
    can_change_prices: false,
    can_manage_categories: false,
    can_manage_users: false,
    can_manage_permissions: false,
    can_configure_alerts: false,
    can_connect_devices: false,
    can_view_reports: false,
    can_configure_restaurant: false,
    can_manage_notifications: false,
  },
};

export interface UserAccount {
  id: string;
  name: string;
  username: string;
  passwordHash: string;
  passwordSalt: string;
  role: UserRole;
  restaurantSlug: string; // 'all' or specific slug
  isActive: boolean;
  permissions: UserPermissions;
  createdAt: string;
  lastLoginAt?: string;
}

export interface ConnectedDevice {
  id: string;
  pairingCode: string;
  deviceName: string;
  platform: 'android' | 'ios' | 'web' | 'other';
  ipAddress?: string;
  soundEnabled: boolean;
  soundType: 'sound1' | 'sound2' | 'sound3' | 'sound4' | 'sound5';
  volume: number;
  vibrationEnabled: boolean;
  delayAlertsEnabled: boolean;
  delayMinutesThreshold: number;
  delayRepeatMinutes: number;
  status: 'online' | 'offline';
  lastPingAt: string;
  connectedAt: string;
}

export interface AuditActionLog {
  id: string;
  timestamp: string;
  userName: string;
  userRole: string;
  action: string;
  details?: string;
  category: 'order' | 'user' | 'alert' | 'device' | 'system';
}

const DATA_DIR = path.join(process.cwd(), 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const DEVICES_FILE = path.join(DATA_DIR, 'devices.json');
const AUDIT_LOGS_FILE = path.join(DATA_DIR, 'audit_logs.json');

function ensureDataDirectory() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

// Secure PBKDF2 Password Hashing (formato versionado: pbkdf2$<iterações>$<hex>)
// Hashes legados (sem prefixo) usam 10.000 iterações e continuam válidos; são
// atualizados automaticamente para o formato novo no próximo login bem-sucedido.
const PBKDF2_ITERATIONS = 150000;
const LEGACY_ITERATIONS = 10000;

export function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const finalSalt = salt || crypto.randomBytes(16).toString('hex');
  const derived = crypto.pbkdf2Sync(password, finalSalt, PBKDF2_ITERATIONS, 64, 'sha512').toString('hex');
  return { hash: `pbkdf2$${PBKDF2_ITERATIONS}$${derived}`, salt: finalSalt };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  let iterations = LEGACY_ITERATIONS;
  let expected = hash;
  if (hash.startsWith('pbkdf2$')) {
    const [, iterRaw, hex] = hash.split('$');
    iterations = Number(iterRaw) || PBKDF2_ITERATIONS;
    expected = hex;
  }
  const derived = crypto.pbkdf2Sync(password, salt, iterations, 64, 'sha512').toString('hex');
  const a = Buffer.from(derived, 'hex');
  const b = Buffer.from(expected, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function needsPasswordRehash(hash: string): boolean {
  return !hash.startsWith('pbkdf2$');
}

export function upgradeUserPasswordHash(userId: string, password: string) {
  initializeUsers();
  const idx = usersCache.findIndex((u) => u.id === userId);
  if (idx === -1) return;
  const { hash, salt } = hashPassword(password);
  usersCache[idx] = { ...usersCache[idx], passwordHash: hash, passwordSalt: salt };
  persistUsersSync();
}

/**
 * Verifica se a conta usa uma senha padrão conhecida, sem custo excessivo:
 * - hashes legados (10 mil iterações, criados por versões antigas): testa toda a lista;
 * - hashes novos (150 mil iterações): a política de senha já impede senhas comuns, então só o
 *   "admin123" do bootstrap de desenvolvimento precisa ser testado.
 */
function usesKnownDefaultPassword(u: { passwordHash: string; passwordSalt: string }): boolean {
  const candidates = u.passwordHash.startsWith('pbkdf2$') ? ['admin123'] : KNOWN_DEFAULT_PASSWORDS;
  return candidates.some((p) => {
    try {
      return verifyPassword(p, u.passwordHash, u.passwordSalt);
    } catch {
      return false;
    }
  });
}

/** Política mínima de senha para colaboradores. */
export function validateStaffPassword(password: string): string | null {
  if (!password || password.length < 8) return 'A senha deve ter pelo menos 8 caracteres.';
  if (/^(.)\1+$/.test(password)) return 'A senha não pode ser formada por um único caractere repetido.';
  if (KNOWN_DEFAULT_PASSWORDS.includes(password.toLowerCase())) return 'Esta senha é muito comum. Escolha outra.';
  return null;
}

const KNOWN_DEFAULT_PASSWORDS = [
  'admin123', 'cozinha123', 'caixa123', 'entrega123', 'gerente123', 'salao123',
  '12345678', 'password', 'senha123', '1234', 'nexoro123', 'tokio123',
];

// ----------------------------------------------------
// USERS REPOSITORY
// ----------------------------------------------------
let usersCache: UserAccount[] = [];
let usersInitialized = false;

function resolveBootstrapAdminPassword(): { password: string; generated: boolean } {
  const envPass = process.env.ADMIN_PASSWORD?.trim();

  // Credencial inicial simples e explícita solicitada para o primeiro acesso.
  // Depois do login, a senha pode ser alterada em Equipe > Usuários.
  // Se ADMIN_PASSWORD estiver configurada, ela tem prioridade.
  if (envPass === 'admin') {
    return { password: 'admin', generated: false };
  }
  if (envPass && validateStaffPassword(envPass) === null) {
    return { password: envPass, generated: false };
  }
  if (!IS_PRODUCTION) {
    console.warn('[AUTH] ADMIN_PASSWORD ausente/fraca: usando credencial inicial admin/admin.');
    return { password: 'admin', generated: false };
  }
  console.warn('[AUTH] ADMIN_PASSWORD ausente: usando credencial inicial admin/admin. Troque a senha em Equipe > Usuários.');
  return { password: 'admin', generated: false };
}

function getInitialUsers(): UserAccount[] {
  const now = new Date().toISOString();
  // Apenas o super administrador é criado automaticamente. Demais colaboradores
  // (cozinha, caixa, garçom, gerente, entregador) são criados pelo próprio
  // administrador em Equipe > Usuários, cada um com sua senha.
  const boot = resolveBootstrapAdminPassword();
  if (boot.generated) {
    console.warn('==========================================================');
    console.warn('[AUTH] ADMIN_PASSWORD não definida. Senha inicial GERADA para o usuário "admin":');
    console.warn(`[AUTH]   ${boot.password}`);
    console.warn('[AUTH] Anote agora e troque no painel. Ela não será exibida novamente.');
    console.warn('==========================================================');
  }
  const masterCreds = hashPassword(boot.password);
  return [
    {
      id: 'usr-superadmin',
      name: 'Super Administrador',
      username: 'admin',
      passwordHash: masterCreds.hash,
      passwordSalt: masterCreds.salt,
      role: 'super_admin',
      restaurantSlug: 'all',
      isActive: true,
      permissions: { ...ROLE_DEFAULT_PERMISSIONS.super_admin },
      createdAt: now,
    },
  ];
}

/**
 * Migração de segurança: contas herdadas com senhas padrão conhecidas
 * (admin123, cozinha123...) são desativadas em produção. A credencial inicial admin/admin
 * é uma exceção de bootstrap e pode ser alterada em Equipe > Usuários.
 */
function neutralizeDefaultCredentials() {
  let changed = false;
  for (let i = 0; i < usersCache.length; i++) {
    const u = usersCache[i];
    if (!usesKnownDefaultPassword(u)) continue;

    if (!IS_PRODUCTION) {
      console.warn(`[AUTH] (dev) Usuário "${u.username}" usa senha padrão conhecida.`);
      continue;
    }
    if (u.role === 'super_admin') {
      const boot = resolveBootstrapAdminPassword();
      const creds = hashPassword(boot.password);
      usersCache[i] = { ...u, passwordHash: creds.hash, passwordSalt: creds.salt };
      console.warn(`[AUTH] Senha padrão do super admin "${u.username}" foi substituída.`);
      if (boot.generated) console.warn(`[AUTH] Nova senha gerada para "${u.username}": ${boot.password}`);
    } else {
      usersCache[i] = { ...u, isActive: false };
      console.warn(`[AUTH] Usuário "${u.username}" DESATIVADO por usar senha padrão. Redefina a senha no painel para reativar.`);
    }
    changed = true;
  }
  if (changed) persistUsersSync();
}

export function initializeUsers() {
  if (usersInitialized) return;
  ensureDataDirectory();
  try {
    const raw = fs.existsSync(USERS_FILE) ? fs.readFileSync(USERS_FILE, 'utf-8').trim() : '';
    if (raw) {
      usersCache = JSON.parse(raw);
    } else {
      usersCache = getInitialUsers();
      persistUsersSync();
    }
  } catch (err) {
    // Arquivo corrompido: preserva uma cópia para análise e NÃO regenera silenciosamente.
    const backup = `${USERS_FILE}.corrupt-${Date.now()}`;
    try { fs.copyFileSync(USERS_FILE, backup); } catch {}
    console.error(`[AUTH] users.json ilegível (${(err as Error).message}). Cópia salva em ${backup}. Recriando apenas o admin.`);
    usersCache = getInitialUsers();
    persistUsersSync();
  }
  usersInitialized = true;
  neutralizeDefaultCredentials();
}

function persistUsersSync() {
  ensureDataDirectory();
  const tmp = `${USERS_FILE}.tmp.${Date.now()}`;
  try {
    fs.writeFileSync(tmp, JSON.stringify(usersCache, null, 2), 'utf-8');
    fs.renameSync(tmp, USERS_FILE);
  } catch (err) {
    if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
    throw err;
  }
}

export function getAllUsers(): Omit<UserAccount, 'passwordHash' | 'passwordSalt'>[] {
  initializeUsers();
  return usersCache.map(({ passwordHash, passwordSalt, ...safeUser }) => safeUser);
}

export function findUserByUsername(username: string): UserAccount | undefined {
  initializeUsers();
  return usersCache.find((u) => u.username.toLowerCase() === username.toLowerCase().trim());
}

export function findUserById(id: string): UserAccount | undefined {
  initializeUsers();
  return usersCache.find((u) => u.id === id);
}

export function createUser(data: {
  name: string;
  username: string;
  password: string;
  role: UserRole;
  restaurantSlug?: string;
  customPermissions?: Partial<UserPermissions>;
  operatorName?: string;
}): Omit<UserAccount, 'passwordHash' | 'passwordSalt'> {
  initializeUsers();

  const cleanUsername = data.username.toLowerCase().trim();
  if (findUserByUsername(cleanUsername)) {
    throw new Error(`O login "${cleanUsername}" já está em uso por outro usuário.`);
  }

  const pwdError = validateStaffPassword(data.password);
  if (pwdError) {
    throw new Error(pwdError);
  }

  const { hash, salt } = hashPassword(data.password);
  const basePerms = ROLE_DEFAULT_PERMISSIONS[data.role] || ROLE_DEFAULT_PERMISSIONS.caixa;
  const finalPerms: UserPermissions = {
    ...basePerms,
    ...(data.customPermissions || {}),
  };

  const newUser: UserAccount = {
    id: `usr-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
    name: data.name.trim(),
    username: cleanUsername,
    passwordHash: hash,
    passwordSalt: salt,
    role: data.role,
    restaurantSlug: data.restaurantSlug || 'all',
    isActive: true,
    permissions: finalPerms,
    createdAt: new Date().toISOString(),
  };

  usersCache.push(newUser);
  persistUsersSync();

  logAuditAction({
    userName: data.operatorName || 'Administrador',
    userRole: 'super_admin',
    action: `Criou o usuário "${newUser.name}" (@${newUser.username}) com função [${newUser.role.toUpperCase()}]`,
    category: 'user',
  });

  const { passwordHash, passwordSalt, ...safe } = newUser;
  return safe;
}

export function updateUser(
  id: string,
  updates: {
    name?: string;
    role?: UserRole;
    restaurantSlug?: string;
    isActive?: boolean;
    permissions?: Partial<UserPermissions>;
    newPassword?: string;
    operatorName?: string;
  }
): Omit<UserAccount, 'passwordHash' | 'passwordSalt'> {
  initializeUsers();
  const idx = usersCache.findIndex((u) => u.id === id);
  if (idx === -1) {
    throw new Error('Usuário não encontrado.');
  }

  const user = usersCache[idx];
  let newHash = user.passwordHash;
  let newSalt = user.passwordSalt;

  if (updates.newPassword) {
    const pwdError = validateStaffPassword(updates.newPassword.trim());
    if (pwdError) throw new Error(pwdError);
    const { hash, salt } = hashPassword(updates.newPassword.trim());
    newHash = hash;
    newSalt = salt;
  }

  const newRole = updates.role || user.role;
  let newPermissions = { ...user.permissions };
  if (updates.role && updates.role !== user.role) {
    newPermissions = { ...ROLE_DEFAULT_PERMISSIONS[updates.role] };
  }
  if (updates.permissions) {
    newPermissions = { ...newPermissions, ...updates.permissions };
  }

  const updated: UserAccount = {
    ...user,
    name: updates.name ? updates.name.trim() : user.name,
    role: newRole,
    restaurantSlug: updates.restaurantSlug !== undefined ? updates.restaurantSlug : user.restaurantSlug,
    isActive: updates.isActive !== undefined ? updates.isActive : user.isActive,
    permissions: newPermissions,
    passwordHash: newHash,
    passwordSalt: newSalt,
  };

  usersCache[idx] = updated;
  persistUsersSync();

  logAuditAction({
    userName: updates.operatorName || 'Administrador',
    userRole: 'super_admin',
    action: `Atualizou os dados/permissões do usuário "${updated.name}" (@${updated.username})`,
    category: 'user',
  });

  const { passwordHash, passwordSalt, ...safe } = updated;
  return safe;
}

export function deleteUser(id: string, operatorName?: string): boolean {
  initializeUsers();
  const target = usersCache.find((u) => u.id === id);
  if (!target) return false;

  if (target.username === 'admin') {
    throw new Error('O usuário mestre "admin" não pode ser excluído.');
  }

  usersCache = usersCache.filter((u) => u.id !== id);
  persistUsersSync();

  logAuditAction({
    userName: operatorName || 'Administrador',
    userRole: 'super_admin',
    action: `Excluiu permanentemente o usuário "${target.name}" (@${target.username})`,
    category: 'user',
  });

  return true;
}

// ----------------------------------------------------
// CONNECTED DEVICES (MOBILE RECEIVER) REPOSITORY
// ----------------------------------------------------
let devicesCache: ConnectedDevice[] = [];
let devicesInitialized = false;

export function initializeDevices() {
  if (devicesInitialized) return;
  ensureDataDirectory();
  try {
    if (fs.existsSync(DEVICES_FILE)) {
      const raw = fs.readFileSync(DEVICES_FILE, 'utf-8');
      devicesCache = JSON.parse(raw);
    } else {
      devicesCache = [];
      persistDevicesSync();
    }
  } catch {
    devicesCache = [];
  }
  devicesInitialized = true;
}

function persistDevicesSync() {
  ensureDataDirectory();
  const tmp = `${DEVICES_FILE}.tmp.${Date.now()}`;
  try {
    fs.writeFileSync(tmp, JSON.stringify(devicesCache, null, 2), 'utf-8');
    fs.renameSync(tmp, DEVICES_FILE);
  } catch (err) {
    if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
    throw err;
  }
}

export function getAllDevices(): ConnectedDevice[] {
  initializeDevices();
  const now = Date.now();
  // Mark offline if silent for more than 90 seconds (tolerant to 35s ping interval)
  return devicesCache.map((dev) => {
    const lastPing = new Date(dev.lastPingAt).getTime();
    const isOnline = now - lastPing < 90000;
    return {
      ...dev,
      status: isOnline ? 'online' : 'offline',
    };
  });
}

export function generatePairingCode(): string {
  initializeDevices();
  const code = `NX-${secureNumericCode(6)}`;
  return code;
}

export function registerOrPairDevice(data: {
  pairingCode: string;
  deviceName: string;
  platform?: 'android' | 'ios' | 'web' | 'other';
  soundType?: 'sound1' | 'sound2' | 'sound3' | 'sound4' | 'sound5';
  volume?: number;
}): ConnectedDevice {
  initializeDevices();
  const now = new Date().toISOString();

  // If pairing code matches existing, re-activate
  let dev = devicesCache.find((d) => d.pairingCode.toUpperCase() === data.pairingCode.toUpperCase().trim());

  if (!dev) {
    dev = {
      id: `dev-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
      pairingCode: data.pairingCode.toUpperCase().trim(),
      deviceName: data.deviceName.trim() || 'Celular Cozinha / Balcão',
      platform: data.platform || 'android',
      soundEnabled: true,
      soundType: data.soundType || 'sound1',
      volume: data.volume ?? 0.8,
      vibrationEnabled: true,
      delayAlertsEnabled: true,
      delayMinutesThreshold: 15,
      delayRepeatMinutes: 3,
      status: 'online',
      lastPingAt: now,
      connectedAt: now,
    };
    devicesCache.push(dev);
  } else {
    dev.deviceName = data.deviceName.trim() || dev.deviceName;
    dev.status = 'online';
    dev.lastPingAt = now;
    if (data.soundType) dev.soundType = data.soundType;
    if (data.volume !== undefined) dev.volume = data.volume;
  }

  persistDevicesSync();

  logAuditAction({
    userName: 'Sistema Dispositivos',
    userRole: 'device',
    action: `Dispositivo celular conectado: "${dev.deviceName}" (Pareamento: ${dev.pairingCode})`,
    category: 'device',
  });

  return dev;
}

export function updateDevicePing(idOrCode: string): ConnectedDevice | undefined {
  initializeDevices();
  const dev = devicesCache.find((d) => d.id === idOrCode || d.pairingCode === idOrCode);
  if (dev) {
    dev.lastPingAt = new Date().toISOString();
    dev.status = 'online';
    persistDevicesSync();
  }
  return dev;
}

export function updateDeviceSettings(
  id: string,
  settings: Partial<Pick<ConnectedDevice, 'soundEnabled' | 'soundType' | 'volume' | 'vibrationEnabled' | 'delayAlertsEnabled' | 'delayMinutesThreshold' | 'delayRepeatMinutes' | 'deviceName'>>
): ConnectedDevice {
  initializeDevices();
  const idx = devicesCache.findIndex((d) => d.id === id);
  if (idx === -1) throw new Error('Dispositivo não encontrado.');

  devicesCache[idx] = {
    ...devicesCache[idx],
    ...settings,
    lastPingAt: new Date().toISOString(),
  };

  persistDevicesSync();
  return devicesCache[idx];
}

export function disconnectDevice(id: string, operatorName?: string): boolean {
  initializeDevices();
  const target = devicesCache.find((d) => d.id === id);
  if (!target) return false;

  devicesCache = devicesCache.filter((d) => d.id !== id);
  persistDevicesSync();

  logAuditAction({
    userName: operatorName || 'Administrador',
    userRole: 'super_admin',
    action: `Desconectou o dispositivo "${target.deviceName}" (${target.pairingCode})`,
    category: 'device',
  });

  return true;
}

// ----------------------------------------------------
// AUDIT LOGS REPOSITORY
// ----------------------------------------------------
let auditLogsCache: AuditActionLog[] = [];
let auditLogsInitialized = false;

export function initializeAuditLogs() {
  if (auditLogsInitialized) return;
  ensureDataDirectory();
  try {
    if (fs.existsSync(AUDIT_LOGS_FILE)) {
      const raw = fs.readFileSync(AUDIT_LOGS_FILE, 'utf-8');
      auditLogsCache = JSON.parse(raw);
    } else {
      auditLogsCache = [
        {
          id: 'log-init',
          timestamp: new Date().toISOString(),
          userName: 'Sistema Tokio inBox',
          userRole: 'system',
          action: 'Inicialização do motor de logs de auditoria e conformidade',
          category: 'system',
        },
      ];
      persistAuditLogsSync();
    }
  } catch {
    auditLogsCache = [];
  }
  auditLogsInitialized = true;
}

function persistAuditLogsSync() {
  ensureDataDirectory();
  const tmp = `${AUDIT_LOGS_FILE}.tmp.${Date.now()}`;
  try {
    fs.writeFileSync(tmp, JSON.stringify(auditLogsCache.slice(0, 500), null, 2), 'utf-8');
    fs.renameSync(tmp, AUDIT_LOGS_FILE);
  } catch (err) {
    if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
  }
}

export function logAuditAction(entry: Omit<AuditActionLog, 'id' | 'timestamp'>): void {
  initializeAuditLogs();
  const newLog: AuditActionLog = {
    id: `log-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
    timestamp: new Date().toISOString(),
    ...entry,
  };
  auditLogsCache.unshift(newLog);
  // Cap at 500 logs
  if (auditLogsCache.length > 500) {
    auditLogsCache = auditLogsCache.slice(0, 500);
  }
  persistAuditLogsSync();
}

export function getAuditLogs(limit = 100): AuditActionLog[] {
  initializeAuditLogs();
  return auditLogsCache.slice(0, limit);
}

// ==========================================
// SECURE PASSWORD RECOVERY (TOKENS)
// ==========================================

interface PasswordResetToken {
  codeHash: string;
  userId: string;
  targetType: 'email' | 'whatsapp';
  destination: string;
  expiresAt: number;
  attempts: number;
}

// Um código ativo por usuário; o código só vale para o identificador informado.
const passwordResetTokens: Map<string, PasswordResetToken> = new Map();

function hashResetCode(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex');
}

export function requestPasswordReset(
  channel: 'email' | 'whatsapp',
  identifier: string
): { success: boolean; message: string; previewToken?: string } {
  initializeUsers();
  const cleanId = identifier.trim().toLowerCase();
  const user = usersCache.find((u) => u.username.toLowerCase() === cleanId);

  const code = secureNumericCode(6);
  if (user && user.isActive) {
    passwordResetTokens.set(user.id, {
      codeHash: hashResetCode(code),
      userId: user.id,
      targetType: channel,
      destination: identifier,
      expiresAt: Date.now() + 15 * 60 * 1000,
      attempts: 0,
    });
    logAuditAction({
      userName: user.name,
      userRole: user.role,
      action: `Código de recuperação de senha solicitado via ${channel.toUpperCase()}`,
      details: 'Sem canal de envio automático para colaboradores: um administrador deve redefinir a senha em Equipe > Usuários.',
      category: 'user',
    });
  }

  // Mensagem sempre igual: nunca revela se o usuário existe.
  return {
    success: true,
    message:
      'Se o usuário existir, a solicitação foi registrada. Peça ao administrador para redefinir sua senha no painel.',
    // Somente em desenvolvimento, para testes locais.
    previewToken: !IS_PRODUCTION && user ? code : undefined,
  };
}

export function confirmPasswordReset(
  token: string,
  newPassword: string,
  identifier?: string
): { success: boolean; error?: string } {
  initializeUsers();
  const generic = { success: false, error: 'Código de recuperação inválido ou expirado.' };
  if (!identifier) return generic;

  const user = usersCache.find((u) => u.username.toLowerCase() === identifier.trim().toLowerCase());
  if (!user) return generic;

  const record = passwordResetTokens.get(user.id);
  if (!record || record.expiresAt < Date.now()) return generic;

  record.attempts += 1;
  if (record.attempts > 5) {
    passwordResetTokens.delete(user.id);
    return generic;
  }
  if (record.codeHash !== hashResetCode(String(token).trim())) return generic;

  const pwdError = validateStaffPassword(newPassword.trim());
  if (pwdError) return { success: false, error: pwdError };

  const userIdx = usersCache.findIndex((u) => u.id === user.id);
  const { hash, salt } = hashPassword(newPassword.trim());
  usersCache[userIdx] = { ...usersCache[userIdx], passwordHash: hash, passwordSalt: salt };
  persistUsersSync();
  passwordResetTokens.delete(user.id);

  logAuditAction({
    userName: usersCache[userIdx].name,
    userRole: usersCache[userIdx].role,
    action: 'Senha redefinida com sucesso via código de segurança',
    category: 'user',
  });

  return { success: true };
}

/** Usuários ativos que ainda usam senha padrão conhecida (para o diagnóstico de segurança). */
export function listUsersWithDefaultPassword(): string[] {
  initializeUsers();
  return usersCache
    .filter((u) => u.isActive)
    .filter((u) => usesKnownDefaultPassword(u))
    .map((u) => u.username);
}

export function countActiveUsers(): number {
  initializeUsers();
  return usersCache.filter((u) => u.isActive).length;
}
