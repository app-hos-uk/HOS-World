# Phase 4 Installation Guide

## Prerequisites

Before installing Phase 4 dependencies, ensure you have:

1. **Elasticsearch** (optional but recommended)
   ```bash
   # Docker
   docker run -d --name elasticsearch -p 9200:9200 -e "discovery.type=single-node" elasticsearch:8.11.0

   # Or install locally
   brew install elasticsearch  # macOS
   ```

2. **Redis** (optional but recommended)
   ```bash
   # Docker
   docker run -d --name redis -p 6379:6379 redis:7-alpine

   # Or install locally
   brew install redis  # macOS
   ```

## Installation Steps

### 1. Install Dependencies

```bash
cd services/api
npm install
```

This will install:
- `@nestjs/elasticsearch` - Elasticsearch integration
- `@nestjs/cache-manager` - Caching support
- `cache-manager` - Cache manager library
- `redis` - Redis client
- `@nestjs/throttler` - Rate limiting

### 2. Configure Environment Variables

Update your `.env` file:

```env
# Elasticsearch
ELASTICSEARCH_NODE=http://localhost:9200
SYNC_PRODUCTS_ON_STARTUP=false

# Redis
REDIS_URL=redis://localhost:6379

# Rate Limiting
RATE_LIMIT_TTL=60000
RATE_LIMIT_MAX=100

# CDN
CDN_URL=https://cdn.hos-marketplace.com
```

### 3. Run Database Migrations

Apply performance indexes:

```bash
cd services/api
npm run db:migrate
```

Or manually run the SQL file:
```bash
psql -d hos_marketplace -f prisma/migrations/phase4_performance_indexes.sql
```

### 4. Start Services

**Development:**
```bash
# Terminal 1: Start API
npm run dev

# Terminal 2: Start Elasticsearch (if using)
docker start elasticsearch

# Terminal 3: Start Redis (if using)
docker start redis
```

**Production:**
```bash
npm run build
npm run start:prod
```

## Verification

### Check Elasticsearch
```bash
curl http://localhost:9200
```

### Check Redis
```bash
redis-cli ping
# Should return: PONG
```

### Test Search Endpoint
```bash
curl "http://localhost:3001/api/search?q=wand"
```

### Test Rate Limiting
```bash
# Make multiple rapid requests
for i in {1..110}; do curl http://localhost:3001/api/products; done
# Should get rate limited after 100 requests
```

## Troubleshooting

### Elasticsearch Connection Error
- Ensure Elasticsearch is running
- Check `ELASTICSEARCH_NODE` environment variable
- Search will fallback to database if Elasticsearch unavailable

### Redis Connection Error
- Ensure Redis is running
- Check `REDIS_URL` environment variable
- Cache will use in-memory fallback if Redis unavailable

### Database Index Errors
- Ensure PostgreSQL is running
- Check database connection
- Verify migration permissions

## Next Steps

1. Set up Elasticsearch cluster (production)
2. Configure Redis cluster (production)
3. Set up CDN (see `infrastructure/CDN_CONFIGURATION.md`)
4. Configure load testing (see `infrastructure/LOAD_TESTING.md`)
5. Monitor performance metrics

## Notes

- All Phase 4 features work with graceful fallbacks
- Elasticsearch is optional - search falls back to database
- Redis is optional - cache falls back to in-memory
- Services degrade gracefully if external dependencies unavailable

