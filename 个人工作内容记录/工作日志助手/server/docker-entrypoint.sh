#!/bin/sh
set -e

echo ">>> Running database migration..."
npx prisma migrate deploy

echo ">>> Starting WorkLog server..."
node dist/index.js
