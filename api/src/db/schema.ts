import { sql } from 'drizzle-orm';
import { index, integer, real, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core';

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
  /**
   * A cached total. The authoritative record is the sum of stock_movements,
   * which is what makes stock reconcilable rather than merely a number.
   */
  stock: integer('stock').notNull().default(0),
  /**
   * Per product, because a kilogram of ginger and a bulb of garlic are not
   * comparable quantities and a single global threshold flags one and not the
   * other. Null means fall back to LOW_STOCK_THRESHOLD.
   */
  lowStockThreshold: integer('low_stock_threshold'),
  reorderQuantity: integer('reorder_quantity'),
  supplierId: integer('supplier_id').references(() => suppliers.id, {
    onDelete: 'set null',
  }),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  /**
   * Updated by the application on every PATCH. Used for optimistic concurrency:
   * the client sends the value it last saw, and a mismatch returns 409.
   *
   * SQLite refuses a non-constant default on ALTER TABLE, so drizzle-kit push
   * adds this with an empty default. The application writes it explicitly.
   */
  updatedAt: text('updated_at').notNull().default(''),
}, (table) => [
  // The low-stock list is a WHERE on this pair, run on every dashboard load.
  index('idx_products_stock_alert').on(table.active, table.stock),
]);

/**
 * Immutable audit trail for price and unit changes.
 *
 * A price change is not just a new number on a product row: it is a dated event
 * that disputes, analytics, and vendor reconciliation all depend on. This table
 * stores the before and after so the full history is queryable without parsing
 * product revisions.
 */
export const productPriceHistory = sqliteTable('product_price_history', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  productId: integer('product_id')
    .notNull()
    .references(() => products.id, { onDelete: 'cascade' }),
  priceValue: integer('price_value').notNull(),
  unit: text('unit').notNull(),
  priceLabel: text('price_label').notNull(),
  changedByAdminId: integer('changed_by_admin_id').references(() => admins.id, {
    onDelete: 'set null',
  }),
  changedByEmail: text('changed_by_email'),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
}, (table) => [
  index('idx_price_history_product').on(table.productId, table.createdAt),
]);

/**
 * A delivery customer, keyed on the Ugandan mobile number rather than email.
 * Email is optional because it is not how Ugandan customers identify
 * themselves to a rider, and requiring it would push people to invent an
 * address they do not use.
 *
 * The administrative columns form a strict top-down chain. Any level that is
 * present must belong to the level above it; api/src/lib/locationGuard.ts
 * enforces that on every write.
 */
