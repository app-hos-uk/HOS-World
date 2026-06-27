# 🔧 Fix bcrypt Native Module - Detailed Instructions

## Problem
bcrypt native module is not built for your Node.js version (v24.3.0) in the pnpm monorepo.

## Solution Options

### Option 1: Rebuild from API workspace (Recommended)
```bash
cd "/Users/apple/Desktop/HOS-latest Sabu/services/api"
pnpm rebuild bcrypt
```

### Option 2: Use pnpm filter from root
```bash
cd "/Users/apple/Desktop/HOS-latest Sabu"
pnpm --filter @hos-marketplace/api rebuild bcrypt
```

### Option 3: Force reinstall bcrypt in API workspace
```bash
cd "/Users/apple/Desktop/HOS-latest Sabu/services/api"
pnpm remove bcrypt
pnpm add bcrypt
pnpm rebuild bcrypt
```

### Option 4: Rebuild all native modules in API workspace
```bash
cd "/Users/apple/Desktop/HOS-latest Sabu/services/api"
pnpm rebuild
```

### Option 5: Clean install and rebuild (Nuclear option)
```bash
cd "/Users/apple/Desktop/HOS-latest Sabu"
rm -rf node_modules
rm -rf services/api/node_modules
pnpm install
cd services/api
pnpm rebuild bcrypt
```

## Verify the Fix

After rebuilding, check if the native module exists:
```bash
ls -la "/Users/apple/Desktop/HOS-latest Sabu/node_modules/.pnpm/bcrypt@5.1.1/node_modules/bcrypt/lib/binding/napi-v3/bcrypt_lib.node"
```

If the file exists, the rebuild was successful!

## Why This Happens in pnpm Monorepos

In pnpm workspaces:
- Dependencies are hoisted to the root `node_modules`
- Native modules need to be rebuilt for the specific workspace
- The build process needs to run from the workspace directory or use `--filter`

## After Fixing

Run the application:
```bash
cd "/Users/apple/Desktop/HOS-latest Sabu/services/api"
pnpm dev
```
