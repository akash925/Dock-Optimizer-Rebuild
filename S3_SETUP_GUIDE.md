# S3 Media Storage Setup Guide

This guide explains how to set up Amazon S3 for media uploads in Dock Optimizer, replacing the local file storage system with scalable cloud storage.

## Overview

The S3 media integration provides:
- **Direct uploads**: Files upload directly to S3, bypassing your server
- **Presigned URLs**: Secure, time-limited upload URLs for client-side uploads
- **Scalability**: No server storage limits or disk space concerns
- **CDN support**: Optional CloudFront integration for faster global delivery
- **Security**: Proper tenant isolation and access controls

## Prerequisites

1. **AWS Account**: You'll need an AWS account with S3 access
2. **S3 Bucket**: Create a dedicated S3 bucket for file storage
3. **IAM Credentials**: Create IAM user with appropriate S3 permissions

## Step 1: Create S3 Bucket

1. Log into the [AWS Console](https://console.aws.amazon.com/s3/)
2. Create a new S3 bucket with these settings:
   - **Bucket name**: `dock-optimizer-media-prod` (or similar)
   - **Region**: Choose a region close to your users
   - **Block public access**: Keep enabled (we'll use presigned URLs)
   - **Versioning**: Recommended for data protection
   - **Encryption**: Enable server-side encryption

## Step 2: Configure CORS

Add this CORS configuration to your bucket to allow direct uploads from your web app:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["PUT", "POST", "GET"],
    "AllowedOrigins": [
      "https://yourdomain.com",
      "http://localhost:3000"
    ],
    "ExposeHeaders": ["ETag"]
  }
]
```

## Step 3: Create IAM User

1. Go to [IAM Console](https://console.aws.amazon.com/iam/)
2. Create a new user: `dock-optimizer-s3-user`
3. Attach this policy (replace `YOUR-BUCKET-NAME`):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket",
        "s3:HeadObject"
      ],
      "Resource": [
        "arn:aws:s3:::YOUR-BUCKET-NAME",
        "arn:aws:s3:::YOUR-BUCKET-NAME/*"
      ]
    }
  ]
}
```

4. Generate Access Keys for programmatic access

## Step 4: Environment Variables

Add these environment variables to your application:

```bash
# Required S3 Configuration
AWS_S3_BUCKET=your-bucket-name
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key

# Optional CloudFront CDN (recommended for production)
AWS_CLOUDFRONT_DOMAIN=https://d123456789.cloudfront.net
```

For local development, add these to your `.env` file.
For production, set them in your hosting platform (Replit, Vercel, etc.).

## Step 5: Test Configuration

Run the configuration test:

```bash
npx tsx scripts/test-s3-config.ts
```

## Step 6: Migrate Existing Files (Optional)

If you have existing local files, migrate them to S3:

```bash
# Dry run to see what would be migrated
npx tsx scripts/migrate-local-files-to-s3.ts --dry-run

# Actual migration
npx tsx scripts/migrate-local-files-to-s3.ts

# Remove local files after successful migration
npx tsx scripts/migrate-local-files-to-s3.ts --remove-local
```

## CloudFront CDN Setup (Optional but Recommended)

For faster global delivery:

1. Create a CloudFront distribution in AWS Console
2. Set origin to your S3 bucket
3. Configure caching behaviors:
   - Cache images/documents for 1 year
   - Use appropriate cache headers
4. Set the `AWS_CLOUDFRONT_DOMAIN` environment variable

## File Organization

Files are stored in S3 with this structure:
```
bucket/
├── tenants/1/assets/timestamp-randomid.jpg
├── tenants/1/bol-documents/timestamp-randomid.pdf
├── tenants/2/assets/timestamp-randomid.png
└── tenants/2/bol-documents/timestamp-randomid.pdf
```

## API Endpoints

### Asset Photo Upload
```
POST /api/company-assets/company-assets/:id/photo/presign
POST /api/company-assets/company-assets/:id/photo/confirm
```

### BOL Document Upload
```
POST /api/bol-upload/presign
POST /api/bol-upload/confirm
```

### General Asset Upload
```
POST /api/company-assets/assets/presign
POST /api/company-assets/assets/confirm
```

## Upload Flow

1. **Frontend**: Request presigned URL with file metadata
2. **Backend**: Generate presigned URL, return to frontend
3. **Frontend**: Upload file directly to S3 using presigned URL
4. **Frontend**: Confirm upload completion with backend
5. **Backend**: Verify upload, save metadata to database

## Security Considerations

- **Presigned URLs**: Expire after 1 hour for security
- **File Validation**: Type and size validation on both frontend and backend
- **Tenant Isolation**: Files are organized by tenant ID
- **Access Control**: Only authenticated users can generate presigned URLs

## Troubleshooting

### Common Issues

1. **CORS Errors**: Check your bucket CORS configuration includes your domain
2. **Access Denied**: Verify IAM permissions and credentials
3. **Upload Failures**: Check file size limits and network connectivity
4. **Invalid Configuration**: Run the test script to validate setup

### Debug Mode

Enable debug logging:
```bash
DEBUG=s3:* npm run dev
```

### Test S3 Connection

```bash
npx tsx scripts/test-s3-config.ts
```

## Cost Optimization

- **Storage Class**: Use S3 Standard for frequently accessed files
- **Lifecycle Rules**: Move old files to cheaper storage classes
- **CloudFront**: Reduces S3 data transfer costs
- **Compression**: Images are compressed before upload

## Backup and Recovery

- **Versioning**: Enable S3 versioning for data protection
- **Cross-Region Replication**: For disaster recovery
- **Database Backups**: Ensure file metadata is backed up

## Monitoring

Monitor S3 usage through:
- AWS CloudWatch metrics
- S3 access logs
- Application logs for upload success/failure rates

## Performance

- **Direct Upload**: Files upload directly to S3, not through your server
- **Parallel Uploads**: Multiple files can upload simultaneously
- **Progress Tracking**: Real-time upload progress for better UX
- **CDN**: CloudFront provides global edge caching

## Next Steps

1. Set up the environment variables
2. Test with a few file uploads
3. Migrate existing files if needed
4. Configure CloudFront for production
5. Monitor usage and costs

For questions or issues, check the troubleshooting section or contact your development team. 