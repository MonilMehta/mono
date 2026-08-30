import { head } from '@vercel/blob';
import { authorizeFileUpload, completeFileTransfer, getBlobOptions } from '@/lib/transfer';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (typeof body?.code !== 'string' || typeof body.uploadSecret !== 'string' || typeof body.pathname !== 'string') {
      return Response.json({ error: 'Invalid upload completion.' }, { status: 400 });
    }
    await authorizeFileUpload(body.code, body.uploadSecret, body.pathname);
    await head(body.pathname, getBlobOptions());
    await completeFileTransfer(body.code, body.uploadSecret, body.pathname);
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Could not finish transfer.' },
      { status: 400 }
    );
  }
}
