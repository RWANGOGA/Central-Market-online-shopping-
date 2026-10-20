import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCb) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

/**
 * Password hashing and session tokens for admin accounts.
 *
 * scrypt from node:crypto rather than bcrypt or argon2, because it needs no
 * native module and so cannot break the install on a new machine. The cost
 * parameters are recorded inside the hash, which means they can be raised later
 * without invalidating passwords that already exist.
 */
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;
// N=16384, r=8, p=1 is Node's default interactive-login strength.
const COST = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

/** Encoded as "scrypt$N$r$p$saltHex$hashHex" so cost travels with the hash. */
export async function hashPassword(password: string): Promise<string> {
  if (password.length < 10) {
    throw new Error('Use a password of at least 10 characters.');
  }

  const salt = randomBytes(SALT_LENGTH);
  const derived = await scrypt(password, salt, KEY_LENGTH, COST);

  return ['scrypt', COST.N, COST.r, COST.p, salt.toString('hex'), derived.toString('hex')].join('$');
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;

  const [, n, r, p, saltHex, hashHex] = parts;
  const salt = Buffer.from(saltHex, 'hex');
  const expected = Buffer.from(hashHex, 'hex');
  if (salt.length === 0 || expected.length === 0) return false;

  let derived: Buffer;
  try {
    derived = await scrypt(password, salt, expected.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
      maxmem: COST.maxmem,
    });
  } catch {
    // A hash written with different cost parameters cannot be verified.
    return false;
  }

  // Constant-time, so a wrong password cannot be discovered by timing.
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

/**
 * Opaque session token: 256 bits from the CSPRNG. Only the hash is stored, so
 * a database leak cannot be replayed as a live session.
 */
export function createSessionToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, tokenHash: hashToken(token) };
}

/** Plain SHA-256 is right here: the input is already 256 bits of entropy. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
