# Prisma migrate dev – Shadow Database Fix

## Problem

`prisma migrate dev` failed with **P3006**: Migration `20251206133014_add_global_features` failed because the `users` table did not exist in the shadow database. The first migration in the folder assumes a base schema that was never created by any migration.

## What Was Done

1. **Initial migration added** (`20251201000000_init`): Creates the full schema from empty so the shadow database can replay all migrations.
2. **Init marked as applied** in the dev DB: `prisma migrate resolve --applied 20251201000000_init`
3. **Migrations made idempotent** (IF NOT EXISTS / DO blocks) so they can run after the init without failing:
   - `20260105140000_add_refresh_tokens`
   - `20260108124252_add_oauth_account_model`, `20260108124343_add_oauth_account_model`
   - `20260108150000_add_gift_cards`
   - `20260110021558_add_tenant_model`
   - `20260126120000_add_integration_config`
   - `20260126150000_add_role_specific_profile_fields`
   - `20260212180000_add_newsletter_subscriptions`

## Current State

- Prisma reports that some migrations were modified after being applied (checksum changed).
- There may be schema drift between the dev DB and the migration history.

## Options

### Option A: Reset dev database (recommended for clean state)

```bash
cd services/api
pnpm exec prisma migrate reset
```

This will:

- Drop and recreate the database
- Replay all migrations in order (including the init)
- Apply the idempotent migrations without errors

**Warning:** All local data will be lost.

### Option B: Skip migrate dev for Prisma 6

The Prisma 5 → 6 upgrade does not require schema changes. You can:

- Use `prisma migrate deploy` in production (no shadow DB)
- Use `prisma generate` for local development
- Avoid `prisma migrate dev` until you need new migrations

### Option C: Production deployment

**When to run this:** Only if your production database was created with the *old* migrations (before the `20251201000000_init` migration was added). If production was created from scratch or already has the init migration applied, skip step 1.

**Checklist:**

1. **Mark the init migration as applied** (if production schema already exists from before the init migration):

   ```bash
   DATABASE_URL="postgresql://..." ./scripts/production-migrate-resolve.sh
   ```

   Or manually: `cd services/api && DATABASE_URL="..." pnpm exec prisma migrate resolve --applied 20251201000000_init`

   This tells Prisma the init migration is already applied so it won’t try to re-create existing tables.

2. **Deploy remaining migrations:**

   ```bash
   cd services/api
   pnpm exec prisma migrate deploy
   ```

## Prisma 6 upgrade

The Prisma 6 upgrade is complete. No extra migration is required. Use `prisma generate` and `prisma migrate deploy` as needed.
