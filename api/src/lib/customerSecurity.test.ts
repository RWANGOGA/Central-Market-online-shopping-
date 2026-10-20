import { createHash, scrypt as scryptCallback } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { checkCustomerPassword, hashPassword, hashToken, isCommonPassword, readCustomerSessionToken } from './customerAuth';
import { verifyPassword } from './password';
import { toCustomerDto } from './customerDto';
import type { Customer } from '@/db/schema';

function legacyHash(password: string): Promise<string> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, Buffer.alloc(16), 64, (err, derived) => {
      if (err) reject(err);
      else resolve(derived.toString('hex'));
    });
  });
}

const customer = {
  id: 7,
  fullName: 'Amina Nabirye',
  phone: '0772123456',
  email: null,
  passwordHash: 'must-not-leak',
  region: 'Central',
  district: null,
  subCounty: null,
  parish: null,
  village: null,
  address: 'Market Street',
  active: true,
  createdAt: '2026-01-01 00:00:00',
} satisfies Customer;

describe('customer security helpers', () => {
  it('creates a unique salted hash for each customer with the same password', async () => {
    const first = await hashPassword('correctHorseBatteryStaple');
    const second = await hashPassword('correctHorseBatteryStaple');

    expect(first).not.toBe(second);
    expect(first.startsWith('scrypt$')).toBe(true);
    expect(await verifyPassword('correctHorseBatteryStaple', first)).toBe(true);
  });

  it('upgrades a valid legacy fixed-salt customer hash after login', async () => {
    const oldHash = await legacyHash('migrateThisPassword');
    const result = await checkCustomerPassword('migrateThisPassword', oldHash);

    expect(result.ok).toBe(true);
    expect(result.upgrade).toMatch(/^scrypt\$/);
    expect(result.upgrade).not.toBe(oldHash);
    expect(await verifyPassword('migrateThisPassword', result.upgrade!)).toBe(true);
  });

  it('does not treat an empty password hash as a login credential', async () => {
    await expect(checkCustomerPassword('anything', '')).resolves.toEqual({ ok: false, upgrade: null });
  });

  it('hashes opaque customer session tokens with plain SHA-256', () => {
    const token = 'high-entropy-session-token';
    expect(hashToken(token)).toBe(createHash('sha256').update(token).digest('hex'));
  });

  it('flags common base passwords and predictable suffixes', () => {
    expect(isCommonPassword('password')).toBe(true);
    expect(isCommonPassword('Password123')).toBe(true);
    expect(isCommonPassword('a unique phrase that is not common')).toBe(false);
  });

  it('parses only the customer session cookie and tolerates malformed encoding', () => {
    expect(readCustomerSessionToken('other=x; mk_customer_session=abc%2Fdef; next=y')).toBe('abc/def');
    expect(readCustomerSessionToken('mk_customer_session=%E0%A4%A')).toBeNull();
    expect(readCustomerSessionToken('not_mk_customer_session=wrong')).toBeNull();
  });

  it('serializes customer data without its password hash', () => {
    const dto = toCustomerDto(customer);

    expect(dto).toEqual({
      id: 7,
      fullName: 'Amina Nabirye',
      phone: '0772123456',
      email: null,
      region: 'Central',
      district: null,
      subCounty: null,
      parish: null,
      village: null,
      address: 'Market Street',
    });
    expect(JSON.stringify(dto)).not.toContain('passwordHash');
    expect(JSON.stringify(dto)).not.toContain('must-not-leak');
  });
});
