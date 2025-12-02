# Load Testing Guide

## Overview

Load testing ensures the House of Spells Marketplace can handle expected traffic:
- 2,500-5,000 sellers
- 150,000 products
- 1,000-5,000 concurrent users

## Tools

### Option 1: Artillery (Recommended)
- Node.js-based
- Easy to configure
- Real-time reporting
- Free and open-source

### Option 2: k6
- Go-based
- High performance
- Good for CI/CD
- Free and open-source

### Option 3: Apache JMeter
- Java-based
- GUI available
- Extensive features
- Free and open-source

## Artillery Setup

### Installation
```bash
npm install -g artillery
```

### Basic Test Configuration
Create `load-tests/scenarios/basic-flow.yml`:

```yaml
config:
  target: 'http://localhost:3001/api'
  phases:
    - duration: 60
      arrivalRate: 10
      name: "Warm up"
    - duration: 120
      arrivalRate: 50
      name: "Normal load"
    - duration: 60
      arrivalRate: 100
      name: "Peak load"
    - duration: 60
      arrivalRate: 200
      name: "Stress test"
  processor: "./scenarios/helpers.js"

scenarios:
  - name: "Product Search"
    flow:
      - get:
          url: "/search?q=wand"
      - think: 2
      - get:
          url: "/products?page=1&limit=20"

  - name: "User Journey"
    weight: 30
    flow:
      - post:
          url: "/auth/login"
          json:
            email: "{{ $randomEmail() }}"
            password: "password123"
          capture:
            - json: "$.data.accessToken"
              as: "token"
      - think: 1
      - get:
          url: "/products"
          headers:
            Authorization: "Bearer {{ token }}"
      - think: 3
      - post:
          url: "/cart/items"
          json:
            productId: "{{ $randomString() }}"
            quantity: 1
          headers:
            Authorization: "Bearer {{ token }}"
```

## Test Scenarios

### 1. Product Search Load
```yaml
scenarios:
  - name: "Heavy Search Load"
    flow:
      - get:
          url: "/search?q={{ $randomString() }}&page=1&limit=20"
```

### 2. Product Listing
```yaml
scenarios:
  - name: "Product Listing"
    flow:
      - get:
          url: "/products?page={{ $randomInt(1, 10) }}&limit=20"
```

### 3. Cart Operations
```yaml
scenarios:
  - name: "Cart Operations"
    flow:
      - get:
          url: "/cart"
          headers:
            Authorization: "Bearer {{ token }}"
      - post:
          url: "/cart/items"
          json:
            productId: "product-{{ $randomInt(1, 1000) }}"
            quantity: {{ $randomInt(1, 5) }}
          headers:
            Authorization: "Bearer {{ token }}"
```

### 4. Order Creation
```yaml
scenarios:
  - name: "Order Creation"
    flow:
      - post:
          url: "/orders"
          json:
            cartId: "{{ cartId }}"
            shippingAddressId: "{{ addressId }}"
            billingAddressId: "{{ addressId }}"
          headers:
            Authorization: "Bearer {{ token }}"
```

## Running Tests

### Basic Test
```bash
artillery run load-tests/scenarios/basic-flow.yml
```

### With Output
```bash
artillery run --output report.json load-tests/scenarios/basic-flow.yml
artillery report report.json
```

### Quick Test
```bash
artillery quick --count 100 --num 10 http://localhost:3001/api/products
```

## Performance Targets

### Response Times
- **Product Search**: < 100ms (with Elasticsearch)
- **Product Listing**: < 200ms
- **Cart Operations**: < 150ms
- **Order Creation**: < 500ms
- **Authentication**: < 100ms

### Throughput
- **API Requests**: > 1000 req/s
- **Concurrent Users**: 5000+
- **Database Queries**: Optimized with indexes

### Error Rates
- **4xx Errors**: < 1%
- **5xx Errors**: < 0.1%
- **Timeout Rate**: < 0.1%

## Monitoring During Tests

