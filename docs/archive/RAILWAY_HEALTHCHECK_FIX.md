# 🔧 Fix Healthcheck Failure - Backend API

## ✅ Good News!
Your Docker build **completed successfully**! The image was built and deployed.

## ❌ Current Issue
The healthcheck is failing because the service isn't responding at `/api/health`. This is likely because:
1. **Missing environment variables** (DATABASE_URL, etc.)
2. **Application crashing on startup**
3. **Port configuration issue**

---

## 🔍 Step 1: Check Application Logs

1. Go to Railway dashboard
2. Click on `@hos-marketplace/api` service
3. Go to **"Deployments"** tab
4. Click on the latest deployment
5. Go to **"Deploy Logs"** tab
6. Look for error messages

**Common errors you might see:**
- `DATABASE_URL is required`
- `Connection refused` (database connection)
- `Port already in use`
- `Prisma Client not generated`

---

## 🔧 Step 2: Add Environment Variables

The application needs these variables to start. Go to `@hos-marketplace/api` → **"Variables"** tab and add:

### Required Variables (Minimum):

```env
# Database (Get from PostgreSQL service)
DATABASE_URL=postgresql://postgres:password@containers-us-west-xxx.railway.app:5432/railway

# Redis (Get from Redis service)  
REDIS_URL=redis://default:password@containers-us-west-xxx.railway.app:6379

# Server
PORT=3001
NODE_ENV=production
FRONTEND_URL=https://your-frontend-url.railway.app
```

### How to Get DATABASE_URL and REDIS_URL:

1. Click on **PostgreSQL** service → **"Variables"** tab
2. Copy the entire `DATABASE_URL` value
3. Click on **Redis** service → **"Variables"** tab  
4. Copy the entire `REDIS_URL` value
5. Paste them into the backend API service variables

### JWT Secrets (Generate these):

Run in your terminal:
```bash
openssl rand -base64 32
```

Run it **twice** to get two different secrets, then add:

```env
JWT_SECRET=[First generated secret]
JWT_EXPIRES_IN=7d
JWT_REFRESH_SECRET=[Second generated secret]
JWT_REFRESH_EXPIRES_IN=30d
```

---

## 🔄 Step 3: Redeploy

After adding environment variables:
1. Railway will **auto-redeploy** the service
2. Watch the **"Deploy Logs"** tab
3. Wait for the service to start
4. Healthcheck should pass after ~30 seconds

---

## 📋 Quick Checklist

- [ ] Checked Deploy Logs for errors
- [ ] Added `DATABASE_URL` from PostgreSQL service
- [ ] Added `REDIS_URL` from Redis service
- [ ] Added `PORT=3001`
- [ ] Added `NODE_ENV=production`
- [ ] Added `FRONTEND_URL` (can be placeholder for now)
- [ ] Generated and added JWT secrets
- [ ] Service redeployed
- [ ] Healthcheck passing

---

## 🐛 Common Issues

### Issue: "DATABASE_URL is required"
**Solution:** Add DATABASE_URL from PostgreSQL service variables

### Issue: "Connection refused" or "ECONNREFUSED"
**Solution:** 
- Verify DATABASE_URL is correct
- Check PostgreSQL service is running (green status)
- Ensure the URL includes the full connection string

### Issue: "Prisma Client not generated"
**Solution:** This should be fixed, but if you see this:
- The Prisma client is generated during build
- Check that `node_modules` includes `@prisma/client`

### Issue: "Port already in use"
**Solution:**
- Railway auto-assigns ports
- Make sure `PORT` variable is set to `3001`
- Don't hardcode ports in code

---

## ✅ Success Indicators

When everything is working:
- ✅ Service status shows **"Active"** (green)
- ✅ Healthcheck shows **"Healthy"**
- ✅ Deploy Logs show: `🚀 API server is running on: http://localhost:3001/api`
- ✅ You can visit: `https://your-backend-url.railway.app/api/health`
- ✅ Returns: `{"status":"ok","timestamp":"...","service":"House of Spells Marketplace API"}`

---

## 🎯 Next Steps After Healthcheck Passes

1. Get backend URL from Settings → Networking
2. Configure frontend service
3. Update `FRONTEND_URL` in backend with frontend URL
4. Update `NEXT_PUBLIC_API_URL` in frontend with backend URL

---

**Quick Fix:** Add `DATABASE_URL` and `REDIS_URL` from your database services, then Railway will auto-redeploy!

