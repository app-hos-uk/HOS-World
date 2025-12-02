# 🚀 Railway Quick Start - 15 Minute Setup

**Fastest way to get your app on Railway**

---

## ⚡ Quick Steps (15 minutes)

### 1. Connect GitHub (2 min)
- Login to Railway → New Project → Deploy from GitHub
- Select repository: **`app-hos-uk/HOS-World`**

### 2. Add Services (5 min)
- Click **"+ New"** → **"Database"** → **"PostgreSQL"** ✅
- Click **"+ New"** → **"Database"** → **"Redis"** ✅
- Click **"+ New"** → **"GitHub Repo"** → Select repo (Backend) ✅
- Click **"+ New"** → **"GitHub Repo"** → Select repo (Frontend) ✅

### 3. Configure Backend (5 min)
- Click **Backend service** → **Settings**
- **Root Directory:** `services/api`
- **Build Command:** `cd ../.. && pnpm install && pnpm --filter @hos-marketplace/api build`
- **Start Command:** `cd services/api && pnpm start:prod`
- **Post Deploy Command:** `cd services/api && pnpm db:generate && pnpm db:migrate deploy`
- **Variables tab:** Copy from `RAILWAY_ENV_TEMPLATE.md`
  - Get `DATABASE_URL` from PostgreSQL service
  - Get `REDIS_URL` from Redis service
  - Generate JWT secrets: `openssl rand -base64 32` (run twice)

### 4. Configure Frontend (3 min)
- Click **Frontend service** → **Settings**
- **Root Directory:** `apps/web`
- **Build Command:** `cd ../.. && pnpm install && pnpm --filter @hos-marketplace/web build`
- **Start Command:** `cd apps/web && pnpm start`
- **Variables tab:** 
  - `NEXT_PUBLIC_API_URL=https://your-backend-url.railway.app/api`
  - `NODE_ENV=production`
  - `PORT=3000`

### 5. Get URLs
- Each service → Settings → Networking → Generate Domain
- Copy URLs

### 6. Update Variables
- Backend: Update `FRONTEND_URL` with frontend URL
- Frontend: Update `NEXT_PUBLIC_API_URL` with backend URL

**✅ Done! Your app is live!**

---

## 📋 What You'll Have

```
Railway Project: House of Spells Marketplace
├── PostgreSQL (Database)
├── Redis (Cache)  
├── Backend API (hos-api.railway.app)
└── Frontend (hos-web.railway.app)
```

---

## 🎯 Minimum Variables Needed

### Backend (Copy from PostgreSQL & Redis services):
- `DATABASE_URL` ← From PostgreSQL service Variables tab
- `REDIS_URL` ← From Redis service Variables tab
- `PORT=3001`
- `NODE_ENV=production`
- `FRONTEND_URL` ← Your frontend Railway URL (update after frontend deploys)
- `JWT_SECRET` ← Generate: `openssl rand -base64 32`
- `JWT_REFRESH_SECRET` ← Generate: `openssl rand -base64 32`

### Frontend:
- `NEXT_PUBLIC_API_URL` ← Your backend Railway URL + `/api`
- `NODE_ENV=production`
- `PORT=3000`

---

## 🔗 Full Guide

For detailed instructions, see: **`RAILWAY_SETUP_GUIDE.md`**

For environment variables, see: **`RAILWAY_ENV_TEMPLATE.md`**

---

## 💡 Pro Tips

1. **Railway auto-deploys** when you push to GitHub
2. **Variables are shared** - You can reference other services
3. **Check logs** in Deployments tab if something fails
4. **Free tier** gives you $5/month credit
5. **Copy entire connection strings** - Don't modify them
6. **Generate JWT secrets** before adding variables

---

## 🚨 Common Mistakes to Avoid

1. ❌ Wrong Root Directory (must be `services/api` and `apps/web`)
2. ❌ Missing `cd ../..` in build commands
3. ❌ Forgetting to copy `DATABASE_URL` and `REDIS_URL` from services
4. ❌ Not generating JWT secrets
5. ❌ Wrong `NEXT_PUBLIC_API_URL` format (must include `/api`)
6. ❌ Not updating `FRONTEND_URL` after frontend deploys

---

**Time to deploy:** ~15 minutes
**Difficulty:** ⭐⭐☆☆☆ (Easy)
**Cost:** ~$10-20/month

---

**Ready to deploy?** Follow `RAILWAY_SETUP_GUIDE.md` for step-by-step instructions!

