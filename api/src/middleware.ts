import { NextResponse, type NextRequest } from 'next/server';

/**
 * Cross-cutting protections for the API.
 *
 * 1. CSRF: a mutating request whose Origin hostname differs from Host is
 *    rejected. SameSite=Strict cookies already block most of this; the check
 *    covers clients and browsers that still send the cookie.
 * 2. Baseline security headers on every response. Uploaded assets get a
 *    stricter policy in their own route.
 *
 * Gateway webhooks have no Origin header and are authenticated by their HMAC
 * signature instead, so they pass through here untouched.
 */

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
};

export function middleware(request: NextRequest) {
  if (MUTATING.has(request.method)) {
    const origin = request.headers.get('origin');
    const host = request.headers.get('host');

    if (origin && host) {
      let originHost: string | null = null;
      try {
        originHost = new URL(origin).hostname;
      } catch {
        originHost = null;
      }
      // Compare hostnames, not ports: the dev proxy forwards to a different
      // port than the page is served from.
      if (!originHost || originHost !== host.split(':')[0]) {
        return new NextResponse(JSON.stringify({ error: 'Origin must match Host' }), {
          status: 403,
          headers: { 'content-type': 'application/json', ...SECURITY_HEADERS },
        });
      }
    }
  }

  const response = NextResponse.next();
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(name, value);
  }
  return response;
}

export const config = {
  matcher: '/api/:path*',
};
