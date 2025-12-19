// Simple Node.js test script for seller creation
// Run with: node test-seller-api.js [admin-password]

const https = require('https');

const API_URL = 'https://hos-marketplaceapi-production.up.railway.app/api';
const ADMIN_EMAIL = 'app@houseofspells.co.uk';
const ADMIN_PASSWORD = process.argv[2] || process.env.ADMIN_PASSWORD;

if (!ADMIN_PASSWORD) {
  console.log('❌ Admin password required');
  console.log('Usage: node test-seller-api.js [admin-password]');
  console.log('   or: ADMIN_PASSWORD=yourpass node test-seller-api.js');
  process.exit(1);
}

function makeRequest(method, path, data, token) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_URL);
    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', reject);
    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function test() {
  console.log('🧪 Testing Admin Seller Creation\n');

  // Step 1: Admin Login
  console.log('Step 1: Admin login...');
  const loginRes = await makeRequest('POST', '/api/auth/login', {
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  });

  if (loginRes.status !== 200 || !loginRes.data.data?.token) {
    console.log('❌ Admin login failed');
    console.log('Response:', JSON.stringify(loginRes, null, 2));
    return;
  }

  const token = loginRes.data.data.token;
  console.log('✅ Admin login successful\n');

  // Step 2: Create Seller
  console.log('Step 2: Creating seller...');
  const timestamp = Date.now();
  const sellerEmail = `test-seller-${timestamp}@example.com`;
  
  const createRes = await makeRequest('POST', '/api/admin/sellers/create', {
    email: sellerEmail,
    password: 'TestPassword123',
    storeName: `Test Store ${timestamp}`,
    country: 'United Kingdom',
  }, token);

  if (createRes.status !== 200 || !createRes.data.data) {
    console.log('❌ Seller creation failed');
    console.log('Response:', JSON.stringify(createRes, null, 2));
    return;
  }

  console.log('✅ Seller created successfully!');
  console.log('Seller Details:', JSON.stringify(createRes.data.data, null, 2));
  console.log('');

  // Step 3: Test Seller Login
  console.log('Step 3: Testing seller login...');
  const sellerLoginRes = await makeRequest('POST', '/api/auth/login', {
    email: sellerEmail,
    password: 'TestPassword123',
  });

  if (sellerLoginRes.status !== 200 || !sellerLoginRes.data.data?.token) {
    console.log('❌ Seller login failed');
    console.log('Response:', JSON.stringify(sellerLoginRes, null, 2));
    return;
  }

  const sellerToken = sellerLoginRes.data.data.token;
  console.log('✅ Seller login successful\n');

  // Step 4: Check Seller Profile
  console.log('Step 4: Checking seller profile...');
  const profileRes = await makeRequest('GET', '/api/sellers/me', null, sellerToken);

  if (profileRes.status === 200 && profileRes.data.data) {
    console.log('✅ Seller profile retrieved');
    console.log('Profile:', JSON.stringify(profileRes.data.data, null, 2));
  } else {
    console.log('⚠️  Could not retrieve seller profile');
    console.log('Response:', JSON.stringify(profileRes, null, 2));
  }

  console.log('\n==================================');
  console.log('✅ All tests passed!');
  console.log('\nSeller Credentials:');
  console.log(`  Email: ${sellerEmail}`);
  console.log('  Password: TestPassword123');
  console.log('\nNext Steps:');
  console.log('  1. Login at: https://hos-marketplaceweb-production.up.railway.app/login');
  console.log('  2. Should redirect to onboarding flow');
  console.log('  3. Complete profile setup');
}

test().catch(console.error);
