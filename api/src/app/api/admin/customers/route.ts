import { and, asc, count, desc, eq, like, or } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { customers } from '@/db/schema';
import { requireRole } from '@/lib/adminAuth';
import { error, json } from '@/lib/http';

const listSchema = z.object({
  q: z.string().max(120).optional(),
  active: z.enum(['true', 'false']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
});

export async function GET(request: Request) {
  const admin = await requireRole(request, ['owner', 'manager']);
  if (!admin) return error('Not signed in', 401);

  const url = new URL(request.url);
  const parsed = listSchema.safeParse({
    q: url.searchParams.get('q') ?? undefined,
    active: url.searchParams.get('active') ?? undefined,
    limit: url.searchParams.get('limit') ?? undefined,
    offset: url.searchParams.get('offset') ?? undefined,
  });
  if (!parsed.success) return error(parsed.error.issues[0]?.message ?? 'Invalid query', 422);

  const { q, active, limit, offset } = parsed.data;

  const filters = [];
  if (active !== undefined) filters.push(eq(customers.active, active === 'true'));

  if (q && q.trim()) {
    const needle = `%${q.trim().replace(/[%_]/g, '')}%`;
    filters.push(
      or(
        like(customers.fullName, needle),
        like(customers.phone, needle),
        like(customers.email, needle),
      )!,
    );
  }

  const where = filters.length > 0 ? and(...filters) : undefined;

  const [rows, totals] = await Promise.all([
    db
      .select({
        id: customers.id,
        fullName: customers.fullName,
        phone: customers.phone,
        email: customers.email,
        region: customers.region,
        district: customers.district,
        active: customers.active,
        createdAt: customers.createdAt,
      })
      .from(customers)
      .where(where)
      .orderBy(desc(customers.createdAt), desc(customers.id))
      .limit(limit)
      .offset(offset),
    db.select({ n: count() }).from(customers).where(where),
  ]);

  return json({
    data: rows,
    meta: {
      total: Number(totals[0]?.n ?? 0),
      limit,
      offset,
      returned: rows.length,
    },
  });
}
