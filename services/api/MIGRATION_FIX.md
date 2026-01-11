# Migration Fix Guide

## Problem
The migration `20251206133014_add_global_features` failed because the shadow database doesn't have the `users` table. This happens when the shadow database is out of sync with your actual database.

## Solutions

### Option 1: Use `prisma db push` (Recommended for Development)
This syncs your schema directly to the database without using migrations. Use this if you're in development and don't need migration history.

```bash
cd services/api
pnpm db:push
```

**Note:** This will apply all schema changes directly. It's safe if your production database already has the tables.

### Option 2: Use `prisma migrate deploy` (For Production)
This applies pending migrations without using a shadow database. Use this for production deployments.

```bash
cd services/api
pnpm db:migrate:deploy
```

### Option 3: Mark Migration as Applied (If Already Applied)
If the migration has already been applied to your production database, you can mark it as applied:

```bash
cd services/api
pnpm prisma migrate resolve --applied 20251206133014_add_global_features
```

Then continue with:
```bash
pnpm db:migrate
```

### Option 4: Reset Shadow Database (Development Only)
If you're in development and can afford to lose data:

```bash
cd services/api
pnpm prisma migrate reset
```

**⚠️ WARNING:** This will drop your database and recreate it. Only use in development!

## Recommended Approach for Railway Production

Since you're using Railway (production), use **Option 2**:

```bash
cd services/api
pnpm db:migrate:deploy
```

This will:
- Apply all pending migrations
- Not use a shadow database (avoids the sync issue)
- Work correctly with your Railway PostgreSQL database

## After Migration

Once migrations are applied, regenerate the Prisma client:

```bash
pnpm db:generate
```
