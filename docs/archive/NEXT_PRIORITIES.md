# 🎯 Next Priorities - Action Plan

## ✅ Completed (Phase 1)
- ✅ OAuth unlinking (model, migration, code)
- ✅ Queue system (image processing implemented)
- ✅ Storage service (local file deletion completed)
- ✅ Debug instrumentation removed
- ✅ TODOs reviewed and prioritized

---

## 🔴 HIGH PRIORITY - Production Readiness (Do First)

### 1. Verify Railway Deployment ⚠️ **CRITICAL**
**Status**: In Progress
**Why**: Need to ensure all recent changes (OAuth, migrations) work in production

**Tasks**:
1. Check Railway deployment status
2. Verify API service is running
3. Test OAuth endpoints in production
4. Check deployment logs for errors
5. Verify database migration was applied correctly

**Action**:
```bash
# Check Railway dashboard:
# 1. Go to @hos-marketplace/api service
# 2. Check "Deployments" tab
# 3. Review latest deployment logs
# 4. Test health endpoint: https://your-api.railway.app/api/health
```

### 2. Ensure All Environment Variables Are Configured ⚠️ **CRITICAL**
**Status**: Pending
**Why**: Missing env vars cause app crashes and feature failures

**Required Variables Checklist**:

#### ✅ Already Configured:
- `DATABASE_URL` - ✅ (from PostgreSQL service)
- `REDIS_URL` - ⚠️ (need to verify from Redis service)

#### ⚠️ Need to Verify/Add:
- `JWT_SECRET` - Required for authentication
- `JWT_REFRESH_SECRET` - Required for refresh tokens
- `JWT_EXPIRES_IN` - Token expiration (default: 7d)
- `JWT_REFRESH_EXPIRES_IN` - Refresh token expiration (default: 30d)
- `PORT` - Server port (default: 3001)
- `NODE_ENV` - Environment (should be "production")
- `FRONTEND_URL` - Frontend URL for CORS and OAuth callbacks

#### 📋 Optional (Add Later):
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` - For Google OAuth
- `FACEBOOK_APP_ID` / `FACEBOOK_APP_SECRET` - For Facebook OAuth
- `APPLE_CLIENT_ID` / `APPLE_TEAM_ID` / etc. - For Apple OAuth
- `SMTP_*` - For email notifications
- `STRIPE_*` - For payment processing
- `CLOUDINARY_*` or `AWS_*` - For file storage
- `ELASTICSEARCH_NODE` - For search (optional)

**Action**:
1. Go to Railway → `@hos-marketplace/api` → Variables tab
2. Verify all required variables are set
3. Generate JWT secrets if missing:
   ```bash
   openssl rand -base64 32  # Run twice for JWT_SECRET and JWT_REFRESH_SECRET
   ```
4. Copy `REDIS_URL` from Redis service if not set

---

## 🟡 MEDIUM PRIORITY - Code Quality

### 3. Fix Test Coverage Report
**Status**: Pending (Jest dependency issue)
**Why**: Need to identify test coverage gaps

**Issue**: `@jest/test-sequencer` missing
**Action**: 
```bash
cd services/api
pnpm add -D @jest/test-sequencer
pnpm test --coverage
```

### 4. Complete Remaining Medium-Priority TODOs
**Status**: Pending
**Priority**: Medium (can be done after production verification)

**TODOs to Complete**:
- Queue system: Report generation (admin feature)
- Queue system: Settlement calculation (finance feature)
- Dashboard: Platform fees and payouts calculation

---

## 🟢 LOW PRIORITY - Enhancements

### 5. Complete Low-Priority TODOs
- Notification TODOs (when notification system is enhanced)
- Marketing team notifications (nice-to-have)

### 6. Feature Enhancements
- Complete third-party integrations (Stripe, Klarna, WhatsApp)
- Add missing frontend features
- Performance optimizations

---

## 📋 Recommended Action Order

### Immediate (Today):
1. ✅ **Verify Railway Deployment** - Check if API is running
2. ✅ **Check Environment Variables** - Ensure all required vars are set
3. ✅ **Test OAuth Endpoints** - Verify OAuth unlinking works in production

### This Week:
4. Fix Jest dependency and run test coverage
5. Complete medium-priority TODOs
6. Test all new features in production

### Next Week:
7. Complete low-priority TODOs
8. Add optional integrations
9. Performance optimizations

---

## 🚀 Quick Start Commands

### Check Railway Deployment:
```bash
# Visit Railway dashboard
# Check @hos-marketplace/api service status
# Review deployment logs
```

### Generate JWT Secrets:
```bash
openssl rand -base64 32  # For JWT_SECRET
openssl rand -base64 32  # For JWT_REFRESH_SECRET
```

### Test Production API:
```bash
# Health check
curl https://your-api.railway.app/api/health

# OAuth endpoints (after authentication)
curl https://your-api.railway.app/api/auth/oauth/accounts
```

---

**Current Status**: Phase 1 Complete ✅ | Moving to Production Readiness 🔴
**Next Action**: Verify Railway deployment and environment variables
