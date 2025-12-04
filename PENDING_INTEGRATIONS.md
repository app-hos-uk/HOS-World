# 🔌 Pending Integrations & Third-Party Services

## Overview

This document lists all third-party integrations and services that need to be configured for the House of Spells Marketplace. Based on the codebase analysis, here are the pending integrations:

---

## 🎯 Priority 1: Essential for Production

### 1. **Cloudinary** (Image/File Storage) ⚠️ **HIGH PRIORITY**

**Status:** Code structure exists, but implementation is incomplete (TODO comments)

**What it does:**
- Stores product images
- Stores user avatars
- Stores seller logos
- Stores theme assets
- Image optimization and transformations

**Current Status:**
- ✅ Storage service structure exists (`services/api/src/storage/storage.service.ts`)
- ❌ Cloudinary upload implementation is incomplete (placeholder only)
- ❌ Cloudinary deletion implementation is incomplete
- ❌ Cloudinary SDK not installed

**Required Setup:**
1. Create Cloudinary account: https://cloudinary.com
2. Get credentials:
   - `CLOUDINARY_CLOUD_NAME`
   - `CLOUDINARY_API_KEY`
   - `CLOUDINARY_API_SECRET`
3. Install Cloudinary SDK:
   ```bash
   cd services/api
   pnpm add cloudinary
   ```
4. Complete implementation in `storage.service.ts`:
   - `uploadToCloudinary()` method
   - `deleteFromCloudinary()` method

**Environment Variables to Add:**
```env
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
STORAGE_PROVIDER=cloudinary
```

**Alternative:** AWS S3 (if you prefer AWS, but you mentioned avoiding AWS)

---

### 2. **Stripe** (Payment Processing) ⚠️ **HIGH PRIORITY**

**Status:** Code structure exists, but implementation is incomplete (commented out)

**What it does:**
- Process credit card payments
- Handle payment intents
- Process webhooks for payment events
- Refund processing

**Current Status:**
- ✅ Stripe package installed (`stripe: ^14.9.0`)
- ✅ Payment service structure exists (`services/api/src/payments/payments.service.ts`)
- ❌ Stripe initialization is commented out
- ❌ Payment intent creation is TODO
- ❌ Webhook verification is TODO
- ❌ Payment confirmation is TODO

**Required Setup:**
1. Create Stripe account: https://stripe.com
2. Get API keys:
   - `STRIPE_SECRET_KEY` (starts with `sk_test_` or `sk_live_`)
   - `STRIPE_PUBLISHABLE_KEY` (starts with `pk_test_` or `pk_live_`)
   - `STRIPE_WEBHOOK_SECRET` (for webhook verification)
3. Uncomment and complete implementation in `payments.service.ts`
4. Set up webhook endpoint in Stripe dashboard
5. Add webhook URL to Railway environment variables

**Environment Variables to Add:**
```env
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
```

**Frontend Integration:**
- Install Stripe.js in `apps/web`
- Add Stripe Elements to checkout page
- Use publishable key for frontend

---

### 3. **Email Service** (SMTP/Nodemailer) ⚠️ **MEDIUM PRIORITY**

**Status:** Service exists, needs SMTP configuration

**What it does:**
- Send order confirmations
- Send password reset emails
- Send email verification
- Send newsletter emails
- Send notification emails

**Current Status:**
- ✅ Nodemailer package installed
- ✅ Email service exists (`services/api/src/notifications/notifications.service.ts`)
- ❌ SMTP credentials not configured

**Options:**

**Option A: Gmail SMTP (Free, Easy)**
1. Enable 2-factor authentication on Gmail
2. Generate App Password: https://myaccount.google.com/apppasswords
3. Use Gmail SMTP settings

**Option B: SendGrid (Recommended for Production)**
1. Create SendGrid account: https://sendgrid.com
2. Get API key
3. Update email service to use SendGrid API

**Option C: Railway Email (If Available)**
- Check if Railway offers email service
- Use Railway's SMTP settings

**Environment Variables to Add:**
```env
# Gmail Option
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@hos-marketplace.com

# OR SendGrid Option
SENDGRID_API_KEY=your-sendgrid-api-key
SMTP_FROM=noreply@hos-marketplace.com
```

---

## 🎯 Priority 2: Important Features

### 4. **OAuth Providers** (Social Login) ⚠️ **MEDIUM PRIORITY**

**Status:** Code structure complete, needs API credentials

**What it does:**
- Google Sign-In
- Facebook Login
- Apple Sign-In

