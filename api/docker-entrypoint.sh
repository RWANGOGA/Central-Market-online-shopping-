#!/bin/sh
# Wait for Postgres to accept connections, apply schema migrations, then start
# the API. Runs as the `node` user; DATABASE_URL is a PostgreSQL connection URL.
set -eu

echo "api: waiting for Postgres (${DATABASE_URL#*//})..."
until pg_isready -d "$DATABASE_URL" >/dev/null 2>&1; do
  sleep 2
done

echo "api: applying database migrations"
npx drizzle-kit migrate

exec "$@"
