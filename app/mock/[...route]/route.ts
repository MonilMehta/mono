import { type MockMethod } from '@/lib/mock-api';
import { getStoredMock } from '@/lib/mock-api-store';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
  'Cache-Control': 'no-store',
};

async function handle(request: Request, method: MockMethod) {
  const id = new URL(request.url).searchParams.get('id')?.toUpperCase();
  if (!id) {
    return Response.json(
      { error: 'Missing mock endpoint ID.' },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  try {
    const config = await getStoredMock(id);
    if (!config) {
      return Response.json({ error: 'Mock endpoint not found or expired.' }, { status: 404, headers: CORS_HEADERS });
    }
    const { status, body } = config.responses[method];
    if (status === 204 || status === 205 || status === 304) {
      return new Response(null, { status, headers: CORS_HEADERS });
    }
    return Response.json(body, { status, headers: CORS_HEADERS });
  } catch {
    return Response.json(
      { error: 'Mock endpoint is temporarily unavailable.' },
      { status: 503, headers: CORS_HEADERS }
    );
  }
}

export async function GET(request: Request) {
  return handle(request, 'GET');
}

export async function POST(request: Request) {
  return handle(request, 'POST');
}

export async function PATCH(request: Request) {
  return handle(request, 'PATCH');
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
