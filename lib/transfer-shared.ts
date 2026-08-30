export const TRANSFER_TTL_SECONDS = 10 * 60;
export const MAX_FILE_BYTES = 25 * 1024 * 1024;
export const MAX_TEXT_BYTES = 100 * 1024;

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 8;

export function normalizeTransferCode(value: string): string {
  return value.toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, CODE_LENGTH);
}

export function sanitizeFilename(value: string): string {
  const filename = value.split(/[\\/]/).pop()?.replace(/[\r\n]/g, '').trim() || 'file';
  return filename.slice(0, 120);
}

export function isValidTransferCode(value: string): boolean {
  return new RegExp(`^[${CODE_ALPHABET}]{${CODE_LENGTH}}$`).test(value);
}

export function createTransferCode(randomIndex: (max: number) => number): string {
  return Array.from({ length: CODE_LENGTH }, () => CODE_ALPHABET[randomIndex(CODE_ALPHABET.length)]).join('');
}
