import crypto from 'crypto';

const TABLE_QR_SECRET =
  process.env.TABLE_QR_SECRET ||
  process.env.ADMIN_PASSWORD ||
  (process.env.NODE_ENV === 'production' ? '' : 'nexoro-table-qr-secret-v1');

function payloadFor(slug: string, tableNumber: number): string {
  return `${slug.trim().toLowerCase()}|${Math.trunc(tableNumber)}`;
}

function signatureFor(payload: string): string | null {
  if (!TABLE_QR_SECRET) return null;
  return crypto.createHmac('sha256', TABLE_QR_SECRET).update(payload).digest('hex');
}

export function createTableAccessToken(slug: string, tableNumber: number): string {
  const payload = payloadFor(slug, tableNumber);
  const signature = signatureFor(payload);
  if (!signature) throw new Error('TABLE_QR_SECRET ou ADMIN_PASSWORD não configurado.');
  return `${Buffer.from(payload, 'utf8').toString('base64url')}.${signature}`;
}

export function verifyTableAccessToken(token: string | undefined, slug: string, tableNumber: number): boolean {
  if (!token || !slug || !Number.isInteger(tableNumber)) return false;

  const parts = String(token).split('.');
  if (parts.length !== 2) return false;

  const payload = payloadFor(slug, tableNumber);
  const expectedSignature = signatureFor(payload);
  if (!expectedSignature) return false;
  const actualSignature = parts[1];

  try {
    const a = Buffer.from(actualSignature, 'hex');
    const b = Buffer.from(expectedSignature, 'hex');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
    const decoded = Buffer.from(parts[0], 'base64url').toString('utf8');
    return decoded === payload;
  } catch {
    return false;
  }
}
