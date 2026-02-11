# Deploy and Automated Testing

## Deploy changes (Railway)

1. **Commit and push** to trigger a deploy:
   ```bash
   git add -A
   git status
   git commit -m "Phase 2/3: circuit breaker, rate limit config, smoke/load tests"
   git push origin feat/phase-1-notifications
   ```
   Railway will build and deploy services that have a `railway.toml` (gateway, auth, user, etc.) when this branch is linked to your project.

2. **Set env in Railway** (if not already set):
   - Gateway: `JWT_SECRET`, and any `*_SERVICE_URL` for microservices you’ve extracted.
   - Optional: `THROTTLE_*`, `CIRCUIT_BREAKER_*` (see `docs/NEXT_STEPS.md`).

3. **Get the gateway URL** from the Railway dashboard (e.g. `https://gateway-production-xxx.up.railway.app`).

---

## Automated testing

### 1. Gateway smoke test

Checks that gateway-owned endpoints respond correctly:

```bash
# Local gateway (must be running on port 4000)
node scripts/smoke-test-gateway.mjs

# Deployed gateway
GATEWAY_URL=https://your-gateway.railway.app node scripts/smoke-test-gateway.mjs
```

**Endpoints checked:** `/`, `/api/health`, `/api/health/live`, `/api/health/ready`, `/api/health/services`, `/api/health/circuits`.  
Exit code **0** = all passed; **1** = at least one failed.

### 2. Gateway load test

Sends concurrent requests to health/live, health/services, and health/circuits:

```bash
# Default: 10 workers, 30 seconds
GATEWAY_URL=http://localhost:4000 node scripts/load-test-gateway.mjs

# Custom: 20 workers, 60 seconds (e.g. against production)
GATEWAY_URL=https://your-gateway.railway.app node scripts/load-test-gateway.mjs 20 60
```

**Pass criteria:** Success rate ≥ 95% and no 502/503/connection errors. Exit **0** = pass, **1** = fail.

### 3. Run both (smoke + short load test)

```bash
# Local
./scripts/run-gateway-tests.sh

# Deployed
GATEWAY_URL=https://your-gateway.railway.app ./scripts/run-gateway-tests.sh
```

### 4. Full API endpoints (via gateway)

To test all API endpoints (products, auth, etc.) **through the gateway**:

```bash
# Point at your deployed gateway (gateway proxies to monolith or microservices)
API_URL=https://your-gateway.railway.app/api node test-api-endpoints.js
```

This uses your existing `test-api-endpoints.js`; set `API_URL` to the gateway base URL so all traffic goes gateway → backend.

---

## Local run before deploy

1. **Build gateway** (from repo root, after `pnpm install`):
   ```bash
   pnpm --filter @hos-marketplace/gateway build
   ```

2. **Start gateway** (needs `JWT_SECRET` in env or `.env`):
   ```bash
   cd services/gateway && pnpm start
   ```
   Or from root: `pnpm --filter @hos-marketplace/gateway start`

3. **Run tests:**
   ```bash
   GATEWAY_URL=http://localhost:4000 ./scripts/run-gateway-tests.sh
   ```

---

## Testing production (current monolith)

Your current production API is the monolith. To verify it after a deploy:

```bash
# Core health (no gateway-only endpoints)
GATEWAY_URL=https://hos-marketplaceapi-production.up.railway.app GATEWAY_FULL=0 node scripts/smoke-test-gateway.mjs

# All public API endpoints (products, health, currency, etc.)
API_URL=https://hos-marketplaceapi-production.up.railway.app/api node test-api-endpoints.js
```

When you deploy the **gateway** as the public entrypoint, use the gateway URL and full smoke test. Current production gateway:

**Gateway URL:** `https://gateway-service-production-df92.up.railway.app`

```bash
GATEWAY_URL=https://gateway-service-production-df92.up.railway.app node scripts/smoke-test-gateway.mjs   # full gateway (or GATEWAY_FULL=0 if /circuits not deployed)
GATEWAY_URL=https://gateway-service-production-df92.up.railway.app ./scripts/run-gateway-tests.sh
API_URL=https://gateway-service-production-df92.up.railway.app/api node test-api-endpoints.js
```

---

## CI suggestion

In CI (e.g. GitHub Actions), after deploy or in a nightly job:

1. Set `GATEWAY_URL` to the deployed gateway URL.
2. Run: `node scripts/smoke-test-gateway.mjs`
3. Run: `node scripts/load-test-gateway.mjs 5 10`
4. Optionally: `API_URL=$GATEWAY_URL/api node test-api-endpoints.js`

Fail the job if any script exits non-zero.
