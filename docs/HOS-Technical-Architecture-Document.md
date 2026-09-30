# House of Spells — Technical Architecture Document

> **Version:** 1.0.0
> **Date:** September 29, 2026
> **Classification:** Internal — Development Team, DevOps, Maintainers
> **Repository:** `hos-marketplace` monorepo (pnpm + Turborepo)

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Repository Structure](#2-repository-structure)
3. [Frontend Architecture](#3-frontend-architecture)
4. [Backend Architecture](#4-backend-architecture)
5. [Database Architecture](#5-database-architecture)
6. [Authentication & Authorization](#6-authentication--authorization)
7. [API Reference](#7-api-reference)
8. [Payment System](#8-payment-system)
9. [Loyalty System Technical Design](#9-loyalty-system-technical-design)
10. [POS Integration — Lightspeed](#10-pos-integration--lightspeed)
11. [Accounting — Xero Integration](#11-accounting--xero-integration)
12. [Shipping & Logistics](#12-shipping--logistics)
13. [Search Architecture](#13-search-architecture)
14. [Caching & Queue Architecture](#14-caching--queue-architecture)
15. [File Storage](#15-file-storage)
16. [Messaging & Notifications](#16-messaging--notifications)
17. [Integrations Framework](#17-integrations-framework)
18. [Monitoring & Observability](#18-monitoring--observability)
19. [Security](#19-security)
20. [DevOps & Deployment](#20-devops--deployment)
21. [Testing Strategy](#21-testing-strategy)
22. [Feature Flags & Configuration](#22-feature-flags--configuration)
23. [Appendices](#appendices)

---

## 1. System Overview

### 1.1 Architecture Summary

House of Spells (HOS) Marketplace is a **multi-vendor, multi-tenant, multi-market e-commerce platform** built around the fandom merchandise niche. The platform supports B2C sellers, wholesalers, influencers, brand partners, and multiple internal staff roles — all managed from a single TypeScript monorepo.

**Key Architectural Characteristics:**
- Multi-vendor marketplace with seller storefronts and custom subdomains
- Multi-tenant architecture (Tenant → Store → User scoping)
- Multi-market selling (US, GB, AE, MY with per-market pricing and currency)
- Fandom-centric product taxonomy with gamification layer
- Loyalty programme ("The Enchanted Circle") with omnichannel earn/burn
- Influencer programme with storefronts, referral tracking, and commission engine
- POS integration (Lightspeed) bridging physical retail with the online platform
- Full back-office with role-based staff portals

### 1.2 High-Level Architecture Diagram

```mermaid
graph TB
    subgraph Clients
        WEB["Next.js Web App<br/>shop.houseofspells.com"]
        LANDING["Landing Site<br/>houseofspells.com"]
        SUBDOMAIN["Seller Subdomains<br/>{slug}.houseofspells.com"]
        JOIN["Loyalty Join<br/>join.houseofspells.com"]
    end

    subgraph CDN["Cloudflare CDN"]
        CF["Edge Cache + WAF"]
    end

    subgraph Railway["Railway Platform"]
        subgraph API_SERVICE["API Service (NestJS)"]
            CORS["CORS"] --> HELMET["Helmet"] --> COOKIE["Cookie Parser"]
            COOKIE --> CSRF["CSRF Guard"] --> COMPRESS["Compression"]
            COMPRESS --> REQID["Request ID"] --> CORR["Correlation ID"]
            CORR --> JWT_GUARD["JWT Auth Guard"] --> ACCESS["Access Guard"]
            ACCESS --> MONITOR["Monitoring Interceptor"] --> ACTIVITY["Activity Interceptor"]
            ACTIVITY --> CONTROLLERS["90+ Module Controllers"]
        end

        subgraph DATA["Data Layer"]
            PG["PostgreSQL 15<br/>175 Prisma Models"]
            REDIS["Redis 7<br/>Cache + Queues"]
            MEILI["Meilisearch v1.11<br/>Full-text Search"]
        end
    end

    subgraph External["External Services"]
        STRIPE["Stripe<br/>Payments + Connect"]
        S3["AWS S3<br/>File Storage"]
        CLOUD["Cloudinary<br/>Image CDN"]
        SMTP["SMTP<br/>Email (Nodemailer)"]
        TWILIO["Twilio<br/>SMS + WhatsApp"]
        SENTRY["Sentry<br/>Error Tracking"]
        OTEL["OpenTelemetry<br/>Tracing"]
        LS["Lightspeed<br/>POS System"]
        XERO["Xero<br/>Accounting"]
        SHIPPO["Shippo<br/>Shipping Labels"]
    end

    WEB --> CF
    LANDING --> CF
    SUBDOMAIN --> CF
    JOIN --> CF
    CF --> API_SERVICE
    CONTROLLERS --> PG
    CONTROLLERS --> REDIS
    CONTROLLERS --> MEILI
    CONTROLLERS --> STRIPE
    CONTROLLERS --> S3
    CONTROLLERS --> CLOUD
    CONTROLLERS --> SMTP
    CONTROLLERS --> TWILIO
    CONTROLLERS --> SENTRY
    CONTROLLERS --> OTEL
    CONTROLLERS --> LS
    CONTROLLERS --> XERO
    CONTROLLERS --> SHIPPO
```

### 1.3 Tech Stack Matrix

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| **Monorepo** | pnpm workspaces | 10.28.2 | Package management |
| **Build** | Turborepo | ^1.11.2 | Build orchestration |
| **Language** | TypeScript | ^5.3.3 | Type-safe development |
| **Runtime** | Node.js | >=20.9.0 | Server runtime |
| **Frontend** | Next.js (App Router) | ^14.2.35 | SSR/SSG React framework |
| **UI** | React | ^18.3.1 | Component library |
| **Styling** | Tailwind CSS | ^3.4.0 | Utility-first CSS |
| **State** | TanStack React Query | ^5.90.21 | Server state management |
| **Backend** | NestJS | ^10.3.0 | Enterprise Node.js framework |
| **ORM** | Prisma | ^6.0.0 | Type-safe database client |
| **Database** | PostgreSQL | 15-alpine | Relational database |
| **Cache/Queue** | Redis | 7-alpine | Caching + BullMQ jobs |
| **Search** | Meilisearch | v1.11 | Full-text search engine |
| **Payments** | Stripe SDK | ^14.9.0 | Payment processing |
| **Auth** | Passport.js | ^0.7.0 | Authentication strategies |
| **JWT** | @nestjs/jwt | ^10.2.0 | Token management |
| **File Storage** | AWS S3 SDK | ^3.490.0 | Object storage |
| **Image CDN** | Cloudinary | ^2.8.0 | Image transformation |
| **Email** | Nodemailer | ^9.0.1 | SMTP email delivery |
| **SMS** | Twilio | ^5.4.0 | SMS/WhatsApp messaging |
| **Monitoring** | Sentry | ^7.18.0 | Error tracking |
| **Tracing** | OpenTelemetry | ^0.222.0 | Distributed tracing |
| **API Docs** | Swagger (OpenAPI) | ^7.1.17 | API documentation |
| **Rate Limit** | @nestjs/throttler | ^5.0.1 | Request throttling |
| **Security** | Helmet | ^7.1.0 | HTTP security headers |
| **Validation** | class-validator | ^0.14.0 | DTO validation |
| **PDF** | PDFKit | ^0.14.0 | Invoice generation |
| **Excel** | ExcelJS | ^4.4.0 | Data export |
| **Testing** | Jest + Supertest | ^29.7.0 | Unit/integration tests |
| **E2E** | Playwright | ^1.57.0 | Browser automation tests |

### 1.4 Production Domain Model

| Service | Domain | Purpose |
|---------|--------|---------|
| Main Website / Landing | `houseofspells.com` | Landing pages, gallery, experiences |
| Marketplace / Shop | `shop.houseofspells.com` | Product catalog, checkout, seller storefronts |
| Loyalty Join | `join.houseofspells.com` | Loyalty programme enrollment |
| Seller Storefronts | `{slug}.houseofspells.com` | Individual seller shops |
| API (internal) | `api.houseofspells.com` | Backend REST API |
| Business Email | `app@houseofspells.co.uk` | Business communications |

> **Note:** Railway-generated URLs (`*.up.railway.app`) are used only for CI health checks and internal deployment documentation, never in user-facing code.

---

## 2. Repository Structure

### 2.1 Complete Monorepo Layout

```
hos-marketplace/
├── apps/
│   └── web/                          # Next.js 14 frontend (App Router)
│       ├── src/
│       │   ├── app/                  # ~353 route directories
│       │   ├── components/           # ~89 shared React components
│       │   ├── lib/                  # API client, auth, utilities
│       │   └── middleware.ts         # Edge middleware pipeline
│       ├── public/                   # Static assets
│       ├── next.config.mjs           # Next.js configuration
│       └── package.json
│
├── packages/
│   ├── shared-types/                 # @hos-marketplace/shared-types
│   │   └── src/                      # TypeScript types, enums, interfaces
│   ├── api-client/                   # @hos-marketplace/api-client
│   │   └── src/                      # Typed REST client for frontend
│   ├── utils/                        # @hos-marketplace/utils
│   │   └── src/                      # Common utility functions
│   ├── theme-system/                 # @hos-marketplace/theme-system
│   │   └── src/                      # Seller storefront theming engine
│   ├── cms-client/                   # @hos-marketplace/cms-client
│   │   └── src/                      # Strapi CMS client
│   ├── events/                       # @hos-marketplace/events
│   │   └── src/                      # Event-driven microservice contracts
│   └── observability/                # @hos-marketplace/observability
│       └── src/                      # Sentry integration utilities
│
├── services/
│   └── api/                          # @hos-marketplace/api (NestJS backend)
│       ├── src/
│       │   ├── main.ts               # Bootstrap, middleware, security
│       │   ├── app.module.ts         # Root module (90+ imports)
│       │   ├── auth/                 # Authentication module
│       │   ├── access-control/       # RBAC + permission system
│       │   ├── common/               # Guards, filters, interceptors, middleware
│       │   ├── payments/             # Stripe integration
│       │   ├── pos/                  # Lightspeed POS
│       │   ├── accounting/           # Xero integration
│       │   ├── loyalty/              # Enchanted Circle loyalty
│       │   ├── shipping/             # Multi-carrier shipping
│       │   ├── meilisearch/          # Search engine integration
│       │   ├── queue/                # BullMQ job processing
│       │   ├── cache/                # Redis cache layer
│       │   ├── storage/              # S3 + Cloudinary
│       │   ├── notifications/        # Multi-channel notifications
│       │   ├── email/                # Email service
│       │   ├── whatsapp/             # WhatsApp Business
│       │   ├── integrations/         # Third-party provider framework
│       │   ├── monitoring/           # Health checks + metrics
│       │   ├── telemetry/            # OpenTelemetry tracing
│       │   └── [60+ domain modules]
│       ├── prisma/
│       │   ├── schema.prisma         # 175 models, 5147 lines
│       │   ├── migrations/           # Prisma migration history
│       │   └── seeds/                # Database seed scripts
│       ├── test/                     # E2E tests
│       ├── scripts/                  # Deployment & verification scripts
│       ├── docker-entrypoint.sh      # Container startup script
│       └── docker-migrate.sh         # Migration runner
│
├── infrastructure/
│   └── database/
│       ├── init-schemas.sh           # PostgreSQL schema initialization
│       └── README.md                 # Database documentation
│
├── docs/                             # 43 documentation files
├── scripts/                          # Root-level scripts
├── .github/
│   └── workflows/                    # CI/CD pipelines
│       ├── ci.yml                    # Lint, test, build
│       ├── deploy.yml                # Production deploy
│       ├── deploy-staging.yml        # Staging deploy
│       └── secret-scan.yml           # Gitleaks secret scanning
│
├── package.json                      # Root workspace config
├── pnpm-workspace.yaml               # Workspace + dependency overrides
├── turbo.json                        # Turborepo pipeline config
├── Dockerfile                        # API multi-stage build
├── docker-compose.yml                # Local development stack
├── railway.toml                      # Railway deployment config
└── .npmrc                            # pnpm configuration
```

### 2.2 Workspace Configuration

**`pnpm-workspace.yaml`:**
```yaml
packages:
  - apps/*
  - packages/*
  - services/api

onlyBuiltDependencies:
  - prisma
  - '@prisma/client'
  - '@prisma/engines'
  - bcrypt
  - sharp

overrides:
  axios: ^1.18.1
  sharp: ^0.35.0
  nodemailer: ^9.0.1
  # ... 15 security pins for transitive dependencies
```

### 2.3 Package Dependency Graph

```mermaid
graph TD
    WEB["apps/web<br/>@hos-marketplace/web"] --> ST["packages/shared-types"]
    WEB --> AC["packages/api-client"]
    WEB --> UT["packages/utils"]
    WEB --> TS["packages/theme-system"]

    API["services/api<br/>@hos-marketplace/api"] --> ST
    API --> UT

    AC --> ST
    TS --> ST
```

### 2.4 Build Pipeline (`turbo.json`)

```json
{
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "dist/**", "build/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": { "dependsOn": ["^lint"] },
    "test": {
      "dependsOn": ["^build"],
      "outputs": ["coverage/**"]
    },
    "type-check": { "dependsOn": ["^type-check"] },
    "clean": { "cache": false }
  }
}
```

Build order (enforced by `dependsOn: ["^build"]`):
1. `packages/shared-types` → 2. `packages/utils` → 3. `packages/api-client` + `packages/theme-system` + `packages/cms-client` → 4. `services/api` (Prisma generate + NestJS build) → 5. `apps/web` (Next.js build)

### 2.5 Docker Build (Multi-Stage)

The `Dockerfile` uses a single-stage `node:20-slim` image with layered caching:

1. **Layer 1:** Workspace config + lockfile (rarely changes)
2. **Layer 2:** `package.json` files only (cached unless deps change)
3. **Layer 3:** `pnpm install --frozen-lockfile`
4. **Layer 4:** Source code copy + sequential package builds
5. **Layer 5:** Strip build tools, dev artifacts, `.ts` sources

Non-root user `appuser:nodejs` runs the container. Entrypoint: `docker-entrypoint.sh` (runs migrations, then `node dist/main.js`).

---

## 3. Frontend Architecture

### 3.1 Next.js App Router Structure

The web application uses Next.js 14 with the App Router pattern. There are approximately **353 route directories** organized into these major sections:

| Route Group | Path Prefix | Description | Routes |
|-------------|-------------|-------------|--------|
| Landing | `/(landing)/` | Experience, gallery, universes, founding members | ~8 |
| Auth | `/auth/` | Login, register, verify-email, reset-password, callback | ~6 |
| Customer | `/customer/`, `/profile/`, `/account/` | Dashboard, orders, addresses, change-password | ~8 |
| Products | `/products/`, `/fandoms/`, `/collections/` | Product listing, detail, fandom browse, collections | ~10 |
| Shopping | `/cart/`, `/checkout/`, `/payment/` | Cart, checkout flow, payment processing | ~4 |
| Orders | `/orders/`, `/returns/`, `/track-order/` | Order history, returns, tracking | ~6 |
| Loyalty | `/loyalty/` | Join, card, rewards, redeem, referral, ambassador, history | ~12 |
| Events | `/events/` | Event listing, detail, check-in, my-events | ~5 |
| Seller | `/seller/` | Dashboard, products, orders, submissions, analytics, onboarding | ~14 |
| Wholesaler | `/wholesaler/` | Dashboard, products, bulk upload, submissions | ~12 |
| Influencer | `/influencer/` | Dashboard, earnings, storefront, product-links | ~6 |
| Admin | `/admin/` | 80+ admin pages (users, products, orders, finance, etc.) | ~120 |
| Procurement | `/procurement/` | Dashboard, submissions review | ~3 |
| Fulfillment | `/fulfillment/` | Shipments, centers, dashboard | ~5 |
| Catalog | `/catalog/` | Entries, duplicates, dashboard | ~4 |
| Marketing | `/marketing/` | Dashboard, campaigns, materials | ~4 |
| Finance | `/finance/` | Dashboard, pricing, payouts, reports | ~7 |
| CMS | `/cms/` | Blog, pages, banners, media, settings | ~10 |
| Store Staff | `/store/` | Enrollment, shipping backoffice, pending queue | ~8 |
| Ship (SFS) | `/ship/` | Lookup, request, claim flow for ship-from-store | ~6 |
| Blog | `/blog/` | Public blog listing, categories, post detail | ~4 |
| Support | `/support/` | Tickets, knowledge base, new ticket | ~6 |
| Quiz | `/quiz/` | Fandom quizzes | ~2 |
| API Routes (BFF) | `/api/` | Proxy, health, meta, cms/revalidate, loyalty-status, shop-status | ~10 |
| Static Pages | Various | Terms, privacy, refund policy, shipping, help, etc. | ~10 |

### 3.2 Middleware Pipeline

The Next.js edge middleware (`apps/web/src/middleware.ts`) implements a multi-stage pipeline:

```mermaid
graph LR
    REQ["Incoming Request"] --> CSP["1. CSP Nonce<br/>Generation"]
    CSP --> PREVIEW["2. Preview<br/>Revoke/Unlock"]
    PREVIEW --> AUTH["3. Auth<br/>Protection"]
    AUTH --> SHOP["4. Shop Gate<br/>(coming-soon)"]
    SHOP --> REF["5. Referral<br/>Attribution"]
    REF --> SUB["6. Subdomain<br/>Routing"]
    SUB --> RES["Response"]
```

**Middleware stages:**

1. **CSP Nonce** — Generates per-request cryptographic nonce; sets `x-nonce` header and `Content-Security-Policy` (allows Stripe, GA, GTM, Meta Pixel, Cloudinary, OpenStreetMap)
2. **Preview Revoke/Unlock** — `?preview=off` clears `hos_shop_preview` cookie; valid `?preview=<SECRET>` sets HttpOnly preview cookie and redirects to `/shop`
3. **Auth Protection** — Reads `access_token` or `refresh_token` cookie; unauthenticated users on protected prefixes → `/login?returnUrl=...` or `/coming-soon` if shop gated
4. **Shop Soft-Launch Gate** — Gated commerce paths redirect to `/coming-soon` unless shop is open or preview access granted. **Asymmetric control**: only deploy-time `NEXT_PUBLIC_SHOP_ENABLED=true` can *open* the shop; admin API (`/config/shop-enabled`) can *close* it without redeploy (5s cache)
5. **Referral Attribution** — `/ref/[code]` sets `hos_ref` and optional `hos_utm` cookies for loyalty/partner/influencer tracking
6. **Subdomain Routing** — `{slug}.houseofspells.com` rewrites to `/sellers/{slug}`; `join.houseofspells.com` rewrites to `/loyalty/join`

**Protected route prefixes (25):** `/admin`, `/seller`, `/wholesaler`, `/influencer`, `/procurement`, `/fulfillment`, `/catalog`, `/marketing`, `/finance`, `/cms`, `/customer`, `/store`, `/profile`, `/account`, `/orders`, `/purchases`, `/wishlist`, `/loyalty` (except `/loyalty/join`), `/quests`, `/downloads`, `/notifications`, `/support/tickets`, `/payment`, `/gift-cards`

**Shop-gated prefixes:** `/shop`, `/products`, `/fandoms`, `/cart`, `/checkout`, `/collections`, `/sellers`, `/gift-cards`, `/wishlist`, `/payment`, `/order-confirmation`

### 3.3 Client-Side Authentication

**Three-Layer Auth Protection:**

```
┌─────────────────────────────────────────────────────────────┐
│ Layer 1: Middleware (server-side, edge)                      │
│ Checks access_token OR refresh_token HttpOnly cookies       │
│ Redirects unauthenticated users from protected prefixes     │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ Layer 2: AuthContext (client-side)                           │
│ Reads is_logged_in cookie → calls GET /auth/me              │
│ Loads access control profile, market scoping, role switch   │
│ 20-minute inactivity logout · cookie polling every 5s       │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ Layer 3: RouteGuard (client-side, per-layout)               │
│ Role + permission checks; redirects to role dashboard       │
│ Admin impersonation via localStorage admin_impersonated_role│
└─────────────────────────────────────────────────────────────┘
```

**AuthContext** (`apps/web/src/contexts/AuthContext.tsx`):
- Fetches user via `apiClient.getCurrentUser()` on mount
- Sets `is_logged_in` cookie after successful validation
- Cleans legacy `localStorage` tokens
- Admin role impersonation via `localStorage.admin_impersonated_role`
- Access control profile — permissions, markets, active market reconciliation
- **20-minute inactivity logout** timer
- Cookie polling every 5s to detect session loss (e.g., another tab logged out)

**ApiClient Auth** (`packages/api-client/src/client.ts`):
- All requests use `credentials: 'include'` for cookie attachment
- On 401: attempts `POST /auth/refresh` once (requires `is_logged_in` cookie)
- Production client hits `/api/proxy/[...path]` (same-origin) to avoid third-party cookie blocking
- Sends `x-market-code` header from localStorage

### 3.4 State Management

**TanStack React Query (v5):**
- All server state managed via `useQuery`, `useMutation`, `useInfiniteQuery`
- Query keys namespaced by domain (e.g., `['products', id]`, `['orders', { status }]`)
- Stale time configured per-domain (products: 5min, cart: 30s, notifications: 1min)
- Optimistic updates for cart operations, wishlist toggles
- Prefetching on hover for product detail pages
- Infinite scroll for product listings via `useInfiniteQuery`

### 3.5 Component Library

The frontend contains approximately **89 shared components** organized by domain:

| Category | Components | Examples |
|----------|-----------|----------|
| Layout | 8 | `Header`, `Footer`, `Sidebar`, `DashboardLayout`, `PageHeader` |
| Navigation | 5 | `Breadcrumbs`, `TabNav`, `MobileMenu`, `RoleSwitcher`, `Navbar` |
| Product | 12 | `ProductCard`, `ProductGrid`, `ProductDetail`, `VariantSelector`, `ImageGallery` |
| Cart/Checkout | 8 | `CartDrawer`, `CartItem`, `CheckoutForm`, `AddressForm`, `PaymentForm` |
| Forms | 10 | `Input`, `Select`, `Textarea`, `FileUpload`, `DatePicker`, `SearchInput` |
| Data Display | 12 | `DataTable`, `Pagination`, `Badge`, `StatusBadge`, `StatCard`, `Chart` |
| Feedback | 6 | `Toast`, `Modal`, `ConfirmDialog`, `LoadingSpinner`, `EmptyState`, `ErrorBoundary` |
| Auth | 5 | `LoginForm`, `RegisterForm`, `RouteGuard`, `RoleGate`, `ProtectedRoute` |
| Loyalty | 8 | `LoyaltyCard`, `TierBadge`, `PointsDisplay`, `RewardCard`, `ReferralLink` |
| Admin | 15 | `AdminTable`, `AdminFilters`, `AdminChart`, `SettingsPanel`, various dashboards |

### 3.6 Theme System

The `@hos-marketplace/theme-system` package provides seller storefront customization:

- **Built-in themes:** `hos-default`, `customer-light`, `customer-dark`, `customer-accessibility`
- **Seller templates:** Minimal, Modern, Classic, Bold — each with distinct color palettes
- **Default look:** Dark luxury — gold `#D4A847` on `#0D0D0D` background, Cinzel + Lora fonts

**CSS Variable Flow:**
```
Theme object → ThemeSwitcher.apply()
  → document.documentElement.style.setProperty('--color-*')
    → Tailwind/globals.css consumes hos-* and --color-* tokens
```

**Package exports:**
- `ThemeProvider` / `useTheme()` / `useThemeActions()` — React context
- `ThemeSwitcher` — Imperative class for runtime CSS variable updates
- `themeToCSSVariables()` / `mergeTheme()` / `isValidTheme()` — utilities
- `normalizeApiTheme()` — Converts API `config`-nested themes to client `Theme` shape

**Web integration:**
- `ThemeProviderWrapper` loads seller themes from API via `apiClient.getTheme()`
- `ThemeLoader` applies brand colors while preserving dark surface tokens (prevents FOUC)
- Persists built-in theme IDs only (no arbitrary theme persistence)
- **Live preview:** Admin UI for real-time theme editing

### 3.7 BFF API Routes

The frontend includes several Backend-for-Frontend API routes:

| Route | Purpose |
|-------|---------|
| `/api/proxy/[...path]` | Proxies all API calls, attaching HttpOnly cookies |
| `/api/health/live` | Frontend liveness probe |
| `/api/meta/events` | Server-side event metadata |
| `/api/cms/revalidate` | On-demand ISR revalidation webhook |
| `/api/loyalty-status` | Quick loyalty membership check |
| `/api/shop-status` | Shop gate status for middleware |

---

## 4. Backend Architecture

### 4.1 NestJS Module Structure

The API consists of **90+ NestJS modules** registered in `AppModule`. Listed alphabetically with grouping:

**Core Infrastructure:**
| Module | Purpose |
|--------|---------|
| `AccessControlModule` | RBAC permission system, role assignments |
| `ActivityModule` | User/system activity audit logging |
| `AdminModule` | Admin dashboard, user management, migrations |
| `CacheModule` | Redis cache manager integration |
| `ConfigModule` | Environment variable management (global) |
| `DatabaseModule` | Prisma client, connection management |
| `FeatureFlagsModule` | Runtime feature flag management |
| `LoggerModule` | Custom structured logging |
| `MonitoringModule` | Health checks, metrics endpoint |
| `PlatformRegionModule` | Multi-market region configuration |
| `QueueModule` | BullMQ job queue setup |
| `RateLimitModule` | Request throttling (@nestjs/throttler) |
| `ScheduleModule` | Cron job scheduling |
| `StorageModule` | S3 + Cloudinary file storage |
| `TenantsModule` | Multi-tenant organization management |

**Commerce Core:**
| Module | Purpose |
|--------|---------|
| `ProductsModule` | Product CRUD, variants, bundles, volume pricing |
| `OrdersModule` | Order lifecycle, multi-vendor splitting, fulfillment routing |
| `CartModule` | Cart management, guest carts, coupon application |
| `CancellationsModule` | Order cancellation workflow (seller → finance → admin) |
| `PaymentsModule` | Stripe payment intents, webhooks, Connect splits |
| `CheckoutModule` | Checkout orchestration, tax calculation |
| `CurrencyModule` | Multi-currency exchange rates |
| `GiftCardsModule` | Digital/physical gift cards, transactions |
| `PromotionsModule` | Promotions engine, coupons, automatic discounts |
| `ProcurementModule` | Product submission review pipeline |
| `FulfillmentModule` | Fulfillment center management, routing |
| `CatalogModule` | Catalog entry management |
| `InventoryModule` | Multi-warehouse inventory, stock movements |
| `ShippingModule` | Shipping methods, rules, rate calculation |
| `CourierModule` | Carrier management (FedEx, Shippo) |
| `TaxModule` | Tax zones, classes, rates, provider factory |
| `ReturnPoliciesModule` | Configurable return policies |
| `ReturnsModule` | Return request processing |
| `InvoicesModule` | PDF invoice generation |

**Seller/Vendor:**
| Module | Purpose |
|--------|---------|
| `SellersModule` | Seller CRUD, onboarding, Stripe Connect |
| `SubmissionsModule` | Product submission workflow |
| `VendorProductsModule` | Vendor-specific product listings |
| `VendorLedgerModule` | Financial audit trail per vendor |
| `SettlementsModule` | Seller payout settlement engine |
| `DuplicatesModule` | Cross-seller duplicate detection |
| `DomainsModule` | Custom domain management |

**User & Customer:**
| Module | Purpose |
|--------|---------|
| `AuthModule` | Authentication (JWT, OAuth, local) |
| `UsersModule` | User CRUD, profile management |
| `AddressesModule` | Shipping/billing address management |
| `CustomerGroupsModule` | Customer segmentation (VIP, wholesale, etc.) |
| `ReviewsModule` | Product review system |
| `WishlistModule` | User wishlist |
| `NotificationsModule` | In-app notification management |

**Loyalty & Engagement:**
| Module | Purpose |
|--------|---------|
| `LoyaltyModule` | Enchanted Circle: tiers, earn rules, redemptions, POS vouchers |
| `LoyaltyAnalyticsModule` | CLV, attribution, tier distribution analytics |
| `AmbassadorModule` | Ambassador programme, UGC submissions |
| `BrandPartnershipsModule` | Brand campaigns, partner points funding |
| `PartnerReferralsModule` | External referral partner tracking |
| `GamificationModule` | Points, levels, leaderboards |
| `BadgesModule` | Achievement badges |
| `QuestsModule` | Fandom quests and challenges |
| `QuizModule` | Fandom knowledge quizzes |
| `EventsModule` | Event management, RSVP, attendance |
| `FoundingMembersModule` | Founding member registration |
| `ReferralsModule` | Influencer referral tracking |

**Influencer:**
| Module | Purpose |
|--------|---------|
| `InfluencersModule` | Influencer profile management |
| `InfluencerInvitationsModule` | Invitation-only onboarding |
| `InfluencerStorefrontsModule` | Custom storefront builder |
| `InfluencerCommissionsModule` | Commission calculation & tracking |
| `InfluencerPayoutsModule` | Payout management |
| `InfluencerCampaignsModule` | Campaign management with override rates |

**Content & Marketing:**
| Module | Purpose |
|--------|---------|
| `CMSModule` | CMS pages, banners, content blocks |
| `BlogModule` | Blog posts, categories, SEO |
| `CollectionsModule` | Curated product collections |
| `MarketingModule` | Marketing materials, campaigns |
| `PublishingModule` | Product publishing pipeline |
| `NewsletterModule` | Newsletter subscriptions |
| `TemplatesModule` | Email/notification template management |
| `JourneyModule` | Marketing automation journeys |
| `SegmentationModule` | Audience segment engine |

**Communication:**
| Module | Purpose |
|--------|---------|
| `EmailModule` | Email sending (Nodemailer), campaign broadcasts |
| `WhatsAppModule` | WhatsApp Business API integration |
| `SupportModule` | Support tickets, knowledge base, chatbot |
| `ChannelsModule` | Channel management (web, POS, mobile) |

**Taxonomy & Discovery:**
| Module | Purpose |
|--------|---------|
| `TaxonomyModule` | Categories, attributes, tags |
| `FandomsModule` | Fandom management |
| `CharactersModule` | Character profiles for AI chat |
| `AIModule` | AI-powered chat assistance |
| `MeilisearchModule` | Search index management |
| `DepartmentsModule` | Storefront department sections |
| `NavigationModule` | Admin-managed navigation menus |
| `UniversesModule` | Franchise universe branding |
| `TestimonialsModule` | Customer testimonials |
| `GalleryModule` | Photo gallery albums |

**Operations:**
| Module | Purpose |
|--------|---------|
| `PosModule` | Lightspeed POS: OAuth, sync, sales import |
| `AccountingModule` | Xero: OAuth, journal generation, COA mapping |
| `IntegrationsModule` | Provider registry, credential encryption |
| `StoreAdminModule` | Physical store management |
| `StoreShipmentModule` | Ship-from-store workflow |
| `ClickCollectModule` | Click & collect order management |
| `LogisticsModule` | Logistics partner management |
| `WebhooksModule` | Webhook management and delivery |
| `UploadsModule` | File upload handling (Multer) |

**Compliance:**
| Module | Purpose |
|--------|---------|
| `GDPRModule` | GDPR consent management, data export/deletion |
| `ComplianceModule` | Regulatory compliance checks |
| `GeolocationModule` | IP-based country detection |
| `DiscrepanciesModule` | Financial discrepancy tracking |
| `SocialSharingModule` | Social share tracking (loyalty points) |
| `DigitalProductsModule` | Digital product delivery |
| `PerformanceModule` | Performance metrics |
| `AnalyticsModule` | Platform analytics |
| `ThemesModule` | Theme management |

### 4.2 Request Pipeline

Every HTTP request passes through this middleware/guard/interceptor stack:

```
Client Request
    │
    ├─ 1. OPTIONS Preflight Handler (manual CORS, 204)
    ├─ 2. Helmet Security Headers (CSP, HSTS, X-Frame-Options, etc.)
    ├─ 3. Cookie Parser (req.cookies populated)
    ├─ 4. CSRF Origin Check (state-changing requests validate Origin header)
    ├─ 5. Response Compression (gzip/deflate)
    ├─ 6. Request ID Middleware (X-Request-ID header, Sentry tag)
    ├─ 7. Body Parser (10MB limit, raw body for Stripe webhooks)
    │
    ├─ NestJS Middleware Layer:
    │   └─ 8. CorrelationIdMiddleware (propagate/generate correlation ID via ALS)
    │
    ├─ Global Guards:
    │   ├─ 9. JwtAuthGuard (extract & verify JWT from cookie/header; @Public() bypasses)
    │   └─ 10. AccessGuard (RBAC check: role + permission + market scoping)
    │
    ├─ Controller Route Handler
    │
    ├─ Global Interceptors:
    │   ├─ 11. MonitoringInterceptor (request timing, Sentry spans)
    │   ├─ 12. ActivityInterceptor (audit log for state changes)
    │   └─ 13. PaginationCapInterceptor (cap page size to prevent runaway queries)
    │
    ├─ Global Pipes:
    │   └─ 14. ValidationPipe (whitelist, forbidNonWhitelisted, transform)
    │
    └─ Global Filters:
        └─ 15. SentryExceptionFilter (capture HTTP exceptions to Sentry, drop 4xx)
```

### 4.3 Global Guards

**JwtAuthGuard** (`common/guards/jwt-auth.guard.ts`):
- Extends `AuthGuard('jwt')` from `@nestjs/passport`
- Checks for `@Public()` decorator — skips validation for public endpoints
- Extracts JWT from `access_token` cookie first, then `Authorization: Bearer` header
- Validates token signature, expiry, and `tokenVersion` against database
- Populates `req.user` with decoded payload

**AccessGuard** (`access-control/access.guard.ts`):
- Runs after `JwtAuthGuard` (requires `req.user`)
- Reads `@Roles()` and `@Permissions()` decorators from handler metadata
- Checks user's role assignments (global, market, tenant, store scoped)
- Supports legacy mode (`UserRole` enum check) and hybrid mode (permission-based)
- Market scoping: validates user has access to the requested market context
- Configurable per-module via `ACCESS_CONTROL_MODULE_MODES` env var

### 4.4 Global Interceptors

**MonitoringInterceptor:**
- Records request start time
- Creates Sentry transaction span for the route
- Logs response status and duration
- Tags slow requests (>3s) for monitoring

**ActivityInterceptor:**
- Intercepts POST, PUT, PATCH, DELETE requests
- Logs activity to `ActivityLog` table with:
  - User ID, action, entity type/ID, description
  - Before/after state diff for updates
  - IP address, user agent

**PaginationCapInterceptor:**
- Caps `limit`/`pageSize` query parameters to 100
- Prevents accidental or malicious unbounded queries

### 4.5 Error Handling

**SentryExceptionFilter:**
- Global exception filter registered via `app.useGlobalFilters()`
- Captures all unhandled exceptions to Sentry
- Drops 4xx client errors (not actionable)
- Preserves original HTTP exception response format
- Tags exceptions with correlation ID and request context

### 4.6 API Versioning & Documentation

**Versioning:**
- URI-based versioning: `/api/v1/` prefix
- Default version: `VERSION_NEUTRAL` + `'1'`
- Global prefix: `/api`

**Swagger/OpenAPI:**
- Available at `/api/docs` (dev) or `/api/docs-{SWAGGER_DOCS_TOKEN}` (production)
- Protected by HTTP Basic Auth in production
- Tags: `auth`, `products`, `orders`, `cart`, `users`, `admin`, `sellers`, `health`
- JWT Bearer authentication scheme configured
- Operations sorted alphabetically

---

## 5. Database Architecture

### 5.1 PostgreSQL Schema Overview

The database uses **PostgreSQL 15** managed through **Prisma 6** ORM with **175 models** across 5,147 lines of schema definition.

**Generator Configuration:**
```prisma
generator client {
  provider      = "prisma-client-js"
  binaryTargets = ["native", "debian-openssl-3.0.x"]
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

### 5.2 All 175 Prisma Models by Domain

#### Identity & Access (11 models)
| Model | Key Fields | Purpose |
|-------|-----------|---------|
| `User` | id, email, password, role, tokenVersion, homeMarketId, permissionRoleId | Core user identity |
| `Customer` | userId, loyaltyPoints, companyName, vatNumber | Customer profile extension |
| `OAuthAccount` | userId, provider, providerId, accessToken | Social login accounts |
| `RefreshToken` | userId, tokenHash, expiresAt, revokedAt | JWT refresh token rotation |
| `PermissionRole` | name, permissions (JSON), scopeKind | Custom RBAC roles |
| `UserRoleAssignment` | userId, permissionRoleId, scopeType, scopeId | Scoped role assignments |
| `SellerInvitation` | email, sellerType, token, status, expiresAt | Seller onboarding invitations |
| `InfluencerInvitation` | email, token, baseCommissionRate | Influencer onboarding invitations |
| `FoundingMember` | email, firstName, fandoms, status, userId | Early adopter registration |
| `GDPRConsentLog` | userId, email, consentType, consentSource, granted | GDPR consent tracking |
| `PlatformSetting` | category, key, value | Platform-wide key-value config |

#### Multi-Tenancy & Markets (6 models)
| Model | Key Fields | Purpose |
|-------|-----------|---------|
| `Tenant` | name, domain, subdomain, config | Top-level organization |
| `TenantUser` | tenantId, userId, role | User ↔ Tenant membership |
| `Store` | tenantId, sellerId, marketId, code, storeType | Physical/virtual store |
| `Config` | level, levelId, key, value | Hierarchical configuration |
| `Market` | code (ISO), currency, locale, timezone | Selling region (US/GB/AE/MY) |
| `StoreOnboardingChecklist` | storeId, steps (JSON), status | Store setup progress |

#### Product Catalog (17 models)
| Model | Key Fields | Purpose |
|-------|-----------|---------|
| `Product` | name, slug, sku, barcode, price, status, productType | Core product entity |
| `ProductImage` | productId, url, alt, order, type | Product media |
| `ProductVariation` | productId, name, options (JSON) | Size/color/etc variations |
| `ProductBundleItem` | bundleProductId, productId, quantity | Bundle composition |
| `ProductPricing` | productId, basePrice, hosMargin, finalPrice | Finance-approved pricing |
| `ProductAttribute` | productId, attributeId, textValue/numberValue | Dynamic product attributes |
| `ProductTag` | productId, tagId | Product ↔ Tag junction |
| `ProductView` | productId, sessionId, userId, referrer | View analytics |
| `ProductMarket` | productId, marketId, priceOverride, currency | Per-market pricing |
| `ProductChannel` | productId, channelType, storeId, sellingPrice | Channel-specific pricing |
| `ProductSubmission` | sellerId, productData, status, version | Seller submission pipeline |
| `ProductCampaign` | name, startsAt, endsAt, productIds, bonusPoints | Product-level promotions |
| `VendorProduct` | sellerId, productId, vendorPrice, status | Vendor catalog listing |
| `VolumePricing` | productId, minQuantity, discountType, discountValue | Quantity-based pricing |
| `DuplicateProduct` | submissionId, existingProductId, similarityScore | Duplicate detection |
| `CatalogEntry` | submissionId, title, description, keywords | Catalog copywriting |
| `MarketingMaterial` | submissionId, type, url | Campaign assets |

#### Taxonomy (5 models)
| Model | Key Fields | Purpose |
|-------|-----------|---------|
| `Category` | name, slug, parentId, level, path | 3-level category hierarchy |
| `Attribute` | name, slug, type, isFilterable, isGlobal | Product attribute definitions |
| `AttributeValue` | attributeId, value, slug | SELECT-type attribute options |
| `Tag` | name, slug, category (enum), synonyms | Product tags |
| `Department` | name, slug, ctaUrl, iconSvg, categoryId | Storefront sections |

#### Seller & Vendor (5 models)
| Model | Key Fields | Purpose |
|-------|-----------|---------|
| `Seller` | userId, storeName, slug, stripeConnectAccountId, commissionRate | Seller profile |
| `SellerThemeSettings` | sellerId, themeId, customColors | Storefront theme |
| `SellerVerificationDocument` | sellerId, documentType, fileUrl, status | KYC documents |
| `SellerMarket` | sellerId, marketId, status | Multi-market listing |
| `VendorLedgerEntry` | sellerId, orderId, type, amount, balance | Financial audit trail |

#### Orders & Commerce (11 models)
| Model | Key Fields | Purpose |
|-------|-----------|---------|
| `Order` | userId, sellerId, orderNumber, status, total, parentOrderId | Core order |
| `OrderItem` | orderId, productId, quantity, price | Order line items |
| `OrderNote` | orderId, content, internal, createdBy | Order comments |
| `Cart` | userId, guestSessionId, total, couponCode, marketId | Shopping cart |
| `CartItem` | cartId, productId, quantity, variationOptions | Cart line items |
| `Address` | userId, street, city, country, isDefault | Shipping/billing addresses |
| `GiftDetails` | orderId, recipientName, giftMessage, giftWrapping | Gift order metadata |
| `CancellationRequest` | orderId, requestedById, status, previousStatus | Cancellation workflow |
| `Payment` | orderId, stripePaymentId, amount, status | Payment records |
| `GiftCard` | code, userId, amount, balance, source, balanceSource | Digital/physical gift cards |
| `GiftCardTransaction` | giftCardId, orderId, type, amount, balanceAfter | Gift card ledger |

#### Promotions & Coupons (4 models)
| Model | Key Fields | Purpose |
|-------|-----------|---------|
| `Promotion` | name, type, conditions, actions, isStackable, usageLimit | Promotion engine |
| `Coupon` | code, promotionId, usageLimit, status | Promo codes |
| `CouponUsage` | couponId, userId, orderId, discountAmount | Usage tracking |
| `PromotionUsage` | promotionId, userId, orderId | Automatic promo usage |

#### Shipping & Fulfillment (14 models)
| Model | Key Fields | Purpose |
|-------|-----------|---------|
| `ShippingMethod` | name, type, sellerId, isActive | Shipping method definitions |
| `ShippingRule` | shippingMethodId, conditions, rate, freeShippingThreshold | Rate rules |
| `ShippingCarrier` | name, code, trackingUrlTemplate | Carrier registry |
| `ShippingRateTier` | code, name, countryCodes | Geographic rate bands |
| `BoxSize` | storeId, name, lengthCm/widthCm/heightCm, customerPrice | Package sizes |
| `BoxSizeRate` | boxSizeId, tierId, customerPrice | Size × tier pricing |
| `Warehouse` | name, code, address, warehouseType | Warehouse locations |
| `FulfillmentCenter` | name, address, capacity | FC management |
| `InventoryLocation` | warehouseId, productId, quantity, reserved | Stock per warehouse |
| `StockReservation` | inventoryLocationId, orderId, quantity, expiresAt | Reservation locks |
| `StockTransfer` | fromWarehouseId, toWarehouseId, productId, status | Inter-warehouse transfers |
| `StockMovement` | inventoryLocationId, movementType, quantity | Stock audit trail |
| `Shipment` | submissionId, fulfillmentCenterId, trackingNumber, status | Inbound shipment |
| `LogisticsPartner` | name, trackingApiUrl, apiKey | 3PL partner |

#### Ship-From-Store (5 models)
| Model | Key Fields | Purpose |
|-------|-----------|---------|
| `StoreShipmentRequest` | storeId, posSaleId, status, hosOrderNumber, qrAccessCode | SFS order |
| `ShipmentGroup` | shippingOrderId, boxSizeId, trackingCode, labelUrl | Multi-package group |
| `ShipmentGroupItem` | groupId, sku, name, quantity, verified | Packing verification |
| `SkuCustomsAttribute` | sku, hsCode, countryOfOrigin, weightKg | Customs data |
| `ClickCollectOrder` | orderId, storeId, status, estimatedReady | C&C order |

#### Finance & Reconciliation (8 models)
| Model | Key Fields | Purpose |
|-------|-----------|---------|
| `Transaction` | type, amount, sellerId, customerId, orderId | Financial transaction |
| `TransactionAuditLog` | transactionId, previousStatus, newStatus | Status change audit |
| `Settlement` | sellerId, periodStart/End, totalSales, platformFee, netAmount | Seller payout |
| `OrderSettlement` | settlementId, orderId, amount, platformFee | Order ↔ settlement join |
| `ReconciliationRun` | status, periodStart/End, totalMatched/Mismatched | Recon run |
| `ReconciliationItem` | runId, type, internalAmount, stripeAmount | Recon line item |
| `Dispute` | stripeDisputeId, orderId, amount, status | Payment disputes |
| `FinancialPeriod` | year, month, status, totalRevenue/Refunds/Payouts | Period close |
| `Discrepancy` | type, severity, expectedValue, actualValue | Financial anomaly |

#### Loyalty — Enchanted Circle (13 models)
| Model | Key Fields | Purpose |
|-------|-----------|---------|
| `LoyaltyTier` | name, level, pointsThreshold, multiplier, benefits | Tier definitions |
| `LoyaltyMembership` | userId, tierId, currentBalance, totalSpend, compositeScore | Member profile |
| `LoyaltyTransaction` | membershipId, type, points, idempotencyKey, channel | Points ledger |
| `LoyaltyEarnRule` | action, pointsAmount, maxPerDay, conditions | Earn rule engine |
| `LoyaltyRedemptionOption` | name, type, pointsCost, value | Redemption catalog |
| `LoyaltyRedemption` | membershipId, optionId, pointsSpent, channel | Redemption record |
| `LoyaltyPosVoucher` | membershipId, storeId, type, cardNumber, clientId | POS voucher issue |
| `LoyaltyPosRedeemOtp` | membershipId, storeId, codeHash, attempts, expiresAt | OTP challenge |
| `LoyaltyReferral` | referrerId, refereeId, referralCode, status | Member referrals |
| `LoyaltyBonusCampaign` | name, multiplier, bonusPoints, startsAt/endsAt, storeIds | Bonus campaigns |
| `LoyaltyAnalyticsSnapshot` | date, totalMembers, pointsIssued/Redeemed, tierDistribution | Daily analytics |
| `CampaignAttribution` | campaignId, date, ordersInfluenced, revenueInfluenced, roi | Campaign ROI |
| `ProductCampaign` | name, productIds, bonusPoints, status | Product bonus points |

#### Ambassador & Brand Partnerships (6 models)
| Model | Key Fields | Purpose |
|-------|-----------|---------|
| `AmbassadorProfile` | userId, membershipId, tier, referralCode, totalUgcSubmissions | Ambassador profile |
| `UGCSubmission` | ambassadorId, type, mediaUrls, status, pointsAwarded | User-generated content |
| `AmbassadorAchievement` | ambassadorId, achievementSlug, pointsAwarded | Achievement tracking |
| `BrandPartnership` | name, slug, contractStart/End, totalBudget | Brand partner |
| `BrandCampaign` | partnershipId, name, multiplier, targetFandoms, status | Brand campaign |
| `BrandCampaignRedemption` | campaignId, userId, pointsAwarded, orderTotal | Campaign redemption |

#### Partner Referrals (3 models)
| Model | Key Fields | Purpose |
|-------|-----------|---------|
| `ReferralPartner` | name, slug, type, status | External referral partner |
| `ReferralPartnerLink` | partnerId, code, utmSource, signupBonusPoints | Referral link |
| `PartnerReferralConversion` | partnerId, linkId, userId, signupBonusAwarded | Conversion tracking |

#### Influencer (7 models)
| Model | Key Fields | Purpose |
|-------|-----------|---------|
| `Influencer` | userId, displayName, slug, referralCode, baseCommissionRate, tier | Influencer profile |
| `InfluencerStorefront` | influencerId, primaryColor, layoutType, contentBlocks | Custom storefront |
| `InfluencerProductLink` | influencerId, productId, clicks, conversions | Product affiliate links |
| `InfluencerCampaign` | influencerId, name, overrideCommissionRate, status | Campaign management |
| `InfluencerCommissionRule` | influencerId, productId/categoryId/brandName, commissionRate | Granular commission |
| `Referral` | influencerId, visitorId, orderId, utmParams, expiresAt | Click/conversion tracking |
| `InfluencerCommission` | influencerId, referralId, rateApplied, amount, status | Commission record |
| `InfluencerPayout` | influencerId, totalAmount, paymentMethod, status | Payout tracking |

#### Fandom & Gamification (8 models)
| Model | Key Fields | Purpose |
|-------|-----------|---------|
| `Fandom` | name, slug, description, image | Franchise/universe |
| `Character` | fandomId, name, personality, systemPrompt | AI chat character |
| `AIChat` | userId, characterId, messages (JSON) | Chat conversation |
| `Badge` | name, category, rarity, points | Achievement badge |
| `UserBadge` | userId, badgeId, earnedAt | User ↔ badge |
| `Quest` | name, fandomId, points, badgeId, requirements | Quest/challenge |
| `UserQuest` | userId, questId, progress, status | Quest progress |
| `FandomQuiz` | fandomId, title, questions (JSON), difficulty | Knowledge quiz |
| `FandomQuizAttempt` | quizId, userId, score, pointsAwarded | Quiz attempt |

#### Content & Communication (13 models)
| Model | Key Fields | Purpose |
|-------|-----------|---------|
| `Collection` | userId, name, items (JSON), isPublic | User collections |
| `SharedItem` | userId, type, itemId, platform, loyaltyPointsAwarded | Social share tracking |
| `Notification` | userId, type, content, status | In-app notifications |
| `EmailTemplate` | slug, subject, body, variables | Email templates |
| `WhatsAppTemplate` | name, category, content, variables | WhatsApp templates |
| `AdminEmailCampaign` | subject, bodyHtml, audienceType, status | Email blast campaigns |
| `SupportTicket` | ticketNumber, userId, subject, category, priority, status | Support tickets |
| `TicketMessage` | ticketId, userId, content, isInternal | Ticket thread |
| `WhatsAppConversation` | phoneNumber, userId, status | WhatsApp conversations |
| `WhatsAppMessage` | conversationId, direction, content, status | WhatsApp messages |
| `KnowledgeBaseArticle` | title, slug, content, category, isPublished | Help articles |
| `BlogPost` | title, slug, content, author, status, categoryId | Blog posts |
| `BlogCategory` | name, slug, description | Blog categories |

#### Marketing Automation (5 models)
| Model | Key Fields | Purpose |
|-------|-----------|---------|
| `MarketingJourney` | slug, triggerEvent, steps (JSON), segmentId | Automation journey |
| `JourneyEnrollment` | journeyId, userId, currentStep, status | User journey state |
| `AudienceSegment` | slug, rules (JSON), memberCount, type | Dynamic segments |
| `SegmentMembership` | segmentId, userId | Segment membership |
| `MessageLog` | userId, channel, templateSlug, status, journeyId | Message delivery log |

#### Events (3 models)
| Model | Key Fields | Purpose |
|-------|-----------|---------|
| `Event` | title, slug, type, startsAt/endsAt, capacity, attendancePoints | Event definition |
| `EventRSVP` | eventId, userId, status, ticketCode | RSVP registration |
| `EventAttendance` | eventId, userId, checkedInAt, method, pointsAwarded | Check-in record |

#### POS Integration (5 models)
| Model | Key Fields | Purpose |
|-------|-----------|---------|
| `POSConnection` | sellerId, storeId, provider, credentials, syncStatus | POS OAuth connection |
| `POSSale` | storeId, externalSaleId, totalAmount, loyaltyPointsEarned | Imported POS sale |
| `POSSaleItem` | saleId, productId, sku, name, quantity, unitPrice | POS sale line item |
| `ExternalEntityMapping` | provider, entityType, internalId, externalId | ID mapping (HOS ↔ POS) |
| `IdentityMatchReview` | provider, reason, status, email, phoneNormalized | Ambiguous customer match |

#### Accounting (1 model)
| Model | Key Fields | Purpose |
|-------|-----------|---------|
| `LedgerOutboxEntry` | entryType, periodDate, idempotencyKey, payload, xeroJournalId | Outbox → Xero journals |

#### Webhooks & Integrations (4 models)
| Model | Key Fields | Purpose |
|-------|-----------|---------|
| `Webhook` | url, events, secret, sellerId | Webhook subscription |
| `WebhookDelivery` | webhookId, event, payload, status, attempts | Delivery tracking |
| `IntegrationConfig` | category, provider, credentials (encrypted), isActive | 3rd-party config |
| `IntegrationLog` | integrationId, action, statusCode, duration | API call audit |

#### Miscellaneous (8 models)
| Model | Key Fields | Purpose |
|-------|-----------|---------|
| `Theme` | name, type, config (JSON), version | Theme definitions |
| `NavigationItem` | group, label, href, order | Storefront navigation |
| `Testimonial` | quote, author, city, rating | Customer quotes |
| `Universe` | name, slug, logo, accentColor | Franchise branding |
| `GalleryAlbum` | title, slug, eventDate, countryCode | Photo albums |
| `GalleryImage` | albumId, url, alt, caption | Album images |
| `CurrencyExchangeRate` | baseCurrency, targetCurrency, rate, expiresAt | FX rates |
| `NewsletterSubscription` | email, userId, status, source | Email subscriptions |
| `PushSubscription` | userId, endpoint, keys, platform | Web push |
| `ActivityLog` | userId, action, entityType, entityId, metadata | Audit trail |

### 5.3 Multi-Tenancy Model

```
Market (US, GB, AE, MY)          ← Geographic selling region
  └── Tenant (Organization)      ← Business entity
       └── Store (Physical/Virtual) ← Individual outlet
            └── User (STORE_STAFF)  ← Staff assigned to store
```

- `Market`: Independent of Tenant. Governs currency, locale, timezone, tax rules.
- `Tenant`: Top-level organization with optional custom domain/subdomain.
- `Store`: Belongs to a Tenant and optionally a Market. Has POS connection.
- `User.homeMarketId`: User's default market context for access scoping.
- `UserRoleAssignment.scopeType`: `GLOBAL | MARKET | TENANT | STORE` — restricts role to a scope.

### 5.4 Migration Strategy

- Prisma Migrate for schema migrations (`prisma migrate dev` / `prisma migrate deploy`)
- `docker-migrate.sh` runs `prisma migrate deploy` before app start in containers
- Seed scripts: `db:seed-admin`, `db:seed-all-roles`, `db:seed-loyalty`, `db:seed-pos`, etc.
- Staging seed command: `pnpm db:seed-staging` (runs admin + roles + loyalty seeds)

---

## 6. Authentication & Authorization

### 6.1 Authentication Flow

```mermaid
sequenceDiagram
    participant Client
    participant API
    participant DB
    participant OAuth as OAuth Provider

    Note over Client,API: Email/Password Login
    Client->>API: POST /auth/login {email, password}
    API->>DB: Find user by email
    API->>API: bcrypt.compare(password, hash)
    API->>API: Check account lockout
    API->>DB: Create RefreshToken (hashed)
    API->>Client: Set HttpOnly cookies (access_token, refresh_token)

    Note over Client,API: OAuth Login (Google/Facebook/Apple)
    Client->>OAuth: Redirect to provider
    OAuth->>API: Callback with code
    API->>OAuth: Exchange code for tokens
    API->>DB: Find/create OAuthAccount + User
    API->>Client: Set HttpOnly cookies

    Note over Client,API: Token Refresh
    Client->>API: POST /auth/refresh (refresh_token cookie)
    API->>DB: Validate RefreshToken hash + expiry + tokenVersion
    API->>DB: Revoke old token, create new
    API->>Client: Rotate both cookies

    Note over Client,API: Logout
    Client->>API: POST /auth/logout
    API->>DB: Revoke RefreshToken
    API->>Client: Clear cookies
```

### 6.2 JWT Strategy

**Access Token:**
- Algorithm: HS256
- Expiry: 15 minutes (configurable via `JWT_EXPIRATION`)
- Payload: `{ sub: userId, email, role, permissions[], homeMarketId, tokenVersion }`
- Delivery: `access_token` HttpOnly, Secure, SameSite=Lax cookie

**Refresh Token:**
- Algorithm: HS256 with separate secret (`JWT_REFRESH_SECRET`)
- Expiry: 30 days (configurable via `REFRESH_TOKEN_TTL`)
- Storage: bcrypt hash stored in `RefreshToken` table
- Delivery: `refresh_token` HttpOnly, Secure, SameSite=Lax cookie
- Rotation: Old token revoked on each refresh

**Token Version:**
- `User.tokenVersion` integer incremented on password change / security event
- All existing tokens with older version are implicitly invalidated
- Checked on every JWT validation

### 6.3 OAuth Flows

| Provider | Strategy | Package | Callback Path |
|----------|----------|---------|---------------|
| Google | `passport-google-oauth20` | `passport-google-oauth20` | `/auth/google/callback` |
| Facebook | `passport-facebook` | `passport-facebook` | `/auth/facebook/callback` |
| Apple | `passport-apple` | `passport-apple` | `/auth/apple/callback` |

OAuth accounts are stored in `OAuthAccount` model. Linking flow:
1. If existing user found by email → link OAuth account to user
2. If no user found → create new user + OAuth account
3. Password is optional for OAuth-only users (`User.password` is nullable)

### 6.4 Cookie Architecture

| Cookie | Domain | HttpOnly | Purpose |
|--------|--------|----------|---------|
| `access_token` | API domain | Yes | JWT access token |
| `refresh_token` | API domain | Yes | JWT refresh token |
| `is_logged_in` | Frontend domain | No | Middleware session detection (JS-readable flag) |
| `hos_shop_preview` | Frontend | Yes | Soft-launch tester bypass |
| `hos_ref` | Frontend | No | Loyalty/partner referral attribution |
| `hos_utm` | Frontend | No | UTM campaign attribution |

All auth cookies use `SameSite=Lax` and `Secure` in production.

### 6.5 Account Security

**Failed Login Lockout:**
- `User.failedLoginAttempts` incremented on wrong password
- `User.lockedUntil` set after 5 failed attempts → 15 minute lockout
- Counter resets on successful login
- Timing-safe dummy bcrypt on unknown email (prevents user enumeration)

**Session Limits:**
- Maximum 5 concurrent refresh tokens per user
- Oldest session revoked when limit exceeded
- All sessions invalidated on password change via `tokenVersion` bump

**Email Verification:**
- Registration sends verification email with unique token
- Token expiry: 24 hours
- `User.emailVerified` + `emailVerifiedAt` updated on verification
- Login blocked for unverified accounts (except ADMIN and protected emails)

**Password Hashing:**
- bcrypt with configurable salt rounds (default: 12, env: `BCRYPT_PASSWORD_ROUNDS`)
- Password reset token expiry: 1 hour
- Password complexity: minimum 8 characters + regex validation

**Rate Limiting (Auth Endpoints):**

| Endpoint | Limit |
|----------|-------|
| `POST /auth/register` | 5/min |
| `POST /auth/login` | 5/min |
| `POST /auth/refresh` | 10/min |
| `POST /auth/forgot-password` | 3/min |
| `POST /auth/verify-email` | 3/5min |
| `GET /auth/fandom-challenge` | 10/min |

### 6.6 Bot Protection — Fandom Challenge

Registration is protected by a trivia-based CAPTCHA alternative:
- `FandomChallengeService` generates HMAC-SHA256 signed trivia questions
- 24 questions across Harry Potter, LOTR, Star Wars, and other fandoms
- Challenge token TTL: 2 minutes, single-use (in-memory set)
- Secret: `FANDOM_CHALLENGE_SECRET` or falls back to `JWT_SECRET`
- Honeypot field: `website` (maxLength 0) rejects automated submissions
- Configurable: `FANDOM_CHALLENGE_REQUIRED` (default enforced)

### 6.7 Registration Modes

| Mode | Env Value | Behavior |
|------|-----------|----------|
| Open | `REGISTRATION_MODE=open` | Anyone can register (default) |
| Invite Only | `REGISTRATION_MODE=invite_only` | Requires valid invite/bypass |

**Bypass paths for invite-only mode:**
- `REGISTRATION_INVITE_CODES` — comma-separated admin-defined codes
- Seller invitation token (from `POST /auth/accept-invitation`)
- Loyalty referral code (`HOS-*` prefix)
- Partner referral code (`PARTNER-*` prefix)
- Store shipment claim token
- Founding member bonus (`FOUNDING_MEMBER_BONUS_POINTS` default 500)

### 6.5 RBAC System

**13 Built-in Roles (UserRole enum):**

| Role | Description |
|------|-------------|
| `CUSTOMER` | Default registered user |
| `WHOLESALER` | B2B supply-chain seller — product submission pipeline |
| `B2C_SELLER` | Direct-to-consumer seller — manages own storefront |
| `ADMIN` | Platform administrator |
| `INFLUENCER` | Influencer with storefront |
| `PROCUREMENT` | Procurement staff |
| `FULFILLMENT` | Fulfillment center staff |
| `CATALOG` | Catalog/copywriting staff |
| `MARKETING` | Marketing staff |
| `FINANCE` | Finance staff |
| `CMS_EDITOR` | CMS content editor |
| `SALES` | Sales team |
| `STORE_STAFF` | Physical store employee |

> The legacy `SELLER` UserRole was deprecated and migrated to `B2C_SELLER`. Centralised role constants are defined in `services/api/src/common/roles.ts` (`SELLER_ROLES`, `B2C_SELLER_ROLES`, `isSellerRole()`).

**Custom Permission Roles (`PermissionRole`):**
- DB-stored role definitions with JSON permission arrays
- `scopeKind`: `ANY | GLOBAL | MARKET | TENANT | STORE`
- Assignable to users via `UserRoleAssignment`
- Permissions are string IDs (e.g., `"users.view"`, `"orders.manage"`, `"finance.approve"`)

**Guard Hierarchy:**

```mermaid
graph TD
    REQ[Request] --> PUB{@Public?}
    PUB -->|Yes| HANDLER[Route Handler]
    PUB -->|No| JWT[JwtAuthGuard]
    JWT -->|Invalid| REJECT[401 Unauthorized]
    JWT -->|Valid| ACCESS[AccessGuard]
    ACCESS --> MARKET[MarketContextService.resolve]
    MARKET --> MODE{Access Control Mode?}
    MODE -->|legacy| LEGACY[Legacy @Roles/@Permissions eval]
    MODE -->|shadow| SHADOW[Legacy decides + log divergence with policy engine]
    MODE -->|enforce| ENFORCE[PolicyService.evaluate for @RequireAccess routes]
    LEGACY --> HANDLER
    SHADOW --> HANDLER
    ENFORCE -->|Allowed| HANDLER
    ENFORCE -->|Denied| FORBIDDEN[403 Forbidden]
```

**Access Control Three-Mode Rollout:**

| Mode | Env Value | Behavior |
|------|-----------|----------|
| Legacy | `ACCESS_CONTROL_MODE=legacy` | Old `@Roles`/`@Permissions` guards decide (default) |
| Shadow | `ACCESS_CONTROL_MODE=shadow` | Legacy decides + new policy engine runs in parallel, divergences logged |
| Enforce | `ACCESS_CONTROL_MODE=enforce` | New `PolicyService` is authoritative for `@RequireAccess` routes |

Per-module overrides: `ACCESS_CONTROL_MODULE_MODES=orders:shadow,finance:enforce`

**Market Context Resolution (AccessGuard):**
1. `x-market-code` request header → explicit market selection
2. User's `homeMarketId` → default market
3. System default market → fallback
4. Global admins who explicitly pick a market are scoped (not bypassed)
5. Market context stored in `AsyncLocalStorage` for Prisma data scoping

**System Actor Pattern:**
- `withSystemActor()` / `withSystemActorAsync()` wraps cron/webhook/BullMQ jobs
- Provides explicit market scope or `allMarkets` bypass for background jobs
- Ensures access control context exists outside HTTP request lifecycle

### 6.10 Guest Checkout Flow

- Guest cart identified by `guestSessionId` (UUID in `X-Guest-Session` header)
- No authentication required for browsing, cart operations
- At checkout: guest provides email/address without account creation
- Optional: convert to full account post-purchase
- Feature flag: `FF_GUEST_CHECKOUT`

---

## 7. API Reference

### 7.1 Endpoint Summary

The API exposes approximately **1,079 routes** across **130+ controllers**. All endpoints are prefixed with `/api` and optionally `/api/v1`.

### 7.2 Complete Endpoint Catalog by Domain

#### Authentication (`/auth`)
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/auth/register` | Register new user |
| POST | `/auth/login` | Email/password login |
| POST | `/auth/logout` | Logout (revoke tokens) |
| POST | `/auth/refresh` | Refresh access token |
| POST | `/auth/forgot-password` | Request password reset |
| POST | `/auth/reset-password` | Reset password with token |
| GET | `/auth/verify-email` | Verify email address |
| GET | `/auth/me` | Get current user profile |
| POST | `/auth/accept-invitation` | Accept seller/team invitation |
| GET | `/auth/google` | Initiate Google OAuth |
| GET | `/auth/google/callback` | Google OAuth callback |
| GET | `/auth/facebook` | Initiate Facebook OAuth |
| GET | `/auth/facebook/callback` | Facebook OAuth callback |
| POST | `/auth/apple` | Apple Sign In |
| GET | `/auth/apple/callback` | Apple OAuth callback |
| POST | `/auth/change-password` | Change password (authenticated) |
| POST | `/auth/resend-verification` | Resend verification email |

#### Products (`/products`)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/products` | List products (paginated, filtered) |
| GET | `/products/:id` | Get product detail |
| POST | `/products` | Create product |
| PUT | `/products/:id` | Update product |
| DELETE | `/products/:id` | Delete product |
| GET | `/products/:id/reviews` | Get product reviews |
| POST | `/products/:id/reviews` | Create product review |
| PUT | `/products/reviews/:id` | Update review |
| DELETE | `/products/reviews/:id` | Delete review |
| POST | `/products/bundles` | Create bundle product |
| PUT | `/products/bundles/:id` | Update bundle |

#### Orders (`/orders`)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/orders` | List user's orders |
| GET | `/orders/:id` | Get order detail |
| POST | `/orders` | Create order (checkout) |
| PATCH | `/orders/:id/status` | Update order status |
| POST | `/orders/:id/notes` | Add order note |
| GET | `/orders/:id/notes` | Get order notes |
| POST | `/orders/:id/ship` | Mark order as shipped |
| POST | `/orders/:id/deliver` | Mark order as delivered |
| GET | `/orders/:id/invoice` | Download invoice PDF |
| POST | `/orders/:id/tracking` | Update tracking info |
| GET | `/orders/seller` | Get seller's orders |
| POST | `/orders/:id/accept` | Seller accept order |
| POST | `/orders/:id/reject` | Seller reject order |
| PATCH | `/orders/:id/fulfillment-route` | Set fulfillment routing |

#### Cart (`/cart`)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/cart` | Get current cart |
| POST | `/cart/items` | Add item to cart |
| PUT | `/cart/items/:id` | Update cart item quantity |
| DELETE | `/cart/items/:id` | Remove item from cart |
| POST | `/cart/coupon` | Apply coupon code |
| DELETE | `/cart/coupon` | Remove coupon |
| POST | `/cart/loyalty-points` | Apply loyalty points |
| DELETE | `/cart/loyalty-points` | Remove loyalty points |

#### Payments (`/payments`)
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/payments/create-intent` | Create Stripe payment intent |
| POST | `/payments/webhook` | Stripe webhook handler |
| GET | `/payments/:id` | Get payment details |
| POST | `/payments/refund` | Process refund |
| POST | `/payments/stripe-connect/onboard` | Initiate Connect onboarding |

#### Loyalty (`/loyalty`)
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/loyalty/enroll` | Enroll in loyalty programme |
| GET | `/loyalty/membership` | Get membership details |
| GET | `/loyalty/tiers` | List tier definitions |
| GET | `/loyalty/earn-rules` | List earn rules |
| GET | `/loyalty/transactions` | Get points history |
| GET | `/loyalty/redemption-options` | List redemption catalog |
| POST | `/loyalty/redeem` | Redeem points |
| POST | `/loyalty/referral/generate` | Generate referral code |
| POST | `/loyalty/referral/convert` | Convert referral |
| GET | `/loyalty/balance` | Get current balance |
| POST | `/loyalty/pos/redeem-for-voucher` | POS: burn points for voucher |
| POST | `/loyalty/pos/otp/request` | Request OTP for staff-assisted redemption |
| POST | `/loyalty/pos/otp/verify` | Verify OTP |
| GET | `/loyalty/card` | Get digital loyalty card |
| PATCH | `/loyalty/preferences` | Update communication preferences |

#### Loyalty Admin (`/loyalty/admin`)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/loyalty/admin/tiers` | List all tiers |
| POST | `/loyalty/admin/tiers` | Create tier |
| PUT | `/loyalty/admin/tiers/:id` | Update tier |
| DELETE | `/loyalty/admin/tiers/:id` | Delete tier |
| GET | `/loyalty/admin/earn-rules` | List earn rules |
| POST | `/loyalty/admin/earn-rules` | Create earn rule |
| PUT | `/loyalty/admin/earn-rules/:id` | Update earn rule |
| DELETE | `/loyalty/admin/earn-rules/:id` | Delete earn rule |
| GET | `/loyalty/admin/redemption-options` | List redemption options |
| POST | `/loyalty/admin/redemption-options` | Create redemption option |
| PUT | `/loyalty/admin/redemption-options/:id` | Update redemption option |
| DELETE | `/loyalty/admin/redemption-options/:id` | Delete redemption option |
| GET | `/loyalty/admin/memberships` | List all memberships |
| GET | `/loyalty/admin/memberships/:id` | Get membership detail |
| PATCH | `/loyalty/admin/memberships/:id` | Update membership |
| POST | `/loyalty/admin/memberships/:id/adjust` | Adjust points balance |
| POST | `/loyalty/admin/memberships/:id/deactivate` | Deactivate membership |
| POST | `/loyalty/admin/memberships/:id/reactivate` | Reactivate membership |
| GET | `/loyalty/admin/transactions` | List all transactions |
| GET | `/loyalty/admin/campaigns` | List bonus campaigns |
| POST | `/loyalty/admin/campaigns` | Create bonus campaign |
| PUT | `/loyalty/admin/campaigns/:id` | Update bonus campaign |
| DELETE | `/loyalty/admin/campaigns/:id` | Delete bonus campaign |
| GET | `/loyalty/admin/referrals` | List referrals |
| GET | `/loyalty/admin/pos-vouchers` | List POS vouchers |
| POST | `/loyalty/admin/pos-vouchers/:id/reverse` | Reverse POS voucher |
| GET | `/loyalty/admin/stats` | Dashboard statistics |
| POST | `/loyalty/admin/bulk-enroll` | Bulk membership enrollment |
| POST | `/loyalty/admin/expire-points` | Trigger points expiry |
| GET | `/loyalty/admin/export` | Export loyalty data |
| PATCH | `/loyalty/admin/settings` | Update loyalty settings |
| GET | `/loyalty/admin/product-campaigns` | List product campaigns |
| POST | `/loyalty/admin/product-campaigns` | Create product campaign |
| PUT | `/loyalty/admin/product-campaigns/:id` | Update product campaign |
| DELETE | `/loyalty/admin/product-campaigns/:id` | Delete product campaign |
| GET | `/loyalty/admin/regions` | List region configurations |
| PUT | `/loyalty/admin/regions/:code` | Update region config |
| GET | `/loyalty/admin/identity-reviews` | List identity match reviews |
| PATCH | `/loyalty/admin/identity-reviews/:id` | Resolve identity match |

#### Loyalty POS (`/loyalty/pos`)
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/loyalty/pos/redeem-for-voucher` | Burn points, issue POS voucher |
| POST | `/loyalty/pos/otp/request` | Request OTP for staff-assisted redemption |
| POST | `/loyalty/pos/otp/verify` | Verify OTP code |
| GET | `/loyalty/pos/voucher/:id` | Get voucher status |
| POST | `/loyalty/pos/earn` | Award points for POS sale |

#### Users (`/users`)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/users/me` | Get current user |
| PUT | `/users/me` | Update current user |
| GET | `/users/:id` | Get user by ID (admin) |
| PUT | `/users/:id` | Update user (admin) |
| DELETE | `/users/:id` | Soft-delete user (admin) |
| GET | `/users/:id/activity` | Get user activity log |
| GET | `/users/:id/orders` | Get user's orders |

#### Sellers (`/sellers`)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/sellers` | List sellers (public) |
| GET | `/sellers/:slug` | Get seller by slug (public) |
| GET | `/sellers/me` | Get current seller profile |
| PUT | `/sellers/me` | Update seller profile |
| GET | `/sellers/me/dashboard` | Seller dashboard stats |
| GET | `/sellers/me/orders` | Seller's orders |
| GET | `/sellers/me/products` | Seller's products |
| GET | `/sellers/me/submissions` | Seller's submissions |
| GET | `/sellers/me/earnings` | Seller earnings summary |
| GET | `/sellers/me/analytics` | Seller analytics |
| POST | `/sellers/onboard` | Start seller onboarding |
| POST | `/sellers/stripe-connect` | Initiate Stripe Connect |
| PUT | `/sellers/me/theme` | Update seller theme |
| GET | `/sellers/me/returns` | Seller return requests |
| POST | `/sellers/me/promotions` | Create seller promotion |
| GET | `/sellers/me/promotions` | List seller promotions |
| POST | `/sellers/me/shipping-methods` | Create shipping method |
| GET | `/sellers/me/shipping-methods` | List shipping methods |
| POST | `/sellers/me/webhooks` | Register seller webhook |

#### Inventory (`/inventory`)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/inventory/warehouses` | List warehouses |
| POST | `/inventory/warehouses` | Create warehouse |
| PUT | `/inventory/warehouses/:id` | Update warehouse |
| DELETE | `/inventory/warehouses/:id` | Delete warehouse |
| GET | `/inventory/warehouses/:id/stock` | Get warehouse stock |
| GET | `/inventory/products/:id/locations` | Get product inventory locations |
| PUT | `/inventory/locations/:id` | Update inventory location |
| POST | `/inventory/adjustments` | Create stock adjustment |
| GET | `/inventory/movements` | List stock movements |
| POST | `/inventory/transfers` | Create stock transfer |
| GET | `/inventory/transfers` | List stock transfers |
| PUT | `/inventory/transfers/:id/approve` | Approve transfer |
| PUT | `/inventory/transfers/:id/complete` | Complete transfer |
| PUT | `/inventory/transfers/:id/cancel` | Cancel transfer |
| GET | `/inventory/reservations` | List active reservations |
| POST | `/inventory/reservations` | Create reservation |
| DELETE | `/inventory/reservations/:id` | Cancel reservation |
| GET | `/inventory/low-stock` | Low stock alerts |
| GET | `/inventory/out-of-stock` | Out of stock products |
| POST | `/inventory/bulk-update` | Bulk stock update |
| GET | `/inventory/export` | Export inventory data |
| GET | `/inventory/analytics` | Inventory analytics |
| GET | `/inventory/turnover` | Stock turnover report |
| POST | `/inventory/receive` | Receive goods |
| GET | `/inventory/history/:productId` | Product stock history |

#### Store Shipment (Ship-from-Store) (`/store-shipment`)
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/store-shipment/requests` | Create SFS request |
| GET | `/store-shipment/requests` | List SFS requests |
| GET | `/store-shipment/requests/:id` | Get SFS request detail |
| PATCH | `/store-shipment/requests/:id` | Update SFS request |
| PATCH | `/store-shipment/requests/:id/status` | Update SFS status |
| POST | `/store-shipment/requests/:id/customer-details` | Add customer details |
| POST | `/store-shipment/requests/:id/address` | Set destination address |
| POST | `/store-shipment/requests/:id/items` | Add/update items |
| POST | `/store-shipment/requests/:id/quote` | Get shipping quote |
| POST | `/store-shipment/requests/:id/pay` | Create payment intent |
| POST | `/store-shipment/requests/:id/confirm-payment` | Confirm counter payment |
| POST | `/store-shipment/requests/:id/groups` | Create shipment group |
| GET | `/store-shipment/requests/:id/groups` | List shipment groups |
| PATCH | `/store-shipment/requests/:id/groups/:gid` | Update shipment group |
| DELETE | `/store-shipment/requests/:id/groups/:gid` | Delete shipment group |
| POST | `/store-shipment/requests/:id/groups/:gid/items` | Add items to group |
| POST | `/store-shipment/requests/:id/groups/:gid/pack` | Mark group packed |
| POST | `/store-shipment/requests/:id/groups/:gid/label` | Create shipping label |
| POST | `/store-shipment/requests/:id/groups/:gid/hand-to-carrier` | Hand to carrier |
| POST | `/store-shipment/requests/:id/groups/:gid/tracking` | Update tracking |
| GET | `/store-shipment/requests/:id/groups/:gid/slip` | Get packing slip |
| POST | `/store-shipment/requests/:id/cancel` | Cancel SFS request |
| GET | `/store-shipment/pending-queue` | Store pending queue |
| GET | `/store-shipment/backoffice` | Backoffice overview |
| GET | `/store-shipment/by-order/:orderNumber` | Lookup by HOS order number |
| GET | `/store-shipment/by-invoice/:invoice` | Lookup by POS invoice |
| POST | `/store-shipment/claim/initiate` | Initiate email claim |
| POST | `/store-shipment/claim/verify` | Verify claim token |
| GET | `/store-shipment/claim/:token` | Get claim details |
| PATCH | `/store-shipment/claim/:token/address` | Update claim address |
| POST | `/store-shipment/claim/:token/confirm` | Confirm claim |
| GET | `/store-shipment/qr/:code` | QR code lookup |
| GET | `/store-shipment/stats` | SFS statistics |
| GET | `/store-shipment/export` | Export SFS data |
| GET | `/store-shipment/box-sizes` | List box sizes |
| POST | `/store-shipment/box-sizes` | Create box size |
| PUT | `/store-shipment/box-sizes/:id` | Update box size |
| DELETE | `/store-shipment/box-sizes/:id` | Delete box size |
| GET | `/store-shipment/rate-tiers` | List rate tiers |
| POST | `/store-shipment/rate-tiers` | Create rate tier |
| PUT | `/store-shipment/rate-tiers/:id` | Update rate tier |
| DELETE | `/store-shipment/rate-tiers/:id` | Delete rate tier |
| GET | `/store-shipment/customs/:sku` | Get SKU customs data |

#### Finance (`/finance`)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/finance/dashboard` | Finance dashboard |
| GET | `/finance/transactions` | List financial transactions |
| GET | `/finance/transactions/:id` | Transaction detail |
| PUT | `/finance/transactions/:id/status` | Update transaction status |
| POST | `/finance/transactions/:id/audit` | Add audit note |
| GET | `/finance/transactions/:id/audit` | Get audit trail |
| POST | `/finance/payouts` | Create seller payout |
| GET | `/finance/payouts` | List payouts |
| PUT | `/finance/payouts/:id/approve` | Approve payout |
| PUT | `/finance/payouts/:id/process` | Process payout |
| POST | `/finance/refunds/:orderId` | Process order refund |
| GET | `/finance/refunds` | List refunds |
| POST | `/finance/refunds/:id/approve` | Approve refund |
| GET | `/finance/reconciliation` | List reconciliation runs |
| POST | `/finance/reconciliation` | Start reconciliation |
| GET | `/finance/reconciliation/:id` | Reconciliation detail |
| PUT | `/finance/reconciliation/:id/items/:itemId` | Resolve recon item |
| GET | `/finance/disputes` | List payment disputes |
| PUT | `/finance/disputes/:id` | Update dispute |
| POST | `/finance/disputes/:id/evidence` | Submit dispute evidence |
| GET | `/finance/periods` | List financial periods |
| POST | `/finance/periods/close` | Close financial period |
| GET | `/finance/revenue` | Revenue recognition report |
| GET | `/finance/revenue/daily` | Daily revenue breakdown |
| GET | `/finance/revenue/by-seller` | Revenue by seller |
| GET | `/finance/aging` | Accounts aging report |
| GET | `/finance/aging/payables` | Aging payables |
| GET | `/finance/aging/receivables` | Aging receivables |
| GET | `/finance/reports/fees` | Fee breakdown report |
| GET | `/finance/reports/revenue` | Revenue report |
| GET | `/finance/reports/commissions` | Commission report |
| GET | `/finance/reports/settlements` | Settlement report |

#### Taxonomy (`/taxonomy`)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/taxonomy/categories` | List categories (tree) |
| POST | `/taxonomy/categories` | Create category |
| PUT | `/taxonomy/categories/:id` | Update category |
| DELETE | `/taxonomy/categories/:id` | Delete category |
| GET | `/taxonomy/categories/:id/products` | Category products |
| PUT | `/taxonomy/categories/reorder` | Reorder categories |
| GET | `/taxonomy/categories/:id/path` | Get category path |
| GET | `/taxonomy/attributes` | List attributes |
| POST | `/taxonomy/attributes` | Create attribute |
| PUT | `/taxonomy/attributes/:id` | Update attribute |
| DELETE | `/taxonomy/attributes/:id` | Delete attribute |
| GET | `/taxonomy/attributes/:id/values` | Attribute values |
| POST | `/taxonomy/attributes/:id/values` | Add attribute value |
| PUT | `/taxonomy/attributes/:id/values/:vid` | Update value |
| DELETE | `/taxonomy/attributes/:id/values/:vid` | Delete value |
| PUT | `/taxonomy/attributes/reorder` | Reorder attributes |
| GET | `/taxonomy/attributes/global` | List global attributes |
| GET | `/taxonomy/tags` | List tags |
| POST | `/taxonomy/tags` | Create tag |
| PUT | `/taxonomy/tags/:id` | Update tag |
| DELETE | `/taxonomy/tags/:id` | Delete tag |
| GET | `/taxonomy/tags/categories` | List tag categories |
| GET | `/taxonomy/tags/:id/products` | Tag products |
| POST | `/taxonomy/tags/merge` | Merge duplicate tags |
| GET | `/taxonomy/tags/search` | Search tags |

#### Shipping (`/shipping`)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/shipping/methods` | List shipping methods |
| POST | `/shipping/methods` | Create shipping method |
| PUT | `/shipping/methods/:id` | Update shipping method |
| DELETE | `/shipping/methods/:id` | Delete shipping method |
| GET | `/shipping/methods/:id/rules` | List rules for method |
| POST | `/shipping/methods/:id/rules` | Add shipping rule |
| PUT | `/shipping/rules/:id` | Update rule |
| DELETE | `/shipping/rules/:id` | Delete rule |
| POST | `/shipping/calculate` | Calculate shipping rate |
| GET | `/shipping/carriers` | List carriers |
| POST | `/shipping/carriers` | Create carrier |
| PUT | `/shipping/carriers/:id` | Update carrier |
| DELETE | `/shipping/carriers/:id` | Delete carrier |
| POST | `/shipping/labels` | Generate shipping label |
| GET | `/shipping/tracking/:code` | Track shipment |
| GET | `/shipping/rates/compare` | Compare carrier rates |
| POST | `/shipping/validate-address` | Validate shipping address |

#### CMS (`/cms`)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/cms/pages` | List CMS pages |
| POST | `/cms/pages` | Create page |
| GET | `/cms/pages/:slug` | Get page by slug |
| PUT | `/cms/pages/:id` | Update page |
| DELETE | `/cms/pages/:id` | Delete page |
| GET | `/cms/banners` | List banners |
| POST | `/cms/banners` | Create banner |
| PUT | `/cms/banners/:id` | Update banner |
| DELETE | `/cms/banners/:id` | Delete banner |
| PUT | `/cms/banners/reorder` | Reorder banners |
| GET | `/cms/settings` | Get CMS settings |
| PUT | `/cms/settings` | Update CMS settings |
| GET | `/cms/blocks` | List content blocks |
| POST | `/cms/blocks` | Create content block |
| PUT | `/cms/blocks/:id` | Update content block |
| DELETE | `/cms/blocks/:id` | Delete content block |
| GET | `/cms/media` | List media files |
| POST | `/cms/media` | Upload media |
| DELETE | `/cms/media/:id` | Delete media |
| POST | `/cms/revalidate` | Trigger ISR revalidation |

#### Integrations (`/integrations`)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/integrations` | List all integrations |
| GET | `/integrations/:id` | Get integration detail |
| POST | `/integrations` | Create integration config |
| PUT | `/integrations/:id` | Update integration |
| DELETE | `/integrations/:id` | Delete integration |
| PUT | `/integrations/:id/activate` | Activate integration |
| PUT | `/integrations/:id/deactivate` | Deactivate integration |
| POST | `/integrations/:id/test` | Test connection |
| GET | `/integrations/:id/logs` | Get integration logs |
| GET | `/integrations/categories` | List integration categories |
| GET | `/integrations/category/:cat/providers` | List providers for category |
| PUT | `/integrations/:id/credentials` | Update credentials |
| POST | `/integrations/:id/webhook-url` | Generate webhook URL |

#### POS (`/pos`)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/pos/admin/connections` | List POS connections |
| POST | `/pos/admin/connections` | Create POS connection |
| PUT | `/pos/admin/connections/:id` | Update connection |
| DELETE | `/pos/admin/connections/:id` | Delete connection |
| POST | `/pos/admin/connections/:id/sync` | Trigger manual sync |
| GET | `/pos/admin/connections/:id/sales` | Get imported sales |
| POST | `/pos/admin/connections/:id/import-sales` | Import sales |
| GET | `/pos/admin/connections/:id/products` | Get synced products |
| POST | `/pos/admin/connections/:id/sync-products` | Sync products |
| POST | `/pos/admin/connections/:id/sync-customers` | Sync customers |
| GET | `/pos/admin/identity-reviews` | List ambiguous matches |
| PATCH | `/pos/admin/identity-reviews/:id` | Resolve identity match |
| GET | `/pos/lightspeed/oauth/connect` | Initiate Lightspeed OAuth |
| GET | `/pos/lightspeed/oauth/callback` | Lightspeed OAuth callback |
| POST | `/pos/lightspeed/oauth/refresh` | Refresh OAuth token |

#### Admin (`/admin`)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/admin/dashboard` | Dashboard statistics |
| GET | `/admin/users` | List all users |
| PUT | `/admin/users/:id` | Update user |
| DELETE | `/admin/users/:id` | Deactivate user |
| GET | `/admin/sellers` | List sellers |
| PATCH | `/admin/sellers/:id/approve` | Approve seller |
| PATCH | `/admin/sellers/:id/reject` | Reject seller |
| GET | `/admin/products` | List all products |
| POST | `/admin/products` | Create platform product |
| PATCH | `/admin/products/:id` | Update any product |
| DELETE | `/admin/products/:id` | Delete any product |
| GET | `/admin/orders` | List all orders |
| POST | `/admin/create-team-users` | Bulk create team users |
| GET | `/admin/settings/config` | Get platform config |
| PUT | `/admin/settings/config` | Update platform config |

_(Plus approximately 800 more routes across sellers, inventory, finance, shipping, marketing, CMS, integrations, loyalty-admin, store-admin, events, segments, ambassadors, brand-partnerships, partner-referrals, etc.)_

### 7.3 Request/Response Patterns

**Pagination (standard DTO):**
```typescript
class PaginationQueryDto {
  page?: number = 1;     // 1-indexed
  limit?: number = 20;   // Max 100 (enforced by PaginationCapInterceptor)
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
}

// Response envelope
{
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }
}
```

**Validation:**
- `class-validator` decorators on DTOs
- `ValidationPipe` with `whitelist: true` strips unknown properties
- `forbidNonWhitelisted: true` rejects requests with extra fields
- `transform: true` with `enableImplicitConversion` for query params

**Rate Limiting:**
- `@nestjs/throttler` with configurable limits per endpoint
- Default: 60 requests per minute per IP
- Stricter limits on auth endpoints (e.g., 5 login attempts per minute)

### 7.4 Order Lifecycle

```mermaid
stateDiagram-v2
    [*] --> PENDING: Customer places order
    PENDING --> CONFIRMED: Payment successful
    PENDING --> CANCELLED: Payment failed / timeout

    CONFIRMED --> ACCEPTED: Seller accepts (vendor order)
    CONFIRMED --> PROCESSING: Direct fulfillment
    CONFIRMED --> REJECTED: Seller rejects (vendor order)

    ACCEPTED --> PROCESSING: Begin fulfillment
    PROCESSING --> FULFILLED: Items picked/packed
    FULFILLED --> SHIPPED: Carrier collected
    SHIPPED --> DELIVERED: Delivery confirmed

    CONFIRMED --> CANCELLATION_REQUESTED: Customer requests cancel
    ACCEPTED --> CANCELLATION_REQUESTED: Customer requests cancel
    PROCESSING --> CANCELLATION_REQUESTED: Customer requests cancel

    CANCELLATION_REQUESTED --> CANCELLED: Cancellation approved
    CANCELLATION_REQUESTED --> PROCESSING: Cancellation rejected

    DELIVERED --> REFUNDED: Return processed
    CANCELLED --> REFUNDED: Refund issued

    REJECTED --> REFUNDED: Auto-refund
```

**Multi-Vendor Order Splitting:**
When a cart contains items from multiple sellers:
1. Parent order created with `Order.parentOrderId = null`
2. Child orders created per seller with `parentOrderId` referencing parent
3. Each child order has independent status lifecycle
4. Parent order status reflects worst-case child status
5. Stripe payment on parent; transfers to sellers via Connect

### 7.5 Cancellation Workflow

```mermaid
stateDiagram-v2
    [*] --> PENDING_SELLER: Customer requests cancellation
    PENDING_SELLER --> SELLER_APPROVED: Seller approves
    PENDING_SELLER --> REJECTED: Seller rejects
    PENDING_SELLER --> AUTO_APPROVED: Auto-approve (within threshold)

    SELLER_APPROVED --> PENDING_FINANCE: Requires finance review
    SELLER_APPROVED --> APPROVED: Below finance threshold

    PENDING_FINANCE --> FINANCE_APPROVED: Finance approves
    PENDING_FINANCE --> REJECTED: Finance rejects

    FINANCE_APPROVED --> APPROVED: Refund processed
    AUTO_APPROVED --> APPROVED: Refund processed

    REJECTED --> ESCALATED: Customer escalates
    ESCALATED --> APPROVED: Admin overrides
    ESCALATED --> REJECTED: Admin confirms rejection
```

---

## 8. Payment System

### 8.1 Stripe Integration Architecture

```mermaid
sequenceDiagram
    participant Customer
    participant Frontend
    participant API
    participant Stripe
    participant SellerConnect as Seller Stripe Connect

    Customer->>Frontend: Proceed to checkout
    Frontend->>API: POST /payments/create-intent
    API->>API: Calculate totals, apply discounts
    API->>Stripe: Create PaymentIntent
    Note over API,Stripe: With transfer_data for Connect splits
    Stripe-->>API: PaymentIntent (client_secret)
    API-->>Frontend: client_secret
    Frontend->>Stripe: confirmPayment(client_secret)
    Stripe-->>Frontend: Payment result

    Note over Stripe,API: Webhook Flow
    Stripe->>API: POST /payments/webhook
    API->>API: Verify signature (raw body)
    API->>API: Redis dedup check (event ID)
    API->>API: Process event
    API->>API: Update order status
    API->>API: Trigger notifications
    API->>SellerConnect: Transfer to seller (if Connect)
```

### 8.2 Payment Intents

- Created via `POST /payments/create-intent`
- Includes line items, shipping, tax, discounts, gift card balance
- Idempotency key: `Order.idempotencyKey` prevents duplicate charges
- Raw body parsing enabled (`rawBody: true`) for webhook signature verification

### 8.3 Stripe Connect (Multi-Vendor Splits)

- Sellers onboard via Stripe Connect Express accounts
- `Seller.stripeConnectAccountId` stores the connected account ID
- On payment: platform fee calculated from `Seller.commissionRate`
- Transfer created to seller's connected account after payment capture
- `Order.platformFeeAmount` records the platform's cut
- Onboarding status tracked: `stripeConnectOnboarded`, `stripeConnectPayoutsEnabled`

### 8.4 Gift Card Payment

- Gift cards can be applied as partial payment at checkout
- `GiftCard.balance` decremented; `GiftCardTransaction` records the redemption
- Remaining balance charged to Stripe
- HOS-native gift cards (`source: 'HOS'`) vs POS-bridged (`source: 'POS_VOUCHER'`)
- External balance source (`balanceSource: 'EXTERNAL'`) defers to Lightspeed

### 8.5 Loyalty Point Redemption at Checkout

- Points applied to cart via `POST /cart/loyalty-points`
- `Cart.pendingLoyaltyPoints` and `Cart.loyaltyDiscountAmount` track the discount
- `Cart.checkoutLockedAt` prevents race conditions during checkout
- On order completion, `LoyaltyTransaction` with `type: BURN` is created
- Idempotency key prevents double-burn

### 8.6 Webhook Handling

- Endpoint: `POST /payments/webhook`
- Stripe signature verification via `constructEvent` using `STRIPE_WEBHOOK_SECRET`
- Optional `x-provider` header (default: `stripe`)
- **Redis deduplication:** `SETNX stripe:webhook:{eventId}` with 7-day TTL; falls through gracefully if Redis is unavailable
- **Allow-listed events only:** success (`payment_intent.succeeded`, `charge.succeeded`), failure, dispute, refund events
- Side effects on success: idempotent `markPaymentAsPaid` → payment record + order status + vendor ledger + loyalty earn + POS inventory sync + marketing events

### 8.7 Stripe Provider Architecture

**Credential resolution (priority order):**
1. `IntegrationConfig` DB record (`PAYMENT` / `stripe`) — primary
2. Environment variables (`STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`) — fallback

**Circuit breaker:** 5 consecutive failures → 30-second circuit open; auto-resets on success

**Stripe API version:** `2023-10-16`

**Lazy initialization:** `StripeProvider` calls `ensureReady()` before every operation; initializes from Integrations DB if client not yet constructed

---

## 9. Loyalty System Technical Design

### 9.1 Architecture Overview

```mermaid
graph TB
    subgraph Earn["Earn Channels"]
        WEB_PURCHASE["Web Purchase"]
        POS_PURCHASE["POS Purchase"]
        QUIZ["Quiz Completion"]
        SOCIAL["Social Share"]
        REFERRAL["Referral"]
        EVENT["Event Attendance"]
        UGC["UGC Submission"]
        BRAND_CAMP["Brand Campaign"]
    end

    subgraph Engine["Points Engine"]
        EARN_RULES["Earn Rule Matcher"]
        MULTIPLIER["Tier Multiplier"]
        CAMPAIGN["Campaign Multiplier"]
        WALLET["Wallet Service"]
        TX["Transaction Ledger"]
    end

    subgraph Redeem["Redemption Channels"]
        WEB_REDEEM["Web Checkout Discount"]
        POS_VOUCHER["POS Gift Card Voucher"]
        POS_PROMO["POS Promo Code"]
        REWARD_CATALOG["Reward Catalog"]
    end

    WEB_PURCHASE --> EARN_RULES
    POS_PURCHASE --> EARN_RULES
    QUIZ --> EARN_RULES
    SOCIAL --> EARN_RULES
    REFERRAL --> EARN_RULES
    EVENT --> EARN_RULES
    UGC --> EARN_RULES
    BRAND_CAMP --> EARN_RULES

    EARN_RULES --> MULTIPLIER --> CAMPAIGN --> WALLET --> TX

    WALLET --> WEB_REDEEM
    WALLET --> POS_VOUCHER
    WALLET --> POS_PROMO
    WALLET --> REWARD_CATALOG
```

### 9.2 Points Engine

**Wallet Service:**
- Atomic balance operations using Prisma transactions
- `LoyaltyTransaction.idempotencyKey` with `@unique` constraint prevents double-earning
- Balance formula: `currentBalance = totalPointsEarned - totalPointsRedeemed - expired`
- Expiry: configurable per rule (`LOYALTY_POINTS_EXPIRY_MONTHS`, default 24)

**Earn Rules (`LoyaltyEarnRule`):**
- `action` field triggers matching (e.g., `PURCHASE`, `QUIZ_COMPLETE`, `SOCIAL_SHARE`)
- `pointsType`: FIXED (flat amount) or PERCENTAGE (of order value)
- Rate caps: `maxPerDay`, `maxPerMonth`, `maxPerUser`
- `multiplierStack`: whether tier multiplier applies
- Region scoping via `regionCodes[]`
- Time-bounded: `startsAt` / `endsAt`

**Tier System (`LoyaltyTier`):**
- Composite scoring: `spendWeight × spend + frequencyWeight × purchases + engagementWeight × engagement`
- Multiplier applied to all eligible earn transactions
- Auto-upgrade on threshold crossing; downgrade on tier expiry

### 9.3 POS Voucher System

Two redemption methods for burning points at HOS physical outlets:

**Method 1: Gift Card (`LOYALTY_POS_REDEMPTION_METHOD=GIFT_CARD`)**
1. Customer/staff burns N points → wallet deducted
2. API calls Lightspeed Gift Card API to create a gift card
3. `clientId` = `redemptionId` (stable idempotency key for retries)
4. Card number stored in `LoyaltyPosVoucher.cardNumber`
5. Staff scans gift card at register → Lightspeed deducts balance

**Method 2: Promo Code (`LOYALTY_POS_REDEMPTION_METHOD=PROMO_CODE`)**
1. Customer/staff burns N points → wallet deducted
2. API calls Lightspeed Promotions API to create one-time promo code
3. Promo code stored in `LoyaltyPosVoucher.promoCode`
4. Staff applies promo code at register → discount applied

**OTP Verification (Staff-Assisted, "A2" flow):**
1. Staff initiates redemption on behalf of customer
2. API generates 6-digit OTP, sends to customer via SMS/email
3. OTP hash stored in `LoyaltyPosRedeemOtp` with expiry (5 min)
4. Customer reads OTP to staff → staff submits for verification
5. Max 3 attempts; expired OTPs auto-cleaned

### 9.4 Referral System

- Members share referral codes via `LoyaltyReferral.referralCode`
- Referrer earns points on referee's first purchase
- Configurable: `referrerPoints` (default 500), `refereePoints` (default 200)
- Expiry prevents stale referrals

### 9.5 Ambassador Programme

- Unlocked at specific loyalty tier or by admin invitation
- `AmbassadorProfile` linked to `LoyaltyMembership`
- Tiers: ADVOCATE, CHAMPION, LEGEND
- UGC pipeline: submit → review → approve → award points
- Commission model: points-based (`commissionAsPoints: true`)

### 9.6 Brand Partnerships

- `BrandPartnership` with contract terms and budget
- `BrandCampaign` with multiplier or bonus points, targeted by fandom/brand/category
- Campaign mirrors `LoyaltyBonusCampaign` for earn-time matching
- Budget tracking: `totalBudget` vs `spentBudget`
- Attribution: `CampaignAttribution` daily snapshots for ROI

### 9.7 Loyalty Analytics Pipeline

**Daily Snapshot (`LoyaltyAnalyticsSnapshot`):**
- Cron job captures daily metrics:
  - Total members, active members (30d), new enrollments
  - Points issued, redeemed, expired, outstanding liability
  - Revenue from loyalty members (web + POS)
  - Tier distribution breakdown
  - Top fandoms by engagement
- Admin dashboard: `/admin/loyalty-analytics`

**CLV Scoring (`LoyaltyMembership`):**
- `clvScore`: Customer Lifetime Value prediction
- `predictedChurnRisk`: 0-1 probability of churn
- Factors: `totalSpend`, `purchaseCount`, `avgOrderValue`, `purchaseFrequency`, `firstPurchaseAt`, `lastPurchaseAt`
- Updated periodically via background job

**Campaign Attribution (`CampaignAttribution`):**
- Daily snapshots per campaign
- Tracks: orders influenced, revenue, points awarded, cost, unique users, ROI
- Supports brand campaigns, bonus campaigns, product campaigns

### 9.8 Points Flow Diagram

```mermaid
graph LR
    subgraph Earn["Points Earn"]
        PURCHASE["Purchase<br/>1pt per £1"]
        QUIZ["Quiz<br/>25-100 pts"]
        SOCIAL["Social Share<br/>10-50 pts"]
        REVIEW["Review<br/>25 pts"]
        REFERRAL["Referral<br/>500 pts"]
        EVENT["Event<br/>100 pts"]
        BIRTHDAY["Birthday<br/>200 pts"]
        UGC_EARN["UGC<br/>50-500 pts"]
    end

    subgraph Apply["Multipliers"]
        TIER_MULT["Tier Multiplier<br/>1.0x - 3.0x"]
        CAMPAIGN_MULT["Campaign Multiplier<br/>2.0x - 5.0x"]
        BRAND_MULT["Brand Multiplier<br/>1.5x - 3.0x"]
    end

    subgraph Wallet["Wallet"]
        BALANCE["Current Balance"]
        LEDGER["Transaction Ledger"]
        EXPIRY["Expiry Timer<br/>24 months"]
    end

    subgraph Burn["Points Burn"]
        CHECKOUT["Checkout Discount<br/>100pts = £1"]
        POS_GC["POS Gift Card"]
        POS_PC["POS Promo Code"]
        REWARD["Reward Catalog"]
    end

    PURCHASE --> TIER_MULT --> CAMPAIGN_MULT --> BALANCE
    QUIZ --> BALANCE
    SOCIAL --> BALANCE
    REVIEW --> BALANCE
    REFERRAL --> BALANCE
    EVENT --> BALANCE
    BIRTHDAY --> BALANCE
    UGC_EARN --> BALANCE

    BALANCE --> LEDGER
    BALANCE --> EXPIRY
    BALANCE --> CHECKOUT
    BALANCE --> POS_GC
    BALANCE --> POS_PC
    BALANCE --> REWARD
```

---

## 10. POS Integration — Lightspeed

### 10.1 OAuth Flow

```mermaid
sequenceDiagram
    participant Admin
    participant API
    participant Lightspeed

    Admin->>API: GET /pos/lightspeed/oauth/connect?storeId=X
    API->>Lightspeed: Redirect to OAuth authorize URL
    Lightspeed->>API: GET /pos/lightspeed/oauth/callback?code=Y
    API->>Lightspeed: POST /oauth/token (exchange code)
    Lightspeed-->>API: {access_token, refresh_token, expires_in}
    API->>API: Encrypt & store in POSConnection.credentials
    API-->>Admin: Redirect to admin with success
```

### 10.2 Connection Management

- `POSConnection` model: one per store
- Credentials encrypted at rest
- Auto-refresh: tokens refreshed before expiry
- `syncStatus`: `NEVER_SYNCED | SYNCED | SYNCING | ERROR`
- `lastSaleImportedAt`: durable cursor for incremental sales import

### 10.3 Product & Inventory Sync

- **Product sync:** Matches by SKU/barcode; creates `ExternalEntityMapping`
- **Inventory sync:** Updates `Product.stock` from Lightspeed quantities
- **Configurable:** `autoSyncProducts`, `autoSyncInventory`, `syncIntervalMinutes`

### 10.4 Sales Import Pipeline

1. Cron or manual trigger calls Lightspeed Sales API
2. Sales after `lastSaleImportedAt` cursor are fetched
3. Each sale creates `POSSale` + `POSSaleItem` records
4. Customer matching: email → phone → card number → `IdentityMatchReview` for ambiguous
5. Loyalty points earned calculated and credited
6. `lastSaleImportedAt` updated atomically

### 10.5 Customer Sync & Identity Matching

- Matches by: email (exact) → `phoneNormalized` (E.164) → loyalty card number
- Ambiguous matches queued in `IdentityMatchReview` for human review
- Reasons: `AMBIGUOUS_PHONE`, `AMBIGUOUS_EMAIL`, `NO_MATCH`, `MULTIPLE_MATCH`
- Admin resolves via `PATCH /pos/admin/identity-reviews/:id`

### 10.6 Gift Card Reconciliation

- POS-issued gift cards tracked in `GiftCard` with `source: 'POS_VOUCHER'`
- `balanceSource: 'EXTERNAL'` means Lightspeed is authoritative for balance
- `LoyaltyPosVoucher.clientId` provides idempotency for create/query operations
- TTL-based auto-reversal for unused vouchers (`ttlExpiresAt`)

### 10.7 POS Sync Flow Diagram

```mermaid
sequenceDiagram
    participant Cron
    participant API
    participant LS as Lightspeed API
    participant DB

    Note over Cron,DB: Periodic Sales Import
    Cron->>API: Trigger import job
    API->>DB: Get POSConnection (lastSaleImportedAt)
    API->>LS: GET /sales?after={cursor}&limit=250
    LS-->>API: Sales array + pagination
    loop For each sale
        API->>DB: Upsert POSSale + POSSaleItems
        API->>API: Match customer (email → phone → card)
        alt Exact match
            API->>DB: Link sale to user
            API->>API: Calculate loyalty points
            API->>DB: Create LoyaltyTransaction
        else Ambiguous match
            API->>DB: Create IdentityMatchReview
        else No match
            API->>DB: Store sale without user link
        end
    end
    API->>DB: Update lastSaleImportedAt cursor

    Note over Cron,DB: Product Sync
    Cron->>API: Trigger product sync
    API->>LS: GET /products?limit=250
    loop For each product
        API->>DB: Check ExternalEntityMapping (SKU)
        alt Mapped
            API->>DB: Update stock quantity
        else Not mapped
            API->>DB: Create mapping + log
        end
    end
```

### 10.8 Rate Limiting & Error Recovery

- Lightspeed API rate limits: respected via exponential backoff
- Token refresh: automatic before expiry using stored refresh token
- Connection health: `syncStatus` tracks current state
- Error logging: `POSConnection.syncError` stores last error message
- Retry strategy: 3 attempts with exponential backoff (1s, 4s, 16s)
- Dead letter: after max retries, error logged and admin notified
- Manual retry: admin can trigger re-sync via `POST /pos/admin/connections/:id/sync`

---

## 11. Accounting — Xero Integration

### 11.1 OAuth Connection

- OAuth 2.0 with PKCE via Xero OAuth API
- Callback: `/api/admin/accounting/oauth/callback`
- Credentials stored in `IntegrationConfig` (encrypted)
- Tenant ID: `XERO_TENANT_ID` environment variable

### 11.2 Daily Journal Generation

- Cron job (configurable: `ACCOUNTING_LEDGER_DRAIN_CRON`, default `*/10 * * * *`)
- Generates daily summary journals grouped by entry type:
  - `ONLINE_SALES` — marketplace order revenue
  - `REFUNDS` — refund journal entries
  - `POINTS_LIABILITY` — loyalty points outstanding liability
  - `GC_BRIDGE_RECLASS` — gift card balance reclassification
  - `HOS_GIFT_CARDS` — gift card issuance/redemption

### 11.3 Ledger Outbox Pattern

- `LedgerOutboxEntry` table acts as transactional outbox
- `idempotencyKey` (unique) prevents duplicate postings
- Status flow: `PENDING → POSTING → POSTED` (or `FAILED → retry → DEAD`)
- Max retry attempts tracked; dead-lettered entries require manual intervention
- `xeroJournalId` stored on successful posting

### 11.4 Chart of Accounts Mapping

- Configurable COA mapping via `IntegrationConfig.settings` JSON
- Default mapping covers: Revenue, Cost of Goods, Tax Collected, Shipping Revenue, Platform Fees, Loyalty Liability

### 11.5 Three-Way Reconciliation

Admin UI at `/admin/finance/three-way-recon`:
- Compares: HOS internal records ↔ Stripe transactions ↔ Xero journals
- Highlights: matched, amount mismatches, missing in any system
- `ReconciliationRun` + `ReconciliationItem` models track results

### 11.6 Journal Entry Structure

**Daily Revenue Journal (`REV-{YYYY-MM-DD}`):**
```json
{
  "date": "2025-01-15",
  "narration": "Daily marketplace revenue 2025-01-15",
  "lineItems": [
    { "accountCode": "200", "description": "Web Sales Revenue", "debit": 0, "credit": 12450.50 },
    { "accountCode": "200", "description": "POS Sales Revenue", "debit": 0, "credit": 8320.00 },
    { "accountCode": "491", "description": "Loyalty Points Liability", "debit": 0, "credit": 245.00 },
    { "accountCode": "310", "description": "Platform Commissions", "debit": 0, "credit": 2077.50 },
    { "accountCode": "400", "description": "Seller Payables", "debit": 18748.00, "credit": 0 },
    { "accountCode": "100", "description": "Bank - Stripe", "debit": 0, "credit": 0 },
    { "accountCode": "610", "description": "Shipping Revenue", "debit": 0, "credit": 890.00 },
    { "accountCode": "415", "description": "Gift Card Redemptions", "debit": 425.00, "credit": 0 },
    { "accountCode": "417", "description": "Refunds Issued", "debit": 1230.00, "credit": 0 }
  ]
}
```

**Seller Settlement Journal (`SETTLE-{sellerId}-{date}`):**
```json
{
  "date": "2025-01-15",
  "narration": "Seller settlement: Magic Emporium Ltd",
  "lineItems": [
    { "accountCode": "400", "description": "Payable cleared", "debit": 3250.00, "credit": 0 },
    { "accountCode": "310", "description": "Commission deducted", "debit": 0, "credit": 487.50 },
    { "accountCode": "101", "description": "Bank - Seller Transfer", "debit": 0, "credit": 2762.50 }
  ]
}
```

### 11.7 Chart of Accounts Mapping

| Xero Code | Account Name | Type | HOS Usage |
|-----------|-------------|------|-----------|
| 100 | Bank - Stripe | BANK | Stripe settlement account |
| 101 | Bank - Transfers | BANK | Seller payout transfers |
| 200 | Sales Revenue | REVENUE | Product sales (web + POS) |
| 310 | Platform Commissions | REVENUE | Marketplace commission |
| 400 | Seller Payables | CURRENT_LIABILITY | Amounts owed to sellers |
| 410 | VAT Collected | CURRENT_LIABILITY | Output VAT |
| 415 | Gift Card Liability | CURRENT_LIABILITY | Unredeemed gift cards |
| 417 | Refund Reserve | EXPENSE | Refund processing |
| 491 | Loyalty Liability | CURRENT_LIABILITY | Outstanding loyalty points |
| 500 | Cost of Goods Sold | DIRECT_COSTS | Product cost basis |
| 600 | Shipping Expense | EXPENSE | Carrier charges |
| 610 | Shipping Revenue | REVENUE | Customer shipping fees |
| 700 | Payment Processing | EXPENSE | Stripe fees |
| 800 | Marketing Expense | EXPENSE | Campaign costs |

### 11.8 Reconciliation

```mermaid
sequenceDiagram
    participant Cron
    participant API
    participant Xero as Xero API
    participant Stripe as Stripe API
    participant DB

    Cron->>API: Trigger daily reconciliation
    API->>DB: Get pending LedgerOutboxEntries
    API->>Stripe: Get settlement report (day)
    API->>Xero: Get bank statement lines
    API->>API: Match Stripe settlements to journals
    alt All matched
        API->>DB: Mark ReconciliationRun COMPLETED
    else Discrepancies found
        API->>DB: Create ReconciliationItem (UNMATCHED)
        API->>API: Notify finance team
    end
    API->>DB: Update run totals + stats
```

---

## 12. Shipping & Logistics

### 12.1 Multi-Carrier Architecture

The shipping system supports multiple carriers through a `CourierFactoryService` provider abstraction:

| Carrier | Integration | Credentials (IntegrationConfig) | Status |
|---------|------------|--------------------------------|--------|
| **Shippo** | REST API | `apiToken` (`shippo_live_` / `shippo_test_`) | Full (labels, rates, tracking, address validation) |
| **FedEx** | REST API | `apiKey`, `secretKey`, `accountNumber` | Rates + tracking (label placeholder) |
| **DHL** | REST API | `apiKey`, `accountNumber` | Rates + tracking (label placeholder) |
| **USPS** | REST API | `userId`, `apiKey` | Rates + tracking (label placeholder) |
| Manual carriers | `ShippingCarrier` table | N/A | Admin-managed for manual tracking |

**Runtime provider loading:** `CourierFactoryService.loadProviders()` reads active `IntegrationConfig` records (category `SHIPPING`); `refreshProviders()` reloads after integration changes.

**Rate fetching:** Quote negative cache (15s TTL), timeout (15s for rates, 30s for labels), retry with exponential backoff.

### 12.2 Rate Calculation

**Rule-based rates (`ShippingMethod` + `ShippingRule`):**
- Method types: `FLAT_RATE`, `WEIGHT_BASED`, `DISTANCE_BASED`, `FREE_SHIPPING`, `PICKUP_IN_STORE`, `HYPERLOCAL`
- Rules with conditions (weight range, cart value, country)
- `freeShippingThreshold` for automatic free shipping
- Priority-based rule matching

**Geographic rate tiers (Ship-from-Store):**
- `ShippingRateTier` defines country groups (e.g., Domestic, EU, International)
- `BoxSizeRate` = box size × destination tier → customer price
- `BoxSize` includes packaging cost for margin calculation

### 12.3 Label Generation

- Shippo integration creates shipping labels
- `ShipmentGroup.shippoTransactionId` links to Shippo transaction
- Label URL stored in `ShipmentGroup.labelUrl`
- Tracking code and URL automatically populated

### 12.4 Ship-from-Store Flow

```mermaid
stateDiagram-v2
    [*] --> NEW: POS sale triggers SFS
    NEW --> CUSTOMER_DETAILS_REQUIRED: Needs address
    CUSTOMER_DETAILS_REQUIRED --> AWAITING_PAYMENT: Details collected
    AWAITING_PAYMENT --> PAID: Stripe/counter payment
    PAID --> PACKING: Staff packing
    PACKING --> PACKED: Items verified
    PACKED --> LABEL_CREATED: Label printed
    LABEL_CREATED --> READY_FOR_PICKUP: Awaiting carrier
    READY_FOR_PICKUP --> HANDED_TO_CARRIER: Carrier collected
    HANDED_TO_CARRIER --> IN_TRANSIT: Carrier scan
    IN_TRANSIT --> DELIVERED: Confirmed delivery
```

### 12.5 Tax Calculation

Tax provider factory supporting:
- **Stripe Tax** — integrated with payment flow
- **Avalara** — external tax calculation API
- **TaxJar** — alternative tax provider
- **Internal** — `TaxZone` + `TaxClass` + `TaxRate` models
- Provider selected via `IntegrationConfig` settings

---

## 13. Search Architecture

### 13.1 Meilisearch Integration

- **Version:** v1.11 (Docker: `getmeili/meilisearch:v1.11`)
- **Client:** `meilisearch` npm package v0.41.0
- **Authentication:** Master key via `MEILISEARCH_MASTER_KEY`

### 13.2 Index Schema

Primary index: `products`

| Attribute | Type | Filterable | Sortable | Searchable |
|-----------|------|------------|----------|------------|
| `id` | string | ✓ | | |
| `name` | string | | | ✓ |
| `description` | string | | | ✓ |
| `sku` | string | ✓ | | ✓ |
| `price` | number | ✓ | ✓ | |
| `category` | string | ✓ | | ✓ |
| `fandom` | string | ✓ | | ✓ |
| `brand` | string | ✓ | | ✓ |
| `tags` | string[] | ✓ | | ✓ |
| `status` | string | ✓ | | |
| `sellerId` | string | ✓ | | |
| `averageRating` | number | ✓ | ✓ | |
| `reviewCount` | number | | ✓ | |
| `createdAt` | number | | ✓ | |

### 13.3 Sync Strategy

- **Full sync:** Triggered via `POST /meilisearch/sync` (admin only)
- **Incremental sync:** On product create/update/delete, individual document updated
- **Batch sync:** Periodic cron job re-indexes recently modified products
- **Webhook-based:** Product status changes trigger index updates

### 13.4 Faceted Search

Frontend product listing supports:
- Category facets (multi-level hierarchy)
- Fandom facets
- Price range filter
- Rating filter
- Availability filter
- Brand filter

### 13.5 Meilisearch Index Configuration

```typescript
// Product index settings
{
  searchableAttributes: [
    'name', 'description', 'shortDescription',
    'category', 'tags', 'brand', 'seller',
    'sku', 'barcode', 'variations.name'
  ],
  filterableAttributes: [
    'categoryId', 'status', 'price', 'salePrice',
    'inStock', 'sellerId', 'marketId', 'brandId',
    'tags', 'rating', 'createdAt', 'fandom',
    'variations.size', 'variations.color',
    'isExclusive', 'isPreOrder', 'condition'
  ],
  sortableAttributes: [
    'price', 'salePrice', 'createdAt', 'updatedAt',
    'rating', 'reviewCount', 'salesCount', 'name'
  ],
  rankingRules: [
    'words', 'typo', 'proximity', 'attribute',
    'sort', 'exactness'
  ],
  typoTolerance: {
    minWordSizeForTypos: { oneTypo: 4, twoTypos: 8 }
  },
  pagination: { maxTotalHits: 10000 },
  faceting: { maxValuesPerFacet: 200 }
}
```

### 13.6 Search Sync Pipeline

```mermaid
graph LR
    DB[(PostgreSQL)] -->|Prisma event| HOOK[Post-save Hook]
    HOOK --> QUEUE[BullMQ: search-sync]
    QUEUE --> WORKER[Sync Worker]
    WORKER -->|Batch upsert| MS[(Meilisearch)]
    CRON[Full Reindex Cron] -->|Weekly| WORKER
    ADMIN[Admin Trigger] -->|On demand| WORKER
```

- **Real-time sync**: product create/update/delete triggers BullMQ job
- **Batch processing**: worker batches up to 100 documents per Meilisearch call
- **Full reindex**: weekly cron or admin-triggered, processes all products
- **Index versioning**: blue-green index swap for zero-downtime reindexes
- **Health check**: periodic index stats check, alert if document count diverges > 5%

---

## 14. Caching & Queue Architecture

### 14.1 Redis Cache Strategy

**Connection:** `ioredis` with `REDIS_URL` (supports Redis 7)

**Cache layers:**
| Key Pattern | TTL | Purpose |
|-------------|-----|---------|
| `product:{id}` | 5 min | Product detail cache |
| `products:list:{hash}` | 2 min | Paginated product list |
| `cart:{userId}` | 30 min | Cart state |
| `user:{id}:roles` | 15 sec | Role assignment cache |
| `exchange-rate:{pair}` | 1 hour | Currency exchange rates |
| `webhook-dedup:{eventId}` | 24 hours | Stripe webhook deduplication |
| `rate-limit:{ip}:{route}` | 1 min | Rate limiting counters |
| `loyalty:membership:{userId}` | 5 min | Loyalty membership cache |

### 14.2 BullMQ Queue Setup

**Queue name:** `jobs` (single queue, multiple job types)

**Connection:** Shared Redis instance

**Job Types:**
| Job Name | Purpose | Retry |
|----------|---------|-------|
| `send-email` | Asynchronous email delivery | 3x exponential |
| `send-sms` | SMS delivery via Twilio | 3x |
| `send-whatsapp` | WhatsApp message delivery | 3x |
| `send-push` | Web push notification | 2x |
| `sync-search-index` | Meilisearch document sync | 3x |
| `process-webhook` | Outbound webhook delivery | 5x exponential |
| `import-pos-sales` | POS sales import batch | 3x |
| `sync-pos-products` | POS product sync | 3x |
| `drain-ledger-outbox` | Xero journal posting | 5x |
| `generate-settlement` | Seller payout calculation | 1x |
| `expire-loyalty-points` | Points expiry processing | 1x |
| `evaluate-segments` | Audience segment refresh | 1x |
| `journey-step` | Marketing journey step execution | 3x |

**Bull Board:** Available at `/api/admin/queues` (non-production only)

### 14.3 Webhook Deduplication

- Stripe event ID stored in Redis with 24h TTL
- Before processing, check `SETNX` with event ID
- If key exists → event already processed → return 200 (idempotent)
- Pattern prevents duplicate order fulfillment, double point credits

---

## 15. File Storage

### 15.1 Storage Providers

| Provider | SDK | Use Cases | Env Gate |
|----------|-----|-----------|----------|
| **AWS S3** | `@aws-sdk/client-s3` + `@aws-sdk/lib-storage` + `@aws-sdk/s3-request-presigner` | Product images, documents, exports, shipping labels | `STORAGE_PROVIDER=s3` |
| **Cloudinary** | `cloudinary` v2.8.0 | Image transformations, CDN delivery, responsive images | `STORAGE_PROVIDER=cloudinary` |
| **MinIO** | S3-compatible via `@aws-sdk/client-s3` | Self-hosted S3 alternative, development/testing | `STORAGE_PROVIDER=minio` |
| **Local** | Node.js `fs` | Development only | `STORAGE_PROVIDER=local` |

### 15.2 Upload Pipeline

1. Client uploads file via `POST /uploads` (Multer middleware)
2. **Content validation:** Magic-byte check for images; PDF header check for documents
3. Size limit: 10MB; allowed MIME types enforced
4. Image processing: `sharp` for resize/compress
5. Upload to configured provider based on `STORAGE_PROVIDER`
6. URL stored in relevant model (product image, avatar, document)

### 15.3 Signed URLs

- S3/MinIO pre-signed URLs generated for time-limited access
- `getSignedUrl(urlOrKey, expiresInSeconds)` — works with both full URLs and S3 keys
- Used for: invoice downloads, export files, sensitive documents
- Expiry: configurable, typically 1 hour

### 15.4 Cloudinary Direct Upload

- `getCloudinaryUploadSignature(folder, options?)` — generates signed upload params
- Enables direct client-to-Cloudinary uploads (bypasses API server for large files)
- Auto-optimization: format (WebP/AVIF), quality, resize

### 15.5 Storage Configuration Reference

| Variable | Provider |
|----------|----------|
| `STORAGE_PROVIDER` | `local` / `s3` / `minio` / `cloudinary` |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `AWS_S3_BUCKET` | S3 |
| `AWS_S3_ENDPOINT`, `AWS_S3_PUBLIC_URL` | S3 / R2 (custom endpoint) |
| `MINIO_ENDPOINT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `MINIO_BUCKET`, `MINIO_REGION` | MinIO |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Cloudinary |

---

## 16. Messaging & Notifications

### 16.1 Multi-Channel Architecture

| Channel | Provider | Package | Purpose |
|---------|----------|---------|---------|
| Email | SMTP (any provider) | `nodemailer` v9 | Transactional + marketing email |
| SMS | Twilio | `twilio` v5 | OTP, order updates |
| WhatsApp | WhatsApp Business API (Twilio) | `twilio` v5 | Customer conversations |
| Web Push | Web Push API | `web-push` v3 | Browser notifications |
| In-App | Database + SSE | Native | In-app notification center |

### 16.2 Template Engine

- `EmailTemplate` model: Handlebars-like variable substitution
- `WhatsAppTemplate` model: Meta-approved message templates
- Admin-managed via `/admin/templates`
- Variables: `{{firstName}}`, `{{orderNumber}}`, `{{loyaltyPoints}}`, etc.

### 16.3 Delivery Pipeline

```
Event (e.g., ORDER_CONFIRMED)
  → NotificationsService.send(userId, type, data)
    → Resolve user preferences (optInEmail, optInSms, optInWhatsApp, optInPush)
    → For each opted-in channel:
       → Render template with data
       → Enqueue BullMQ job (send-email / send-sms / send-whatsapp / send-push)
       → Create MessageLog entry (status: QUEUED)
    → Job processor:
       → Call provider API
       → Update MessageLog (SENT / FAILED)
       → Track delivery/open/click events
```

### 16.4 Email Delivery

**Primary:** SendGrid via Integrations DB (`EMAIL` / `sendgrid`) — `apiKey`, `fromEmail`, `fromName`
**Fallback:** SMTP (Nodemailer) via `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`
**Default from:** `noreply@houseofspells.com`

- HTML emails with inline CSS
- Admin email campaigns: `AdminEmailCampaign` model with audience targeting (max 2000 recipients per campaign)
- Campaign broadcasts: `/admin/email/compose`
- Consent-aware: only sends marketing emails to users with `optInEmail = true`

### 16.4.1 WhatsApp Integration

- **Provider:** Twilio WhatsApp Business API
- **Endpoint:** `POST /api/whatsapp/webhook` (inbound)
- **Webhook validation:** `twilio.validateRequest(authToken, signature, webhookUrl, body)` via `x-twilio-signature` header; fail-closed in production if auth token missing
- **Auto-link:** Matches inbound messages to `user.whatsappNumber` or seller phone
- **Conversations:** `WhatsAppConversation` + `WhatsAppMessage` models for thread tracking
- **Templates:** `WhatsAppTemplate` model for Meta-approved message templates with variable substitution

### 16.5 Marketing Automation (Journeys)

- `MarketingJourney`: Multi-step automated sequences
- Trigger events: `REGISTRATION`, `FIRST_PURCHASE`, `CART_ABANDONED`, `TIER_UPGRADE`, etc.
- Steps (JSON array): `WAIT`, `SEND_EMAIL`, `SEND_SMS`, `CHECK_CONDITION`, `ADD_TAG`
- `JourneyEnrollment` tracks user progress through journey
- Cron-based step executor advances enrolled users

```mermaid
graph TD
    TRIGGER[Trigger Event] --> ENROLL[Enroll User]
    ENROLL --> STEP1[Step 1: Wait 1 hour]
    STEP1 --> STEP2[Step 2: Send Welcome Email]
    STEP2 --> STEP3[Step 3: Wait 24 hours]
    STEP3 --> CHECK{Step 4: Did user purchase?}
    CHECK -->|Yes| STEP5A[Send Thank You + Bonus Points]
    CHECK -->|No| STEP5B[Send Reminder Email]
    STEP5B --> STEP6[Step 6: Wait 48 hours]
    STEP6 --> CHECK2{Step 7: Did user purchase?}
    CHECK2 -->|Yes| STEP5A
    CHECK2 -->|No| STEP8[Send Discount Offer]
    STEP5A --> END[Journey Complete]
    STEP8 --> END
```

### 16.6 Audience Segmentation

**`Audience` model** supports targeted message delivery:

| Segment Type | Criteria Examples |
|-------------|-------------------|
| Behavioral | Purchase frequency, last purchase date, cart abandonment |
| Demographic | Registration date, location, age group |
| Loyalty | Tier level, points balance, enrollment date |
| Engagement | Email open rate, click rate, app sessions |
| Custom | Tag-based, manual list upload |

**Segment Builder:**
- Admin creates segments via `/admin/marketing/audiences`
- Dynamic segments recalculate membership on query
- Static segments frozen at creation time
- Export: CSV download of segment members

### 16.7 Notification Preferences

Per-user opt-in/opt-out tracked in `User` model:
- `optInEmail`: Boolean (default true)
- `optInSms`: Boolean (default false)
- `optInWhatsApp`: Boolean (default false)
- `optInPush`: Boolean (default false)
- `communicationLanguage`: ISO 639-1 code
- Preference center: `/account/preferences`
- One-click unsubscribe links in all emails

### 16.8 Message Logging

`MessageLog` model tracks all sent messages:
| Field | Type | Purpose |
|-------|------|---------|
| `id` | UUID | Primary key |
| `channel` | Enum | EMAIL, SMS, WHATSAPP, PUSH, IN_APP |
| `recipientId` | UUID | Target user |
| `templateId` | UUID | Template used |
| `status` | Enum | QUEUED, SENT, DELIVERED, OPENED, CLICKED, BOUNCED, FAILED |
| `sentAt` | DateTime | When sent |
| `deliveredAt` | DateTime | Delivery confirmation |
| `openedAt` | DateTime | Open tracking (email) |
| `clickedAt` | DateTime | Click tracking (email) |
| `errorMessage` | String | Failure reason |
| `metadata` | JSON | Provider response, message ID |

---

## 17. Integrations Framework

### 17.1 Provider Registry

The `IntegrationConfig` model provides a centralized registry for all third-party integrations:

| Category | Providers |
|----------|-----------|
| PAYMENT | Stripe |
| SHIPPING | Shippo, FedEx |
| TAX | Stripe Tax, Avalara, TaxJar |
| EMAIL | SMTP (Nodemailer), SendGrid |
| SMS | Twilio |
| STORAGE | AWS S3, Cloudinary |
| SEARCH | Meilisearch |
| ANALYTICS | (configurable) |
| POS | Lightspeed |
| ACCOUNTING | Xero |
| OAUTH | Google, Facebook, Apple |

### 17.2 Credential Encryption

- `IntegrationConfig.credentials`: Encrypted JSON string
- Encryption key: `INTEGRATION_ENCRYPTION_KEY` environment variable
- Required in production (validated at bootstrap)
- Decrypted only at runtime when API calls are made

### 17.3 Connection Testing

- Each integration supports `POST /integrations/:id/test`
- Tests API connectivity with stored credentials
- Updates `lastTestedAt`, `testStatus`, `testMessage`
- Statuses: `SUCCESS`, `FAILED`, `NEVER_TESTED`

### 17.4 Integration Logging

- `IntegrationLog` records all API calls
- Fields: action, endpoint, method, statusCode, duration, sanitized request/response
- Sensitive data (API keys, tokens) stripped from logs
- Admin viewable at `/admin/settings/integrations`

---

## 18. Monitoring & Observability

### 18.1 Sentry Error Tracking

- DSN configured via `SENTRY_DSN` environment variable
- Traces sample rate: `SENTRY_TRACES_SAMPLE_RATE` (default 0.1 = 10%)
- **4xx filtering:** `beforeSend` hook drops client errors (400-499 status)
- Request context: correlation ID, user ID, route
- `SentryExceptionFilter` captures all unhandled exceptions

### 18.2 OpenTelemetry Tracing

- `@opentelemetry/sdk-node` with auto-instrumentations
- OTLP HTTP exporter for trace data
- Resource attributes: service name, version, environment
- Initialized before NestJS bootstrap (`initTracing()` at top of `main.ts`)
- Graceful shutdown: `shutdownTracing()` on SIGTERM/SIGINT

### 18.3 Health Checks

| Endpoint | Purpose | Response |
|----------|---------|----------|
| `GET /api/health` | Full health check (DB, Redis, Meilisearch) | 200 with component status |
| `GET /api/health/live` | Kubernetes liveness probe | 200 if process alive |
| `GET /api/health/ready` | Kubernetes readiness probe | 200 if all deps ready |

Railway health check: `/api/health/live` with 300s timeout, 10 retries on failure.

### 18.4 Activity Logging

- `ActivityLog` model captures user actions
- Logged via `ActivityInterceptor` (global) and explicit service calls
- Fields: userId, sellerId, action, entityType, entityId, description, metadata, IP, userAgent
- Admin viewable at `/admin/activity`

### 18.5 Correlation IDs

- `CorrelationIdMiddleware` applied to all routes
- Propagates `X-Correlation-ID` header or generates UUID
- Uses Node.js `AsyncLocalStorage` for request-scoped context
- Included in all log entries and Sentry tags

### 18.6 Monitoring Interceptor

The `MonitoringInterceptor` (global) captures:
- Request duration (ms)
- HTTP method and route
- Response status code
- User ID (if authenticated)
- Tenant/store context
- Memory usage (RSS, heap)

Metrics are logged and forwarded to Sentry performance monitoring.

### 18.7 Request Pipeline Observability

```mermaid
graph LR
    REQ[Incoming Request] --> CID[CorrelationId Middleware]
    CID --> HELMET[Helmet Headers]
    HELMET --> CSRF[CSRF Check]
    CSRF --> CORS[CORS Validation]
    CORS --> AUTH[JWT Auth Guard]
    AUTH --> ACCESS[Access Guard]
    ACCESS --> THROTTLE[Rate Limiter]
    THROTTLE --> MONITOR[Monitoring Interceptor]
    MONITOR --> ACTIVITY[Activity Interceptor]
    ACTIVITY --> VALIDATE[ValidationPipe]
    VALIDATE --> CONTROLLER[Controller]
    CONTROLLER --> RESPONSE[Response]
    RESPONSE -->|Error| SENTRY[Sentry Exception Filter]
    RESPONSE -->|Success| PAGINATE[Pagination Cap Interceptor]
    PAGINATE --> CLIENT[Client]
    SENTRY --> CLIENT
```

### 18.8 Alert Configuration

| Alert | Condition | Channel |
|-------|-----------|---------|
| API Error Spike | >50 5xx in 5 min | Sentry → Slack |
| Health Check Failure | 3 consecutive failures | Railway → Email |
| Queue Backlog | >1000 pending jobs | Custom monitor → Slack |
| Memory Warning | >90% heap usage | Sentry performance |
| Slow Response | p95 > 5s | OpenTelemetry → Sentry |
| Database Connection Pool | >80% utilization | Prisma metrics |
| Redis Connection Lost | Connection error event | ioredis event handler |
| Stripe Webhook Failure | 3 consecutive failures | BullMQ dead letter → admin notification |
| Certificate Expiry | <30 days to expiry | Cron check → email |
| Disk Usage | >85% | Railway metrics |

---

## 19. Security

### 19.1 CORS & CSRF Protection

**CORS:**
- Allowed origins: `FRONTEND_URL` + `CORS_ALLOWED_ORIGINS` + `CORS_RAILWAY_ORIGINS`
- Origin normalization: trailing slashes stripped, case-sensitive comparison
- Credentials: `true` (allows HttpOnly cookies)
- Preflight: custom OPTIONS handler responds with 204
- Max age: 86400 seconds (24 hours)
- Blocked origins receive 403

**CSRF:**
- State-changing requests (POST/PUT/PATCH/DELETE) must include `Origin` header
- If Origin present → must be in allowed list
- If Origin absent + auth cookies present + no Bearer/API-Key/XHR → blocked (403)
- Server-to-server requests (no cookies) are allowed

### 19.2 Helmet Security Headers

```javascript
helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      frameAncestors: ["'self'", frontendUrl],
    },
  },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  noSniff: true,
  crossOriginEmbedderPolicy: false,
})
```

### 19.3 CSP Nonce (Frontend)

- Next.js middleware generates per-request cryptographic nonce
- Injected into CSP `script-src` directive
- All inline scripts must include `nonce` attribute

### 19.4 GDPR Compliance

- `GDPRConsentLog`: Tracks consent grants/revocations with timestamps
- Consent types: MARKETING, ANALYTICS, ESSENTIAL, SHIPPING
- `GDPRModule` endpoints: export user data, request deletion
- `User.gdprConsent` + `gdprConsentDate` fields
- Right to erasure: soft delete (`User.deletedAt`) + data anonymization

### 19.5 Secret Management

- All secrets via environment variables (never in code)
- `validateEnvironment()` on bootstrap checks required vars
- Production-specific validations:
  - `JWT_SECRET` minimum 32 characters
  - `INTEGRATION_ENCRYPTION_KEY` required
- Swagger docs protected by HTTP Basic Auth in production
- Gitleaks secret scanning in CI pipeline

### 19.6 Rate Limiting

- `@nestjs/throttler` with per-route configuration
- Default: 60 req/min/IP
- Auth endpoints: stricter limits (5 login attempts/min)
- API key endpoints: higher limits for trusted clients

### 19.7 Input Validation

- All DTOs validated via `class-validator` decorators
- `ValidationPipe`: whitelist mode strips unknown fields
- `forbidNonWhitelisted`: rejects requests with extra fields
- `sanitize-html` for user-generated content
- Body size limit: 10MB (JSON + URL-encoded)

### 19.8 Encryption

- Passwords: bcrypt (salt rounds 10-15, default 12)
- Refresh tokens: bcrypt hash stored in DB
- Integration credentials: AES encryption via `INTEGRATION_ENCRYPTION_KEY`
- Seller bank details: encrypted fields (`accountNumberEnc`, `sortCodeEnc`)
- OAuth tokens: encrypted in `OAuthAccount`

---

## 20. DevOps & Deployment

### 20.1 CI/CD Pipeline

#### `ci.yml` — Lint, Test & Build
**Triggers:** Push/PR to `master`, `main`, `develop`

**Jobs:**
1. **PostgreSQL 15 service container** — Test database
2. **Install dependencies** — `pnpm install --frozen-lockfile`
3. **Security audit** — `pnpm audit --audit-level=critical` (soft fail)
4. **Generate Prisma client** — `npx prisma generate`
5. **Push schema to test DB** — `npx prisma db push`
6. **Build shared packages** — shared-types, utils, theme-system, api-client
7. **Type check** — API and Web in parallel (`tsc --noEmit`)
8. **Run API tests with coverage** — Jest with coverage reporters
9. **Coverage threshold check** — Hard floor: 40%, regression baseline: 54%
10. **Build** — API and Web in parallel

#### `deploy.yml` — Production Deploy
**Triggers:** After CI passes on `master` (workflow_run), or manual dispatch

**Jobs:**
1. **Gate** — Verify CI passed (or manual dispatch)
2. **Verify RAILWAY_TOKEN** — Check GitHub secret exists
3. **Deploy API** — `railway up --service @hos-marketplace/api --environment production`
4. **Deploy Web** — `railway up --service @hos-marketplace/web --environment production`
5. **Smoke Test** — Wait 60s, then:
   - API: retry `/api/health/live` up to 10 times (10s interval)
   - API: check `/api/health` for 200
   - Web: check root URL for 200

#### `deploy-staging.yml` — Staging Deploy
**Triggers:** After CI passes on `develop`, or manual dispatch
**Jobs:** Same as production but targeting `--environment staging`
**Smoke Test:** Uses `STAGING_API_URL` and `STAGING_WEB_URL` secrets

#### `secret-scan.yml` — Secret Scanning
**Triggers:** Push/PR to `master`, `main`, `develop`
**Jobs:** Gitleaks v2 with full git history scan

### 20.2 Docker Configuration

**`docker-compose.yml` (local development):**

| Service | Image | Port | Purpose |
|---------|-------|------|---------|
| `postgres` | `postgres:15-alpine` | 5432 | Database |
| `redis` | `redis:7-alpine` | 6379 | Cache + queues |
| `meilisearch` | `getmeili/meilisearch:v1.11` | 7700 | Search engine |
| `api` | Built from `Dockerfile` | 3001 | NestJS API |
| `web` | Built from `apps/web/Dockerfile` | 3000 | Next.js frontend |

All services have health checks. API depends on postgres + redis being healthy.

### 20.3 Railway Deployment

**`railway.toml`:**
```toml
[build]
builder = "DOCKERFILE"

[deploy]
healthcheckPath = "/api/health/live"
healthcheckTimeout = 300
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 10
```

**Environments:**
| Environment | Branch | Purpose |
|-------------|--------|---------|
| `production` | `master` | Live production |
| `staging` | `develop` | Pre-production testing |

### 20.4 Environment Variables Reference

See [Appendix C](#appendix-c-environment-variables-reference) for the complete list.

### 20.5 Branch Strategy

| Branch | Purpose | Deploys To |
|--------|---------|------------|
| `master` / `main` | Production-ready code | Production (Railway) |
| `develop` | Integration branch | Staging (Railway) |
| `feature/*` | Feature development | CI only (PR checks) |
| `hotfix/*` | Production fixes | Merged to master + develop |

### 20.6 Cloudflare CDN

- All production domains proxied through Cloudflare
- SSL/TLS: Full (strict) mode
- Caching: Static assets cached at edge
- WAF: Standard security rules enabled
- DNS: All `*.houseofspells.com` subdomains managed

### 20.7 Docker Build Optimization

**Multi-stage Dockerfile (`Dockerfile`):**

```dockerfile
FROM node:20-slim AS base
RUN npm i -g pnpm@10.28.2
WORKDIR /app

# Stage 1: Install dependencies (cacheable layer)
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/*/package.json ./packages/  # Wildcard for shared packages
COPY services/api/package.json ./services/api/
RUN pnpm install --frozen-lockfile

# Stage 2: Build
FROM deps AS builder
COPY . .
RUN pnpm --filter @hos-marketplace/shared-types build
RUN pnpm --filter @hos-marketplace/api build

# Stage 3: Production runtime
FROM base AS runner
RUN groupadd -r nodejs && useradd -r -g nodejs appuser
COPY --from=builder --chown=appuser:nodejs /app/dist ./dist
COPY --from=builder --chown=appuser:nodejs /app/node_modules ./node_modules
USER appuser
EXPOSE 3001
CMD ["node", "dist/main.js"]
```

**Key optimizations:**
- 4-layer caching: base → deps → build → runtime
- Dependency install cached unless lockfile changes
- Sequential shared package builds (dependency order)
- Non-root user (`appuser:nodejs`) for security
- Slim base image (node:20-slim) reduces attack surface

### 20.8 Deployment Topology

```mermaid
graph TB
    subgraph CF["Cloudflare"]
        DNS[DNS]
        CDN[CDN/WAF]
        SSL[SSL Termination]
    end

    subgraph Railway["Railway Platform"]
        subgraph Prod["Production"]
            API_P[API Service<br/>NestJS]
            WEB_P[Web Service<br/>Next.js]
            PG_P[(PostgreSQL 15)]
            RD_P[(Redis 7)]
            MS_P[(Meilisearch)]
        end
        subgraph Staging["Staging"]
            API_S[API Service]
            WEB_S[Web Service]
            PG_S[(PostgreSQL)]
            RD_S[(Redis)]
            MS_S[(Meilisearch)]
        end
    end

    subgraph External["External Services"]
        STRIPE[Stripe]
        LS_EXT[Lightspeed]
        XERO[Xero]
        S3[AWS S3]
        CLOUD[Cloudinary]
        TWILIO[Twilio]
        SENTRY_EXT[Sentry]
    end

    DNS --> CDN --> SSL
    SSL --> API_P
    SSL --> WEB_P

    API_P --> PG_P
    API_P --> RD_P
    API_P --> MS_P
    API_P --> STRIPE
    API_P --> LS_EXT
    API_P --> XERO
    API_P --> S3
    API_P --> CLOUD
    API_P --> TWILIO
    API_P --> SENTRY_EXT
```

### 20.9 Scaling Considerations

| Component | Current | Scaling Strategy |
|-----------|---------|-----------------|
| API | Single Railway instance | Horizontal: multiple Railway replicas behind load balancer |
| Web | Single Railway instance | Horizontal: multiple replicas + ISR CDN caching |
| PostgreSQL | Railway managed | Vertical: upgrade plan; then read replicas |
| Redis | Railway managed | Vertical: upgrade plan; then Redis Cluster |
| Meilisearch | Railway managed | Vertical: upgrade plan; then multi-node cluster |
| BullMQ Workers | In-process | Separate worker processes, then dedicated worker service |
| File Storage | S3 + Cloudinary | Already horizontally scalable |

**Recommended scaling triggers:**
- API: >80% CPU sustained 5 min → add replica
- PostgreSQL: >500 active connections → add read replica
- Redis: >80% memory → upgrade instance
- BullMQ: >1000 pending jobs sustained → add worker

---

## 21. Testing Strategy

### 21.1 Unit Tests (Jest)

- Framework: Jest v29 with ts-jest
- Location: Co-located `*.spec.ts` files
- Coverage: Minimum 40% lines (hard floor), 54% baseline (regression guard)
- CI: `jest --coverage --coverageReporters=text,json-summary`
- Mocking: Prisma client, external services mocked via Jest

**Test file naming convention:**
```
services/api/src/
├── auth/
│   ├── auth.service.ts
│   ├── auth.service.spec.ts      ← Unit test
│   ├── auth.controller.ts
│   └── auth.controller.spec.ts   ← Controller test
├── orders/
│   ├── orders.service.ts
│   ├── orders.service.spec.ts
│   └── ...
```

**Common test patterns:**
```typescript
// Service test with mocked Prisma
describe('AuthService', () => {
  let service: AuthService;
  let prisma: DeepMockProxy<PrismaClient>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockDeep<PrismaClient>() },
        { provide: JwtService, useValue: { sign: jest.fn(), verify: jest.fn() } },
      ],
    }).compile();

    service = module.get(AuthService);
    prisma = module.get(PrismaService);
  });

  it('should validate user credentials', async () => {
    prisma.user.findUnique.mockResolvedValue(mockUser);
    const result = await service.validateUser('test@example.com', 'password');
    expect(result).toBeDefined();
  });
});
```

### 21.2 E2E Tests (Playwright)

- Framework: Playwright v1.57
- Location: `apps/web/e2e/` or `apps/web/tests/`
- Covers: Critical user flows (auth, checkout, admin operations)

**Test suites:**
| Suite | Covers |
|-------|--------|
| `auth.spec.ts` | Login, registration, password reset, OAuth |
| `checkout.spec.ts` | Cart → checkout → payment → confirmation |
| `admin-products.spec.ts` | Product CRUD, image upload, variant management |
| `admin-orders.spec.ts` | Order list, detail, status update, refund |
| `seller.spec.ts` | Seller dashboard, product submission, earnings |
| `loyalty.spec.ts` | Enrollment, points display, redemption |
| `search.spec.ts` | Product search, filters, pagination |

### 21.3 API Verification Scripts

| Script | Purpose |
|--------|---------|
| `scripts/verify-api-endpoints.mjs` | Verify all registered routes match expected |
| `scripts/verify-deployment.ts` | Post-deploy health verification |
| `scripts/verify-oauth-table.ts` | Verify OAuth table exists |
| `scripts/verify-env-vars.ts` | Validate environment variables |
| `scripts/verify-db-tables.mjs` | Verify database tables exist |

### 21.4 Database Seed Scripts

| Script | Purpose |
|--------|---------|
| `db:seed-users` | Create test users for all 14 roles |
| `db:seed-products` | Generate sample products with variants |
| `db:seed-categories` | Build category hierarchy |
| `db:seed-loyalty` | Create loyalty tiers, earn rules, test memberships |
| `db:seed-orders` | Generate sample orders with various statuses |
| `db:seed-stores` | Create test stores and market configuration |
| `db:seed-permissions` | Set up custom permission roles |
| `db:seed-pos` | Create POS connection and sample sales |
| `db:seed-shipping` | Set up shipping methods and rate tiers |
| `db:seed-all` | Run all seeds in dependency order |

### 21.5 CI Coverage Strategy

```mermaid
graph LR
    subgraph CI["CI Pipeline"]
        TESTS[Jest Tests] --> COV[Coverage Report]
        COV --> FLOOR{Lines >= 40%?}
        FLOOR -->|No| FAIL[❌ Hard Fail]
        FLOOR -->|Yes| BASELINE{Lines >= 54%?}
        BASELINE -->|No| WARN[⚠️ Warning: Regression]
        BASELINE -->|Yes| PASS[✅ Pass]
    end
```

- **Hard floor (40%)**: Absolute minimum; prevents merging untested code
- **Regression baseline (54%)**: Current coverage level; warns if coverage drops
- **Coverage reports**: `text` (console), `json-summary` (CI parsing)
- **Per-file thresholds**: Not enforced globally, but tracked per module

### 21.6 Manual Test Checklists

Documented in `/docs/`:
- `MANUAL_TESTING_CHECKLIST.md` — General QA checklist
- `QA-Testing-Manual.md` — Comprehensive QA manual
- `ENCHANTED_CIRCLE_MANUAL_TEST_PLAN.md` — Loyalty system test plan
- `LOYALTY_AND_GIFT_CARD_MANUAL_TEST_PLAN.md` — Gift card test plan
- `STAGING_SMOKE_TEST.md` — Staging deployment verification

---

## 22. Feature Flags & Configuration

### 22.1 Runtime Feature Flags

Feature flags are controllable via environment variables and the admin API (`/admin/feature-flags`):

| Flag | Default | Purpose |
|------|---------|---------|
| `FF_FOUNDING_MEMBERS` | true | Founding member registration |
| `FF_EMAIL_TEMPLATE_OVERRIDES` | true | Custom email templates |
| `FF_LOYALTY_PROGRAMME` | true | Enchanted Circle loyalty |
| `FF_AMBASSADOR_PROGRAMME` | true | Ambassador features |
| `FF_BRAND_PARTNERSHIPS` | true | Brand partnership campaigns |
| `FF_CLICK_COLLECT` | true | Click & Collect orders |
| `FF_DIGITAL_PRODUCTS` | true | Digital product delivery |
| `FF_INFLUENCER_STOREFRONTS` | true | Influencer custom storefronts |
| `FF_GUEST_CHECKOUT` | true | Guest checkout flow |
| `FF_AI_RECOMMENDATIONS` | false | AI product recommendations |
| `FF_POS_INTEGRATION` | false | Lightspeed POS |
| `FF_MULTI_CURRENCY` | false | Multi-currency support |
| `FF_ACCOUNTING_XERO` | false | Xero accounting integration |

### 22.2 Platform Settings

- `PlatformSetting` model: category + key = value (DB-stored)
- Categories: `feature_flag`, `site`, `social`, `loyalty`, `shipping`
- Admin CRUD at `/admin/settings/config`
- Cached in Redis with short TTL

### 22.3 Shop Gate Mechanism

- `SHOP_STATUS` environment variable or `PlatformSetting(site, shop_status)`
- When shop is "coming_soon": all product/checkout routes redirect to `/coming-soon`
- Admin routes always accessible regardless of shop status
- BFF route `/api/shop-status` provides status to frontend middleware

---

## Appendices

### Appendix A: Complete API Endpoint List

The API exposes approximately **1,079 routes** across 130+ controllers. Major controller route counts:

| Controller | Routes | Domain |
|-----------|--------|--------|
| `store-shipment.controller.ts` | 43 | Ship-from-store |
| `loyalty-admin.controller.ts` | 39 | Loyalty admin |
| `admin.controller.ts` | 23 | Platform admin |
| `inventory.controller.ts` | 25 | Inventory management |
| `cms.controller.ts` | 20 | CMS content |
| `sellers.controller.ts` | 19 | Seller management |
| `loyalty.controller.ts` | 18 | Loyalty member |
| `auth.controller.ts` | 17 | Authentication |
| `pos-admin.controller.ts` | 17 | POS administration |
| `brand-partnerships-admin.controller.ts` | 17 | Brand partnerships |
| `shipping.controller.ts` | 17 | Shipping management |
| `tax.controller.ts` | 16 | Tax management |
| `blog.controller.ts` | 16 | Blog management |
| `loyalty-analytics.controller.ts` | 15 | Loyalty analytics |
| `influencers.controller.ts` | 15 | Influencer management |
| `orders.controller.ts` | 14 | Order management |
| `partner-referrals-admin.controller.ts` | 14 | Partner referrals |
| `segmentation-admin.controller.ts` | 14 | Audience segments |
| `events-admin.controller.ts` | 13 | Event management |
| `integrations.controller.ts` | 13 | Integration config |
| `themes.controller.ts` | 13 | Theme management |
| `gallery.controller.ts` | 12 | Gallery management |
| `vendor-products.controller.ts` | 12 | Vendor products |
| `access-control.controller.ts` | 12 | RBAC management |
| `accounting-admin.controller.ts` | 11 | Xero accounting |
| `ambassador.controller.ts` | 10 | Ambassador programme |
| `founding-members.controller.ts` | 10 | Founding members |
| `promotions.controller.ts` | 10 | Promotions engine |
| `journey-admin.controller.ts` | 10 | Journey automation |
| `stores/store-admin.controller.ts` | 10 | Store management |
| Other controllers (100+) | ~500+ | Various domains |

### Appendix B: Database Schema Summary

**175 Prisma models** organized across 17 domains. See [Section 5.2](#52-all-175-prisma-models-by-domain) for the complete listing with key fields and descriptions.

**52 Enums defined:**
`UserRole`, `ProductStatus`, `ProductType`, `VendorStatus`, `VendorProductStatus`, `OrderStatus`, `PaymentStatus`, `CancellationStatus`, `ReviewStatus`, `ReturnStatus`, `ReturnItemStatus`, `SettlementStatus`, `InvitationStatus`, `SellerType`, `ProductSubmissionStatus`, `LogisticsOption`, `ShipmentStatus`, `MaterialType`, `VisibilityLevel`, `ThemeType`, `ImageType`, `NotificationType`, `NotificationStatus`, `VerificationDocStatus`, `TagCategory`, `AttributeType`, `PromotionType`, `PromotionStatus`, `CouponStatus`, `CustomerGroupType`, `ShippingMethodType`, `TransactionType`, `TransactionStatus`, `DiscrepancyType`, `DiscrepancySeverity`, `DiscrepancyStatus`, `DisputeStatus`, `ReconciliationStatus`, `ReconciliationItemType`, `ReconciliationItemStatus`, `FinancialPeriodStatus`, `TicketCategory`, `TicketPriority`, `TicketStatus`, `ConversationStatus`, `MessageDirection`, `MessageStatus`, `LedgerEntryType`, `LoyaltyTxType`, `MovementType`, `TransferStatus`, `ReservationStatus`, `DeliveryStatus`, `InfluencerStatus`, `InfluencerTier`, `CampaignStatus`, `CommissionStatus`, `PayoutStatus`, `BlogStatus`

### Appendix C: Environment Variables Reference

#### Required Variables

| Variable | Example | Purpose |
|----------|---------|---------|
| `DATABASE_URL` | `postgresql://user:pass@host:5432/db` | PostgreSQL connection |
| `JWT_SECRET` | (min 32 chars) | Access token signing key |
| `JWT_REFRESH_SECRET` | (min 32 chars) | Refresh token signing key |

#### Server Configuration

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | `3001` | API server port |
| `NODE_ENV` | `development` | Environment mode |
| `FRONTEND_URL` | `http://localhost:3000` | Frontend URL for CORS |
| `CORS_ALLOWED_ORIGINS` | | Additional CORS origins (comma-separated) |
| `CORS_RAILWAY_ORIGINS` | | Railway-specific CORS origins |

#### Authentication

| Variable | Default | Purpose |
|----------|---------|---------|
| `JWT_EXPIRATION` | `15m` | Access token TTL |
| `REFRESH_TOKEN_TTL` | `30d` | Refresh token TTL |
| `BCRYPT_SALT_ROUNDS` | `12` | Password hash cost |

#### External Services

| Variable | Purpose |
|----------|---------|
| `REDIS_URL` | Redis connection string |
| `STRIPE_SECRET_KEY` | Stripe API key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `MEILISEARCH_HOST` | Meilisearch URL |
| `MEILISEARCH_API_KEY` | Meilisearch master key |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | SMTP configuration |
| `SMTP_FROM` | Email from address |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_S3_BUCKET` / `AWS_S3_REGION` | S3 storage |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | Cloudinary |
| `SENTRY_DSN` | Sentry error tracking |
| `SENTRY_TRACES_SAMPLE_RATE` | Sentry trace sampling (0.0-1.0) |
| `INTEGRATION_ENCRYPTION_KEY` | Encryption key for integration credentials |

#### Loyalty Programme

| Variable | Default | Purpose |
|----------|---------|---------|
| `LOYALTY_ENABLED` | `true` | Enable loyalty programme |
| `LOYALTY_DEFAULT_EARN_RATE` | `1` | Points per currency unit |
| `LOYALTY_DEFAULT_REDEEM_VALUE` | `0.01` | Currency value per point |
| `LOYALTY_MIN_REDEMPTION_POINTS` | `100` | Minimum redeemable points |
| `LOYALTY_CARD_PREFIX` | `HOS` | Card number prefix |
| `LOYALTY_POINTS_EXPIRY_MONTHS` | `24` | Points expiry period |
| `LOYALTY_POS_VOUCHER_ENABLED` | `false` | POS voucher redemption |
| `LOYALTY_POS_REDEMPTION_METHOD` | `GIFT_CARD` | POS method (GIFT_CARD/PROMO_CODE) |
| `LOYALTY_REDEMPTION_AT_CHECKOUT` | `true` | Checkout points burn |
| `FOUNDING_MEMBER_BONUS_POINTS` | `500` | Founding member bonus |

#### Xero Accounting

| Variable | Purpose |
|----------|---------|
| `ACCOUNTING_ENABLED` | Enable Xero integration |
| `XERO_CLIENT_ID` | Xero OAuth client ID |
| `XERO_CLIENT_SECRET` | Xero OAuth client secret |
| `XERO_REDIRECT_URI` | OAuth callback URL |
| `XERO_TENANT_ID` | Xero tenant/organization ID |
| `ACCOUNTING_LEDGER_DRAIN_CRON` | Outbox drain schedule |

#### Access Control

| Variable | Default | Purpose |
|----------|---------|---------|
| `ACCESS_CONTROL_MODE` | `legacy` | RBAC mode (legacy/hybrid/strict) |
| `ACCESS_CONTROL_MODULE_MODES` | | Per-module override (e.g., `orders:shadow`) |
| `ACCESS_CONTROL_DATA_SCOPE` | `legacy` | Data scope mode |
| `ACCESS_CONTROL_STRICT_COVERAGE` | `false` | Require all routes have access decorators |
| `ACCESS_CONTROL_ASSIGNMENT_TTL_MS` | `15000` | Role assignment cache TTL |
| `ACCESS_CONTROL_ASSIGNMENT_CACHE_MAX` | `5000` | Cache size limit |

#### Feature Flags

| Variable | Default | Purpose |
|----------|---------|---------|
| `FF_FOUNDING_MEMBERS` | `true` | Founding member registration |
| `FF_LOYALTY_PROGRAMME` | `true` | Enchanted Circle |
| `FF_AMBASSADOR_PROGRAMME` | `true` | Ambassador programme |
| `FF_BRAND_PARTNERSHIPS` | `true` | Brand partnerships |
| `FF_CLICK_COLLECT` | `true` | Click & Collect |
| `FF_GUEST_CHECKOUT` | `true` | Guest checkout |
| `FF_POS_INTEGRATION` | `false` | Lightspeed POS |
| `FF_MULTI_CURRENCY` | `false` | Multi-currency |
| `FF_ACCOUNTING_XERO` | `false` | Xero integration |

### Appendix D: Third-Party Service Credentials Map

| Service | Credential Variables | Storage |
|---------|---------------------|---------|
| **PostgreSQL** | `DATABASE_URL` | Environment |
| **Redis** | `REDIS_URL` | Environment |
| **Stripe** | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Environment |
| **Meilisearch** | `MEILISEARCH_HOST`, `MEILISEARCH_API_KEY` | Environment |
| **SMTP** | `SMTP_HOST/PORT/USER/PASS` | Environment |
| **AWS S3** | `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | Environment |
| **Cloudinary** | `CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET` | Environment |
| **Sentry** | `SENTRY_DSN` | Environment |
| **Google OAuth** | Client ID/Secret | IntegrationConfig (encrypted) |
| **Facebook OAuth** | App ID/Secret | IntegrationConfig (encrypted) |
| **Apple Sign In** | Service ID/Key | IntegrationConfig (encrypted) |
| **Twilio** | Account SID, Auth Token | IntegrationConfig (encrypted) |
| **Lightspeed POS** | OAuth tokens per connection | POSConnection (encrypted) |
| **Xero** | OAuth tokens | IntegrationConfig (encrypted) |
| **Shippo** | API Token | IntegrationConfig (encrypted) |
| **FedEx** | API Key, Account Number | IntegrationConfig (encrypted) |

### Appendix E: Existing Documentation Index

All 43 documents in `/docs/`:

| File | Description |
|------|-------------|
| `ADMIN_CONFIGURATION_GUIDE.md` | Admin panel configuration guide |
| `CROSS_SELLER_DUPLICATES.md` | Cross-seller duplicate detection system |
| `DEPLOY_AND_TEST.md` | Deployment and testing procedures |
| `DTO_FLOW_BLOCKERS_ANALYSIS.md` | DTO validation flow analysis |
| `DUPLICATES_API_VERIFICATION.md` | Duplicate detection API verification |
| `ENCHANTED_CIRCLE_COMPOSER2_BUILD_SPEC.md` | Loyalty system build specification |
| `ENCHANTED_CIRCLE_MANUAL_TEST_PLAN.md` | Loyalty manual test plan |
| `ENDPOINTS_AND_NAVIGATION_AUDIT.md` | API endpoint and navigation audit |
| `FRONTEND_FORMS_ISO_UPDATE_GUIDE.md` | ISO country code update guide |
| `HOS-Marketplace-Comprehensive-Overview.md` | Platform comprehensive overview |
| `IN_STORE_SHIPPING_USER_FLOWS.md` | Ship-from-store user flow documentation |
| `ISO_COUNTRY_CODE_IMPLEMENTATION.md` | ISO country code implementation guide |
| `LOYALTY_AND_GIFT_CARD_ADMIN_CONFIGURATION_GUIDE.md` | Loyalty/gift card admin guide |
| `LOYALTY_AND_GIFT_CARD_MANUAL_TEST_PLAN.md` | Loyalty/gift card test plan |
| `LOYALTY_AND_GIFT_CARD_PROCESS_GUIDE.md` | Loyalty/gift card business process |
| `LOYALTY_CUSTOMER_LEDGER_360_CHALLENGES_AND_ROADMAP.md` | Customer 360 roadmap |
| `MANUAL_TESTING_CHECKLIST.md` | General QA checklist |
| `MEILISEARCH.md` | Meilisearch setup and configuration |
| `NEW_MARKET_ONBOARDING_RUNBOOK.md` | New market (country) onboarding |
| `NEXT_STEPS.md` | Development roadmap and next steps |
| `OPEN_BUSINESS_QUESTIONS.md` | Open business decisions |
| `PHASE_10_ADVANCED_FEATURES_GLOBAL_READINESS_BUILD_SPEC.md` | Phase 10 build spec |
| `PHASE_2_POS_INTEGRATION_BUILD_SPEC.md` | POS integration build spec |
| `PHASE_3_EXTENDED_EARN_FANDOM_PROFILES_BUILD_SPEC.md` | Fandom profiles build spec |
| `PHASE_4_MARKETING_AUTOMATION_BUILD_SPEC.md` | Marketing automation build spec |
| `PHASE_5_EVENT_EXPERIENCE_MANAGEMENT_BUILD_SPEC.md` | Events build spec |
| `PHASE_6_SEGMENTATION_ENGINE_BUILD_SPEC.md` | Segmentation engine build spec |
| `PHASE_7_AMBASSADOR_PROGRAMME_BUILD_SPEC.md` | Ambassador programme build spec |
| `PHASE_8_BRAND_PARTNERSHIP_BUILD_SPEC.md` | Brand partnership build spec |
| `PHASE_9_ANALYTICS_CLV_ATTRIBUTION_BUILD_SPEC.md` | Analytics/CLV build spec |
| `PRISMA_6_UPGRADE_IMPACT_ANALYSIS.md` | Prisma 6 upgrade analysis |
| `PRISMA_MIGRATE_DEV_FIX.md` | Prisma migration troubleshooting |
| `PRODUCT_UPLOAD_USER_FLOW.md` | Product upload flow documentation |
| `QA-Testing-Manual.md` | Comprehensive QA testing manual |
| `RAILWAY_ACCOUNT_AND_DEPLOY.md` | Railway account and deployment guide |
| `RAILWAY_BRANCH_AND_DEPLOY.md` | Railway branch deployment guide |
| `RAILWAY_ENV_INTEGRATION_AND_MEILISEARCH.md` | Railway environment setup |
| `SMM_BLOG_AND_TRACKING_GUIDE.md` | Social media and blog guide |
| `STAGING_DEPLOYMENT_CHECKLIST.md` | Staging deployment checklist |
| `STAGING_SMOKE_TEST.md` | Staging smoke test procedures |
| `THE_ENCHANTED_CIRCLE_IMPLEMENTATION_PLAN.md` | Loyalty implementation plan |
| `VERIFICATION_RESULTS.md` | Deployment verification results |

**Additional files in `/docs/`:**
- `archive/` — Archived documentation
- `assessment-dependency-status-update.csv` — Dependency assessment
- `hos-recommendations-sheet-corrected.csv` — Recommendations tracker
- `hos-recommendations-status-update.csv` — Recommendations status
- `update-assessment-sheet.gs` — Google Sheets update script
- `update-hos-recommendations-sheet.gs` — Recommendations update script

---

*This document is the master IT reference for the HOS Marketplace platform. It should be updated as the architecture evolves. Last updated: September 29, 2026.*
