import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { env } from '@/lib/env';

/**
 * Product images uploaded by an admin.
 *
 * Stored outside the frontend's src/assets so an upload can never overwrite a
 * bundled asset, and served by /api/assets/[...path] under an "uploads/"
 * prefix. Names are generated rather than taken from the client, so a crafted
 * filename cannot escape the directory or collide.
 *
 * The declared MIME type is not trusted: the bytes are checked against the
 * signatures of the formats we accept. SVG is deliberately not accepted,
 * because an SVG is a document that can carry script and would be served from
 * our own origin.
 */

export const UPLOAD_ROOT = path.resolve(env.UPLOAD_DIR);

const EXTENSIONS: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/webp': '.webp',
  'image/avif': '.avif',
};

/** 5 MB. Large enough for a product photo, small enough to refuse a payload dump. */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export type StoredImage = { filename: string; url: string };

/** Recognise a supported image from its leading bytes. */
function detectedType(buffer: Buffer): string | null {
  if (buffer.length >= 8 &&
      buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47 &&
      buffer[4] === 0x0d && buffer[5] === 0x0a && buffer[6] === 0x1a && buffer[7] === 0x0a) {
    return 'image/png';
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  if (buffer.length >= 12 &&
      buffer.toString('ascii', 0, 4) === 'RIFF' &&
      buffer.toString('ascii', 8, 12) === 'WEBP') {
    return 'image/webp';
  }
  if (buffer.length >= 12 &&
      buffer.toString('ascii', 4, 8) === 'ftyp' &&
      ['avif', 'avis'].includes(buffer.toString('ascii', 8, 12))) {
    return 'image/avif';
  }
  return null;
}

/**
 * Accepts either a data URL from the admin form or a base64 payload, writes it
 * under uploads/, and returns the name to store on the product row.
 */
export async function storeProductImage(dataUrl: string): Promise<StoredImage> {
  const match = /^data:([\w/+.-]+);base64,(.+)$/s.exec(dataUrl.trim());
  if (!match) throw new Error('Image must be a base64 data URL.');

  const [, mime, base64] = match;
  const declared = mime.toLowerCase();
  const extension = EXTENSIONS[declared];
  if (!extension) {
    throw new Error(`Unsupported image type "${mime}". Use PNG, JPEG, WebP or AVIF.`);
  }

  const buffer = Buffer.from(base64, 'base64');
  if (buffer.length === 0) throw new Error('Image is empty.');
  if (buffer.length > MAX_UPLOAD_BYTES) {
    throw new Error(`Image is ${Math.round(buffer.length / 1024 / 1024)} MB. The limit is 5 MB.`);
  }

  const actual = detectedType(buffer);
  if (actual === null || actual !== declared) {
    throw new Error('The file content does not match the declared image type.');
  }

  fs.mkdirSync(UPLOAD_ROOT, { recursive: true });

  // Generated name: a client-supplied name could contain a path.
  const filename = `product-${Date.now().toString(36)}-${randomBytes(6).toString('hex')}${extension}`;
  fs.writeFileSync(path.join(UPLOAD_ROOT, filename), buffer);

  return { filename, url: `/api/assets/uploads/${filename}` };
}

/** True when a stored filename lives in the uploads directory. */
export function isUpload(filename: string): boolean {
  return filename.startsWith('uploads/');
}
