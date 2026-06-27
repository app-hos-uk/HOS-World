# 🚨 Fix Infinite Healthcheck - Service Not Starting

## Problem
The healthcheck is failing infinitely because the application isn't starting. This is **NOT a healthcheck issue** - it's an **application startup issue**.

## Root Cause
The application requires `DATABASE_URL` to start (Prisma connects on module init). Without it, the app crashes immediately.

---

## ✅ Solution: Add Environment Variables

### Step 1: Disable Healthcheck (Already Done)
I've temporarily disabled the healthcheck in `railway.toml` so the deployment can complete and you can see the actual error.

### Step 2: Check Deploy Logs
1. Go to Railway dashboard
2. Click `@hos-marketplace/api` service
3. Go to **"Deployments"** tab
4. Click latest deployment
5. Go to **"Deploy Logs"** tab
6. **Look for error messages** - you'll likely see:
   - `DATABASE_URL is required`
   - `PrismaClientInitializationError`
   - `Connection refused`

### Step 3: Add Required Environment Variables

Go to `@hos-marketplace/api` → **"Variables"** tab:

#### Get Database Connection Strings:

**From PostgreSQL Service:**
1. Click **PostgreSQL** service
2. Go to **"Variables"** tab
3. Find `DATABASE_URL`
4. **Copy the entire value** (it's long!)
5. Paste into backend API variables

**From Redis Service:**
1. Click **Redis** service  
2. Go to **"Variables"** tab
3. Find `REDIS_URL`
4. **Copy the entire value**
5. Paste into backend API variables

#### Add These Variables:

```env
# Database (REQUIRED - Get from PostgreSQL service)
DATABASE_URL=postgresql://postgres:password@containers-us-west-xxx.railway.app:5432/railway

# Redis (REQUIRED - Get from Redis service)
REDIS_URL=redis://default:password@containers-us-west-xxx.railway.app:6379

# Server Configuration
PORT=3001
NODE_ENV=production
FRONTEND_URL=https://placeholder.railway.app

# JWT Secrets (Generate these)
JWT_SECRET=[generate with: openssl rand -base64 32]
JWT_EXPIRES_IN=7d
JWT_REFRESH_SECRET=[generate with: openssl rand -base64 32]
JWT_REFRESH_EXPIRES_IN=30d
```

### Step 4: Generate JWT Secrets

Run in your terminal:
```bash
openssl rand -base64 32
```

Run it **twice** to get two different secrets:
- First secret → `JWT_SECRET`
- Second secret → `JWT_REFRESH_SECRET`

### Step 5: Redeploy

After adding variables:
1. Railway will **auto-redeploy**
2. Watch **"Deploy Logs"** tab
3. Look for: `🚀 API server is running on: http://localhost:3001/api`
4. If you see this, the service started successfully!

### Step 6: Re-enable Healthcheck (After Service Starts)

Once the service is running:
1. Edit `railway.toml`
2. Uncomment the healthcheck lines:
   ```toml
   healthcheckPath = "/api/health"
   healthcheckTimeout = 300
   ```
3. Commit and push
4. Healthcheck should now pass

---

## 🔍 How to Verify Service is Running

### Option 1: Check Deploy Logs
Look for this message:
```
🚀 API server is running on: http://localhost:3001/api
```

### Option 2: Check Service Status
- Service should show **"Active"** (green)
- No crash loops

### Option 3: Test Health Endpoint
1. Get your backend URL from Settings → Networking
2. Visit: `https://your-backend-url.railway.app/api/health`
3. Should return: `{"status":"ok","timestamp":"...","service":"House of Spells Marketplace API"}`

---

## 🐛 Common Errors and Solutions

### Error: "DATABASE_URL is required"
**Solution:** Add `DATABASE_URL` from PostgreSQL service variables

### Error: "PrismaClientInitializationError: Can't reach database server"
**Solution:** 
- Verify `DATABASE_URL` is correct (copy entire value)
- Check PostgreSQL service is running (green status)
- Ensure URL includes full connection string

### Error: "Connection refused" or "ECONNREFUSED"
**Solution:**
- Database URL might be wrong
- PostgreSQL service might not be running
- Check the URL format is correct

### Error: "Port already in use"
**Solution:**
- Railway auto-assigns ports
- Make sure `PORT=3001` is set
- Don't hardcode ports in code

---

## 📋 Quick Checklist

- [ ] Healthcheck temporarily disabled (done)
- [ ] Checked Deploy Logs for actual error
- [ ] Added `DATABASE_URL` from PostgreSQL service
- [ ] Added `REDIS_URL` from Redis service
- [ ] Added `PORT=3001`
- [ ] Added `NODE_ENV=production`
- [ ] Generated and added JWT secrets
- [ ] Service redeployed
- [ ] Service shows "Active" status
- [ ] Deploy logs show "API server is running"
- [ ] Health endpoint returns OK
- [ ] Re-enabled healthcheck

---

## ⚡ Quick Fix Summary

1. **Add `DATABASE_URL`** from PostgreSQL service → Variables tab
2. **Add `REDIS_URL`** from Redis service → Variables tab
3. **Add `PORT=3001`** and `NODE_ENV=production`
4. **Generate JWT secrets** and add them
5. **Wait for auto-redeploy**
6. **Check logs** for "API server is running"
7. **Re-enable healthcheck** once service starts

---

**The healthcheck is failing because the app isn't starting. Add the environment variables and it should work!**

