#!/bin/bash
# Clean launch script that works around vite hostname issues

echo "🧹 Clean Launch: Dock Optimizer"
echo "================================"

# Kill any existing processes
echo "🔄 Cleaning existing processes..."
pkill -f "tsx\|vite\|node\|doppler" 2>/dev/null || true
sleep 2

# Build frontend (this works)
echo "📦 Building frontend assets..."
doppler run --config prd -- vite build --mode production --logLevel error

if [ $? -eq 0 ]; then
    echo "✅ Frontend build successful"
    ls -la dist/public/ | head -5
else
    echo "❌ Frontend build failed"
    exit 1
fi

# Skip backend compilation and run directly with tsx
echo "🚀 Starting production server (direct mode)..."
doppler run --config prd -- tsx server/index.ts

echo "🎯 Server should be running on port 5001"
echo "📱 Frontend assets served from dist/public/"
echo "🔒 All secrets loaded from Doppler"