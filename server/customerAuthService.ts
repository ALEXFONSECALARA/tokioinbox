import crypto from 'crypto';
import { secureNumericCode, IS_PRODUCTION } from './security';
import fs from 'fs';
import path from 'path';
import { normalizePhone } from './phoneUtils';
import { syncCustomerToSupabase } from './supabaseService';

export interface CustomerAddress {
  id: string;
  title: string;
  street: string;
  number: string;
  neighborhood: string;
  city: string;
  complement?: string;
  isDefault?: boolean;
}

export interface CustomerRecord {
  id: string;
  name: string;
  phone: string;              // formatted: (22) 99999-9999
  phoneNormalized: string;    // canonical: 5522999999999 (unique constraint)
  passwordHash: string;
  passwordSalt: string;
  savedAddresses: CustomerAddress[];
  hasClaimedInstallBonus: boolean;
  installBonusCouponCode?: string;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
}

export interface CustomerSessionRecord {
  token: string;
  customerId: string;
  expiresAt: string;
  createdAt: string;
}

export interface PasswordResetRecord {
  id: string;
  phoneNormalized: string;
  codeHash: string;
  expiresAt: number; // timestamp
  used: boolean;
  attempts?: number;
  createdAt: string;
}

// Sanitized session returned to the client (NO sensitive hashes)
export interface SanitizedCustomer {
  id: string;
  name: string;
  phone: string;
  phoneNormalized: string;
  savedAddresses: CustomerAddress[];
  hasClaimedInstallBonus: boolean;
  installBonusCouponCode?: string;
  createdAt: string;
  lastLoginAt?: string;
}

import { DATA_DIR } from './dataDir'; // Caminho configurável via env DATA_DIR (ver server/dataDir.ts)
const CUSTOMERS_FILE = path.join(DATA_DIR, 'customers.json');
const SESSIONS_FILE = path.join(DATA_DIR, 'customer_sessions.json');
const RESETS_FILE = path.join(DATA_DIR, 'password_resets.json');

let customersCache: CustomerRecord[] = [];
let sessionsCache: CustomerSessionRecord[] = [];
let resetsCache: PasswordResetRecord[] = [];
let isInitialized = false;

function ensureDataDirectory() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

// Initialize database files
function initCustomerDb() {
  if (isInitialized) return;
  ensureDataDirectory();

  try {
    if (fs.existsSync(CUSTOMERS_FILE)) {
      customersCache = JSON.parse(fs.readFileSync(CUSTOMERS_FILE, 'utf-8'));
    } else {
      customersCache = [];
      persistCustomersSync();
    }
  } catch (e) {
    console.error('[CUSTOMER DB ERROR] Falha ao ler customers.json:', e);
    customersCache = [];
  }

  try {
    if (fs.existsSync(SESSIONS_FILE)) {
      sessionsCache = JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf-8'));
    } else {
      sessionsCache = [];
      persistSessionsSync();
    }
  } catch {
    sessionsCache = [];
  }

  try {
    if (fs.existsSync(RESETS_FILE)) {
      resetsCache = JSON.parse(fs.readFileSync(RESETS_FILE, 'utf-8'));
    } else {
      resetsCache = [];
      persistResetsSync();
    }
  } catch {
    resetsCache = [];
  }

  isInitialized = true;
}

function persistCustomersSync() {
  ensureDataDirectory();
  const temp = `${CUSTOMERS_FILE}.tmp.${Date.now()}`;
  fs.writeFileSync(temp, JSON.stringify(customersCache, null, 2), 'utf-8');
  fs.renameSync(temp, CUSTOMERS_FILE);
}

function persistSessionsSync() {
  ensureDataDirectory();
  const temp = `${SESSIONS_FILE}.tmp.${Date.now()}`;
  fs.writeFileSync(temp, JSON.stringify(sessionsCache, null, 2), 'utf-8');
  fs.renameSync(temp, SESSIONS_FILE);
}

function persistResetsSync() {
  ensureDataDirectory();
  const temp = `${RESETS_FILE}.tmp.${Date.now()}`;
  fs.writeFileSync(temp, JSON.stringify(resetsCache, null, 2), 'utf-8');
  fs.renameSync(temp, RESETS_FILE);
}

// Cryptographic password hashing using PBKDF2 with SHA-256 and unique salt
function hashPassword(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha256').toString('hex');
}

function generateSalt(): string {
  return crypto.randomBytes(16).toString('hex');
}

