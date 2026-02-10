# Inventory Service Dockerfile
FROM node:18-slim AS base

RUN npm install -g pnpm

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY services/inventory/package.json ./services/inventory/
COPY packages/auth-common/package.json ./packages/auth-common/
COPY packages/observability/package.json ./packages/observability/
COPY packages/events/package.json ./packages/events/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/utils/package.json ./packages/utils/
COPY packages/database-common/package.json ./packages/database-common/

RUN pnpm install --no-frozen-lockfile

COPY packages ./packages
COPY services/inventory ./services/inventory

WORKDIR /app/packages/shared-types
RUN pnpm build

WORKDIR /app/packages/auth-common
RUN pnpm build

WORKDIR /app/packages/observability
RUN pnpm build

WORKDIR /app/packages/events
RUN pnpm build

WORKDIR /app/services/inventory
RUN npx prisma generate
RUN pnpm build

FROM node:18-slim

RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*
RUN npm install -g pnpm

WORKDIR /app

COPY --from=base /app/package.json ./
COPY --from=base /app/pnpm-lock.yaml ./
COPY --from=base /app/pnpm-workspace.yaml ./
COPY --from=base /app/services/inventory/package.json ./services/inventory/
COPY --from=base /app/packages/auth-common/package.json ./packages/auth-common/
COPY --from=base /app/packages/observability/package.json ./packages/observability/
COPY --from=base /app/packages/events/package.json ./packages/events/
COPY --from=base /app/packages/shared-types/package.json ./packages/shared-types/
COPY --from=base /app/packages/utils/package.json ./packages/utils/
COPY --from=base /app/packages/database-common/package.json ./packages/database-common/

RUN pnpm install --no-frozen-lockfile --prod

COPY --from=base /app/packages ./packages
COPY --from=base /app/services/inventory/dist ./services/inventory/dist
COPY --from=base /app/services/inventory/prisma ./services/inventory/prisma
COPY --from=base /app/services/inventory/node_modules/.prisma ./services/inventory/node_modules/.prisma

EXPOSE 3010

WORKDIR /app/services/inventory
CMD ["node", "dist/main.js"]
