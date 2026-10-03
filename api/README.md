# Grocery API

Backend for the Interactive Grocery Mobile App. Next.js 15 route handlers over
SQLite via Drizzle ORM.

This folder is **fully independent** of the Vite frontend in `../`. It has its
own `package.json`, `node_modules` and lockfile. Nothing in the frontend imports
from here, and deleting this folder does not affect the frontend build.

## Stack

| Concern | Choice | Why |
| --- | --- | --- |
| Runtime | Next.js 15.5.27 (route handlers only) | `react: ^18.2.0` is still supported, so it matches the frontend's React 18.3.1 exactly |
| Database | SQLite via `@libsql/client` | Pure JS, no native build step, and swapping to a hosted Turso URL needs no code change |
| ORM | Drizzle 0.45 | Type-safe schema, SQL you can read |
| Validation | Zod 4 | Request bodies are parsed and typed at the boundary |

## Running it

```bash
npm install --prefix api   # once
npm run db:push   --prefix api   # create tables
npm run db:seed   --prefix api   # load the 9 products
npm run dev       --prefix api   # http://localhost:3000
```

Other scripts:

```bash
npm run db:studio    --prefix api   # browse the database in a web UI
npm run db:reset     --prefix api   # drop, recreate and reseed
npm run build        --prefix api   # production build
npm run start        --prefix api   # serve the production build
```

The database file is `api/local.db` (gitignored).

## Endpoints

Base URL `http://localhost:3000`.

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/api/products` | `?search=`, `?includeInactive=true` |
| `GET` | `/api/products/:idOrSlug` | Accepts numeric id or slug |
| `POST` | `/api/customers` | Upsert by email, returns `201` new / `200` updated |
| `GET` | `/api/customers?email=` | Lookup by email |
| `POST` | `/api/cart` | Create a cart, optionally with `customerId` |
| `GET` | `/api/cart?cartId=` | Cart plus computed `itemCount` and `subtotal` |
| `POST` | `/api/cart/items` | `{ cartId, productId, quantity }`, merges duplicates |
| `PATCH` | `/api/cart` | `{ cartId, productId, quantity }`, `quantity: 0` removes the line |
| `POST` | `/api/orders` | `{ cartId, customerId, status? }`, converts the cart in a transaction |
| `GET` | `/api/orders?customerId=` or `?reference=` | List orders |
| `GET` | `/api/orders/:idOrRef` | Order with its line items |
| `PATCH` | `/api/orders/:idOrRef` | `{ status }`, one of `pending`/`paid`/`fulfilled`/`cancelled` |
| `GET` | `/api/assets/:file` | Serves product images out of `../src/assets` |

Errors return `{ "error": string }` with a meaningful status: `400` missing or
malformed params, `404` unknown record, `409` illegal state transition, `422`
failed validation.

## Worked example

```bash
API=http://localhost:3000

# Catalogue
curl -s "$API/api/products" | jq '.meta'
curl -s "$API/api/products/ginger" | jq '.data'

# Customer
curl -s -X POST "$API/api/customers" -H 'content-type: application/json' -d '{
  "email":"grace@example.com","fullName":"Grace Hopper",
  "address":"1 Compiler Ct","city":"Arlington","state":"VA","zipCode":"22202"
}' | jq '.data.id'

# Cart
curl -s -X POST "$API/api/cart" -H 'content-type: application/json' \
  -d '{"customerId":1}' | jq '.data.id'

curl -s -X POST "$API/api/cart/items" -H 'content-type: application/json' \
  -d '{"cartId":1,"productId":1,"quantity":2}' | jq '.data.subtotal'

# Checkout
curl -s -X POST "$API/api/orders" -H 'content-type: application/json' \
  -d '{"cartId":1,"customerId":1,"status":"paid"}' | jq '.data.reference'
