# Admin Dashboard Roadmap

Technical plan for expanding the staff area beyond the product editor that
exists today. Priorities are ordered by dependency, not by appeal: several of
the later phases cannot be built correctly until earlier ones exist.

---

## Phase 0 — Close a live authorisation hole — DONE

**Status: implemented and verified.**

This was not a feature. `PATCH /api/orders/:id` performed no authentication, so
anyone who could reach the API could mark any order `fulfilled` or `cancelled`.
It was confirmed against a real order before the fix, and returns 405 now.

An audit of every mutating route found three open endpoints, not one:

| Route | Problem | Now |
| --- | --- | --- |
| `PATCH /api/orders/:id` | no auth; anyone could fulfil or cancel any order | removed; `PATCH /api/admin/orders/:id` requires a session |
| `GET /api/orders` | returned every order with name, phone and full address | removed; `GET /api/admin/orders` requires a session |
| `PATCH /api/inventory` | no auth; anyone could set stock to any value | removed; `PATCH /api/admin/inventory/products/:id` requires a session and a reason |
| `PATCH /api/payments/intents` | no auth; anyone could mark a payment succeeded | requires a one-time settlement token |

### Payment settlement capability token

Mobile money approval is asynchronous and, until a real gateway exists, the
browser that opened the intent reports the outcome. That must not mean any
browser can.

`POST /api/payments/intents` now issues a one-time token, returns it once, and
stores only its SHA-256 in `payments.settlement_token_hash`. Settling requires
that token, compared in constant time, and clears the hash so it cannot be
replayed. A reference on its own is no longer enough.

### Order status is now fulfilment only

The enum changed from `pending | paid | fulfilled | cancelled` to
`pending | processing | shipped | delivered | cancelled`. Money lives on
`payments.status`, so payment outcome no longer writes a fulfilment state, and
a paid order that has not shipped is simply `processing`.

Transitions are validated server-side against `api/src/lib/orderFlow.ts`,
because the UI is not the only thing that can call the API:

```
pending    -> processing | cancelled
processing -> shipped | cancelled
shipped    -> delivered | cancelled
delivered  -> (terminal)
cancelled  -> (terminal)
```

An illegal move returns 409 and names the legal ones.

### Added

- `orders.updated_at`, needed by the status transitions
- `payments.settlement_token_hash`

### Verification

44 assertions against a live server: the three removed routes answer 405, the
attacked order is unchanged afterwards, settlement without a token returns 422
and with a wrong one 403, the real token settles exactly once and cannot be
replayed, staff routes work with a session and refuse without one, illegal
transitions are rejected, stock adjustment demands a reason and refuses to go
negative, and the reads the shop depends on stayed public.

### Not done here

`order_status_events` and the order queue UI are Phase 1. The admin order
routes exist and are authorised, but nothing calls them yet.

---

## Phase 1 — Order Management

### Functional requirements

1. **Live queue.** Orders appear without a manual refresh, newest first,
   filterable by status and by fulfilment region.
2. **Controlled transitions.** A defined state machine, so an order cannot jump
   from `pending` to `delivered`, and a delivered order cannot silently become
   cancelled.
3. **Timeline.** Every transition recorded with who did it and when, plus an
   optional note ("rider called, customer rescheduled").
4. **History.** Completed orders retained and searchable by reference, phone
   number or customer name.
5. **Integrity checks.** Stock already draws down atomically at order time and
   refuses to oversell. Every other transition must respect existing
   invariants: cancelling returns stock via a ledger entry (Phase 2), never by
   hand-editing `products.stock`.

### Schema

**Split fulfilment from payment.** They are different axes and the current enum
conflates them:

| Table | Now | Should own |
| --- | --- | --- |
| `orders.status` | `pending \| paid \| fulfilled \| cancelled` | fulfilment only |
| `payments.status` | `pending \| awaiting_approval \| processing \| succeeded \| failed \| cancelled` | money |

`orders.status` becomes:
`pending → processing → shipped → delivered`, with `cancelled` reachable from
any state before `delivered`. A paid-but-not-shipped order is then simply
`processing`, which is unambiguous.

