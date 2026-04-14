# HOS Marketplace — Comprehensive Technical Overview

> **Document Date:** April 14, 2026
> **Scope:** Current state of the House of Spells (HOS) marketplace platform — tech stack, functionalities, third-party APIs, and user journeys.

---

## Table of Contents

1. [Platform Overview](#1-platform-overview)
2. [Tech Stack](#2-tech-stack)
3. [Architecture Diagram](#3-architecture-diagram)
4. [Functionalities](#4-functionalities)
5. [Required Third-Party APIs & Services](#5-required-third-party-apis--services)
6. [User Roles](#6-user-roles)
7. [User Journeys](#7-user-journeys)
8. [Data Model (Key Entities)](#8-data-model-key-entities)
9. [API Surface Summary](#9-api-surface-summary)
10. [Deployment & Infrastructure](#10-deployment--infrastructure)

---

## 1. Platform Overview

HOS Marketplace is a **multi-vendor, multi-tenant e-commerce platform** built around the "fandom" niche (House of Spells). It supports B2C sellers, wholesalers, influencers, and multiple internal staff roles — all managed from a single monorepo.

**Key characteristics:**
- Multi-vendor marketplace with seller storefronts and custom subdomains
- Multi-tenant architecture (tenants, stores, per-tenant config)
- Fandom-centric product taxonomy (fandoms, characters, collections)
- Gamification layer (quests, badges, leaderboards, loyalty points)
- AI-powered chat assistance (Google Gemini)
- Influencer program with storefronts, commissions, and campaign management
- Full back-office with role-based staff portals (procurement, fulfillment, catalog, marketing, finance, CMS)

---

## 2. Tech Stack

### 2.1 Monorepo & Build Tooling

| Layer | Technology | Version |
|-------|-----------|---------|
| Monorepo manager | **pnpm** workspaces | — |
| Build orchestration | **Turborepo** | ^1.11.2 |
| Language | **TypeScript** | ^5.3.3 |
| Code formatting | **Prettier** | ^3.1.1 |
| Node runtime | **Node.js** | >=18 (Dockerfile uses 20) |

### 2.2 Frontend — Web (`apps/web`)

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | **Next.js** (App Router) | ^14.2.35 |
| UI library | **React** | ^18.3.1 |
| Styling | **Tailwind CSS** + PostCSS + Autoprefixer | ^3.4.0 |
| UI components | **Headless UI** (^1.7.17), **Heroicons** (^2.2.0) |
| Data fetching | **TanStack React Query** | ^5.90.21 |
| Virtualization | **TanStack React Virtual** | ^3.12.2 |
| Charts | **Recharts** | ^2.10.3 |
| Maps | **Leaflet** + **react-leaflet** | ^1.9.4 / ^4.2.1 |
| Date utilities | **date-fns** | ^3.0.6 |
| Toast notifications | **react-hot-toast** | ^2.6.0 |
| Auth (client) | Custom `AuthContext` (JWT + cookies) | — |
| E2E testing | **Playwright** | ^1.57.0 |

### 2.3 Frontend — Mobile (`apps/mobile`)

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | **Expo** | ~50.0.0 |
| Routing | **expo-router** | ~3.4.0 |
| Runtime | **React Native** | 0.73.0 |
| Navigation | **React Navigation** | ^6.1.9 |

### 2.4 Backend API (`services/api`)

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | **NestJS** | ^10.3.x |
| ORM | **Prisma** | ^6.0.0 |
| Database | **PostgreSQL** | 15 |
| Cache | **Redis** (ioredis) | 7 / ^5.3.2 |
| Search engine | **Meilisearch** | v1.11 |
| Queue / jobs | **BullMQ** + **Bull Board** | ^5.3.0 |
| Auth | **Passport** (JWT, Local, Google, Facebook, Apple) + **@nestjs/jwt** | ^10.2.0 |
| Payments | **Stripe** SDK | ^14.9.0 |
| File storage | **AWS S3** SDK (^3.490.0), **Cloudinary** (^2.8.0) |
| Email | **Nodemailer** (SMTP) | ^6.9.7 |
| Monitoring | **Sentry** (node + tracing) | ^7.18.0 |
| API docs | **Swagger** (@nestjs/swagger) | ^7.1.17 |
| Rate limiting | **@nestjs/throttler** | ^5.0.1 |
| Security | **Helmet**, **compression**, **cookie-parser**, **bcrypt** | — |
| PDF generation | **PDFKit** | ^0.14.0 |
| Excel export | **ExcelJS** | ^4.4.0 |
| Zip handling | **adm-zip** | ^0.5.10 |
| Validation | **class-validator** + **class-transformer** | ^0.14.0 / ^0.5.1 |
| Testing | **Jest** + **Supertest** | ^29.7.0 / ^6.3.3 |

### 2.5 Shared Packages (`packages/`)

| Package | Purpose |
|---------|---------|
| `@hos-marketplace/shared-types` | Shared TypeScript types and interfaces (User, UserRole, Product, etc.) |
| `@hos-marketplace/api-client` | Typed REST client consumed by web and mobile apps |
| `@hos-marketplace/utils` | Common utility functions |
| `@hos-marketplace/theme-system` | Theme management (seller storefronts) |
| `@hos-marketplace/cms-client` | CMS (Strapi) client |
| `@hos-marketplace/events` | Event-driven architecture (NestJS microservices + Redis) |
| `@hos-marketplace/observability` | Sentry integration for all services |

---

## 3. Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                        CLIENTS                                   │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────────────┐ │
│  │  Next.js Web │   │  Expo Mobile │   │  Seller Subdomains   │ │
│  │  (App Router)│   │  (React      │   │  {slug}.hos.com      │ │
│  │  Port 3000   │   │   Native)    │   │  (rewrite → /sellers)│ │
│  └──────┬───────┘   └──────┬───────┘   └──────────┬───────────┘ │
└─────────┼──────────────────┼──────────────────────┼─────────────┘
          │                  │                      │
          ▼                  ▼                      ▼
┌──────────────────────────────────────────────────────────────────┐
│                   NestJS API (services/api)                      │
│                   Global Prefix: /api                            │
│                   Versioning: /api/v1/                           │
│  ┌────────┐ ┌──────────┐ ┌────────┐ ┌───────────┐ ┌──────────┐ │
│  │  Auth  │ │ Products │ │ Orders │ │ Payments  │ │ Sellers  │ │
│  │Passport│ │ Catalog  │ │  Cart  │ │  Stripe   │ │Influencer│ │
│  │JWT/OAuth│ │ Search  │ │ Ship   │ │  Connect  │ │ Finance  │ │
│  └────────┘ └──────────┘ └────────┘ └───────────┘ └──────────┘ │
│  ┌────────┐ ┌──────────┐ ┌────────┐ ┌───────────┐ ┌──────────┐ │
│  │  CMS   │ │Marketing │ │Support │ │   Admin   │ │   AI     │ │
│  │ Strapi │ │Promotions│ │Tickets │ │ Dashboard │ │ Gemini   │ │
│  └────────┘ └──────────┘ └────────┘ └───────────┘ └──────────┘ │
└───────┬──────────┬──────────┬──────────┬──────────┬─────────────┘
        │          │          │          │          │
        ▼          ▼          ▼          ▼          ▼
┌────────────┐ ┌────────┐ ┌──────────┐ ┌────────┐ ┌──────────────┐
│ PostgreSQL │ │ Redis  │ │Meilisearch│ │AWS S3 / │ │   Stripe     │
│   (DB)     │ │(Cache/ │ │ (Search) │ │Cloudinary│ │ (Payments)   │
│            │ │ Queue) │ │          │ │(Storage) │ │              │
└────────────┘ └────────┘ └──────────┘ └────────┘ └──────────────┘
```

---

## 4. Functionalities

### 4.1 Authentication & Authorization
- Email/password registration and login
- OAuth login (Google, Facebook, Apple)
- JWT access tokens + refresh tokens (httpOnly cookies)
- Password reset via email link
- Account lockout after failed login attempts
- Team invitation system (`/auth/accept-invitation`)
- Role-based access control (RBAC) with 12 user roles
- Custom permission roles (fine-grained DB-stored permissions)
- Admin role impersonation ("view as" any role)

### 4.2 Storefront & Product Discovery
- Homepage with hero banners, featured products, and fandom collections
- Product listing with filtering, sorting, and pagination
- Full-text product search powered by Meilisearch
- Fandom-based browsing (`/fandoms`, `/fandoms/[slug]`)
- Seller storefronts with custom themes (`/sellers/[slug]`)
- Multi-tenant seller subdomains (`{slug}.houseofspells.com`)
- Product detail pages with images, variants, and reviews
- Collections management and curated lists
- Recently viewed products tracking
- Currency selector with multi-currency support

### 4.3 Shopping & Checkout
- Persistent server-side cart (authenticated users)
- Add to cart with quantity and variation options
- Cart management (update quantity, remove items)
- Coupon/promo code application
- Shipping cost calculation
- Tax calculation (Stripe Tax provider)
- Multi-step checkout flow (`/cart` → `/checkout` → `/payment`)
- Stripe payment processing
- Order confirmation and tracking (`/track-order`)

### 4.4 Order Management
- Customer order history and order detail views
- Order status tracking with timeline
- Seller order management dashboard
- Wholesaler bulk order support
- Admin order oversight and management
- Return request system (`/returns`, `/returns/[id]`)
- Configurable return policies per seller
- Invoice generation (PDF via PDFKit)

### 4.5 Seller/Vendor Management
- Seller onboarding flow (`/seller/onboarding`)
- Seller application and admin approval workflow
- Seller profile with store branding (logo, description)
- Product submission and approval pipeline
- Bulk product import (Excel/CSV via `/seller/products/bulk`)
- Seller dashboard with sales analytics
- Theme customization for seller storefronts
- Seller types: B2C Seller, Wholesaler
- Vendor status tracking (PENDING, APPROVED, etc.)
- Commission rate configuration per seller
- Subscription plan management
- Custom domain and subdomain support

### 4.6 Wholesaler Features
- Dedicated wholesaler onboarding and dashboard
- Bulk order management
- Wholesaler-specific product submission
- Bulk import functionality
- B2B customer fields (company name, VAT, credit terms)

### 4.7 Influencer Program
- Influencer invitation system (`/influencer-invite/[token]`)
- Influencer dashboard with earnings tracking
- Product link generation and tracking
- Influencer storefront pages
- Commission tracking and payouts
- Campaign management (admin-driven)
- Short-link support (`/i/[slug]`)

### 4.8 Admin Panel
- **Dashboard:** Platform-wide KPIs and analytics
- **User management:** CRUD, role assignment, activity logs, privacy audit
- **Order operations:** Orders, shipments, returns, discrepancies
- **Seller oversight:** Applications, analytics, vendor products
- **Product management:** CRUD, pricing, reviews, bundles, volume pricing
- **Taxonomy:** Categories, attributes, tags
- **Influencer management:** Profiles, invitations, commissions, payouts, campaigns
- **Finance:** Pricing rules, settlements, payouts, reports (fees, revenue)
- **Promotions:** Coupon and promotion management
- **Marketing:** Newsletter, campaigns
- **Support:** Ticket management, WhatsApp integration
- **Search:** Meilisearch index management
- **Settings:** Integrations (shipping, tax), webhooks, domains
- **Themes:** Platform theme management
- **Reports:** Sales, users, products, platform, inventory
- **Compliance:** GDPR audit, data processing consent
- **Logistics:** Fulfillment centers, warehouses, transfers, inventory
- **Publishing:** Content publishing workflow
- **Templates:** Reusable templates
- **Migration tools:** Taxonomy and data migration features

### 4.9 Staff Portals (Role-Based)

| Portal | URL Prefix | Key Features |
|--------|-----------|--------------|
| **Procurement** | `/procurement/` | Dashboard, submission review |
| **Fulfillment** | `/fulfillment/` | Dashboard, fulfillment centers, shipment management |
| **Catalog** | `/catalog/` | Dashboard, catalog entry management |
| **Marketing** | `/marketing/` | Dashboard, materials, campaigns |
| **Finance** | `/finance/` | Dashboard, pricing, payouts, fee and revenue reports |
| **CMS** | `/cms/` | Dashboard, pages, banners, blog, media library, settings |

### 4.10 CMS (Content Management)
- Page management (create/edit landing pages)
- Banner and carousel management
- Blog content management
- Media library (image uploads and management)
- CMS settings configuration
- Cache revalidation webhook from Strapi

### 4.11 Gamification & Engagement
- Loyalty points system (earn and redeem)
- Badges and achievements (`UserBadge`)
- Quests system (`/quests`)
- Leaderboard (`/leaderboard`)
- Gamification points and levels
- Fandom quizzes (`FandomQuiz` component)
- Character avatars

### 4.12 AI Features
- AI-powered chat interface (`AIChatInterface` component)
- Google Gemini integration for conversational AI
- AI preferences stored per user

### 4.13 Communication & Notifications
- In-app notification system (`NotificationBell` component)
- Email notifications via SMTP/Nodemailer (queued via BullMQ)
- WhatsApp integration (Twilio)
- Newsletter subscription management
- Support ticket system with messaging

### 4.14 Gift Cards
- Gift card purchase flow (`/gift-cards/purchase`)
- Gift card catalog and detail pages
- Gift card redemption

### 4.15 Social Features
- Wishlist management
- Social sharing (`SocialShare` component)
- Product reviews and ratings
- User collections

### 4.16 Digital Products
- Digital product listings and delivery
- Download management (`/downloads`)

### 4.17 Compliance & Privacy
- GDPR consent banner and tracking
- GDPR consent logs
- Data processing consent management
- Privacy policy page
- "Do Not Sell" page
- Privacy audit (admin)

### 4.18 Geolocation & Multi-Currency
- Geolocation detection for country/currency
- Multi-currency support with currency selector
- Currency preference stored per user

### 4.19 Analytics & Reporting
- Platform analytics dashboard
- Seller analytics
- Financial reports (sales, revenue, fees)
- User reports
- Product reports
- Inventory reports
- Data export (Excel via ExcelJS)

---

## 5. Required Third-Party APIs & Services

### 5.1 Core Infrastructure Services

| Service | Purpose | Environment Variables | Required? |
|---------|---------|----------------------|-----------|
| **PostgreSQL 15** | Primary database | `DATABASE_URL` | **Yes** |
| **Redis 7** | Caching, session data, BullMQ job queue | `REDIS_URL` | **Yes** |
| **Meilisearch v1.11** | Full-text product search engine | `MEILISEARCH_HOST`, `MEILISEARCH_API_KEY` | **Yes** |

### 5.2 Payment Processing

| Service | Purpose | Environment Variables | Required? |
|---------|---------|----------------------|-----------|
| **Stripe** | Payment processing, checkout | `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY` | **Yes** |
| **Stripe Webhooks** | Payment event handling | `STRIPE_WEBHOOK_SECRET` | **Yes** |
| **Stripe Connect** | Seller payouts, multi-vendor splits | (via Stripe SDK) | **Yes** |
| **Stripe Tax** | Automated tax calculation | (via Stripe SDK) | Optional |

### 5.3 Authentication (OAuth Providers)

| Service | Purpose | Environment Variables | Required? |
|---------|---------|----------------------|-----------|
| **Google OAuth** | Social login | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Optional |
| **Facebook OAuth** | Social login | `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET` | Optional |
| **Apple Sign-In** | Social login | `APPLE_CLIENT_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY` | Optional |

### 5.4 File Storage

| Service | Purpose | Environment Variables | Required? |
|---------|---------|----------------------|-----------|
| **AWS S3** | Product images, documents, uploads | `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET`, `AWS_S3_REGION` | One required |
| **Cloudinary** | Image optimization, transformations, signed uploads | `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | One required |
| **MinIO** | S3-compatible self-hosted storage (dev/alternative) | (same S3 env vars) | Alternative |

> Storage provider is configurable via `STORAGE_PROVIDER` (values: `local`, `s3`, `minio`, `cloudinary`).

### 5.5 Email & Communication

| Service | Purpose | Environment Variables | Required? |
|---------|---------|----------------------|-----------|
| **SMTP Provider** (e.g., SendGrid, SES, Mailgun) | Transactional email | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | **Yes** |
| **Twilio** (WhatsApp) | WhatsApp messaging | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_NUMBER` | Optional |

### 5.6 AI & Intelligence

| Service | Purpose | Environment Variables | Required? |
|---------|---------|----------------------|-----------|
| **Google Gemini** | AI chat, product recommendations | `GEMINI_API_KEY` | Optional |

### 5.7 CMS

| Service | Purpose | Environment Variables | Required? |
|---------|---------|----------------------|-----------|
| **Strapi** (Headless CMS) | Content management for pages, blogs, banners | `STRAPI_URL`, `STRAPI_API_TOKEN` | Optional |
| **CMS Webhook** | Cache revalidation | `CMS_REVALIDATE_SECRET` | Optional |

### 5.8 Shipping Providers

| Service | Purpose | Files |
|---------|---------|-------|
| **FedEx** | Shipping rate calculation, label generation | `shipping/courier/providers/fedex.provider.ts` |
| **DHL** | Shipping rate calculation, label generation | `shipping/courier/providers/dhl.provider.ts` |

### 5.9 Monitoring & Error Tracking

| Service | Purpose | Environment Variables | Required? |
|---------|---------|----------------------|-----------|
| **Sentry** | Error tracking, performance monitoring | `SENTRY_DSN`, `SENTRY_TRACES_SAMPLE_RATE` | Optional |

### 5.10 Deployment

| Service | Purpose | Config Files |
|---------|---------|-------------|
| **Railway** | Cloud deployment (API + Web) | `railway.toml` |
| **Docker** | Containerization | `Dockerfile`, `docker-compose.yml` |

### 5.11 Integration Catalog (Metadata-Configured)

The `IntegrationsService` maintains a catalog of additional integrations configurable via admin settings:

| Integration | Category |
|-------------|----------|
| USPS | Shipping |
| Avalara | Tax |
| TaxJar | Tax |
| SendGrid | Email |

---

## 6. User Roles

| Role | Description | Dashboard URL |
|------|-------------|---------------|
| `CUSTOMER` | End-user / buyer | `/customer/dashboard` |
| `WHOLESALER` | B2B buyer with bulk ordering | `/wholesaler/dashboard` |
| `B2C_SELLER` | Individual / business seller | `/seller/dashboard` |
| `SELLER` | Legacy seller role (deprecated → B2C_SELLER) | `/seller/dashboard` |
| `ADMIN` | Platform administrator (full access) | `/admin/dashboard` |
| `INFLUENCER` | Affiliate / content creator | `/influencer/dashboard` |
| `PROCUREMENT` | Procurement staff | `/procurement/dashboard` |
| `FULFILLMENT` | Fulfillment / warehouse staff | `/fulfillment/dashboard` |
| `CATALOG` | Catalog management staff | `/catalog/dashboard` |
| `MARKETING` | Marketing team | `/marketing/dashboard` |
| `FINANCE` | Finance / accounting team | `/finance/dashboard` |
| `CMS_EDITOR` | Content editor | `/cms/dashboard` |
| `SALES` | Sales team (DB enum, portal TBD) | — |

---

## 7. User Journeys

### 7.1 Guest → Customer Purchase Journey

```
Landing Page (/)
    │
    ├── Browse Products (/products)
    │     └── Filter by fandom, category, price
    │
    ├── Explore Fandoms (/fandoms)
    │     └── Fandom Detail (/fandoms/[slug])
    │           └── Products in fandom
    │
    ├── Search Products (Header SearchBar)
    │     └── Meilisearch-powered results
    │
    ├── Explore Sellers (/sellers)
    │     └── Seller Storefront (/sellers/[slug])
    │
    └── Product Detail (/products/[id])
          ├── View images, description, reviews
          ├── Select variants
          └── Add to Cart
                │
                ▼
          Login/Register (/login)
          ├── Email + Password
          ├── Google OAuth
          ├── Facebook OAuth
          └── Apple Sign-In
                │
                ▼
          Cart (/cart)
          ├── Review items
          ├── Update quantities
          ├── Apply coupon code
          └── Proceed to Checkout
                │
                ▼
          Checkout (/checkout)
          ├── Shipping address
          ├── Shipping method
          └── Review order
                │
                ▼
          Payment (/payment)
          ├── Stripe payment processing
          └── Order confirmation
                │
                ▼
          Order Tracking
          ├── Order Detail (/orders/[id])
          └── Track Order (/track-order)
```

### 7.2 Customer Account Journey

```
Login (/login)
    │
    ▼
Customer Dashboard (/customer/dashboard)
    │
    ├── Profile (/profile)
    │     └── Change Password (/profile/change-password)
    │
    ├── Orders (/orders)
    │     └── Order Detail (/orders/[id])
    │           └── Request Return (/returns)
    │                 └── Return Detail (/returns/[id])
    │
    ├── Wishlist (/wishlist)
    │     └── Move to Cart
    │
    ├── Collections (/collections)
    │     ├── Browse collections
    │     └── Create collection (/collections/new)
    │
    ├── Gift Cards (/gift-cards)
    │     └── Purchase (/gift-cards/purchase)
    │
    ├── Downloads (/downloads)
    │     └── Digital product downloads
    │
    ├── Notifications (/notifications)
    │
    ├── Quests (/quests)
    │     └── Complete quests → earn points/badges
    │
    ├── Leaderboard (/leaderboard)
    │
    └── Support
          ├── Knowledge Base (/support/kb)
          ├── New Ticket (/support/new)
          └── My Tickets (/support/tickets)
```

### 7.3 Seller Onboarding & Management Journey

```
Register as Seller
    │
    ▼
Seller Onboarding (/seller/onboarding)
    ├── Business details
    ├── Store branding (name, logo, description)
    ├── Country & region
    └── Submit application
          │
          ▼
    [Admin Approval Process]
          │
          ▼
Seller Dashboard (/seller/dashboard)
    │
    ├── Submit Product (/seller/submit-product)
    │     ├── Product details, images, pricing
    │     ├── Taxonomy (category, fandom, attributes, tags)
    │     └── Submit for approval → Submissions (/seller/submissions)
    │
    ├── My Products (/seller/products)
    │     └── Edit, deactivate, manage inventory
    │
    ├── Bulk Import (/seller/products/bulk)
    │     └── Upload Excel/CSV for mass product creation
    │
    ├── Orders (/seller/orders)
    │     └── View, process, ship customer orders
    │
    ├── Profile (/seller/profile)
    │     └── Update store info, branding
    │
    └── Themes (/seller/themes)
          └── Customize storefront appearance
```

### 7.4 Wholesaler Journey

```
Register as Wholesaler
    │
    ▼
Wholesaler Onboarding (/wholesaler/onboarding)
    ├── Business registration details
    ├── Company name, VAT, business type
    └── Submit application
          │
          ▼
Wholesaler Dashboard (/wholesaler/dashboard)
    │
    ├── Submit Product (/wholesaler/submit-product)
    ├── My Products (/wholesaler/products)
    ├── Bulk Orders (/wholesaler/orders)
    ├── Submissions (/wholesaler/submissions)
    ├── Bulk Import (/wholesaler/bulk)
    ├── Profile (/wholesaler/profile)
    └── Themes (/wholesaler/themes)
```

### 7.5 Influencer Journey

```
Receive Invitation Email
    │
    ▼
Accept Invitation (/influencer-invite/[token])
    │
    ▼
Complete Registration
    │
    ▼
Influencer Dashboard (/influencer/dashboard)
    │
    ├── Earnings (/influencer/earnings)
    │     └── View commissions and payout history
    │
    ├── Product Links (/influencer/product-links)
    │     └── Generate trackable product links
    │     └── Short links (/i/[slug])
    │
    ├── Storefront (/influencer/storefront)
    │     └── Curate personal product showcase
    │
    └── Profile (/influencer/profile)
          └── Update influencer info
```

### 7.6 Admin Journey

```
Admin Login (/login)
    │
    ▼
Admin Dashboard (/admin/dashboard)
    │
    ├── USER MANAGEMENT
    │     ├── Users (/admin/users) — CRUD, role assignment
    │     ├── Permissions (/admin/permissions) — custom roles
    │     ├── Activity Logs (/admin/activity)
    │     └── Privacy Audit (/admin/privacy-audit)
    │
    ├── OPERATIONS
    │     ├── Orders (/admin/orders)
    │     ├── Shipments (/admin/shipments)
    │     ├── Submissions (/admin/submissions) — product approval queue
    │     ├── Catalog (/admin/catalog)
    │     └── Vendor Products (/admin/vendor-products)
    │
    ├── SELLERS
    │     ├── Seller List (/admin/sellers)
    │     ├── Applications (/admin/seller-applications)
    │     └── Analytics (/admin/seller-analytics)
    │
    ├── PRODUCTS
    │     ├── Products (/admin/products)
    │     ├── Create Product (/admin/products/create)
    │     ├── Pricing (/admin/products/pricing)
    │     ├── Categories (/admin/categories)
    │     ├── Attributes (/admin/attributes)
    │     ├── Tags (/admin/tags)
    │     └── Reviews (/admin/reviews)
    │
    ├── INFLUENCERS
    │     ├── Influencers (/admin/influencers)
    │     ├── Invitations (/admin/influencers/invitations)
    │     ├── Commissions (/admin/influencers/commissions)
    │     ├── Payouts (/admin/influencers/payouts)
    │     └── Campaigns (/admin/influencers/campaigns)
    │
    ├── FINANCE
    │     ├── Finance Overview (/admin/finance)
    │     ├── Pricing Rules (/admin/pricing)
    │     ├── Promotions (/admin/promotions)
    │     ├── Settlements (/admin/settlements)
    │     └── Discrepancies (/admin/discrepancies)
    │
    ├── LOGISTICS
    │     ├── Fulfillment Centers (/admin/fulfillment-centers)
    │     ├── Warehouses (/admin/warehouses)
    │     ├── Warehouse Transfers (/admin/warehouses/transfers)
    │     ├── Inventory (/admin/inventory)
    │     ├── Logistics (/admin/logistics)
    │     └── Tax Zones (/admin/tax-zones)
    │
    ├── CONTENT & MARKETING
    │     ├── Marketing (/admin/marketing)
    │     ├── Newsletter (/admin/newsletter)
    │     ├── Media (/admin/media)
    │     ├── Publishing (/admin/publishing)
    │     └── Templates (/admin/templates)
    │
    ├── SUPPORT
    │     ├── Support Tickets (/admin/support)
    │     └── WhatsApp (/admin/whatsapp)
    │
    ├── SYSTEM
    │     ├── Settings (/admin/settings)
    │     ├── Integrations (/admin/settings/integrations)
    │     ├── Webhooks (/admin/webhooks)
    │     ├── Search Index (/admin/search)
    │     ├── Domains (/admin/domains)
    │     └── Themes (/admin/themes)
    │
    ├── REPORTS
    │     ├── Overview (/admin/reports)
    │     ├── Sales (/admin/reports/sales)
    │     ├── Users (/admin/reports/users)
    │     ├── Products (/admin/reports/products)
    │     ├── Platform (/admin/reports/platform)
    │     └── Inventory (/admin/reports/inventory)
    │
    └── ROLE SWITCHING
          └── RoleSwitcher → view platform as any role
```

### 7.7 Staff Portal Journeys

```
PROCUREMENT STAFF
    Procurement Dashboard (/procurement/dashboard)
    └── Review Submissions (/procurement/submissions)

FULFILLMENT STAFF
    Fulfillment Dashboard (/fulfillment/dashboard)
    ├── Manage Centers (/fulfillment/centers)
    └── Manage Shipments (/fulfillment/shipments)
          └── Shipment Detail (/fulfillment/shipments/[id])

CATALOG STAFF
    Catalog Dashboard (/catalog/dashboard)
    └── Manage Entries (/catalog/entries)

MARKETING STAFF
    Marketing Dashboard (/marketing/dashboard)
    ├── Materials (/marketing/materials)
    └── Campaigns (/marketing/campaigns)

FINANCE STAFF
    Finance Dashboard (/finance/dashboard)
    ├── Pricing (/finance/pricing)
    ├── Payouts (/finance/payouts)
    └── Reports
          ├── Fee Reports (/finance/reports/fees)
          └── Revenue Reports (/finance/reports/revenue)

CMS EDITOR
    CMS Dashboard (/cms/dashboard)
    ├── Pages (/cms/pages)
    ├── Banners (/cms/banners)
    ├── Blog (/cms/blog)
    ├── Media (/cms/media)
    └── Settings (/cms/settings)
```

### 7.8 Multi-Tenant Storefront Journey

```
Customer visits {seller-slug}.houseofspells.com
    │
    ▼
Middleware detects subdomain
    │
    ▼
Rewrites to /sellers/{seller-slug} (transparent)
    │
    ▼
Seller storefront renders with seller's theme
    ├── Seller's product catalog
    ├── Seller branding (logo, colors, description)
    └── Standard checkout flow (shared platform)
```

---

## 8. Data Model (Key Entities)

| Entity | Description |
|--------|-------------|
| `User` | Central user account (all roles, OAuth, GDPR, gamification) |
| `Customer` | Extended buyer profile (loyalty, B2B fields) |
| `Seller` | Vendor profile (store, commission, domain, logistics) |
| `Influencer` | Affiliate profile |
| `Product` | Marketplace listing (variants, pricing, taxonomy) |
| `ProductReview` | Customer reviews and ratings |
| `Order` | Purchase record linking buyer, seller, items |
| `Cart` / `CartItem` | Shopping cart |
| `WishlistItem` | Saved products |
| `Collection` | Curated product lists |
| `ReturnRequest` | Return/refund workflows |
| `Transaction` | Financial transaction records |
| `SupportTicket` / `TicketMessage` | Customer support |
| `Address` | User addresses (shipping/billing) |
| `Category` / `Tag` / `Attribute` | Taxonomy entities |
| `Fandom` / `Character` | Fandom-specific taxonomy |
| `GiftCard` | Gift card records |
| `CustomerGroup` | Segmentation for pricing/promotions |
| `Tenant` / `Store` / `Config` | Multi-tenant architecture |
| `TenantUser` | User-tenant membership |
| `PermissionRole` | Custom RBAC roles |
| `RefreshToken` | JWT refresh token storage |
| `OAuthAccount` | Linked OAuth providers |
| `ActivityLog` | Audit trail |
| `AIChat` | AI conversation history |
| `UserBadge` / `UserQuest` | Gamification state |
| `SharedItem` | Social sharing records |
| `GDPRConsentLog` | Consent audit trail |
| `WhatsAppConversation` | WhatsApp messaging |
| `NewsletterSubscription` | Email subscriptions |
| `CouponUsage` | Promotion tracking |
| `SellerInvitation` | Seller onboarding invites |

---

## 9. API Surface Summary

The NestJS API exposes **93 controllers** under the `/api` prefix. Key endpoint groups:

| Module | Route Prefix | Key Operations |
|--------|-------------|----------------|
| Auth | `/api/auth` | Login, register, refresh, OAuth callbacks, password reset |
| Users | `/api/users` | CRUD, profile management |
| Products | `/api/products` | CRUD, search, bundles, volume pricing |
| Cart | `/api/cart` | Get, add, update, remove items |
| Orders | `/api/orders` | Create, list, detail, status updates |
| Payments | `/api/payments` | Process payment, Stripe webhook |
| Stripe Connect | `/api/payments/stripe-connect` | Seller onboarding, payouts |
| Sellers | `/api/sellers` | CRUD, storefront data |
| Categories | `/api/taxonomy/categories` | Category tree management |
| Meilisearch | `/api/meilisearch` | Index management, search |
| Uploads | `/api/uploads` | File upload, Cloudinary signatures |
| Notifications | `/api/notifications` | Send/list notifications |
| Reviews | `/api/reviews` | CRUD product reviews |
| Returns | `/api/returns` | Return request management |
| Shipping | `/api/shipping` | Rate calculation, courier providers |
| Tax | `/api/tax` | Tax calculation, zone management |
| Finance | `/api/finance` | Transactions, payouts, refunds, reports |
| Influencers | `/api/influencers` | Profile, commissions, campaigns |
| Admin | `/api/admin` | Users, sellers, products, migrations |
| Support | `/api/support` | Tickets, knowledge base, chatbot |
| CMS | `/api/cms` | Content management |
| Analytics | `/api/analytics` | Platform analytics |
| Dashboard | `/api/dashboard` | Aggregated dashboard data |
| Gamification | `/api/gamification` | Points, badges, leaderboards |
| Quests | `/api/quests` | Quest management |
| AI | `/api/ai` | Gemini chat |
| WhatsApp | `/api/whatsapp` | Messaging, webhook |
| Webhooks | `/api/webhooks` | Outbound webhook management |
| GDPR | `/api/gdpr` | Consent management, data export |
| Gift Cards | `/api/gift-cards` | CRUD, redemption |
| Integrations | `/api/integrations` | Third-party integration config |
| Geolocation | `/api/geolocation` | Country/currency detection |

**API documentation** is auto-generated via `@nestjs/swagger` and available at the `/api/docs` endpoint.

---

## 10. Deployment & Infrastructure

### 10.1 Container Setup (`docker-compose.yml`)

| Service | Image / Build | Ports |
|---------|--------------|-------|
| `postgres` | `postgres:15-alpine` | 5432 |
| `redis` | `redis:7-alpine` | 6379 |
| `meilisearch` | `getmeili/meilisearch:v1.11` | 7700 |
| `api` | Build from `services/api/Dockerfile` | 3001 |
| `web` | Build from `apps/web/Dockerfile` | 3000 |

### 10.2 Production Deployment

- **Platform:** Railway (configured via `railway.toml`)
- **Health check:** `GET /api/health/live`
- **Security headers:** Configured in `next.config.js` (CSP, HSTS, X-Frame-Options, etc.)
- **Rate limiting:** Via `@nestjs/throttler` (`RATE_LIMIT_TTL`, `RATE_LIMIT_MAX`)
- **Upload limits:** Configurable via `UPLOAD_MAX_SIZE`, `UPLOAD_ALLOWED_TYPES`

### 10.3 CI/CD & Quality

- Git hooks setup via `scripts/setup-git-hooks.mjs`
- API endpoint verification via `scripts/verify-api-endpoints.mjs`
- Environment variable validation via `services/api/scripts/verify-env-vars.ts`
- E2E tests via Playwright (`apps/web/e2e/`)
- Unit/integration tests via Jest (`services/api/test/`)

---

*End of document.*
