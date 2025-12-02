// k6 Load Testing Script for House of Spells Marketplace
// Run with: k6 run infrastructure/k6-load-test.js

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const searchDuration = new Trend('search_duration');
const productDuration = new Trend('product_duration');
const cartDuration = new Trend('cart_duration');

// Configuration
export const options = {
  stages: [
    // Warm up
    { duration: '1m', target: 50 },
    { duration: '2m', target: 50 },
    // Normal load
    { duration: '3m', target: 100 },
    { duration: '5m', target: 100 },
    // Peak load
    { duration: '3m', target: 200 },
    { duration: '5m', target: 200 },
    // Stress test
    { duration: '2m', target: 500 },
    { duration: '3m', target: 500 },
    // Cool down
    { duration: '2m', target: 100 },
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    http_req_failed: ['rate<0.01'],
    errors: ['rate<0.01'],
    search_duration: ['p(95)<200', 'p(99)<500'],
    product_duration: ['p(95)<300', 'p(99)<600'],
    cart_duration: ['p(95)<400', 'p(99)<800'],
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:3001/api';

// Test data
const searchQueries = [
  'wand',
  'potion',
  'robe',
  'book',
  'crystal',
  'tarot',
  'herbs',
  'candle',
  'altar',
  'pentagram',
];

const categories = [
  'books',
  'clothing',
  'accessories',
  'decor',
  'tools',
];

// Helper function to get random item from array
function getRandomItem(array) {
  return array[Math.floor(Math.random() * array.length)];
}

// Helper function to generate random email
function randomEmail() {
  return `test${Math.random().toString(36).substring(7)}@example.com`;
}

// Main test function
export default function () {
  // Scenario 1: Product Search (40% of traffic)
  if (Math.random() < 0.4) {
    const query = getRandomItem(searchQueries);
    const startTime = Date.now();
    
    const searchRes = http.get(
      `${BASE_URL}/search?q=${query}&page=1&limit=20`,
      {
        tags: { name: 'ProductSearch' },
      }
    );
    
    const searchTime = Date.now() - startTime;
    searchDuration.add(searchTime);
    
    const searchSuccess = check(searchRes, {
      'search status is 200': (r) => r.status === 200,
      'search has products': (r) => {
        try {
          const data = JSON.parse(r.body);
          return data.data && data.data.products;
        } catch {
          return false;
        }
      },
    });
    
    errorRate.add(!searchSuccess);
    sleep(1 + Math.random() * 2);
  }
  
  // Scenario 2: Product Listing (30% of traffic)
  else if (Math.random() < 0.3) {
    const category = Math.random() < 0.5 ? getRandomItem(categories) : null;
    const page = Math.floor(Math.random() * 10) + 1;
    
    let url = `${BASE_URL}/products?page=${page}&limit=20`;
    if (category) {
      url += `&category=${category}`;
    }
    
    const startTime = Date.now();
    const res = http.get(url, {
      tags: { name: 'ProductListing' },
    });
    const duration = Date.now() - startTime;
    productDuration.add(duration);
    
    const success = check(res, {
      'products status is 200': (r) => r.status === 200,
      'products response time < 500ms': (r) => r.timings.duration < 500,
    });
    
    errorRate.add(!success);
    sleep(2 + Math.random() * 3);
  }
  
  // Scenario 3: Get Single Product (20% of traffic)
  else if (Math.random() < 0.2) {
    // Use a realistic product ID format
    const productId = `product-${Math.floor(Math.random() * 1000) + 1}`;
    
    const startTime = Date.now();
    const res = http.get(`${BASE_URL}/products/${productId}`, {
      tags: { name: 'ProductDetail' },
    });
    const duration = Date.now() - startTime;
    productDuration.add(duration);
    
    const success = check(res, {
      'product status is 200 or 404': (r) => r.status === 200 || r.status === 404,
    });
    
    errorRate.add(!success && res.status !== 404);
    sleep(1 + Math.random() * 2);
  }
  
  // Scenario 4: Search Suggestions (10% of traffic)
  else {
    const prefix = getRandomItem(searchQueries).substring(0, 3);
    
    const res = http.get(
      `${BASE_URL}/search/suggestions?q=${prefix}&limit=10`,
      {
        tags: { name: 'SearchSuggestions' },
      }
    );
    
    check(res, {
      'suggestions status is 200': (r) => r.status === 200,
      'suggestions response time < 200ms': (r) => r.timings.duration < 200,
    });
    
    sleep(0.5 + Math.random());
  }
}

// Setup function (runs once at start)
export function setup() {
  console.log('Starting load test against:', BASE_URL);
  console.log('Test duration: ~25 minutes');
  
  // Health check
  const healthRes = http.get(`${BASE_URL.replace('/api', '')}/health`);
  if (healthRes.status !== 200) {
    console.warn('Warning: Health check failed. Continuing anyway...');
  }
  
  return { baseUrl: BASE_URL };
}

// Teardown function (runs once at end)
export function teardown(data) {
  console.log('Load test completed!');
  console.log('Check results for performance metrics.');
}

