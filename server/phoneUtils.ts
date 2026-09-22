/**
 * Phone Normalization and Validation Engine
 * Guarantees strict canonical representation across:
 * (22) 99999-9999, 22 99999-9999, +55 22 99999-9999, 5522999999999
 * Prevents account duplication and enforces backend database integrity.
 */

export interface NormalizedPhoneResult {
  isValid: boolean;
  canonical: string;       // e.g. "5522999999999" (unique index storage)
  displayFormatted: string; // e.g. "(22) 99999-9999"
  ddd: string;             // e.g. "22"
  nationalNumber: string;  // e.g. "999999999"
  error?: string;
}

export function normalizePhone(rawPhone: string): NormalizedPhoneResult {
  if (!rawPhone || typeof rawPhone !== 'string') {
    return {
      isValid: false,
      canonical: '',
      displayFormatted: '',
      ddd: '',
      nationalNumber: '',
      error: 'Telefone não informado.',
    };
  }

  // 1. Strip everything except digits
  let digits = rawPhone.replace(/\D/g, '');

  // Handle leading zeros (e.g. 022999999999 -> 22999999999)
  if (digits.startsWith('0') && digits.length > 10) {
    digits = digits.substring(1);
  }

  // 2. Extract country code if present (55 for Brazil)
  let ddd = '';
  let nationalNumber = '';

  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    // Has Brazilian country code + DDD + 8 or 9 digits
    ddd = digits.substring(2, 4);
    nationalNumber = digits.substring(4);
  } else if (digits.length === 10 || digits.length === 11) {
    // DDD + 8 or 9 digits without country code
    ddd = digits.substring(0, 2);
    nationalNumber = digits.substring(2);
  } else {
    return {
      isValid: false,
      canonical: digits,
      displayFormatted: rawPhone,
      ddd: '',
      nationalNumber: '',
      error: 'O número de telefone informado não possui a quantidade válida de dígitos para o Brasil (DDD + 8 ou 9 dígitos).',
    };
  }

  // Validate Brazilian DDD range (11 to 99)
  const dddNum = parseInt(ddd, 10);
  if (isNaN(dddNum) || dddNum < 11 || dddNum > 99) {
    return {
      isValid: false,
      canonical: `55${ddd}${nationalNumber}`,
      displayFormatted: rawPhone,
      ddd,
      nationalNumber,
      error: `DDD "${ddd}" inválido. Informe um DDD brasileiro válido entre 11 e 99.`,
    };
  }

  // Canonical E.164-compatible representation without '+'
  const canonical = `55${ddd}${nationalNumber}`;

  // Formatted for human readability: (22) 99999-9999 or (22) 3333-4444
  let displayFormatted = '';
  if (nationalNumber.length === 9) {
    displayFormatted = `(${ddd}) ${nationalNumber.substring(0, 5)}-${nationalNumber.substring(5)}`;
  } else {
    displayFormatted = `(${ddd}) ${nationalNumber.substring(0, 4)}-${nationalNumber.substring(4)}`;
  }

  return {
    isValid: true,
    canonical,
    displayFormatted,
    ddd,
    nationalNumber,
  };
}
