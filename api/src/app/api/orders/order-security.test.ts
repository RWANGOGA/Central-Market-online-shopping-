import { describe, expect, it, vi } from 'vitest';

const { findOrder, select } = vi.hoisted(() => ({ findOrder: vi.fn(), select: vi.fn() }));
const { requireCart } = vi.hoisted(() => ({ requireCart: vi.fn() }));
const { getCurrentCustomer } = vi.hoisted(() => ({ getCurrentCustomer: vi.fn() }));
const { requireAdmin } = vi.hoisted(() => ({ requireAdmin: vi.fn() }));
const { ownsOrder } = vi.hoisted(() => ({ ownsOrder: vi.fn() }));

vi.mock('@/db', () => ({
  db: {
    query: { orders: { findFirst: findOrder } },
    select,
  },
}));
vi.mock('@/lib/cartOwnership', () => ({ requireCart }));
vi.mock('@/lib/customerSession', () => ({ getCurrentCustomer }));
vi.mock('@/lib/catalogue', () => ({ requireAdmin }));
vi.mock('@/lib/orderOwnership', () => ({ ownsOrder }));

import { POST } from './route';
import { GET } from './[id]/route';

const order = {
  id: 21,
  reference: 'GRC-1234567890',
  customerId: 9,
  trackingTokenHash: null,
  status: 'pending',
  createdAt: '2026-01-01 00:00:00',
};

describe('order access controls', () => {
  it('rejects an order request using another customer id without a session or guest address', async () => {
    requireCart.mockResolvedValue({ id: 4, status: 'active' });
    getCurrentCustomer.mockResolvedValue(null);

    const response = await POST(new Request('http://localhost/api/orders', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ cartId: 4, customerId: 9 }),
    }));

    expect(response.status).toBe(422);
  });

  it('returns 404 when a caller does not own the order', async () => {
    findOrder.mockResolvedValue(order);
    requireAdmin.mockResolvedValue(null);
    getCurrentCustomer.mockResolvedValue(null);
    ownsOrder.mockResolvedValue(false);

    const response = await GET(new Request('http://localhost/api/orders/21'), { params: Promise.resolve({ id: '21' }) });

    expect(response.status).toBe(404);
    expect(select).not.toHaveBeenCalled();
  });
});
