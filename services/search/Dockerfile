# Search Service Dockerfile
FROM node:18-slim AS base

RUN npm install -g pnpm

WORKDIR /app

# Copy workspace root config
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy package.json files for all needed packages
COPY services/search/package.json ./services/search/
COPY packages/auth-common/package.json ./packages/auth-common/
COPY packages/observability/package.json ./packages/observability/
COPY packages/events/package.json ./packages/events/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/utils/package.json ./packages/utils/
COPY packages/database-common/package.json ./packages/database-common/

# Install dependencies
RUN pnpm install --no-frozen-lockfile

# Copy source code
COPY packages ./packages
COPY services/search ./services/search

# Build shared packages
WORKDIR /app/packages/shared-types
RUN pnpm build

WORKDIR /app/packages/auth-common
RUN pnpm build

WORKDIR /app/packages/observability
RUN pnpm build

WORKDIR /app/packages/events
RUN pnpm build

# Generate Prisma client for search service
WORKDIR /app/services/search
RUN npx prisma generate

# Build search service
RUN pnpm build

# Production image
FROM node:18-slim

RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*
RUN npm install -g pnpm

WORKDIR /app

COPY --from=base /app/package.json ./
COPY --from=base /app/pnpm-lock.yaml ./
COPY --from=base /app/pnpm-workspace.yaml ./
COPY --from=base /app/services/search/package.json ./services/search/
COPY --from=base /app/packages/auth-common/package.json ./packages/auth-common/
COPY --from=base /app/packages/observability/package.json ./packages/observability/
COPY --from=base /app/packages/events/package.json ./packages/events/
COPY --from=base /app/packages/shared-types/package.json ./packages/shared-types/
COPY --from=base /app/packages/utils/package.json ./packages/utils/
COPY --from=base /app/packages/database-common/package.json ./packages/database-common/

RUN pnpm install --no-frozen-lockfile --prod

COPY --from=base /app/packages ./packages
COPY --from=base /app/services/search/dist ./services/search/dist
COPY --from=base /app/services/search/prisma ./services/search/prisma
COPY --from=base /app/services/search/node_modules/.prisma ./services/search/node_modules/.prisma

EXPOSE 3004

WORKDIR /app/services/search
CMD ["node", "dist/main.js"]