```

## Currency

All money is **Ugandan shillings (UGX)** stored as whole numbers. The shilling
has no minor unit in common use, so every money column is `integer` and no
endpoint ever returns a fractional amount.

| Column | Type |
| --- | --- |
| `products.price_value` | `integer` |
| `orders.subtotal` / `shipping` / `tax` / `total` | `integer` |
| `order_items.price_value` / `line_total` | `integer` |

Both `products` and `orders` carry a `currency` column (default `UGX`) so a
future multi-currency store does not need a migration. Product responses expose
it as `currency` alongside `price`.

The catalogue was converted from the original USD figures in
`src/app/App.tsx` at **3,960 UGX per USD** (mid-market, 2026-10-03). Line totals
are `priceValue * quantity` on integers rather than a converted float, so
quantities never accumulate rounding drift and the line totals always sum
exactly to the cart subtotal.

Tax is still `8.25%`. That is the original US-style rate carried over; Uganda's
VAT is 18%, so change `TAX_RATE` in `api/src/app/api/orders/route.ts` if you
want local rates.

## The frontend cart

The cart is wired to this API. `src/app/lib/cartApi.ts` is the client, and
`src/app/App.tsx` holds the cart id in a ref and syncs on every mutation:

| Action | Call |
| --- | --- |
| Page load | `resolveCartId()` then `GET /api/cart?cartId=` |
| Add to basket | `POST /api/cart/items` |
| Change quantity | `PATCH /api/cart` |
| Completed purchase | `resetCart()`, which clears the lines and issues a new cart |

The cart id is kept in `localStorage` under `mu-katale.cartId`, so a refresh
restores the basket. `resolveCartId` recreates the cart if the stored one no
longer exists, which happens after `npm run db:reset`.

**Updates are optimistic.** The local `useState` cart updates first and the
request follows, so the interface never waits on the network. Every call in
`cartApi.ts` returns `null` instead of throwing when the API is unreachable, so
with the backend stopped the app still works as a purely local cart.

Cart lines are always rebuilt from the frontend's own catalogue via
`buildCartItem`, whether they come from a tap or from the API on reload. That
keeps names, prices and images identical to the product list. It also means the
frontend and the seed must agree on product ids and price labels, which the two
currently do.

The Vite dev server proxies `/api` to `http://localhost:3000` (see
`vite.config.ts`), so the browser sees a single origin and there is no CORS to
configure in development. In production on separate domains, add CORS headers
to the route handlers instead.

Orders are not wired up yet: `POST /api/orders` still needs a `customerId`, and
the checkout form is not yet creating a customer. A completed purchase empties
the cart rather than converting it into an order.

## Geography and payments

