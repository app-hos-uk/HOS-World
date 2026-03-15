FROM node:18-slim

RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ openssl \
    && rm -rf /var/lib/apt/lists/* \
    && npm install -g pnpm

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages
COPY services/api ./services/api

RUN pnpm install --no-frozen-lockfile \
    && cd /app/packages/shared-types && pnpm build \
    && cd /app/packages/utils && pnpm build \
    && cd /app/packages/api-client && pnpm build \
    && cd /app/packages/theme-system && pnpm build \
    && cd /app/packages/cms-client && (pnpm build || true) \
    && cd /app/services/api && pnpm db:generate \
    && (pnpm build || true) \
    && test -f dist/main.js

WORKDIR /app/services/api
EXPOSE 3001
CMD ["/bin/sh", "-c", "npx prisma migrate resolve --rolled-back 20260219100000_convert_gbp_to_usd 2>/dev/null || true; npx prisma migrate deploy || echo 'WARN: migrate deploy had issues, continuing anyway'; exec node dist/main.js"]
