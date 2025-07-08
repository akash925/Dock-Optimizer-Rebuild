#!/bin/bash

# Enhanced Production Launch Script for Replit with Doppler
echo "🚀 Setting up production environment for Replit..."

# Check if Doppler is available
if ! command -v doppler &> /dev/null; then
    echo "❌ Doppler CLI not found. Please install it first."
    echo "💡 Install with: curl -Ls https://cli.doppler.com/install.sh | sh"
    exit 1
fi

# Update environment for production
export NODE_ENV=production
export PORT=5000

# Automatically detect Replit URL
if [ -n "$REPL_SLUG" ] && [ -n "$REPL_OWNER" ]; then
    export HOST_URL="https://$REPL_SLUG.$REPL_OWNER.repl.co"
    echo "📡 Auto-detected Replit URL: $HOST_URL"
else
    echo "⚠️  Could not auto-detect Replit URL. Using fallback."
    export HOST_URL="https://7ac480e5-c3a6-4b78-b256-c68d212e19fa-00-iao1i3rlgulq.worf.replit.dev"
fi

# Verify critical environment variables
echo "🔍 Checking environment configuration..."

if [ -z "$DATABASE_URL" ]; then
    echo "❌ DATABASE_URL not set. Please configure in Replit Secrets."
    exit 1
else
    echo "✅ Database URL configured"
fi

if [ -z "$SENDGRID_API_KEY" ]; then
    echo "⚠️  SENDGRID_API_KEY not set. Email notifications will be disabled."
else
    echo "✅ SendGrid API key configured"
fi

if [ -z "$SENDGRID_FROM_EMAIL" ]; then
    echo "⚠️  SENDGRID_FROM_EMAIL not set. Using fallback email."
else
    echo "✅ SendGrid sender email configured"
fi

# Build the application
echo "📦 Building application..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed. Aborting deployment."
    exit 1
fi

echo "✅ Build completed successfully"

# Run basic health checks
echo "🏥 Running pre-deployment health checks..."

# Check if dist directory exists
if [ ! -d "dist" ]; then
    echo "❌ Build output directory not found"
    exit 1
fi

# Check if required files exist
if [ ! -f "dist/index.js" ]; then
    echo "❌ Server build output not found"
    exit 1
fi

echo "✅ Health checks passed"

# Start in production mode
echo "🌟 Starting in production mode..."
echo "📍 Application will be available at: $HOST_URL"

# Use Doppler if available, otherwise use regular environment variables
if command -v doppler &> /dev/null && [ -n "$DOPPLER_TOKEN" ]; then
    echo "🔐 Using Doppler for secret management..."
    doppler run --config prd -- npm run start
else
    echo "🔐 Using Replit secrets for environment variables..."
    npm run start
fi 