import { promoCodes } from './schema';
import { db } from './index';

/**
 * Starter campaigns for a fresh deployment.
 *
 * Codes are inserted with ON CONFLICT DO NOTHING so re-running the seed never
 * resets usage counters or overwrites a campaign an administrator has edited.
 */
const PROMOS: (typeof promoCodes.$inferInsert)[] = [
  {
    code: 'WELCOME10',
    description: '10% off your first basket, up to UGX 5,000.',
    kind: 'percent',
    value: 10,
    minSubtotal: 20_000,
    maxDiscount: 5_000,
    perCustomerLimit: 1,
  },
  {
    code: 'FRESH5000',
    description: 'UGX 5,000 off baskets over UGX 30,000.',
    kind: 'fixed',
    value: 5_000,
    minSubtotal: 30_000,
    perCustomerLimit: 1,
  },
  {
    code: 'MARKET20',
    description: '20% off large baskets, up to UGX 15,000. First 100 orders.',
    kind: 'percent',
    value: 20,
    minSubtotal: 50_000,
    maxDiscount: 15_000,
    usageLimit: 100,
    perCustomerLimit: 1,
    endsAt: '2026-12-31 23:59:59',
  },
];

async function seedPromos() {
  for (const promo of PROMOS) {
    await db.insert(promoCodes).values(promo).onConflictDoNothing({ target: promoCodes.code });
  }
  console.log(`Promo codes ready: ${PROMOS.map((promo) => promo.code).join(', ')}`);
}

seedPromos()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Could not seed promo codes:', err instanceof Error ? err.message : err);
    process.exit(1);
  });
