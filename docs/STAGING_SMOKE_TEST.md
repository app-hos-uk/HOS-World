# Staging Smoke Test Guide

After deploying to **staging** (via `develop` branch or manual **Deploy Staging** workflow), run these checks.

## Prerequisites

- Staging API URL (GitHub secret `STAGING_API_URL` or Railway dashboard)
- Staging Web URL (GitHub secret `STAGING_WEB_URL`)
- Optional: admin credentials from seed (`SEED_ADMIN_PASSWORD`, `TEST_SEED_PASSWORD`)

## Quick smoke test (curl)

```bash
# Set your staging URLs (no trailing slash on API base)
API_BASE="https://your-staging-api.up.railway.app"
WEB_BASE="https://your-staging-web.up.railway.app"

# 1. API liveness
curl -sS "$API_BASE/api/health/live" | jq .

# 2. API full health (includes database)
curl -sS "$API_BASE/api/health" | jq .

# 3. Public API (products list)
curl -sS "$API_BASE/api/products?limit=1" | jq .

# 4. Swagger docs (if SWAGGER_DOCS_TOKEN set, use /api/docs-{token})
curl -sS -o /dev/null -w "%{http_code}" "$API_BASE/api/docs"

# 5. Web app
curl -sS -o /dev/null -w "%{http_code}" "$WEB_BASE/"
```

## Expected responses

| Endpoint | Expected |
|----------|----------|
| `/api/health/live` | `{"status":"ok"}` or similar |
| `/api/health` | `{"status":"ok"}` with `database` status |
| `/api/products?limit=1` | `{"data":[...]}` or paginated items |
| `/api/docs` | HTTP 200 (or 404 if docs token required) |
| Web `/` | HTTP 200 |

## Automated CI smoke test

Workflow: [`.github/workflows/deploy-staging.yml`](../.github/workflows/deploy-staging.yml)

Requires GitHub repository secrets:

| Secret | Example |
|--------|---------|
| `STAGING_API_URL` | `https://hos-marketplaceapi-staging.up.railway.app` |
| `STAGING_WEB_URL` | `https://hos-marketplaceweb-staging.up.railway.app` |
| `RAILWAY_TOKEN` | Same project token as production deploy |

If URL secrets are missing, deploy still succeeds but smoke test is skipped with a warning.

## Full verification script (API service)

```bash
cd services/api
API_URL="https://your-staging-api.up.railway.app" pnpm run verify:deployment
```

Checks:

- Environment variables
- Database connectivity
- OAuthAccount table
- Health endpoint

## Manual checks

1. **Login** — Test user `customer@hos.test` or admin `app@houseofspells.co.uk`
2. **Products** — Product list loads on staging web
3. **Admin** — Admin panel accessible with admin credentials
4. **Database** — No Prisma errors in Railway logs
5. **Isolation** — Confirm staging uses test Stripe keys (`sk_test_`)

## Troubleshooting

| Symptom | Possible cause |
|---------|----------------|
| `P3006` in logs | Migration not applied; run `./scripts/railway/seed-staging-database.sh` |
| Health returns 500 | Database connection or Prisma client issue |
| Web shows wrong API | Rebuild web with correct `NEXT_PUBLIC_API_URL` |
| CORS errors | Set `FRONTEND_URL` and `CORS_ALLOWED_ORIGINS` on staging API |
| `.prisma/client` not found | Run `prisma generate` in build step |
