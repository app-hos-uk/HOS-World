# Build All Workspace Packages

## Quick Fix Command

To build all workspace packages at once, run:

```bash
cd "/Users/apple/Desktop/HOS-latest Sabu"
pnpm --filter "./packages/*" build
```

Or build them individually in dependency order:

```bash
cd "/Users/apple/Desktop/HOS-latest Sabu"

# 1. Build shared-types first (no dependencies)
pnpm --filter @hos-marketplace/shared-types build

# 2. Build packages that depend on shared-types
pnpm --filter @hos-marketplace/theme-system build
pnpm --filter @hos-marketplace/utils build
pnpm --filter @hos-marketplace/api-client build
```

## Verify Builds

Check that dist folders exist:
```bash
ls packages/shared-types/dist
ls packages/theme-system/dist
ls packages/api-client/dist
ls packages/utils/dist
```

## Then Run Tests

After building all packages:
```bash
cd "/Users/apple/Desktop/HOS-latest Sabu/apps/web"
rm -rf .next  # Clear Next.js cache
pnpm test:e2e:headed
```
