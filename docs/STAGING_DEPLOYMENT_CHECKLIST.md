# Staging Deployment Checklist

Isolated **staging** environment for QA and pre-production testing. Production deploys from `master`; staging deploys from `develop`.

## Architecture

| Environment | Railway env | Git branch | Deploy workflow |
|-------------|-------------|------------|-----------------|
| Production | `production` | `master` | `.github/workflows/deploy.yml` |
| Staging | `staging` | `develop` | `.github/workflows/deploy-staging.yml` |

Helper scripts: [`scripts/railway/README.md`](../scripts/railway/README.md)

---

## 0. Create Railway staging environment

Production lives in Railway project **HOS-World Production Deployment**. Create an isolated staging copy:

```bash
./scripts/railway/setup-staging-environment.sh
# If staging already exists:
./scripts/railway/setup-staging-environment.sh --skip-create
```

Or manually:

```bash
railway environment create staging --duplicate production --json
railway environment link staging
railway status --json
```

After duplication:

- [ ] **CRITICAL:** Point staging API at staging Postgres/Redis via Railway references:
  - `DATABASE_URL=${{Postgres.DATABASE_URL}}`
  - `REDIS_URL=${{Redis.REDIS_URL}}`
- [ ] Run isolation check: `./scripts/railway/verify-staging-isolation.sh`
- [ ] Run migrations + seed: `./scripts/railway/seed-staging-database.sh`
- [ ] Set staging service public domains (Railway-generated URLs or custom subdomains)
- [ ] Keep money gates OFF on `@hos-marketplace/api` staging (see table below)
- [ ] Add GitHub secrets: `STAGING_API_URL`, `STAGING_WEB_URL` (for CI smoke tests)
- [ ] Deploy `develop` branch and smoke-test `/api/health/live`

### Safe staging defaults (force after duplicate)