function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function sanitizeCustomer(c: CustomerRecord): SanitizedCustomer {
  return {
    id: c.id,
    name: c.name,
    phone: c.phone,
    phoneNormalized: c.phoneNormalized,
    savedAddresses: c.savedAddresses || [],
    hasClaimedInstallBonus: c.hasClaimedInstallBonus || false,
    installBonusCouponCode: c.installBonusCouponCode,
    createdAt: c.createdAt,
    lastLoginAt: c.lastLoginAt,
  };
}

// ==============================================================================
// 1. REGISTER CUSTOMER (CADASTRO COM WHATSAPP/TELEFONE + SENHA)
// ==============================================================================
export function registerCustomer(params: {
  name: string;
  phone: string;
  password: string;
  confirmPassword?: string;
}): {
  success: boolean;
  token?: string;
  customer?: SanitizedCustomer;
  error?: string;
  alreadyExists?: boolean;
} {
  initCustomerDb();

  const name = params.name?.trim();
  if (!name || name.length < 2) {
    return { success: false, error: 'Por favor, informe seu nome completo.' };
  }

  const norm = normalizePhone(params.phone);
  if (!norm.isValid) {
    return { success: false, error: norm.error || 'Número de WhatsApp inválido.' };
  }

  const password = params.password;
  if (!password || password.length < 6) {
    return { success: false, error: 'A senha deve conter no mínimo 6 caracteres.' };
  }

  if (params.confirmPassword !== undefined && params.confirmPassword !== password) {
    return { success: false, error: 'A confirmação da senha não confere com a senha digitada.' };
  }

  // Check unique normalized phone constraint
  const existing = customersCache.find((c) => c.phoneNormalized === norm.canonical);
  if (existing) {
    return {
      success: false,
      alreadyExists: true,
      error: 'Este WhatsApp já possui uma conta cadastrada.',
    };
  }

  const salt = generateSalt();
  const passwordHash = hashPassword(password, salt);
  const customerId = `cust-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const now = new Date().toISOString();

  const newCustomer: CustomerRecord = {
    id: customerId,
    name,
    phone: norm.displayFormatted,
    phoneNormalized: norm.canonical,
    passwordHash,
    passwordSalt: salt,
    savedAddresses: [],
    hasClaimedInstallBonus: false,
    createdAt: now,
    updatedAt: now,
    lastLoginAt: now,
  };

  customersCache.push(newCustomer);
  persistCustomersSync();

  // Asynchronously mirror customer to Supabase PostgreSQL if configured
  syncCustomerToSupabase(newCustomer).catch(() => {});

  // Create session
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days
  sessionsCache.push({
    token,
    customerId,
    expiresAt,
    createdAt: now,
  });
  persistSessionsSync();

  return {
    success: true,
    token,
    customer: sanitizeCustomer(newCustomer),
  };
}

// ==============================================================================
// 2. LOGIN CUSTOMER (WHATSAPP/TELEFONE + SENHA)
// ==============================================================================
export function loginCustomer(params: {
  phone: string;
  password: string;
}): {
  success: boolean;
  token?: string;
  customer?: SanitizedCustomer;
  error?: string;
  notFound?: boolean;
} {
  initCustomerDb();

  const norm = normalizePhone(params.phone);
  if (!norm.isValid) {
    return { success: false, error: norm.error || 'Número de WhatsApp inválido.' };
  }

  if (!params.password) {
    return { success: false, error: 'Por favor, informe sua senha de acesso.' };
  }

  // Find customer by normalized canonical phone
  const customer = customersCache.find((c) => c.phoneNormalized === norm.canonical);
  if (!customer) {
    return {
      success: false,
      notFound: true,
      error: 'Nenhuma conta encontrada com este número de WhatsApp. Por favor, faça seu cadastro.',
    };
  }

  // Verify password hash
  const computedHash = hashPassword(params.password, customer.passwordSalt);
  const hashA = Buffer.from(computedHash);
  const hashB = Buffer.from(customer.passwordHash);
  if (hashA.length !== hashB.length || !crypto.timingSafeEqual(hashA, hashB)) {
    return {
      success: false,
      error: 'Senha incorreta. Verifique os dados ou utilize a opção de recuperação de senha.',
    };
  }

  // Update last login
  customer.lastLoginAt = new Date().toISOString();
  persistCustomersSync();

  // Create active session
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  sessionsCache.push({
    token,
    customerId: customer.id,
    expiresAt,
    createdAt: new Date().toISOString(),
  });
  persistSessionsSync();

  return {
    success: true,
    token,
    customer: sanitizeCustomer(customer),
  };
}

// ==============================================================================
// 3. SECURE SESSION VALIDATION
// ==============================================================================
export function validateCustomerSession(token: string | undefined): SanitizedCustomer | null {
  if (!token) return null;
  initCustomerDb();

  const session = sessionsCache.find((s) => s.token === token);
  if (!session) return null;

  // Check expiration
  if (new Date(session.expiresAt).getTime() < Date.now()) {
    // Remove expired session
    sessionsCache = sessionsCache.filter((s) => s.token !== token);
    persistSessionsSync();
    return null;
  }

  const customer = customersCache.find((c) => c.id === session.customerId);
  if (!customer) return null;

  return sanitizeCustomer(customer);
}

export function logoutCustomerSession(token: string): boolean {
  initCustomerDb();
  const initialLen = sessionsCache.length;
  sessionsCache = sessionsCache.filter((s) => s.token !== token);
  if (sessionsCache.length !== initialLen) {
    persistSessionsSync();
    return true;
  }
  return false;
}

// ==============================================================================
// 4. PASSWORD RECOVERY (RECUPERAÇÃO SEGURA POR WHATSAPP/SMS)
// ==============================================================================
export async function requestCustomerPasswordReset(rawPhone: string): Promise<{
  success: boolean;
  message: string;
  error?: string;
  phoneNormalized?: string;
  debugCode?: string; // only provided if external provider is not yet set up
}> {
  initCustomerDb();

  const norm = normalizePhone(rawPhone);
  if (!norm.isValid) {
    return { success: false, message: '', error: norm.error || 'Número de WhatsApp inválido.' };
  }

  const customer = customersCache.find((c) => c.phoneNormalized === norm.canonical);
  const genericOk = {
    success: true,
    message: `Se houver uma conta para ${norm.displayFormatted}, enviaremos um código de verificação por WhatsApp.`,
    phoneNormalized: norm.canonical,
  };

  const providerConfigured = Boolean(process.env.WHATSAPP_SMS_PROVIDER_API_KEY && process.env.WHATSAPP_SMS_ENDPOINT_URL);
  if (IS_PRODUCTION && !providerConfigured) {
    // Sem canal de envio não há como entregar o código com segurança.
    return {
      success: false,
      message: '',
      error: 'A recuperação de senha por WhatsApp não está disponível no momento. Entre em contato com o restaurante.',
    };
  }
  if (!customer) {
    return genericOk; // não revela se o número tem conta
  }

  // Generate 6-digit numeric verification code
  const code = secureNumericCode(6);
  const codeHash = crypto.createHash('sha256').update(code).digest('hex');
  const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes

  const resetRecord: PasswordResetRecord = {
    id: `reset-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
    phoneNormalized: norm.canonical,
    codeHash,
    expiresAt,
    used: false,
    attempts: 0,
    createdAt: new Date().toISOString(),
  };

  // Invalida códigos anteriores ainda pendentes deste telefone
  resetsCache.forEach((r) => {
    if (r.phoneNormalized === norm.canonical && !r.used) r.used = true;
  });
  resetsCache.push(resetRecord);
  persistResetsSync();

  // Check if real external WhatsApp/SMS provider is configured
  const providerKey = process.env.WHATSAPP_SMS_PROVIDER_API_KEY;
  const providerUrl = process.env.WHATSAPP_SMS_ENDPOINT_URL;

  let dispatchedExternally = false;
  if (providerKey && providerUrl) {
    try {
      console.log(`[WHATSAPP PROVIDER] Enviando código de recuperação para ${norm.canonical}`);
      const res = await fetch(providerUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${providerKey}`,
        },
        body: JSON.stringify({
          phone: norm.canonical,
          message: `Seu código de verificação para redefinir sua senha na Tokiō Food é: ${code}. Válido por 15 minutos.`,
        }),
      });
      if (res.ok) {
        dispatchedExternally = true;
      }
    } catch (err) {
      console.error('[WHATSAPP DISPATCH ERROR]', err);
    }
  }

  if (!IS_PRODUCTION) console.log(`[RECUPERAÇÃO DE SENHA][DEV] Código para ${norm.canonical}: ${code}`);

  return {
    ...genericOk,
    // Somente em desenvolvimento e sem provedor externo — jamais em produção.
    debugCode: !IS_PRODUCTION && !dispatchedExternally ? code : undefined,
  };
}

export function confirmCustomerPasswordReset(params: {
  phone: string;
  code: string;
  newPassword: string;
  confirmPassword?: string;
}): { success: boolean; message: string; error?: string } {
  initCustomerDb();

  const norm = normalizePhone(params.phone);
  if (!norm.isValid) {
    return { success: false, message: '', error: norm.error || 'Telefone inválido.' };
  }

  if (!params.code || params.code.trim().length !== 6) {
    return { success: false, message: '', error: 'O código de verificação deve conter 6 dígitos.' };
  }

  if (!params.newPassword || params.newPassword.length < 6) {
    return { success: false, message: '', error: 'A nova senha deve conter pelo menos 6 caracteres.' };
  }

  if (params.confirmPassword !== undefined && params.confirmPassword !== params.newPassword) {
    return { success: false, message: '', error: 'A confirmação não confere com a nova senha digitada.' };
  }

  const codeHash = crypto.createHash('sha256').update(params.code.trim()).digest('hex');
  const now = Date.now();

  const resetRecord = resetsCache
    .filter((r) => r.phoneNormalized === norm.canonical && !r.used && r.expiresAt > now)
    .sort((a, b) => b.expiresAt - a.expiresAt)[0];

  if (resetRecord) {
    resetRecord.attempts = (resetRecord.attempts || 0) + 1;
    if (resetRecord.attempts > 5) {
      resetRecord.used = true; // esgotou tentativas: exige novo código
      persistResetsSync();
      return { success: false, message: '', error: 'Muitas tentativas incorretas. Solicite um novo código.' };
    }
    persistResetsSync();
  }

  if (!resetRecord || resetRecord.codeHash !== codeHash) {
    return {
      success: false,
      message: '',
      error: 'Código de verificação incorreto ou expirado. Solicite um novo código.',
    };
  }

  // Update customer password
  const customer = customersCache.find((c) => c.phoneNormalized === norm.canonical);
  if (!customer) {
    return { success: false, message: '', error: 'Cliente não encontrado.' };
  }

  const salt = generateSalt();
  customer.passwordSalt = salt;
  customer.passwordHash = hashPassword(params.newPassword, salt);
  customer.updatedAt = new Date().toISOString();
  persistCustomersSync();

  // Mark reset record as used
  resetRecord.used = true;
  persistResetsSync();

  // Invalidate all past sessions for security
  sessionsCache = sessionsCache.filter((s) => s.customerId !== customer.id);
  persistSessionsSync();

  return {
    success: true,
    message: 'Senha alterada com sucesso! Você já pode entrar com sua nova senha.',
  };
}

// ==============================================================================
// 5. CUSTOMER PROFILE & ADDRESSES
// ==============================================================================
export function updateCustomerProfile(
  customerId: string,
  updates: { name?: string }
): { success: boolean; customer?: SanitizedCustomer; error?: string } {
  initCustomerDb();

  const customer = customersCache.find((c) => c.id === customerId);
  if (!customer) {
    return { success: false, error: 'Cliente não encontrado.' };
  }

  if (updates.name && updates.name.trim().length >= 2) {
    customer.name = updates.name.trim();
  }
  customer.updatedAt = new Date().toISOString();
  persistCustomersSync();

  return { success: true, customer: sanitizeCustomer(customer) };
}

export function saveCustomerAddress(
  customerId: string,
  address: Omit<CustomerAddress, 'id'>
): { success: boolean; customer?: SanitizedCustomer; error?: string } {
  initCustomerDb();

  const customer = customersCache.find((c) => c.id === customerId);
  if (!customer) {
    return { success: false, error: 'Cliente não encontrado.' };
  }

  if (!address.street?.trim() || !address.number?.trim() || !address.neighborhood?.trim()) {
    return { success: false, error: 'Rua, número e bairro são obrigatórios.' };
  }

  const newAddr: CustomerAddress = {
    id: `addr-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
    title: address.title?.trim() || 'Casa',
    street: address.street.trim(),
    number: address.number.trim(),
    neighborhood: address.neighborhood.trim(),
    city: address.city?.trim() || 'São Paulo',
    complement: address.complement?.trim() || undefined,
    isDefault: Boolean(address.isDefault),
  };

  if (!customer.savedAddresses) {
    customer.savedAddresses = [];
  }

  if (newAddr.isDefault) {
    customer.savedAddresses.forEach((a) => (a.isDefault = false));
  } else if (customer.savedAddresses.length === 0) {
    newAddr.isDefault = true;
  }

  customer.savedAddresses.push(newAddr);
  customer.updatedAt = new Date().toISOString();
  persistCustomersSync();

  return { success: true, customer: sanitizeCustomer(customer) };
}

export function deleteCustomerAddress(
  customerId: string,
  addressId: string
): { success: boolean; customer?: SanitizedCustomer; error?: string } {
  initCustomerDb();

  const customer = customersCache.find((c) => c.id === customerId);
  if (!customer) {
    return { success: false, error: 'Cliente não encontrado.' };
  }

  customer.savedAddresses = (customer.savedAddresses || []).filter((a) => a.id !== addressId);
  customer.updatedAt = new Date().toISOString();
  persistCustomersSync();

  return { success: true, customer: sanitizeCustomer(customer) };
}
