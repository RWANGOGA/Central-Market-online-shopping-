import { beforeEach, describe, expect, it, vi } from 'vitest';

const { findSession, findCustomer, deleteWhere } = vi.hoisted(() => ({
  findSession: vi.fn(),
  findCustomer: vi.fn(),
  deleteWhere: vi.fn(),
}));

vi.mock('@/db', () => ({
  db: {
    query: {
      customerSessions: { findFirst: findSession },
      customers: { findFirst: findCustomer },
    },
    delete: () => ({ where: deleteWhere }),
  },
}));

import { getCurrentCustomer } from './customerSession';

describe('customer session validity', () => {
  beforeEach(() => {
    findSession.mockReset();
    findCustomer.mockReset();
    deleteWhere.mockReset().mockResolvedValue(undefined);
  });

  it('does not return an inactive customer from a valid session', async () => {
    findSession.mockResolvedValue({ id: 1, customerId: 22, expiresAt: new Date(Date.now() + 60_000).toISOString() });
    findCustomer.mockResolvedValue(null);
    const request = new Request('http://localhost/api/customers/me', {
      headers: { cookie: 'mk_customer_session=valid-token' },
    });

    await expect(getCurrentCustomer(request)).resolves.toBeNull();
    expect(findCustomer).toHaveBeenCalledOnce();
  });

  it('ignores malformed cookie encoding without throwing', async () => {
    const request = new Request('http://localhost/api/customers/me', {
      headers: { cookie: 'mk_customer_session=%E0%A4%A' },
    });

    await expect(getCurrentCustomer(request)).resolves.toBeNull();
    expect(findSession).not.toHaveBeenCalled();
  });
});
