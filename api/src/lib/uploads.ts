import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';

/**
 * Product images uploaded by an admin.
 *
 * Stored outside the frontend's src/assets so an upload can never overwrite a
 * bundled asset, and served by /api/assets/[...path] under an "uploads/"
 * prefix. Names are generated rather than taken from the client, so a crafted
 * filename cannot escape the directory or collide.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
export const UPLOAD_ROOT = path.resolve(here, '../../../../../data/uploads');

const EXTENSIONS: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/webp': '.webp',
  'image/avif': '.avif',
  'image/svg+xml': '.svg',
};

/** 5 MB. Large enough for a product photo, small enough to refuse a payload dump. */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export type StoredImage = { filename: string; url: string };

/**
 * Accepts either a data URL from the admin form or a base64 payload, writes it
 * under uploads/, and returns the name to store on the product row.
 */
export async function storeProductImage(dataUrl: string): Promise<StoredImage> {
  const match = /^data:([\w/+.-]+);base64,(.+)$/s.exec(dataUrl.trim());
  if (!match) throw new Error('Image must be a base64 data URL.');

  const [, mime, base64] = match;
  const extension = EXTENSIONS[mime.toLowerCase()];
  if (!extension) {
    throw new Error(`Unsupported image type "${mime}". Use PNG, JPEG, WebP, AVIF or SVG.`);
  }

  const buffer = Buffer.from(base64, 'base64');
  if (buffer.length === 0) throw new Error('Image is empty.');
  if (buffer.length > MAX_UPLOAD_BYTES) {
    throw new Error(`Image is ${Math.round(buffer.length / 1024 / 1024)} MB. The limit is 5 MB.`);
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
