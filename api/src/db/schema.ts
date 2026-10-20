import { sql } from 'drizzle-orm';
import { boolean, doublePrecision, index, integer, jsonb, pgTable, serial, text, unique } from 'drizzle-orm/pg-core';

/** UTC timestamp as 'YYYY-MM-DD HH:MM:SS', the format every query and comparison in the app expects. */
export const nowText = sql`to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS')`;

export const products = pgTable('products', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  farm: text('farm').notNull(),
  location: text('location').notNull(),
  priceValue: integer('price_value').notNull(),
  priceLabel: text('price_label').notNull(),
  currency: text('currency').notNull().default('UGX'),
  unit: text('unit').notNull(),
  imageFiles: jsonb('image_files').notNull().$type<string[]>(),
  dietary: jsonb('dietary').notNull().$type<string[]>(),
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
  active: boolean('active').notNull().default(true),
  createdAt: text('created_at')
    .notNull()
    .default(nowText),
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
export const productPriceHistory = pgTable('product_price_history', {
  id: serial('id').primaryKey(),
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
    .default(nowText),
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
export const customers = pgTable('customers', {
  id: serial('id').primaryKey(),
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
  active: boolean('active').notNull().default(true),
  createdAt: text('created_at')
    .notNull()
    .default(nowText),
});

/**
 * The customer's address book.
 *
 * The profile row keeps the address used when none is chosen; this table holds
 * the alternatives a shopper wants to reuse at checkout, such as a workplace
 * or a relative's home. Phone and name are stored per entry because a saved
 * address is often for somebody else.
 */
export const customerAddresses = pgTable('customer_addresses', {
  id: serial('id').primaryKey(),
  customerId: integer('customer_id')
    .notNull()
    .references(() => customers.id, { onDelete: 'cascade' }),
  label: text('label').notNull(),
  fullName: text('full_name').notNull(),
  phone: text('phone').notNull(),
  region: text('region').notNull(),
  district: text('district'),
  subCounty: text('sub_county'),
  parish: text('parish'),
  village: text('village'),
  address: text('address').notNull(),
  isDefault: boolean('is_default').notNull().default(false),
  createdAt: text('created_at')
    .notNull()
    .default(nowText),
}, (table) => [
  index('idx_customer_addresses_customer').on(table.customerId),
]);

export const customerSessions = pgTable('customer_sessions', {
  id: serial('id').primaryKey(),
  customerId: integer('customer_id')
    .notNull()
    .references(() => customers.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(),
  userAgent: text('user_agent'),
  expiresAt: text('expires_at').notNull(),
  createdAt: text('created_at')
    .notNull()
    .default(nowText),
});

export const carts = pgTable('carts', {
  id: serial('id').primaryKey(),
  customerId: integer('customer_id').references(() => customers.id, {
    onDelete: 'set null',
  }),
  status: text('status', {
    enum: ['active', 'checkout', 'converted', 'abandoned'],
  })
    .notNull()
    .default('active'),
  /** SHA-256 of the mk_cart cookie. Only the holder of that cookie can read or change the cart. */
  ownerTokenHash: text('owner_token_hash'),
  createdAt: text('created_at')
    .notNull()
    .default(nowText),
  updatedAt: text('updated_at')
    .notNull()
    .default(nowText),
});

export const cartItems = pgTable('cart_items', {
  id: serial('id').primaryKey(),
  cartId: integer('cart_id')
    .notNull()
    .references(() => carts.id, { onDelete: 'cascade' }),
  productId: integer('product_id')
    .notNull()
    .references(() => products.id, { onDelete: 'cascade' }),
  quantity: integer('quantity').notNull().default(1),
  createdAt: text('created_at')
    .notNull()
    .default(nowText),
});

/**
 * Staff accounts. Separate from customers: an admin can change the catalogue
 * and adjust stock, so the credential is stored apart and never returned by
 * any endpoint.
 *
 * The first account is seeded from ADMIN_EMAIL and ADMIN_PASSWORD in the
 * environment. No credential is committed to the repository.
 */
export const admins = pgTable('admins', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  passwordHash: text('password_hash').notNull(),
  role: text('role', { enum: ['owner', 'manager', 'staff'] }).notNull().default('manager'),
  active: boolean('active').notNull().default(true),
  createdAt: text('created_at')
    .notNull()
    .default(nowText),
  lastLoginAt: text('last_login_at'),
});

/**
 * An opaque session. The token itself is never stored, only its SHA-256, so a
 * database copy cannot be used to sign in.
 */
export const adminSessions = pgTable('admin_sessions', {
  id: serial('id').primaryKey(),
  adminId: integer('admin_id')
    .notNull()
    .references(() => admins.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: text('expires_at').notNull(),
  createdAt: text('created_at')
    .notNull()
    .default(nowText),
  userAgent: text('user_agent'),
});

/**
 * Failed sign-in attempts, used to slow down password guessing. Kept in the
 * database rather than in memory so a restart does not hand an attacker a fresh
 * allowance.
 */
export const adminLoginAttempts = pgTable('admin_login_attempts', {
  id: serial('id').primaryKey(),
  email: text('email').notNull(),
  succeeded: boolean('succeeded').notNull().default(false),
  createdAt: text('created_at')
    .notNull()
    .default(nowText),
});

/**
 * Append-only audit trail for admin actions.
 *
 * Every meaningful mutation — product update, order status change, inventory
 * adjustment, purchase order receipt — is recorded here so the activity feed
 * and the export endpoint can answer "who did what, and when" without
 * reconstructing it from business tables.
 */
export const adminActivityLog = pgTable('admin_activity_log', {
  id: serial('id').primaryKey(),
  adminId: integer('admin_id').references(() => admins.id, { onDelete: 'set null' }),
  action: text('action').notNull(),
  entity: text('entity').notNull(),
  entityId: text('entity_id'),
  before: jsonb('before'),
  after: jsonb('after'),
  createdAt: text('created_at')
    .notNull()
    .default(nowText),
}, (table) => [
  index('idx_activity_admin').on(table.adminId, table.createdAt),
  index('idx_activity_entity').on(table.entity, table.entityId),
]);

export const customerPreferences = pgTable('customer_preferences', {
  customerId: integer('customer_id')
    .notNull()
    .references(() => customers.id, { onDelete: 'cascade' }),
  preferences: jsonb('preferences').notNull().default({}),
  updatedAt: text('updated_at')
    .notNull()
    .default(nowText),
}, (table) => [
  index('idx_customer_preferences_customer').on(table.customerId),
]);

export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  customerId: integer('customer_id').references(() => customers.id, { onDelete: 'cascade' }),
  adminId: integer('admin_id').references(() => admins.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  title: text('title').notNull(),
  message: text('message').notNull(),
  read: boolean('read').notNull().default(false),
  createdAt: text('created_at')
    .notNull()
    .default(nowText),
}, (table) => [
  index('idx_notifications_customer').on(table.customerId, table.createdAt),
  index('idx_notifications_admin').on(table.adminId, table.createdAt),
]);

/**
 * Discount campaigns. The rule lives here; orders keep the resolved discount
 * and the code that produced it, so past totals never change when a campaign
 * is edited or withdrawn.
 */
export const promoCodes = pgTable('promo_codes', {
  id: serial('id').primaryKey(),
  /** Normalised to upper case, no spaces. */
  code: text('code').notNull().unique(),
  description: text('description').notNull().default(''),
  kind: text('kind', { enum: ['percent', 'fixed'] }).notNull(),
  /** Percent off (1-100) or shillings off, depending on kind. */
  value: integer('value').notNull(),
  /** Below this subtotal the code is refused. */
  minSubtotal: integer('min_subtotal').notNull().default(0),
  /** Caps a percent code; null means no cap. */
  maxDiscount: integer('max_discount'),
  active: boolean('active').notNull().default(true),
  /** UTC "YYYY-MM-DD HH:MM:SS", same as every other timestamp here. */
  startsAt: text('starts_at'),
  endsAt: text('ends_at'),
  /** Redemptions across all customers; null means unlimited. */
  usageLimit: integer('usage_limit'),
  usedCount: integer('used_count').notNull().default(0),
  /** Redemptions per customer or phone number; null means unlimited. */
  perCustomerLimit: integer('per_customer_limit'),
  createdAt: text('created_at').notNull().default(nowText),
});

export const orders = pgTable('orders', {
  id: serial('id').primaryKey(),
  reference: text('reference').notNull().unique(),
  /** Null for guest orders; guests prove ownership with the tracking token instead. */
  customerId: integer('customer_id').references(() => customers.id),
  cartId: integer('cart_id').references(() => carts.id, { onDelete: 'set null' }),
  /** SHA-256 of the one-time guest tracking token. */
  trackingTokenHash: text('tracking_token_hash'),
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
  /** Promo discount resolved at order time; the rule is kept on promo_codes. */
  discount: integer('discount').notNull().default(0),
  promoCode: text('promo_code'),
  shipping: integer('shipping').notNull().default(0),
  tax: integer('tax').notNull().default(0),
  total: integer('total').notNull(),
  currency: text('currency').notNull().default('UGX'),
  shippingAddress: jsonb('shipping_address').notNull().$type<{
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
    .default(nowText),
  updatedAt: text('updated_at')
    .notNull()
    .default(nowText),
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
export const orderStatusEvents = pgTable('order_status_events', {
  id: serial('id').primaryKey(),
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
    .default(nowText),
}, (table) => [
  index('idx_order_events_order').on(table.orderId, table.createdAt),
]);

export const orderItems = pgTable('order_items', {
  id: serial('id').primaryKey(),
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
export const suppliers = pgTable('suppliers', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  contactName: text('contact_name'),
  phone: text('phone'),
  district: text('district'),
  region: text('region'),
  active: boolean('active').notNull().default(true),
  createdAt: text('created_at')
    .notNull()
    .default(nowText),
});

export const purchaseOrders = pgTable('purchase_orders', {
  id: serial('id').primaryKey(),
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
    .default(nowText),
});

export const purchaseOrderItems = pgTable('purchase_order_items', {
  id: serial('id').primaryKey(),
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
export const stockMovements = pgTable('stock_movements', {
  id: serial('id').primaryKey(),
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
    .default(nowText),
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
export const regions = pgTable('regions', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  isoCode: text('iso_code'),
  centroidLat: doublePrecision('centroid_lat').notNull(),
  centroidLng: doublePrecision('centroid_lng').notNull(),
  bboxSouth: doublePrecision('bbox_south').notNull(),
  bboxWest: doublePrecision('bbox_west').notNull(),
  bboxNorth: doublePrecision('bbox_north').notNull(),
  bboxEast: doublePrecision('bbox_east').notNull(),
  hasGeometry: boolean('has_geometry').notNull().default(true),
});

export const districts = pgTable('districts', {
  id: serial('id').primaryKey(),
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
  centroidLat: doublePrecision('centroid_lat').notNull(),
  centroidLng: doublePrecision('centroid_lng').notNull(),
  bboxSouth: doublePrecision('bbox_south').notNull(),
  bboxWest: doublePrecision('bbox_west').notNull(),
  bboxNorth: doublePrecision('bbox_north').notNull(),
  bboxEast: doublePrecision('bbox_east').notNull(),
  hasGeometry: boolean('has_geometry').notNull().default(true),
}, (table) => [
  unique('districts_name_region_kind_unique').on(table.name, table.regionId, table.kind),
]);

export const subCounties = pgTable('sub_counties', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  districtId: integer('district_id')
    .notNull()
    .references(() => districts.id, { onDelete: 'cascade' }),
  centroidLat: doublePrecision('centroid_lat'),
  centroidLng: doublePrecision('centroid_lng'),
  hasGeometry: boolean('has_geometry').notNull().default(false),
}, (table) => [
  unique('sub_counties_name_district_unique').on(table.name, table.districtId),
]);

export const parishes = pgTable('parishes', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  subCountyId: integer('sub_county_id')
    .notNull()
    .references(() => subCounties.id, { onDelete: 'cascade' }),
  centroidLat: doublePrecision('centroid_lat'),
  centroidLng: doublePrecision('centroid_lng'),
  hasGeometry: boolean('has_geometry').notNull().default(false),
}, (table) => [
  unique('parishes_name_sub_county_unique').on(table.name, table.subCountyId),
]);

/**
 * Lowest civil-administrative unit in Uganda, overseen by the Local Council 1
 * chairperson. Villages are addressed by name and a landmark rather than by
 * outline, which is why there is no geometry.
 */
export const villages = pgTable('villages', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  parishId: integer('parish_id')
    .notNull()
    .references(() => parishes.id, { onDelete: 'cascade' }),
  hasGeometry: boolean('has_geometry').notNull().default(false),
}, (table) => [
  unique('villages_name_parish_unique').on(table.name, table.parishId),
]);

/**
 * A payment attempt against an order. Mobile money in Uganda is asynchronous:
 * the customer approves a USSD prompt on their handset, so the intent sits in
 * `pending` until the provider calls back or the client polls.
 */
export const payments = pgTable('payments', {
  id: serial('id').primaryKey(),
  reference: text('reference').notNull().unique(),
  orderId: integer('order_id').references(() => orders.id, { onDelete: 'set null' }),
  cartId: integer('cart_id').references(() => carts.id, { onDelete: 'set null' }),
  channel: text('channel', { enum: ['mobile_money', 'card', 'wallet', 'cod'] }).notNull(),
  provider: text('provider').notNull(),
  status: text('status', {
    enum: ['pending', 'awaiting_approval', 'processing', 'succeeded', 'failed', 'cancelled', 'cod'],
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
    .default(nowText),
  updatedAt: text('updated_at')
    .notNull()
    .default(nowText),
});

/** Fixed-window counters for rate limiting. Keyed `${scope}:${subject}:${bucket}`. */
export const rateLimits = pgTable('rate_limits', {
  id: text('id').primaryKey(),
  count: integer('count').notNull().default(1),
  expiresAt: integer('expires_at').notNull(),
}, (table) => [index('idx_rate_limits_expires').on(table.expiresAt)]);

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
