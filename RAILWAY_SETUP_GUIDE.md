# 🚂 Railway Deployment Guide - House of Spells Marketplace

**Complete Step-by-Step Guide for Beginners**

This guide will help you deploy your entire application to Railway with minimal errors. We'll use Railway's web dashboard (no command line needed initially).

---

## 📋 Prerequisites Checklist

Before starting, make sure you have:
- ✅ Railway account created
- ✅ GitHub account with code pushed (you just did this!)
- ✅ 30-45 minutes of time
- ✅ Access to https://railway.app

---

## 🎯 What We'll Deploy

1. **PostgreSQL Database** (Railway managed)
2. **Redis Cache** (Railway managed)
3. **Backend API** (NestJS - Port 3001)
4. **Frontend Web App** (Next.js - Port 3000)

---

## 📝 Step 1: Login to Railway

1. Go to https://railway.app
2. Click **"Login"** (top right)
3. Choose **"Login with GitHub"**
4. Authorize Railway to access your GitHub account
5. Select the **`app-hos-uk`** organization if prompted

**✅ You're now logged into Railway!**

---

## 🚀 Step 2: Create Railway Project

### 2.1 Create New Project

1. Click **"New Project"** button (top right)
2. Select **"Deploy from GitHub repo"**
3. Find and select your repository: **`app-hos-uk/HOS-World`**
4. Click **"Deploy Now"**

**✅ You now have a Railway project!**

---

## 🗄️ Step 3: Add PostgreSQL Database

### 3.1 Add PostgreSQL Service

1. In your Railway project dashboard, click **"+ New"** button
2. Select **"Database"** from the dropdown
3. Choose **"Add PostgreSQL"**
4. Wait for it to provision (30-60 seconds)
5. You'll see a new service appear called "PostgreSQL"

### 3.2 Get Database Connection String

