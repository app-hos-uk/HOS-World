# Strapi Dockerfile for Railway
FROM node:18-alpine

# Install dependencies for native modules
RUN apk add --no-cache build-base gcc autoconf automake zlib-dev libpng-dev vips-dev git python3

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build Strapi admin panel
ENV NODE_ENV=production
RUN npm run build

# Expose port
EXPOSE 1337

# Start Strapi
CMD ["npm", "run", "start"]
