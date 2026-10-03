import { sql } from 'drizzle-orm';
import { integer, real, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core';

export const products = sqliteTable('products', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  farm: text('farm').notNull(),
  location: text('location').notNull(),
  priceValue: integer('price_value').notNull(),
  priceLabel: text('price_label').notNull(),
  currency: text('currency').notNull().default('UGX'),
  unit: text('unit').notNull(),
  imageFiles: text('image_files', { mode: 'json' }).notNull().$type<string[]>(),
  dietary: text('dietary', { mode: 'json' }).notNull().$type<string[]>(),
  stock: integer('stock').notNull().default(0),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const customers = sqliteTable('customers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  email: text('email').notNull().unique(),
  fullName: text('full_name').notNull(),
  address: text('address').notNull(),
  city: text('city').notNull(),
  state: text('state').notNull(),
  zipCode: text('zip_code').notNull(),
  country: text('country').notNull().default('US'),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const carts = sqliteTable('carts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  customerId: integer('customer_id').references(() => customers.id, {
    onDelete: 'set null',
  }),
  status: text('status', {
    enum: ['active', 'converted', 'abandoned'],
  })
    .notNull()
    .default('active'),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const cartItems = sqliteTable('cart_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  cartId: integer('cart_id')
    .notNull()
    .references(() => carts.id, { onDelete: 'cascade' }),
  productId: integer('product_id')
    .notNull()
    .references(() => products.id, { onDelete: 'cascade' }),
  quantity: integer('quantity').notNull().default(1),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const orders = sqliteTable('orders', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  reference: text('reference').notNull().unique(),
  customerId: integer('customer_id')
    .notNull()
    .references(() => customers.id),
  status: text('status', {
    enum: ['pending', 'paid', 'fulfilled', 'cancelled'],
  })
    .notNull()
    .default('pending'),
  subtotal: integer('subtotal').notNull(),
  shipping: integer('shipping').notNull().default(0),
  tax: integer('tax').notNull().default(0),
  total: integer('total').notNull(),
  currency: text('currency').notNull().default('UGX'),
  shippingAddress: text('shipping_address', { mode: 'json' }).notNull().$type<{
    fullName: string;
    address: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  }>(),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const orderItems = sqliteTable('order_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  orderId: integer('order_id')
    .notNull()
    .references(() => orders.id, { onDelete: 'cascade' }),
  productId: integer('product_id')
    .notNull()
    .references(() => products.id),
  name: text('name').notNull(),
  priceValue: integer('price_value').notNull(),
  quantity: integer('quantity').notNull(),
  lineTotal: integer('line_total').notNull(),
});

/**
 * Uganda's administrative hierarchy.
 *
 * Regions and districts are seeded from geoBoundaries (gbOpen), which carries
 * real polygon geometry for ADM1 and ADM2. Sub-counties, parishes and villages
 * have no equivalent open boundary dataset, so those three tables are seeded
 * empty and are ready to be populated from UBOS, a district registry, or
 * OpenStreetMap. `hasGeometry` records whether real outlines exist for a level
 * so the client never draws an empty polygon and reports it as a data gap.
 */
export const regions = sqliteTable('regions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  isoCode: text('iso_code'),
  centroidLat: real('centroid_lat').notNull(),
  centroidLng: real('centroid_lng').notNull(),
  bboxSouth: real('bbox_south').notNull(),
  bboxWest: real('bbox_west').notNull(),
  bboxNorth: real('bbox_north').notNull(),
  bboxEast: real('bbox_east').notNull(),
  hasGeometry: integer('has_geometry', { mode: 'boolean' }).notNull().default(true),
});

export const districts = sqliteTable('districts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  /**
   * Uganda lists its constituted cities and municipalities as separate
   * districts in boundary data, so Soroti District and Soroti City are two
   * rows. `kind` keeps them apart.
   */
  kind: text('kind', { enum: ['District', 'City', 'Municipality'] })
    .notNull()
    .default('District'),
  regionId: integer('region_id')
    .notNull()
    .references(() => regions.id, { onDelete: 'cascade' }),
  centroidLat: real('centroid_lat').notNull(),
  centroidLng: real('centroid_lng').notNull(),
  bboxSouth: real('bbox_south').notNull(),
  bboxWest: real('bbox_west').notNull(),
  bboxNorth: real('bbox_north').notNull(),
  bboxEast: real('bbox_east').notNull(),
  hasGeometry: integer('has_geometry', { mode: 'boolean' }).notNull().default(true),
}, (table) => [
  unique('districts_name_region_kind_unique').on(table.name, table.regionId, table.kind),
]);

export const subCounties = sqliteTable('sub_counties', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  districtId: integer('district_id')
    .notNull()
    .references(() => districts.id, { onDelete: 'cascade' }),
  centroidLat: real('centroid_lat'),
  centroidLng: real('centroid_lng'),
  hasGeometry: integer('has_geometry', { mode: 'boolean' }).notNull().default(false),
}, (table) => [
  unique('sub_counties_name_district_unique').on(table.name, table.districtId),
]);

export const parishes = sqliteTable('parishes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  subCountyId: integer('sub_county_id')
    .notNull()
    .references(() => subCounties.id, { onDelete: 'cascade' }),
  centroidLat: real('centroid_lat'),
  centroidLng: real('centroid_lng'),
  hasGeometry: integer('has_geometry', { mode: 'boolean' }).notNull().default(false),
}, (table) => [
  unique('parishes_name_sub_county_unique').on(table.name, table.subCountyId),
]);

/**
 * Lowest civil-administrative unit in Uganda, overseen by the Local Council 1
 * chairperson. Villages are addressed by name and a landmark rather than by
 * outline, which is why there is no geometry.
 */
export const villages = sqliteTable('villages', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  parishId: integer('parish_id')
    .notNull()
    .references(() => parishes.id, { onDelete: 'cascade' }),
  hasGeometry: integer('has_geometry', { mode: 'boolean' }).notNull().default(false),
}, (table) => [
  unique('villages_name_parish_unique').on(table.name, table.parishId),
]);

/**
 * A payment attempt against an order. Mobile money in Uganda is asynchronous:
 * the customer approves a USSD prompt on their handset, so the intent sits in
 * `pending` until the provider calls back or the client polls.
 */
export const payments = sqliteTable('payments', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  reference: text('reference').notNull().unique(),
  orderId: integer('order_id').references(() => orders.id, { onDelete: 'set null' }),
  cartId: integer('cart_id').references(() => carts.id, { onDelete: 'set null' }),
  channel: text('channel', { enum: ['mobile_money', 'card', 'wallet'] }).notNull(),
  provider: text('provider').notNull(),
  status: text('status', {
    enum: ['pending', 'awaiting_approval', 'processing', 'succeeded', 'failed', 'cancelled'],
  })
    .notNull()
    .default('pending'),
  amount: integer('amount').notNull(),
  currency: text('currency').notNull().default('UGX'),
  payerName: text('payer_name'),
  payerPhone: text('payer_phone'),
  walletId: text('wallet_id'),
  maskedCard: text('masked_card'),
  failureReason: text('failure_reason'),
  providerRef: text('provider_ref'),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;
export type Cart = typeof carts.$inferSelect;
export type CartItem = typeof cartItems.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
export type Region = typeof regions.$inferSelect;
export type District = typeof districts.$inferSelect;
export type SubCounty = typeof subCounties.$inferSelect;
export type Parish = typeof parishes.$inferSelect;
export type Village = typeof villages.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;