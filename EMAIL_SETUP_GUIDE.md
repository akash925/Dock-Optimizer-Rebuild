# 📧 Email Setup Guide for Dock Optimizer

## Current Issue
Email notifications are not working because placeholder values are being used instead of real SendGrid configuration.

## 🔧 Quick Fix for Email

### Step 1: Get SendGrid API Key
1. Go to [SendGrid](https://app.sendgrid.com/)
2. Sign up for a free account (100 emails/day free)
3. Navigate to **Settings > API Keys**
4. Create a new API key with "Full Access"
5. Copy the key (starts with `SG.`)

### Step 2: Set Up Sender Authentication
1. In SendGrid, go to **Settings > Sender Authentication**
2. **Option A: Single Sender Verification** (Quick)
   - Add your email address
   - Verify via email
   - Use this email as your FROM address
3. **Option B: Domain Authentication** (Professional)
   - Add your domain
   - Follow DNS setup instructions

### Step 3: Update Environment Variables

#### For Local Development (.env file):
```env
# Replace the placeholder values with real ones:
DATABASE_URL=postgresql://neondb_owner:npg_fha53NmqtcSl@ep-white-sunset-a5uf7anh-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require
SENDGRID_API_KEY=SG.your_actual_api_key_here
SENDGRID_FROM_EMAIL=notifications@yourdomain.com
HOST_URL=http://localhost:5001
NODE_ENV=development
```

#### For Replit Production (Secrets):
1. Open your Replit project
2. Click **Secrets** (🔒) in the sidebar
3. Add these secrets:
   - `SENDGRID_API_KEY`: Your actual SendGrid API key
   - `SENDGRID_FROM_EMAIL`: Your verified sender email
   - `HOST_URL`: Your Replit app URL

### Step 4: Test Email Configuration

Run the built-in email test:
```bash
# Test SendGrid connectivity
node server/test-real-email.ts
```

Or use the Settings page in the app:
1. Log in as admin
2. Go to Settings
3. Click "Send Test Email"

## 🚀 Production Email Best Practices

### Recommended FROM Email Addresses:
- `notifications@yourdomain.com`
- `noreply@yourdomain.com` 
- `appointments@yourdomain.com`

### Email Templates Available:
1. **Appointment Confirmation** - With QR code for check-in
2. **Appointment Reminder** - 24 hours before
3. **Reschedule Notification** - When appointments change
4. **Cancellation Notice** - When appointments are cancelled
5. **User Invitation** - For new team members

### Email Features Included:
- ✅ **QR Code Generation** - For mobile check-in
- ✅ **HTML & Text Templates** - Professional formatting
- ✅ **Attachment Support** - For BOL documents
- ✅ **Retry Logic** - Automatic retry on failures
- ✅ **Debug Logging** - For troubleshooting

## 🔍 Troubleshooting Email Issues

### Common Problems:

#### 1. "SendGrid API key not set"
**Fix**: Add your real API key to environment variables

#### 2. "Invalid sender email address"
**Fix**: Use a verified sender email from SendGrid

#### 3. "Email appears to be an API key"
**Fix**: Don't use the API key as the FROM email address

#### 4. Emails not being delivered
**Check**:
- Spam folder
- SendGrid activity feed
- Sender reputation

### Debug Commands:
```bash
# Check environment variables are loaded
echo $SENDGRID_API_KEY
echo $SENDGRID_FROM_EMAIL

# Test email sending directly
npm run test:email

# Enable email debugging
export DEBUG_EMAILS=true
npm run dev
```

## 📊 SendGrid Dashboard Monitoring

After setup, monitor your emails at:
- **Activity Feed**: See delivery status
- **Statistics**: Track open/click rates  
- **Suppressions**: Check for bounced emails
- **Templates**: Manage email designs

## 🔐 Security Notes

- ✅ **API keys in environment variables** (not committed to git)
- ✅ **Verified sender authentication**
- ✅ **SSL/TLS encryption** for all emails
- ✅ **Rate limiting** built into SendGrid

## 💡 Next Steps

1. **Immediate**: Set up SendGrid account and update environment variables
2. **Testing**: Send test emails to verify functionality
3. **Production**: Update Replit secrets with production values
4. **Monitoring**: Set up SendGrid webhooks for delivery tracking (optional)

## 📋 Email Configuration Checklist

- [ ] SendGrid account created
- [ ] API key generated and copied
- [ ] Sender email verified
- [ ] Environment variables updated
- [ ] Test email sent successfully
- [ ] All email templates working
- [ ] Production secrets configured
- [ ] Monitoring set up

Once this is complete, all appointment confirmations, reminders, and notifications will work properly! 🎉 