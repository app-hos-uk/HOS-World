# Staging Smoke Test Guide

After deploying the Prisma 6 upgrade (or any major change), run these smoke tests to verify the app is healthy.

## Prerequisites

- Staging gateway URL (e.g. `https://your-staging-gateway.railway.app`)
- Optional: API URL if testing the API directly

## Quick smoke test (curl)

```bash
# Set your staging base URL
BASE_URL="https://your-staging-gateway.railway.app"

# 1. Gateway health
curl -s "$BASE_URL/api/health/live" | jq .

# 2. API health (via gateway)
curl -s "$BASE_URL/api/health" | jq .

# 3. Public API (e.g. products list)
curl -s "$BASE_URL/api/products?limit=1" | jq .

# 4. Swagger docs
curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/docs"
```

## Expected responses

| Endpoint | Expected |
|---------|----------|
| `/api/health/live` | `{"status":"ok"}` or similar |
| `/api/health` | `{"status":"ok"}` with `database` status |
| `/api/products?limit=1` | `{"data":[...]}` or `{"items":[...]}` |
| `/api/docs` | HTTP 200 |

## Full verification script (API service)

If deployed with the API service:

```bash
cd services/api
API_URL="https://your-staging-api.railway.app" pnpm run verify:deployment
```

This checks:

- Environment variables
- Database connectivity
- OAuthAccount table
- Health endpoint

## Manual checks

1. **Login** – User can log in and receive a token.
2. **Products** – Product list loads.
3. **Admin** – Admin can access the admin panel.
4. **Database** – No Prisma errors in logs.

## Troubleshooting

| Symptom | Possible cause |
|---------|----------------|
| `P3006` in logs | Migration not applied; run `prisma migrate deploy`. |
| Health returns 500 | Database connection or Prisma client issue. |
| `.prisma/client` not found | Run `prisma generate` in the build step. |
