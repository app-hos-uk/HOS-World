# Next Steps & Recommendations

This document tracks **Phase 2**, **Phase 3**, and **Maintenance** items from the microservices transition. Use it as a runbook and checklist.

---

## Phase 2

### Monitor logs for cross-service communication issues

- [ ] **Configure structured logging**  
  Ensure all services log `x-correlation-id` (or `x-request-id`) so traces can be correlated across gateway → service → EventBus.
- [ ] **Centralise logs**  
  Use Railway logs, or ship logs to a provider (e.g. Datadog, Logtail) and set up alerts on `502`/`503` and repeated proxy/circuit-breaker messages.
- [ ] **Review gateway logs**  
  Look for `[service-name] Circuit open`, `Proxy error`, and `Service X is temporarily unavailable` to spot failing services.

### Run load testing on gateway → microservices pipeline

- [ ] **Use the load test script**  
  From repo root:
  ```bash
  GATEWAY_URL=http://localhost:4000 node scripts/load-test-gateway.mjs
  # Or with concurrency and duration (e.g. 20 workers, 60 seconds):
  GATEWAY_URL=https://your-gateway.railway.app node scripts/load-test-gateway.mjs 20 60
  ```
- [ ] **Interpret results**  
  Script exits `0` if success rate ≥ 95% and no 502/503/connection errors. Use results to tune rate limits and circuit breaker thresholds.
- [ ] **Optional: k6 or Artillery**  
  For more realistic flows (auth, cart, checkout), add a separate k6/Artillery scenario hitting key API paths through the gateway.

### Verify data integrity across multi-schema PostgreSQL

- [ ] **Run the data integrity script**  
  After migrations and cross-schema views are applied:
  ```bash
  psql "$DATABASE_URL" -f scripts/verify-data-integrity.sql
  ```
  Or with Docker:  
  `cat scripts/verify-data-integrity.sql | docker compose exec -T postgres psql -U hos_user -d hos_marketplace`
- [ ] **Interpret results**  
  “Orphan” sections should return **no rows**. If they do, fix referential data (e.g. backfill or correct `userId`/`sellerId`). Table/view counts are informational.
- [ ] **Schedule periodically**  
  Run in CI or a nightly job and alert on new orphans.

### Set up observability dashboards (Observability module exists)

- [ ] **Expose metrics from each service**  
  The `packages/observability` module provides `MonitoringService.getMetrics()` (in-memory: request count, errors, response times). Add an HTTP endpoint (e.g. `GET /metrics` or `GET /api/metrics`) in each service that returns this snapshot (e.g. JSON or Prometheus text format).
- [ ] **Optional: Prometheus + Grafana**  
  If you expose Prometheus format, scrape each service and build dashboards for latency, error rate, and request rate per service.
- [ ] **Sentry**  
  Already integrated when `SENTRY_DSN` is set; ensure all services set it in production and review error trends in Sentry.

---

## Phase 3

### Split shared PostgreSQL into per-service databases (full independence)

- [ ] **Plan per-service DBs**  
  Each microservice gets its own PostgreSQL database (or schema in a shared cluster with no cross-schema views). Document migration order (e.g. auth first, then user, order, etc.).
- [ ] **Replace cross-schema views**  
  Today `infrastructure/database/create-cross-schema-views.sql` and `scripts/verify-data-integrity.sql` assume shared DB with schemas. After split, replace views with API calls or events (e.g. order service calls auth/user service for user info, or consumes user events).
- [ ] **Data migration and cutover**  
  Export/import or dual-write and switch. Prefer small steps: one service at a time.

### Implement dedicated Redis per service (if needed)

- [ ] **Assess need**  
  Use Redis only where you need caching, rate limiting, or event bus per service. Not all services require it.
- [ ] **EventBus**  
  Currently in-memory; see Maintenance below for “switch to Redis” when scaling.

### Add API rate limiting at gateway

- [x] **Rate limiting implemented**  
  Gateway uses `@nestjs/throttler` with three tiers: short (20/1s), medium (100/10s), long (300/60s). Optional env overrides:
  - `THROTTLE_TTL_SHORT`, `THROTTLE_LIMIT_SHORT`
  - `THROTTLE_TTL_MEDIUM`, `THROTTLE_LIMIT_MEDIUM`
  - `THROTTLE_TTL_LONG`, `THROTTLE_LIMIT_LONG`
- [ ] **Tune in production**  
  Adjust limits based on load test results and business rules (e.g. stricter for auth, looser for read-only).

### Implement circuit breakers for inter-service calls

- [x] **Circuit breaker implemented**  
  Gateway uses a per-service circuit breaker in `services/gateway/src/proxy/circuit-breaker.service.ts`. After N failures (default 5), the circuit opens and the gateway returns 503 for that service until the reset timeout (default 30s), then half-open probe.
- [ ] **Configuration (optional)**  
  Env: `CIRCUIT_BREAKER_FAILURE_THRESHOLD`, `CIRCUIT_BREAKER_RESET_TIMEOUT_MS`, `CIRCUIT_BREAKER_HALF_OPEN_SUCCESS_COUNT`.
- [ ] **Monitor**  
  `GET /api/health/circuits` returns circuit state per service; use this in dashboards or alerts.

---

## Maintenance

### Keep pnpm-lock.yaml committed

- [ ] **Do not remove**  
  Ensures reproducible installs (e.g. `bcryptjs` and other transitive deps stay locked). Run `pnpm install` and commit lockfile changes when adding/updating dependencies.

### Update Prisma binaryTargets if Railway environment changes

- [ ] **Current setting**  
  `services/api/prisma/schema.prisma` (and any service schema that ships Prisma) may set `binaryTargets = ["native", "debian-openssl-3.0.x"]` for Linux on Railway. If you change OS/runtime, update `binaryTargets` and redeploy.
- [ ] **Doc link**  
  [Prisma – binary targets](https://www.prisma.io/docs/orm/reference/prisma-schema-reference#binarytargets-options).

### Monitor EventBus performance; switch to Redis if needed

- [ ] **Current**  
  `packages/events` EventBus can use in-memory transport. Fine for single-instance or low throughput.
- [ ] **When to switch**  
  Multiple gateway/service instances or high event volume: switch to Redis (or another durable transport) so events are not lost and all instances see them. Implement and document the Redis adapter, then configure per environment.

### Review cross-schema views in PostgreSQL

- [ ] **Location**  
  `infrastructure/database/create-cross-schema-views.sql` defines views that read from other schemas (e.g. `order_service.v_users` → `auth_service.users`). Any schema or table rename/column change in the source schema can break these views.
- [ ] **Action**  
  On any change to auth, seller, order, or product schemas, re-run the view script and `scripts/verify-data-integrity.sql`; update views if the underlying tables change.
- [ ] **Phase 3**  
  When moving to per-service DBs, remove or replace these views with API/event-based access.

---

## Quick reference

| Item                    | Status   | Location / Command |
|-------------------------|----------|--------------------|
| Gateway rate limiting   | Done     | `services/gateway/src/app.module.ts`, env `THROTTLE_*` |
| Circuit breaker         | Done     | `services/gateway/src/proxy/circuit-breaker.service.ts`, `GET /api/health/circuits` |
| Load test script        | Done     | `scripts/load-test-gateway.mjs` |
| Data integrity script   | Done     | `scripts/verify-data-integrity.sql` |
| Observability module    | Exists   | `packages/observability`; add `/metrics` per service for dashboards |
| Cross-schema views      | Exists   | `infrastructure/database/create-cross-schema-views.sql` |
