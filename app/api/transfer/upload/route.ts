import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { authorizeFileUpload, getBlobOptions } from '@/lib/transfer';

export const runtime = 'nodejs';

type UploadPayload = { code: string; uploadSecret: string };

function parsePayload(value: string | null): UploadPayload {
  if (!value) throw new Error('Missing upload credentials.');
  const payload = JSON.parse(value) as UploadPayload;
  if (typeof payload.code !== 'string' || typeof payload.uploadSecret !== 'string') {
    throw new Error('Invalid upload credentials.');
  }
  return payload;
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as HandleUploadBody;
    const response = await handleUpload({
      request,
      body,
      token: getBlobOptions().token,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const payload = parsePayload(clientPayload);
        const record = await authorizeFileUpload(payload.code, payload.uploadSecret, pathname);
        if (record.status !== 'pending') throw new Error('This upload is already complete.');
        return {
          allowedContentTypes: [record.contentType],
          maximumSizeInBytes: record.size,
          addRandomSuffix: false,
          allowOverwrite: false,
        };
      },
    });
    return Response.json(response);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Upload failed.' },
      { status: 400 }
    );
  }
}
