import { scrypt as scryptCallback } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { findCustomer, updateSet, insertValues, deleteWhere } = vi.hoisted(() => ({
  findCustomer: vi.fn(),
  updateSet: vi.fn(),
  insertValues: vi.fn(),
  deleteWhere: vi.fn(),
}));

vi.mock('@/db', () => ({
  db: {
    query: { customers: { findFirst: findCustomer } },
    update: () => ({ set: updateSet }),
    insert: () => ({ values: insertValues }),
    delete: () => ({ where: deleteWhere }),
  },
}));
vi.mock('@/lib/rateLimit', () => ({ allow: vi.fn(async () => true) }));
vi.mock('@/lib/clientIp', () => ({ getClientIp: () => null }));

import { POST } from './login/route';

function legacyHash(password: string): Promise<string> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, Buffer.alloc(16), 64, (err, derived) => {
      if (err) reject(err);
      else resolve(derived.toString('hex'));
    });
  });
}

describe('customer login security', () => {
  beforeEach(() => {
    findCustomer.mockReset();
    updateSet.mockReset().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
    insertValues.mockReset().mockResolvedValue(undefined);
    deleteWhere.mockReset().mockResolvedValue(undefined);
  });

  it('upgrades a successfully verified legacy password and only returns a customer DTO', async () => {
    const oldHash = await legacyHash('legacyCustomerPassword');
    findCustomer.mockResolvedValue({
      id: 12,
      fullName: 'Amina Nabirye',
      phone: '0772123456',
      email: null,
      passwordHash: oldHash,
      region: 'Central',
      district: null,
      subCounty: null,
      parish: null,
      village: null,
      address: 'Market Street',
      active: true,
      createdAt: '2026-01-01 00:00:00',
    });

    const response = await POST(new Request('http://localhost/api/customers/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ phone: '0772123456', password: 'legacyCustomerPassword' }),
    }));
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(updateSet).toHaveBeenCalledOnce();
    expect(updateSet.mock.calls[0][0].passwordHash).toMatch(/^scrypt\$/);
    expect(updateSet.mock.calls[0][0].passwordHash).not.toBe(oldHash);
    expect(body).not.toContain('passwordHash');
    expect(body).not.toContain(oldHash);
  });
});
