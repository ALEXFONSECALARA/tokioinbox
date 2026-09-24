import crypto from 'crypto';

const TABLE_QR_SECRET =
  process.env.TABLE_QR_SECRET ||
  process.env.ADMIN_PASSWORD ||
  (process.env.NODE_ENV === 'production' ? '' : 'nexoro-table-qr-secret-v1');

// Em memória: horário (ms) em que a conta de cada mesa foi fechada pela
// última vez (Cobrar Mesa / Recebimento Presencial). É o que faz a senha/QR
// do cliente EXPIRAR automaticamente após o fechamento: qualquer token
// emitido ANTES desse horário passa a ser recusado, e a equipe precisa
// emitir uma nova senha/QR para o próximo cliente que sentar na mesa.
// Em memória é suficiente aqui: se o servidor reiniciar, o pior caso é uma
// senha antiga voltar a funcionar até a próxima conta ser fechada — não há
// perda de pedidos nem de dados financeiros.
const tableClosedAt = new Map<string, number>();

function tableKey(slug: string, tableNumber: number): string {
  return `${slug.trim().toLowerCase()}|${Math.trunc(tableNumber)}`;
}

/** Chamado ao fechar/cobrar uma mesa: invalida qualquer senha/QR anterior. */
export function markTableSessionClosed(slug: string, tableNumber: number): void {
  if (!slug || !Number.isInteger(tableNumber)) return;
  tableClosedAt.set(tableKey(slug, tableNumber), Date.now());
}

function payloadFor(slug: string, tableNumber: number, issuedAt: number): string {
  return `${slug.trim().toLowerCase()}|${Math.trunc(tableNumber)}|${issuedAt}`;
}

function signatureFor(payload: string): string | null {
  if (!TABLE_QR_SECRET) return null;
  return crypto.createHmac('sha256', TABLE_QR_SECRET).update(payload).digest('hex');
}

/**
 * Gera uma senha/QR única para a mesa, carimbada com o horário de emissão.
 * Contém: restaurante + número da mesa + horário — e dá acesso direto ao
 * cardápio do cliente para pedidos daquela mesa específica.
 */
export function createTableAccessToken(slug: string, tableNumber: number): string {
  const issuedAt = Date.now();
  const payload = payloadFor(slug, tableNumber, issuedAt);
  const signature = signatureFor(payload);
  if (!signature) throw new Error('TABLE_QR_SECRET ou ADMIN_PASSWORD não configurado.');
  return `${Buffer.from(payload, 'utf8').toString('base64url')}.${signature}`;
}

export function verifyTableAccessToken(token: string | undefined, slug: string, tableNumber: number): boolean {
  if (!token || !slug || !Number.isInteger(tableNumber)) return false;

  const parts = String(token).split('.');
  if (parts.length !== 2) return false;

  let decoded: string;
  try {
    decoded = Buffer.from(parts[0], 'base64url').toString('utf8');
  } catch {
    return false;
  }

  // Formato: "slug|mesa|issuedAt"
  const segments = decoded.split('|');
  if (segments.length !== 3) return false; // senha em formato antigo/inválido — pedir nova
  const issuedAt = Number(segments[2]);
  if (!Number.isFinite(issuedAt)) return false;

  const expectedPayload = payloadFor(slug, tableNumber, issuedAt);
  if (decoded !== expectedPayload) return false;

  const expectedSignature = signatureFor(expectedPayload);
  if (!expectedSignature) return false;
  const actualSignature = parts[1];

  try {
    const a = Buffer.from(actualSignature, 'hex');
    const b = Buffer.from(expectedSignature, 'hex');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  } catch {
    return false;
  }

  // EXPIRAÇÃO: se a conta desta mesa foi fechada depois desta senha ter
  // sido emitida, ela não vale mais — precisa de uma nova senha/QR.
  const closedAt = tableClosedAt.get(tableKey(slug, tableNumber));
  if (closedAt && issuedAt <= closedAt) return false;

  return true;
}

