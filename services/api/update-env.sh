#!/bin/bash

# Script to update .env file with required environment variables

cat > .env << 'EOF'
# Database Connection
DATABASE_URL=postgresql://postgres:pYPWIdwzfQxyQQuobcwivtlfgFPgoekM@postgres.railway.internal:5432/railway

# JWT Secrets (generate secure random strings, minimum 32 characters)
JWT_SECRET=EDLd7c1od2DTOXo8LQDxzNa0OM+drNeozaPMlggG2kQ=
JWT_REFRESH_SECRET=9KFJvUbcTrgjW8Ui6gOa0De/GE/XF4wfksEcCgBp2fo=
EOF

echo "✅ .env file updated successfully"
echo ""
echo "Verifying environment variables..."
node -e "require('dotenv').config(); const required = ['DATABASE_URL', 'JWT_SECRET', 'JWT_REFRESH_SECRET']; const missing = required.filter(key => !process.env[key] || process.env[key].includes('your-') || process.env[key].includes('change-in-production')); if (missing.length === 0) { console.log('✅ All required environment variables are set and valid'); } else { console.log('❌ Missing or invalid variables:', missing.join(', ')); process.exit(1); }"
