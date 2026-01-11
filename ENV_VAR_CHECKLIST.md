# Environment Variables Checklist for Railway

## Backend API Service (@hos-marketplace/api)

### ✅ Required Variables (Must Have)

#### Database & Cache
- [ ] `DATABASE_URL` - PostgreSQL connection string
  - **Source**: PostgreSQL service → Variables tab
  - **Format**: `postgresql://postgres:password@host:port/database`
  - **Status**: ⚠️ Needs verification in Railway dashboard
  - **Action**: Check Railway → @hos-marketplace/api → Variables

- [ ] `REDIS_URL` - Redis connection string
  - **Source**: Redis service → Variables tab
  - **Format**: `redis://default:password@host:port`
  - **Status**: ⚠️ Need to verify (optional if not using Redis)

#### Server Configuration
- [ ] `PORT` - Server port
  - **Value**: `3001`
  - **Status**: ⚠️ Need to verify

- [ ] `NODE_ENV` - Environment
  - **Value**: `production`
  - **Status**: ⚠️ Need to verify

- [ ] `FRONTEND_URL` - Frontend URL for CORS
  - **Value**: `https://your-frontend-url.railway.app`
  - **Status**: ⚠️ Need to verify/update

#### JWT Authentication
- [ ] `JWT_SECRET` - JWT signing secret
  - **Generate**: `openssl rand -base64 32`
  - **Status**: ⚠️ **CRITICAL** - Must be set for production
  - **Minimum Length**: 32 characters
  - **Action**: Generate and add to Railway dashboard

- [ ] `JWT_EXPIRES_IN` - Access token expiration
  - **Value**: `7d` (default)
  - **Status**: ⚠️ Optional (has default)

- [ ] `JWT_REFRESH_SECRET` - Refresh token secret
  - **Generate**: `openssl rand -base64 32` (different from JWT_SECRET)
  - **Status**: ⚠️ **CRITICAL** - Must be set for production
  - **Minimum Length**: 32 characters
  - **Action**: Generate and add to Railway dashboard

- [ ] `JWT_REFRESH_EXPIRES_IN` - Refresh token expiration
  - **Value**: `30d` (default)
  - **Status**: ⚠️ Optional (has default)

#### Rate Limiting
- [ ] `RATE_LIMIT_TTL` - Rate limit time window
  - **Value**: `60000` (60 seconds)
  - **Status**: ⚠️ Optional (has defaults)

- [ ] `RATE_LIMIT_MAX` - Max requests per window
  - **Value**: `100`
  - **Status**: ⚠️ Optional (has defaults)

### 📋 Optional Variables (Add When Needed)

#### OAuth (Social Login)
- [ ] `GOOGLE_CLIENT_ID` - Google OAuth client ID
- [ ] `GOOGLE_CLIENT_SECRET` - Google OAuth secret
- [ ] `GOOGLE_CALLBACK_URL` - Google callback URL
- [ ] `FACEBOOK_APP_ID` - Facebook app ID
- [ ] `FACEBOOK_APP_SECRET` - Facebook app secret
- [ ] `FACEBOOK_CALLBACK_URL` - Facebook callback URL
- [ ] `APPLE_CLIENT_ID` - Apple client ID
- [ ] `APPLE_TEAM_ID` - Apple team ID
- [ ] `APPLE_KEY_ID` - Apple key ID
- [ ] `APPLE_PRIVATE_KEY_PATH` - Apple private key path

#### Email (SMTP)
- [ ] `SMTP_HOST` - SMTP server host
- [ ] `SMTP_PORT` - SMTP port (usually 587)
- [ ] `SMTP_USER` - SMTP username
- [ ] `SMTP_PASS` - SMTP password
- [ ] `SMTP_FROM` - From email address

#### File Storage
- [ ] `STORAGE_PROVIDER` - Storage provider (local/s3/minio/cloudinary)
- [ ] `AWS_ACCESS_KEY_ID` - AWS access key (if using S3)
- [ ] `AWS_SECRET_ACCESS_KEY` - AWS secret key
- [ ] `AWS_REGION` - AWS region
- [ ] `AWS_S3_BUCKET` - S3 bucket name
- [ ] `CLOUDINARY_CLOUD_NAME` - Cloudinary cloud name
- [ ] `CLOUDINARY_API_KEY` - Cloudinary API key
- [ ] `CLOUDINARY_API_SECRET` - Cloudinary API secret

#### Search (Elasticsearch)
- [ ] `ELASTICSEARCH_NODE` - Elasticsearch node URL
- [ ] `ELASTICSEARCH_USERNAME` - Elasticsearch username
- [ ] `ELASTICSEARCH_PASSWORD` - Elasticsearch password
- [ ] `SYNC_PRODUCTS_ON_STARTUP` - Sync products on startup (true/false)

#### Payment Processing
- [ ] `STRIPE_SECRET_KEY` - Stripe secret key
- [ ] `STRIPE_PUBLISHABLE_KEY` - Stripe publishable key
- [ ] `STRIPE_WEBHOOK_SECRET` - Stripe webhook secret

#### Other
- [ ] `GEMINI_API_KEY` - Google Gemini API key
- [ ] `CDN_URL` - CDN URL for static assets

---

## How to Check Variables in Railway

1. Go to Railway Dashboard
2. Click on `@hos-marketplace/api` service
3. Go to **"Variables"** tab
4. Review all variables listed above
5. Add any missing required variables
6. Update any incorrect values

---

## Generate JWT Secrets

If JWT secrets are missing, generate them:

```bash
# Generate JWT_SECRET
openssl rand -base64 32

# Generate JWT_REFRESH_SECRET (run again for different value)
openssl rand -base64 32
```

Copy the output and add to Railway variables.

---

## Quick Verification

Run this to check if variables are set (requires Railway CLI):

```bash
railway variables --service @hos-marketplace/api
```
