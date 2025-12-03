# Web Service Dockerfile
FROM node:18-slim AS base

# Install pnpm
RUN npm install -g pnpm

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/

# Copy all package.json files from packages
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/api-client/package.json ./packages/api-client/
COPY packages/theme-system/package.json ./packages/theme-system/
COPY packages/ui-components/package.json ./packages/ui-components/
COPY packages/utils/package.json ./packages/utils/
COPY packages/cms-client/package.json ./packages/cms-client/

# Install dependencies (using --no-frozen-lockfile for CI/CD compatibility)
RUN pnpm install --no-frozen-lockfile

# Copy source code
COPY apps/web ./apps/web
COPY packages ./packages

# Build
WORKDIR /app/apps/web
RUN pnpm build

# Production image
FROM node:18-slim

# Install pnpm
RUN npm install -g pnpm

WORKDIR /app

# Copy package files for production install
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/api-client/package.json ./packages/api-client/
COPY packages/theme-system/package.json ./packages/theme-system/
COPY packages/ui-components/package.json ./packages/ui-components/
COPY packages/utils/package.json ./packages/utils/
COPY packages/cms-client/package.json ./packages/cms-client/

# Install production dependencies
RUN pnpm install --prod --no-frozen-lockfile

# Copy built files and source
COPY --from=base /app/apps/web/.next ./apps/web/.next
COPY --from=base /app/apps/web/public ./apps/web/public
COPY --from=base /app/apps/web/package.json ./apps/web/
COPY --from=base /app/apps/web/next.config.js ./apps/web/next.config.js
COPY --from=base /app/apps/web/next.config.ts ./apps/web/next.config.ts 2>/dev/null || true
COPY --from=base /app/packages ./packages

# Set working directory to web app
WORKDIR /app/apps/web

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000

# Start Next.js production server
CMD ["pnpm", "start"]

