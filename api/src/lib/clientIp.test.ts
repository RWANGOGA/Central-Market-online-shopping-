import { afterEach, describe, expect, it } from 'vitest';
import { getClientIp } from './clientIp';

afterEach(() => {
  delete process.env.TRUST_PROXY;
});

describe('trusted proxy client IP handling', () => {
  it('uses only the first forwarded hop when explicitly behind a trusted proxy', () => {
    process.env.TRUST_PROXY = 'true';
    const request = new Request('http://localhost', {
      headers: { 'x-forwarded-for': '198.51.100.2, 10.0.0.4' },
    });
    expect(getClientIp(request)).toBe('198.51.100.2');
  });

  it('ignores forwarded headers when proxy trust is not enabled', () => {
    const request = new Request('http://localhost', {
      headers: { 'x-forwarded-for': '198.51.100.2' },
    });
    expect(getClientIp(request)).toBeNull();
  });
});
