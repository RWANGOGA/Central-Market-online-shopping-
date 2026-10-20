import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { customerSessions, customers } from '@/db/schema';
import { json } from '@/lib/http';
import { clearedCookie, hashToken, readCustomerSessionToken } from '@/lib/customerAuth';
import { toCustomerDto } from '@/lib/customerDto';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const token = readCustomerSessionToken(request.headers.get('cookie'));
  if (token) await db.delete(customerSessions).where(eq(customerSessions.tokenHash, hashToken(token)));
  return json({ data: { message: 'Signed out' } }, { headers: { 'Set-Cookie': clearedCookie() } });
}

export async function GET(request: Request) {
  const token = readCustomerSessionToken(request.headers.get('cookie'));
  if (!token) return json({ data: null });

  const tokenHash = hashToken(token);
  const session = await db.query.customerSessions.findFirst({
    where: eq(customerSessions.tokenHash, tokenHash),
  });

  if (!session || new Date(session.expiresAt).getTime() <= Date.now()) {
    if (session) await db.delete(customerSessions).where(eq(customerSessions.id, session.id));
    return json({ data: null }, { headers: { 'Set-Cookie': clearedCookie() } });
  }

  const customer = await db.query.customers.findFirst({
    where: eq(customers.id, session.customerId),
  });
  if (!customer || !customer.active) {
    await db.delete(customerSessions).where(eq(customerSessions.id, session.id));
    return json({ data: null }, { headers: { 'Set-Cookie': clearedCookie() } });
  }

  return json({ data: { ...toCustomerDto(customer), createdAt: customer.createdAt } });
}
