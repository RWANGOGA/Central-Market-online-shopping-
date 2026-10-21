import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { customerPreferences } from '@/db/schema';
import { getCurrentCustomer } from '@/lib/customerSession';
import { error, json } from '@/lib/http';
import { csrfCheck } from '@/lib/security';

export const dynamic = 'force-dynamic';

/**
 * Shopping and notification flags.
 *
 * The list is closed on purpose. This column used to take any JSON the client
 * sent, so a browser could store an unbounded object under a customer's id —
 * a write with no ceiling on size or shape. Adding a flag is now a schema
 * change, which is also what tells the rest of the app that it exists.
 */
const preferenceFlags = z.object({
  orderUpdates: z.boolean(),
  farmNotifications: z.boolean(),
  highlightVegan: z.boolean(),
  reusablePackaging: z.boolean(),
  promotions: z.boolean(),
}).partial().strict();

/** Human names for error copy, kept next to the schema so they cannot drift. */
const PREFERENCE_LABELS: Record<string, string> = {
  orderUpdates: 'Order status updates',
  farmNotifications: 'Farm harvest notifications',
  highlightVegan: 'Vegan highlighting',
  reusablePackaging: 'Reusable packaging',
  promotions: 'Promotions and offers',
};

/** `preferences` is required, but any subset of the flags inside it is valid. */
const preferencesSchema = z.object({ preferences: preferenceFlags }).strict();

/**
 * A rejection is reported by flag name, so the copy stays useful whatever Zod's
 * internal wording happens to be.
 */
function preferenceError(err: z.ZodError): string {
  const unknown = err.issues.find((entry) => entry.code === 'unrecognized_keys');
  if (unknown) {
    const keys = (unknown as { keys?: string[] }).keys ?? [];
    return `Unsupported preference${keys.length === 1 ? '' : 's'}: ${keys.join(', ')}`;
  }
  const rejected = err.issues.find((entry) => entry.path.length > 0);
  const key = rejected ? String(rejected.path[rejected.path.length - 1]) : '';
  const label = PREFERENCE_LABELS[key];
  if (label) return `${label} must be on or off.`;
  return 'Expected a preferences object';
}

/** A hand-built payload should never be large; refuse before parsing further. */
const MAX_BODY_BYTES = 4_096;

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
  const blocked = csrfCheck(request);
  if (blocked) return blocked;

  const customer = await getCurrentCustomer(request);
  if (!customer) return error('Not signed in', 401);

  const raw = await request.text().catch(() => '');
  if (raw.length > MAX_BODY_BYTES) return error('That preferences payload is too large.', 413);

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return error('Expected a JSON body', 422);
  }

  const envelope = preferencesSchema.safeParse(body);
  if (!envelope.success) return error(preferenceError(envelope.error), 422);

  const incoming = envelope.data.preferences;

  const updated = await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(customerPreferences)
      .where(eq(customerPreferences.customerId, customer.id))
      .limit(1);

    // Merge rather than replace, so a client that only knows about four flags
    // cannot silently erase a fifth set by an older or newer version.
    const merged = { ...(existing?.preferences ?? {}), ...incoming };

    if (existing) {
      return tx
        .update(customerPreferences)
        .set({ preferences: merged, updatedAt: new Date().toISOString() })
        .where(eq(customerPreferences.customerId, customer.id))
        .returning();
    }

    return tx
      .insert(customerPreferences)
      .values({ customerId: customer.id, preferences: merged })
      .returning();
  });

  return json({ data: updated[0] ?? { customerId: customer.id, preferences: incoming } });
}
