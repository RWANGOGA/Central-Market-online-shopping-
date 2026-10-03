import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { customers } from '@/db/schema';
import { error, json } from '@/lib/http';

const customerSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(1),
  address: z.string().min(1),
  city: z.string().min(1),
  state: z.string().min(1),
  zipCode: z.string().min(1),
  country: z.string().default('US'),
});

export async function GET(request: Request) {
  const email = new URL(request.url).searchParams.get('email');

  if (!email) return error('Query parameter "email" is required', 400);

  const row = await db.query.customers.findFirst({ where: eq(customers.email, email) });
  if (!row) return error(`No customer with email "${email}"`, 404);

  return json({ data: row });
}

export async function POST(request: Request) {
  const parsed = customerSchema.safeParse(await request.json());
  if (!parsed.success) {
    return error(parsed.error.issues[0]?.message ?? 'Invalid payload', 422);
  }

  const existing = await db.query.customers.findFirst({
    where: eq(customers.email, parsed.data.email),
  });

  const row = existing
    ? await db
        .update(customers)
        .set(parsed.data)
        .where(eq(customers.id, existing.id))
        .returning()
    : await db.insert(customers).values(parsed.data).returning();

  return json({ data: row[0] }, { status: existing ? 200 : 201 });
}