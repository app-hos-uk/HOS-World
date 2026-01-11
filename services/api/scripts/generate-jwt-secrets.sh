#!/bin/bash

# Generate JWT Secrets for Production
# This script generates secure JWT secrets for Railway deployment

echo "🔐 Generating JWT Secrets for Production"
echo "========================================"
echo ""

# Check if openssl is available
if ! command -v openssl &> /dev/null; then
    echo "❌ Error: openssl is not installed"
    echo "Please install openssl to generate secrets"
    exit 1
fi

echo "Generating JWT_SECRET..."
JWT_SECRET=$(openssl rand -base64 32)
echo "JWT_SECRET=$JWT_SECRET"
echo ""

echo "Generating JWT_REFRESH_SECRET..."
JWT_REFRESH_SECRET=$(openssl rand -base64 32)
echo "JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET"
echo ""

echo "========================================"
echo "✅ Secrets Generated Successfully"
echo "========================================"
echo ""
echo "📋 Next Steps:"
echo "1. Copy the JWT_SECRET value above"
echo "2. Add it to Railway dashboard → @hos-marketplace/api → Variables"
echo "3. Copy the JWT_REFRESH_SECRET value above"
echo "4. Add it to Railway dashboard → @hos-marketplace/api → Variables"
echo ""
echo "⚠️  Important:"
echo "- Keep these secrets secure"
echo "- Never commit them to version control"
echo "- Use different values for JWT_SECRET and JWT_REFRESH_SECRET"
echo "- Minimum length: 32 characters (these are 44 characters)"
echo ""
