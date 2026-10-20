import { scrypt, randomBytes, createHmac } from 'node:crypto';

const SCRYPT_N = 16384;
const SCRYPT_r = 8;
const SCRYPT_p = 1;
const SESSION_HOURS = 24 * 7;

function hmacSha256(key: string, data: string): string {
  return createHmac('sha256', key).update(data).digest('hex');
}

export function createSessionToken(): { token: string; tokenHash: string } {
  const token = randomBytes(48).toString('base64url');
  const tokenHash = hashToken(token);
  return { token, tokenHash };
}

export function hashToken(token: string): string {
  const secret = process.env.CUSTOMER_SESSION_SECRET || 'mk-customer-session-secret-change-in-production';
  return hmacSha256(secret, token);
}

export async function hashPassword(password: string): Promise<string> {
  return new Promise((resolve, reject) => {
    scrypt(password, Buffer.alloc(16), 64, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey.toString('hex'));
    });
  });
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    scrypt(password, Buffer.alloc(16), 64, (err, derivedKey) => {
      if (err) return reject(err);
      resolve(derivedKey.toString('hex') === hash);
    });
  });
}

export function sessionCookie(token: string, expiresAt: string): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `mk_customer_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Expires=${new Date(expiresAt).toUTCString()}${secure}`;
}

export function clearedCookie(): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `mk_customer_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`;
}

export function getSessionExpiry(): string {
  return new Date(Date.now() + SESSION_HOURS * 3600_000).toISOString();
}
