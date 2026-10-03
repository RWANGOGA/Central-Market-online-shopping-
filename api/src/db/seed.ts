import { products } from './schema';
import { db } from './index';
import type { NewProduct } from './schema';

const SEED_PRODUCTS: NewProduct[] = [
  {
    slug: 'garlic-clove',
    name: 'Garlic clove',
    description:
      'Bold, aromatic garlic cloves with a rich, complex flavor. Perfect for roasting, sautéing, or adding depth to any dish.',
    farm: 'Kunisaki Farms',
    location: 'Grown in Gilroy, CA by Kunisaki Farms',
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
    farm: 'Helmbolt Orchards',
    location: 'Grown in Salinas Valley, CA by Helmbolt Orchards',
    priceValue: 9068,
    priceLabel: 'USh 9,068/lb',
    unit: 'lb',
    imageFiles: [
      '1b41f753535d961cfbba08b0eb03a1902c09f7f3.png',
      'c7319cef2b86a8f71b6765b77a10caccb7fc8b83.png',
    ],
    dietary: ['VG', 'GF', 'DF'],
    stock: 80,
  },
  {
    slug: 'ginger',
    name: 'Ginger',
    description:
      'Fresh, organic ginger root with a warm, spicy kick. Essential for Asian cooking and natural wellness remedies.',
    farm: 'Bui Farms',
    location: 'Grown in Hawaii by Bui Farms',
    priceValue: 16632,
    priceLabel: 'USh 16,632/lb',
    unit: 'lb',
    imageFiles: ['07e73d3701b2c2cf9a8054b1b2606088545c1b53.png'],
    dietary: ['VG', 'GF', 'DF'],
    stock: 60,
  },
  {
    slug: 'sweet-onion',
    name: 'Sweet onion',
    description:
      'Mild, sweet onions perfect for caramelizing or eating raw. Low in sulfur with a delicate, pleasant flavor.',
    farm: 'Castelao Farms',
    location: 'Grown in Vidalia, GA by Castelao Farms',
    priceValue: 1544,
    priceLabel: 'USh 1,544/lb',
    unit: 'lb',
    imageFiles: ['345d9f75120e49e4b6f691447bccd48abfb67431.png'],
    dietary: ['VG', 'GF', 'DF'],
    stock: 200,
  },
  {
    slug: 'raspberries',
    name: 'Raspberries',
    description:
      'Juicy, sweet-tart raspberries bursting with flavor. Rich in antioxidants and perfect for snacking or desserts.',
    farm: 'Bernal Growers',
    location: 'Grown in Oregon by Bernal Growers',
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
    farm: 'Lowry Farms',
    location: 'Grown in Costa Rica by Lowry Farms',
    priceValue: 2534,
    priceLabel: 'USh 2,534/lb',
    unit: 'lb',
    imageFiles: ['d55ecea918fdfbe2d236a4386a73a981bf45f319.png'],
    dietary: ['VG', 'GF', 'DF'],
    stock: 300,
  },
  {
    slug: 'avocados',
    name: 'Avocados',
    description:
      'Creamy, buttery avocados rich in healthy fats. Perfect for guacamole, toast, or adding to salads and smoothies.',
    farm: 'Gonzalez Produce',
    location: 'Grown in Michoacán, Mexico by Gonzalez Produce',
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
    farm: 'Green Growers',
    location: 'Grown in California Central Valley by Green Growers',
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
    farm: 'Gonzalez Produce',
    location: 'Grown in San Diego County, CA by Gonzalez Produce',
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
  await db.insert(products).values(SEED_PRODUCTS).onConflictDoNothing();
  const rows = await db.select().from(products);
  console.log(`Done. ${rows.length} products in the database.`);
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });