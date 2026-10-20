import { describe, expect, it, vi } from 'vitest';

const { requireCart } = vi.hoisted(() => ({ requireCart: vi.fn() }));
vi.mock('@/lib/cartOwnership', () => ({ requireCart }));
vi.mock('@/lib/cart', () => ({ loadCart: vi.fn() }));
vi.mock('@/db', () => ({ db: {} }));

import { GET, PATCH } from './route';

describe('cart ownership and checkout freeze', () => {
  it('returns 404 when a cart does not belong to this cookie', async () => {
    requireCart.mockResolvedValue(null);
    const response = await GET(new Request('http://localhost/api/cart?cartId=4'));

    expect(response.status).toBe(404);
  });

  it('does not permit cart changes after checkout has started', async () => {
    requireCart.mockResolvedValue({ id: 4, status: 'checkout' });
    const response = await PATCH(new Request('http://localhost/api/cart', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ cartId: 4, productId: 2, quantity: 1 }),
    }));

    expect(response.status).toBe(409);
  });
});
