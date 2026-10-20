import { describe, expect, it } from 'vitest';
import type { Payment } from '@/db/schema';
import { approvalInstructions, detectMobileMoneyProvider, toPaymentDto } from './payments';

const stored: Payment = {
  id: 7,
  reference: 'PAY-ABC123',
  orderId: 3,
  cartId: 2,
  channel: 'mobile_money',
  provider: 'mtn_momo',
  status: 'awaiting_approval',
  amount: 25_000,
  currency: 'UGX',
  payerName: 'Allen Nakato',
  payerPhone: '0772123456',
  walletId: null,
  providerRef: 'mtn_momo-deadbeef',
  maskedCard: null,
  settlementTokenHash: 'f'.repeat(64),
  failureReason: null,
  createdAt: '2026-10-20 10:00:00',
  updatedAt: '2026-10-20 10:00:00',
};

describe('payment DTO', () => {
  it('strips instrument and settlement secrets from customer-facing payloads', () => {
    const dto = toPaymentDto(stored);
    const keys = Object.keys(dto);

    expect(keys.sort()).toEqual(
      ['amount', 'channel', 'currency', 'failureReason', 'maskedCard', 'provider', 'reference', 'status'].sort(),
    );
    for (const secret of ['payerPhone', 'walletId', 'providerRef', 'settlementTokenHash', 'payerName']) {
      expect(dto).not.toHaveProperty(secret);
    }
  });

  it('only advertises mobile money providers for prefixes that match the network', () => {
    expect(detectMobileMoneyProvider('0772 123 456')).toBe('mtn_momo');
    expect(detectMobileMoneyProvider('+256701234567')).toBe('airtel_money');
    expect(detectMobileMoneyProvider('0200123456')).toBeNull();
  });

  it('gives mobile money the USSD instructions the customer needs', () => {
    expect(approvalInstructions('mobile_money', 'mtn_momo')).toMatchObject({ ussd: '*165#' });
    expect(approvalInstructions('cod', 'cod')).toMatchObject({ ussd: null });
  });
});
