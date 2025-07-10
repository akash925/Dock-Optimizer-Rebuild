import { useState, useRef, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { UploadCloud, X, Loader2, ImageIcon, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { uploadViaS3Post } from '@/lib/upload/postUpload';

interface AssetPhotoDropzoneProps {
  onUpload?: (file: File) => Promise<void>; // Legacy support, deprecated
  existing?: string | null;
  className?: string;
  assetId?: string | number;
  tenantId?: string | number;
  onUploadComplete?: (photoUrl: string) => void;
}

/**
 * S3-enabled drag-drop photo uploader with instant preview
 * - Accepts jpg/png/webp up to 10 MB
 * - Shows local preview immediately before network round-trip
 * - Uses S3 presigned URLs for direct uploads
 * - Uses simplified direct upload flow
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
    const presignResponse = await fetch(`/api/company-assets/${assetId}/photo/presign`, {
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

    const presignedData = await presignResponse.json();
    setUploadProgress(25);

    // Check if this is a local upload fallback
    if (presignedData.local) {
      setUploadStage('upload');
      
      // Use local upload with FormData
      const formData = new FormData();
      formData.append('file', file);
      
      const uploadResponse = await fetch(presignedData.url, {
        method: 'POST',
        body: formData,
      });

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json().catch(() => ({}));
        throw new Error(errorData.error || `Local upload failed: ${uploadResponse.status}`);
      }

      const uploadData = await uploadResponse.json();
      setUploadProgress(100);
      setUploadStage('complete');

      return uploadData.photoUrl;
    }

    // Step 2: Upload directly to S3 using the helper function
    setUploadStage('upload');
    setUploadProgress(50);
    
    console.log('[AssetUpload] Using uploadViaS3Post helper for S3 upload');
    
    try {
      await uploadViaS3Post(presignedData.url, presignedData.fields, file);
    } catch (error) {
      console.error('[AssetUpload] S3 upload failed:', error);
      throw new Error('S3 upload failed – check file type/size and retry');
    }

    setUploadProgress(90);

    // Step 3: Confirm upload with backend
    setUploadStage('confirm');
    const confirmResponse = await fetch(`/api/company-assets/${assetId}/photo`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        key: presignedData.key,
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

  const handleLocalUpload = async (file: File): Promise<string> => {
    if (!assetId) {
      throw new Error('Asset ID is required for local upload');
    }

    setUploadStage('upload');
    setUploadProgress(50);

    const formData = new FormData();
    formData.append('file', file);

    const uploadResponse = await fetch(`/api/company-assets/${assetId}/photo/local`, {
      method: 'POST',
      body: formData,
    });

    if (!uploadResponse.ok) {
      const errorData = await uploadResponse.json().catch(() => ({}));
      throw new Error(errorData.error || `Local upload failed: ${uploadResponse.status}`);
    }

    const uploadData = await uploadResponse.json();
    setUploadProgress(100);
    setUploadStage('complete');

    return uploadData.photoUrl;
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

      // Try S3 upload first, fall back to local upload if it fails
      if (assetId) {
        try {
          // Attempt S3 direct upload
          finalPhotoUrl = await handleS3Upload(selectedFile);
          
          toast({
            title: 'Photo uploaded',
            description: 'Asset photo has been updated successfully',
          });
        } catch (s3Error) {
          console.warn('[AssetUpload] S3 upload failed, falling back to local upload:', s3Error);
          
          // Display the specific S3 error message
          toast({
            title: 'Upload failed',
            description: s3Error instanceof Error ? s3Error.message : 'S3 upload failed – check file type/size and retry',
            variant: 'destructive',
          });
          
          // Fall back to local upload
          try {
            finalPhotoUrl = await handleLocalUpload(selectedFile);
            toast({
              title: 'Photo uploaded (local storage)',
              description: 'S3 upload failed, using local storage as fallback',
              variant: 'default',
            });
          } catch (localError) {
            // If both S3 and local fail, throw the original S3 error for better debugging
            throw new Error(`Both S3 and local upload failed. S3 error: ${s3Error instanceof Error ? s3Error.message : 'Unknown S3 error'}. Local error: ${localError instanceof Error ? localError.message : 'Unknown local error'}`);
          }
        }
      } else if (onUpload) {
        // Legacy multipart upload for backward compatibility
        await onUpload(selectedFile);
        finalPhotoUrl = optimisticUrl || existing || '';
        
        toast({
          title: 'Photo uploaded',
          description: 'Asset photo has been updated successfully',
        });
      } else {
        throw new Error('Asset ID is required for photo upload');
      }
      
      // Clean up object URL after successful upload
      if (preview && preview.startsWith('blob:')) {
        URL.revokeObjectURL(preview);
      }

      // Update preview with final URL
      setPreview(finalPhotoUrl);
      
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
      
      // Show specific error message based on the error
      const errorMessage = error instanceof Error ? error.message : 'Failed to upload photo';
      const displayMessage = errorMessage.includes('S3 upload failed – check file type/size and retry') 
        ? errorMessage 
        : errorMessage;
      
      toast({
        title: 'Upload failed',
        description: displayMessage,
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
          {selectedFile && !uploading && (
            <div className="p-4 space-y-2">
              <p className="text-sm text-muted-foreground">
                Ready to upload: {selectedFile.name}
              </p>
              <Button 
                onClick={handleUpload} 
                className="w-full"
                disabled={uploading}
              >
                <UploadCloud className="mr-2 h-4 w-4" />
                Upload Photo
              </Button>
            </div>
          )}
          {uploading && (
            <div className="p-4 space-y-2">
              <div className="flex items-center space-x-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">{getUploadStageText()}</span>
              </div>
              <Progress value={uploadProgress} className="w-full" />
            </div>
          )}
          {uploadStage === 'complete' && (
            <div className="p-4">
              <div className="flex items-center space-x-2 text-green-600">
                <CheckCircle className="h-4 w-4" />
                <span className="text-sm">Upload successful!</span>
              </div>
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