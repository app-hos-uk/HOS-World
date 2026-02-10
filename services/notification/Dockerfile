# Notification Service Dockerfile
FROM node:18-slim AS base

RUN npm install -g pnpm

WORKDIR /app

# Copy workspace root config
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy package.json files for all needed packages
COPY services/notification/package.json ./services/notification/
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
COPY services/notification ./services/notification

# Build shared packages
WORKDIR /app/packages/shared-types
RUN pnpm build

WORKDIR /app/packages/auth-common
RUN pnpm build

WORKDIR /app/packages/observability
RUN pnpm build

WORKDIR /app/packages/events
RUN pnpm build

# Generate Prisma client for notification service
WORKDIR /app/services/notification
RUN npx prisma generate

# Build notification service
RUN pnpm build

# Production image
FROM node:18-slim

RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*
RUN npm install -g pnpm

WORKDIR /app

COPY --from=base /app/package.json ./
COPY --from=base /app/pnpm-lock.yaml ./
COPY --from=base /app/pnpm-workspace.yaml ./
COPY --from=base /app/services/notification/package.json ./services/notification/
COPY --from=base /app/packages/auth-common/package.json ./packages/auth-common/
COPY --from=base /app/packages/observability/package.json ./packages/observability/
COPY --from=base /app/packages/events/package.json ./packages/events/
COPY --from=base /app/packages/shared-types/package.json ./packages/shared-types/
COPY --from=base /app/packages/utils/package.json ./packages/utils/
COPY --from=base /app/packages/database-common/package.json ./packages/database-common/

RUN pnpm install --no-frozen-lockfile --prod

COPY --from=base /app/packages ./packages
COPY --from=base /app/services/notification/dist ./services/notification/dist
COPY --from=base /app/services/notification/prisma ./services/notification/prisma
COPY --from=base /app/services/notification/node_modules/.prisma ./services/notification/node_modules/.prisma

EXPOSE 3003

WORKDIR /app/services/notification
CMD ["node", "dist/main.js"]
