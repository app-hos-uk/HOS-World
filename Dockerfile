FROM node:18-slim AS base

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

WORKDIR /app/packages/shared-types
RUN pnpm build

WORKDIR /app/packages/utils
RUN pnpm build

WORKDIR /app/packages/api-client
RUN pnpm build

WORKDIR /app/packages/theme-system
RUN pnpm build

WORKDIR /app/packages/cms-client
RUN pnpm build || true

WORKDIR /app/services/api
RUN pnpm db:generate
RUN (pnpm build 2>&1 | tail -50) || true
RUN test -f dist/main.js || (echo "ERROR: dist/main.js not found" && exit 1)

# --- Production image ---
FROM node:18-slim

RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*
RUN npm install -g pnpm

WORKDIR /app

COPY --from=base /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=base /app/services/api/package.json ./services/api/
COPY --from=base /app/packages/shared-types/package.json ./packages/shared-types/
COPY --from=base /app/packages/api-client/package.json ./packages/api-client/
COPY --from=base /app/packages/theme-system/package.json ./packages/theme-system/
COPY --from=base /app/packages/utils/package.json ./packages/utils/
COPY --from=base /app/packages/cms-client/package.json ./packages/cms-client/

ENV npm_config_build_from_source=true
RUN pnpm install --no-frozen-lockfile

COPY --from=base /app/packages ./packages
COPY --from=base /app/services/api/dist ./services/api/dist
COPY --from=base /app/services/api/prisma ./services/api/prisma

RUN cd /app && (npm rebuild bcrypt --build-from-source 2>&1 || true)

WORKDIR /app/services/api
RUN pnpm db:generate

EXPOSE 3001
CMD ["node", "dist/main.js"]
