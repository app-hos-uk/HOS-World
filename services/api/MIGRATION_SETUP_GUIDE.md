# Migration Setup Guide

## Current Situation

The database is already synced with the schema (confirmed by `db push`), but Prisma needs a proper migration file to track the changes.

## Steps to Complete Migration Setup

### Option 1: Mark Migration as Applied (Recommended)

Since the database is already synced, you can mark the migration as applied without running it:

```bash
cd services/api
npx prisma migrate resolve --applied 20250108180000_add_product_types_volume_pricing
```

This tells Prisma that the migration has already been applied to the database.

### Option 2: Create Migration Without Shadow Database

If you get shadow database errors, you can disable shadow database:

1. Add to `schema.prisma`:
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  shadowDatabaseUrl = env("SHADOW_DATABASE_URL")  // Optional, can be omitted
}
```

2. Or set shadow database URL in `.env`:
```env
SHADOW_DATABASE_URL="postgresql://..."  # Optional
```

3. Then create migration:
```bash
cd services/api
npx prisma migrate dev --name add_product_types_volume_pricing --skip-seed
```

### Option 3: Use Migration File Directly (Already Created)

The migration file has been created at:
```
prisma/migrations/20250108180000_add_product_types_volume_pricing/migration.sql
```

If the database is already synced, just mark it as applied:
```bash
cd services/api
npx prisma migrate resolve --applied 20250108180000_add_product_types_volume_pricing
```

### Final Step: Regenerate Prisma Client

After marking the migration as applied, regenerate the Prisma client:

```bash
cd services/api
npx prisma generate
```

Or if using pnpm:
```bash
cd services/api
pnpm prisma generate
```

## Verify Everything Works

1. Check migration status:
```bash
cd services/api
npx prisma migrate status
```

2. Verify Prisma client is generated:
```bash
cd services/api
ls -la node_modules/.prisma/client/
```

3. Test the application - the new types should be available:
- `ProductType` enum
- `ProductBundleItem` model
- `VolumePricing` model

## Troubleshooting

### Shadow Database Error

If you see "shadow database" errors, you can:
- Use `migrate resolve --applied` to mark migrations as applied
- Set `SHADOW_DATABASE_URL` in `.env` (can be same as `DATABASE_URL`)
- Use `db push` for development (but not recommended for production)

### Migration Already Applied

If the database already has the changes:
```bash
npx prisma migrate resolve --applied <migration_name>
```

### Prisma Client Not Updated

If TypeScript types aren't updated:
```bash
npx prisma generate
```

## Summary

1. ✅ Migration file created at: `prisma/migrations/20250108180000_add_product_types_volume_pricing/migration.sql`
2. ⚠️ Mark it as applied: `npx prisma migrate resolve --applied 20250108180000_add_product_types_volume_pricing`
3. ⚠️ Regenerate client: `npx prisma generate`

---

**Last Updated**: After migration file creation
