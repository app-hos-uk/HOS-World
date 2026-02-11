#!/usr/bin/env ts-node
/**
 * Script to verify required environment variables are set
 * Usage: pnpm verify:env
 * 
 * Note: This checks the local .env file. For production verification,
 * check Railway dashboard or set RAILWAY=true to check process.env directly.
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

// Check if we should use process.env (for Railway/production) or .env file
const useProcessEnv = process.env.RAILWAY === 'true' || process.env.CHECK_PROCESS_ENV === 'true';

if (!useProcessEnv) {
  // Load .env file for local development
  dotenv.config({ path: path.join(__dirname, '../.env') });
  console.log('ℹ️  Checking local .env file. Set RAILWAY=true to check process.env (for production)\n');
} else {
  console.log('ℹ️  Checking process.env (production/Railway mode)\n');
}

interface EnvVarCheck {
  name: string;
  required: boolean;
  value?: string;
  valid: boolean;
  message: string;
}

const checks: EnvVarCheck[] = [];

function checkEnvVar(name: string, required: boolean, validator?: (value: string) => boolean): EnvVarCheck {
  const value = process.env[name];
  const exists = value !== undefined && value !== '';
  let valid = exists;
  let message = '';

  if (!exists) {
    valid = !required;
    message = required ? '❌ Missing (required)' : '⚠️  Missing (optional)';
  } else if (validator) {
    valid = validator(value);
    message = valid ? '✅ Valid' : '❌ Invalid';
  } else {
    message = '✅ Set';
  }

  return {
    name,
    required,
    value: exists ? (name.includes('SECRET') || name.includes('PASSWORD') ? '***' : value) : undefined,
    valid,
    message,
  };
}

// Critical environment variables
checks.push(checkEnvVar('DATABASE_URL', true, (v) => v.startsWith('postgresql://') || v.startsWith('postgres://')));
checks.push(checkEnvVar('JWT_SECRET', true, (v) => v.length >= 32));
checks.push(checkEnvVar('JWT_REFRESH_SECRET', true, (v) => v.length >= 32));
checks.push(checkEnvVar('NODE_ENV', false, (v) => ['development', 'production', 'test'].includes(v)));

// Check JWT secrets are different
const jwtSecret = process.env.JWT_SECRET;
const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET;
if (jwtSecret && jwtRefreshSecret) {
  const jwtCheck: EnvVarCheck = {
    name: 'JWT_SECRET != JWT_REFRESH_SECRET',
    required: true,
    valid: jwtSecret !== jwtRefreshSecret,
    message: jwtSecret !== jwtRefreshSecret ? '✅ Different' : '❌ Same value (security risk!)',
  };
  checks.push(jwtCheck);
}

// Recommended environment variables
checks.push(checkEnvVar('REDIS_URL', false, (v) => v.startsWith('redis://') || v.startsWith('rediss://')));
checks.push(checkEnvVar('PORT', false, (v) => !isNaN(Number(v))));
checks.push(checkEnvVar('FRONTEND_URL', false));
checks.push(checkEnvVar('SMTP_HOST', false));
checks.push(checkEnvVar('SMTP_PORT', false, (v) => !isNaN(Number(v))));
checks.push(checkEnvVar('SMTP_USER', false));
checks.push(checkEnvVar('SMTP_PASSWORD', false));

// OAuth (optional)
checks.push(checkEnvVar('GOOGLE_CLIENT_ID', false));
checks.push(checkEnvVar('GOOGLE_CLIENT_SECRET', false));
checks.push(checkEnvVar('FACEBOOK_APP_ID', false));
checks.push(checkEnvVar('FACEBOOK_APP_SECRET', false));
checks.push(checkEnvVar('APPLE_CLIENT_ID', false));
checks.push(checkEnvVar('APPLE_TEAM_ID', false));
checks.push(checkEnvVar('APPLE_KEY_ID', false));
checks.push(checkEnvVar('APPLE_PRIVATE_KEY', false));

// Payment providers (optional)
checks.push(checkEnvVar('STRIPE_SECRET_KEY', false));
checks.push(checkEnvVar('STRIPE_PUBLISHABLE_KEY', false));
checks.push(checkEnvVar('KLARNA_USERNAME', false));
checks.push(checkEnvVar('KLARNA_PASSWORD', false));

// Storage (optional)
checks.push(checkEnvVar('AWS_ACCESS_KEY_ID', false));
checks.push(checkEnvVar('AWS_SECRET_ACCESS_KEY', false));
checks.push(checkEnvVar('AWS_REGION', false));
checks.push(checkEnvVar('AWS_S3_BUCKET', false));
checks.push(checkEnvVar('CLOUDINARY_CLOUD_NAME', false));
checks.push(checkEnvVar('CLOUDINARY_API_KEY', false));
checks.push(checkEnvVar('CLOUDINARY_API_SECRET', false));

function printReport() {
  console.log('🔍 Environment Variables Verification\n');
  console.log('═'.repeat(60));

  const required = checks.filter((c) => c.required);
  const optional = checks.filter((c) => !c.required);
  const invalid = checks.filter((c) => !c.valid);

  console.log('\n📋 Required Variables:');
  required.forEach((check) => {
    console.log(`   ${check.name.padEnd(30)} ${check.message}`);
    if (check.value) {
      console.log(`   ${' '.repeat(30)} Value: ${check.value}`);
    }
  });

  console.log('\n📋 Optional Variables:');
  const setOptional = optional.filter((c) => c.value);
  const unsetOptional = optional.filter((c) => !c.value);

  if (setOptional.length > 0) {
    setOptional.forEach((check) => {
      console.log(`   ${check.name.padEnd(30)} ${check.message}`);
      if (check.value && !check.name.includes('SECRET') && !check.name.includes('PASSWORD')) {
        console.log(`   ${' '.repeat(30)} Value: ${check.value}`);
      }
    });
  }

  if (unsetOptional.length > 0) {
    console.log(`   ${unsetOptional.length} optional variables not set (this is OK)`);
  }

  console.log('\n' + '═'.repeat(60));
  console.log('\n📊 Summary:');
  console.log(`   Total checked: ${checks.length}`);
  console.log(`   Required: ${required.length}`);
  console.log(`   Optional: ${optional.length}`);
  console.log(`   Valid: ${checks.filter((c) => c.valid).length}`);
  console.log(`   Invalid: ${invalid.length}`);

  if (invalid.length > 0) {
    console.log('\n❌ Issues found:');
    invalid.forEach((check) => {
      console.log(`   - ${check.name}: ${check.message}`);
    });
    return false;
  }

  console.log('\n✅ All environment variables are valid!');
  return true;
}

const success = printReport();
process.exit(success ? 0 : 1);
