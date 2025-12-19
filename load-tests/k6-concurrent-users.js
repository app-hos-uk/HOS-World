// k6 Concurrent Users Load Test
// Run with: k6 run load-tests/k6-concurrent-users.js
// Or with custom API URL: k6 run -e API_URL=https://your-api-url.com/api load-tests/k6-concurrent-users.js

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { htmlReport } from "https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js";

// Custom metrics
const errorRate = new Rate('errors');
const searchDuration = new Trend('search_duration');
const productDuration = new Trend('product_duration');
const cartDuration = new Trend('cart_duration');
const authDuration = new Trend('auth_duration');
const orderDuration = new Trend('order_duration');

// Configuration for concurrent users test
export const options = {
  stages: [
    // Warm-up: Gradually increase to 50 concurrent users
    { duration: '1m', target: 50 },
    { duration: '2m', target: 50 },
    
    // Normal Load: 100 concurrent users
    { duration: '3m', target: 100 },
    { duration: '5m', target: 100 },
    
    // Moderate Load: 250 concurrent users
    { duration: '3m', target: 250 },
    { duration: '5m', target: 250 },
    
    // High Load: 500 concurrent users
    { duration: '3m', target: 500 },
    { duration: '5m', target: 500 },
    
    // Peak Load: 1000 concurrent users
    { duration: '3m', target: 1000 },
    { duration: '5m', target: 1000 },
    
    // Stress Test: 2000 concurrent users
    { duration: '2m', target: 2000 },
    { duration: '3m', target: 2000 },
    
    // Spike Test: 5000 concurrent users (short duration)
    { duration: '1m', target: 5000 },
    
    // Cool-down: Gradually decrease
    { duration: '2m', target: 1000 },
    { duration: '2m', target: 500 },
    { duration: '1m', target: 0 },
  ],
  
  thresholds: {
    // Overall HTTP metrics
    http_req_duration: ['p(50)<200', 'p(95)<500', 'p(99)<1000'],
    http_req_failed: ['rate<0.01'], // Less than 1% errors
    http_reqs: ['rate>100'], // At least 100 requests per second
    
    // Custom metrics
    errors: ['rate<0.01'],
    search_duration: ['p(95)<200', 'p(99)<500'],
    product_duration: ['p(95)<300', 'p(99)<600'],
    cart_duration: ['p(95)<400', 'p(99)<800'],
    auth_duration: ['p(95)<100', 'p(99)<200'],
  },
  
  // Summary output
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)', 'p(99.9)', 'p(99.99)'],
};

const BASE_URL = __ENV.API_URL || 'http://localhost:3001/api';

// Test data
const testUsers = [
  { email: 'testuser1@example.com', password: 'testpassword123' },
  { email: 'testuser2@example.com', password: 'testpassword123' },
  { email: 'testuser3@example.com', password: 'testpassword123' },
];

const testSellers = [
  { email: 'seller1@example.com', password: 'sellerpassword123' },
  { email: 'seller2@example.com', password: 'sellerpassword123' },
];

// Helper function to get random item
function getRandomItem(array) {
  return array[Math.floor(Math.random() * array.length)];
}

// Helper function to generate random string
function randomString(length = 10) {
  const chars = 'abcdefghijklmnopqrstuvwxyz';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export default function () {
  const scenario = Math.random();
  let authToken = null;
  
  // 40% Anonymous browsing
  if (scenario < 0.4) {
    anonymousBrowsing();
  }
  // 35% Authenticated user journey
  else if (scenario < 0.75) {
    authToken = authenticate();
    if (authToken) {
      authenticatedJourney(authToken);
    }
  }
  // 15% Product search heavy
  else if (scenario < 0.9) {
    productSearchHeavy();
  }
  // 10% Seller operations
  else {
    authToken = authenticateSeller();
    if (authToken) {
      sellerOperations(authToken);
    }
  }
}

function anonymousBrowsing() {
  // Health check
  let res = http.get(`${BASE_URL}/health`);
  check(res, {
    'health check status is 200': (r) => r.status === 200,
  });
  
  sleep(1);
  
  // Browse products
  const page = Math.floor(Math.random() * 10) + 1;
  res = http.get(`${BASE_URL}/products?page=${page}&limit=20`);
  const productCheck = check(res, {
    'products status is 200': (r) => r.status === 200,
    'products response time < 300ms': (r) => r.timings.duration < 300,
  });
  if (productCheck) {
    productDuration.add(res.timings.duration);
  }
  
  sleep(2);
  
  // Search products
  const searchQuery = randomString(5);
  res = http.get(`${BASE_URL}/search?q=${searchQuery}&page=1&limit=20`);
  const searchCheck = check(res, {
    'search status is 200': (r) => r.status === 200,
    'search response time < 200ms': (r) => r.timings.duration < 200,
  });
  if (searchCheck) {
    searchDuration.add(res.timings.duration);
  }
  
  sleep(3);
}

function authenticate() {
  const user = getRandomItem(testUsers);
  const payload = JSON.stringify({
    email: user.email,
    password: user.password,
  });
  
  const params = {
    headers: { 'Content-Type': 'application/json' },
  };
  
  const res = http.post(`${BASE_URL}/auth/login`, payload, params);
  const authCheck = check(res, {
    'login status is 200': (r) => r.status === 200,
    'login response time < 100ms': (r) => r.timings.duration < 100,
    'login returns token': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.data && body.data.accessToken;
      } catch {
        return false;
      }
    },
  });
  
  if (authCheck) {
    authDuration.add(res.timings.duration);
    try {
      const body = JSON.parse(res.body);
      return body.data?.accessToken;
    } catch {
      return null;
    }
  } else {
    errorRate.add(1);
    return null;
  }
}

