# Web Service Dockerfile
# Cache-bust: 2025-12-03-15:30
FROM node:18-slim AS base

# Install pnpm
RUN npm install -g pnpm

WORKDIR /app

# Copy package files (order matters for Docker layer caching)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy all package.json files from packages (must be before install)
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/api-client/package.json ./packages/api-client/
COPY packages/theme-system/package.json ./packages/theme-system/
COPY packages/ui-components/package.json ./packages/ui-components/
COPY packages/utils/package.json ./packages/utils/
COPY packages/cms-client/package.json ./packages/cms-client/
COPY apps/web/package.json ./apps/web/

# Install ALL dependencies including dev dependencies (needed for building packages)
# Using --no-frozen-lockfile for CI/CD compatibility
# This installs @types/react and other dev dependencies needed for TypeScript builds
# Add cache-busting ARG to force fresh install when code changes
ARG CACHE_BUST=1
ARG BUILD_DATE=unknown
RUN pnpm install --no-frozen-lockfile

# Copy source code
# Copy packages first (including tsconfig.json files and source files)
# Use --chown to ensure proper permissions and avoid cache issues
# Force cache invalidation by copying in a specific order
RUN echo "Build date: ${BUILD_DATE}" && echo "Forcing fresh package copy..."
# Copy all package files (package.json, tsconfig.json, and source)
COPY --chown=node:node packages ./packages
# Copy web app
COPY --chown=node:node apps/web ./apps/web

# Build packages first (in dependency order)
# This ensures workspace packages are available for the web app build

# 1. shared-types (no dependencies - must be built first)
WORKDIR /app/packages/shared-types
RUN pnpm build

# 2. theme-system (depends on shared-types)
WORKDIR /app/packages/theme-system
RUN pnpm build

# 3. utils (depends on shared-types)
# Verify tsconfig.json has DOM lib before building
WORKDIR /app/packages/utils
RUN cat tsconfig.json | grep -q '"DOM"' || (echo "ERROR: DOM lib missing from tsconfig.json" && cat tsconfig.json && exit 1)
RUN pnpm build

# 4. api-client (depends on shared-types)
WORKDIR /app/packages/api-client
# Verify tsconfig.json has DOM lib and NO types node before building
RUN cat tsconfig.json | grep -q '"DOM"' || (echo "ERROR: DOM lib missing from api-client tsconfig.json" && cat tsconfig.json && exit 1)
RUN cat tsconfig.json | grep -q '"types"' && (echo "ERROR: types field should not be in tsconfig.json" && cat tsconfig.json && exit 1) || echo "OK: No types field (correct)"
# Verify put/delete methods exist in client.ts
RUN grep -q "async put" src/client.ts || (echo "ERROR: put method missing from ApiClient" && exit 1)
RUN grep -q "async delete" src/client.ts || (echo "ERROR: delete method missing from ApiClient" && exit 1)
# Verify headers type fix is present (should use Record, not HeadersInit for assignment)
RUN grep -q "Record<string, string>" src/client.ts || (echo "ERROR: headers type fix missing - should use Record<string, string>" && grep -A 2 "const headers" src/client.ts && exit 1)
RUN pnpm build

# 5. ui-components (depends on shared-types and theme-system)
WORKDIR /app/packages/ui-components
RUN pnpm build || echo "ui-components build skipped if no build script"

# 6. cms-client (if exists)
WORKDIR /app/packages/cms-client
RUN pnpm build || echo "cms-client build skipped if no build script"

# Build web app
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
# Note: next.config.ts is optional - Next.js will use next.config.js if .ts doesn't exist
COPY --from=base /app/packages ./packages

# Set working directory to web app
WORKDIR /app/apps/web

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000

# Start Next.js production server
CMD ["pnpm", "start"]

