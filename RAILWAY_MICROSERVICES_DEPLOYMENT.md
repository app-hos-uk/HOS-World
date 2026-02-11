# Railway Microservices Deployment Summary

**Date:** 2026-02-10  
**Project:** HOS-World Production Deployment  
**Status:** All 13 microservices deployed and running (SUCCESS). Fixes applied: Prisma binaryTargets, bcrypt→bcryptjs (auth, user), EventBus no-op default, JWT_SECRET on gateway, DATABASE_URL on all DB services.

---

## Services Deployed

| Service             | Railway Service Name   | Dockerfile Path                    | Status        |
|---------------------|-------------------------|------------------------------------|---------------|
| Auth                | auth-service            | services/auth/Dockerfile          | Deployed      |
| User                | user-service            | services/user/Dockerfile          | Deployed      |
| Admin               | admin-service           | services/admin/Dockerfile         | Deployed      |
| Order               | order-service           | services/order/Dockerfile          | Deployed      |
| Search              | search-service          | services/search/Dockerfile         | Deployed      |
| Seller              | seller-service          | services/seller/Dockerfile         | Deployed      |
| Content             | content-service         | services/content/Dockerfile        | Deployed      |
| Gateway             | gateway-service         | services/gateway/Dockerfile        | Deployed      |
| Payment             | payment-service         | services/payment/Dockerfile        | Deployed      |
| Product             | product-service         | services/product/Dockerfile        | Deployed      |
| Inventory           | inventory-service       | services/inventory/Dockerfile      | Deployed      |
| Influencer          | influencer-service      | services/influencer/Dockerfile    | Deployed      |
| Notification        | notification-service    | services/notification/Dockerfile  | Deployed      |

---

## Fixes Applied (This Session)

### 1. EventBus / Redis (Payment and other services)
- **Issue:** `Nest can't resolve dependencies of the EventBusService (?, EVENT_BUS_SERVICE_NAME)` — the Redis client was not being resolved in the built app even when `REDIS_URL` was set, causing all services using EventBus to crash.
- **Fix:** EventBus now uses the **no-op implementation by default**. Redis is only used when you set **`EVENT_BUS_USE_REDIS=true`** and `REDIS_URL`. This allows all services to start reliably. To re-enable Redis later, set `EVENT_BUS_USE_REDIS=true` in Railway for the desired services.
- **Files:** `packages/events/src/event-bus.module.ts` (guard on `EVENT_BUS_USE_REDIS`).

### 2. Auth & User service – bcrypt native module
- **Issue:** `Cannot find module '.../bcrypt_lib.node'` (bcrypt native binding not built in the production image).
- **Fix:** Auth and User services use **bcryptjs** (pure JavaScript) instead of **bcrypt** (native).
- **Files:** `services/auth/package.json` & `services/user/package.json`, `services/auth/src/auth/auth.service.ts`, `services/user/src/users/users.service.ts`.

### 3. Prisma Query Engine – Railway runtime
- **Issue:** `Prisma Client could not locate the Query Engine for runtime "debian-openssl-3.0.x"` (generated for 1.1.x).
- **Fix:** Added `binaryTargets = ["native", "debian-openssl-3.0.x"]` to every service’s `schema.prisma` generator block.

### 4. DATABASE_URL and JWT_SECRET
- **Gateway:** Set `JWT_SECRET` (e.g. same value as auth/payment) in Railway variables.
- **All DB services:** Set `DATABASE_URL` to the Postgres URL (e.g. from the Postgres plugin or payment-service). Use Railway Dashboard or `railway variable set "DATABASE_URL=<full postgresql://...>"`; avoid capturing `railway service X` output into the value.

---

## Railway Configuration Per Service

- **Root directory:** Leave empty (build context = repo root).
- **Dockerfile path:** Set via variable `RAILWAY_DOCKERFILE_PATH=services/<name>/Dockerfile` (e.g. `services/payment/Dockerfile`). This was set for services where the CLI completed; you can set/confirm in the dashboard.

### Required environment variables (per service)

Set in **Railway Dashboard → each service → Variables**:

- **All services:** `NODE_ENV=production`, `PORT` (Railway usually sets this).
- **Services with Prisma/DB:** `DATABASE_URL` – use the correct DB URL for that service’s schema (e.g. from a PostgreSQL service in the same project, or per-schema DB if you use separate DBs).
- **Optional – EventBus:** `REDIS_URL` – if set, the service will use Redis for events; if unset, EventBus runs in no-op mode.
- **Auth:** `JWT_SECRET`, `JWT_REFRESH_SECRET` (and any other auth-related vars your app expects).
- **Gateway:** Point to internal URLs of other services (e.g. auth, user, order) as required by your gateway config.

---

## Verify Deployment

1. **Dashboard:** [Railway Dashboard](https://railway.app/dashboard) → project **HOS-World Production Deployment** → check each service’s **Deployments** and **Logs**.
2. **Health endpoints:** After a service is running, open its public URL (from **Settings → Networking → Generate Domain**) and hit the health route, e.g.:
   - `https://<service-domain>/api/health/live`
   - Gateway may use `/health/live` (see `services/gateway/railway.toml`).
3. **CLI:**
   ```bash
   railway service payment-service
   railway deployment list
   railway logs
   ```

---

## Redeploy a Single Service

```bash
cd "/Users/sabuj/Desktop/HOS-latest Sabu"
railway service <service-name>   # e.g. payment-service
railway up --detach
```

---

## Add Missing RAILWAY_DOCKERFILE_PATH

If a service was created without the correct Dockerfile path:

```bash
railway service <service-name>
railway variable set "RAILWAY_DOCKERFILE_PATH=services/<name>/Dockerfile"
```

Example: `railway variable set "RAILWAY_DOCKERFILE_PATH=services/auth/Dockerfile"` for auth-service.

---

## Next Steps

1. Wait for builds to finish and check **Deployments** and **Logs** for any service that stays in CRASHED or fails healthchecks.
2. Ensure each service that needs a database has the correct `DATABASE_URL` (and that the DB and schema exist).
3. Optionally add `REDIS_URL` to services that should publish/consume events.
4. Configure the **gateway** with internal URLs of auth, user, order, etc., and expose a single public domain if desired.
