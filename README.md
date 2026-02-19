# House of Spells Marketplace

A scalable e-commerce marketplace platform supporting 2,500-5,000 sellers, 150,000 products, and 1,000-5,000 concurrent users.

## Architecture

This is a monorepo containing:

- **apps/web** - Next.js web application
- **apps/mobile** - React Native mobile app (Android & iOS)
- **services/api** - NestJS backend API
- **packages/** - Shared packages (types, api-client, ui-components, theme-system, utils)
- **themes/** - Theme definitions and templates

## Technology Stack

- **Frontend (Web)**: Next.js 14+ with TypeScript
- **Mobile**: React Native with Expo
- **Backend**: NestJS with TypeScript
- **Database**: PostgreSQL
- **Search**: Elasticsearch/Algolia
- **Cache**: Redis
- **Storage**: AWS S3/Cloudinary
- **Authentication**: NextAuth.js / JWT
- **Payment**: Stripe

## Getting Started

### Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0
- PostgreSQL
- Redis (for caching)

### Installation

```bash
pnpm install
```

> **Note:** After pulling or on a new machine, always run `pnpm install` so native dependencies (Prisma, bcrypt) are built correctly.

### Development

```bash
# Start API + Web only (recommended - avoids file table overflow with full monorepo)
pnpm run dev:core

# Start all applications (requires high ulimit on macOS: ulimit -n 65536)
pnpm run dev

# Start specific workspace
pnpm --filter @hos-marketplace/web dev
pnpm --filter @hos-marketplace/api dev
```

### Build

```bash
npm run build
```

## Project Structure

```
hos-marketplace/
├── apps/
│   ├── web/              # Next.js web application
│   └── mobile/           # React Native mobile app
├── packages/
│   ├── api-client/       # Shared API client
│   ├── shared-types/     # TypeScript types
│   ├── ui-components/    # Shared UI components
│   ├── theme-system/     # Theme management
│   └── utils/            # Shared utilities
├── services/
│   └── api/              # NestJS backend API
└── themes/               # Theme definitions
```

## License

Private - House of Spells Marketplace


