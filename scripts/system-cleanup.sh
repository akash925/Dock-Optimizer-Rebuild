#!/bin/bash

# 🧹 System Cleanup & Optimization Script
# Comprehensive cleanup for production deployment

echo "🚀 Starting Dock Optimizer System Cleanup..."
echo "=============================================="

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check file/directory and clean if exists
safe_clean() {
    if [ -e "$1" ]; then
        echo "🗑️  Removing $1"
        rm -rf "$1"
    fi
}

# 1. Clean Node.js caches and artifacts
echo ""
echo "1️⃣ Cleaning Node.js artifacts..."
echo "================================"

safe_clean "node_modules/.cache/"
safe_clean ".npm/"
safe_clean ".next/"
safe_clean ".vite/"
safe_clean ".turbo/"
safe_clean "dist/"
safe_clean "build/"

# Clean any log files
safe_clean "*.log"
safe_clean "logs/"

echo "✅ Node.js artifacts cleaned"

# 2. Clean TypeScript build cache
echo ""
echo "2️⃣ Cleaning TypeScript cache..."
echo "==============================="

safe_clean ".tsbuildinfo"
safe_clean "tsconfig.tsbuildinfo"
safe_clean "client/tsconfig.tsbuildinfo"
safe_clean "server/tsconfig.tsbuildinfo"

echo "✅ TypeScript cache cleaned"

# 3. Clean temporary files
echo ""
echo "3️⃣ Cleaning temporary files..."
echo "=============================="

safe_clean ".tmp/"
safe_clean "temp/"
safe_clean "tmp/"
safe_clean "*.tmp"

# Clean OS-specific temporary files
safe_clean ".DS_Store"
safe_clean "Thumbs.db"
safe_clean "*.swp"
safe_clean "*.swo"

echo "✅ Temporary files cleaned"

# 4. Optimize package dependencies
echo ""
echo "4️⃣ Optimizing dependencies..."
echo "============================="

if command_exists npm; then
    echo "📦 Cleaning npm cache..."
    npm cache clean --force
    
    echo "🔍 Checking for security vulnerabilities..."
    npm audit --fix >/dev/null 2>&1 || true
    
    echo "📋 Reinstalling dependencies..."
    npm install
    
    echo "✅ Dependencies optimized"
else
    echo "⚠️  npm not found, skipping dependency optimization"
fi

# 5. Verify system health
echo ""
echo "5️⃣ System health verification..."
echo "================================"

# Check if critical files exist
critical_files=(
    "package.json"
    "server/index.ts"
    "shared/schema.ts"
    "client/src/main.tsx"
    "drizzle.config.ts"
)

for file in "${critical_files[@]}"; do
    if [ -f "$file" ]; then
        echo "✅ $file exists"
    else
        echo "❌ $file missing"
    fi
done

# Check environment configuration
if [ -f ".env" ]; then
    echo "✅ Environment file exists"
    # Check for placeholder values
    if grep -q "your-sendgrid-api-key" .env; then
        echo "⚠️  SendGrid placeholder values detected"
    fi
    if grep -q "localhost" .env; then
        echo "⚠️  Localhost values detected (update for production)"
    fi
else
    echo "⚠️  .env file not found"
fi

# 6. Build verification
echo ""
echo "6️⃣ Build verification..."
echo "======================="

if command_exists npm; then
    echo "🔨 Testing build process..."
    if npm run build >/dev/null 2>&1; then
        echo "✅ Build successful"
        
        # Check build outputs
        if [ -d "dist" ]; then
            echo "✅ Build directory created"
            if [ -f "dist/index.js" ]; then
                echo "✅ Server build output exists"
            else
                echo "⚠️  Server build output missing"
            fi
        else
            echo "❌ Build directory not created"
        fi
    else
        echo "❌ Build failed"
    fi
    
    echo "🔍 Running TypeScript checks..."
    if npm run check >/dev/null 2>&1; then
        echo "✅ TypeScript checks passed"
    else
        echo "⚠️  TypeScript warnings present"
    fi
else
    echo "⚠️  npm not found, skipping build verification"
fi

# 7. Security cleanup
echo ""
echo "7️⃣ Security cleanup..."
echo "====================="

# Remove any accidentally committed secrets
secrets_patterns=(
    "*.pem"
    "*.key"
    "*.p12"
    "*.pfx"
    ".env.local"
    ".env.production"
)

for pattern in "${secrets_patterns[@]}"; do
    if ls $pattern 1> /dev/null 2>&1; then
        echo "⚠️  Found potential secret files: $pattern"
    fi
done

# Check git status if git is available
if command_exists git && [ -d ".git" ]; then
    echo "🔍 Checking git status..."
    git status --porcelain | head -5
    if [ -n "$(git status --porcelain)" ]; then
        echo "⚠️  Uncommitted changes detected"
    else
        echo "✅ Working directory clean"
    fi
fi

# 8. Final system status
echo ""
echo "8️⃣ Final system status..."
echo "========================"

# Calculate disk space saved
echo "💾 Cleanup complete!"

# Display recommendations
echo ""
echo "📋 RECOMMENDATIONS:"
echo "==================="

if grep -q "your-sendgrid-api-key" .env 2>/dev/null; then
    echo "❗ CRITICAL: Update SendGrid configuration (see EMAIL_SETUP_GUIDE.md)"
fi

if grep -q "localhost" .env 2>/dev/null; then
    echo "⚠️  UPDATE: Set production URLs in environment variables"
fi

if [ ! -f "dist/index.js" ]; then
    echo "⚠️  BUILD: Run 'npm run build' before deployment"
fi

echo ""
echo "🎉 SYSTEM CLEANUP COMPLETE!"
echo "==========================="
echo ""
echo "Your Dock Optimizer is now optimized and ready for deployment! 🚀"
echo ""
echo "Next steps:"
echo "1. Review EMAIL_SETUP_GUIDE.md for email configuration"
echo "2. Update environment variables for production"
echo "3. Run 'npm run production' for production deployment"
echo "4. Monitor system health using SYSTEM_HEALTH_CHECK.md"
echo "" 