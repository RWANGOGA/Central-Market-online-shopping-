import { describe, expect, it, vi } from 'vitest';

const { findPayment, findOrder } = vi.hoisted(() => ({ findPayment: vi.fn(), findOrder: vi.fn() }));
const { requireAdmin } = vi.hoisted(() => ({ requireAdmin: vi.fn() }));
const { requireCart } = vi.hoisted(() => ({ requireCart: vi.fn() }));
const { ownsOrder } = vi.hoisted(() => ({ ownsOrder: vi.fn() }));

vi.mock('@/db', () => ({ db: { query: { payments: { findFirst: findPayment }, orders: { findFirst: findOrder } } } }));
vi.mock('@/lib/catalogue', () => ({ requireAdmin }));
vi.mock('@/lib/cartOwnership', () => ({ requireCart }));
vi.mock('@/lib/orderOwnership', () => ({ ownsOrder }));

import { GET } from './[reference]/route';

const payment = {
  id: 99,
  reference: 'PAY-ABCDEF1234',
  status: 'awaiting_approval',
  amount: 22000,
  currency: 'UGX',
  channel: 'mobile_money',
  provider: 'mtn',
  payerPhone: '0772000000',
  walletId: 'wallet-secret',
  providerRef: 'provider-secret',
  settlementTokenHash: 'settlement-secret',
  cartId: 3,
  orderId: null,
};

describe('payment intent access and DTO', () => {
  it('returns 404 when the caller does not own the related cart or order', async () => {
    findPayment.mockResolvedValue(payment);
    requireAdmin.mockResolvedValue(null);
    requireCart.mockResolvedValue(null);

    const response = await GET(new Request('http://localhost/api/payments/intents/PAY-ABCDEF1234'), {
      params: Promise.resolve({ reference: payment.reference }),
    });
    expect(response.status).toBe(404);
  });

  it('returns only public payment status fields to the cart owner', async () => {
    findPayment.mockResolvedValue(payment);
    requireAdmin.mockResolvedValue(null);
    requireCart.mockResolvedValue({ id: 3, status: 'active' });

    const response = await GET(new Request('http://localhost/api/payments/intents/PAY-ABCDEF1234', {
      headers: { cookie: 'mk_cart=valid-token' },
    }), { params: Promise.resolve({ reference: payment.reference }) });
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).toContain('PAY-ABCDEF1234');
    expect(body).not.toContain('payerPhone');
    expect(body).not.toContain('0772000000');
    expect(body).not.toContain('wallet-secret');
    expect(body).not.toContain('provider-secret');
    expect(body).not.toContain('settlement-secret');
  });
});