**New table `order_status_events`** — the timeline and the audit trail in one:

```sql
CREATE TABLE order_status_events (
  id          INTEGER PRIMARY KEY,
  order_id    INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status   TEXT    NOT NULL,
  note        TEXT,
  changed_by  INTEGER REFERENCES admins(id),   -- null for system transitions
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_order_events_order ON order_status_events(order_id, created_at);
```

**Denormalise location onto `orders`.** `shippingAddress` is a JSON blob, so
"sales by district" cannot be indexed or grouped efficiently. Add real columns:

```sql
ALTER TABLE orders ADD COLUMN region   TEXT;
ALTER TABLE orders ADD COLUMN district TEXT;
ALTER TABLE orders ADD COLUMN phone    TEXT;   -- copy of customer phone
ALTER TABLE orders ADD COLUMN confirmed_at  TEXT;
ALTER TABLE orders ADD COLUMN shipped_at    TEXT;
ALTER TABLE orders ADD COLUMN delivered_at  TEXT;
```

Write these from `customers` at order time; the JSON blob can stay for
display, but nothing analytical should read it.

**Indexes.** The schema currently has *no* indexes except unique constraints,
so every lookup is a full table scan:

```sql
CREATE INDEX idx_orders_created  ON orders(created_at);
CREATE INDEX idx_orders_status   ON orders(status);
CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_orders_region   ON orders(region);
CREATE INDEX idx_order_items_order   ON order_items(order_id);
CREATE INDEX idx_order_items_product ON order_items(product_id);
```

### Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/admin/orders` | List; `?status=`, `?region=`, `?from=`, `?to=`, `?q=` |
| `GET` | `/api/admin/orders/:idOrRef` | One order with items, payments, timeline |
| `PATCH` | `/api/admin/orders/:idOrRef` | `{ status, note }`, validated transition |
| `GET` | `/api/admin/events` | SSE stream for live updates |

### Real-time

Use **Server-Sent Events**, not WebSockets. Next.js route handlers stream
natively, SSE survives the Vite proxy, and it reconnects on its own. WebSockets
would need a custom server and buy nothing here.

Emit on order creation and on every status change:

```
event: order
data: {"reference":"GRC-…","status":"processing", …}
```

Poll every 10–15s as the fallback when the stream is unavailable.

### Acceptance criteria

- An unauthenticated `PATCH` returns 401
- `pending → delivered` is rejected with the valid next states listed
- Every transition writes an `order_status_events` row
- A new order reaches an open dashboard without a refresh, within 2s
- Cancelling an order returns its stock and leaves an auditable ledger entry

---

## Phase 2 — Inventory & Stock Management

### The core gap

`products.stock` is a single integer with no history. `PATCH /api/inventory`
accepts a `reason` and echoes it straight back in its response metadata, so the
caller sees its own words again — but it is never written anywhere, and the
adjustment leaves no trace. There is no record of what came in, what went out or
why, so "track fluctuations in goods" is not answerable from the current data.

### Schema

**`stock_movements` is the ledger. `products.stock` becomes a cached total.**

```sql
CREATE TABLE stock_movements (
  id             INTEGER PRIMARY KEY,
  product_id     INTEGER NOT NULL REFERENCES products(id),
  delta          INTEGER NOT NULL,          -- negative leaves stock
  reason         TEXT NOT NULL,             -- sale|delivery|adjustment|waste|return|correction
  reference      TEXT,                      -- order reference or PO number
  note           TEXT,
  actor_admin_id INTEGER REFERENCES admins(id),  -- null for system entries
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_movements_product ON stock_movements(product_id, created_at);
CREATE INDEX idx_movements_created ON stock_movements(created_at);
```

Every write to `products.stock` must be accompanied by a movement row, inside
the same transaction. That is what makes stock reconcilable:

```sql
SELECT p.name, p.stock,
       COALESCE(SUM(m.delta), 0) AS ledger_total
FROM products p LEFT JOIN stock_movements m ON m.product_id = p.id
GROUP BY p.id
HAVING p.stock <> COALESCE(SUM(m.delta), 0);   -- should return nothing
```

