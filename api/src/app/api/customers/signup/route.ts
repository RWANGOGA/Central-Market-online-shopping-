import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { customerSessions, customers } from '@/db/schema';
import { error, json } from '@/lib/http';
import { csrfCheck } from '@/lib/security';
import {
  createSessionToken,
  getSessionExpiry,
  hashPassword,
  isCommonPassword,
  sessionCookie,
} from '@/lib/customerAuth';
import { pruneExpiredCustomerSessions } from '@/lib/customerSession';
import { allow } from '@/lib/rateLimit';
import { getClientIp } from '@/lib/clientIp';
import { checkLocation } from '@/lib/locationGuard';
import { toCustomerDto } from '@/lib/customerDto';
import { isUniqueViolationOn } from '@/lib/dbErrors';

export const dynamic = 'force-dynamic';

/**
 * Registration.
 *
 * This used to validate the payload and then answer 503, because the plan was
 * to verify the phone with a one-time code first. There is no SMS provider
 * configured, so the effect was that nobody could create an account at all.
 * Verification has been dropped as a product decision: people sign up with
 * their contact details and are signed straight in.
 *
 * What that gives up is worth stating plainly, because it is a real trade
 * rather than a detail. Sign-in is by phone number, so an unverified signup
 * lets anyone claim a number they do not own and set its password. The
 * mitigations left in place are the ones that do not need a network provider:
 *   - an email address is required, so every account has a second contact on
 *     file, which is also the only plausible basis for a recovery route later;
 *   - a number that is already registered cannot be taken over by signing up
 *     again — the answer is a conflict, not a new password;
 *   - registration is rate limited per address and per number, so this cannot
 *     be used to sweep a range of numbers;
 *   - passwords go through the same common-password block as everything else.
 *
 * Re-adding an OTP check later means inserting it before the insert below;
 * nothing else about this flow has to change.
 */

/**
 * The form's fields, in the words the form uses for them.
 *
 * A required field that is missing fails on its *type*, and Zod's message for
 * that is "Invalid input: expected string, received undefined". True, and
 * useless to a shopper. Type failures are answered from this map; the explicit
 * messages written inside the schema below are already human and pass through.
 */
const FIELD_LABELS: Record<string, string> = {
  fullName: 'your full name',
  phone: 'a phone number',
  email: 'an email address',
  password: 'a password',
  region: 'your region',
  address: 'a delivery address',
};

function signupError(err: z.ZodError): string {
  const unknown = err.issues.find((issue) => issue.code === 'unrecognized_keys');
  if (unknown) {
    const keys = (unknown as { keys?: string[] }).keys ?? [];
    return `Unsupported ${keys.length === 1 ? 'field' : 'fields'}: ${keys.join(', ')}`;
  }

  const issue = err.issues[0];
  if (!issue) return 'Check the details and try again.';
  if (issue.code === 'invalid_type') {
    const label = FIELD_LABELS[String(issue.path[0] ?? '')];
    return label ? `Please enter ${label}.` : 'Check the details and try again.';
  }
  return issue.message;
}

const signupSchema = z.object({
  fullName: z.string().trim().min(2, 'Enter your full name.').max(120),
  phone: z
    .string()
    .trim()
    .min(10)
    .max(32)
    .transform((phone) => phone.replace(/[\s()-]/g, '').replace(/^\+?256/, '0'))
    .refine((phone) => /^07\d{8}$/.test(phone), 'Enter a valid Ugandan phone number.'),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, 'Enter an email address.')
    .max(254)
    .email('Enter an email address we can reach you at.'),
  password: z
    .string()
    .min(8, 'Choose a password of at least 8 characters.')
    .max(100)
    .refine((password) => !isCommonPassword(password), 'Choose a less common password.'),
  region: z.string().trim().min(1, 'Choose your region.').max(100),
  district: z.string().trim().max(100).optional(),
  address: z.string().trim().min(3, 'Enter a delivery address.').max(500),
}).strict();

export async function POST(request: Request) {
  const blocked = csrfCheck(request);
  if (blocked) return blocked;

  const ip = getClientIp(request);
  if (ip && !(await allow(`customer-signup-ip:${ip}`, 5, 60 * 60))) {
    return error('Too many signup attempts. Try again later.', 429);
  }

  const parsed = signupSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return error(signupError(parsed.error), 422);

  const details = parsed.data;

  // Per-number ceiling as well as per-address: one person behind a proxy
  // should still not be able to work through a list of numbers.
  if (!(await allow(`customer-signup-phone:${details.phone}`, 3, 60 * 60))) {
    return error('Too many signup attempts for that number. Try again later.', 429);
  }

  const [takenPhone, takenEmail] = await Promise.all([
    db.query.customers.findFirst({ where: eq(customers.phone, details.phone), columns: { id: true } }),
    db.query.customers.findFirst({ where: eq(customers.email, details.email), columns: { id: true } }),
  ]);

  if (takenPhone) {
    // No promise of password recovery here, because there is no recovery flow
    // yet. Pointing at signing in is the honest answer while that is true.
    return error('That number is already registered. Sign in instead.', 409);
  }
  if (takenEmail) {
    return error('That email is already in use by another account.', 409);
  }

  /**
   * The delivery map decides whether the location is real.
   *
   * The form offers the four regions from a fixed list, so this never fires in
   * normal use. It is here because the request is not the form: an account
   * created with "Mars Region" would be refused by the profile guard the first
   * time the customer edited their address, which turns a harmless typo on day
   * one into a saved profile that cannot be saved.
   */
  const location = await checkLocation({
    region: details.region,
    district: details.district ?? null,
  });
  if (!location.ok) {
    return json({ error: location.message, conflict: { level: location.level } }, { status: 422 });
  }

  const passwordHash = await hashPassword(details.password);

  let created;
  try {
    [created] = await db
      .insert(customers)
      .values({
        fullName: details.fullName,
        phone: details.phone,
        email: details.email,
        passwordHash,
        region: location.region,
        district: location.district,
        subCounty: location.subCounty,
        parish: location.parish,
        village: location.village,
        address: details.address,
        active: true,
      })
      .returning();
  } catch (err) {
    // The two checks above and this insert are not one atomic step, so a
    // simultaneous signup can still land on a unique index. Answer the same way.
    if (isUniqueViolationOn(err, ['phone'])) {
      return error('That number is already registered. Sign in instead.', 409);
    }
    if (isUniqueViolationOn(err, ['email'])) {
      return error('That email is already in use by another account.', 409);
    }
    throw err;
  }

  // Signing up signs you in, so a new customer lands on the shop rather than
  // on a login screen asking for a password they just typed.
  await pruneExpiredCustomerSessions();
  const { token, tokenHash } = createSessionToken();
  const expiresAt = getSessionExpiry();
  await db.insert(customerSessions).values({
    customerId: created.id,
    tokenHash,
    expiresAt,
    userAgent: request.headers.get('user-agent')?.slice(0, 200) || null,
  });

  return json(
    { data: toCustomerDto(created) },
    { headers: { 'Set-Cookie': sessionCookie(token, expiresAt) } },
  );
}
