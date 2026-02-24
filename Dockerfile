FROM node:18-slim

RUN apt-get update && apt-get install -y python3 make g++ openssl && rm -rf /var/lib/apt/lists/*
RUN npm install -g pnpm

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY services/api/package.json ./services/api/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/api-client/package.json ./packages/api-client/
COPY packages/theme-system/package.json ./packages/theme-system/
COPY packages/utils/package.json ./packages/utils/
COPY packages/cms-client/package.json ./packages/cms-client/

RUN pnpm install --no-frozen-lockfile

COPY services/api ./services/api
COPY packages ./packages

RUN cd /app/packages/shared-types && pnpm build && \
    cd /app/packages/utils && pnpm build && \
    cd /app/packages/api-client && pnpm build && \
    cd /app/packages/theme-system && pnpm build && \
    cd /app/packages/cms-client && (pnpm build || true) && \
    cd /app/services/api && pnpm db:generate && \
    (pnpm build || true) && \
    test -f dist/main.js

WORKDIR /app/services/api

EXPOSE 3001
CMD ["/bin/sh", "-c", "npx prisma migrate deploy && exec node dist/main.js"]
