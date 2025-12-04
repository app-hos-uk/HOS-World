# Railway Deployment Checklist

## ✅ Pre-Deployment (Completed)

- [x] All code changes committed and pushed to GitHub
- [x] Database schema sync moved to PrismaService (automatic on startup)
- [x] Dockerfile configured correctly for monorepo
- [x] Health check routes are public
- [x] OAuth strategies conditionally loaded
- [x] All services configured for non-blocking startup

## 🚀 Deployment Steps

### 1. Verify Railway Service Configuration

Go to your Railway dashboard and check:

**Backend API Service (`@hos-marketplace/api`):**
- [ ] **Dockerfile Path**: Should be `Dockerfile` (root level)
- [ ] **Start Command**: Should be empty (uses Dockerfile CMD)
- [ ] **Health Check**: Disabled (or set to `/api/health` with 300s timeout)
- [ ] **Port**: Auto-detected (should be 3001 or Railway-assigned)
- [ ] **Restart Policy**: ON_FAILURE with max retries 10

### 2. Verify Environment Variables

Ensure these are set in Railway dashboard for the API service:

**Required:**
- [ ] `DATABASE_URL` - PostgreSQL connection string (from Railway PostgreSQL service)
- [ ] `REDIS_URL` - Redis connection string (from Railway Redis service)
- [ ] `JWT_SECRET` - Generated secret (use `openssl rand -base64 32`)
- [ ] `JWT_EXPIRES_IN` - Token expiration (e.g., `7d`)
- [ ] `NODE_ENV` - Set to `production`
- [ ] `PORT` - Railway will set this automatically (usually 3001)
- [ ] `SYNC_DB_SCHEMA` - Set to `true` (enables automatic schema sync)

**Optional (for OAuth):**
- [ ] `GOOGLE_CLIENT_ID` - If using Google OAuth
- [ ] `GOOGLE_CLIENT_SECRET` - If using Google OAuth
- [ ] `FACEBOOK_APP_ID` - If using Facebook OAuth
- [ ] `FACEBOOK_APP_SECRET` - If using Facebook OAuth
- [ ] `APPLE_CLIENT_ID` - If using Apple OAuth
- [ ] `APPLE_TEAM_ID` - If using Apple OAuth
- [ ] `APPLE_KEY_ID` - If using Apple OAuth
- [ ] `APPLE_PRIVATE_KEY_PATH` - If using Apple OAuth

**Optional (for other services):**
- [ ] `FRONTEND_URL` - Frontend URL for CORS (e.g., `https://your-app.railway.app`)
- [ ] `ELASTICSEARCH_NODE` - If using Elasticsearch
- [ ] `STRIPE_SECRET_KEY` - If using Stripe
- [ ] `STRIPE_WEBHOOK_SECRET` - If using Stripe webhooks

### 3. Trigger Deployment

Railway should automatically deploy when you push to GitHub. If not:

1. Go to Railway dashboard
2. Click on your API service
3. Click "Deploy" or "Redeploy"
4. Monitor the build logs

### 4. Monitor Deployment

Watch for these success indicators in the logs:

**Build Stage:**
- ✅ `Build completed with some type errors - checking if dist exists...`
- ✅ `Verifying bcrypt binding...`
- ✅ `Found: /app/node_modules/.pnpm/bcrypt@5.1.1/.../bcrypt_lib.node`

**Startup Stage:**
- ✅ `🚀 Starting API server...`
- ✅ `Database connected successfully`
- ✅ `🔄 Syncing database schema...`
- ✅ `✅ Database schema synced successfully`
- ✅ `✅ Server is listening on port 3001`
- ✅ `✅ API server is running on: http://0.0.0.0:3001/api`
- ✅ `✅ Health check available at: http://0.0.0.0:3001/api/health`

**Expected Warnings (OK to ignore):**
- ⚠️ `ELASTICSEARCH_NODE not configured - search features will be disabled` (if not using Elasticsearch)
- ⚠️ `Google OAuth not configured - skipping strategy` (if not using OAuth)
- ⚠️ `Themes table not found. Skipping theme seeding.` (only on first deployment, will resolve after schema sync)

### 5. Verify Deployment

After deployment completes, test these endpoints:

1. **Root endpoint**: `https://your-api.railway.app/`
   - Should return API information JSON

2. **Health check**: `https://your-api.railway.app/api/health`
   - Should return: `{"status":"ok","timestamp":"...","service":"House of Spells Marketplace API"}`

3. **API endpoint**: `https://your-api.railway.app/api`
   - Should return: `"Hello World!"` (or whatever AppService returns)

### 6. Database Schema Verification

After first deployment, check logs for:
- `✅ Database schema synced successfully`
- `✅ Database connected successfully`

If you see `⚠️ Themes table not found`, wait 10-30 seconds and check again. The schema sync runs in the background.

## 🔧 Troubleshooting

### Service Not Starting

1. Check build logs for errors
2. Check runtime logs for startup errors
3. Verify all required environment variables are set
4. Check if health check is blocking deployment (disable it temporarily)

### Database Connection Issues

1. Verify `DATABASE_URL` is correct (use internal Railway URL)
2. Check PostgreSQL service is running
3. Wait a few seconds - database might be initializing

### Health Check Failing

1. Disable health check in Railway dashboard settings
2. Or increase timeout to 300 seconds
3. Verify `/api/health` endpoint is accessible

### bcrypt Module Not Found

1. Verify Dockerfile is using `node:18-slim` (Debian-based)
2. Check build logs for bcrypt compilation
3. Ensure build tools (python3, make, g++) are installed

## 📝 Next Steps After Successful Deployment

1. **Create Super Admin User** (if not done):
   - Run: `cd services/api && railway run pnpm db:seed-admin`
   - Verify: `railway run pnpm db:verify-admin`
   - Test login with: `app@houseofspells.co.uk` / `Admin123`
   - See `SUPER_ADMIN_STATUS.md` for details

2. **Set up Frontend Service** (if not done):
   - Create new service in Railway
   - Point to `apps/web` directory
   - Set build command: `cd apps/web && pnpm install && pnpm build`
   - Set start command: `cd apps/web && pnpm start`
   - Configure environment variables (API URL, etc.)

3. **Set up Custom Domain** (optional):
   - Go to Railway service settings
   - Add custom domain
   - Configure DNS records

4. **Monitor Performance**:
   - Check Railway metrics dashboard
   - Monitor error rates
   - Check response times

5. **Set up Monitoring** (optional):
   - Configure error tracking (Sentry, etc.)
   - Set up uptime monitoring
   - Configure alerts

## 🎉 Success Criteria

Your deployment is successful when:
- ✅ Build completes without errors
- ✅ Service starts and stays running
- ✅ Health check endpoint returns 200 OK
- ✅ Root endpoint returns API information
- ✅ Database schema is synced (no "themes table not found" after 30 seconds)
- ✅ All routes are accessible

