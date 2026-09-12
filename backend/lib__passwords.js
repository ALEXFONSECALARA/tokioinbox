// Hash de senha dos usuários do painel (Fase 4, itens 17-19).
//
// Usa crypto.scrypt (nativo do Node, já importado em server/index.js) em vez
// de bcrypt/argon2 — não é preciso instalar nenhuma dependência nova. scrypt
// é um algoritmo de derivação de chave adequado pra senhas (memory-hard,
// resistente a força bruta em GPU), amplamente recomendado como alternativa
// ao bcrypt quando não se quer adicionar uma dependência externa.
//
// Formato armazenado: "<salt-hex>:<hash-hex>". Nunca guardamos a senha em
// texto puro, e não existe função de "descriptografar" — só de comparar
// (verifyPassword). O super-admin pode REDEFINIR a senha de um usuário, mas
// nunca visualizar a original (item 19).
import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'crypto';
import { promisify } from 'util';

const scrypt = promisify(scryptCb);
const KEY_LENGTH = 64;

export async function hashPassword(plainPassword) {
  const salt = randomBytes(16).toString('hex');
  const derived = await scrypt(String(plainPassword), salt, KEY_LENGTH);
  return `${salt}:${derived.toString('hex')}`;
}

export async function verifyPassword(plainPassword, storedHash) {
  if (!storedHash || typeof storedHash !== 'string' || !storedHash.includes(':')) return false;
  const [salt, hashHex] = storedHash.split(':');
  try {
    const derived = await scrypt(String(plainPassword), salt, KEY_LENGTH);
    const stored = Buffer.from(hashHex, 'hex');
    if (stored.length !== derived.length) return false;
    return timingSafeEqual(derived, stored);
  } catch {
    return false;
  }
}
