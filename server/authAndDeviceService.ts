import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export type UserRole =
  | 'super_admin'
  | 'administrador'
  | 'caixa'
  | 'cozinha'
  | 'entrega';

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

// Secure PBKDF2 Password Hashing
export function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const finalSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, finalSalt, 10000, 64, 'sha512').toString('hex');
  return { hash, salt: finalSalt };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  const result = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return result === hash;
}

// ----------------------------------------------------
// USERS REPOSITORY
// ----------------------------------------------------
let usersCache: UserAccount[] = [];
let usersInitialized = false;

function getInitialUsers(): UserAccount[] {
  const now = new Date().toISOString();
  // Default master superadmin: admin / admin123
  const masterCreds = hashPassword('admin123');
  // Default kitchen staff: cozinha / cozinha123 or cozinha01
  const kitchenCreds = hashPassword('cozinha123');
  // Default cashier: caixa / caixa123 or caixa01
  const cashierCreds = hashPassword('caixa123');
  // Default courier / delivery: entregador / entrega123
  const courierCreds = hashPassword('entrega123');
  // Default manager / admin: gerente / gerente123
  const managerCreds = hashPassword('gerente123');

  return [
    {
      id: 'usr-superadmin',
      name: 'Super Administrador Mestre',
      username: 'admin',
      passwordHash: masterCreds.hash,
      passwordSalt: masterCreds.salt,
      role: 'super_admin',
      restaurantSlug: 'all',
      isActive: true,
      permissions: { ...ROLE_DEFAULT_PERMISSIONS.super_admin },
      createdAt: now,
    },
    {
      id: 'usr-gerente',
      name: 'Gerente Geral de Operações',
      username: 'gerente',
      passwordHash: managerCreds.hash,
      passwordSalt: managerCreds.salt,
      role: 'administrador',
      restaurantSlug: 'all',
      isActive: true,
      permissions: { ...ROLE_DEFAULT_PERMISSIONS.administrador },
      createdAt: now,
    },
    {
      id: 'usr-cozinha',
      name: 'Equipe Cozinha Central',
      username: 'cozinha',
      passwordHash: kitchenCreds.hash,
      passwordSalt: kitchenCreds.salt,
      role: 'cozinha',
      restaurantSlug: 'japones',
      isActive: true,
      permissions: { ...ROLE_DEFAULT_PERMISSIONS.cozinha },
      createdAt: now,
    },
    {
      id: 'usr-cozinha01',
      name: 'Equipe Cozinha 01',
      username: 'cozinha01',
      passwordHash: kitchenCreds.hash,
      passwordSalt: kitchenCreds.salt,
      role: 'cozinha',
      restaurantSlug: 'all',
      isActive: true,
      permissions: { ...ROLE_DEFAULT_PERMISSIONS.cozinha },
      createdAt: now,
    },
    {
      id: 'usr-caixa',
      name: 'Operador de Caixa Balcão',
      username: 'caixa',
      passwordHash: cashierCreds.hash,
      passwordSalt: cashierCreds.salt,
      role: 'caixa',
      restaurantSlug: 'all',
      isActive: true,
      permissions: { ...ROLE_DEFAULT_PERMISSIONS.caixa },
      createdAt: now,
    },
    {
      id: 'usr-caixa01',
      name: 'Operador de Caixa 01',
      username: 'caixa01',
      passwordHash: cashierCreds.hash,
      passwordSalt: cashierCreds.salt,
      role: 'caixa',
      restaurantSlug: 'all',
      isActive: true,
      permissions: { ...ROLE_DEFAULT_PERMISSIONS.caixa },
      createdAt: now,
    },
    {
      id: 'usr-entregador',
      name: 'Expedição & Entregador',
      username: 'entregador',
      passwordHash: courierCreds.hash,
      passwordSalt: courierCreds.salt,
      role: 'entrega',
      restaurantSlug: 'all',
      isActive: true,
      permissions: { ...ROLE_DEFAULT_PERMISSIONS.entrega },
      createdAt: now,
    },
  ];
}

