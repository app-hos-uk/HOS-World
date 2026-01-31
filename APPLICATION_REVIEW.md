# House of Spells Marketplace – Application Review

**Review date:** January 2026  
**Scope:** Full monorepo (API, web app, packages, infrastructure)  
**Verdict:** Enterprise-ready with minor alignment and doc updates recommended.

---

## 1. Current Status

### 1.1 Architecture

| Layer | Stack | Status |
|-------|--------|--------|
| **API** | NestJS, Prisma, PostgreSQL, Redis, BullMQ, Meilisearch | ✅ Production-ready |
| **Web** | Next.js, React, shared packages | ✅ Functional |
| **Mobile** | Expo (React Native) | ⏳ Skeleton (minimal routes) |
| **Packages** | api-client, shared-types, theme-system, utils, cms-client | ✅ Used by web |
| **Deploy** | Railway (Dockerfile), 2 replicas | ✅ Configured |
| **Infra** | k6 load test, Elasticsearch/Redis setup scripts, CDN docs | ✅ Present |

- **Monorepo:** pnpm workspaces, Turbo for dev/build/lint/test.
- **API:** 95+ Prisma models, 60+ feature modules (auth, products, orders, cart, payments, shipping, tax, inventory, influencers, admin, etc.).
- **Auth:** JWT + refresh tokens, optional OAuth (Google/Facebook/Apple), RBAC (RolesGuard + @Roles), Public decorator for unauthenticated routes.
- **Frontend–API:** Single `ApiClient` (packages/api-client) built with `baseUrl` from `NEXT_PUBLIC_API_URL`; token refresh and 401 handling centralized.

### 1.2 What’s Implemented (Enterprise-Relevant)

| Area | Implementation |
|------|----------------|
| **Security** | Helmet, CORS allowlist, global ValidationPipe (whitelist/forbidNonWhitelisted), JWT + refresh, rate limiting (Throttler), env validation on startup |
| **Observability** | Sentry init + global SentryExceptionFilter, request ID middleware + Sentry tag, JSON logging when `LOG_FORMAT=json` or NODE_ENV=production, health/ready/live endpoints |
| **Resilience** | Graceful shutdown (app.close() then Bull Board cleanup on SIGINT/SIGTERM), BullMQ queue + Bull Board dashboard, Redis cache layer |
| **Scalability** | Railway `numReplicas: 2`, stateless API, Redis-backed queue and cache |
| **API** | Global prefix `/api`, Swagger at `/api/docs`, health at `/api/health`, liveness `/api/health/live`, readiness `/api/health/ready` (returns 503 when not ready) |
| **Testing** | Unit (Jest), integration (DB/Redis skip when unavailable), E2E specs and setup in `services/api/test` and `apps/web/e2e` |
| **Config** | `services/api/env.example` documents DATABASE_URL, JWT_*, REDIS_URL, SENTRY_DSN, LOG_FORMAT, etc. |

### 1.3 Alignment (Frontend ↔ API)

| Aspect | Status |
|--------|--------|
| **Base URL** | Web uses `getPublicApiBaseUrl()` (NEXT_PUBLIC_API_URL normalized to `/api`); api-client expects baseUrl ending in `/api`. ✅ Aligned. |
| **Auth** | ApiClient sends Bearer token, handles refresh and onUnauthorized. API uses JwtAuthGuard and refresh flow. ✅ Aligned. |
| **API shape** | api-client and shared-types define DTOs/responses; API returns consistent structures. ✅ No versioning in URL; both use `/api`. |
| **Env** | API: DATABASE_URL, JWT_*, REDIS_URL, etc. Web: NEXT_PUBLIC_API_URL. Documented in env.example and deployment docs. ✅ |

### 1.4 Gaps and Minor Issues

