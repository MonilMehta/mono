import { after } from 'next/server';
import { del, get } from '@vercel/blob';
import {
  claimTransfer,
  enforceRateLimit,
  getBlobOptions,
  isValidTransferCode,
  normalizeTransferCode,
  restoreTransfer,
} from '@/lib/transfer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    await enforceRateLimit(request, 'claim');
    const code = normalizeTransferCode((await params).code);
    if (!isValidTransferCode(code)) {
      return Response.json({ error: 'Enter a valid 8-character code.' }, { status: 400 });
    }

    const { record, ttl } = await claimTransfer(code);
    if (!record) return Response.json({ error: 'Code not found or already used.' }, { status: 404 });
    if (record.kind === 'file' && record.status === 'pending') {
      return Response.json({ error: 'The file is still uploading. Try again in a moment.' }, { status: 409 });
    }
    if (record.kind === 'text') {
      return new Response(record.text, {
        headers: { 'Cache-Control': 'no-store', 'Content-Type': 'text/plain; charset=utf-8', 'X-Transfer-Kind': 'text' },
      });
    }

    try {
      const result = await get(record.pathname, { ...getBlobOptions(), useCache: false });
      if (!result || result.statusCode !== 200) throw new Error('Stored file was not found.');
      const encodedName = encodeURIComponent(record.name).replace(/'/g, '%27');
      after(() => del(record.pathname, getBlobOptions()));
      return new Response(result.stream, {
        headers: {
          'Cache-Control': 'private, no-store',
          'Content-Disposition': `attachment; filename*=UTF-8''${encodedName}`,
          'Content-Length': String(result.blob.size),
          'Content-Type': result.blob.contentType,
          'X-Content-Type-Options': 'nosniff',
          'X-Transfer-Filename': encodedName,
          'X-Transfer-Kind': 'file',
        },
      });
    } catch (error) {
      await restoreTransfer(code, record, ttl);
      throw error;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not receive transfer.';
    return Response.json({ error: message }, { status: message.startsWith('Too many') ? 429 : 500 });
  }
}
