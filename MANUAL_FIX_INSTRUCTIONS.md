# Manual Fix Instructions - React Module Not Found

## Problem
The project uses **pnpm** but you're trying to use **npm**. The dependencies were installed with pnpm, so npm can't find them.

## Solution Options

### Option 1: Install pnpm globally (Recommended)

```bash
# Install pnpm globally
npm install -g pnpm

# Navigate to project root
cd "/Users/sabuj/Desktop/HOS-latest Sabu"

# Install dependencies
pnpm install

# Build workspace packages
cd packages/shared-types && pnpm run build && cd ../..
cd packages/theme-system && pnpm run build && cd ../..
cd packages/utils && pnpm run build && cd ../..
cd packages/api-client && pnpm run build && cd ../..

# Start the server
cd apps/web
pnpm run dev
```

### Option 2: Use npx pnpm (No global install needed)

```bash
# Navigate to project root
cd "/Users/sabuj/Desktop/HOS-latest Sabu"

# Install dependencies using npx pnpm
npx pnpm install

# Build workspace packages
cd packages/shared-types && npx pnpm run build && cd ../..
cd packages/theme-system && npx pnpm run build && cd ../..
cd packages/utils && npx pnpm run build && cd ../..
cd packages/api-client && npx pnpm run build && cd ../..

# Start the server
cd apps/web
npx pnpm run dev
```

### Option 3: Use the automated script

```bash
cd "/Users/sabuj/Desktop/HOS-latest Sabu"
./fix-and-start.sh
```

## Quick One-Liner (After installing pnpm globally)

```bash
cd "/Users/sabuj/Desktop/HOS-latest Sabu" && pnpm install && cd packages/shared-types && pnpm run build && cd ../../packages/theme-system && pnpm run build && cd ../../packages/utils && pnpm run build && cd ../../packages/api-client && pnpm run build && cd ../../apps/web && pnpm run dev
```

## Why This Happens

- The project has a `pnpm-lock.yaml` file, meaning it was set up with pnpm
- pnpm uses a different node_modules structure than npm
- When you try to use npm, it can't find the dependencies installed by pnpm
- Solution: Use pnpm (or reinstall everything with npm, but that's more complex)

## Verify Installation

After installing, check if React is available:

```bash
cd "/Users/sabuj/Desktop/HOS-latest Sabu/apps/web"
ls node_modules/react 2>/dev/null && echo "✅ React found" || echo "❌ React not found"
```

If React is not found, you need to install dependencies from the **root directory**, not from `apps/web`.
