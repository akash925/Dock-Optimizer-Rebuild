import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, Loader2, CheckCircle, AlertCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';

interface ExtractedData {
  bolNumber?: string;
  customerName?: string;
  carrierName?: string;
  deliveryDate?: string;
  pickupDate?: string;
  facilityName?: string;
  appointmentType?: string;
  weight?: string;
  pieces?: string;
  [key: string]: any;
}

interface BOLUploadResult {
  success: boolean;
  documentId?: string;
  fileUrl?: string;
  fileName?: string;
  extractedData?: ExtractedData;
  suggestions?: {
    facilityId?: number;
    appointmentTypeId?: number;
    suggestedDate?: string;
    confidence?: number;
  };
  error?: string;
}

interface BOLUploadWizardProps {
  onUploadSuccess?: (result: BOLUploadResult) => void;
  onExtractedDataChange?: (data: ExtractedData) => void;
  bookingPageSlug?: string;
  className?: string;
}

export function BOLUploadWizard({ 
  onUploadSuccess, 
  onExtractedDataChange, 
  bookingPageSlug,
  className = '' 
}: BOLUploadWizardProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [processingStage, setProcessingStage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    const file = acceptedFiles[0];
    setUploadedFile(file);
    setError(null);
    setIsUploading(true);
    setUploadProgress(0);
    setProcessingStage('Uploading file...');

    try {
      // Create form data
      const formData = new FormData();
      formData.append('bolFile', file);
      
      if (bookingPageSlug) {
        formData.append('bookingPageSlug', bookingPageSlug);
      }

      // Upload file with progress tracking
      const uploadPromise = new Promise<BOLUploadResult>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const progress = Math.round((event.loaded / event.total) * 40); // 40% for upload
            setUploadProgress(progress);
          }
        };

        xhr.onload = () => {
          if (xhr.status === 200) {
            try {
              const response = JSON.parse(xhr.responseText);
              resolve(response);
            } catch (e) {
              reject(new Error('Invalid response format'));
            }
          } else {
            reject(new Error(`Upload failed: ${xhr.status}`));
          }
        };

        xhr.onerror = () => reject(new Error('Upload failed'));
        
        xhr.open('POST', '/api/ocr/upload');
        xhr.send(formData);
      });

      // Simulate OCR processing stages
      setUploadProgress(40);
      setProcessingStage('Processing document...');
      
      setTimeout(() => {
        setUploadProgress(60);
        setProcessingStage('Extracting text with OCR...');
      }, 1000);

      setTimeout(() => {
        setUploadProgress(80);
        setProcessingStage('Analyzing document structure...');
      }, 2000);

      const result = await uploadPromise;

      setUploadProgress(100);
      setProcessingStage('Processing complete!');

      if (result.success) {
        setExtractedData(result.extractedData || {});
        
        // Notify parent components
        if (onUploadSuccess) {
          onUploadSuccess(result);
        }
        
        if (onExtractedDataChange && result.extractedData) {
          onExtractedDataChange(result.extractedData);
        }

        toast({
          title: 'Document processed successfully',
          description: 'BOL information has been extracted and will help pre-fill your appointment details.',
        });
      } else {
        throw new Error(result.error || 'Failed to process document');
      }

    } catch (err) {
      console.error('BOL upload error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to upload and process document';
      setError(errorMessage);
      toast({
        title: 'Upload failed',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  }, [bookingPageSlug, onUploadSuccess, onExtractedDataChange, toast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/*': ['.png', '.jpg', '.jpeg', '.tiff', '.bmp']
    },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024, // 10MB
    disabled: isUploading
  });

  const resetUpload = () => {
    setUploadedFile(null);
    setExtractedData(null);
    setError(null);
    setUploadProgress(0);
    setProcessingStage('');
    setIsUploading(false);
  };

  const renderExtractedData = () => {
    if (!extractedData) return null;

    const dataEntries = Object.entries(extractedData).filter(([key, value]) => 
      value && key !== 'confidence' && key !== 'processingTime'
    );

    if (dataEntries.length === 0) {
      return (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Document processed but no specific BOL information could be extracted. 
            You can still proceed with manual entry.
          </AlertDescription>
        </Alert>
      );
    }

    return (
      <div className="space-y-3">
        <h4 className="font-medium text-sm">Extracted Information:</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {dataEntries.map(([key, value]) => (
            <div key={key} className="flex flex-col space-y-1">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {key.replace(/([A-Z])/g, ' $1').trim()}
              </span>
              <span className="text-sm bg-gray-50 p-2 rounded border">
                {String(value)}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Upload Area */}
      {!uploadedFile && (
        <div
          {...getRootProps()}
          className={`
            border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
            ${isDragActive 
              ? 'border-primary bg-primary/5' 
              : 'border-gray-300 hover:border-gray-400'
            }
            ${isUploading ? 'cursor-not-allowed opacity-50' : ''}
          `}
        >
          <input {...getInputProps()} />
          <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <p className="text-lg font-medium mb-2">
            {isDragActive ? 'Drop your BOL here' : 'Upload Bill of Lading (BOL)'}
          </p>
          <p className="text-sm text-muted-foreground mb-4">
            Drag & drop or click to select a PDF or image file
          </p>
          <p className="text-xs text-muted-foreground">
            Our OCR system will automatically extract information to help pre-fill your appointment details
          </p>
        </div>
      )}

      {/* Upload Progress */}
      {isUploading && (
        <div className="space-y-3">
          <div className="flex items-center space-x-3">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm font-medium">{processingStage}</span>
          </div>
          <Progress value={uploadProgress} className="w-full" />
          <p className="text-xs text-muted-foreground">
            Processing may take a few moments depending on document complexity
          </p>
        </div>
      )}

      {/* Upload Success */}
      {uploadedFile && !isUploading && !error && (
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center space-x-3">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm font-medium text-green-800">Document processed successfully</p>
                <p className="text-xs text-green-600">{uploadedFile.name}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={resetUpload}
              className="text-green-600 hover:text-green-700"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {renderExtractedData()}
        </div>
      )}

      {/* Error State */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>{error}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={resetUpload}
              className="text-destructive hover:text-destructive/80"
            >
              Try Again
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Help Text */}
      <div className="text-xs text-muted-foreground">
        <p className="mb-1">
          <strong>Supported formats:</strong> PDF, PNG, JPG, JPEG, TIFF, BMP
        </p>
        <p>
          <strong>What we extract:</strong> BOL number, customer name, carrier info, dates, facility details, and more
        </p>
      </div>
    </div>
  );
}