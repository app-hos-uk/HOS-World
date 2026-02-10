# Auth Service Dockerfile
FROM node:18-slim AS base

RUN npm install -g pnpm

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

COPY services/auth/package.json ./services/auth/
COPY packages/auth-common/package.json ./packages/auth-common/
COPY packages/observability/package.json ./packages/observability/
COPY packages/events/package.json ./packages/events/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/utils/package.json ./packages/utils/
COPY packages/database-common/package.json ./packages/database-common/

RUN pnpm install --no-frozen-lockfile

COPY packages ./packages
COPY services/auth ./services/auth

WORKDIR /app/packages/shared-types
RUN pnpm build

WORKDIR /app/packages/utils
RUN pnpm build

WORKDIR /app/packages/auth-common
RUN pnpm build

WORKDIR /app/packages/observability
RUN pnpm build

WORKDIR /app/packages/events
RUN pnpm build

WORKDIR /app/services/auth
RUN npx prisma generate
RUN pnpm build

# Production image
FROM node:18-slim

RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*
RUN npm install -g pnpm

WORKDIR /app

COPY --from=base /app/package.json ./
COPY --from=base /app/pnpm-lock.yaml ./
COPY --from=base /app/pnpm-workspace.yaml ./
COPY --from=base /app/services/auth/package.json ./services/auth/
COPY --from=base /app/packages/auth-common/package.json ./packages/auth-common/
COPY --from=base /app/packages/observability/package.json ./packages/observability/
COPY --from=base /app/packages/events/package.json ./packages/events/
COPY --from=base /app/packages/shared-types/package.json ./packages/shared-types/
COPY --from=base /app/packages/utils/package.json ./packages/utils/
COPY --from=base /app/packages/database-common/package.json ./packages/database-common/

RUN pnpm install --no-frozen-lockfile --prod

COPY --from=base /app/packages ./packages
COPY --from=base /app/services/auth/dist ./services/auth/dist
COPY --from=base /app/services/auth/prisma ./services/auth/prisma
COPY --from=base /app/services/auth/node_modules/.prisma ./services/auth/node_modules/.prisma

EXPOSE 3005

WORKDIR /app/services/auth
CMD ["node", "dist/main.js"]
