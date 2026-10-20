import { error } from './http';

/** Reject mutating requests whose Origin host differs from Host (CSRF). */
export function csrfCheck(request: Request): Response | null {
  const method = request.method;
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return null;
  const origin = request.headers.get('origin');
  const host = request.headers.get('host');
  if (!origin || !host) return null;
  try {
    const o = new URL(origin);
    if (o.host !== host) return error('Origin must match Host', 403);
  } catch {
    return error('Invalid Origin', 403);
  }
  return null;
}

/** Baseline security headers applied by routes or a gateway/proxy. */
export const securityHeaders: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Content-Security-Policy': "default-src 'self'; frame-ancestors 'none'",
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
};
