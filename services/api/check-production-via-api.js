// This script checks production users via the API
// You need to be logged in and have an admin token

const https = require('https');
const http = require('http');

const PRODUCTION_URL = 'https://hos-marketplaceapi-production.up.railway.app';
// Or use: const PRODUCTION_URL = 'http://localhost:3001'; for local testing

function fetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const protocol = urlObj.protocol === 'https:' ? https : http;
    
    const req = protocol.request(url, {
      method: options.method || 'GET',
      headers: options.headers || {},
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({
            ok: res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode,
            statusText: res.statusMessage,
            json: () => Promise.resolve(json),
            text: () => Promise.resolve(data),
          });
        } catch (e) {
          resolve({
            ok: res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode,
            statusText: res.statusMessage,
            json: () => Promise.reject(e),
            text: () => Promise.resolve(data),
          });
        }
      });
    });
    
    req.on('error', reject);
    
    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    
    req.end();
  });
}

async function checkProductionViaAPI(adminToken) {
  console.log('\n🔍 PRODUCTION DATABASE INVESTIGATION VIA API');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (!adminToken || adminToken === 'YOUR_ADMIN_TOKEN_HERE') {
    console.log('❌ Admin token required!');
    console.log('\n📋 How to get your token:');
    console.log('   1. Open https://hos-marketplaceweb-production.up.railway.app');
    console.log('   2. Log in with mail@jsabu.com');
    console.log('   3. Open browser DevTools (F12 or Cmd+Option+I)');
    console.log('   4. Go to Application/Storage → Local Storage');
    console.log('   5. Look for keys like: token, accessToken, authToken');
    console.log('   6. Copy the token value');
    console.log('   7. Run: node check-production-via-api.js YOUR_TOKEN\n');
    return;
  }

  try {
    // 1. Check health
    console.log('1️⃣  Checking API health...');
    const health = await fetch(`${PRODUCTION_URL}/api/health`);
    const healthData = await health.json();
    console.log(`   Status: ${healthData.status}`);
    console.log(`   Database: ${healthData.checks?.database?.status || 'unknown'}`);
    console.log(`   Redis: ${healthData.checks?.redis?.status || 'unknown'}\n`);

    // 2. Get all users (admin endpoint)
    console.log('2️⃣  Fetching all users...');
    const usersResponse = await fetch(`${PRODUCTION_URL}/api/admin/users`, {
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!usersResponse.ok) {
      const error = await usersResponse.text();
      console.log(`   ❌ Error: ${usersResponse.status} ${usersResponse.statusText}`);
      console.log(`   ${error}\n`);
      console.log('   ⚠️  Make sure you are logged in as ADMIN and have a valid token\n');
      return;
    }

    const usersData = await usersResponse.json();
    const users = usersData.data || [];

    console.log(`   ✅ Found ${users.length} user(s)\n`);

    // 3. Check for mail@jsabu.com
    console.log('3️⃣  Checking for mail@jsabu.com...');
    const jsabuUser = users.find(u => u.email === 'mail@jsabu.com');
    if (jsabuUser) {
      console.log('   ✅ FOUND:');
      console.log(`      Email: ${jsabuUser.email}`);
      console.log(`      Role: ${jsabuUser.role}`);
      console.log(`      Name: ${jsabuUser.firstName || ''} ${jsabuUser.lastName || ''}`);
      console.log(`      ID: ${jsabuUser.id}`);
    } else {
      console.log('   ❌ NOT FOUND');
    }
    console.log('');

    // 4. Group by role
    console.log('4️⃣  Users by Role:');
    const byRole = users.reduce((acc, user) => {
      acc[user.role] = (acc[user.role] || 0) + 1;
      return acc;
    }, {});

    Object.entries(byRole)
      .sort((a, b) => b[1] - a[1])
      .forEach(([role, count]) => {
        console.log(`   ${role}: ${count}`);
      });
    console.log('');

    // 5. Recent users
    console.log('5️⃣  Recent Users (Last 10):');
    users
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 10)
      .forEach((user, index) => {
        console.log(`   ${index + 1}. ${user.email} (${user.role})`);
      });
    if (users.length > 10) {
      console.log(`   ... and ${users.length - 10} more`);
    }
    console.log('');

    // 6. Admin users
    console.log('6️⃣  Admin Users:');
    const adminUsers = users.filter(u => u.role === 'ADMIN');
    adminUsers.forEach(admin => {
      console.log(`   - ${admin.email}`);
    });
    console.log('');

    // 7. Check for duplicates (by email)
    console.log('7️⃣  Checking for duplicate emails...');
    const emailMap = {};
    users.forEach(user => {
      const email = user.email.toLowerCase();
      if (!emailMap[email]) {
        emailMap[email] = [];
      }
      emailMap[email].push(user);
    });

    const duplicates = Object.entries(emailMap).filter(([_, users]) => users.length > 1);
    if (duplicates.length > 0) {
      console.log(`   ❌ Found ${duplicates.length} duplicate email(s):`);
      duplicates.forEach(([email, userList]) => {
        console.log(`      - ${email}: ${userList.length} entries`);
        userList.forEach(u => {
          console.log(`        * ${u.email} (ID: ${u.id}, Role: ${u.role})`);
        });
      });
    } else {
      console.log('   ✅ No duplicate emails found');
    }
    console.log('');

    // Summary
    console.log('📊 SUMMARY:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   Total Users: ${users.length}`);
    console.log(`   Admin Users: ${adminUsers.length}`);
    console.log(`   Duplicate Emails: ${duplicates.length}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }
}

// Get token from command line argument
const token = process.argv[2];
checkProductionViaAPI(token);
