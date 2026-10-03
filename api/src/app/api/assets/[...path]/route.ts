import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';

const ALLOWED_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.svg', '.avif']);

/**
 * Serves product imagery straight out of the frontend's src/assets folder so
 * there is a single source of truth and no 37MB copy inside the API.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path: segments } = await params;

  const assetRoot = path.resolve(process.cwd(), '..', 'src', 'assets');
  const requested = path.resolve(assetRoot, segments.join('/'));

  if (!requested.startsWith(assetRoot + path.sep)) {
    return new Response('Forbidden', { status: 403 });
  }

  const extension = path.extname(requested).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(extension)) {
    return new Response('Unsupported media type', { status: 415 });
  }

  let fileStat: Awaited<ReturnType<typeof stat>>;
  try {
    fileStat = await stat(requested);
  } catch {
    return new Response('Not found', { status: 404 });
  }

  if (!fileStat.isFile()) return new Response('Not found', { status: 404 });

  const stream = Readable.toWeb(createReadStream(requested)) as ReadableStream;

  return new Response(stream, {
    headers: {
      'content-type': mimeFor(extension),
      'content-length': String(fileStat.size),
      'cache-control': 'public, max-age=31536000, immutable',
    },
  });
}

function mimeFor(extension: string) {
  switch (extension) {
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.webp':
      return 'image/webp';
    case '.svg':
      return 'image/svg+xml';
    case '.avif':
      return 'image/avif';
    default:
      return 'application/octet-stream';
  }
}