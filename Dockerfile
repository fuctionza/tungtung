# =======================================================
# TungTung restaurant - Dockerfile
# Project: TungTung restaurant
# Target Account: nananashop19911@gmail.com
# =======================================================

FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy application files
COPY . .

# Environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
ENV CORS_ORIGIN="*"
ENV PROJECT_NAME="TungTung restaurant"
ENV OWNER_EMAIL=nananashop19911@gmail.com

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

# Start TungTung restaurant Server
CMD ["node", "server.js"]
