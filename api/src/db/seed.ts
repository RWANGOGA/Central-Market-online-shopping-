import { sql } from 'drizzle-orm';
import { products } from './schema';
import { db } from './index';
import type { NewProduct } from './schema';

const SEED_PRODUCTS: NewProduct[] = [
  {
    slug: 'garlic-clove',
    name: 'Garlic clove',
    description:
      'Bold, aromatic garlic cloves with a rich, complex flavor. Perfect for roasting, sautéing, or adding depth to any dish.',
    farm: 'Bukalasi Farm',
    location: 'Grown in Sironko District by Bukalasi Farm',
    priceValue: 3524,
    priceLabel: 'USh 3,524 each',
    unit: 'each',
    imageFiles: [
      '39a095c5219433210528f313f4db7ed09e8b6466.png',
      'c7319cef2b86a8f71b6765b77a10caccb7fc8b83.png',
    ],
    dietary: ['VG', 'GF', 'DF'],
    stock: 120,
  },
  {
    slug: 'sugar-snap-pea',
    name: 'Sugar snap pea',
    description:
      'Crisp, sweet sugar snap peas with edible pods. Enjoy raw as a snack or lightly steamed to preserve their natural crunch.',
    farm: 'Rwambari Farm',
    location: 'Grown in Kyegegwa District by Rwambari Farm',
    priceValue: 19992,
    priceLabel: 'USh 19,992/kg',
    unit: 'kg',
    imageFiles: [
      '1b41f753535d961cfbba08b0eb03a1902c09f7f3.png',
      'c7319cef2b86a8f71b6765b77a10caccb7fc8b83.png',
    ],
    dietary: ['VG', 'GF', 'DF'],
    stock: 36,
  },
  {
    slug: 'ginger',
    name: 'Ginger',
    description:
      'Fresh, organic ginger root with a warm, spicy kick. Essential for Asian cooking and natural wellness remedies.',
    farm: 'Bungokho Farm',
    location: 'Grown in Mbale District by Bungokho Farm',
    priceValue: 36667,
    priceLabel: 'USh 36,667/kg',
    unit: 'kg',
    imageFiles: ['07e73d3701b2c2cf9a8054b1b2606088545c1b53.png'],
    dietary: ['VG', 'GF', 'DF'],
    stock: 27,
  },
  {
    slug: 'sweet-onion',
    name: 'Sweet onion',
    description:
      'Mild, sweet onions perfect for caramelizing or eating raw. Low in sulfur with a delicate, pleasant flavor.',
    farm: 'Kyarakora Farm',
    location: 'Grown in Kabale District by Kyarakora Farm',
    priceValue: 3404,
    priceLabel: 'USh 3,404/kg',
    unit: 'kg',
    imageFiles: ['345d9f75120e49e4b6f691447bccd48abfb67431.png'],
    dietary: ['VG', 'GF', 'DF'],
    stock: 91,
  },
  {
    slug: 'raspberries',
    name: 'Raspberries',
    description:
      'Juicy, sweet-tart raspberries bursting with flavor. Rich in antioxidants and perfect for snacking or desserts.',
    farm: 'Ngarama Farm',
    location: 'Grown in Mbarara District by Ngarama Farm',
    priceValue: 15800,
    priceLabel: 'USh 15,800 pint',
    unit: 'pint',
    imageFiles: ['28818bcf637e7596ffec2602b44c1b407fe11cf9.png'],
    dietary: ['VG', 'GF', 'DF'],
    stock: 45,
  },
  {
    slug: 'bananas',
    name: 'Bananas',
    description:
      'Sweet, creamy bananas perfect for smoothies, baking, or eating fresh. A great source of potassium and natural energy.',
    farm: 'Rwekubo Farm',
    location: 'Grown in Isingiro District by Rwekubo Farm',
    priceValue: 5587,
    priceLabel: 'USh 5,587/kg',
    unit: 'kg',
    imageFiles: ['d55ecea918fdfbe2d236a4386a73a981bf45f319.png'],
    dietary: ['VG', 'GF', 'DF'],
    stock: 136,
  },
  {
    slug: 'avocados',
    name: 'Avocados',
    description:
      'Creamy, buttery avocados rich in healthy fats. Perfect for guacamole, toast, or adding to salads and smoothies.',
    farm: 'Najjera Farm',
    location: 'Grown in Wakiso District by Najjera Farm',
    priceValue: 4158,
    priceLabel: 'USh 4,158 each',
    unit: 'each',
    imageFiles: ['464f20b81f02057b5cc69adbc19fb20af709c271.png'],
    dietary: ['VG', 'GF', 'DF'],
    stock: 90,
  },
  {
    slug: 'kale',
    name: 'Kale',
    description:
      'Nutrient-dense kale with a robust, earthy flavor. Excellent for salads, smoothies, or crispy kale chips.',
    farm: 'Kawolo Farm',
    location: 'Grown in Mityana District by Kawolo Farm',
    priceValue: 7880,
    priceLabel: 'USh 7,880 each',
    unit: 'each',
    imageFiles: ['365c8fc0f53d1bc2bad0988227099e87b4730cbc.png'],
    dietary: ['VG', 'GF', 'DF'],
    stock: 75,
  },
  {
    slug: 'radish',
    name: 'Radish',
    description:
      'Crisp, peppery radishes with a fresh, clean bite. Great for salads, pickling, or as a crunchy snack.',
    farm: 'Nkolokoto Farm',
    location: 'Grown in Mpigi District by Nkolokoto Farm',
    priceValue: 5108,
    priceLabel: 'USh 5,108 each',
    unit: 'each',
    imageFiles: ['f286a5e73a18e796afd61d7b68c51addff2c69b6.png'],
    dietary: ['VG', 'GF', 'DF'],
    stock: 110,
  },
];

async function seed() {
  console.log('Seeding products...');

  // Upsert rather than skip, so re-running the seed after editing a product
  // actually applies the change. `stock` and `active` are left alone because
  // they are operational values, not seed data.
  await db
    .insert(products)
    .values(SEED_PRODUCTS)
    .onConflictDoUpdate({
      target: products.slug,
      set: {
        name: sql`excluded.name`,
        description: sql`excluded.description`,
        farm: sql`excluded.farm`,
        location: sql`excluded.location`,
        priceValue: sql`excluded.price_value`,
        priceLabel: sql`excluded.price_label`,
        currency: sql`excluded.currency`,
        unit: sql`excluded.unit`,
        imageFiles: sql`excluded.image_files`,
        dietary: sql`excluded.dietary`,
      },
    });

  const rows = await db.select().from(products);
  console.log(`Done. ${rows.length} products in the database.`);
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });