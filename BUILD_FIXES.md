# 🔧 Build Fixes Required

## Issues Found

1. **bcrypt native module** - Needs to be rebuilt
2. **TypeScript compilation errors** - Multiple issues
3. **Missing dependencies** - @nestjs/mapped-types
4. **Prisma client** - Needs regeneration
5. **Workspace packages** - Need to be built

## Fixes Applied

### 1. Fixed ApiResponse Naming Conflict
- Renamed Swagger's `ApiResponse` to `SwaggerApiResponse` to avoid conflict with shared-types
- Updated all Swagger decorators

### 2. Added Missing Package
- Added `@nestjs/mapped-types` to package.json

### 3. Fixed UpdateProductDto
- Removed dependency on @nestjs/mapped-types (using manual definition)

## Commands to Run

### Step 1: Install Missing Package
```bash
cd "/Users/apple/Desktop/HOS-latest Sabu/services/api"
pnpm install @nestjs/mapped-types
```

### Step 2: Rebuild bcrypt
```bash
cd "/Users/apple/Desktop/HOS-latest Sabu"
pnpm rebuild bcrypt
```

### Step 3: Generate Prisma Client
```bash
cd "/Users/apple/Desktop/HOS-latest Sabu/services/api"
pnpm db:generate
```

### Step 4: Build Workspace Packages
```bash
cd "/Users/apple/Desktop/HOS-latest Sabu"
pnpm --filter @hos-marketplace/shared-types build
pnpm --filter @hos-marketplace/utils build
```

### Step 5: Build API
```bash
cd "/Users/apple/Desktop/HOS-latest Sabu/services/api"
pnpm build
```

## Alternative: Full Rebuild

If individual steps don't work:

```bash
cd "/Users/apple/Desktop/HOS-latest Sabu"
# Clean install
rm -rf node_modules
rm -rf services/api/node_modules
rm -rf packages/*/node_modules

# Reinstall everything
pnpm install

# Generate Prisma
cd services/api
pnpm db:generate

# Build workspace packages
cd ../..
pnpm --filter @hos-marketplace/shared-types build
pnpm --filter @hos-marketplace/utils build

# Build API
cd services/api
pnpm build
```

## Note

The TypeScript errors are mostly due to:
1. Prisma client not being generated (missing types)
2. Workspace packages not being built
3. bcrypt native module not compiled

Once these are fixed, the build should succeed.
