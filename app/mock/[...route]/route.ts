import { decodeMockConfig, type MockMethod } from '@/lib/mock-api';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
  'Cache-Control': 'no-store',
};

function handle(request: Request, method: MockMethod) {
  const encoded = new URL(request.url).searchParams.get('config');
  if (!encoded) {
    return Response.json(
      { error: 'Missing mock configuration. Create an endpoint with the Mock API tool.' },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  try {
    const { status, body } = decodeMockConfig(encoded).responses[method];
    if (status === 204 || status === 205 || status === 304) {
      return new Response(null, { status, headers: CORS_HEADERS });
    }
    return Response.json(body, { status, headers: CORS_HEADERS });
  } catch {
    return Response.json(
      { error: 'Invalid mock configuration.' },
      { status: 400, headers: CORS_HEADERS }
    );
  }
}

export function GET(request: Request) {
  return handle(request, 'GET');
}

export function POST(request: Request) {
  return handle(request, 'POST');
}

export function PATCH(request: Request) {
  return handle(request, 'PATCH');
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
