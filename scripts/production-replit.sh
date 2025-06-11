#!/bin/bash

# Production Launch Script for Replit
echo "🚀 Setting up production environment for Replit..."

# Update environment for production
export NODE_ENV=production
export PORT=5000
export HOST_URL="https://7ac480e5-c3a6-4b78-b256-c68d212e19fa-00-iao1i3rlgulq.worf.replit.dev"

# Build the application
echo "📦 Building application..."
npm run build

# Start in production mode
echo "🌟 Starting in production mode..."
npm run start 