export const customers = sqliteTable('customers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  fullName: text('full_name').notNull(),
  phone: text('phone').notNull().unique(),
  email: text('email').unique(),
  passwordHash: text('password_hash').notNull().default(''),
  region: text('region').notNull(),
  district: text('district'),
  subCounty: text('sub_county'),
  parish: text('parish'),
  village: text('village'),
  address: text('address').notNull(),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const customerSessions = sqliteTable('customer_sessions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  customerId: integer('customer_id')
    .notNull()
    .references(() => customers.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(),
  userAgent: text('user_agent'),
  expiresAt: text('expires_at').notNull(),
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

/**
 * Staff accounts. Separate from customers: an admin can change the catalogue
 * and adjust stock, so the credential is stored apart and never returned by
 * any endpoint.
 *
 * The first account is seeded from ADMIN_EMAIL and ADMIN_PASSWORD in the
 * environment. No credential is committed to the repository.
 */
export const admins = sqliteTable('admins', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  passwordHash: text('password_hash').notNull(),
  role: text('role', { enum: ['owner', 'manager'] }).notNull().default('manager'),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  lastLoginAt: text('last_login_at'),
});

/**
 * An opaque session. The token itself is never stored, only its SHA-256, so a
 * database copy cannot be used to sign in.
 */
export const adminSessions = sqliteTable('admin_sessions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  adminId: integer('admin_id')
    .notNull()
    .references(() => admins.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: text('expires_at').notNull(),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  userAgent: text('user_agent'),
});

/**
 * Failed sign-in attempts, used to slow down password guessing. Kept in the
 * database rather than in memory so a restart does not hand an attacker a fresh
 * allowance.
 */
export const adminLoginAttempts = sqliteTable('admin_login_attempts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  email: text('email').notNull(),
  succeeded: integer('succeeded', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

/**
 * Append-only audit trail for admin actions.
 *
 * Every meaningful mutation — product update, order status change, inventory
 * adjustment, purchase order receipt — is recorded here so the activity feed
 * and the export endpoint can answer "who did what, and when" without
 * reconstructing it from business tables.
 */
export const adminActivityLog = sqliteTable('admin_activity_log', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  adminId: integer('admin_id').references(() => admins.id, { onDelete: 'set null' }),
  action: text('action').notNull(),
  entity: text('entity').notNull(),
  entityId: text('entity_id'),
  before: text('before', { mode: 'json' }),
  after: text('after', { mode: 'json' }),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
}, (table) => [
  index('idx_activity_admin').on(table.adminId, table.createdAt),
  index('idx_activity_entity').on(table.entity, table.entityId),
]);

export const customerPreferences = sqliteTable('customer_preferences', {
  customerId: integer('customer_id')
    .notNull()
    .references(() => customers.id, { onDelete: 'cascade' }),
  preferences: text('preferences', { mode: 'json' }).notNull().default('{}'),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(datetime('now'))`),
}, (table) => [
  index('idx_customer_preferences_customer').on(table.customerId),
]);

export const notifications = sqliteTable('notifications', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  customerId: integer('customer_id').references(() => customers.id, { onDelete: 'cascade' }),
  adminId: integer('admin_id').references(() => admins.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  title: text('title').notNull(),
  message: text('message').notNull(),
  read: integer('read', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
}, (table) => [
  index('idx_notifications_customer').on(table.customerId, table.createdAt),
  index('idx_notifications_admin').on(table.adminId, table.createdAt),
]);

export const orders = sqliteTable('orders', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  reference: text('reference').notNull().unique(),
  customerId: integer('customer_id')
    .notNull()
    .references(() => customers.id),
  /**
   * Fulfilment only. Money lives on payments.status, so a paid order that has
   * not shipped is simply "processing" rather than a separate paid state.
   */
  status: text('status', {
    enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled'],
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
    phone: string;
    address: string;
    region: string;
    district: string | null;
    subCounty: string | null;
    parish: string | null;
    village: string | null;
  }>(),
  /**
   * Copied from the customer at order time rather than read back through a join.
   *
   * "Orders by district" and "find the order for this phone number" are the two
   * things staff do most, and both need an indexable column. The JSON
   * shipping_address above stays as the record of what was actually typed.
   */
  customerName: text('customer_name'),
  phone: text('phone'),
  region: text('region'),
  district: text('district'),

  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(datetime('now'))`),
}, (table) => [
  // Phase 4 reads these constantly. Without them every revenue-by-day query is
  // a full table scan.
  index('idx_orders_created').on(table.createdAt),
  index('idx_orders_status').on(table.status),
  index('idx_orders_customer').on(table.customerId),
  index('idx_orders_region').on(table.region),
  index('idx_orders_phone').on(table.phone),
]);

/**
 * Every fulfilment transition, in one place.
 *
 * This is the order timeline a customer sees and the audit trail staff rely on,
 * so it is written in the same transaction as the status change. `adminEmail`
 * is stored rather than joined, so the trail survives an admin being removed.
 */
export const orderStatusEvents = sqliteTable('order_status_events', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  orderId: integer('order_id')
    .notNull()
    .references(() => orders.id, { onDelete: 'cascade' }),
  fromStatus: text('from_status'),
  toStatus: text('to_status').notNull(),
  note: text('note'),
  changedByAdminId: integer('changed_by_admin_id').references(() => admins.id, {
    onDelete: 'set null',
  }),
  changedByEmail: text('changed_by_email'),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
}, (table) => [
  index('idx_order_events_order').on(table.orderId, table.createdAt),
]);

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
}, (table) => [
  index('idx_order_items_order').on(table.orderId),
  index('idx_order_items_product').on(table.productId),
]);

/**
 * Who supplies a product. Income is not modelled: this tracks what was
 * ordered and received, not what was paid, and the price per unit lives on
 * the purchase order line so a later supplier change does not rewrite history.
 */
