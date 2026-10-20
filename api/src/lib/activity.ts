import { and, sql } from 'drizzle-orm';
import { db } from '@/db';
import { adminActivityLog, admins, nowText } from '@/db/schema';
import { requireAdmin } from '@/lib/catalogue';
import { error, json } from '@/lib/http';

export type ActivityAction =
  | 'product.create'
  | 'product.update'
  | 'product.restore'
  | 'product.price_history'
  | 'order.status'
  | 'order.sweep'
  | 'inventory.adjust'
  | 'purchase_order.create'
  | 'purchase_order.receive'
  | 'purchase_order.cancel'
  | 'supplier.create'
  | 'customer.deactivate'
  | 'admin.password_change';

export type ActivityInput = {
  action: ActivityAction;
  entity: string;
  entityId?: string | number;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  adminId?: number | null;
  adminEmail?: string | null;
};

export async function recordActivity(input: ActivityInput) {
  const payload = {
    action: input.action,
    entity: input.entity,
    entityId: input.entityId != null ? String(input.entityId) : null,
    before: input.before ?? null,
    after: input.after ?? null,
    adminId: input.adminId ?? null,
  };

  await db.insert(adminActivityLog).values(payload);
}

export async function listActivity(filters: {
  adminId?: number;
  action?: string;
  entity?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}) {
  const limit = filters.limit ?? 50;
  const offset = filters.offset ?? 0;

  const where = [];
  if (filters.adminId) where.push(sql`${adminActivityLog.adminId} = ${filters.adminId}`);
  if (filters.action) where.push(sql`${adminActivityLog.action} = ${filters.action}`);
  if (filters.entity) where.push(sql`${adminActivityLog.entity} = ${filters.entity}`);
  if (filters.from) where.push(sql`${adminActivityLog.createdAt} >= ${filters.from}`);
  if (filters.to) where.push(sql`${adminActivityLog.createdAt} <= ${filters.to}`);

  const rows = await db
    .select({
      id: adminActivityLog.id,
      action: adminActivityLog.action,
      entity: adminActivityLog.entity,
      entityId: adminActivityLog.entityId,
      before: adminActivityLog.before,
      after: adminActivityLog.after,
      adminEmail: admins.email,
      createdAt: adminActivityLog.createdAt,
    })
    .from(adminActivityLog)
    .leftJoin(admins, sql`${admins.id} = ${adminActivityLog.adminId}`)
    .where(where.length > 0 ? and(...where) : undefined)
    .orderBy(sql`${adminActivityLog.createdAt} DESC, ${adminActivityLog.id} DESC`)
    .limit(limit)
    .offset(offset);

  const totalRow = await db
    .select({ total: sql<number>`count(*)` })
    .from(adminActivityLog)
    .where(where.length > 0 ? and(...where) : undefined);

  return { rows, total: Number(totalRow[0]?.total ?? 0) };
}
