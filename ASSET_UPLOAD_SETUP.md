# Asset Upload Setup Guide

## Overview

The Asset Manager upload functionality is designed to work in both **local development** and **production (Replit)** environments with automatic fallback between S3 and local storage.

## How It Works

### 🔄 Automatic Fallback System

1. **S3 Upload (Production)**: When AWS credentials are available (in Replit), the system uses S3 direct uploads
2. **Local Storage (Development)**: When AWS credentials are missing, the system automatically falls back to local storage

### 🛠️ Current Configuration

✅ **Local Development Environment Ready**
- Upload directories created: `uploads/photos/`
- Local storage fallback enabled
- AWS credentials not configured (expected for local development)

✅ **Production Environment Ready**
- AWS S3 bucket configured: `dock-optimizer-prod`
- CORS properly configured for Replit domains
- Environment variables stored in Replit secrets

## 🚀 Testing Asset Upload

### Local Development:
1. Start the server: `npm run dev`
2. Navigate to the Asset Manager page
3. Try uploading a photo to any asset
4. The system will automatically use local storage
5. Check `uploads/photos/[tenantId]/` for uploaded files

### Production (Replit):
1. The system will automatically use S3 with your configured credentials
2. Files will be uploaded directly to the `dock-optimizer-prod` bucket
3. CORS is configured for your Replit domain and production domain

## 🔧 Technical Details

### Frontend (AssetPhotoDropzone.tsx):
- Handles drag-and-drop file uploads
- Supports JPG, PNG, WebP up to 10MB
- Automatically detects local vs S3 upload mode
- Provides real-time upload progress

### Backend Routes:
- `POST /api/company-assets/:id/photo/presign` - Get upload URL
- `POST /api/company-assets/:id/photo/local` - Local upload fallback
- `PUT /api/company-assets/:id/photo` - Update photo URL after S3 upload

### Environment Variables (Production):
```
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_S3_BUCKET=dock-optimizer-prod
AWS_REGION=us-east-1
```

## 🐛 Troubleshooting

### If uploads are failing:

1. **Check the browser console** for error messages
2. **Verify file size** (must be under 10MB)
3. **Verify file type** (JPG, PNG, WebP only)
4. **Check uploads directory permissions** (for local development)
5. **Verify AWS credentials** (for production)

### Common Issues:

- **"Failed to get upload URL"**: Asset ID is required
- **"Local upload failed"**: Check file permissions and uploads directory
- **"S3 upload failed"**: Check AWS credentials and CORS configuration

## 📋 Next Steps

Once you've tested the asset upload functionality locally, you can:

1. Commit your changes
2. Push to your Replit project
3. The system will automatically use S3 in production
4. Move on to BOL upload functionality

## 💡 Key Points

- **No environment variables needed locally** - local storage works automatically
- **AWS credentials are only needed in production** (Replit)
- **The system is designed to work in both environments** without code changes
- **CORS is already configured** for your domains 