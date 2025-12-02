#!/bin/bash

# Railway Environment Variables Setup Helper
# This script generates JWT secrets and provides a checklist for Railway setup

echo "🚂 Railway Environment Variables Setup Helper"
echo "=============================================="
echo ""

# Generate JWT secrets
echo "📝 Generating JWT Secrets..."
echo ""
JWT_SECRET=$(openssl rand -base64 32)
JWT_REFRESH_SECRET=$(openssl rand -base64 32)

echo "✅ JWT Secrets Generated:"
echo ""
echo "JWT_SECRET=$JWT_SECRET"
echo "JWT_EXPIRES_IN=7d"
echo "JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET"
echo "JWT_REFRESH_EXPIRES_IN=30d"
echo ""

# Create environment variables file
cat > railway-env-variables.txt << EOF
# ============================================
# Railway Environment Variables
# Copy these to Railway Dashboard
# ============================================

# Backend API Service (@hos-marketplace/api)
# ============================================

# Database (Get from PostgreSQL service → Variables tab)
DATABASE_URL=[COPY FROM POSTGRESQL SERVICE]

# Redis (Get from Redis service → Variables tab)
REDIS_URL=[COPY FROM REDIS SERVICE]

# Server Configuration
PORT=3001
NODE_ENV=production
FRONTEND_URL=https://placeholder.railway.app

# JWT Authentication
JWT_SECRET=$JWT_SECRET
JWT_EXPIRES_IN=7d
JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET
JWT_REFRESH_EXPIRES_IN=30d

# Rate Limiting
RATE_LIMIT_TTL=60000
RATE_LIMIT_MAX=100

# File Upload
UPLOAD_MAX_SIZE=10485760
UPLOAD_ALLOWED_TYPES=image/jpeg,image/png,image/gif,image/webp

# Email (Gmail - Optional, add later)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=[Gmail App Password]
SMTP_FROM=noreply@hos-marketplace.com

# ============================================
# Frontend Web Service (@hos-marketplace/web)
# ============================================

NEXT_PUBLIC_API_URL=https://your-backend-url.railway.app/api
NODE_ENV=production
PORT=3000

# ============================================
# Optional Services (Add Later)
# ============================================

# Stripe (Add after Stripe setup)
# STRIPE_SECRET_KEY=sk_test_...
# STRIPE_PUBLISHABLE_KEY=pk_test_...
# STRIPE_WEBHOOK_SECRET=whsec_...

# Cloudinary (Add after Cloudinary setup)
# CLOUDINARY_CLOUD_NAME=...
# CLOUDINARY_API_KEY=...
# CLOUDINARY_API_SECRET=...

# Gemini AI (Add after Google AI setup)
# GEMINI_API_KEY=...
EOF

echo "📄 Created railway-env-variables.txt with all variables"
echo ""
echo "📋 Next Steps:"
echo "1. Open railway-env-variables.txt"
echo "2. Copy DATABASE_URL from PostgreSQL service → Variables tab"
echo "3. Copy REDIS_URL from Redis service → Variables tab"
echo "4. Go to Railway dashboard → @hos-marketplace/api → Variables tab"
echo "5. Add each variable one by one"
echo "6. Update FRONTEND_URL after frontend deploys"
echo "7. Update NEXT_PUBLIC_API_URL in frontend after backend deploys"
echo ""

