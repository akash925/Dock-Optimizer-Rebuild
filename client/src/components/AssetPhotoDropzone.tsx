import { useState, useRef, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { UploadCloud, X, Loader2, ImageIcon, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

interface AssetPhotoDropzoneProps {
  onUpload?: (file: File) => Promise<void>; // Legacy support, will be deprecated
  existing?: string | null;
  className?: string;
  assetId?: string | number;
  tenantId?: string | number;
  onUploadComplete?: (photoUrl: string) => void; // New callback for S3 uploads
}

interface PresignedResponse {
  uploadUrl: string;
  key: string;
  publicUrl: string;
  expiresAt: string;
}

/**
 * S3-enabled drag-drop photo uploader with instant preview
 * - Accepts jpg/png/webp up to 10 MB
 * - Shows local preview immediately before network round-trip
 * - Uses S3 presigned URLs for direct uploads
 * - Falls back to legacy multipart upload if onUpload provided
 */
export default function AssetPhotoDropzone({ 
  onUpload, 
  existing, 
  className = "",
  assetId,
  tenantId,
  onUploadComplete
}: AssetPhotoDropzoneProps) {
  const [preview, setPreview] = useState<string | null>(existing || null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStage, setUploadStage] = useState<'idle' | 'presign' | 'upload' | 'confirm' | 'complete'>('idle');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    // Validate file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'Please select an image under 10MB',
        variant: 'destructive',
      });
      return;
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: 'Invalid file type',
        description: 'Please select a JPG, PNG, or WebP image',
        variant: 'destructive',
      });
      return;
    }

    // Create instant preview
    const previewUrl = URL.createObjectURL(file);
    setPreview(previewUrl);
    setSelectedFile(file);
    setUploadStage('idle');
    setUploadProgress(0);
  }, [toast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/webp': ['.webp']
    },
    maxFiles: 1,
    multiple: false
  });

  const handleS3Upload = async (file: File): Promise<string> => {
    if (!assetId) {
      throw new Error('Asset ID is required for S3 upload');
    }

    setUploadStage('presign');
    setUploadProgress(10);

    // Step 1: Get presigned URL
    const presignResponse = await fetch(`/api/company-assets/company-assets/${assetId}/photo/presign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
      }),
    });

    if (!presignResponse.ok) {
      const errorData = await presignResponse.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to get upload URL');
    }

    const presignedData: PresignedResponse = await presignResponse.json();
    setUploadProgress(25);

    // Step 2: Upload directly to S3
    setUploadStage('upload');
    const uploadResponse = await fetch(presignedData.uploadUrl, {
      method: 'PUT',
      body: file,
      headers: {
        'Content-Type': file.type,
      },
    });

    if (!uploadResponse.ok) {
      throw new Error(`S3 upload failed: ${uploadResponse.status} ${uploadResponse.statusText}`);
    }

    setUploadProgress(75);

    // Step 3: Confirm upload and update database
    setUploadStage('confirm');
    const confirmResponse = await fetch(`/api/company-assets/company-assets/${assetId}/photo/confirm`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        key: presignedData.key,
        fileName: file.name,
        fileType: file.type,
      }),
    });

    if (!confirmResponse.ok) {
      const errorData = await confirmResponse.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to confirm upload');
    }

    const confirmData = await confirmResponse.json();
    setUploadProgress(100);
    setUploadStage('complete');

    return confirmData.photoUrl;
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);
    
    // Optimistic update - immediately show the new photo in cache
    const optimisticUrl = preview; // Use the blob URL temporarily
    if (assetId && tenantId) {
      const queryKey = ['companyAssets', tenantId, String(assetId)];
      queryClient.setQueryData(queryKey, (oldData: any) => {
        if (oldData) {
          return { ...oldData, photoUrl: optimisticUrl };
        }
        return oldData;
      });
      
      // Also update the list cache if it exists
      const listQueryKey = ['companyAssets', tenantId];
      queryClient.setQueryData(listQueryKey, (oldData: any) => {
        if (Array.isArray(oldData)) {
          return oldData.map((asset: any) => 
            asset.id === Number(assetId) 
              ? { ...asset, photoUrl: optimisticUrl }
              : asset
          );
        }
        return oldData;
      });
    }
    
    try {
      let finalPhotoUrl: string;

      // Use S3 upload if assetId is provided, otherwise fall back to legacy
      if (assetId && !onUpload) {
        finalPhotoUrl = await handleS3Upload(selectedFile);
             } else if (onUpload) {
         // Legacy multipart upload
         await onUpload(selectedFile);
         finalPhotoUrl = optimisticUrl || existing || ''; // Keep the optimistic URL for legacy
      } else {
        throw new Error('Either assetId or onUpload callback is required');
      }
      
      // Clean up object URL after successful upload
      if (preview && preview.startsWith('blob:')) {
        URL.revokeObjectURL(preview);
      }

      // Update preview with final URL
      setPreview(finalPhotoUrl);
      
      toast({
        title: 'Photo uploaded',
        description: 'Asset photo has been updated successfully',
      });
      
             // Call completion callback
       if (onUploadComplete && finalPhotoUrl) {
         onUploadComplete(finalPhotoUrl);
       }
      
      // Invalidate queries to get the real CDN URL
      if (assetId && tenantId) {
        queryClient.invalidateQueries({ queryKey: ['companyAssets', tenantId, String(assetId)] });
        queryClient.invalidateQueries({ queryKey: ['companyAssets', tenantId] });
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: 'Upload failed',
        description: error instanceof Error ? error.message : 'Failed to upload photo',
        variant: 'destructive',
      });
      
      // Revert optimistic update on failure
      if (assetId && tenantId) {
        const queryKey = ['companyAssets', tenantId, String(assetId)];
        queryClient.setQueryData(queryKey, (oldData: any) => {
          if (oldData) {
            return { ...oldData, photoUrl: existing };
          }
          return oldData;
        });
        
        const listQueryKey = ['companyAssets', tenantId];
        queryClient.setQueryData(listQueryKey, (oldData: any) => {
          if (Array.isArray(oldData)) {
            return oldData.map((asset: any) => 
              asset.id === Number(assetId) 
                ? { ...asset, photoUrl: existing }
                : asset
            );
          }
          return oldData;
        });
      }
      
      // Reset preview on failure
      if (preview && preview.startsWith('blob:')) {
        URL.revokeObjectURL(preview);
        setPreview(existing || null);
      }
    } finally {
      setUploading(false);
      setSelectedFile(null);
      setUploadStage('idle');
      setUploadProgress(0);
    }
  };

  const removePhoto = () => {
    if (preview && preview.startsWith('blob:')) {
      URL.revokeObjectURL(preview);
    }
    setPreview(null);
    setSelectedFile(null);
    setUploadStage('idle');
    setUploadProgress(0);
  };

  const getUploadStageText = () => {
    switch (uploadStage) {
      case 'presign': return 'Getting upload URL...';
      case 'upload': return 'Uploading to cloud storage...';
      case 'confirm': return 'Confirming upload...';
      case 'complete': return 'Upload complete!';
      default: return 'Uploading...';
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {preview ? (
        <Card className="relative">
          <div className="aspect-video w-full max-w-md mx-auto p-4">
            <img
              src={preview}
              alt="Asset preview"
              className="w-full h-full object-contain rounded-lg border"
            />
            <Button
              variant="destructive"
              size="sm"
              className="absolute top-2 right-2"
              onClick={removePhoto}
              disabled={uploading}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          {selectedFile && (
            <div className="p-4 border-t space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                </div>
                <Button
                  onClick={handleUpload}
                  disabled={uploading}
                  size="sm"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {getUploadStageText()}
                    </>
                  ) : uploadStage === 'complete' ? (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
                      Uploaded
                    </>
                  ) : (
                    'Upload Photo'
                  )}
                </Button>
              </div>
              
              {uploading && (
                <div className="space-y-2">
                  <Progress value={uploadProgress} className="w-full" />
                  <p className="text-xs text-muted-foreground text-center">
                    {getUploadStageText()}
                  </p>
                </div>
              )}
            </div>
          )}
        </Card>
      ) : (
        <Card 
          {...getRootProps()} 
          className={`border-2 border-dashed cursor-pointer transition-colors ${
            isDragActive 
              ? 'border-primary bg-primary/5' 
              : 'border-muted-foreground/25 hover:border-primary/50'
          }`}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
            {isDragActive ? (
              <>
                <UploadCloud className="h-12 w-12 text-primary mb-4" />
                <p className="text-lg font-medium text-primary">Drop photo here</p>
              </>
            ) : (
              <>
                <ImageIcon className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium mb-2">
                  Drag & drop a photo, or click to browse
                </p>
                <p className="text-sm text-muted-foreground">
                  Supports JPG, PNG, WebP • Max 10MB
                </p>
                {assetId && (
                  <p className="text-xs text-primary mt-2">
                    Using S3 direct upload
                  </p>
                )}
              </>
            )}
          </div>
        </Card>
      )}
    </div>
  );
} 