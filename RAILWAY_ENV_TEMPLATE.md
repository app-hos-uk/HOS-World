# Railway Environment Variables Template

Copy and paste these into Railway's Variables tab for each service.

---

## 🔧 Backend API Service Variables

### Copy this entire section to Railway Backend API → Variables tab:

```env
# ============================================
# DATABASE & CACHE (From Railway Services)
# ============================================
# Get these from your PostgreSQL and Redis services in Railway
DATABASE_URL=postgresql://postgres:password@containers-us-west-xxx.railway.app:5432/railway
REDIS_URL=redis://default:password@containers-us-west-xxx.railway.app:6379

# ============================================
# SERVER CONFIGURATION
# ============================================
PORT=3001
NODE_ENV=production
FRONTEND_URL=https://your-frontend-service.railway.app

# ============================================
# JWT AUTHENTICATION
# ============================================
# Generate these using: openssl rand -base64 32
# Run the command twice to get two different secrets
JWT_SECRET=CHANGE_THIS_TO_RANDOM_STRING_64_CHARS_MIN
JWT_EXPIRES_IN=7d
JWT_REFRESH_SECRET=CHANGE_THIS_TO_ANOTHER_RANDOM_STRING_64_CHARS_MIN
JWT_REFRESH_EXPIRES_IN=30d

# ============================================
# SEARCH (Optional - Start with PostgreSQL)
# ============================================
ELASTICSEARCH_NODE=
SYNC_PRODUCTS_ON_STARTUP=false

# ============================================
# RATE LIMITING
# ============================================
RATE_LIMIT_TTL=60000
RATE_LIMIT_MAX=100

# ============================================
# FILE UPLOAD
# ============================================
UPLOAD_MAX_SIZE=10485760
UPLOAD_ALLOWED_TYPES=image/jpeg,image/png,image/gif,image/webp

# ============================================
# EMAIL (Gmail - Free Option)
# ============================================
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-gmail-app-password
SMTP_FROM=noreply@hos-marketplace.com

# ============================================
# STRIPE PAYMENTS (Add After Stripe Setup)
# ============================================
STRIPE_SECRET_KEY=sk_test_YOUR_STRIPE_SECRET_KEY
STRIPE_PUBLISHABLE_KEY=pk_test_YOUR_STRIPE_PUBLISHABLE_KEY
STRIPE_WEBHOOK_SECRET=whsec_YOUR_WEBHOOK_SECRET

# ============================================
# CLOUDINARY IMAGE STORAGE (Add After Cloudinary Setup)
# ============================================
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# ============================================
# GEMINI AI (Add After Google AI Setup)
# ============================================
GEMINI_API_KEY=your-gemini-api-key-here

# ============================================
# CDN (Optional - For Later)
# ============================================
CDN_URL=
```

---

## 🌐 Frontend Web Service Variables

### Copy this entire section to Railway Frontend → Variables tab:

```env
# ============================================
# API CONNECTION
# ============================================
# Replace with your actual backend URL from Railway
# Must include https:// and /api at the end
NEXT_PUBLIC_API_URL=https://your-backend-service.railway.app/api

# ============================================
# SERVER CONFIGURATION
# ============================================
NODE_ENV=production
PORT=3000
```

---

## 📝 How to Add Variables in Railway

1. Go to your service in Railway dashboard
2. Click **"Variables"** tab
3. Click **"+ New Variable"** button
4. Enter **Variable Name** (e.g., `DATABASE_URL`)
5. Enter **Value** (paste the value)
6. Click **"Add"** or press Enter
7. Repeat for each variable

**Tip:** Railway will auto-redeploy when you add/change variables.

**Important:** 
- Variable names are case-sensitive
- Use exact names as shown above
- Don't include quotes around values
- For `DATABASE_URL` and `REDIS_URL`, copy the entire value from Railway's service variables

---

## 🔑 How to Generate Secure Secrets

