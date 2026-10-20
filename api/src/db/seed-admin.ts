import { eq } from 'drizzle-orm';
import { admins } from './schema';
import { db } from './index';
import { hashPassword } from '@/lib/password';

/**
 * Creates the first admin from the environment.
 *
 * The credential is never committed. If ADMIN_EMAIL or ADMIN_PASSWORD is
 * missing the script explains what to do and exits without touching the
 * database, so there is no default account to accidentally ship.
 */

async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME?.trim() || 'Catalogue Manager';

  if (!email || !password) {
    console.error(
      [
        '',
        'No admin credentials supplied, so nothing was created.',
        '',
        'Set these in api/.env.local and run the command again:',
        '',
        '  ADMIN_EMAIL=you@example.com',
        '  ADMIN_PASSWORD=a-password-of-at-least-10-characters',
        '  ADMIN_NAME=Your Name          # optional',
        '',
        'There is deliberately no default account.',
        '',
      ].join('\n'),
    );
    process.exit(1);
  }

  if (password.length < 10) {
    console.error('ADMIN_PASSWORD must be at least 10 characters. Nothing was created.');
    process.exit(1);
  }

  const existing = await db.query.admins.findFirst({ where: eq(admins.email, email) });

  if (existing) {
    console.log(`An admin already exists for ${email}. Nothing changed.`);
    console.log('To change the password, update the hash directly rather than re-running this.');
    return;
  }

  const passwordHash = await hashPassword(password);

  await db.insert(admins).values({
    email,
    name,
    passwordHash,
    role: 'owner',
  });

  const all = await db.select({ email: admins.email, role: admins.role }).from(admins);
  console.log(`Created owner ${email}.`);
  console.log(`${all.length} admin account(s) exist.`);
}

seedAdmin()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Admin seed failed:', err);
    process.exit(1);
  });
