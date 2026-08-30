import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { del, list } from '@vercel/blob';
import { createClient } from 'redis';
import {
  TRANSFER_TTL_SECONDS,
  createTransferCode,
  sanitizeFilename,
} from '@/lib/transfer-shared';

export { MAX_FILE_BYTES, MAX_TEXT_BYTES, isValidTransferCode, normalizeTransferCode } from '@/lib/transfer-shared';

const KEY_PREFIX = 'mono:transfer:';

export type TransferRecord =
  | { kind: 'text'; text: string; createdAt: number }
  | {
      kind: 'file';
      status: 'pending' | 'ready';
      name: string;
      size: number;
      contentType: string;
      pathname: string;
      uploadSecretHash: string;
      createdAt: number;
    };

type NewTransferRecord =
  | Omit<Extract<TransferRecord, { kind: 'text' }>, 'createdAt'>
  | Omit<Extract<TransferRecord, { kind: 'file' }>, 'createdAt'>;

let redisClient: ReturnType<typeof createClient> | null = null;
let redisConnectPromise: Promise<unknown> | null = null;

function transferKey(code: string): string {
  return `${KEY_PREFIX}${code}`;
}

function createCode(): string {
  return createTransferCode(randomInt);
}

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function secretsMatch(secret: string, expectedHash: string): boolean {
  const actual = Buffer.from(hash(secret));
  const expected = Buffer.from(expectedHash);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function getBlobOptions() {
  const token = process.env.MONO_READ_WRITE_TOKEN;
  const storeId = process.env.MONO_STORE_ID;
  if (!token || !storeId) throw new Error('Blob storage is not configured.');
  return { access: 'private' as const, token, storeId };
}

export async function getRedis() {
  const url = process.env.MONO_REDIS_URL;
  if (!url) throw new Error('Redis is not configured.');
  const redisUrl = new URL(url);
  const isLocal = redisUrl.hostname === 'localhost' || redisUrl.hostname === '127.0.0.1' || redisUrl.hostname === '::1';
  if (redisUrl.protocol !== 'rediss:' && !isLocal) {
    throw new Error('Redis must use a TLS rediss:// URL.');
  }

  if (!redisClient) {
    redisClient = createClient({ url });
    redisClient.on('error', (error) => console.error('Redis connection error:', error.message));
  }
  if (!redisClient.isOpen) {
    redisConnectPromise ??= redisClient.connect();
    try {
      await redisConnectPromise;
    } finally {
      redisConnectPromise = null;
    }
  }
  return redisClient;
}

async function saveWithNewCode(record: NewTransferRecord): Promise<string> {
  const redis = await getRedis();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = createCode();
    const result = await redis.set(
      transferKey(code),
      JSON.stringify({ ...record, createdAt: Date.now() }),
      { expiration: { type: 'EX', value: TRANSFER_TTL_SECONDS }, condition: 'NX' }
    );
    if (result === 'OK') return code;
  }
  throw new Error('Could not create a transfer code.');
}

export async function createTextTransfer(text: string): Promise<string> {
  return saveWithNewCode({ kind: 'text', text });
}

export async function reserveFileTransfer(file: { name: string; size: number; contentType: string }) {
  const uploadSecret = randomBytes(24).toString('base64url');
  const name = sanitizeFilename(file.name);
  const code = await saveWithNewCode({
    kind: 'file',
    status: 'pending',
    name,
    size: file.size,
    contentType: /^[\w.+-]+\/[\w.+-]+$/.test(file.contentType) ? file.contentType : 'application/octet-stream',
    pathname: '',
    uploadSecretHash: hash(uploadSecret),
  });
  return { code, uploadSecret, pathname: `transfers/${code}/${name.replace(/[^a-zA-Z0-9._-]+/g, '_')}` };
}

export async function authorizeFileUpload(code: string, uploadSecret: string, pathname: string) {
  const record = await readTransfer(code);
  if (
    !record ||
    record.kind !== 'file' ||
    !secretsMatch(uploadSecret, record.uploadSecretHash) ||
    pathname !== `transfers/${code}/${record.name.replace(/[^a-zA-Z0-9._-]+/g, '_')}`
  ) {
    throw new Error('Invalid or expired upload.');
  }
  return record;
}

export async function completeFileTransfer(code: string, uploadSecret: string, pathname: string) {
  const redis = await getRedis();
  const record = await authorizeFileUpload(code, uploadSecret, pathname);
  if (record.status === 'ready') {
    if (record.pathname === pathname) return;
    throw new Error('Transfer was completed with a different file.');
  }
  const result = await redis.set(
    transferKey(code),
    JSON.stringify({ ...record, status: 'ready', pathname }),
    { expiration: 'KEEPTTL', condition: 'XX' }
  );
  if (result !== 'OK') throw new Error('Transfer expired before the upload completed.');
}

export async function readTransfer(code: string): Promise<TransferRecord | null> {
  const redis = await getRedis();
  const raw = await redis.get(transferKey(code));
  return parseTransferRecord(raw);
}

export async function claimTransfer(code: string): Promise<{ record: TransferRecord | null; ttl: number }> {
  const redis = await getRedis();
  const preview = await readTransfer(code);
  if (!preview || (preview.kind === 'file' && preview.status === 'pending')) {
    return { record: preview, ttl: 0 };
  }
  const ttl = await redis.ttl(transferKey(code));
  const raw = await redis.getDel(transferKey(code));
  return { record: parseTransferRecord(raw), ttl };
}

export async function restoreTransfer(code: string, record: TransferRecord, ttl: number) {
  if (ttl <= 0) return;
  const redis = await getRedis();
  await redis.set(transferKey(code), JSON.stringify(record), {
    expiration: { type: 'EX', value: ttl },
    condition: 'NX',
  });
}

export async function enforceRateLimit(request: Request, bucket: 'create' | 'claim') {
  const redis = await getRedis();
  const address = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const key = `mono:transfer:rate:${bucket}:${hash(address).slice(0, 16)}:${Math.floor(Date.now() / 60_000)}`;
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, 60);
  if (count > (bucket === 'create' ? 10 : 30)) throw new Error('Too many transfer requests. Try again shortly.');
}

export async function cleanupExpiredFiles() {
  const options = getBlobOptions();
  const cutoff = Date.now() - TRANSFER_TTL_SECONDS * 1000;
  let cursor: string | undefined;
  let deleted = 0;
  do {
    const page = await list({ ...options, prefix: 'transfers/', cursor, limit: 1000 });
    const expired = page.blobs.filter((blob) => blob.uploadedAt.getTime() < cutoff).map((blob) => blob.pathname);
    if (expired.length) {
      await del(expired, options);
      deleted += expired.length;
    }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return deleted;
}

function parseTransferRecord(raw: string | null): TransferRecord | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as TransferRecord;
    if (value.kind === 'text' && typeof value.text === 'string') return value;
    if (
      value.kind === 'file' &&
      (value.status === 'pending' || value.status === 'ready') &&
      typeof value.name === 'string' &&
      typeof value.pathname === 'string'
    ) return value;
  } catch {}
  return null;
}
