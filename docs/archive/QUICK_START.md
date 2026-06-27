# Quick Start Guide

## Starting the API Server

### ✅ Correct Command
```bash
cd services/api
pnpm dev
```

### ❌ Incorrect Command
```bash
# DON'T use this:
pnpm start dev  # This is wrong!
```

## What Each Command Does

- **`pnpm dev`** - Starts the development server with hot reload (watch mode)
- **`pnpm start`** - Runs the compiled production build from `dist/main.js`
- **`pnpm build`** - Compiles TypeScript to JavaScript in `dist/` folder

## After Starting the Server

1. **Wait for startup** (10-30 seconds)
2. **Visit Swagger UI**: http://localhost:3001/api/docs
3. **Test health endpoint**: http://localhost:3001/api/health
4. **Follow testing plan**: See `TESTING_PLAN.md`

## Troubleshooting

### If you see "Cannot find module 'express'"
- Run: `pnpm install` (dependencies may be missing)
- Run: `pnpm build` (rebuild the project)

### If port 3001 is already in use
- Change port in `.env` file: `PORT=3002`
- Or kill the process using port 3001

### If database connection fails
- Check `.env` file has correct `DATABASE_URL`
- Verify database is accessible

## All Fixed! ✅

All TypeScript compilation errors have been resolved:
- ✅ Fixed tax service relation names (`rates` instead of `taxRates`)
- ✅ Fixed return policies service (`deliveredAt` removed)
- ✅ Fixed returns service (ReturnStatus enum values)
- ✅ Fixed Stripe provider (refund status mapping)

The server should now start successfully with `pnpm dev`!
