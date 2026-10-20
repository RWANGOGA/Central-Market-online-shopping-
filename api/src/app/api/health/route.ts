import { db } from '@/db';
import { json } from '@/lib/http';

export async function GET() {
  try {
    await db.execute('SELECT 1' as any);
    return json({ status: 'ok' });
  } catch {
    return new Response(JSON.stringify({ status: 'error' }), { status: 503 });
  }
}
