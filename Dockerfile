# syntax=docker/dockerfile:1
FROM node:20-alpine AS base

# Install system dependencies for OCR, Python, and Chromium
RUN apk add --no-cache \
    python3 \
    py3-pip \
    tesseract-ocr \
    tesseract-ocr-data-eng \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    dumb-init \
    wget

# Set Puppeteer to use system Chromium (prevents binary downloads)
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

# Enable PNPM with correct version from lockfile
RUN corepack enable && corepack prepare pnpm@10.12.1 --activate

################################
# Dependencies stage
################################
FROM base AS deps
WORKDIR /app

COPY package.json pnpm-lock.yaml ./
COPY .npmrc* ./

# Install all dependencies (handle lockfile mismatch)
RUN pnpm install --no-frozen-lockfile

################################
# Build stage  
################################
FROM deps AS builder
WORKDIR /app

# Copy source code
COPY . .

# Build client only (skip server compilation, use runtime TypeScript)
RUN pnpm build:client

################################
# Production runtime
################################
FROM base AS runtime

WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S dock-optimizer -u 1001 -G nodejs

# Create directories with proper ownership
RUN mkdir -p /app/uploads /app/server/logs && \
    chown -R dock-optimizer:nodejs /app

# Copy production artifacts
COPY --from=builder --chown=dock-optimizer:nodejs /app/dist ./dist
COPY --from=deps --chown=dock-optimizer:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=dock-optimizer:nodejs /app/package.json ./
COPY --from=builder --chown=dock-optimizer:nodejs /app/server ./server
COPY --from=builder --chown=dock-optimizer:nodejs /app/shared ./shared
COPY --from=builder --chown=dock-optimizer:nodejs /app/tsconfig*.json ./

# Install basic Python OCR dependencies (compatible with Alpine/ARM)
COPY --from=builder /app/server/src/services/ocr_processor.py ./server/src/services/
RUN pip3 install --no-cache-dir --break-system-packages Pillow

USER dock-optimizer

# Environment defaults for Docker deployment
ENV NODE_ENV=production \
    PORT=5001 \
    UPLOAD_DIR=/app/uploads \
    LOG_DIR=/app/server/logs

EXPOSE 5001

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5001/api/health || exit 1

# Use tsx for runtime TypeScript execution
CMD ["dumb-init", "npx", "tsx", "server/index.ts"]