| Item | Severity | Notes |
|------|----------|--------|
| **API versioning** | Low | Versioning is commented out in main.ts; routes are `/api/*` only. Frontend and api-client already normalize to `/api`. Re-enable only if you introduce v2. |
| **ENTERPRISE_GRADE_REMAINING.md** | Low | Section “1. Incomplete / Broken” still describes old state; Summary table is up to date. Update section 1 to “Done” for clarity. |
| **E2E / load runs** | Medium | E2E and k6 scripts exist but are not necessarily run in CI on every deploy. Add to CI or release checklist for regression safety. |
| **SENTRY_DSN in production** | Medium | Optional but recommended. Set in Railway (or host) so errors and performance are tracked. |
| **Mobile app** | Low | Expo app is minimal; treat as future phase unless mobile is required now. |

---

## 2. Enterprise-Grade Checklist

| Category | Criterion | Status |
|----------|-----------|--------|
| **Security** | Auth (JWT + refresh, optional OAuth) | ✅ |
| | RBAC / role-based routes | ✅ (RolesGuard, @Roles) |
| | Input validation (DTO + ValidationPipe) | ✅ |
| | Security headers (Helmet) | ✅ |
| | CORS restrict to known origins | ✅ |
| | Rate limiting | ✅ |
| | Secrets not in repo (env-driven) | ✅ |
| **Reliability** | Graceful shutdown | ✅ |
| | Health + liveness + readiness | ✅ |
| | Error reporting (Sentry) | ✅ (when SENTRY_DSN set) |
| **Observability** | Request ID + Sentry tag | ✅ |
| | Structured (JSON) logging option | ✅ |
| | Centralized exception filter | ✅ |
| **Scalability** | Horizontal scaling (replicas) | ✅ |
| | Stateless API | ✅ |
| | Queue (BullMQ) + cache (Redis) | ✅ |
| **Maintainability** | Monorepo, shared packages | ✅ |
| | API docs (Swagger) | ✅ |
| | Env documented (env.example) | ✅ |
| **Testing** | Unit + integration + E2E structure | ✅ |
| | Integration tests skip cleanly without DB/Redis | ✅ |

---

## 3. Rating

| Dimension | Score (1–5) | Comment |
|-----------|-------------|--------|
| **Security** | 5 | JWT, RBAC, validation, Helmet, CORS, rate limit, env validation. |
| **Scalability** | 5 | Replicas, Redis, BullMQ, stateless design. |
| **Observability** | 5 | Sentry, request ID, health/ready/live, JSON logging. |
| **Reliability** | 5 | Graceful shutdown, health probes, error handling. |
| **Code & architecture** | 5 | Clear modules, shared packages, Prisma, NestJS. |
| **Alignment** | 5 | Frontend and API base URL, auth, and env are aligned. |
| **Testing** | 4 | Good coverage and structure; E2E/load not yet in CI. |
| **Docs & config** | 4 | env.example and deployment docs present; ENTERPRISE_GRADE_REMAINING section 1 could be updated. |

**Overall: 4.75 / 5 — Enterprise-grade.**

The application is **suitable for enterprise use**: security, scalability, observability, and reliability are in place; frontend and API are aligned; only minor cleanup (docs, optional SENTRY_DSN, E2E/load in CI) is recommended.

---

## 4. Recommendations (Priority Order)

1. **Production:** Set `SENTRY_DSN` (and optionally `SENTRY_TRACES_SAMPLE_RATE`) in Railway so errors and performance are tracked.
2. **CI:** Run integration tests (with DB/Redis or `SKIP_INTEGRATION_TESTS=true`) and, if possible, E2E and k6 load tests on main/release branches.
3. **Docs:** In `ENTERPRISE_GRADE_REMAINING.md`, mark section “1. Incomplete / Broken” as done (or remove it) so it matches the Summary table.
4. **Optional:** Re-enable API versioning in main.ts only when you need a second API version; current `/api`-only setup is consistent and fine.
5. **Optional:** Add a short “Production checklist” (env vars, health URLs, Sentry, replicas) to `DEPLOYMENT_CHECKLIST.md` or README for ops.

---

## 5. Summary

