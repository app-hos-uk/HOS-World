FROM node:18-slim

RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ openssl \
    && rm -rf /var/lib/apt/lists/* \
    && npm install -g pnpm

WORKDIR /app

# ── Layer 1: Workspace config + lockfile (rarely changes) ──
COPY package.json pnpm-lock.yaml ./
RUN printf 'packages:\n  - packages/*\n  - services/api\n\nignoredBuiltDependencies:\n  - "@nestjs/core"\n  - msgpackr-extract\n  - unrs-resolver\n\nonlyBuiltDependencies:\n  - prisma\n  - "@prisma/client"\n  - "@prisma/engines"\n  - bcrypt\n' > pnpm-workspace.yaml

# ── Layer 2: Package.json files only (cached unless deps change) ──
COPY services/api/package.json ./services/api/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/utils/package.json ./packages/utils/
COPY packages/api-client/package.json ./packages/api-client/
COPY packages/theme-system/package.json ./packages/theme-system/
COPY packages/cms-client/package.json ./packages/cms-client/
COPY packages/events/package.json ./packages/events/
COPY packages/observability/package.json ./packages/observability/

RUN pnpm install --no-frozen-lockfile

# ── Layer 3: Source code + build ──
COPY packages ./packages
COPY services/api ./services/api

RUN cd packages/shared-types && pnpm build \
    && cd ../utils && pnpm build \
    && cd ../api-client && pnpm build \
    && cd ../theme-system && pnpm build \
    && cd ../cms-client && (pnpm build || true) \
    && cd ../../services/api && pnpm db:generate \
    && (pnpm build || true) \
    && test -f dist/main.js

# ── Layer 4: Strip build tools & dev artifacts to shrink image ──
RUN apt-get purge -y python3 make g++ && apt-get autoremove -y \
    && rm -rf /tmp/* /root/.cache /root/.npm \
    && find /app/packages -name "*.ts" ! -name "*.d.ts" -delete 2>/dev/null || true \
    && find /app/services/api/src -name "*.ts" -delete 2>/dev/null || true \
    && rm -rf /app/services/api/test 2>/dev/null || true \
    && pnpm store prune 2>/dev/null || true

WORKDIR /app/services/api
EXPOSE 3001
CMD ["sh", "-c", "npx prisma migrate deploy && exec node dist/main.js"]