### Application Metrics
- CPU usage
- Memory usage
- Database connections
- Cache hit rates
- Request queue depth

### Database Metrics
- Query execution time
- Connection pool usage
- Slow queries
- Lock contention

### External Services
- Elasticsearch performance
- Redis performance
- CDN cache hit ratio

## k6 Setup (Alternative)

### Installation
```bash
brew install k6  # macOS
# or download from https://k6.io
```

### Basic Test Script
Create `load-tests/k6/search-test.js`:

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '1m', target: 50 },
    { duration: '3m', target: 50 },
    { duration: '1m', target: 100 },
    { duration: '3m', target: 100 },
    { duration: '1m', target: 200 },
    { duration: '3m', target: 200 },
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<200'],
    http_req_failed: ['rate<0.01'],
  },
};

const BASE_URL = 'http://localhost:3001/api';

export default function () {
  // Product search
  let res = http.get(`${BASE_URL}/search?q=wand`);
  check(res, {
    'search status is 200': (r) => r.status === 200,
    'search response time < 200ms': (r) => r.timings.duration < 200,
  });
  
  sleep(1);
  
  // Product listing
  res = http.get(`${BASE_URL}/products?page=1&limit=20`);
  check(res, {
    'products status is 200': (r) => r.status === 200,
  });
  
  sleep(2);
}
```

### Run k6 Test
```bash
k6 run load-tests/k6/search-test.js
```

## Load Testing Scenarios

### Scenario 1: Normal Load
- 100 concurrent users
- 10 requests per second
- Duration: 30 minutes

### Scenario 2: Peak Load
- 500 concurrent users
- 50 requests per second
- Duration: 1 hour

### Scenario 3: Stress Test
- 1000 concurrent users
- 100 requests per second
- Duration: 30 minutes

### Scenario 4: Spike Test
- Sudden increase to 2000 users
- Duration: 5 minutes
- Tests system recovery

## Test Data Preparation

### Generate Test Products
```bash
# Use bulk import to create test products
npm run db:seed:products -- --count=10000
```

### Generate Test Users
```bash
# Create test users with various roles
npm run db:seed:users -- --count=1000
```

## Results Analysis

### Key Metrics to Track
1. **Response Times**
   - p50 (median)
   - p95 (95th percentile)
   - p99 (99th percentile)

2. **Throughput**
   - Requests per second
   - Transactions per second

3. **Error Rates**
   - HTTP errors
   - Timeouts
   - Failed requests

4. **Resource Usage**
   - CPU
   - Memory
   - Network I/O
   - Database connections

### Reporting
- Generate HTML reports
- Export metrics to monitoring tools
- Track trends over time

## Continuous Load Testing

### CI/CD Integration
```yaml
# .github/workflows/load-test.yml
name: Load Testing
on:
  schedule:
    - cron: '0 2 * * *'  # Daily at 2 AM
  workflow_dispatch:

jobs:
  load-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Run Artillery
        run: |
          npm install -g artillery
          artillery run load-tests/scenarios/basic-flow.yml
```

## Best Practices

1. **Start Small**: Begin with low load and gradually increase
2. **Monitor Resources**: Watch CPU, memory, and database
3. **Test Realistic Scenarios**: Mirror actual user behavior
4. **Baseline First**: Establish performance baseline
5. **Iterate**: Run tests regularly and track improvements
6. **Document Results**: Keep records of all test runs

## Troubleshooting

### High Response Times
- Check database query performance
- Review cache hit rates
- Optimize Elasticsearch queries
- Scale up resources

### High Error Rates
- Check application logs
- Review database connection pool
- Monitor external service health
- Check rate limiting

### Resource Exhaustion
- Scale horizontally (add instances)
- Optimize queries
- Increase connection pool size
- Review caching strategy

## Next Steps

1. Set up load testing infrastructure
2. Create test scenarios
3. Run baseline tests
4. Optimize based on results
5. Set up continuous testing
6. Monitor performance trends

