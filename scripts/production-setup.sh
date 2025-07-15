#!/bin/bash

# Production Setup Script for Dock Optimizer
# This script sets up the Neon database with all necessary data for production launch

echo "🚀 DOCK OPTIMIZER PRODUCTION SETUP"
echo "=================================="
echo ""

# Check if required environment variables are set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ ERROR: DATABASE_URL environment variable is not set"
    echo "Please set your Neon database URL in Replit Secrets"
    exit 1
fi

if [ -z "$SENDGRID_API_KEY" ]; then
    echo "❌ ERROR: SENDGRID_API_KEY environment variable is not set"
    echo "Please set your SendGrid API key in Replit Secrets"
    exit 1
fi

echo "✅ Environment variables validated"
echo ""

# Step 1: Seed holidays
echo "📅 STEP 1: Seeding US Federal Holidays"
echo "-------------------------------------"
npm run db:seed
if [ $? -ne 0 ]; then
    echo "❌ Holiday seeding failed"
    exit 1
fi
echo "✅ Holiday seeding completed"
echo ""

# Step 2: Run comprehensive production fixes
echo "🔧 STEP 2: Running Production Setup"
echo "-----------------------------------"
npx tsx server/scripts/comprehensive-production-fixes.ts
if [ $? -ne 0 ]; then
    echo "❌ Production setup failed"
    exit 1
fi
echo "✅ Production setup completed"
echo ""

# Step 3: Verify production readiness
echo "🔍 STEP 3: Verifying Production Readiness"
echo "----------------------------------------"
npx tsx server/scripts/production-readiness-check.ts
if [ $? -ne 0 ]; then
    echo "⚠️  Production readiness check failed"
    echo "Please review the issues above before deploying"
    exit 1
fi
echo "✅ Production readiness verified"
echo ""

# Step 4: Build the application
echo "🏗️  STEP 4: Building Application"
echo "-------------------------------"
npm run build
if [ $? -ne 0 ]; then
    echo "❌ Build failed"
    exit 1
fi
echo "✅ Build completed"
echo ""

# Final summary
echo "🎉 PRODUCTION SETUP COMPLETE!"
echo "============================"
echo ""
echo "✅ Database seeded with holidays"
echo "✅ Organizations and users set up"
echo "✅ Appointment types created"
echo "✅ Production readiness verified"
echo "✅ Application built successfully"
echo ""
echo "🚀 Your Dock Optimizer is ready for production launch!"
echo ""
echo "Next steps:"
echo "1. Deploy to Replit production"
echo "2. Test the external booking flow"
echo "3. Verify organization branding"
echo "4. Test email notifications"
echo ""
echo "Launch command: npm run start" 