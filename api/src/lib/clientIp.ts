/**
 * Only trust proxy headers when the app is reachable exclusively through our
 * reverse proxy and TRUST_PROXY is explicitly enabled in the deployment.
 */
export function getClientIp(request: Request): string | null {
  if (process.env.TRUST_PROXY !== 'true') return null;
  const forwarded = request.headers.get('x-forwarded-for');
  const firstHop = forwarded?.split(',')[0]?.trim();
  if (firstHop && firstHop.length <= 64) return firstHop;
  const realIp = request.headers.get('x-real-ip')?.trim();
  return realIp && realIp.length <= 64 ? realIp : null;
}
