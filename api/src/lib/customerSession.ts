import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { customerSessions, customers } from '@/db/schema';
import { hashToken } from './customerAuth';

export async function getCurrentCustomer(request: Request): Promise<typeof customers.$inferSelect | null> {
  const cookie = request.headers.get('cookie') || '';
  const match = cookie.match(/mk_customer_session=([^;]+)/);
  if (!match) return null;

  const token = decodeURIComponent(match[1]);
  const tokenHash = hashToken(token);

  const session = await db.query.customerSessions.findFirst({
    where: eq(customerSessions.tokenHash, tokenHash),
  });

  if (!session || new Date(session.expiresAt) < new Date()) {
    return null;
  }

  const customer = await db.query.customers.findFirst({
    where: eq(customers.id, session.customerId),
  });

  return customer ?? null;
}
