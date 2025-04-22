import { useState } from 'react';
import { FileUpload } from '@/components/ui/file-upload';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react';
import { FormLabel } from '@/components/ui/form';
import { apiRequest } from '@/lib/queryClient';
import { parseBol, compressFile, ParsedBolData } from '@/lib/ocr-service';

interface BolUploadProps {
  onBolProcessed: (data: ParsedBolData, fileUrl: string) => void;
  onProcessingStateChange: (isProcessing: boolean) => void;
}

export default function BolUpload({ onBolProcessed, onProcessingStateChange }: BolUploadProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingError, setProcessingError] = useState<string | null>(null);
  const [previewText, setPreviewText] = useState<string | null>(null);

  const handleFileChange = async (file: File | null) => {
    // Clear previous state
    setProcessingError(null);
    setPreviewText(null);
    
    if (!file) {
      onProcessingStateChange(false);
      return;
    }

    try {
      // Start processing
      setIsProcessing(true);
      onProcessingStateChange(true);

      // 1. Parse the BOL using the OCR service
      const parsedData = await parseBol(file);
      
      // 2. Compress the file for upload
      const compressedFile = await compressFile(file);
      
      // 3. Upload the file to the server
      const formData = new FormData();
      formData.append('bolFile', compressedFile);
      
      // Make a fetch request directly since apiRequest doesn't fully support FormData
      const response = await fetch('/api/upload-bol', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        throw new Error('Failed to upload BOL file');
      }
      
      const responseData = await response.json();
      
      // 4. Set preview text
      setPreviewText(`BOL Number: ${parsedData.bolNumber || 'N/A'}
Customer: ${parsedData.customerName || 'N/A'}
Carrier: ${parsedData.carrierName || 'N/A'}
MC#: ${parsedData.mcNumber || 'N/A'}
Weight: ${parsedData.weight || 'N/A'}
Pallet Count: ${parsedData.palletCount || 'N/A'}`);
      
      // 5. Pass the parsed data and file URL to the parent component
      onBolProcessed(parsedData, responseData.fileUrl);
    } catch (error) {
      console.error('Error processing BOL file:', error);
      setProcessingError(error instanceof Error ? error.message : 'Failed to process BOL file');
    } finally {
      setIsProcessing(false);
      onProcessingStateChange(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="mb-2">
        <FormLabel htmlFor="bol-upload" className="text-base">Upload BOL (Optional)</FormLabel>
      </div>
      
      <FileUpload
        onFileChange={handleFileChange}
        acceptedFileTypes=".pdf,.jpg,.jpeg,.png,.tiff,.docx"
        maxSizeMB={10}
      />
      
      {isProcessing && (
        <div className="flex items-center justify-center p-4 bg-muted/25 rounded-md">
          <Loader2 className="mr-2 h-4 w-4 animate-spin text-primary" />
          <span>Processing BOL file...</span>
        </div>
      )}
      
      {processingError && (
        <Alert variant="destructive">
          <AlertDescription>{processingError}</AlertDescription>
        </Alert>
      )}
      
      {previewText && !isProcessing && !processingError && (
        <Alert className="bg-muted/50 border-muted">
          <AlertDescription>
            <h4 className="font-medium mb-1">Extracted Information:</h4>
            <pre className="text-sm">{previewText}</pre>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}