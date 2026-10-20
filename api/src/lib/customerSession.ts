import { and, eq, gt, lt } from 'drizzle-orm';
import { db } from '@/db';
import { customerSessions, customers } from '@/db/schema';
import { hashToken, readCustomerSessionToken } from './customerAuth';

export async function getCurrentCustomer(request: Request): Promise<typeof customers.$inferSelect | null> {
  const token = readCustomerSessionToken(request.headers.get('cookie'));
  if (!token) return null;

  const tokenHash = hashToken(token);
  const session = await db.query.customerSessions.findFirst({
    where: and(eq(customerSessions.tokenHash, tokenHash), gt(customerSessions.expiresAt, new Date().toISOString())),
  });

  if (!session) {
    await db.delete(customerSessions).where(and(
      eq(customerSessions.tokenHash, tokenHash),
      lt(customerSessions.expiresAt, new Date().toISOString()),
    ));
    return null;
  }

  const customer = await db.query.customers.findFirst({
    where: and(eq(customers.id, session.customerId), eq(customers.active, true)),
  });
  if (!customer) {
    await db.delete(customerSessions).where(eq(customerSessions.id, session.id));
    return null;
  }

  return customer;
}

/** Removes any stale customer sessions during login or an authenticated request. */
export async function pruneExpiredCustomerSessions(): Promise<void> {
  await db.delete(customerSessions).where(lt(customerSessions.expiresAt, new Date().toISOString()));
}

export async function revokeCustomerSessions(customerId: number): Promise<void> {
  await db.delete(customerSessions).where(eq(customerSessions.customerId, customerId));
}
