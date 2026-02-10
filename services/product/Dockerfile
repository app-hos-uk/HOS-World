FROM node:18-slim AS base
RUN npm install -g pnpm
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY services/product/package.json ./services/product/
COPY packages/auth-common/package.json ./packages/auth-common/
COPY packages/observability/package.json ./packages/observability/
COPY packages/events/package.json ./packages/events/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/utils/package.json ./packages/utils/
COPY packages/database-common/package.json ./packages/database-common/
RUN pnpm install --no-frozen-lockfile
COPY packages ./packages
COPY services/product ./services/product
WORKDIR /app/packages/shared-types
RUN pnpm build
WORKDIR /app/packages/auth-common
RUN pnpm build
WORKDIR /app/packages/observability
RUN pnpm build
WORKDIR /app/packages/events
RUN pnpm build
WORKDIR /app/services/product
RUN npx prisma generate
RUN pnpm build

FROM node:18-slim
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*
RUN npm install -g pnpm
WORKDIR /app
COPY --from=base /app/package.json ./
COPY --from=base /app/pnpm-lock.yaml ./
COPY --from=base /app/pnpm-workspace.yaml ./
COPY --from=base /app/services/product/package.json ./services/product/
COPY --from=base /app/packages/auth-common/package.json ./packages/auth-common/
COPY --from=base /app/packages/observability/package.json ./packages/observability/
COPY --from=base /app/packages/events/package.json ./packages/events/
COPY --from=base /app/packages/shared-types/package.json ./packages/shared-types/
COPY --from=base /app/packages/utils/package.json ./packages/utils/
COPY --from=base /app/packages/database-common/package.json ./packages/database-common/
RUN pnpm install --no-frozen-lockfile --prod
COPY --from=base /app/packages ./packages
COPY --from=base /app/services/product/dist ./services/product/dist
COPY --from=base /app/services/product/prisma ./services/product/prisma
COPY --from=base /app/services/product/node_modules/.prisma ./services/product/node_modules/.prisma
EXPOSE 3007
WORKDIR /app/services/product
CMD ["node", "dist/main.js"]
