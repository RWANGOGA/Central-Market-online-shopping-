import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { customerSessions, customers } from '@/db/schema';
import { json } from '@/lib/http';
import { hashToken } from '@/lib/customerAuth';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const cookie = request.headers.get('cookie') || '';
  const match = cookie.match(/mk_customer_session=([^;]+)/);

  if (match) {
    const token = decodeURIComponent(match[1]);
    const tokenHash = hashToken(token);
    await db.delete(customerSessions).where(eq(customerSessions.tokenHash, tokenHash));
  }

  return json(
    { data: { message: 'Signed out' } },
    { headers: { 'Set-Cookie': 'mk_customer_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0' } }
  );
}

export async function GET(request: Request) {
  const token = extractToken(request);
  if (!token) return json({ data: null });

  const tokenHash = hashToken(token);
  const session = await db.query.customerSessions.findFirst({
    where: eq(customerSessions.tokenHash, tokenHash),
  });

  if (!session || new Date(session.expiresAt) < new Date()) {
    return json({ data: null });
  }

  const customer = await db.query.customers.findFirst({
    where: eq(customers.id, session.customerId),
  });

  if (!customer) return json({ data: null });

  return json({
    data: {
      id: customer.id,
      fullName: customer.fullName,
      phone: customer.phone,
      email: customer.email,
      region: customer.region,
      district: customer.district,
      subCounty: customer.subCounty,
      parish: customer.parish,
      village: customer.village,
      address: customer.address,
      createdAt: customer.createdAt,
    },
  });
}

function extractToken(request: Request): string | null {
  const cookie = request.headers.get('cookie') || '';
  const match = cookie.match(/mk_customer_session=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}
