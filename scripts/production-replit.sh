#!/bin/bash

# Production startup script for Replit
# This script ensures the app can start properly with graceful S3 fallback

echo "🚀 Starting Dock Optimizer production build..."

# Check for critical environment variables
if [ -z "$DATABASE_URL" ]; then
    echo "❌ DATABASE_URL is required for production"
    exit 1
fi

if [ -z "$SENDGRID_API_KEY" ]; then
    echo "❌ SENDGRID_API_KEY is required for production"
    exit 1
fi

# Check for optional S3 environment variables
if [ -z "$AWS_S3_BUCKET" ] || [ -z "$AWS_ACCESS_KEY_ID" ] || [ -z "$AWS_SECRET_ACCESS_KEY" ]; then
    echo "⚠️  S3 environment variables not configured - file uploads will use local storage"
    echo "   Missing: AWS_S3_BUCKET, AWS_ACCESS_KEY_ID, or AWS_SECRET_ACCESS_KEY"
    echo "   This is acceptable for development/testing but not recommended for production"
fi

# Build the application
echo "📦 Building application..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed"
    exit 1
fi

echo "✅ Build completed successfully"

# Start the application
echo "🌟 Starting production server..."
npm run start 