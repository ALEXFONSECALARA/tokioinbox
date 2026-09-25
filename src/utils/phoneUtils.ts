/**
 * Client-side Phone Formatting and Normalization Helper
 */

export function formatPhoneMask(input: string): string {
  const digits = input.replace(/\D/g, '');
  if (!digits) return '';

  if (digits.length <= 2) {
    return `(${digits}`;
  }
  if (digits.length <= 6) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  }
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  // 11 digits (with 9-digit mobile)
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
}

export function getCleanPhoneDigits(raw: string): string {
  return raw.replace(/\D/g, '');
}
