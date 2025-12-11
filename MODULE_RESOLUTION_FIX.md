# Module Resolution Fix

## Problem

TypeScript cannot find:
- `@nestjs/config`
- `@hos-marketplace/utils`
- `@hos-marketplace/shared-types`

## Root Cause

This is a **monorepo** using `workspace:*` protocol which requires **pnpm** for proper dependency management. Regular `npm` doesn't support workspace protocol.

## Solutions

### Option 1: Install pnpm (Recommended)

```bash
npm install -g pnpm
cd HOS-World
pnpm install
```

This will properly install all dependencies including workspace packages.

### Option 2: Manual Installation (Workaround)

Since npm doesn't support workspace protocol, you need to:

1. **Install @nestjs/config manually**:
   ```bash
   cd services/api
   npm install @nestjs/config@3.1.1 --no-save
   ```

2. **Copy workspace packages** (already done):
   - Packages are copied to `node_modules/@hos-marketplace/`
   - Path mappings added to `tsconfig.json`

3. **Restart TypeScript Server**:
   - `Cmd+Shift+P` → "TypeScript: Restart TS Server"

### Option 3: Use npm workspaces (Alternative)

If you can't use pnpm, you can configure npm workspaces in root `package.json`:

```json
{
  "workspaces": [
    "packages/*",
    "services/*",
    "apps/*"
  ]
}
```

Then run `npm install` from root.

## Current Status

- ✅ Workspace packages copied to `node_modules/@hos-marketplace/`
- ✅ Path mappings added to `tsconfig.json`
- ⚠️ `@nestjs/config` needs manual installation
- ⚠️ Requires pnpm for full monorepo support

## Quick Fix Command

```bash
cd HOS-World/services/api
npm install @nestjs/config@3.1.1 --no-save
```

Then restart TypeScript server.

