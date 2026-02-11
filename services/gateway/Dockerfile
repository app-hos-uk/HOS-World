# Gateway Dockerfile
FROM node:18-slim AS base

RUN npm install -g pnpm

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY services/gateway/package.json ./services/gateway/
COPY packages/auth-common/package.json ./packages/auth-common/
COPY packages/observability/package.json ./packages/observability/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/utils/package.json ./packages/utils/
COPY packages/events/package.json ./packages/events/
COPY packages/database-common/package.json ./packages/database-common/

# Install dependencies
RUN pnpm install --no-frozen-lockfile

# Copy source code (services/gateway includes src/, config, etc.)
COPY packages ./packages
COPY services/gateway ./services/gateway

# Build shared packages
WORKDIR /app/packages/shared-types
RUN pnpm build

WORKDIR /app/packages/auth-common
RUN pnpm build

WORKDIR /app/packages/observability
RUN pnpm build

# Build gateway
WORKDIR /app/services/gateway
RUN pnpm build

# Production image
FROM node:18-slim

# Install curl for healthchecks
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*
RUN npm install -g pnpm

WORKDIR /app

COPY --from=base /app/package.json ./
COPY --from=base /app/pnpm-lock.yaml ./
COPY --from=base /app/pnpm-workspace.yaml ./
COPY --from=base /app/services/gateway/package.json ./services/gateway/
COPY --from=base /app/packages/auth-common/package.json ./packages/auth-common/
COPY --from=base /app/packages/observability/package.json ./packages/observability/
COPY --from=base /app/packages/shared-types/package.json ./packages/shared-types/
COPY --from=base /app/packages/utils/package.json ./packages/utils/
COPY --from=base /app/packages/events/package.json ./packages/events/
COPY --from=base /app/packages/database-common/package.json ./packages/database-common/

# Copy built packages first so workspace:* resolves, then install prod deps
COPY --from=base /app/packages ./packages
COPY --from=base /app/services/gateway/dist ./services/gateway/dist

RUN pnpm install --no-frozen-lockfile --prod

EXPOSE 4000

WORKDIR /app/services/gateway
CMD ["node", "dist/main.js"]
