FROM node:18-alpine

ARG RUN_FULL_BUILD=false

WORKDIR /workspace

# Install required packages
RUN apk add --no-cache openssl git

# Enable corepack and prepare pnpm
RUN corepack enable && corepack prepare pnpm@9.1.4 --activate

# Copy package files and install dependencies
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Copy the rest of the repository
COPY . .

# Build the application (only when RUN_FULL_BUILD=true)
RUN if [ "$RUN_FULL_BUILD" = "true" ]; then \
      pnpm drizzle:generate && pnpm run build:client && pnpm tsc -p tsconfig.server.json ; \
    fi 