1. Click on the **PostgreSQL** service card
2. Go to **"Variables"** tab
3. Find **`DATABASE_URL`** - **COPY THIS ENTIRE VALUE** (you'll need it later)
   - It looks like: `postgresql://postgres:password@containers-us-west-xxx.railway.app:5432/railway`
   - **Save this somewhere safe!**

**✅ PostgreSQL is ready!**

---

## 🔴 Step 4: Add Redis Cache

### 4.1 Add Redis Service

1. In your Railway project dashboard, click **"+ New"** button
2. Select **"Database"** from the dropdown
3. Choose **"Add Redis"**
4. Wait for it to provision (30-60 seconds)
5. You'll see a new service appear called "Redis"

### 4.2 Get Redis Connection String

1. Click on the **Redis** service card
2. Go to **"Variables"** tab
3. Find **`REDIS_URL`** - **COPY THIS ENTIRE VALUE** (you'll need it later)
   - It looks like: `redis://default:password@containers-us-west-xxx.railway.app:6379`
   - **Save this somewhere safe!**

**✅ Redis is ready!**

---

## 🔧 Step 5: Deploy Backend API

### 5.1 Add Backend Service

1. In your Railway project dashboard, click **"+ New"** button
2. Select **"GitHub Repo"** from the dropdown
3. Select your repository: **`app-hos-uk/HOS-World`**
4. Railway will detect it's a monorepo

### 5.2 Configure Backend Service

1. Click on the newly created service (it might be named after your repo)
2. Go to **"Settings"** tab
3. Scroll down and configure:

   **Service Name:** 
   - Click the service name at the top
   - Rename to: `hos-api` or `backend-api`

   **Root Directory:**
   - Find "Root Directory" field
   - Enter: `services/api`

   **Build Command:**
   - Find "Build Command" field
   - Enter: `cd ../.. && pnpm install && pnpm --filter @hos-marketplace/api build`

   **Start Command:**
   - Find "Start Command" field
   - Enter: `cd services/api && pnpm start:prod`

   **Post Deploy Command:**
   - Find "Post Deploy Command" field (if available)
   - Enter: `cd services/api && pnpm db:generate && pnpm db:migrate deploy`

### 5.3 Set Environment Variables

1. Stay in the backend service
2. Go to **"Variables"** tab
3. Click **"+ New Variable"** for each variable below

#### Copy these variables one by one:

**Database & Cache (from services you created):**
```
DATABASE_URL = [Paste the DATABASE_URL from PostgreSQL service]
REDIS_URL = [Paste the REDIS_URL from Redis service]
```

**Server Configuration:**
```
PORT = 3001
NODE_ENV = production
FRONTEND_URL = https://your-frontend-url.railway.app
```
*(You'll update FRONTEND_URL after deploying frontend)*

**JWT Authentication (Generate these):**
```
JWT_SECRET = [Run: openssl rand -base64 32]
JWT_EXPIRES_IN = 7d
JWT_REFRESH_SECRET = [Run: openssl rand -base64 32]
JWT_REFRESH_EXPIRES_IN = 30d
```

**To generate JWT secrets, run in terminal:**
```bash
openssl rand -base64 32
```
Run it twice to get two different secrets.

**Optional (Set Later):**
```
ELASTICSEARCH_NODE = 
SYNC_PRODUCTS_ON_STARTUP = false
RATE_LIMIT_TTL = 60000
RATE_LIMIT_MAX = 100
UPLOAD_MAX_SIZE = 10485760
UPLOAD_ALLOWED_TYPES = image/jpeg,image/png,image/gif,image/webp
```

**Email (Gmail - Free):**
```
SMTP_HOST = smtp.gmail.com
SMTP_PORT = 587
SMTP_USER = your-email@gmail.com
SMTP_PASS = [Gmail App Password - see instructions below]
SMTP_FROM = noreply@hos-marketplace.com
```

**To get Gmail App Password:**
1. Go to https://myaccount.google.com → Security
2. Enable 2-Step Verification (if not already)
3. Go to "App Passwords" (search for it)
4. Select "Mail" and "Other (Custom name)"
5. Name it: "Railway HOS"
6. Click "Generate"
7. Copy the 16-character password
8. Use it in `SMTP_PASS`

**Stripe (Add Later - Test Mode):**
```
STRIPE_SECRET_KEY = sk_test_...
STRIPE_PUBLISHABLE_KEY = pk_test_...
STRIPE_WEBHOOK_SECRET = whsec_...
```

**Cloudinary (Add Later):**
```
CLOUDINARY_CLOUD_NAME = ...
CLOUDINARY_API_KEY = ...
CLOUDINARY_API_SECRET = ...
```

**Gemini AI (Add Later):**
```
GEMINI_API_KEY = ...
```

### 5.4 Deploy Backend

1. Railway will auto-deploy when you add variables
2. Go to **"Deployments"** tab to watch the build
3. Wait for build to complete (5-10 minutes first time)
4. Status will show "Active" when ready

**✅ Backend API is deploying!**

### 5.5 Get Backend URL

1. Go to **"Settings"** tab
2. Scroll to **"Networking"** section
3. Click **"Generate Domain"** button
4. Copy the URL (e.g., `hos-api-production.up.railway.app`)
5. **Save this URL** - you'll need it for frontend

---

## 🌐 Step 6: Deploy Frontend Web App

### 6.1 Add Frontend Service

1. In your Railway project dashboard, click **"+ New"** button
2. Select **"GitHub Repo"** from the dropdown
3. Select your repository: **`app-hos-uk/HOS-World`** again

### 6.2 Configure Frontend Service

1. Click on the newly created service
2. Go to **"Settings"** tab
3. Configure:

   **Service Name:**
   - Rename to: `hos-web` or `frontend`

   **Root Directory:**
   - Enter: `apps/web`

   **Build Command:**
   - Enter: `cd ../.. && pnpm install && pnpm --filter @hos-marketplace/web build`

   **Start Command:**
   - Enter: `cd apps/web && pnpm start`

### 6.3 Set Environment Variables

1. Go to **"Variables"** tab
2. Click **"+ New Variable"** for each:

```
NEXT_PUBLIC_API_URL = https://your-backend-url.railway.app/api
```

**Replace `your-backend-url` with the actual backend URL from Step 5.5**

```
NODE_ENV = production
PORT = 3000
```

### 6.4 Deploy Frontend

1. Railway will auto-deploy
2. Go to **"Deployments"** tab to watch the build
3. Wait for build to complete (5-10 minutes first time)
4. Status will show "Active" when ready

**✅ Frontend is deploying!**

### 6.5 Get Frontend URL

1. Go to **"Settings"** tab
2. Scroll to **"Networking"** section
3. Click **"Generate Domain"** button
4. Copy the URL (e.g., `hos-web-production.up.railway.app`)

**✅ Your app is live!**

---

## 🔄 Step 7: Update Environment Variables

### 7.1 Update Backend FRONTEND_URL

1. Go to **Backend API** service (`hos-api`)
2. **Variables** tab
3. Find `FRONTEND_URL`
4. Click to edit
5. Update with your frontend URL from Step 6.5
6. Save

Railway will auto-redeploy when you change variables.

---

## ✅ Step 8: Verify Everything Works

### 8.1 Check Backend Health

Visit: `https://your-backend-url.railway.app/api/health`

Should return: `{"status":"ok"}` or similar

### 8.2 Check Frontend

Visit: `https://your-frontend-url.railway.app`

Should show: House of Spells homepage with hero banners

### 8.3 Test Database Connection

1. Go to **PostgreSQL** service in Railway
2. Click **"Query"** tab (if available)
3. Or check logs to see if migrations ran successfully

---

## 🔐 Step 9: Set Up External Services (Later)

These can be set up after deployment:

### 9.1 Cloudinary (Image Storage)

1. Go to https://cloudinary.com
2. Sign up (free tier available)
3. Get credentials from Dashboard
4. Add to Backend API variables:
   - `CLOUDINARY_CLOUD_NAME`
   - `CLOUDINARY_API_KEY`
   - `CLOUDINARY_API_SECRET`

### 9.2 Stripe (Payments)

1. Go to https://stripe.com
2. Sign up (free)
3. Get test keys from Dashboard → Developers → API keys
4. Add to Backend API variables:
   - `STRIPE_SECRET_KEY` (starts with `sk_test_`)
   - `STRIPE_PUBLISHABLE_KEY` (starts with `pk_test_`)

### 9.3 Google Gemini API (AI Features)

1. Go to https://ai.google.dev
2. Get API key
3. Add to Backend API variables:
   - `GEMINI_API_KEY`

---

## 🎨 Step 10: Custom Domain (Optional)

### 10.1 Add Custom Domain

1. Go to **Frontend** service → **Settings** → **Networking**
2. Click **"Custom Domain"**
3. Enter your domain (e.g., `houseofspells.co.uk`)
4. Follow DNS instructions provided by Railway

---

## 📊 Railway Dashboard Overview

Your Railway project should now have:

```
House of Spells Marketplace (Railway Project)
├── PostgreSQL (Database)
├── Redis (Cache)
├── hos-api (Backend API)
└── hos-web (Frontend)
```

---

## 🐛 Troubleshooting

### Problem: Build Fails

**Solution:**
1. Check **"Deployments"** tab for error logs
2. Common issues:
   - Missing environment variables
   - Build command incorrect
   - Dependencies not installing
   - Root directory wrong

### Problem: Database Connection Error

**Solution:**
1. Verify `DATABASE_URL` is correct (copy from PostgreSQL service)
2. Check PostgreSQL service is running (green status)
3. Ensure migrations ran (check logs in Deployments tab)
4. Verify Post Deploy Command is set

### Problem: Frontend Can't Connect to API

**Solution:**
1. Verify `NEXT_PUBLIC_API_URL` is correct:
   - Should be: `https://your-backend.railway.app/api`
   - Must include `https://` and `/api` at end
2. Check backend is deployed and running
3. Verify backend health endpoint works
4. Check CORS settings in backend (should allow frontend domain)

### Problem: Port Already in Use

**Solution:**
- Railway auto-assigns ports
- Use `PORT` environment variable
- Don't hardcode ports in code

### Problem: Monorepo Build Issues

**Solution:**
1. Verify Root Directory is correct:
   - Backend: `services/api`
   - Frontend: `apps/web`
2. Check Build Command includes `cd ../..` to go to root
3. Verify `pnpm-workspace.yaml` exists in root
4. Check `package.json` has correct workspace configuration

---

## 💰 Railway Pricing

**Free Tier:**
- $5 credit/month
- Enough for small deployments

**Hobby Plan ($5/month):**
- $5 credit included
- Additional usage pay-as-you-go

**Pro Plan ($20/month):**
- $20 credit included
- Better for production

**Your estimated cost:** ~$10-20/month for this setup

---

## 📝 Quick Reference: Environment Variables

See `RAILWAY_ENV_TEMPLATE.md` for complete variable list.

### Backend API - Minimum Required:

```env
DATABASE_URL=postgresql://... (from Railway PostgreSQL)
REDIS_URL=redis://... (from Railway Redis)
PORT=3001
NODE_ENV=production
FRONTEND_URL=https://your-frontend.railway.app
JWT_SECRET=[generate]
JWT_REFRESH_SECRET=[generate]
```

### Frontend - Required:

```env
NEXT_PUBLIC_API_URL=https://your-backend.railway.app/api
NODE_ENV=production
PORT=3000
```

---

## ✅ Deployment Checklist

- [ ] Code pushed to GitHub ✅
- [ ] Railway project created
- [ ] PostgreSQL service added
- [ ] Redis service added
- [ ] Backend API service added and configured
- [ ] Backend environment variables set
- [ ] Backend deployed successfully
- [ ] Backend URL obtained
- [ ] Frontend service added and configured
- [ ] Frontend environment variables set
- [ ] Frontend deployed successfully
- [ ] Frontend URL obtained
- [ ] FRONTEND_URL updated in backend
- [ ] NEXT_PUBLIC_API_URL updated in frontend
- [ ] Both services accessible via URLs
- [ ] Database migrations run
- [ ] Health checks passing

---

## 🎉 Success!

Your House of Spells Marketplace is now live on Railway!

**Next Steps:**
1. Set up Cloudinary for images
2. Set up Stripe for payments
3. Set up Google Gemini for AI features
4. Configure custom domain
5. Monitor usage in Railway dashboard

---

## 📞 Need Help?

If you encounter issues:
1. Check Railway logs in **"Deployments"** tab
2. Verify all environment variables are set
3. Ensure services are running (green status)
4. Check this guide's troubleshooting section
5. Railway Discord: https://discord.gg/railway
6. Railway Docs: https://docs.railway.app

**Common Railway Dashboard Locations:**
- **Services:** Left sidebar or main dashboard
- **Variables:** Service → Variables tab
- **Logs:** Service → Deployments → Click deployment → View logs
- **Settings:** Service → Settings tab
- **Networking:** Service → Settings → Networking section

---

**Last Updated:** December 2024
**Railway Version:** Latest
**Repository:** https://github.com/app-hos-uk/HOS-World

