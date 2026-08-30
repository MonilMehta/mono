import { createHash, randomInt } from 'node:crypto';
import { createMockId, decodeMockConfig, encodeMockConfig, isValidMockId, MOCK_TTL_SECONDS, type MockConfig } from '@/lib/mock-api';
import { getRedis } from '@/lib/transfer';

const MOCK_KEY_PREFIX = 'mono:mock:';
const MAX_CONFIG_BYTES = 100 * 1024;

export async function createStoredMock(config: MockConfig) {
  const serialized = JSON.stringify(config);
  if (Buffer.byteLength(serialized, 'utf8') > MAX_CONFIG_BYTES) throw new Error('Mock configurations are limited to 100 KB.');
  const encoded = encodeMockConfig(config);

  const redis = await getRedis();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const id = createMockId(randomInt);
    const result = await redis.set(`${MOCK_KEY_PREFIX}${id}`, encoded, {
      expiration: { type: 'EX', value: MOCK_TTL_SECONDS },
      condition: 'NX',
    });
    if (result === 'OK') return id;
  }
  throw new Error('Could not create a short endpoint.');
}

export async function getStoredMock(id: string) {
  if (!isValidMockId(id)) return null;
  const encoded = await (await getRedis()).get(`${MOCK_KEY_PREFIX}${id}`);
  return encoded ? decodeMockConfig(encoded) : null;
}

export async function enforceMockRateLimit(request: Request) {
  const redis = await getRedis();
  const address = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const digest = createHash('sha256').update(address).digest('hex').slice(0, 16);
  const key = `mono:mock:rate:${digest}:${Math.floor(Date.now() / 60_000)}`;
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, 60);
  if (count > 20) throw new Error('Too many endpoint requests. Try again shortly.');
}
