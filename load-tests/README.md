# Concurrent Users Load Testing Guide

This guide explains how to conduct concurrent users load tests for the House of Spells Marketplace API.

## Prerequisites

### Option 1: Artillery (Recommended for Quick Tests)

```bash
# Install globally
npm install -g artillery

# Or install locally in the project
npm install --save-dev artillery
```

### Option 2: k6 (Recommended for Advanced Testing)

```bash
# macOS
brew install k6

# Linux
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6

# Windows
# Download from https://k6.io/docs/getting-started/installation/
```

## Quick Start

### 1. Start Your API Server

```bash
# Development
cd services/api
npm run dev

# Production
npm run start
```

### 2. Run Artillery Test

```bash
# Basic test (uses localhost:3001)
artillery run load-tests/concurrent-users-test.yml

# Test against production/staging
artillery run --target https://hos-marketplaceapi-production.up.railway.app/api load-tests/concurrent-users-test.yml

# Save report
artillery run --output report.json load-tests/concurrent-users-test.yml
artillery report report.json
```

### 3. Run k6 Test

```bash
# Basic test (uses localhost:3001)
k6 run load-tests/k6-concurrent-users.js

# Test against production/staging
k6 run -e API_URL=https://hos-marketplaceapi-production.up.railway.app/api load-tests/k6-concurrent-users.js

# With output file
k6 run --out json=results.json load-tests/k6-concurrent-users.js
```

## Test Scenarios

### Artillery Test Phases

The `concurrent-users-test.yml` includes these phases:

1. **Warm-up**: 5-20 concurrent users (1 minute)
2. **Normal Load**: 100 concurrent users (5 minutes)
3. **Moderate Load**: 250 concurrent users (5 minutes)
4. **High Load**: 500 concurrent users (5 minutes)
5. **Peak Load**: 1000 concurrent users (5 minutes)
6. **Stress Test**: 2000 concurrent users (3 minutes)
7. **Spike Test**: 5000 concurrent users (1 minute)
8. **Cool-down**: Gradual decrease (2 minutes)

### k6 Test Stages

The `k6-concurrent-users.js` includes similar stages with gradual ramp-up and cool-down.

## User Behavior Scenarios

### 1. Anonymous Browsing (40% of traffic)
- Health checks
- Browse products
- Search products
- View product details

### 2. Authenticated User Journey (35% of traffic)
- Login
- Browse products
- View cart
- Add items to cart
- View orders

### 3. Product Search Heavy (15% of traffic)
- Multiple searches
- Search suggestions
- Filtered searches

### 4. Seller Operations (10% of traffic)
- Seller login
- View seller products
- View seller orders
- Seller dashboard

## Performance Targets

### Response Time Targets
- **Health Check**: < 50ms
- **Product Search**: < 200ms (p95)
- **Product Listing**: < 300ms (p95)
- **Cart Operations**: < 400ms (p95)
- **Authentication**: < 100ms (p95)
- **Order Operations**: < 500ms (p95)

### Throughput Targets
- **Minimum**: 100 requests/second
- **Target**: 500+ requests/second
- **Peak**: 1000+ requests/second

### Error Rate Targets
- **4xx Errors**: < 1%
- **5xx Errors**: < 0.1%
- **Timeout Rate**: < 0.1%

## Monitoring During Tests

### Application Metrics to Monitor

1. **CPU Usage**: Should stay below 80%
2. **Memory Usage**: Monitor for memory leaks
3. **Database Connections**: Check connection pool usage
4. **Cache Hit Rate**: Should be > 80% for cached endpoints
5. **Request Queue Depth**: Should remain low

### Database Metrics

1. **Query Execution Time**: Monitor slow queries
2. **Connection Pool Usage**: Should not be exhausted
3. **Lock Contention**: Monitor for database locks
4. **Transaction Rate**: Monitor transaction throughput

### External Services

1. **Elasticsearch**: Monitor search performance
2. **Redis**: Monitor cache performance
3. **CDN**: Monitor cache hit ratio (if configured)

## Customizing Tests

### Adjusting Concurrent Users

Edit the test files to adjust the number of concurrent users:

**Artillery (`concurrent-users-test.yml`)**:
```yaml
phases:
  - duration: 300
    arrivalRate: 50  # Change this to adjust concurrent users
    name: "Custom Load"
```

**k6 (`k6-concurrent-users.js`)**:
```javascript
stages: [
  { duration: '5m', target: 500 },  // Change target to adjust concurrent users
]
```

### Adding Custom Scenarios

Add new scenarios to test specific endpoints:

**Artillery**:
```yaml
scenarios:
  - name: "Custom Scenario"
    weight: 10
    flow:
      - get:
          url: "/your-endpoint"
```

**k6**:
```javascript
function customScenario() {
  const res = http.get(`${BASE_URL}/your-endpoint`);
  check(res, { 'status is 200': (r) => r.status === 200 });
}
```

## Interpreting Results

### Key Metrics

1. **Response Times**
   - **p50 (Median)**: Typical response time
   - **p95**: 95% of requests are faster than this
   - **p99**: 99% of requests are faster than this

2. **Throughput**
   - **Requests per second**: How many requests the system handles
   - **Transactions per second**: Successful operations per second

3. **Error Rates**
   - **4xx Errors**: Client errors (bad requests, not found, etc.)
   - **5xx Errors**: Server errors (internal errors, timeouts)
   - **Timeout Rate**: Requests that exceeded timeout

### What to Look For

✅ **Good Results**:
- Response times meet targets
- Error rate < 1%
- Throughput meets or exceeds targets
- No resource exhaustion

⚠️ **Warning Signs**:
- Response times increasing with load
- Error rate > 1%
- Throughput decreasing
- High CPU/memory usage

❌ **Critical Issues**:
- Response times > 1 second
- Error rate > 5%
- System crashes or timeouts
- Resource exhaustion

## Continuous Load Testing

### CI/CD Integration

Add to your CI/CD pipeline:

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
      - name: Install k6
        run: |
          sudo gpg -k
          sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
          echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
          sudo apt-get update
          sudo apt-get install k6
      - name: Run Load Test
        run: |
          k6 run -e API_URL=${{ secrets.API_URL }} load-tests/k6-concurrent-users.js
```

## Troubleshooting

### High Response Times

1. Check database query performance
2. Review cache hit rates
3. Optimize Elasticsearch queries
4. Check for N+1 query problems
5. Scale up resources if needed

### High Error Rates

1. Check application logs
2. Review database connection pool
3. Monitor external service health
4. Check rate limiting settings
5. Review error cache for patterns

### Resource Exhaustion

1. Scale horizontally (add instances)
2. Optimize queries
3. Increase connection pool size
4. Review caching strategy
5. Add more resources

## Best Practices

1. **Start Small**: Begin with low load and gradually increase
2. **Monitor Resources**: Watch CPU, memory, and database continuously
3. **Test Realistic Scenarios**: Mirror actual user behavior
4. **Baseline First**: Establish performance baseline before optimizations
5. **Iterate**: Run tests regularly and track improvements
6. **Document Results**: Keep records of all test runs for comparison
7. **Test in Production-like Environment**: Use staging environment that mirrors production
8. **Test During Off-Peak Hours**: Avoid impacting real users

## Next Steps

1. Set up monitoring dashboards
2. Create automated load testing schedule
3. Establish performance SLAs
4. Set up alerts for performance degradation
5. Regular performance reviews and optimizations


