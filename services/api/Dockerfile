FROM node:20-slim

RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ openssl \
    && rm -rf /var/lib/apt/lists/* \
    && npm install -g pnpm

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY scripts/setup-git-hooks.mjs ./scripts/setup-git-hooks.mjs
COPY packages ./packages
COPY services/api ./services/api

RUN (pnpm install --frozen-lockfile || pnpm install --no-frozen-lockfile) \
    && cd /app/packages/shared-types && pnpm build \
    && cd /app/packages/utils && pnpm build \
    && cd /app/packages/api-client && pnpm build \
    && cd /app/packages/theme-system && pnpm build \
    && cd /app/packages/cms-client && (pnpm build || true) \
    && cd /app/services/api && pnpm db:generate \
    && (pnpm build || true) \
    && test -f dist/main.js

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 appuser

WORKDIR /app/services/api
RUN chmod +x docker-entrypoint.sh && chown -R appuser:nodejs /app
USER appuser
EXPOSE 3001
CMD ["./docker-entrypoint.sh"]
