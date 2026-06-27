# 🚂 Railway Auto-Configuration Guide

This guide helps you set up Railway with minimal manual steps.

## 📋 What's Automated

✅ **Build Configuration** - `railway.toml` configures build settings  
✅ **JWT Secret Generation** - Script generates secure secrets  
✅ **Environment Variable Template** - Pre-filled with all needed variables  
✅ **Service Configuration** - Dockerfile paths and build commands  

## ⚙️ What Needs Manual Setup

⚠️ **Environment Variables** - Must be added in Railway dashboard (Railway doesn't support config-as-code for secrets)  
⚠️ **Database URLs** - Copy from PostgreSQL/Redis services  
⚠️ **Service URLs** - Update after deployment  

---

## 🚀 Quick Setup (5 Minutes)

### Step 1: Generate Environment Variables

Run the setup script:

```bash
chmod +x railway-env-setup.sh
./railway-env-setup.sh
```

This will:
- Generate JWT secrets
- Create `railway-env-variables.txt` with all variables

### Step 2: Get Database Connection Strings

1. **PostgreSQL:**
   - Railway Dashboard → PostgreSQL service
   - Variables tab → Copy `DATABASE_URL`

2. **Redis:**
   - Railway Dashboard → Redis service
   - Variables tab → Copy `REDIS_URL`

### Step 3: Add Variables to Backend API

1. Railway Dashboard → `@hos-marketplace/api` service
2. Variables tab → Click "+ New Variable"
3. Add variables from `railway-env-variables.txt`:
   - Replace `[COPY FROM POSTGRESQL SERVICE]` with actual DATABASE_URL
   - Replace `[COPY FROM REDIS SERVICE]` with actual REDIS_URL
   - Use generated JWT secrets from the script
   - Add other variables as listed

### Step 4: Wait for Deployment

- Railway auto-redeploys when you add variables
- Watch Deploy Logs for: `🚀 API server is running`
- Service should start successfully

### Step 5: Configure Frontend

1. Get backend URL from Settings → Networking
2. Go to `@hos-marketplace/web` → Variables tab
3. Add:
   ```
   NEXT_PUBLIC_API_URL=https://your-backend-url.railway.app/api
   NODE_ENV=production
   PORT=3000
   ```

### Step 6: Update Cross-References

1. Update `FRONTEND_URL` in backend with frontend URL
2. Verify `NEXT_PUBLIC_API_URL` in frontend is correct

---

## 📁 Files Created

### `railway.toml`
- Build and deployment configuration
- Healthcheck settings
- Restart policies

### `railway-env-setup.sh`
- Generates JWT secrets
- Creates environment variable template
- Provides setup instructions

### `railway-env-variables.txt`
- Complete list of all environment variables
- Pre-filled with generated secrets
- Ready to copy-paste into Railway

---

## 🔧 Configuration Details

### Backend API Service

**Build Settings (Auto-configured):**
- Dockerfile: `services/api/Dockerfile`
- Build Command: Handled by Dockerfile
- Start Command: `npm run start:prod`
- Healthcheck: `/api/health`

**Required Environment Variables:**
- `DATABASE_URL` (from PostgreSQL)
- `REDIS_URL` (from Redis)
- `PORT=3001`
- `NODE_ENV=production`
- `JWT_SECRET` (generated)
- `JWT_REFRESH_SECRET` (generated)

### Frontend Web Service

**Build Settings (Auto-configured):**
- Dockerfile: `apps/web/Dockerfile`
- Build Command: Handled by Dockerfile
- Start Command: `pnpm start`

**Required Environment Variables:**
- `NEXT_PUBLIC_API_URL` (backend URL + `/api`)
- `NODE_ENV=production`
- `PORT=3000`

---

## ✅ Verification Checklist

After setup, verify:

- [ ] Backend service shows "Active" status
- [ ] Healthcheck passes (green)
- [ ] Deploy logs show: `🚀 API server is running`
- [ ] Can access: `https://your-backend.railway.app/api/health`
- [ ] Frontend service shows "Active" status
- [ ] Can access frontend URL
- [ ] Frontend can connect to backend API

---

## 🐛 Troubleshooting

### Service Not Starting
- Check Deploy Logs for errors
- Verify all required environment variables are set
- Ensure DATABASE_URL and REDIS_URL are correct

### Healthcheck Failing
- Check if service is actually running
- Verify PORT is set correctly
- Check health endpoint: `/api/health`

### Module Not Found Errors
- Already fixed in Dockerfile
- If persists, check Deploy Logs

---

## 📝 Notes

- **Environment Variables**: Railway doesn't support setting secrets via config files (security feature)
- **Auto-Deploy**: Railway automatically redeploys when you push to GitHub
- **Service URLs**: Get from Settings → Networking → Generate Domain
- **Database URLs**: Always use internal URLs from Variables tab

---

## 🎯 Summary

1. Run `./railway-env-setup.sh` to generate secrets
2. Copy DATABASE_URL and REDIS_URL from database services
3. Add variables to Railway dashboard
4. Wait for auto-redeploy
5. Configure frontend
6. Update cross-references

**Total Time:** ~5-10 minutes  
**Difficulty:** ⭐⭐☆☆☆ (Easy with this guide)

---

**All configuration files are ready! Just add the environment variables in Railway dashboard.**