**Current Status:**
- ✅ OAuth strategies implemented
- ✅ OAuth guards created
- ✅ OAuth controllers ready
- ✅ Conditional loading (won't crash if not configured)
- ❌ OAuth credentials not configured

**Required Setup:**

#### Google OAuth:
1. Go to Google Cloud Console: https://console.cloud.google.com
2. Create OAuth 2.0 credentials
3. Add authorized redirect URI: `https://your-api-url.railway.app/api/auth/google/callback`
4. Get credentials:
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`

#### Facebook OAuth:
1. Go to Facebook Developers: https://developers.facebook.com
2. Create app
3. Add Facebook Login product
4. Add redirect URI: `https://your-api-url.railway.app/api/auth/facebook/callback`
5. Get credentials:
   - `FACEBOOK_APP_ID`
   - `FACEBOOK_APP_SECRET`

#### Apple OAuth:
1. Go to Apple Developer: https://developer.apple.com
2. Create App ID and Service ID
3. Create private key
4. Get credentials:
   - `APPLE_CLIENT_ID`
   - `APPLE_TEAM_ID`
   - `APPLE_KEY_ID`
   - `APPLE_PRIVATE_KEY_PATH` (or store key as env var)

**Environment Variables to Add:**
```env
# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Facebook OAuth
FACEBOOK_APP_ID=your-facebook-app-id
FACEBOOK_APP_SECRET=your-facebook-app-secret

# Apple OAuth
APPLE_CLIENT_ID=your-apple-client-id
APPLE_TEAM_ID=your-apple-team-id
APPLE_KEY_ID=your-apple-key-id
APPLE_PRIVATE_KEY_PATH=/path/to/key.p8
# OR store key content in env var
APPLE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...
```

**Note:** OAuth is optional - app works without it, but users can't use social login.

---

### 5. **Elasticsearch** (Search Engine) ⚠️ **MEDIUM PRIORITY**

**Status:** Code complete, needs Elasticsearch instance

**What it does:**
- Product search
- Full-text search
- Search filters
- Search analytics

**Current Status:**
- ✅ Elasticsearch service implemented
- ✅ Search indexing ready
- ✅ Conditional initialization (won't crash if not configured)
- ❌ Elasticsearch instance not set up

**Options:**

**Option A: Railway Elasticsearch (If Available)**
- Check Railway marketplace for Elasticsearch
- Add as service to Railway project

**Option B: Elastic Cloud (Recommended)**
1. Sign up: https://cloud.elastic.co
2. Create deployment
3. Get connection URL

**Option C: Self-Hosted (Advanced)**
- Deploy Elasticsearch on Railway or other provider
- More complex setup

**Environment Variables to Add:**
```env
ELASTICSEARCH_NODE=https://your-elasticsearch-url:9200
SYNC_PRODUCTS_ON_STARTUP=true  # Set to true to sync existing products
```

**Note:** Search works without Elasticsearch (falls back to database), but performance is better with it.

---

### 6. **Google Gemini AI** (AI Chat & Recommendations) ⚠️ **LOW PRIORITY**

**Status:** Service exists, needs API key

**What it does:**
- AI-powered character chat
- Product recommendations
- Personalized suggestions

**Current Status:**
- ✅ Gemini service implemented (`services/api/src/ai/gemini.service.ts`)
- ❌ API key not configured

**Required Setup:**
1. Go to Google AI Studio: https://makersuite.google.com/app/apikey
2. Create API key
3. Add to environment variables

**Environment Variables to Add:**
```env
GEMINI_API_KEY=your-gemini-api-key-here
```

**Note:** AI features are optional - app works without it, but AI chat won't function.

---

## 🎯 Priority 3: Optional Enhancements

### 7. **Klarna** (Buy Now, Pay Later) ⚠️ **OPTIONAL**

**Status:** Service structure exists

**What it does:**
- Buy now, pay later payment option
- Installment payments

**Current Status:**
- ✅ Klarna service exists (`services/api/src/payments/klarna/klarna.service.ts`)
- ❌ Klarna API credentials not configured
- ❌ Implementation may need completion

**Required Setup:**
1. Create Klarna account: https://www.klarna.com/business
2. Get API credentials
3. Complete implementation if needed

**Environment Variables to Add:**
```env
KLARNA_API_KEY=your-klarna-api-key
KLARNA_API_SECRET=your-klarna-api-secret
KLARNA_ENVIRONMENT=sandbox  # or production
```

---

### 8. **CDN** (Content Delivery Network) ⚠️ **OPTIONAL**

**Status:** Configuration ready

**What it does:**
- Faster image delivery
- Global content distribution
- Reduced server load

**Current Status:**
- ✅ CDN configuration exists in code
- ✅ Cloudflare setup guide exists (`infrastructure/cloudflare-setup.md`)
- ❌ CDN not configured

**Options:**

**Option A: Cloudflare (Recommended)**
- Follow guide: `infrastructure/cloudflare-setup.md`
- Free tier available
- Easy setup

**Option B: Railway CDN (If Available)**
- Check Railway features
- May be included in plan

**Environment Variables to Add:**
```env
CDN_URL=https://cdn.hos-marketplace.com
```

---

### 9. **Error Tracking** (Sentry, etc.) ⚠️ **OPTIONAL**

**Status:** Not implemented

**What it does:**
- Track application errors
- Monitor performance
- Get error notifications

**Recommended Services:**
- Sentry: https://sentry.io
- LogRocket: https://logrocket.com
- Bugsnag: https://www.bugsnag.com

**Setup:**
1. Create account
2. Install SDK
3. Add to frontend and backend
4. Configure error tracking

---

### 10. **Analytics** (Google Analytics, etc.) ⚠️ **OPTIONAL**

**Status:** Not implemented

**What it does:**
- Track user behavior
- Monitor conversions
- Analyze traffic

**Recommended Services:**
- Google Analytics 4
- Plausible Analytics
- Mixpanel

**Setup:**
1. Create account
2. Get tracking ID
3. Add to frontend
4. Configure events

---

## 📋 Integration Checklist

### Essential (Must Have for Production)
- [ ] **Cloudinary** - Image storage
- [ ] **Stripe** - Payment processing
- [ ] **Email Service** - SMTP/SendGrid

### Important (Recommended)
- [ ] **OAuth Providers** - Social login (Google, Facebook, Apple)
- [ ] **Elasticsearch** - Search engine
- [ ] **Google Gemini AI** - AI chat features

### Optional (Nice to Have)
- [ ] **Klarna** - Buy now, pay later
- [ ] **CDN** - Content delivery
- [ ] **Error Tracking** - Sentry/LogRocket
- [ ] **Analytics** - Google Analytics

---

## 🚀 Quick Start Guide

### Step 1: Essential Integrations (Do First)

1. **Cloudinary** (30 minutes)
   - Sign up → Get credentials → Add env vars → Complete code

2. **Stripe** (1 hour)
   - Sign up → Get API keys → Add env vars → Uncomment code → Test

3. **Email Service** (30 minutes)
   - Choose Gmail or SendGrid → Get credentials → Add env vars

### Step 2: Important Features (Do Next)

4. **OAuth** (2-3 hours)
   - Set up Google OAuth
   - Set up Facebook OAuth
   - (Optional) Set up Apple OAuth

5. **Elasticsearch** (1 hour)
   - Sign up for Elastic Cloud → Get URL → Add env var

6. **Gemini AI** (15 minutes)
   - Get API key → Add env var

### Step 3: Optional Enhancements (Do Later)

7. **Klarna** - If needed
8. **CDN** - For better performance
9. **Error Tracking** - For monitoring
10. **Analytics** - For insights

---

## 📝 Environment Variables Summary

Add these to Railway Dashboard → `@hos-marketplace/api` → Variables:

### Essential
```env
# Cloudinary
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
STORAGE_PROVIDER=cloudinary

# Stripe
STRIPE_SECRET_KEY=...
STRIPE_PUBLISHABLE_KEY=...
STRIPE_WEBHOOK_SECRET=...

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
SMTP_FROM=noreply@hos-marketplace.com
```

### Important
```env
# OAuth
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
FACEBOOK_APP_ID=...
FACEBOOK_APP_SECRET=...

# Elasticsearch
ELASTICSEARCH_NODE=...
SYNC_PRODUCTS_ON_STARTUP=true

# AI
GEMINI_API_KEY=...
```

### Optional
```env
# Klarna
KLARNA_API_KEY=...
KLARNA_API_SECRET=...

# CDN
CDN_URL=...
```

---

## 🔗 Useful Links

- **Cloudinary**: https://cloudinary.com
- **Stripe**: https://stripe.com
- **SendGrid**: https://sendgrid.com
- **Google Cloud Console**: https://console.cloud.google.com
- **Facebook Developers**: https://developers.facebook.com
- **Apple Developer**: https://developer.apple.com
- **Elastic Cloud**: https://cloud.elastic.co
- **Google AI Studio**: https://makersuite.google.com
- **Klarna Business**: https://www.klarna.com/business
- **Cloudflare**: https://www.cloudflare.com
- **Sentry**: https://sentry.io

---

## 📞 Support

If you need help setting up any integration:
1. Check the service's official documentation
2. Review the code comments in the relevant service files
3. Test in development/staging first
4. Monitor Railway logs for errors

---

**Last Updated:** December 3, 2025  
**Status:** Application deployed, integrations pending

