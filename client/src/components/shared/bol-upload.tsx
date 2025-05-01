import { useState } from 'react';
import { FileUpload } from '@/components/ui/file-upload';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, FileText, CheckCircle, AlertTriangle } from 'lucide-react';
import { FormLabel } from '@/components/ui/form';
import { apiRequest } from '@/lib/queryClient';
import { parseBol, compressFile, ParsedBolData } from '@/lib/ocr-service';

interface BolUploadProps {
  onBolProcessed: (data: ParsedBolData, fileUrl: string) => void;
  onProcessingStateChange: (isProcessing: boolean) => void;
  className?: string;
}

export default function BolUpload({ 
  onBolProcessed, 
  onProcessingStateChange,
  className = '' 
}: BolUploadProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingError, setProcessingError] = useState<string | null>(null);
  const [previewText, setPreviewText] = useState<string | null>(null);
  const [bolData, setBolData] = useState<ParsedBolData | null>(null);

  const handleFileChange = async (file: File | null) => {
    // Clear previous state
    setProcessingError(null);
    setPreviewText(null);
    setBolData(null);
    
    if (!file) {
      onProcessingStateChange(false);
      return;
    }

    try {
      // Start processing
      setIsProcessing(true);
      onProcessingStateChange(true);

      // 1. Parse the BOL using the enhanced OCR service
      const parsedData = await parseBol(file);
      setBolData(parsedData);
      
      // 2. Compress the file for upload
      const compressedFile = await compressFile(file);
      
      // 3. Upload the file to the server
      const formData = new FormData();
      formData.append('bolFile', compressedFile);
      
      // Include extracted metadata in the upload for server-side storage
      if (parsedData.bolNumber) formData.append('bolNumber', parsedData.bolNumber);
      if (parsedData.customerName) formData.append('customerName', parsedData.customerName);
      if (parsedData.carrierName) formData.append('carrierName', parsedData.carrierName);
      if (parsedData.mcNumber) formData.append('mcNumber', parsedData.mcNumber);
      if (parsedData.weight) formData.append('weight', parsedData.weight);
      if (parsedData.fromAddress) formData.append('fromAddress', parsedData.fromAddress);
      if (parsedData.toAddress) formData.append('toAddress', parsedData.toAddress);
      if (parsedData.pickupOrDropoff) formData.append('pickupOrDropoff', parsedData.pickupOrDropoff);
      
      // Make a fetch request directly since apiRequest doesn't fully support FormData
      const response = await fetch('/api/upload-bol', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        throw new Error('Failed to upload BOL file');
      }
      
      const responseData = await response.json();
      
      // 4. Build a formatted preview text
      const previewLines: string[] = [];
      
      if (parsedData.bolNumber) previewLines.push(`BOL Number: ${parsedData.bolNumber}`);
      if (parsedData.customerName) previewLines.push(`Customer: ${parsedData.customerName}`);
      if (parsedData.carrierName) previewLines.push(`Carrier: ${parsedData.carrierName}`);
      if (parsedData.mcNumber) previewLines.push(`MC#: ${parsedData.mcNumber}`);
      if (parsedData.weight) previewLines.push(`Weight: ${parsedData.weight}`);
      if (parsedData.palletCount) previewLines.push(`Pallet Count: ${parsedData.palletCount}`);
      
      // Add address information if available
      if (parsedData.fromAddress) previewLines.push(`From: ${parsedData.fromAddress.split('\n')[0]}`);
      if (parsedData.toAddress) previewLines.push(`To: ${parsedData.toAddress.split('\n')[0]}`);
      
      // Add shipment type based on our inference
      if (parsedData.pickupOrDropoff) {
        previewLines.push(`Type: ${parsedData.pickupOrDropoff === 'pickup' ? 'Outbound/Pickup' : 'Inbound/Dropoff'}`);
      }
      
      // Add trailer/truck information
      if (parsedData.truckId) previewLines.push(`Truck ID: ${parsedData.truckId}`);
      if (parsedData.trailerNumber) previewLines.push(`Trailer #: ${parsedData.trailerNumber}`);
      
      setPreviewText(previewLines.join('\n'));
      
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
    <div className={`space-y-4 ${className}`}>
      <div className="mb-2">
        <FormLabel htmlFor="bol-upload" className="text-base">
          Upload Bill of Lading (Optional)
        </FormLabel>
        <p className="text-sm text-muted-foreground mt-1">
          We'll extract information from your BOL document to prefill the form
        </p>
      </div>
      
      <FileUpload
        onFileChange={handleFileChange}
        acceptedFileTypes=".pdf,.jpg,.jpeg,.png,.tiff,.doc,.docx,application/pdf,image/*,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        maxSizeMB={10}
        buttonText={isProcessing ? "Processing..." : "Upload BOL Document"}
        buttonIcon={isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
      />
      
      {isProcessing && (
        <div className="flex items-center justify-center p-4 bg-muted/25 rounded-md">
          <Loader2 className="mr-2 h-5 w-5 animate-spin text-primary" />
          <span>Processing BOL document and extracting information...</span>
        </div>
      )}
      
      {processingError && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error Processing Document</AlertTitle>
          <AlertDescription>{processingError}</AlertDescription>
        </Alert>
      )}
      
      {previewText && !isProcessing && !processingError && (
        <Alert className="bg-primary/5 border-primary/20">
          <CheckCircle className="h-4 w-4 text-primary" />
          <AlertTitle className="text-primary">Document Processed Successfully</AlertTitle>
          <AlertDescription>
            <div className="mt-2">
              <h4 className="font-medium mb-1 text-sm">Extracted Information:</h4>
              <div className="p-3 bg-background rounded border text-sm font-mono whitespace-pre-wrap">
                {previewText}
              </div>
              
              {bolData?.pickupOrDropoff && (
                <div className="mt-2 text-sm">
                  <span className="font-medium">Shipment Type:</span> 
                  <span className="ml-1 px-2 py-0.5 rounded-full text-xs bg-primary/10 text-primary">
                    {bolData.pickupOrDropoff === 'pickup' ? 'Outbound (Pickup)' : 'Inbound (Dropoff)'}
                  </span>
                </div>
              )}
              
              <p className="text-xs mt-2 text-muted-foreground">
                This information has been pre-filled in the form below. You can still edit any fields as needed.
              </p>
            </div>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}