import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { admins, adminSessions } from '@/db/schema';
import { hashPassword, verifyPassword } from '@/lib/password';
import { clearedCookie, guardAdmin } from '@/lib/adminAuth';
import { error, json } from '@/lib/http';
import { recordActivity } from '@/lib/activity';

const passwordSchema = z.object({
  currentPassword: z.string().min(1).max(100),
  newPassword: z.string().min(10).max(128),
});

export async function PATCH(request: Request) {
  // Every role may change its own password; this is how a shop assistant takes
  // ownership of the temporary one an owner handed over.
  const guard = await guardAdmin(request);
  if (!guard.ok) return error(guard.message, guard.status);
  const admin = guard.admin;

  const parsed = passwordSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return error(parsed.error.issues[0]?.message ?? 'Invalid payload', 422);

  const { currentPassword, newPassword } = parsed.data;

  const existing = await db.query.admins.findFirst({
    where: eq(admins.id, admin.id),
  });
  if (!existing) return error('Admin account not found', 404);

  const passwordOk = await verifyPassword(currentPassword, existing.passwordHash);
  if (!passwordOk) return error('Current password is incorrect.', 401);

  const passwordHash = await hashPassword(newPassword);

  const [updated] = await db
    .update(admins)
    .set({ passwordHash })
    .where(eq(admins.id, admin.id))
    .returning();

  // A password change invalidates every outstanding session, including this
  // one: if the old password leaked, whoever used it is signed out now.
  await db.delete(adminSessions).where(eq(adminSessions.adminId, admin.id));

  await recordActivity({
    action: 'admin.password_change',
    entity: 'admin',
    entityId: updated.id,
    before: { role: existing.role, active: existing.active },
    after: { role: updated.role, active: updated.active },
    adminId: admin.id,
    adminEmail: admin.email,
  });

  return json(
    {
      data: {
        id: updated.id,
        email: updated.email,
        name: updated.name,
        role: updated.role,
      },
      meta: { changedBy: admin.email, signedOut: true },
    },
    { headers: { 'set-cookie': clearedCookie() } },
  );
}
