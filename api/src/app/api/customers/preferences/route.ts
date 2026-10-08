import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { customerPreferences, customers } from '@/db/schema';
import { getCurrentCustomer } from '@/lib/customerSession';
import { error, json } from '@/lib/http';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const customer = await getCurrentCustomer(request);
  if (!customer) return error('Not signed in', 401);

  const prefs = await db.query.customerPreferences.findFirst({
    where: eq(customerPreferences.customerId, customer.id),
  });

  return json({
    data: {
      customerId: customer.id,
      preferences: prefs?.preferences ?? {},
    },
  });
}

export async function PATCH(request: Request) {
  const customer = await getCurrentCustomer(request);
  if (!customer) return error('Not signed in', 401);

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object' || !('preferences' in body)) {
    return error('Expected { preferences: object }', 422);
  }

  const preferences = body.preferences as Record<string, unknown>;

  const [updated] = await db
    .insert(customerPreferences)
    .values({
      customerId: customer.id,
      preferences,
    })
    .onConflictDoUpdate({
      target: customerPreferences.customerId,
      set: {
        preferences,
        updatedAt: new Date().toISOString(),
      },
    })
    .returning();

  return json({ data: updated });
}
