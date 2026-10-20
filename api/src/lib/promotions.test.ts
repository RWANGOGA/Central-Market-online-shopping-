import { describe, expect, it } from 'vitest';
import { evaluatePromo, normalizePromoCode, promoState, toStamp, type PromoRule } from './promoRules';

function promo(overrides: Partial<PromoRule> = {}): PromoRule {
  return {
    code: 'WELCOME10',
    kind: 'percent',
    value: 10,
    minSubtotal: 0,
    maxDiscount: null,
    active: true,
    startsAt: null,
    endsAt: null,
    usageLimit: null,
    usedCount: 0,
    perCustomerLimit: 1,
    ...overrides,
  };
}

describe('promo codes', () => {
  it('normalises casing and spacing and rejects impossible codes', () => {
    expect(normalizePromoCode(' welcome10 ')).toBe('WELCOME10');
    expect(normalizePromoCode('fresh 5000')).toBe('FRESH5000');
    expect(normalizePromoCode('no!')).toBeNull();
    expect(normalizePromoCode('ab')).toBeNull();
  });

  it('takes a percentage and caps it', () => {
    expect(evaluatePromo(promo({ maxDiscount: 5_000 }), 80_000)).toEqual({ discount: 5_000 });
    expect(evaluatePromo(promo(), 80_000)).toEqual({ discount: 8_000 });
  });

  it('takes a fixed amount without exceeding the basket', () => {
    expect(evaluatePromo(promo({ kind: 'fixed', value: 5_000 }), 30_000)).toEqual({ discount: 5_000 });
    expect(evaluatePromo(promo({ kind: 'fixed', value: 5_000 }), 3_000)).toEqual({ discount: 3_000 });
  });

  it('refuses paused, expired, scheduled and exhausted codes', () => {
    const now = new Date('2026-10-20T12:00:00Z');
    expect(evaluatePromo(promo({ active: false }), 50_000, now)).toEqual({ reason: 'This code is no longer available.' });
    expect(evaluatePromo(promo({ endsAt: '2026-10-19 00:00:00' }), 50_000, now)).toEqual({ reason: 'This code has expired.' });
    expect(evaluatePromo(promo({ startsAt: '2026-10-21 00:00:00' }), 50_000, now)).toEqual({ reason: 'This code is not active yet.' });
    expect(evaluatePromo(promo({ usageLimit: 5, usedCount: 5 }), 50_000, now)).toEqual({ reason: 'This code has been fully redeemed.' });
  });

  it('explains how much more is needed below the minimum', () => {
    expect(evaluatePromo(promo({ minSubtotal: 30_000 }), 12_000)).toEqual({
      reason: 'Add UGX 18,000 more to use this code.',
    });
  });

  it('reports a live state, and the reason it is not live', () => {
    const now = new Date('2026-10-20T12:00:00Z');
    expect(promoState(promo(), now)).toBe('live');
    expect(promoState(promo({ startsAt: '2026-10-21 00:00:00' }), now)).toBe('scheduled');
    expect(promoState(promo({ endsAt: '2026-10-19 00:00:00' }), now)).toBe('expired');
    expect(promoState(promo({ active: false }), now)).toBe('paused');
    expect(promoState(promo({ usageLimit: 2, usedCount: 2 }), now)).toBe('exhausted');
  });

  it('accepts dates and datetimes but nothing ambiguous', () => {
    expect(toStamp('2026-10-31')).toBe('2026-10-31 00:00:00');
    expect(toStamp('nonsense')).toBeNull();
    expect(toStamp('')).toBeNull();
  });
});
