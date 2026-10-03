import { authenticate } from '@/lib/adminAuth';
import { error, json } from '@/lib/http';

export async function GET(request: Request) {
  const admin = await authenticate(request);
  if (!admin) return error('Not signed in', 401);
  return json({ data: admin });
}
