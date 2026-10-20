import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { customerSessions, customers } from '@/db/schema';
import { getCurrentCustomer } from '@/lib/customerSession';
import { error, json } from '@/lib/http';
import { checkCustomerPassword, hashPassword, isCommonPassword } from '@/lib/customerAuth';

const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1).max(100),
  newPassword: z.string().min(8).max(100).refine((value) => !isCommonPassword(value), 'Choose a less common password.'),
}).strict();

export async function PATCH(request: Request) {
  const customer = await getCurrentCustomer(request);
  if (!customer) return error('Not signed in', 401);
  const parsed = passwordChangeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return error('Invalid password change request', 422);

  const current = await checkCustomerPassword(parsed.data.currentPassword, customer.passwordHash);
  if (!current.ok) return error('Current password is incorrect', 401);

  const passwordHash = await hashPassword(parsed.data.newPassword);
  await db.transaction(async (tx) => {
    await tx.update(customers).set({ passwordHash }).where(eq(customers.id, customer.id));
    await tx.delete(customerSessions).where(eq(customerSessions.customerId, customer.id));
  });

  return json({ data: { message: 'Password updated. Sign in again to continue.' } }, { status: 200 });
}
