# Troubleshooting API Server Startup

## The server is not starting. Here's how to diagnose and fix it:

### Step 1: Start the server manually to see errors

```bash
cd services/api
pnpm dev
```

This will show you any startup errors in the terminal.

### Step 2: Check for common issues

#### Issue 1: Missing Environment Variables

The server requires these environment variables:
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - JWT token secret
- `JWT_REFRESH_SECRET` - Refresh token secret

**Fix**: Create or update `services/api/.env`:
```env
DATABASE_URL=postgresql://user:password@localhost:5432/hos_marketplace
JWT_SECRET=your-secret-key-change-in-production
JWT_REFRESH_SECRET=your-refresh-secret-change-in-production
```

#### Issue 2: Prisma Client Not Generated

**Fix**:
```bash
cd services/api
pnpm db:generate
```

#### Issue 3: Database Not Connected

**Fix**:
```bash
# Check if PostgreSQL is running
# On macOS:
brew services list | grep postgresql

# Start PostgreSQL if needed:
brew services start postgresql

# Or check connection:
psql $DATABASE_URL
```

#### Issue 4: Database Schema Not Pushed

**Fix**:
```bash
cd services/api
pnpm db:push
```

### Step 3: Verify Prerequisites

Run these commands in order:

```bash
cd services/api

# 1. Install dependencies
pnpm install

# 2. Generate Prisma client
pnpm db:generate

# 3. Push database schema
pnpm db:push

# 4. Start the server
pnpm dev
```

### Step 4: Check for Compilation Errors

If you see TypeScript errors:
```bash
cd services/api
pnpm type-check
```

### Step 5: Check Logs

If the server starts but crashes, check:
- Terminal output for error messages
- Database connection logs
- Prisma client generation logs

### Expected Output When Server Starts Successfully

You should see:
```
[Nest] INFO  [NestFactory] Starting Nest application...
[Nest] INFO  [InstanceLoader] AppModule dependencies initialized
[Nest] INFO  [Bootstrap] ✅ AppModule initialized successfully
[Nest] INFO  [Bootstrap] ✅ Security headers configured
[Nest] INFO  [Bootstrap] ✅ Response compression enabled
[Nest] INFO  [NestFactory] Nest application successfully started
[Nest] INFO  [Bootstrap] 🚀 Application is running on: http://localhost:3001
```

### Quick Health Check

Once the server is running, test it:
```bash
curl http://localhost:3001/api/health
```

Should return:
```json
{
  "status": "ok",
  "timestamp": "...",
  "database": "connected"
}
```

### Still Not Working?

1. **Check the exact error message** from `pnpm dev`
2. **Verify environment variables** are set correctly
3. **Check database connection** is working
4. **Ensure Prisma client** is generated
5. **Check for port conflicts**: `lsof -i :3001`

### Alternative: Start with More Verbose Logging

```bash
cd services/api
NODE_ENV=development DEBUG=* pnpm dev
```

This will show more detailed error messages.
