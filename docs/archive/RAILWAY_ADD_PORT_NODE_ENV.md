# 🔧 Add PORT and NODE_ENV to Railway

## ⚠️ Important: These Go in Variables Tab, NOT Settings!

**PORT** and **NODE_ENV** are **environment variables**, so they must be added in the **Variables** tab, not the Settings tab.

---

## 📍 Where to Add Them

### Step 1: Go to Variables Tab

1. Railway Dashboard → `@hos-marketplace/api` service
2. Click **"Variables"** tab (not Settings!)
3. You should see your existing variables:
   - DATABASE_URL
   - REDIS_URL
   - JWT_SECRET
   - JWT_REFRESH_SECRET
   - etc.

### Step 2: Add Missing Variables

Click **"+ New Variable"** button and add these one by one:

**Variable 1:**
```
Name: PORT
Value: 3001
```

**Variable 2:**
```
Name: NODE_ENV
Value: production
```

**Variable 3:**
```
Name: FRONTEND_URL
Value: https://placeholder.railway.app
```
*(You'll update this after frontend deploys)*

---

## ✅ Complete Variable Checklist

Make sure you have ALL of these in the **Variables** tab:

- [x] DATABASE_URL (you have this)
- [x] REDIS_URL (you have this)
- [x] JWT_SECRET (you have this)
- [x] JWT_REFRESH_SECRET (you have this)
- [x] JWT_EXPIRES_IN (you have this)
- [x] JWT_REFRESH_EXPIRES_IN (you have this)
- [ ] **PORT=3001** ⚠️ **ADD THIS!**
- [ ] **NODE_ENV=production** ⚠️ **ADD THIS!**
- [ ] **FRONTEND_URL** ⚠️ **ADD THIS!** (placeholder is fine for now)

---

## 🔍 Settings Tab vs Variables Tab

**Settings Tab:**
- Build configuration (Dockerfile path, build commands)
- Deploy settings (start command, healthcheck)
- Networking (domains, ports)
- Resource limits

**Variables Tab:**
- Environment variables (PORT, NODE_ENV, DATABASE_URL, etc.)
- Secrets (JWT_SECRET, API keys, etc.)
- Configuration values

**PORT and NODE_ENV are environment variables → Variables tab!**

---

## 🎯 Quick Steps

1. Click **"Variables"** tab (top navigation)
2. Click **"+ New Variable"**
3. Add:
   - `PORT` = `3001`
   - `NODE_ENV` = `production`
   - `FRONTEND_URL` = `https://placeholder.railway.app`
4. Railway will auto-redeploy
5. Check Deploy Logs for: `🚀 API server is running`

---

## 🐛 Why Service is Crashing

Without `PORT` and `NODE_ENV`:
- Application doesn't know which port to use
- May default to wrong port or fail to start
- Missing NODE_ENV can cause configuration issues

**Adding these should fix the crash!**

---

**TL;DR: Go to Variables tab → Add PORT=3001 and NODE_ENV=production**

