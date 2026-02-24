# ── Stage 1: Install dependencies (cached unless package.json/lockfile change) ──
FROM node:18-slim AS deps

RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ openssl \
    && rm -rf /var/lib/apt/lists/* \
    && npm install -g pnpm

WORKDIR /app

COPY package.json pnpm-lock.yaml ./

# Workspace config scoped to only what the API needs (excludes apps/*)
RUN printf 'packages:\n  - packages/*\n  - services/api\n\nignoredBuiltDependencies:\n  - "@nestjs/core"\n  - msgpackr-extract\n  - unrs-resolver\n\nonlyBuiltDependencies:\n  - prisma\n  - "@prisma/client"\n  - "@prisma/engines"\n  - bcrypt\n' > pnpm-workspace.yaml

# Copy only package.json files so source changes don't bust this cache layer
COPY services/api/package.json ./services/api/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/utils/package.json ./packages/utils/
COPY packages/api-client/package.json ./packages/api-client/
COPY packages/theme-system/package.json ./packages/theme-system/
COPY packages/cms-client/package.json ./packages/cms-client/
COPY packages/events/package.json ./packages/events/
COPY packages/observability/package.json ./packages/observability/

RUN pnpm install --no-frozen-lockfile

# ── Stage 2: Build (runs on code changes, but deps are cached above) ──
FROM deps AS build

COPY packages ./packages
COPY services/api ./services/api

# Build shared packages in parallel where possible, then API
RUN cd /app/packages/shared-types && pnpm build & \
    cd /app/packages/utils && pnpm build & \
    wait \
    && cd /app/packages/api-client && pnpm build & \
    cd /app/packages/theme-system && pnpm build & \
    cd /app/packages/cms-client && (pnpm build || true) & \
    wait \
    && cd /app/services/api && pnpm db:generate && (pnpm build || true) \
    && test -f /app/services/api/dist/main.js

# ── Stage 3: Production image (slim, no dev deps/build tools) ──
FROM node:18-slim AS production

RUN apt-get update && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/* \
    && npm install -g pnpm

WORKDIR /app

COPY --from=build /app/package.json /app/pnpm-workspace.yaml ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages ./packages
COPY --from=build /app/services/api/package.json ./services/api/
COPY --from=build /app/services/api/dist ./services/api/dist
COPY --from=build /app/services/api/prisma ./services/api/prisma
COPY --from=build /app/services/api/node_modules ./services/api/node_modules

WORKDIR /app/services/api
EXPOSE 3001
CMD ["sh", "-c", "npx prisma migrate deploy && exec node dist/main.js"]
