# 🔧 Environment Variables Setup

## ✅ Created `.env` File

I've created a `.env` file in `services/api/` with default values. **You need to update the required variables:**

## Required Variables (Must Change!)

### 1. DATABASE_URL
Update with your PostgreSQL connection string:
```env
DATABASE_URL=postgresql://username:password@localhost:5432/hos_marketplace
```

### 2. JWT_SECRET
Generate a secure random string (minimum 32 characters):
```bash
# Generate a secure JWT secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Then update:
```env
JWT_SECRET=<generated-secret-here>
```

### 3. JWT_REFRESH_SECRET
Generate another secure random string:
```bash
# Generate a secure refresh secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Then update:
```env
JWT_REFRESH_SECRET=<generated-secret-here>
```

## Quick Setup Commands

Run these in your terminal to generate secure secrets:

```bash
# Generate JWT_SECRET
echo "JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")"

# Generate JWT_REFRESH_SECRET
echo "JWT_REFRESH_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")"
```

Copy the output and update your `.env` file.

## Optional Variables

The following are optional and the app will work without them (with reduced functionality):
- `REDIS_URL` - Caching (uses in-memory fallback)
- `ELASTICSEARCH_NODE` - Search (uses database fallback)
- `SMTP_*` - Email notifications
- `STRIPE_*` - Payment processing
- `CLOUDINARY_*` - Image uploads

## After Updating `.env`

Restart the application:
```bash
cd "/Users/apple/Desktop/HOS-latest Sabu/services/api"
pnpm dev
```

The application should now start successfully! 🚀
