#!/bin/bash
# Production startup script that avoids vite dev server issues

echo "🚀 Starting production build and deployment..."

# Build the frontend
echo "📦 Building frontend..."
doppler run --config prd -- vite build --mode production

# Check if build was successful
if [ $? -eq 0 ]; then
    echo "✅ Frontend build successful"
else
    echo "❌ Frontend build failed"
    exit 1
fi

# Build the backend
echo "🔧 Building backend..."
doppler run --config prd -- tsc -p tsconfig.build.json

# Check if backend build was successful
if [ $? -eq 0 ]; then
    echo "✅ Backend build successful"
else
    echo "❌ Backend build failed"
    exit 1
fi

# Start the production server
echo "🚀 Starting production server..."
doppler run --config prd -- node dist/index.js