function authenticatedJourney(token) {
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
  
  // Browse products
  const page = Math.floor(Math.random() * 5) + 1;
  let res = http.get(`${BASE_URL}/products?page=${page}&limit=20`, { headers });
  check(res, {
    'authenticated products status is 200': (r) => r.status === 200,
  });
  
  sleep(2);
  
  // View cart
  res = http.get(`${BASE_URL}/cart`, { headers });
  const cartCheck = check(res, {
    'cart status is 200': (r) => r.status === 200,
    'cart response time < 400ms': (r) => r.timings.duration < 400,
  });
  if (cartCheck) {
    cartDuration.add(res.timings.duration);
  }
  
  sleep(1);
  
  // Add to cart (might fail if product doesn't exist, that's OK)
  const productId = randomString();
  const payload = JSON.stringify({
    productId: productId,
    quantity: Math.floor(Math.random() * 3) + 1,
  });
  res = http.post(`${BASE_URL}/cart/items`, payload, { headers });
  check(res, {
    'add to cart status is acceptable': (r) => [200, 201, 400, 404].includes(r.status),
  });
  
  sleep(2);
  
  // View orders
  res = http.get(`${BASE_URL}/orders`, { headers });
  check(res, {
    'orders status is 200': (r) => r.status === 200,
  });
}

function productSearchHeavy() {
  // Multiple searches
  for (let i = 0; i < 3; i++) {
    const searchQuery = randomString(5);
    const page = Math.floor(Math.random() * 5) + 1;
    const res = http.get(`${BASE_URL}/search?q=${searchQuery}&page=${page}&limit=20`);
    const searchCheck = check(res, {
      'search status is 200': (r) => r.status === 200,
      'search response time < 200ms': (r) => r.timings.duration < 200,
    });
    if (searchCheck) {
      searchDuration.add(res.timings.duration);
    }
    sleep(1);
  }
  
  // Search suggestions
  const suggestionQuery = randomString(3);
  const res = http.get(`${BASE_URL}/search/suggestions?q=${suggestionQuery}`);
  check(res, {
    'suggestions status is 200': (r) => r.status === 200,
  });
  
  sleep(2);
}

function authenticateSeller() {
  const seller = getRandomItem(testSellers);
  const payload = JSON.stringify({
    email: seller.email,
    password: seller.password,
  });
  
  const params = {
    headers: { 'Content-Type': 'application/json' },
  };
  
  const res = http.post(`${BASE_URL}/auth/login`, payload, params);
  const authCheck = check(res, {
    'seller login status is 200': (r) => r.status === 200,
  });
  
  if (authCheck) {
    try {
      const body = JSON.parse(res.body);
      return body.data?.accessToken;
    } catch {
      return null;
    }
  }
  return null;
}

function sellerOperations(token) {
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
  
  // View seller products
  let res = http.get(`${BASE_URL}/products/seller`, { headers });
  check(res, {
    'seller products status is 200': (r) => r.status === 200,
  });
  
  sleep(2);
  
  // View seller orders
  res = http.get(`${BASE_URL}/orders`, { headers });
  check(res, {
    'seller orders status is 200': (r) => r.status === 200,
  });
  
  sleep(1);
}

// Generate HTML report
export function handleSummary(data) {
  return {
    'summary.html': htmlReport(data),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}

function textSummary(data, options) {
  const indent = options.indent || '';
  const enableColors = options.enableColors || false;
  
  let summary = '\n';
  summary += `${indent}Load Test Summary\n`;
  summary += `${indent}==================\n\n`;
  
  // HTTP metrics
  if (data.metrics.http_req_duration) {
    const duration = data.metrics.http_req_duration;
    summary += `${indent}HTTP Request Duration:\n`;
    summary += `${indent}  Average: ${duration.values.avg.toFixed(2)}ms\n`;
    summary += `${indent}  p95: ${duration.values['p(95)'].toFixed(2)}ms\n`;
    summary += `${indent}  p99: ${duration.values['p(99)'].toFixed(2)}ms\n\n`;
  }
  
  if (data.metrics.http_req_failed) {
    const failed = data.metrics.http_req_failed;
    summary += `${indent}HTTP Request Failed: ${(failed.values.rate * 100).toFixed(2)}%\n\n`;
  }
  
  if (data.metrics.http_reqs) {
    const reqs = data.metrics.http_reqs;
    summary += `${indent}HTTP Requests: ${reqs.values.count} total, ${reqs.values.rate.toFixed(2)}/s\n\n`;
  }
  
  // Custom metrics
  if (data.metrics.search_duration) {
    const search = data.metrics.search_duration;
    summary += `${indent}Search Duration (p95): ${search.values['p(95)'].toFixed(2)}ms\n`;
  }
  
  if (data.metrics.product_duration) {
    const product = data.metrics.product_duration;
    summary += `${indent}Product Duration (p95): ${product.values['p(95)'].toFixed(2)}ms\n`;
  }
  
  if (data.metrics.cart_duration) {
    const cart = data.metrics.cart_duration;
    summary += `${indent}Cart Duration (p95): ${cart.values['p(95)'].toFixed(2)}ms\n`;
  }
  
  return summary;
}


