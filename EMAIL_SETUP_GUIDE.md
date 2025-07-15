# Email Setup Guide

This guide explains how to configure email notifications for the Dock Optimizer application.

## ⚠️ **CRITICAL: Email Configuration Required**

**Current Issue**: Emails are not sending because SendGrid is not configured.

### Required Environment Variables

Add these to your environment configuration (Replit Secrets or .env file):

```bash
# SendGrid Configuration (REQUIRED for email notifications)
SENDGRID_API_KEY=SG.your_sendgrid_api_key_here
SENDGRID_FROM_EMAIL=noreply@yourdomain.com

# Optional Email Settings
DISABLE_EMAIL_NOTIFICATIONS=false
SKIP_EMAIL_SENDING=false
```

### Quick Fix for Development

If you want to see email content without actually sending emails:

```bash
SKIP_EMAIL_SENDING=true
```

This will log email content to console instead of sending.

### Getting SendGrid API Key

1. Go to [SendGrid](https://sendgrid.com)
2. Create account or log in
3. Go to Settings > API Keys
4. Create new API key with "Mail Send" permissions
5. Copy the key (starts with `SG.`)
6. Add to your environment as `SENDGRID_API_KEY`

### Verify Email Domain

Make sure your `SENDGRID_FROM_EMAIL` uses a domain you've verified in SendGrid.

## SendGrid Setup

### 1. Create SendGrid Account
- Sign up at [SendGrid](https://sendgrid.com)
- Verify your email address
- Complete account verification

### 2. Domain Authentication (Recommended)
```
1. Go to Settings > Sender Authentication
2. Authenticate Your Domain
3. Follow DNS configuration steps
4. Verify domain ownership
```

### 3. Create API Key
```
1. Go to Settings > API Keys  
2. Click "Create API Key"
3. Choose "Restricted Access"
4. Enable "Mail Send" permission
5. Copy the generated key (starts with SG.)
```

### 4. Configure Environment Variables

Add to your Replit Secrets or environment:

```bash
SENDGRID_API_KEY=SG.your_actual_api_key_here
SENDGRID_FROM_EMAIL=noreply@yourdomain.com
```

**⚠️ Important**: 
- Never commit API keys to version control
- Use your verified domain for `SENDGRID_FROM_EMAIL`
- Test with a single email first

### 5. Test Email Configuration

Run the email test script:
```bash
npm run test:email
```

Or create a test appointment to verify emails are sent.

## Troubleshooting

### Common Issues

1. **"SendGrid API key not set"**
   - Add `SENDGRID_API_KEY` to environment
   - Ensure key starts with `SG.`

2. **"Invalid sender email"**
   - Verify domain in SendGrid
   - Use verified email for `SENDGRID_FROM_EMAIL`

3. **API key format error** 
   - Don't confuse API key with sender email
   - API key goes in `SENDGRID_API_KEY`
   - Email address goes in `SENDGRID_FROM_EMAIL`

4. **Emails not received**
   - Check spam folder
   - Verify recipient email format
   - Check SendGrid activity logs

### Development Mode

For development without sending real emails:

```bash
SKIP_EMAIL_SENDING=true
EMAIL_DEBUG=true
```

This will:
- Log email content to console
- Save email HTML to files in `/server/logs`
- Skip actual SendGrid API calls

### Testing Email Content

The application includes email preview functionality. When `EMAIL_DEBUG=true`, email content is saved to:
- `/server/logs/email_[timestamp].txt` - metadata and text
- `/server/logs/email_[timestamp].html` - HTML content

## Email Templates

The system supports custom email templates per organization:

### Available Templates
- **Confirmation**: Sent when appointment is booked
- **Reminder**: Sent before appointment time  
- **Reschedule**: Sent when appointment is changed
- **Cancellation**: Sent when appointment is cancelled
- **Check-out**: Sent when appointment is completed

### Template Variables
Templates support these variables:
- `{{customerName}}` - Customer name
- `{{confirmationCode}}` - Appointment confirmation code
- `{{facilityName}}` - Facility name
- `{{appointmentTime}}` - Appointment date/time
- `{{driverName}}` - Driver name
- `{{truckNumber}}` - Truck number
- `{{notes}}` - Special instructions

### Customizing Templates

Organization admins can customize email templates in:
- Admin Panel > Organization Settings > Email Templates

## Production Deployment

### Environment Variables Checklist
- [ ] `SENDGRID_API_KEY` - Valid API key
- [ ] `SENDGRID_FROM_EMAIL` - Verified sender email
- [ ] `DISABLE_EMAIL_NOTIFICATIONS=false`
- [ ] `SKIP_EMAIL_SENDING=false`

### Monitoring
- Monitor SendGrid dashboard for delivery rates
- Check application logs for email errors
- Set up alerts for failed email deliveries

## Support

For additional help:
- Check SendGrid documentation
- Review application logs in `/server/logs`
- Contact system administrator 