#!/usr/bin/env bash
# Create .env from env.example if missing, so DATABASE_URL is set for Prisma/psql.
set -e
cd "$(dirname "$0")/.."
if [ ! -f .env ]; then
  cp env.example .env
  echo "Created .env from env.example. Edit .env and set DATABASE_URL to your PostgreSQL URL."
  echo "Example (Mac, default user): DATABASE_URL=postgresql://$(whoami)@localhost:5432/hos_marketplace"
  echo "If database hos_marketplace does not exist, run: createdb hos_marketplace"
else
  echo ".env already exists."
fi
