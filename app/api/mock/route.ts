import { decodeMockConfig, encodeMockConfig, MOCK_TTL_SECONDS, type MockConfig } from '@/lib/mock-api';
import { createStoredMock, enforceMockRateLimit } from '@/lib/mock-api-store';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    await enforceMockRateLimit(request);
    const config = decodeMockConfig(encodeMockConfig(await request.json() as MockConfig));
    return Response.json({ id: await createStoredMock(config), expiresInHours: MOCK_TTL_SECONDS / 3_600 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not create endpoint.';
    const status = message.startsWith('Too many') ? 429 : message.includes('100 KB') ? 413 : message.startsWith('Invalid') ? 400 : 500;
    return Response.json({ error: status === 500 ? 'Could not create endpoint.' : message }, { status });
  }
}
