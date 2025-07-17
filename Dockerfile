########################
# ---- Build stage ----
########################
FROM node:20-alpine AS builder

# 1. Enable PNPM
RUN corepack enable && corepack prepare pnpm@8.15.4 --activate

WORKDIR /app

# 2. Install deps first to leverage Docker cache
COPY package.json pnpm-lock.yaml* ./
COPY .npmrc* ./
RUN pnpm install --frozen-lockfile

# 3. Copy source and build
COPY . .


RUN pnpm build:client

RUN pnpm build:server

#############################
# ---- Runtime stage ----
#############################
FROM node:20-alpine

RUN apk add --no-cache dumb-init

ENV NODE_ENV=production
WORKDIR /app

# 4. Bring in prod artefacts only
COPY --from=builder /app/node_modules ./node_modules    
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./

# Replit injects $PORT; fall back to 3000 just in case
ENV PORT=3000
EXPOSE 3000

# 5. Boot with Doppler
CMD ["dumb-init", "doppler", "run", "--config", "prd", "--", "node", "dist/server/index.js"]
