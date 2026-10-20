/**
 * In-process publish/subscribe for order changes, used to push live updates to
 * open dashboards over SSE.
 *
 * Scope worth knowing: this is a module-level registry inside one Node
 * process, so it works for a single server and for `npm run dev`. Running more
 * than one API instance, or serverless, would need Redis or a database-backed
 * stream instead, because a subscriber connected to instance A would not hear
 * an event published on instance B. The SSE client already falls back to
 * polling, so the failure mode is added latency rather than a broken screen.
 */

export type OrderEvent = {
  type: 'order.created' | 'order.status';
  id: number;
  reference: string;
  from?: string | null;
  to: string;
  total: number;
  currency: string;
  region: string | null;
  district: string | null;
  customerName: string | null;
  at: string;
};

type Subscriber = (event: OrderEvent) => void;

const subscribers = new Set<Subscriber>();

export function subscribe(subscriber: Subscriber): () => void {
  subscribers.add(subscriber);
  return () => {
    subscribers.delete(subscriber);
  };
}

export function publishOrderEvent(event: OrderEvent): void {
  for (const subscriber of subscribers) {
    try {
      subscriber(event);
    } catch {
      // A broken subscriber must not stop the others being notified.
    }
  }
}

export function subscriberCount(): number {
  return subscribers.size;
}