**Per-product thresholds.** The low-stock threshold is hardcoded to `10` in
`api/src/lib/stock.ts`, so a 5kg product and a 300kg product share one trigger.

```sql
ALTER TABLE products ADD COLUMN low_stock_threshold  INTEGER;
ALTER TABLE products ADD COLUMN reorder_quantity     INTEGER;
ALTER TABLE products ADD COLUMN supplier_id          INTEGER REFERENCES suppliers(id);
```

**Suppliers and purchase orders**, which is what real inflow needs:

```sql
CREATE TABLE suppliers (
  id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE,
  phone TEXT, district TEXT, region TEXT, active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE purchase_orders (
  id INTEGER PRIMARY KEY, reference TEXT NOT NULL UNIQUE,
  supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
  status TEXT NOT NULL DEFAULT 'draft',   -- draft|sent|received|cancelled
  expected_at TEXT, received_at TEXT, note TEXT,
  created_by INTEGER REFERENCES admins(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE purchase_order_items (
  id INTEGER PRIMARY KEY,
  purchase_order_id INTEGER NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL, unit TEXT NOT NULL, unit_price INTEGER NOT NULL
);
```

Receiving a PO writes `stock_movements` rows with `reason='delivery'`. That is
inflow, and it is auditable, unlike today's `PATCH /api/inventory`.

### Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/inventory` | Extend with `?supplier=`, `?lowStock=`, `?threshold=` |
| `GET` | `/api/admin/inventory/movements` | Ledger; `?productId=`, `?from=`, `?to=`, `?reason=` |
| `GET` | `/api/admin/inventory/reconciliation` | Rows where `stock <> SUM(delta)` |
| `PATCH` | `/api/admin/inventory/products/:id` | Threshold, reorder quantity, supplier |
| `GET`/`POST` | `/api/admin/suppliers` | List and create |
| `GET`/`POST` | `/api/admin/purchase-orders` | List and raise |
| `POST` | `/api/admin/purchase-orders/:id/receive` | Stock in, ledger rows written |

Note `PATCH /api/inventory` is currently unauthenticated in effect: any caller
can set stock to any value. It must move under `/api/admin` too, or take a
session. This is the second instance of the Phase 0 problem.

### Alerts

Low-stock alerts should be **derived, not stored** — a query over
`stock <= low_stock_threshold`, surfaced on the dashboard and emailed on a
schedule. A stored `low_stock_alert` table goes stale the moment stock moves and
will disagree with the ledger.

### Acceptance criteria

- Every stock change in the system leaves exactly one movement row
- Reconciliation returns an empty set after a scripted day of orders and POs
- Receiving a PO increases stock and writes `reason='delivery'`
- Each product's threshold is honoured independently
- An order cancellation returns stock via the ledger, and the movement's
  `reference` is the order reference

---

## Phase 3 — Dynamic Product Management

**Partly exists.** `GET/POST /api/admin/products` and
`PATCH/DELETE /api/admin/products/:id` are done, including generated slugs,
derived price labels and image uploads. Remaining work:

### Requirements

1. **Price history.** A price change is currently silent. Store it so a
   dispute can be settled and so analytics can see the effect.
2. **Stock adjustment reasons.** Today `PATCH /api/admin/products/:id` accepts
   a bare `stock`, which overwrites history. It must become a `delta` and write
   a movement row.
3. **Bulk edit.** Set price or threshold across a filtered selection — a
   supplier price rise is otherwise dozens of requests.
4. **Optimistic concurrency.** Two staff editing one product currently last-write-wins.
   An `updated_at` check with `409` prevents silent loss.

### Schema

```sql
CREATE TABLE product_price_history (
  id INTEGER PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  price_value INTEGER NOT NULL, unit TEXT NOT NULL, price_label TEXT NOT NULL,
  changed_by INTEGER REFERENCES admins(id), created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_price_history_product ON product_price_history(product_id, created_at);
```

Add `products.updated_at`, and stop `PATCH` accepting a raw `stock` outright.

### Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/admin/products/:id/price-history` | Ordered list of changes |
| `PATCH` | `/api/admin/products/bulk` | `{ ids, changes }`, one audit entry each |
| `POST` | `/api/admin/products/:id/restore` | Alias for `{active: true}`, clearer intent |

### Acceptance criteria

- Changing a price writes a history row and never overwrites `stock` silently
- A stale `updated_at` is rejected with 409
- Bulk edit reports per-product success and failure rather than all-or-nothing

---

## Phase 4 — Analytics & Reporting

### Requirements

1. **Sales trends** — revenue and units by day/week/month, with
   period-over-period comparison.
2. **Product performance** — top and declining lines, contribution margin.
3. **Regional demand** — where orders come from, to inform where to expand
   delivery.
4. **Inventory health** — stockouts, slow movers, days of cover.
5. **Revenue forecasting** — trailing average and same-period-last-year.
6. **Activity audit** — who changed a price, who cancelled an order.

### Schema

Only one new table is genuinely needed:

```sql
CREATE TABLE admin_activity_log (
  id INTEGER PRIMARY KEY,
  admin_id INTEGER REFERENCES admins(id),
  action TEXT NOT NULL,          -- product.update | order.cancel | inventory.adjust
  entity TEXT NOT NULL,          -- product | order | purchase_order
  entity_id TEXT,
  before TEXT,                   -- JSON snapshot
  after  TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_activity_admin ON admin_activity_log(admin_id, created_at);
CREATE INDEX idx_activity_entity ON admin_activity_log(entity, entity_id);
```

The rest is **reading the existing data well**, which is why Phase 1's
denormalised `orders.region`/`district` and the Phase 0 indexes matter so much
here. Revenue-by-day over an unindexed `created_at` is a table scan per query.

Do not pre-aggregate into daily rollup tables yet. At expected volume a couple
of thousand orders a month, indexed queries are simpler and always current;
materialised summaries add invalidation bugs for no measurable gain. Revisit
only if a query is measurably slow.

### Endpoints

| Method | Path | Returns |
| --- | --- | --- |
| `GET` | `/api/admin/analytics/sales` | `?from=&to=&bucket=day\|week\|month` |
| `GET` | `/api/admin/analytics/products` | Top sellers, margin, declining lines |
| `GET` | `/api/admin/analytics/regions` | Orders and revenue by district |
| `GET` | `/api/admin/analytics/forecast` | Trailing averages, projected cover |
| `GET` | `/api/admin/analytics/activity` | Audit trail |
| `GET` | `/api/admin/analytics/export` | CSV of any of the above |

### Forecasting, honestly

A first version should be a **trailing average**, labelled as such. Anything
presented as prediction on a few months of data is misleading. Genuine
forecasting needs seasonality by product category, and Uganda's market-day and
harvest cycles will dominate — so a forecast that ignores them will be wrong in
a way a buyer will notice.

Minimum viable and defensible:

- Revenue by trailing 7 and 30 days, against the same windows last period
- Days of cover per product at current run rate
- Seasonality flags from known harvest cycles, entered by staff rather than
  inferred

### Acceptance criteria

- Every figure traces to order and ledger rows that can be listed individually
- Comparing a period twice returns identical numbers
- Export and on-screen figures agree
- Every number is labelled with its period and unit

---

## Summary

| Phase | Depends on | Risk if skipped |
| --- | --- | --- |
| 0 — authorise order mutation | nothing | Anyone can fulfil or cancel orders |
| 1 — order management | 0 | No controlled fulfilment, no audit trail |
| 2 — stock ledger | 1 | Stock changes are unexplainable and unreconcilable |
| 3 — product changes | 2 | Price edits are silent, stock edits destroy history |
| 4 — analytics | 1, 2, 3 | Full table scans; no forecast worth the name |

## Notes on what is deliberately not included

- **Supplier invoices as images.** Needs object storage and a decision about who
  holds the original document.
- **Multi-warehouse stock.** `products.stock` assumes one location. Separate
  per-location stock means the column moves to `(product_id, location_id)` and
  every order draw-down picks one.
- **Customer accounts.** `customers` is keyed on phone with no password. Saved
  baskets and reorder history do not need one; a customer login does.