export const suppliers = sqliteTable('suppliers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  contactName: text('contact_name'),
  phone: text('phone'),
  district: text('district'),
  region: text('region'),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const purchaseOrders = sqliteTable('purchase_orders', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  reference: text('reference').notNull().unique(),
  supplierId: integer('supplier_id')
    .notNull()
    .references(() => suppliers.id),
  status: text('status', { enum: ['draft', 'sent', 'received', 'cancelled'] })
    .notNull()
    .default('draft'),
  expectedAt: text('expected_at'),
  receivedAt: text('received_at'),
  note: text('note'),
  createdByAdminId: integer('created_by_admin_id').references(() => admins.id, {
    onDelete: 'set null',
  }),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const purchaseOrderItems = sqliteTable('purchase_order_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  purchaseOrderId: integer('purchase_order_id')
    .notNull()
    .references(() => purchaseOrders.id, { onDelete: 'cascade' }),
  productId: integer('product_id')
    .notNull()
    .references(() => products.id),
  quantity: integer('quantity').notNull(),
  unit: text('unit').notNull(),
  unitPrice: integer('unit_price').notNull(),
  /** Set when the goods actually land, which may differ from what was ordered. */
  receivedQuantity: integer('received_quantity'),
}, (table) => [
  index('idx_po_items_order').on(table.purchaseOrderId),
  index('idx_po_items_product').on(table.productId),
]);

/**
 * The stock ledger.
 *
 * Every change to products.stock writes a row here in the same transaction, so
 * SUM(delta) per product always equals the cached stock column. That identity
 * is what turns "27" into an explanation, and it is checkable at any moment
 * with the reconciliation query on /api/admin/inventory/reconciliation.
 */
export const stockMovements = sqliteTable('stock_movements', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  productId: integer('product_id')
    .notNull()
    .references(() => products.id),
  /** Signed. Negative leaves stock, positive brings it in. */
  delta: integer('delta').notNull(),
  reason: text('reason', {
    enum: ['opening', 'sale', 'delivery', 'adjustment', 'waste', 'return', 'correction'],
  }).notNull(),
  /** Order reference or purchase order reference, so a movement is traceable. */
  reference: text('reference'),
  note: text('note'),
  actorAdminId: integer('actor_admin_id').references(() => admins.id, {
    onDelete: 'set null',
  }),
  actorLabel: text('actor_label'),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
}, (table) => [
  index('idx_movements_product').on(table.productId, table.createdAt),
  index('idx_movements_created').on(table.createdAt),
  index('idx_movements_reason').on(table.reason),
  index('idx_movements_reference').on(table.reference),
]);

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
   * rows. `Town` marks a district headquarters added from the fallback
   * coordinate table, which carries no outline.
   */
  kind: text('kind', { enum: ['District', 'City', 'Municipality', 'Town'] })
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
  /**
   * SHA-256 of a one-time token handed to the client that created this intent.
   *
   * Mobile money approval is asynchronous, and until a real gateway exists the
   * browser reports the outcome itself. Without this, anyone able to guess a
   * reference could mark any payment succeeded. The hash is cleared once the
   * intent settles, so the token cannot be replayed.
   */
  settlementTokenHash: text('settlement_token_hash'),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
export type ProductPriceHistory = typeof productPriceHistory.$inferSelect;
export type NewProductPriceHistory = typeof productPriceHistory.$inferInsert;
export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;
export type CustomerSession = typeof customerSessions.$inferSelect;
export type NewCustomerSession = typeof customerSessions.$inferInsert;
export type Cart = typeof carts.$inferSelect;
export type CartItem = typeof cartItems.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
export type OrderStatusEvent = typeof orderStatusEvents.$inferSelect;
export type StockMovement = typeof stockMovements.$inferSelect;
export type NewStockMovement = typeof stockMovements.$inferInsert;
export type Supplier = typeof suppliers.$inferSelect;
export type PurchaseOrder = typeof purchaseOrders.$inferSelect;
export type PurchaseOrderItem = typeof purchaseOrderItems.$inferSelect;
export type Region = typeof regions.$inferSelect;
export type District = typeof districts.$inferSelect;
export type SubCounty = typeof subCounties.$inferSelect;
export type Parish = typeof parishes.$inferSelect;
export type Village = typeof villages.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;
export type Admin = typeof admins.$inferSelect;
export type AdminSession = typeof adminSessions.$inferSelect;
export type AdminLoginAttempt = typeof adminLoginAttempts.$inferSelect;
export type AdminActivityLog = typeof adminActivityLog.$inferSelect;
export type NewAdminActivityLog = typeof adminActivityLog.$inferInsert;
export type CustomerPreferences = typeof customerPreferences.$inferSelect;
export type NewCustomerPreferences = typeof customerPreferences.$inferInsert;
export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;