# Web Service Dockerfile
FROM node:18-alpine AS base

RUN npm install -g pnpm

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/
COPY packages/*/package.json ./packages/*/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY apps/web ./apps/web
COPY packages ./packages

# Build
WORKDIR /app/apps/web
RUN pnpm build

# Production image
FROM node:18-alpine

RUN npm install -g pnpm

WORKDIR /app

# Copy built files
COPY --from=base /app/apps/web/.next ./.next
COPY --from=base /app/apps/web/public ./public
COPY --from=base /app/apps/web/package.json ./
COPY --from=base /app/apps/web/next.config.js ./
COPY --from=base /app/node_modules ./node_modules

EXPOSE 3000

ENV NODE_ENV=production

CMD ["pnpm", "start"]

