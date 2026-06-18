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

# Expose port
EXPOSE 1337

# Start Strapi
CMD ["npm", "run", "start"]
