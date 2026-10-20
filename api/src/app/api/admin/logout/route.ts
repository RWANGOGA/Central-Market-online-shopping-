import { clearedCookie, logout } from '@/lib/adminAuth';
import { json } from '@/lib/http';

export async function POST(request: Request) {
  await logout(request);
  return json({ data: { signedOut: true } }, { headers: { 'set-cookie': clearedCookie() } });
}
