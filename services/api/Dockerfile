# API Service Dockerfile
FROM node:18-alpine AS base

# Install pnpm
RUN npm install -g pnpm

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY services/api/package.json ./services/api/
COPY packages/*/package.json ./packages/*/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY services/api ./services/api
COPY packages ./packages

# Build
WORKDIR /app/services/api
RUN pnpm build

# Production image
FROM node:18-alpine

RUN npm install -g pnpm

WORKDIR /app

# Copy built files and dependencies
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/services/api/dist ./dist
COPY --from=base /app/services/api/package.json ./
COPY --from=base /app/services/api/prisma ./prisma
COPY --from=base /app/packages ./packages

# Generate Prisma Client
RUN cd /app && pnpm --filter @hos-marketplace/api db:generate

EXPOSE 3001

CMD ["node", "dist/main.js"]

