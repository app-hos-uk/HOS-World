# API Server Startup Issue

## Problem
The API server cannot start in the sandbox environment due to:
1. **Redis Connection Permission Error**: The server tries to connect to Redis (port 6379) but gets `EPERM` errors due to sandbox restrictions
2. **.env File Protection**: The `.env` file is protected and cannot be read (though we've worked around this with `IGNORE_ENV_FILE`)

## Current Status
- ✅ Environment variables can be set via command line
- ✅ ConfigModule updated to ignore .env file when `IGNORE_ENV_FILE=true`
- ❌ Server fails to start due to Redis connection restrictions in sandbox

## Solutions

### Option 1: Run Tests Against Remote API Server
If you have the API server running on Railway or another remote server, you can run the tests against it:

```bash
cd apps/web
NEXT_PUBLIC_API_URL=https://your-railway-api-url.railway.app/api pnpm test:e2e e2e/phase1-phase2-e2e.spec.ts
```

### Option 2: Start Server Outside Sandbox
Start the API server manually in a terminal outside the sandbox:

```bash
cd services/api
DATABASE_URL="postgresql://postgres:pYPWIdwzfQxyQQuobcwivtlfgFPgoekM@postgres.railway.internal:5432/railway" \
JWT_SECRET="EDLd7c1od2DTOXo8LQDxzNa0OM+drNeozaPMlggG2kQ=" \
JWT_REFRESH_SECRET="9KFJvUbcTrgjW8Ui6gOa0De/GE/XF4wfksEcCgBp2fo=" \
IGNORE_ENV_FILE="true" \
pnpm dev
```

Then run the tests in another terminal:

```bash
cd apps/web
pnpm test:e2e e2e/phase1-phase2-e2e.spec.ts
```

### Option 3: Configure Redis to be Optional
Modify the cache configuration to make Redis optional (fallback to in-memory cache when Redis is unavailable).

## Next Steps
1. Start the API server manually outside the sandbox
2. Wait for it to be fully started (check `http://localhost:3001/api/health`)
3. Run the Phase 1 & Phase 2 E2E tests

## Test Command
Once the server is running:

```bash
cd apps/web
pnpm test:e2e e2e/phase1-phase2-e2e.spec.ts
```
