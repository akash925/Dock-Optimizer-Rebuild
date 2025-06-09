#!/bin/bash

echo "🧹 CLEARING REPLIT CACHE FOR FRESH DEPLOYMENT SIMULATION"
echo "========================================================"

echo ""
echo "1️⃣ Clearing Node.js cache and modules..."
echo "========================================="
rm -rf node_modules/
rm -f package-lock.json
echo "✅ Node modules cleared"

echo ""
echo "2️⃣ Clearing build and compilation caches..."
echo "=========================================="
rm -rf .next/ 2>/dev/null || true
rm -rf dist/ 2>/dev/null || true
rm -rf build/ 2>/dev/null || true
rm -rf .vite/ 2>/dev/null || true
rm -rf .turbo/ 2>/dev/null || true
rm -rf .cache/ 2>/dev/null || true
echo "✅ Build caches cleared"

echo ""
echo "3️⃣ Clearing TypeScript cache..."
echo "==============================="
rm -rf .tsbuildinfo 2>/dev/null || true
rm -rf tsconfig.tsbuildinfo 2>/dev/null || true
echo "✅ TypeScript cache cleared"

echo ""
echo "4️⃣ Clearing any temp/runtime files..."
echo "====================================="
rm -rf .tmp/ 2>/dev/null || true
rm -rf temp/ 2>/dev/null || true
rm -f *.log 2>/dev/null || true
echo "✅ Runtime files cleared"

echo ""
echo "5️⃣ Fresh install dependencies..."
echo "==============================="
npm cache clean --force
npm install
echo "✅ Fresh dependencies installed"

echo ""
echo "🎯 REPLIT CACHE CLEAR COMPLETE!"
echo "==============================="
echo ""
echo "Your Replit environment is now as clean as a fresh deployment."
echo "Ready to test with:"
echo "  npm run dev"
echo ""
echo "This simulates exactly what would happen in production! 🚀" 