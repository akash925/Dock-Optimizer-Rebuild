# Replit Production Deployment Guide

## 🚀 Quick Start for Production Launch

### Prerequisites
- Replit account with deployment access
- Neon database configured and accessible
- SendGrid API key for email notifications

### Required Environment Variables (Replit Secrets)
```bash
DATABASE_URL=postgresql://neondb_owner:your_password@your_host.neon.tech/neondb?sslmode=require
SENDGRID_API_KEY=SG.your_sendgrid_api_key
SENDGRID_FROM_EMAIL=noreply@dockoptimizer.com
```

### Optional Environment Variables (S3 - can be added later)
```bash
AWS_S3_BUCKET=your-bucket-name
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=us-east-1
AWS_CLOUDFRONT_DOMAIN=your-cloudfront-domain (optional)
```

## 📦 Deployment Steps

### 1. Environment Setup
1. Go to your Replit project
2. Click on "Secrets" in the left sidebar
3. Add the required environment variables listed above
4. Ensure `DATABASE_URL` points to your Neon database

### 2. Database Seeding
After setting up environment variables, seed the database:
```bash
npm run db:seed
```

This will populate the database with US federal holidays for all organizations.

### 3. Build and Deploy
The app will automatically build and deploy when you:
- Push changes to the main branch
- Or click "Deploy" in the Replit interface

### 4. Verify Deployment
- Check that the app starts without errors
- Verify database connectivity
- Test the appointment master functionality
- Confirm external booking forms work

## 🔧 Configuration Details

### Database Configuration
- **Production Database**: Neon PostgreSQL
- **Connection Pooling**: Configured for Neon's connection limits
- **Migrations**: Automatically applied during deployment

### File Storage
- **Without S3**: Files stored locally (development/testing)
- **With S3**: Files stored in AWS S3 (recommended for production)
- **Graceful Fallback**: App works without S3 configuration

### Email Notifications
- **Service**: SendGrid
- **Required**: Yes, for appointment confirmations
- **Fallback**: App will warn but continue without email

## 🚨 Troubleshooting

### Common Issues

#### 1. Database Connection Errors
```bash
Error: No database connection string was provided
```
**Solution**: Ensure `DATABASE_URL` is set in Replit Secrets

#### 2. Build Failures
```bash
Build failed with TypeScript errors
```
**Solution**: Check the build logs and fix any TypeScript issues

#### 3. S3 Configuration Warnings
```bash
⚠️ S3 environment variables not configured
```
**Solution**: This is expected if S3 is not configured. App will use local storage.

#### 4. Email Service Warnings
```bash
API key does not start with "SG."
```
**Solution**: Ensure your SendGrid API key is correct and starts with "SG."

### Debug Commands
```bash
# Check environment variables
echo $DATABASE_URL

# Test database connection
npm run db:seed

# Check build output
npm run build

# Run in development mode
npm run dev
```

## 🎯 Production Checklist

### Before Launch
- [ ] Database URL configured and accessible
- [ ] SendGrid API key configured
- [ ] App builds successfully
- [ ] Database seeded with holidays
- [ ] Appointment master loads correctly
- [ ] External booking forms work
- [ ] Email notifications functional

### After Launch
- [ ] Monitor server logs for errors
- [ ] Test end-to-end booking flow
- [ ] Verify calendar functionality
- [ ] Check notification system
- [ ] Monitor database performance

## 📊 Performance Optimization

### Database
- Connection pooling configured for Neon
- Prepared statements for common queries
- Proper indexing on frequently queried columns

### File Storage
- Local storage for development
- S3 for production (when configured)
- Graceful fallback system

### Caching
- Query result caching where appropriate
- Static asset caching via Vite build

## 🔐 Security Considerations

### Environment Variables
- Never commit secrets to version control
- Use Replit Secrets for sensitive data
- Rotate API keys regularly

### Database Security
- SSL connections required (sslmode=require)
- Connection string includes authentication
- Proper tenant isolation implemented

### File Uploads
- File type validation
- Size limits enforced
- Tenant-based file isolation

## 📞 Support

If you encounter issues during deployment:
1. Check the troubleshooting section above
2. Review server logs in Replit console
3. Verify environment variables are correctly set
4. Test database connectivity with `npm run db:seed`

## 🎉 Success!

Once deployed successfully, your Dock Optimizer application will be available at your Replit URL with:
- ✅ Appointment master functionality
- ✅ External booking forms
- ✅ Calendar management
- ✅ Email notifications
- ✅ Database persistence
- ✅ Standard question management

The app is now ready for production use! 🚀 