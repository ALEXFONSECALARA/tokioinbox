/**
 * V9.3 — PIX "copia e cola" (BR Code EMV estático) VÁLIDO, com CRC16-CCITT.
 * Antes o cardápio montava um código sem CRC correto (fixo "E8B2") e mostrava um QR desenhado
 * com quadradinhos decorativos: o banco do cliente recusava. Agora o payload segue o manual do BCB.
 */
export function crc16(str: string): string {
  let crc = 0xffff;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

const tlv = (id: string, value: string) => `${id}${String(value.length).padStart(2, '0')}${value}`;
const ascii = (v: string, max: number) =>
  v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9 .\-_@]/g, '').trim().toUpperCase().slice(0, max);

/** Extrai a cidade de "Rua X, 10 - Bairro, Cidade - UF". Fallback: BRASIL. */
export function cityFromAddress(address?: string): string {
  const m = (address || '').match(/,\s*([^,\-]+?)\s*-\s*[A-Z]{2}\s*$/);
  return m ? m[1] : 'BRASIL';
}

export function buildPixBrCode(p: { key: string; name: string; city?: string; amount?: number; txid?: string }): string {
  const key = p.key.trim();
  if (!key) throw new Error('Chave PIX não cadastrada.');
  const merchantInfo = tlv('00', 'br.gov.bcb.pix') + tlv('01', key);
  const amount = p.amount && p.amount > 0 ? tlv('54', p.amount.toFixed(2)) : '';
  const txid = (p.txid || '***').replace(/[^A-Za-z0-9]/g, '').slice(0, 25) || '***';
  const body =
    tlv('00', '01') + tlv('01', '11') + tlv('26', merchantInfo) + tlv('52', '0000') + tlv('53', '986') + amount +
    tlv('58', 'BR') + tlv('59', ascii(p.name, 25) || 'RESTAURANTE') + tlv('60', ascii(p.city || 'BRASIL', 15) || 'BRASIL') +
    tlv('62', tlv('05', txid === '***' ? '***' : txid)) + '6304';
  return body + crc16(body);
}
