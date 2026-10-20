import { db } from './index';
import { customers, notifications, customerPreferences } from './schema';

async function seed() {
  console.log('Seeding customer preferences and notifications...');

  const customerList = await db.select().from(customers).limit(5);
  if (customerList.length === 0) {
    console.log('No customers found. Skipping seed.');
    return;
  }

  for (const customer of customerList) {
    await db.insert(customerPreferences).values({
      customerId: customer.id,
      preferences: {
        highlightVegan: true,
        farmNotifications: false,
        reusablePackaging: true,
        orderUpdates: true,
        promotions: false,
      },
    }).onConflictDoUpdate({
      target: customerPreferences.customerId,
      set: {
        preferences: {
          highlightVegan: true,
          farmNotifications: false,
          reusablePackaging: true,
          orderUpdates: true,
          promotions: false,
        },
        updatedAt: new Date().toISOString(),
      },
    });

    await db.insert(notifications).values({
      customerId: customer.id,
      type: 'system',
      title: 'Welcome to Mu Katale!',
      message: 'Thank you for joining. Browse our fresh produce and enjoy fast delivery across Uganda.',
    });

    await db.insert(notifications).values({
      customerId: customer.id,
      type: 'order',
      title: 'Your first order is on its way',
      message: 'Once you place an order, you will receive updates here.',
    });
  }

  const admins = await db.select().from(customers).limit(1);
  if (admins.length > 0) {
    await db.insert(notifications).values({
      customerId: admins[0].id,
      type: 'system',
      title: 'Test notification',
      message: 'This is a sample notification to verify the system.',
    });
  }

  console.log(`Seeded preferences and notifications for ${customerList.length} customer(s).`);
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
