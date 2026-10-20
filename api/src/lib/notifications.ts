import { db } from '@/db';
import { notifications, nowText } from '@/db/schema';
import { sql } from 'drizzle-orm';

export type NotificationType = 'order' | 'stock' | 'delivery' | 'system' | 'promotion';

export async function createCustomerNotification(params: {
  customerId: number;
  type: NotificationType;
  title: string;
  message: string;
}) {
  await db.insert(notifications).values({
    customerId: params.customerId,
    type: params.type,
    title: params.title,
    message: params.message,
  });
}

export async function createAdminNotification(params: {
  adminId: number;
  type: NotificationType;
  title: string;
  message: string;
}) {
  await db.insert(notifications).values({
    adminId: params.adminId,
    type: params.type,
    title: params.title,
    message: params.message,
  });
}

export async function createSystemNotification(params: {
  customerId?: number;
  adminId?: number;
  type: NotificationType;
  title: string;
  message: string;
}) {
  const values: Record<string, unknown> = {
    type: params.type,
    title: params.title,
    message: params.message,
  };

  if (params.customerId) values.customerId = params.customerId;
  if (params.adminId) values.adminId = params.adminId;

  await db.insert(notifications).values(values as any);
}