### Endpoints

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/api/inventory` | Live stock per product, with unit and state |
| `GET` | `/api/inventory?lowStock=true` | Only what is low or out |
| `GET` | `/api/inventory?summary=true` | Counts by state, for a dashboard |
| `PATCH` | `/api/inventory` | Adjust stock: `{ productId, delta, reason }` |
| `GET` | `/api/geo/hierarchy` | Whole tree, plus per-level counts and whether outlines exist |
| `GET` | `/api/geo/locate?place=&region=` | Resolve a place name to coordinates |
| `GET` | `/api/geo/validate?region=&district=` | Check a selection is internally consistent |
| `GET` | `/api/geo/validate?path=3,17` | Children of one parent, for a cascading select |
| `POST` | `/api/geo/validate` | Same check for a cascading state object |
| `GET` | `/api/geo/boundaries/regions` | ADM1 polygons, geoBoundaries gbOpen |
| `GET` | `/api/geo/boundaries/districts` | ADM2 polygons, geoBoundaries gbOpen |
| `GET` | `/api/payments/methods` | Channels and providers available in Uganda |
| `POST` | `/api/payments/intents` | Create an intent; the server prices it |
| `GET` | `/api/payments/intents/:reference` | Poll status |
| `PATCH` | `/api/payments/intents` | Report succeeded / failed / cancelled |

### Boundary data is real only for two levels

Regions and districts are seeded from geoBoundaries gbOpen, which is public
domain and carries actual outlines for Uganda: ADM1 gives the 4 regions and
ADM2 gives 151 districts. Those two files live in `api/data/geo/`.

Sub-counties, parishes and villages are a different matter. geoBoundaries ADM3
for Uganda returns 137 features named after districts, so it is not sub-county
data, and no open dataset publishes parish or village boundaries. Villages have
no geographic outline at all: they are addressed by name and landmark and
overseen by the Local Council 1 chairperson.

So `sub_counties`, `parishes` and `villages` exist in the schema, are ready to
populate, and are served as empty lists with `geometryAvailable: false`. The
boundary route returns 404 with an explanation for those levels rather than an
empty FeatureCollection, because an empty collection draws as a broken map.
Populate them from UBOS or OpenStreetMap `admin_level` boundaries and drop in a
boundary file.

```bash
npm run db:seed:geo --prefix api    # re-seed regions and districts
```

### Hierarchical integrity

A selection must be consistent from the top down: anything chosen at a level
has to belong to the level above it. Picking Central Region and then a district
in Northern Region is rejected, not silently corrected, because guessing which
one the customer meant is how a delivery ends up in the wrong region.

The rule lives in `api/src/lib/geoValidate.ts` as a pure function over the
hierarchy, so it can be tested at any depth. `src/app/lib/geoApi.ts` carries a
deliberately identical client copy for immediate feedback; the server is the
authority and the client copy is a convenience.

Two behaviours are enforced:

  - **A level needs its parent.** A district cannot be matched until a region
    is fixed, and reports exactly that rather than saying the name is not in
    Uganda.
  - **Changing a level clears everything below it** (`clearBelow`). This is the
    one that matters in the UI: switching from Central to Northern Region must
    not leave a Central district selected.

Levels may be skipped, because sub-counties and below are not populated yet.
Naming a level whose parent has none recorded is rejected, so an unverifiable
place is never accepted.

`POST /api/customers` and `POST /api/orders` both run the check before writing,
so a hand-crafted request cannot store or route an inconsistent pair.

### Locating a delivery address

`/api/geo/locate` turns the district chosen at checkout into coordinates. It
strips the kind suffix first, because the checkout stores names as "Kampala
(City)" and "Mityana (Municipality)".

It tries two sources:

1. the seeded boundary data, which gives a real centroid, a bounding box and a
   real outline
2. `api/data/geo/town-centres.json`, a table of approximate district
   headquarters coordinates for the districts the ADM2 layer omits

The response says which one was used, in `source` and `precision`:

| source | precision | hasOutline | meaning |
| --- | --- | --- | --- |
| `boundary` | `district-centroid` | true | real centroid, real outline |
| `town-centre` | `town-centre` | false | approximate town coordinates |

**The free-text street address is not geocoded.** A pin on this map marks the
district or town centre, not the doorstep, and the map draws a dashed radius and
says so in the caption rather than implying a precision the data does not have.
Geocoding the address needs a service such as Nominatim, which means sending the
customer address to a third party; that is a product and privacy decision rather
than a code one.

### Payment channels

`mobile_money` covers MTN (077, 078, 079), Airtel (070, 075) and UTel (071).
`card` covers Visa and Mastercard. `wallet` covers anything on the Uganda
interbank and mobile money interoperability switch.

Mobile money is asynchronous: the customer approves a USSD prompt on the
handset, so an intent sits in `awaiting_approval` until it is settled. The
server detects the network from the number and refuses a mismatch, so a 070
cannot be charged to MTN. Card numbers are Luhn-checked, checked against the
claimed scheme, and only the last four digits are ever stored. The client
never sends an amount; the server prices the cart, adds delivery, and returns
the total.

**This is not yet a live gateway.** There is no PSP wired in, so settling an
intent is currently the customer confirming in the client. To go live, add the
provider of your choice (Paystack and Flutterwave both support Uganda mobile
money) behind `api/src/lib/payments.ts`, and replace the client-side settle with
a webhook. Nothing else needs to move: the response shape the client already
consumes is what a webhook would produce.

## Design notes

**Order totals** are computed server-side in `api/src/app/api/orders/route.ts`:
subtotal from cart lines, `23,720` flat shipping (free at `198,000`+), `8.25%` tax.
The frontend must never be trusted for these numbers.

**Cart conversion is transactional.** Order creation, line-item snapshotting and
the cart status flip to `converted` all happen in one `db.transaction`, so a
double-submit returns `409` instead of creating a duplicate order. Line items
snapshot `name` and `priceValue` at purchase time, so later catalogue edits do
not rewrite order history.

**Images are not duplicated.** `api/src/app/api/assets/[...path]/route.ts`
streams from `../src/assets` with an extension allowlist and a resolved-path
prefix check that rejects traversal attempts. This keeps a single 37MB copy of
the imagery instead of duplicating it into the API.

**Products store filenames, not URLs.** `imageFiles` holds the raw asset
filenames; `toProductDto` in `api/src/lib/http.ts` maps them to `/api/assets/...`
at the edge of the API, so the storage detail never leaks into the client.

## Wiring the frontend to this API

Not done, deliberately — the frontend still runs entirely on hardcoded data in
`src/app/App.tsx` and nothing calls the API yet.

Two changes make it work, neither of which touches the API:

1. **Proxy in dev.** Add to the root `vite.config.ts`:
   ```js
   server: { proxy: { '/api': 'http://localhost:3000' } }
   ```
   The frontend then calls `/api/products` on its own origin, so there is no
   CORS to configure in development. In production on separate domains, add
   CORS headers to the route handlers instead.

2. **Replace the inline catalogue.** `src/app/App.tsx:28-137` holds 9 hardcoded
   products with `figma:asset/` image imports. Replace that array with a fetch
   against `/api/products`, whose `images[]` already comes back as usable URLs.

If you ever re-export from Figma Make it will overwrite `src/app/`, so keep any
API integration outside that directory.