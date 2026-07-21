# Strapi Dockerfile for Railway
# Build context is the monorepo root
FROM node:18-alpine

# Install dependencies for native modules (vips for image processing)
RUN apk add --no-cache build-base gcc autoconf automake zlib-dev libpng-dev vips-dev git python3

WORKDIR /app

# Copy Strapi package files only (from services/strapi/)
COPY services/strapi/package*.json ./

# Install dependencies (no prepare script in strapi's package.json)
RUN npm install --legacy-peer-deps

# Copy Strapi source code
COPY services/strapi/ ./

# Build Strapi admin panel
ENV NODE_ENV=production
RUN npm run build

# Create non-root user
RUN addgroup -S strapi && adduser -S strapi -G strapi
RUN chown -R strapi:strapi /app

USER strapi

# Expose port
EXPOSE 1337

# Copy schema script
COPY --chown=strapi:strapi services/strapi/scripts ./scripts

# Start: create schema then launch Strapi
CMD ["sh", "-c", "node scripts/ensure-schema.js && npm run start"]
