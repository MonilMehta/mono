import { MAX_FILE_BYTES, MAX_TEXT_BYTES, createTextTransfer, enforceRateLimit, reserveFileTransfer } from '@/lib/transfer';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    await enforceRateLimit(request, 'create');
    const body = await request.json();

    if (body?.kind === 'text') {
      if (typeof body.text !== 'string' || !body.text.trim()) {
        return Response.json({ error: 'Enter some text to transfer.' }, { status: 400 });
      }
      if (Buffer.byteLength(body.text, 'utf8') > MAX_TEXT_BYTES) {
        return Response.json({ error: 'Text transfers are limited to 100 KB.' }, { status: 413 });
      }
      return Response.json({ code: await createTextTransfer(body.text) });
    }

    if (body?.kind === 'file') {
      if (typeof body.name !== 'string' || !Number.isSafeInteger(body.size) || body.size <= 0) {
        return Response.json({ error: 'Choose a valid file.' }, { status: 400 });
      }
      if (body.size > MAX_FILE_BYTES) {
        return Response.json({ error: 'Files are limited to 25 MB.' }, { status: 413 });
      }
      return Response.json(await reserveFileTransfer({
        name: body.name,
        size: body.size,
        contentType: typeof body.contentType === 'string' ? body.contentType : '',
      }));
    }

    return Response.json({ error: 'Unsupported transfer type.' }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not create transfer.';
    return Response.json({ error: message }, { status: message.startsWith('Too many') ? 429 : 500 });
  }
}
