#!/bin/sh
set -e

echo "Running prisma db push..."
npx prisma db push --accept-data-loss --skip-generate

if [ "$RUN_SEED" = "true" ]; then
  echo "Seeding database..."
  npm run seed
fi

echo "Starting API..."
node dist/index.js
