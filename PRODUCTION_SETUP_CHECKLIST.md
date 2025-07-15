# Production Setup Checklist for Dock Optimizer

## 🚀 Pre-Launch Checklist for Replit Deployment

### 1. Environment Variables Setup (Critical)

**Required Environment Variables in Replit Secrets:**
```bash
# Database (Required)
DATABASE_URL="postgresql://neondb_owner:your_password@your_host.neon.tech/neondb?sslmode=require"

# Email Notifications (Required)
SENDGRID_API_KEY="SG.your_sendgrid_api_key"
SENDGRID_FROM_EMAIL="noreply@dockoptimizer.com"

# Optional S3 Configuration (for file uploads)
AWS_S3_BUCKET="your-bucket-name"
AWS_ACCESS_KEY_ID="your-access-key"
AWS_SECRET_ACCESS_KEY="your-secret-key"
AWS_REGION="us-east-1"
AWS_CLOUDFRONT_DOMAIN="your-cloudfront-domain"

# Optional Redis (for advanced features)
REDIS_URL="rediss://your-redis-url:6379"
```

### 2. Database Seeding Steps

**Step 1: Holiday Seeding (Already Working)**
```bash
npm run db:seed
```
✅ **Status**: Working - Seeds 40 US federal holidays for all organizations

**Step 2: Production Data Setup**
```bash
# Run comprehensive production fixes
npx tsx server/scripts/comprehensive-production-fixes.ts

# Or run individual scripts:
npx tsx server/scripts/create-missing-organizations.ts
npx tsx server/scripts/create-default-appointment-types.ts
npx tsx server/scripts/fix-user-organization-mapping.ts
```

**Step 3: Verify Setup**
```bash
npx tsx server/scripts/production-readiness-check.ts
```

### 3. Key Features Verification

**Essential Features to Test:**
- [ ] Organization branding (logos display correctly)
- [ ] Appointment booking flow works end-to-end
- [ ] External booking forms function properly
- [ ] BOL upload works without authentication errors
- [ ] Timezone handling shows facility times correctly
- [ ] Email notifications send successfully
- [ ] User management displays users correctly
- [ ] Calendar view shows appointments with proper colors

### 4. Database Persistence Verification

**Check These Data Points:**
- [ ] Organizations exist and have proper branding
- [ ] Users are mapped to correct organizations
- [ ] Appointment types are created for each organization
- [ ] Holidays are seeded for availability calculations
- [ ] Facilities have proper timezone settings
- [ ] Standard questions are saved for appointment types

### 5. Critical Production Scripts

**Available Scripts for Production Setup:**

1. **`comprehensive-production-fixes.ts`** - Complete setup script
   - Creates missing organizations
   - Fixes user-organization mappings
   - Creates default appointment types
   - Activates inactive assets
   - Verifies database consistency

2. **`production-readiness-check.ts`** - Validation script
   - Tests database connections
   - Verifies user mappings
   - Checks appointment types
   - Validates tenant isolation

3. **`create-default-appointment-types.ts`** - Appointment setup
   - Creates standard appointment types
   - Sets up proper durations and colors
   - Configures facility associations

4. **`create-missing-organizations.ts`** - Organization setup
   - Ensures Hanzo Logistics exists
   - Creates Ronald McDonald House Philadelphia
   - Sets up proper tenant structure

### 6. Production Deployment Commands

**In Replit Console:**
```bash
# 1. Set up environment variables in Replit Secrets first

# 2. Run database seeding
npm run db:seed

# 3. Run production setup
npx tsx server/scripts/comprehensive-production-fixes.ts

# 4. Verify everything is working
npx tsx server/scripts/production-readiness-check.ts

# 5. Build and start production
npm run build
npm run start
```

### 7. Persistent Data Storage Verification

**Data That Must Persist:**
- [ ] **Organizations**: Hanzo Logistics, Ronald McDonald House Philadelphia
- [ ] **Users**: Admin users mapped to correct organizations
- [ ] **Appointment Types**: Default types for each organization
- [ ] **Holidays**: US federal holidays for availability calculations
- [ ] **Facilities**: With proper timezone configurations
- [ ] **Branding**: Organization logos and colors
- [ ] **Standard Questions**: Appointment master questions

### 8. Launch Readiness Criteria

**Green Light Criteria:**
- [ ] Database seeding completes successfully
- [ ] All production scripts run without errors
- [ ] External booking forms work end-to-end
- [ ] Organization branding displays correctly
- [ ] Email notifications send properly
- [ ] Calendar displays appointments correctly
- [ ] BOL upload functions without errors
- [ ] Timezone handling works properly

### 9. Post-Launch Monitoring

**Monitor These After Launch:**
- [ ] Database connections remain stable
- [ ] File uploads work consistently
- [ ] Email notifications deliver successfully
- [ ] Calendar synchronization functions
- [ ] User authentication works properly
- [ ] Organization isolation is maintained

### 10. Troubleshooting Guide

**Common Issues and Solutions:**

**Issue: Database seeding fails**
- Solution: Verify DATABASE_URL in Replit Secrets
- Check Neon database is accessible
- Ensure proper SSL configuration

**Issue: Email notifications don't send**
- Solution: Verify SENDGRID_API_KEY in Replit Secrets
- Check SendGrid account is active
- Verify sender email is configured

**Issue: File uploads fail**
- Solution: S3 is optional - app falls back to local storage
- Check AWS credentials if S3 is needed
- Verify bucket permissions

**Issue: Organization branding missing**
- Solution: Run `comprehensive-production-fixes.ts`
- Upload logos via admin portal
- Verify booking page logo endpoint

### 11. Ronald McDonald House Philadelphia Setup

**Specific Steps for RMHP:**
1. Ensure organization exists in database
2. Upload organization logo via admin portal
3. Configure booking page with proper branding
4. Set up appointment types for their facility
5. Configure timezone (America/New_York)
6. Test external booking flow
7. Verify email notifications work

---

## 🎯 Quick Launch Commands

**For immediate production deployment:**
```bash
# In Replit Console (after setting environment variables):
npm run db:seed
npx tsx server/scripts/comprehensive-production-fixes.ts
npm run build
npm run start
```

**Expected Output:**
- ✅ Holiday seeding: 40 entries created
- ✅ Organizations: Hanzo Logistics, RMHP created
- ✅ Users: All mapped to organizations
- ✅ Appointment types: Default types created
- ✅ Production ready: All checks pass

---

## 📞 Support

If any step fails during production deployment:
1. Check Replit console logs
2. Verify environment variables are set
3. Ensure Neon database is accessible
4. Run individual scripts to isolate issues
5. Check network connectivity for external services 