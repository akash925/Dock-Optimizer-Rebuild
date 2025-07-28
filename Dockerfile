# syntax=docker/dockerfile:1
#
# Multi-stage build
#   1. deps    : install exact lockfile deps (native builds approved)
#   2. build   : compile client + server, prune dev deps
#   3. runtime : Alpine + OCR / Chromium libs + Doppler CLI
#
# Final image ≈ 550 MB (Chromium + Tesseract included)

########################  base  ########################
FROM node:20-alpine AS base
WORKDIR /app

RUN apk add --no-cache \
      dumb-init \
      python3 py3-pip \
      tesseract-ocr tesseract-ocr-data-eng \
      chromium nss freetype harfbuzz ca-certificates ttf-freefont \
   && mkdir -p /app/uploads /app/server/logs

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

RUN corepack enable && corepack prepare pnpm@10.12.1 --activate

########################  deps  ########################
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile \
 && pnpm approve-builds esbuild @swc/core

########################  build  ########################
FROM deps AS build
COPY . .
RUN pnpm run build:client \
 && pnpm run build:server
RUN pnpm prune --prod

########################  runtime  ########################
FROM base AS runtime

RUN addgroup -g 1001 -S nodejs \
 && adduser -S dockopt -u 1001 -G nodejs

    # install Doppler CLI dependencies and Doppler CLI (still root)
    RUN apk add --no-cache gnupg wget curl && \
        wget -qO- https://cli.doppler.com/install.sh | sh

USER dockopt

COPY --from=build /app/dist          ./dist
COPY --from=build /app/node_modules  ./node_modules
COPY --from=build /app/package.json  .

RUN pip3 install --no-cache-dir --break-system-packages Pillow

ENV NODE_ENV=production \
    PORT=3000 \
    UPLOAD_DIR=/app/uploads \
    LOG_DIR=/app/server/logs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget -qO- http://localhost:${PORT}/api/health || exit 1

CMD ["dumb-init","doppler","run","--config","prd","--","node","dist/server/server/index.js"]
