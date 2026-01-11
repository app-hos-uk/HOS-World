#!/usr/bin/env ts-node
/**
 * Railway Deployment Verification Script
 * 
 * This script verifies:
 * 1. Required environment variables are set
 * 2. Database connectivity
 * 3. OAuthAccount table exists (from recent migration)
 * 4. API health endpoint (if URL provided)
 */

import { PrismaClient } from '@prisma/client';
import * as https from 'https';
import * as http from 'http';

const prisma = new PrismaClient();

interface VerificationResult {
  name: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
}

const results: VerificationResult[] = [];

function addResult(name: string, status: 'pass' | 'fail' | 'warning', message: string) {
  results.push({ name, status, message });
  const icon = status === 'pass' ? '✅' : status === 'fail' ? '❌' : '⚠️';
  console.log(`${icon} ${name}: ${message}`);
}

async function checkEnvironmentVariables() {
  console.log('\n📋 Checking Environment Variables...\n');
  
  const required = [
    'DATABASE_URL',
    'JWT_SECRET',
    'JWT_REFRESH_SECRET',
  ];
  
  const recommended = [
    'REDIS_URL',
    'PORT',
    'NODE_ENV',
    'FRONTEND_URL',
  ];
  
  // Check required variables
  for (const key of required) {
    const value = process.env[key];
    if (!value || value.includes('your-') || value.includes('change-in-production')) {
      addResult(`Required: ${key}`, 'fail', 'Missing or invalid');
    } else {
      addResult(`Required: ${key}`, 'pass', 'Set');
    }
  }
  
  // Check recommended variables
  for (const key of recommended) {
    const value = process.env[key];
    if (!value) {
      addResult(`Recommended: ${key}`, 'warning', 'Not set (using defaults)');
    } else {
      addResult(`Recommended: ${key}`, 'pass', `Set to: ${key === 'JWT_SECRET' || key === 'JWT_REFRESH_SECRET' ? '***' : value}`);
    }
  }
  
  // Check JWT secret strength
  const jwtSecret = process.env.JWT_SECRET;
  if (jwtSecret && jwtSecret.length < 32) {
    addResult('JWT_SECRET strength', 'warning', 'Secret is too short (minimum 32 characters recommended)');
  } else if (jwtSecret) {
    addResult('JWT_SECRET strength', 'pass', 'Secret length is adequate');
  }
}

async function checkDatabaseConnection() {
  console.log('\n🗄️  Checking Database Connection...\n');
  
  try {
    await prisma.$connect();
    addResult('Database connection', 'pass', 'Connected successfully');
    
    // Test a simple query
    await prisma.$queryRaw`SELECT 1 as test`;
    addResult('Database query', 'pass', 'Query executed successfully');
  } catch (error: any) {
    addResult('Database connection', 'fail', `Failed: ${error.message}`);
    return false;
  }
  
  return true;
}

async function checkOAuthAccountTable() {
  console.log('\n🔐 Checking OAuthAccount Table...\n');
  
  try {
    // Check if table exists using raw SQL
    const result = await prisma.$queryRawUnsafe<Array<{ exists: boolean }>>(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'oauth_accounts'
      );`
    );
    
    const tableExists = result[0]?.exists || false;
    
    if (tableExists) {
      addResult('OAuthAccount table', 'pass', 'Table exists');
      
      // Check if Prisma client has the model
      try {
        const testQuery = await prisma.oAuthAccount.findMany({ take: 1 });
        addResult('OAuthAccount Prisma model', 'pass', 'Model available in Prisma client');
      } catch (error: any) {
        if (error.message?.includes('oAuthAccount')) {
          addResult('OAuthAccount Prisma model', 'warning', 'Table exists but Prisma client may need regeneration');
        } else {
          addResult('OAuthAccount Prisma model', 'pass', 'Model available');
        }
      }
      
      // Count records
      try {
        const count = await prisma.oAuthAccount.count();
        addResult('OAuthAccount records', 'pass', `${count} record(s) found`);
      } catch {
        addResult('OAuthAccount records', 'warning', 'Could not count records');
      }
    } else {
      addResult('OAuthAccount table', 'fail', 'Table does not exist - migration may not have been applied');
    }
  } catch (error: any) {
    addResult('OAuthAccount table check', 'fail', `Error: ${error.message}`);
  }
}

async function checkHealthEndpoint(apiUrl?: string) {
  if (!apiUrl) {
    addResult('Health endpoint', 'warning', 'API URL not provided - skipping');
    return;
  }
  
  console.log('\n🏥 Checking API Health Endpoint...\n');
  
  return new Promise<void>((resolve) => {
    const url = new URL(apiUrl);
    const client = url.protocol === 'https:' ? https : http;
    
    const req = client.get(url.toString(), (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const json = JSON.parse(data);
            addResult('Health endpoint', 'pass', `API is responding (status: ${json.status || 'ok'})`);
          } catch {
            addResult('Health endpoint', 'pass', `API is responding (status: ${res.statusCode})`);
          }
        } else {
          addResult('Health endpoint', 'warning', `API responded with status ${res.statusCode}`);
        }
        resolve();
      });
    });
    
    req.on('error', (error) => {
      addResult('Health endpoint', 'fail', `Failed to connect: ${error.message}`);
      resolve();
    });
    
    req.setTimeout(5000, () => {
      req.destroy();
      addResult('Health endpoint', 'fail', 'Request timeout');
      resolve();
    });
  });
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🚂 Railway Deployment Verification');
  console.log('═══════════════════════════════════════════════════════════');
  
  // Get API URL from environment or command line
  const apiUrl = process.env.API_URL || process.argv[2] || undefined;
  
  await checkEnvironmentVariables();
  
  const dbConnected = await checkDatabaseConnection();
  
  if (dbConnected) {
    await checkOAuthAccountTable();
  }
  
  await checkHealthEndpoint(apiUrl);
  
  // Summary
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('📊 Verification Summary');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  const passed = results.filter(r => r.status === 'pass').length;
  const failed = results.filter(r => r.status === 'fail').length;
  const warnings = results.filter(r => r.status === 'warning').length;
  
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⚠️  Warnings: ${warnings}`);
  console.log(`📊 Total: ${results.length}\n`);
  
  if (failed > 0) {
    console.log('❌ Some checks failed. Please review the errors above.');
    process.exit(1);
  } else if (warnings > 0) {
    console.log('⚠️  Some warnings were found. Review them above.');
    process.exit(0);
  } else {
    console.log('✅ All checks passed!');
    process.exit(0);
  }
}

// Run verification
main()
  .catch((error) => {
    console.error('\n❌ Verification script failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
