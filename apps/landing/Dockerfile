# Landing Service Dockerfile — lightweight Next.js standalone
FROM node:18-slim AS base

RUN npm install -g pnpm

WORKDIR /app

# Layer 1: Workspace config + lockfile
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY scripts/setup-git-hooks.mjs ./scripts/setup-git-hooks.mjs

# Layer 2: Only the landing app manifest
COPY apps/landing/package.json ./apps/landing/

# Install deps (landing has no workspace package deps)
RUN pnpm install --frozen-lockfile || pnpm install --no-frozen-lockfile

# Layer 3: Source code
COPY --chown=node:node apps/landing ./apps/landing

# Build-time env vars (NEXT_PUBLIC_* are baked into the JS bundle at build time)
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_SHOP_URL
ARG NEXT_PUBLIC_STRAPI_URL
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_GA_MEASUREMENT_ID
ARG NEXT_PUBLIC_META_PIXEL_ID
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_SHOP_URL=$NEXT_PUBLIC_SHOP_URL
ENV NEXT_PUBLIC_STRAPI_URL=$NEXT_PUBLIC_STRAPI_URL
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_GA_MEASUREMENT_ID=$NEXT_PUBLIC_GA_MEASUREMENT_ID
ENV NEXT_PUBLIC_META_PIXEL_ID=$NEXT_PUBLIC_META_PIXEL_ID

WORKDIR /app/apps/landing
RUN pnpm build

# Production image
FROM node:18-slim

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

COPY --from=base /app/apps/landing/.next/standalone ./
COPY --from=base /app/apps/landing/.next/static ./apps/landing/.next/static
COPY --from=base /app/apps/landing/public ./apps/landing/public

USER node
EXPOSE 3000

CMD ["node", "apps/landing/server.js"]
