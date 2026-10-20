import type { orderStatusEvents } from '@/db/schema';

type OrderStatusEvent = typeof orderStatusEvents.$inferSelect;

/** A status-history row as a customer is allowed to see it. */
export type PublicTimelineEvent = {
  id: number;
  fromStatus: string | null;
  toStatus: string;
  note: string | null;
  actor: 'customer' | 'staff' | 'system';
  at: string;
};

/**
 * Who caused a status change, without telling the customer which member of
 * staff moved it. The raw column holds an email or a system label.
 */
export function actorFor(changedByEmail: string | null): PublicTimelineEvent['actor'] {
  if (!changedByEmail) return 'system';
  const value = changedByEmail.toLowerCase();
  if (value === 'customer' || value === 'guest') return 'customer';
  if (value.startsWith('system') || value === 'payment-gateway') return 'system';
  return 'staff';
}

export function toTimelineDto(event: OrderStatusEvent): PublicTimelineEvent {
  return {
    id: event.id,
    fromStatus: event.fromStatus,
    toStatus: event.toStatus,
    note: event.note,
    actor: actorFor(event.changedByEmail),
    at: event.createdAt,
  };
}
