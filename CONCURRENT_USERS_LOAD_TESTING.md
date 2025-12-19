# Concurrent Users Load Testing Guide

## Overview

This guide provides a complete solution for conducting concurrent users load tests on the House of Spells Marketplace API. Load testing helps ensure the application can handle expected traffic and identify performance bottlenecks.

## Quick Start

### 1. Install Testing Tools

**Artillery (Easiest)**:
```bash
npm install -g artillery
```

**k6 (More Advanced)**:
```bash
# macOS
brew install k6

# Linux/Windows - See https://k6.io/docs/getting-started/installation/
```

### 2. Run Quick Test

```bash
# Using Artillery (default)
./load-tests/quick-test.sh artillery

# Using k6
./load-tests/quick-test.sh k6

# Test against production/staging
./load-tests/quick-test.sh artillery https://hos-marketplaceapi-production.up.railway.app/api
```

### 3. Run Full Test

```bash
# Artillery
artillery run load-tests/concurrent-users-test.yml

# k6
k6 run load-tests/k6-concurrent-users.js
```

## Test Configuration

### Concurrent Users Phases

The tests simulate these load phases:

1. **Warm-up**: 5-20 users (1 min)
2. **Normal Load**: 100 users (5 min)
3. **Moderate Load**: 250 users (5 min)
4. **High Load**: 500 users (5 min)
5. **Peak Load**: 1000 users (5 min)
6. **Stress Test**: 2000 users (3 min)
7. **Spike Test**: 5000 users (1 min)
8. **Cool-down**: Gradual decrease (2 min)

### User Behavior Scenarios

- **40%**: Anonymous browsing (products, search)
- **35%**: Authenticated users (login, cart, orders)
- **15%**: Heavy search operations
- **10%**: Seller operations

## Performance Targets

### Response Times
- Product Search: < 200ms (p95)
- Product Listing: < 300ms (p95)
- Cart Operations: < 400ms (p95)
- Authentication: < 100ms (p95)

### Throughput
- Minimum: 100 req/s
- Target: 500+ req/s
- Peak: 1000+ req/s

### Error Rates
- 4xx Errors: < 1%
- 5xx Errors: < 0.1%
- Timeouts: < 0.1%

## Monitoring

During load tests, monitor:

1. **Application**: CPU, Memory, Request Queue
2. **Database**: Query times, Connection pool, Locks
3. **Cache**: Hit rates, Redis performance
4. **External**: Elasticsearch, CDN (if configured)

## Customization

Edit test files to adjust:
- Number of concurrent users
- Test duration
- User behavior scenarios
- Performance thresholds

See `load-tests/README.md` for detailed customization guide.

## Results Analysis

Key metrics to review:
- **Response Times**: p50, p95, p99 percentiles
- **Throughput**: Requests/second, Transactions/second
- **Error Rates**: 4xx, 5xx, Timeouts
- **Resource Usage**: CPU, Memory, Database

## Troubleshooting

### High Response Times
- Check database queries
- Review cache hit rates
- Optimize Elasticsearch
- Scale resources

### High Error Rates
- Check application logs
- Review connection pools
- Monitor external services
- Check rate limiting

## Best Practices

1. Start with low load and gradually increase
2. Test in production-like environment
3. Monitor all resources continuously
4. Document all test results
5. Run tests regularly to track trends

## Files

- `load-tests/concurrent-users-test.yml` - Artillery configuration
- `load-tests/k6-concurrent-users.js` - k6 test script
- `load-tests/helpers.js` - Helper functions
- `load-tests/quick-test.sh` - Quick test script
- `load-tests/README.md` - Detailed documentation

## Next Steps

1. Run baseline test to establish current performance
2. Identify bottlenecks and optimize
3. Set up continuous load testing in CI/CD
4. Create performance dashboards
5. Establish performance SLAs