### For JWT_SECRET and JWT_REFRESH_SECRET:

**Option 1: Using OpenSSL (Mac/Linux)**
```bash
openssl rand -base64 32
```

**Option 2: Using Online Generator**
- Go to https://randomkeygen.com
- Use "CodeIgniter Encryption Keys" (256-bit)
- Copy the generated key

**Option 3: Using Node.js**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

**Run the command twice** to get two different secrets for `JWT_SECRET` and `JWT_REFRESH_SECRET`.

---

## ✅ Variable Checklist

### Backend API - Required (Minimum):
- [ ] DATABASE_URL (from PostgreSQL service - copy entire value)
- [ ] REDIS_URL (from Redis service - copy entire value)
- [ ] PORT=3001
- [ ] NODE_ENV=production
- [ ] FRONTEND_URL (your frontend Railway URL - update after frontend deploys)
- [ ] JWT_SECRET (generate using openssl rand -base64 32)
- [ ] JWT_EXPIRES_IN=7d
- [ ] JWT_REFRESH_SECRET (generate using openssl rand -base64 32)
- [ ] JWT_REFRESH_EXPIRES_IN=30d

### Backend API - Email (Required for notifications):
- [ ] SMTP_HOST=smtp.gmail.com
- [ ] SMTP_PORT=587
- [ ] SMTP_USER (your Gmail address)
- [ ] SMTP_PASS (Gmail App Password - 16 characters)
- [ ] SMTP_FROM=noreply@hos-marketplace.com

### Backend API - Optional (Add Later):
- [ ] STRIPE_SECRET_KEY (from Stripe dashboard)
- [ ] STRIPE_PUBLISHABLE_KEY (from Stripe dashboard)
- [ ] STRIPE_WEBHOOK_SECRET (from Stripe dashboard)
- [ ] CLOUDINARY_CLOUD_NAME (from Cloudinary dashboard)
- [ ] CLOUDINARY_API_KEY (from Cloudinary dashboard)
- [ ] CLOUDINARY_API_SECRET (from Cloudinary dashboard)
- [ ] GEMINI_API_KEY (from Google AI Studio)

### Frontend - Required:
- [ ] NEXT_PUBLIC_API_URL (your backend Railway URL + /api)
- [ ] NODE_ENV=production
- [ ] PORT=3000

---

## 🚨 Important Notes

1. **Never commit `.env` files to GitHub** - Railway handles this automatically
2. **Use Railway's Variables tab** - Don't create `.env` files in your code
3. **Variables are case-sensitive** - Use exact names as shown
4. **Railway auto-redeploys** after adding/changing variables
5. **Test in production** - Some features need production URLs
6. **Copy entire connection strings** - Don't modify DATABASE_URL or REDIS_URL
7. **Update FRONTEND_URL** after frontend deploys
8. **Update NEXT_PUBLIC_API_URL** after backend deploys

---

## 🔄 Updating Variables

1. Go to service → Variables tab
2. Click on variable name to edit
3. Update value
4. Click "Save" or press Enter
5. Railway will auto-redeploy

---

## 📋 Quick Copy-Paste Format

### Backend - Copy these one by one:

```
DATABASE_URL
REDIS_URL
PORT=3001
NODE_ENV=production
FRONTEND_URL=https://your-frontend.railway.app
JWT_SECRET=[generate]
JWT_EXPIRES_IN=7d
JWT_REFRESH_SECRET=[generate]
JWT_REFRESH_EXPIRES_IN=30d
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=[gmail-app-password]
SMTP_FROM=noreply@hos-marketplace.com
```

### Frontend - Copy these:

```
NEXT_PUBLIC_API_URL=https://your-backend.railway.app/api
NODE_ENV=production
PORT=3000
```

---

**Last Updated:** December 2024
**For:** House of Spells Marketplace
**Repository:** https://github.com/app-hos-uk/HOS-World

