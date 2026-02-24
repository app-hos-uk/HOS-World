# Railway Deployment Guide

## Architecture

The application runs as a **modular monolith** with two deployable services:

| Railway Service | Description | Dockerfile |
|----------------|-------------|------------|
| `@hos-marketplace/api` | NestJS API monolith (all business logic) | `services/api/Dockerfile` |
| `@hos-marketplace/web` | Next.js frontend | `apps/web/Dockerfile` |

Infrastructure services (managed by Railway):
- **Postgres** — primary database
- **Redis** — caching, BullMQ job queue, pub/sub
- **Meilisearch** — full-text product search

## Deploying

### Auto-deploy (recommended)

Both services are connected to the GitHub repo with **Branch = `master`**.
Watch paths are configured so each service only rebuilds when its files change:

| Service | Watch Paths |
|---------|-------------|
| `@hos-marketplace/api` | `/services/api/**`, `/packages/**` |
| `@hos-marketplace/web` | `/apps/web/**`, `/packages/**` |

Push to `master` → only affected services rebuild.

### Manual deploy via CLI

```bash
cd "/Users/sabuj/Desktop/HOS-latest Sabu"

# Deploy API
railway service "@hos-marketplace/api"
railway up --detach

# Deploy Web
railway service "@hos-marketplace/web"
railway up --detach

# Redeploy from last successful build (no code upload)
railway service "@hos-marketplace/api"
railway redeploy --yes
```

### Health checks

Both services expose `/api/health`:
- API: `https://hos-marketplaceapi-production.up.railway.app/api/health`
- Web: `https://hos-marketplaceweb-production.up.railway.app/api/health`

Railway healthcheck is configured in `railway.toml`:
```toml
[deploy]
healthcheckPath = "/api/health"
healthcheckTimeout = 300
```

## Environment Variables

### API (`services/api/.env.example`)
Required: `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `REDIS_URL`

### Web (`apps/web/.env.example`)
Required: `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SITE_URL`

Set via Railway Dashboard or CLI:
```bash
railway variable set "KEY=value" -s "@hos-marketplace/api"
railway variable list -s "@hos-marketplace/api"
```

## Monitoring

```bash
# View logs
railway logs -s "@hos-marketplace/api"
railway logs -s "@hos-marketplace/web"

# Check status
railway status

# Open dashboard
railway open
```
