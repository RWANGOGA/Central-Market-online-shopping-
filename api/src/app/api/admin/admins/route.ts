import { asc, count, eq, gt } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { adminSessions, admins, nowText } from '@/db/schema';
import { guardAdmin } from '@/lib/adminAuth';
import { adminDto } from '@/lib/adminAccounts';
import { hashPassword } from '@/lib/password';
import { recordActivity } from '@/lib/activity';
import { error, json } from '@/lib/http';

/**
 * Staff accounts.
 *
 * Owner-only: creating an account is the same act as granting a role, so it
 * cannot be delegated to the role it creates. Passwords are hashed here and
 * never returned; the DTO deliberately has no field for them.
 */

const createSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email().max(160),
  role: z.enum(['owner', 'manager', 'staff']),
  password: z.string().min(10).max(200),
});

export async function GET(request: Request) {
  const guard = await guardAdmin(request, 'admins.write');
  if (!guard.ok) return error(guard.message, guard.status);

  const [rows, sessions] = await Promise.all([
    db.select().from(admins).orderBy(asc(admins.id)),
    db
      .select({ adminId: adminSessions.adminId, n: count() })
      .from(adminSessions)
      .where(gt(adminSessions.expiresAt, nowText))
      .groupBy(adminSessions.adminId),
  ]);

  const live = new Map(sessions.map((row) => [row.adminId, Number(row.n)]));

  return json({ data: rows.map((row) => adminDto(row, live.get(row.id) ?? 0)) });
}

export async function POST(request: Request) {
  const guard = await guardAdmin(request, 'admins.write');
  if (!guard.ok) return error(guard.message, guard.status);
  const admin = guard.admin;

  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return error(parsed.error.issues[0]?.message ?? 'Invalid account', 422);
  }

  const { name, email, role, password } = parsed.data;

  const existing = await db.query.admins.findFirst({ where: eq(admins.email, email) });
  if (existing) return error('An account with that email already exists.', 409);

  const passwordHash = await hashPassword(password);
  const [created] = await db
    .insert(admins)
    .values({ name, email, passwordHash, role })
    .returning();

  await recordActivity({
    action: 'admin.create',
    entity: 'admin',
    entityId: created.id,
    after: { name: created.name, email: created.email, role: created.role },
    adminId: admin.id,
    adminEmail: admin.email,
  });

  return json({ data: adminDto(created, 0) }, { status: 201 });
}
