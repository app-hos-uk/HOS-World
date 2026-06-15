# Web Service Dockerfile — Next.js standalone output
FROM node:18-slim AS base

RUN npm install -g pnpm

WORKDIR /app

# ── Layer 1: Workspace config + lockfile (rarely changes) ──
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# Root `prepare` runs on pnpm install; include this script before any install.
COPY scripts/setup-git-hooks.mjs ./scripts/setup-git-hooks.mjs

# ── Layer 2: Package manifests only (cached unless deps change) ──
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/api-client/package.json ./packages/api-client/
COPY packages/theme-system/package.json ./packages/theme-system/
COPY packages/utils/package.json ./packages/utils/
COPY packages/cms-client/package.json ./packages/cms-client/
COPY apps/web/package.json ./apps/web/

# Frozen lockfile is faster and deterministic; fall back if it drifts.
RUN pnpm install --frozen-lockfile || pnpm install --no-frozen-lockfile

# ── Layer 3: Source code ──
COPY --chown=node:node packages ./packages
COPY --chown=node:node apps/web ./apps/web

# Build workspace packages in dependency order
RUN cd /app/packages/shared-types && pnpm build \
    && cd /app/packages/theme-system && pnpm build \
    && cd /app/packages/utils && pnpm build \
    && cd /app/packages/api-client && pnpm build \
    && cd /app/packages/cms-client && (pnpm build || echo "cms-client build skipped")

# Build-time public env vars for Next.js
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_CMS_URL
ARG NEXT_PUBLIC_FRONTEND_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_CMS_URL=$NEXT_PUBLIC_CMS_URL
ENV NEXT_PUBLIC_FRONTEND_URL=$NEXT_PUBLIC_FRONTEND_URL

WORKDIR /app/apps/web
# Avoid OOM on Railway builder (Next.js build can use a lot of memory)
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN pnpm build

# ── Production image: standalone bundle, no install needed ──
FROM node:18-slim

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Standalone output bundles a minimal node_modules + server.js.
# Static assets and public/ are not included by the tracer — copy them in.
COPY --from=base /app/apps/web/.next/standalone ./
COPY --from=base /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=base /app/apps/web/public ./apps/web/public

USER node
EXPOSE 3000

# server.js lives at apps/web/ because outputFileTracingRoot is the monorepo root.
CMD ["node", "apps/web/server.js"]
