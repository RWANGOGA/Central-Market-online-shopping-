import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { UPLOAD_ROOT } from '@/lib/uploads';

const ALLOWED_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.avif']);

/**
 * Serves product imagery from two places:
 *
 *   uploads/<file>   images an admin added through the catalogue editor
 *   <file>           the frontend's bundled src/assets, so there is a single
 *                    copy rather than a duplicate inside the API
 *
 * Uploads are checked first. Both roots are resolved and then prefix-checked,
 * so neither a "uploads/../" segment nor an absolute path can escape them.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path: segments } = await params;

  if (segments.length === 0 || segments.some((segment) => segment === '' || segment === '.')) {
    return new Response('Not found', { status: 404 });
  }

  const relative = segments.join('/');
  const requested = relative.startsWith('uploads/')
    ? path.resolve(UPLOAD_ROOT, relative.slice('uploads/'.length))
    : null;

  const bundledRoot = path.resolve(process.cwd(), '..', 'src', 'assets');
  const bundled = requested === null ? path.resolve(bundledRoot, relative) : null;

  const extension = path.extname(relative).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(extension)) {
    return new Response('Unsupported media type', { status: 415 });
  }

  const candidates: { file: string; root: string }[] = [];
  if (requested !== null) candidates.push({ file: requested, root: UPLOAD_ROOT });
  if (bundled !== null) candidates.push({ file: bundled, root: bundledRoot });

  for (const candidate of candidates) {
    if (!candidate.file.startsWith(candidate.root + path.sep)) continue;

    let fileStat: Awaited<ReturnType<typeof stat>>;
    try {
      fileStat = await stat(candidate.file);
    } catch {
      continue;
    }

    if (!fileStat.isFile()) continue;

    const stream = Readable.toWeb(createReadStream(candidate.file)) as ReadableStream;

    return new Response(stream, {
      headers: {
        'content-type': mimeFor(extension),
        'content-length': String(fileStat.size),
        // Uploaded names carry a timestamp, so a replaced image is a new URL
        // and the cached copy cannot go stale.
        'cache-control': 'public, max-age=31536000, immutable',
        // The file is data, never a document: no script, no framing, and no
        // MIME sniffing that could reinterpret it.
        'x-content-type-options': 'nosniff',
        'content-security-policy': "default-src 'none'; sandbox",
      },
    });
  }

  return new Response('Not found', { status: 404 });
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
    case '.avif':
      return 'image/avif';
    default:
      return 'application/octet-stream';
  }
}