- **Status:** Production-ready monorepo with a strong API (NestJS, Prisma, 95+ models, 60+ modules), aligned Next.js web app, shared packages, and Railway deployment with 2 replicas.
- **Enterprise readiness:** Security, RBAC, validation, rate limiting, Sentry, request ID, health/ready/live, graceful shutdown, BullMQ, Redis, and JSON logging are implemented and aligned.
- **Rating:** **4.75 / 5** — enterprise-grade; small improvements (SENTRY_DSN in prod, E2E/load in CI, doc update) will make it even stronger.

---

## 6. Bugs and Gaps (Code Review – Jan 2026)

A full pass over the web app and shared libs was done to find bugs and gaps. Below: **fixed** (addressed in this review), **open** (recommended follow-ups), and **notes** (non-blocking).

### 6.1 Fixed in This Review

| Item | Location | Fix |
|------|----------|-----|
| **Influencer routes unprotected** | `/influencer/*` (dashboard, earnings, profile, product-links, storefront) | Added `apps/web/src/app/influencer/layout.tsx` with `<RouteGuard allowedRoles={['INFLUENCER', 'ADMIN']} showAccessDenied={true}>` so all influencer pages are protected. |
| **Returns page unprotected** | `/returns` | Wrapped page in `<RouteGuard allowedRoles={['CUSTOMER', 'ADMIN']} showAccessDenied={true}>`. |
| **API base URL empty when env invalid** | `lib/apiBaseUrl.ts` | If `NEXT_PUBLIC_API_URL` is set to whitespace, `normalizeApiBaseUrl` returned `''`. Now `getPublicApiBaseUrl()` returns `normalized \|\| fallback` so the app always has a valid base URL. |

### 6.2 Gaps and Recommendations (Open)

| Item | Severity | Notes |
|------|----------|--------|
| **Checkout / Cart without RouteGuard** | Low | `/checkout` and `/cart` do not use RouteGuard. Cart/checkout APIs require auth, so 401 triggers redirect. Adding RouteGuard for CUSTOMER on checkout would avoid a brief flash of checkout UI before redirect. Cart can stay as-is if guest “empty cart” is desired. |
| **Payment page by orderId** | Low | `/payment?orderId=...` loads order by ID. Backend must enforce that the order belongs to the current user (or allow payment-link flow). Frontend does not re-check ownership; rely on API. |
| **Leaderboard** | Low | `/leaderboard` has no RouteGuard. It uses `getLeaderboard()` and `getGamificationProfile()`. If these are public, no change; if they require auth, add RouteGuard. |
| **Track order** | Low | `/track-order` uses `getOrders()` (auth required) to find order by number. Unauthenticated users get 401 and redirect. No RouteGuard; optional to add for CUSTOMER for consistency. |
| **Error handling** | Low | Many `catch (err: any)` blocks use `err.message` or toast; some `.catch(() => ({ data: [] }))` swallow errors. Consider centralizing user-facing error messages and logging. |
| **Type safety** | Low | Several `(v: any)` or `as any` in tables/forms (e.g. admin submissions, checkout). Gradual typing of DTOs and response shapes would reduce risk. |
| **RouteGuard effect deps** | Low | `allowedRoles` is often an inline array; effect runs every render. Idempotent; for perf, parents could memoize `allowedRoles`. |

### 6.3 Non-Blocking Notes

- **Orders list** (`/orders`) and **customer dashboard** use RouteGuard; **downloads**, **wishlist**, **quests** use RouteGuard. No other customer routes missing guard.
- **Admin / seller / wholesaler / catalog / finance / fulfillment / procurement / marketing / cms** areas use RouteGuard per page or layout.
- **AuthContext**: Impersonated role is restored only for ADMIN after `fetchUser`; stored role is validated with `isValidUserRole()`; no `pathname` in RouteGuard effect (avoids random “access denied” on sidebar nav).
- **api-client** validates `baseUrl` at request time and throws if empty; combined with apiBaseUrl fallback, config is robust.