export function initializeUsers() {
  if (usersInitialized) return;
  ensureDataDirectory();
  try {
    if (fs.existsSync(USERS_FILE)) {
      const raw = fs.readFileSync(USERS_FILE, 'utf-8');
      usersCache = JSON.parse(raw);
    } else {
      usersCache = getInitialUsers();
      persistUsersSync();
    }
  } catch {
    usersCache = getInitialUsers();
  }
  usersInitialized = true;
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

  if (data.password.length < 4) {
    throw new Error('A senha deve ter pelo menos 4 caracteres.');
  }

  const { hash, salt } = hashPassword(data.password);
  const basePerms = ROLE_DEFAULT_PERMISSIONS[data.role] || ROLE_DEFAULT_PERMISSIONS.caixa;
  const finalPerms: UserPermissions = {
    ...basePerms,
    ...(data.customPermissions || {}),
  };

  const newUser: UserAccount = {
    id: `usr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
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

  if (updates.newPassword && updates.newPassword.trim().length >= 4) {
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
  const code = `TK-${Math.floor(1000 + Math.random() * 9000)}`;
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
      id: `dev-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
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
    id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
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
  token: string;
  userId: string;
  targetType: 'email' | 'whatsapp';
  destination: string;
  expiresAt: number;
}

const passwordResetTokens: Map<string, PasswordResetToken> = new Map();

export function requestPasswordReset(
  channel: 'email' | 'whatsapp',
  identifier: string
): { success: boolean; message: string; previewToken?: string } {
  initializeUsers();
  const cleanId = identifier.trim().toLowerCase();

  // Find user by username, email or phone (if present in custom note or username)
  const user = usersCache.find(
    (u) =>
      u.username.toLowerCase() === cleanId ||
      u.name.toLowerCase() === cleanId
  );

  // Generate 6-digit cryptographic random token
  const token = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 15 * 60 * 1000; // 15 mins

  if (user) {
    passwordResetTokens.set(token, {
      token,
      userId: user.id,
      targetType: channel,
      destination: identifier,
      expiresAt,
    });

    logAuditAction({
      userName: user.name,
      userRole: user.role,
      action: `Código de recuperação de senha solicitado via ${channel.toUpperCase()}`,
      category: 'user',
    });
  }

  // Consistent message: NEVER reveal whether user exists
  return {
    success: true,
    message: `Se o ${channel === 'whatsapp' ? 'WhatsApp' : 'e-mail'} estiver cadastrado, o código de 6 dígitos foi enviado com sucesso.`,
    // For local/dev testing, return previewToken so administrator can test immediately
    previewToken: process.env.NODE_ENV !== 'production' ? token : undefined,
  };
}

export function confirmPasswordReset(
  token: string,
  newPassword: string
): { success: boolean; error?: string } {
  initializeUsers();
  const cleanToken = token.trim();
  const record = passwordResetTokens.get(cleanToken);

  if (!record || record.expiresAt < Date.now()) {
    return { success: false, error: 'Código de recuperação inválido ou expirado.' };
  }

  const userIdx = usersCache.findIndex((u) => u.id === record.userId);
  if (userIdx === -1) {
    return { success: false, error: 'Usuário não encontrado.' };
  }

  if (newPassword.trim().length < 4) {
    return { success: false, error: 'A nova senha deve possuir pelo menos 4 caracteres.' };
  }

  const { hash, salt } = hashPassword(newPassword.trim());
  usersCache[userIdx] = {
    ...usersCache[userIdx],
    passwordHash: hash,
    passwordSalt: salt,
  };
  persistUsersSync();
  passwordResetTokens.delete(cleanToken);

  logAuditAction({
    userName: usersCache[userIdx].name,
    userRole: usersCache[userIdx].role,
    action: 'Senha redefinida com sucesso via código de segurança',
    category: 'user',
  });

  return { success: true };
}
