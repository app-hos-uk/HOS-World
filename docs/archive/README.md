# House of Spells Marketplace

A scalable e-commerce marketplace platform supporting 2,500-5,000 sellers, 150,000 products, and 1,000-5,000 concurrent users.

## Architecture

**Modular Monolith** — all business logic in a single NestJS API with domain modules, backed by a Next.js frontend. Background jobs run via BullMQ (Redis).

| Service | Description |
|---------|-------------|
| `apps/web` | Next.js 14 frontend |
| `services/api` | NestJS API (auth, products, orders, payments, admin, finance, search, etc.) |

Infrastructure:
- **PostgreSQL** — primary database (Prisma ORM)
- **Redis** — caching, BullMQ job queue, pub/sub events
- **Meilisearch** — full-text product search with typo tolerance, faceting, filtering

## Technology Stack

- **Frontend**: Next.js 14+ with TypeScript, Tailwind CSS
- **Backend**: NestJS with TypeScript, Prisma ORM
- **Database**: PostgreSQL 15
- **Search**: Meilisearch
- **Cache/Queue**: Redis + BullMQ
- **Storage**: Cloudinary / AWS S3
- **Authentication**: JWT with refresh tokens, OAuth (Google, Apple)
- **Payments**: Stripe, Klarna

## Getting Started

### Prerequisites

- Node.js >= 18.0.0
- pnpm
- PostgreSQL
- Redis

### Installation

```bash
pnpm install
```

### Development

```bash
# Start API + Web
pnpm run dev

# Start specific workspace
pnpm --filter @hos-marketplace/web dev
pnpm --filter @hos-marketplace/api dev
```

### Docker

```bash
docker compose up
```

### Build

```bash
pnpm run build
```

## Project Structure

```
hos-marketplace/
├── apps/
│   ├── web/              # Next.js frontend
│   └── mobile/           # React Native mobile app
├── packages/
│   ├── api-client/       # Shared API client
│   ├── shared-types/     # TypeScript types
│   ├── theme-system/     # Theme management
│   ├── cms-client/       # CMS integration
│   ├── events/           # Event bus (Redis pub/sub)
│   ├── observability/    # Logging & monitoring
│   └── utils/            # Shared utilities
├── services/
│   └── api/              # NestJS API (all business logic)
└── infrastructure/       # Docker, K8s, load testing
```

## Deployment

Deployed on Railway. See [docs/RAILWAY_BRANCH_AND_DEPLOY.md](docs/RAILWAY_BRANCH_AND_DEPLOY.md).

## License

Private - House of Spells Marketplace