| Variable | Staging value |
|----------|---------------|
| `NODE_ENV` | `staging` |
| `POS_ENABLED` | `false` |
| `FF_POS_INTEGRATION` | `false` |
| `LOYALTY_POS_VOUCHER_ENABLED` | `false` |
| `ACCOUNTING_ENABLED` | `false` |
| `FF_ACCOUNTING_XERO` | `false` |
| `POS_GIFT_CARD_MIN_AMOUNT` | `1` |
| `POS_GIFT_CARD_MAX_AMOUNT` | `500` |
| `STRIPE_SECRET_KEY` | `sk_test_...` only |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_test_...` only |

Full template: [`scripts/railway/staging-env-overrides.env.example`](../scripts/railway/staging-env-overrides.env.example)

**Generate fresh secrets** (never copy from production):

```bash
./services/api/scripts/generate-jwt-secrets.sh
openssl rand -hex 32   # INTEGRATION_ENCRYPTION_KEY
openssl rand -hex 32   # ENCRYPTION_KEY
```

---

## 1. Staging URLs and domains

### Option A: Railway-generated URLs (recommended for first setup)

1. Railway Dashboard → staging → `@hos-marketplace/api` → Settings → Networking → copy public URL
2. Same for `@hos-marketplace/web`
3. Set on staging API: `FRONTEND_URL`, `CORS_ALLOWED_ORIGINS`
4. Set on staging Web (rebuild required): `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SITE_URL`, `API_INTERNAL_URL` if using private networking
5. Add GitHub secrets:
   - `STAGING_API_URL` = API base **without** `/api` suffix (smoke test appends `/api/health/live`)
   - `STAGING_WEB_URL` = Web root URL

### Option B: Custom subdomains (optional)

| Service | Suggested subdomain |
|---------|---------------------|
| API | `staging-api.houseofspells.com` |
| Web | `staging.shop.houseofspells.com` |

Add CNAME records in DNS → Railway custom domain settings. Update the same env vars as Option A.

---

## 2. Run Prisma migration (staging DB)

Automated via container boot, or manually:

```bash
cd services/api
DATABASE_URL="<staging-db-url>" npx prisma migrate deploy
DATABASE_URL="<staging-db-url>" npx prisma migrate status
```

Or: `./scripts/railway/seed-staging-database.sh`

---

## 3. Seed QA test data

```bash
cd services/api
pnpm db:seed-staging
# Or: ./scripts/railway/seed-staging-database.sh
```

Creates:

- Super admin: `app@houseofspells.co.uk` (`SEED_ADMIN_PASSWORD`)
- Test users: `*@hos.test` (`TEST_SEED_PASSWORD`)
- Loyalty tiers, earn rules, redemption options

Enable HTTP seed endpoints on staging with `DEV_SEED_SECRET` (blocked in production without `PROD_SEED_SECRET`).

---

## 4. CI/CD — staging deploy workflow

File: [`.github/workflows/deploy-staging.yml`](../.github/workflows/deploy-staging.yml)

- Triggers when **CI** completes successfully on **`develop`**
- Manual re-deploy: GitHub Actions → **Deploy Staging** → Run workflow
- Deploys `@hos-marketplace/api` and `@hos-marketplace/web` to Railway environment **`staging`**
- Post-deploy smoke test uses `STAGING_API_URL` and `STAGING_WEB_URL` secrets

### Branching workflow

```
feature/* → PR → develop → auto-deploy staging → QA → PR → master → auto-deploy production
```

Ensure `develop` branch exists:

```bash
git checkout -b develop
git push -u origin develop
```

---

## 5. Environment variables (reference)

See [`services/api/.env.example`](../services/api/.env.example) (staging section) and [`apps/web/.env.example`](../apps/web/.env.example).

| Variable | Default | Purpose |
|----------|---------|---------|
| `POS_ENABLED` | `false` | Env gate for POS webhooks/jobs/sync |
| `FF_POS_INTEGRATION` | `false` | Feature-flag gate (both required) |
| `LOYALTY_POS_VOUCHER_ENABLED` | `false` | Gate POS gift card voucher issuance |
| `ACCOUNTING_ENABLED` | `false` | Gate HOS-to-Xero posting |
| `FF_ACCOUNTING_XERO` | `false` | Feature-flag gate for Xero |
| `DEV_SEED_SECRET` | — | Enables QA seed HTTP endpoints |

---

## 6. Feature flag rollout on staging (before production)

Follow this sequence on **staging** before enabling in production. See original phase checklist below.

### Phase 0: POS ingestion

Requires **both** `POS_ENABLED=true` and `FF_POS_INTEGRATION=true`. Verify:

- [ ] Lightspeed webhook signature validation works with test webhooks
- [ ] Sales poll imports with correct totals (not zeros)
- [ ] Pagination cursor persists across poll cycles
- [ ] OAuth 401 refresh works during long polling runs

### Phase 0.5: Identity resolution (no flag needed)

- [ ] `syncCustomer` searches by customer_code then email before creating
- [ ] Customer mappings use account-level sentinel key (not per-store)
- [ ] Phone numbers normalised to E.164 on write
- [ ] Run identity backfill job, review queue for ambiguous matches

### Phase 1: Loyalty ledger hardening (no flag needed)

- [ ] Idempotency keys prevent duplicate earn/burn transactions
- [ ] `POSSale.loyaltyPointsRedeemed` written on in-store burns
- [ ] Replay same earn request — returns prior result, no duplicate

### Phase 2: POS voucher bridge

Enable: `LOYALTY_POS_VOUCHER_ENABLED=true` (one store only)

- [ ] Staff can look up member, burn points, receive gift card number
- [ ] Gift card appears in Lightspeed with correct balance
- [ ] Failed issuance reverses burn, voucher marked FAILED

### Phase 3: Gift card reconciliation

- [ ] Reconciliation job runs, matches vouchers to Lightspeed cards
- [ ] Drift detected and recorded in DiscrepanciesService

### Phase 4: Xero accounting

Enable: `ACCOUNTING_ENABLED=true` + `FF_ACCOUNTING_XERO=true`

- [ ] Connect Xero via OAuth (demo org only on staging)
- [ ] Daily journal enqueue + ledger drain work end-to-end

### Phase 5: Admin UI and reporting

- [ ] Admin accounting page loads, shows outbox status
- [ ] Three-way reconciliation view renders

---

## 7. Post-deployment verification

See [`docs/STAGING_SMOKE_TEST.md`](STAGING_SMOKE_TEST.md).

```bash
cd services/api
API_URL="$STAGING_API_URL" pnpm run verify:deployment
```

- [ ] All API endpoints respond correctly
- [ ] No unexpected errors in logs
- [ ] Feature flags default to OFF for money/POS/Xero
- [ ] Real production data is never used (isolated DB)

---

## 8. Reset staging data (periodic QA cleanup)

Transactional wipe (staging DB only):

```bash
psql "$STAGING_DATABASE_URL" -f scripts/cleanup-test-data.sql
# Review output, then COMMIT or ROLLBACK inside the script transaction
```

Re-seed:

```bash
./scripts/railway/seed-staging-database.sh
```

---

## 9. Rollback plan

If issues arise on staging:

1. Disable feature flags: `ACCOUNTING_ENABLED=false`, `LOYALTY_POS_VOUCHER_ENABLED=false`, `POS_ENABLED=false`
2. Redeploy previous commit via GitHub Actions manual dispatch
3. Staging DB is isolated — production is unaffected

---

## What NOT to do

- Do NOT share `DATABASE_URL` / `REDIS_URL` between staging and production
- Do NOT use production Stripe keys on staging
- Do NOT copy `INTEGRATION_ENCRYPTION_KEY` from production (encrypted credentials won't decrypt)
- Do NOT point staging `FRONTEND_URL` at production domains
- Do NOT run `cleanup-test-data.sql` against production
