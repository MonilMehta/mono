export const MOCK_METHODS = ['GET', 'POST', 'PATCH'] as const;

export type MockMethod = (typeof MOCK_METHODS)[number];

export type MockConfig = {
  v: 1;
  responses: Record<MockMethod, { status: number; body: unknown }>;
};

export const MOCK_TTL_SECONDS = 4 * 60 * 60;
const MOCK_ID_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MOCK_ID_LENGTH = 10;

export function createMockId(randomIndex: (max: number) => number) {
  return Array.from({ length: MOCK_ID_LENGTH }, () => MOCK_ID_ALPHABET[randomIndex(MOCK_ID_ALPHABET.length)]).join('');
}

export function isValidMockId(value: string) {
  return new RegExp(`^[${MOCK_ID_ALPHABET}]{${MOCK_ID_LENGTH}}$`).test(value);
}

function toBase64Url(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(value: string) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='));
  return new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
}

export function encodeMockConfig(config: MockConfig) {
  return toBase64Url(JSON.stringify(config));
}

export function decodeMockConfig(value: string): MockConfig {
  const config = JSON.parse(fromBase64Url(value)) as Partial<MockConfig>;
  if (config.v !== 1 || !config.responses || typeof config.responses !== 'object') {
    throw new Error('Invalid mock configuration.');
  }
  for (const method of MOCK_METHODS) {
    const response = config.responses[method];
    if (!response || !Number.isInteger(response.status) || response.status < 200 || response.status > 599) {
      throw new Error(`Invalid ${method} response.`);
    }
  }
  return config as MockConfig;
}
