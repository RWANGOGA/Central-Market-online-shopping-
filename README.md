# Mu Katale

A Ugandan central-market grocery app. "Mu katale" means "in the market" in
Luganda, and prices are in Ugandan shillings.

Originally exported from Figma as *Interactive Grocery Mobile App (Community)*.
The original project is available at
https://www.figma.com/design/S1StqUnUeGL37S13E8w1HT/Interactive-Grocery-Mobile-App--Community-.

## Running the frontend

Run `npm i` to install the dependencies.

Run `npm run dev` to start the development server.

## Coverage map

The app has an interactive map of Uganda at **Menu > Coverage map**. It draws
real region and district boundaries, pans and zooms when you pick a region, and
drills down from region to district.

Boundaries come from geoBoundaries gbOpen ADM1 and ADM2 (public domain), cached
in `api/data/geo/`. Sub-county, parish and village levels are modelled in the
database and served as empty lists, because no open dataset publishes those
outlines. The map says so rather than drawing an empty frame.

## Running the API

The backend lives in `api/` and is independent of the frontend: its own
`package.json`, lockfile and `node_modules`. The root `package.json` declares no
npm workspaces, so the two installs never interfere.

```bash
npm install --prefix api
npm run db:push --prefix api   # create tables
npm run db:seed --prefix api   # load the 9 products
npm run dev --prefix api       # http://localhost:3000
```

See `api/README.md` for the endpoint reference.

The frontend cart is connected to this API and survives a page refresh.
Payment intents and the geography hierarchy are wired up too. The product
catalogue is still hardcoded in `src/app/App.tsx`, so nothing calls
`/api/products` yet.