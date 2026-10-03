# Mu Katale

A Ugandan central-market grocery app. "Mu katale" means "in the market" in
Luganda, and prices are in Ugandan shillings.

Originally exported from Figma as *Interactive Grocery Mobile App (Community)*.
The original project is available at
https://www.figma.com/design/S1StqUnUeGL37S13E8w1HT/Interactive-Grocery-Mobile-App--Community-.

## Running the frontend

Run `npm i` to install the dependencies.

Run `npm run dev` to start the development server.

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

The frontend still runs on its hardcoded catalogue and does not call the API
yet.