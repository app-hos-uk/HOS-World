/**
 * Comprehensive Test Script for Product Visibility and Category/Fandom Issues
 * Node.js version for better error handling and async operations
 */

const https = require('https');
const http = require('http');

const API_URL = process.env.API_URL || 'https://hos-marketplaceapi-production.up.railway.app/api';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@houseofspells.co.uk';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';

// Test results
const results = {
  passed: 0,
  failed: 0,
  skipped: 0,
  tests: []
};

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function printTest(name, status, message = '') {
  const statusIcon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⏭️';
  const statusColor = status === 'PASS' ? 'green' : status === 'FAIL' ? 'red' : 'yellow';
  
  log(`${statusIcon} ${status}: ${name}`, statusColor);
  if (message) {
    console.log(`   ${message}`);
  }
  
  results.tests.push({ name, status, message });
  if (status === 'PASS') results.passed++;
  else if (status === 'FAIL') results.failed++;
  else results.skipped++;
}

// HTTP request helper
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const client = isHttps ? https : http;
    
    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    };
    
    const req = client.request(requestOptions, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, data: json, raw: data });
        } catch (e) {
          resolve({ status: res.statusCode, data: data, raw: data });
        }
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    
    req.end();
  });
}

async function runTests() {
  log('\n🧪 Starting Comprehensive Product Visibility Tests', 'blue');
  log('==================================================', 'blue');
  log(`API URL: ${API_URL}\n`);
  
  let token = '';
  let productId = '';
  let productName = '';
  
  // Test 1: Admin Login
  log('📝 Step 1: Admin Login', 'blue');
  log('----------------------', 'blue');
  try {
    const loginResponse = await makeRequest(`${API_URL}/auth/login`, {
      method: 'POST',
      body: {
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
      },
    });
    
    if (loginResponse.status === 200 && loginResponse.data?.data?.token) {
      token = loginResponse.data.data.token;
      printTest('Admin Login', 'PASS', 'Successfully logged in');
    } else {
      printTest('Admin Login', 'FAIL', `Login failed: ${JSON.stringify(loginResponse.data)}`);
      log('\n⚠️  Cannot proceed without admin authentication. Please check ADMIN_EMAIL and ADMIN_PASSWORD.', 'yellow');
      return;
    }
  } catch (error) {
    printTest('Admin Login', 'FAIL', `Error: ${error.message}`);
    return;
  }
  
  // Test 2: Create Product with PUBLISHED Status
  log('\n📝 Step 2: Create Product with PUBLISHED Status', 'blue');
  log('-----------------------------------------------', 'blue');
  productName = `Test Product ${Date.now()}`;
  const productData = {
    name: productName,
    description: 'Test product for visibility verification',
    price: 29.99,
    currency: 'GBP',
    stock: 10,
    status: 'PUBLISHED',
    sku: `TEST-${Date.now()}`,
    fandom: 'Harry Potter',
    category: 'Collectibles',
  };
  
  try {
    const createResponse = await makeRequest(`${API_URL}/admin/products`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: productData,
    });
    
    if (createResponse.status === 201 || createResponse.status === 200) {
      productId = createResponse.data?.data?.id;
      const productStatus = createResponse.data?.data?.status;
      
      if (productId) {
        if (productStatus === 'ACTIVE') {
          printTest('Product Creation with PUBLISHED Status', 'PASS', 
            `Product created with ID: ${productId}, Status: ${productStatus} (correctly mapped from PUBLISHED)`);
        } else {
          printTest('Product Creation with PUBLISHED Status', 'FAIL', 
            `Product created but status is '${productStatus}' instead of 'ACTIVE'`);
        }
      } else {
        printTest('Product Creation', 'FAIL', `Failed to extract product ID. Response: ${JSON.stringify(createResponse.data)}`);
      }
    } else {
      printTest('Product Creation', 'FAIL', `HTTP ${createResponse.status}: ${JSON.stringify(createResponse.data)}`);
    }
  } catch (error) {
    printTest('Product Creation', 'FAIL', `Error: ${error.message}`);
  }
  
  // Test 3: Product Visibility to Customers
  log('\n📝 Step 3: Test Product Visibility to Customers', 'blue');
  log('------------------------------------------------', 'blue');
  try {
    const productsResponse = await makeRequest(`${API_URL}/products?page=1&limit=20`);
    
    if (productsResponse.status === 200) {
      const products = productsResponse.data?.data?.items || productsResponse.data?.data || [];
      const productFound = products.some(p => p.name === productName || p.id === productId);
      
      if (productFound) {
        printTest('Product Visibility to Customers', 'PASS', `Product '${productName}' is visible to customers`);
      } else {
        printTest('Product Visibility to Customers', 'FAIL', `Product '${productName}' is NOT visible to customers`);
      }
      
      const total = productsResponse.data?.data?.total || products.length;
      if (total > 0) {
        printTest('Active Products Count', 'PASS', `Found ${total} active product(s) visible to customers`);
      } else {
        printTest('Active Products Count', 'FAIL', 'No active products found. This indicates the issue exists.');
      }
    } else {
      printTest('Product Visibility Check', 'FAIL', `HTTP ${productsResponse.status}: ${JSON.stringify(productsResponse.data)}`);
    }
  } catch (error) {
    printTest('Product Visibility Check', 'FAIL', `Error: ${error.message}`);
  }
  
  // Test 4: Product Status Update
  log('\n📝 Step 4: Test Product Status Update', 'blue');
  log('-------------------------------------', 'blue');
  if (productId) {
    try {
      const updateResponse = await makeRequest(`${API_URL}/admin/products/${productId}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: {
          status: 'PUBLISHED',
        },
      });
      
      if (updateResponse.status === 200) {
        const updatedStatus = updateResponse.data?.data?.status;
        if (updatedStatus === 'ACTIVE') {
          printTest('Product Status Update', 'PASS', 'Status update from PUBLISHED correctly mapped to ACTIVE');
        } else {
          printTest('Product Status Update', 'FAIL', `Status update failed. Status is '${updatedStatus}' instead of 'ACTIVE'`);
        }
      } else {
        printTest('Product Status Update', 'FAIL', `HTTP ${updateResponse.status}: ${JSON.stringify(updateResponse.data)}`);
      }
    } catch (error) {
      printTest('Product Status Update', 'FAIL', `Error: ${error.message}`);
    }
  } else {
    printTest('Product Status Update', 'SKIP', 'Skipped - No product ID available');
  }
  
  // Test 5: Fandoms API
  log('\n📝 Step 5: Test Fandoms API (for Category/Fandom Issue)', 'blue');
  log('------------------------------------------------------', 'blue');
  try {
    const fandomsResponse = await makeRequest(`${API_URL}/fandoms`);
    
    if (fandomsResponse.status === 200 && fandomsResponse.data?.data) {
      const fandoms = Array.isArray(fandomsResponse.data.data) ? fandomsResponse.data.data : [];
      printTest('Fandoms API', 'PASS', `Fandoms API working. Found ${fandoms.length} fandom(s)`);
    } else {
      printTest('Fandoms API', 'FAIL', `Fandoms API returned error or empty response: ${JSON.stringify(fandomsResponse.data)}`);
    }
  } catch (error) {
    printTest('Fandoms API', 'FAIL', `Error: ${error.message}`);
  }
  
  // Test 6: Cleanup (Optional - Delete test product)
  if (productId) {
    log('\n📝 Step 6: Cleanup (Optional)', 'blue');
    log('----------------------------', 'blue');
    log('   Test product created with ID: ' + productId, 'yellow');
    log('   You may want to delete it manually via admin panel', 'yellow');
  }
  
  // Summary
  log('\n==================================================', 'blue');
  log('📊 Test Summary', 'blue');
  log('==================================================', 'blue');
  log(`Tests Passed: ${results.passed}`, 'green');
  log(`Tests Failed: ${results.failed}`, 'red');
  log(`Tests Skipped: ${results.skipped}`, 'yellow');
  log('');
  
  if (results.failed === 0) {
    log('✅ All tests passed!', 'green');
    process.exit(0);
  } else {
    log('❌ Some tests failed. Please review the output above.', 'red');
    process.exit(1);
  }
}

// Run tests
runTests().catch((error) => {
  log(`\n❌ Fatal error: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});

