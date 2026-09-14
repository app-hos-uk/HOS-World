# Railway Staging Setup Scripts

Use these scripts to provision and maintain the **staging** environment on Railway (isolated from production).

## Prerequisites

- [Railway CLI](https://docs.railway.app/develop/cli) v4.x: `npm install -g @railway/cli@4.42.1`
- Logged in: `railway login`
- Project linked from repo root: `railway link`

## Quick start

```bash
# 1. Create staging environment (one-time)
./scripts/railway/setup-staging-environment.sh

# 2. Confirm Postgres/Redis are not shared with production
./scripts/railway/verify-staging-isolation.sh

# 3. Set variables in Railway Dashboard (staging) — see staging-env-overrides.env.example

# 4. Migrate + seed QA data
./scripts/railway/seed-staging-database.sh

# 5. Add GitHub Actions secrets (repo Settings → Secrets):
#    STAGING_API_URL  = https://<staging-api>.up.railway.app
#    STAGING_WEB_URL  = https://<staging-web>.up.railway.app

# 6. Deploy: merge to `develop` (CI → deploy-staging.yml) or manual workflow dispatch
```

## Branching

| Branch    | Deploy target | Workflow                    |
|-----------|---------------|-----------------------------|
| `develop` | Railway staging | `.github/workflows/deploy-staging.yml` |
| `master`  | Railway production | `.github/workflows/deploy.yml` |

## Reset staging data

Re-run seeds after clearing test transactional data:

```bash
./scripts/railway/seed-staging-database.sh
```

For a full transactional wipe (orders, payments), use `scripts/cleanup-test-data.sql` against the **staging** database only.
