import { useState } from 'react';
import { FileUpload } from '@/components/ui/file-upload';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, FileText, CheckCircle, AlertTriangle, Download } from 'lucide-react';
import { FormLabel } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { queryClient } from '@/lib/queryClient';
import { parseBol, compressFile, ParsedBolData } from '@/lib/ocr-service';

interface BolUploadProps {
  onBolProcessed: (data: ParsedBolData, fileUrl: string) => void;
  onProcessingStateChange: (isProcessing: boolean) => void;
  scheduleId?: number; // Optional schedule ID to associate the BOL with
  className?: string;
}

export default function BolUpload({ 
  onBolProcessed, 
  onProcessingStateChange,
  scheduleId,
  className = '' 
}: BolUploadProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingError, setProcessingError] = useState<string | null>(null);
  const [previewText, setPreviewText] = useState<string | null>(null);
  const [bolData, setBolData] = useState<ParsedBolData | null>(null);
  const [uploadedFileUrl, setUploadedFileUrl] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);

  const handleFileChange = async (file: File | null) => {
    // Clear previous state
    setProcessingError(null);
    setPreviewText(null);
    setBolData(null);
    setUploadedFileUrl(null);
    setUploadedFileName(null);
    
    if (!file) {
      onProcessingStateChange(false);
      return;
    }

    try {
      // Start processing
      setIsProcessing(true);
      onProcessingStateChange(true);
      
      console.log(`Starting BOL processing for file: ${file.name} (${file.size} bytes)`);

      // 1. Parse the BOL using the enhanced OCR service
      const parsedData = await parseBol(file);
      setBolData(parsedData);
      
      console.log('BOL parsed successfully:', parsedData);
      
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
      
      // Add more metadata fields for improved processing
      formData.append('extractionMethod', parsedData.extractionMethod || 'unknown');
      formData.append('extractionConfidence', String(parsedData.extractionConfidence || 0));
      formData.append('processingTimestamp', parsedData.processingTimestamp || new Date().toISOString());
      formData.append('originalFileName', file.name);
      
      console.log('Uploading BOL file to server...');
      
      // Make a fetch request directly since apiRequest doesn't fully support FormData
      const response = await fetch('/api/upload-bol', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Server error during upload:', errorText);
        throw new Error(`Failed to upload BOL file: ${response.status} ${response.statusText}`);
      }
      
      const responseData = await response.json();
      console.log('File upload successful:', responseData);
      
      setUploadedFileUrl(responseData.fileUrl);
      setUploadedFileName(responseData.filename);
      
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
      
      // If a schedule ID was provided, associate the file with the schedule
      if (scheduleId) {
        try {
          console.log(`Associating BOL file with schedule ${scheduleId}`);
          
          // Prepare rich metadata for better persistence
          const richMetadata = {
            ...parsedData,
            parsedOcrText: previewLines.join('\n'),
            uploadTimestamp: new Date().toISOString(),
            associationType: 'direct_upload',
            extractionConfidence: parsedData.extractionConfidence || 0,
            processingMethod: parsedData.extractionMethod || 'unknown',
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type,
            fileUrl: responseData.fileUrl
          };
          
          // Send a request to associate the file with the schedule
          const associateResponse = await fetch(`/api/schedules/${scheduleId}/associate-bol`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              fileUrl: responseData.fileUrl,
              filename: responseData.filename || file.name,
              metadata: richMetadata
            })
          });
          
          if (!associateResponse.ok) {
            const errorText = await associateResponse.text();
            console.error('Error response from server:', errorText);
            throw new Error(`Failed to associate BOL: ${associateResponse.status} ${associateResponse.statusText}`);
          }
          
          const associateData = await associateResponse.json();
          console.log('BOL file successfully associated with schedule:', associateData);

          // Get the updated schedule data after BOL association
          const updatedScheduleResponse = await fetch(`/api/schedules/${scheduleId}`);
          if (updatedScheduleResponse.ok) {
            const updatedSchedule = await updatedScheduleResponse.json();
            console.log('Updated schedule with BOL data:', updatedSchedule);
            
            // Invalidate any cached data for this schedule
            queryClient.invalidateQueries({ queryKey: [`/api/schedules/${scheduleId}`] });
            queryClient.invalidateQueries({ queryKey: ['/api/schedules'] });
          }
        } catch (associateError) {
          console.error('Error associating BOL file with schedule:', associateError);
          // We'll show a warning but continue, as the file was uploaded successfully
          setProcessingError(`File uploaded but could not be linked to appointment: ${associateError instanceof Error ? associateError.message : 'Unknown error'}`);
        }
      }
      
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
          We'll extract BOL information to prefill the form and associate it with the appointment
        </p>
        {scheduleId && (
          <p className="text-xs text-primary mt-1">
            The BOL will be automatically linked to appointment #{scheduleId}
          </p>
        )}
      </div>
      
      <FileUpload
        onFileChange={handleFileChange}
        acceptedFileTypes=".pdf,.jpg,.jpeg,.png,.tiff,.doc,.docx,application/pdf,image/*,application/msword"
        maxSizeMB={10}
        buttonText={isProcessing ? "Processing..." : "Upload BOL Document"}
        buttonIcon={isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
      />
      
      <div className="text-xs text-muted-foreground">
        Maximum file size: 10MB. Accepted file types: PDF, images, and documents.
      </div>
      
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
      
      {uploadedFileUrl && !isProcessing && (
        <div className="flex items-center justify-between p-3 border rounded-md bg-muted/10">
          <div className="flex items-center">
            <FileText className="h-4 w-4 text-primary mr-2" />
            <span className="text-sm font-medium">{uploadedFileName || 'BOL Document'}</span>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            asChild
            className="text-xs"
          >
            <a href={uploadedFileUrl} target="_blank" rel="noopener noreferrer">
              <Download className="h-3.5 w-3.5 mr-1" />
              Download
            </a>
          </Button>
        </div>
      )}
      
      {previewText && uploadedFileUrl && !isProcessing && !processingError && (
        <Alert className="bg-primary/5 border-primary/20">
          <CheckCircle className="h-4 w-4 text-primary" />
          <AlertTitle className="text-primary">Document Processed Successfully</AlertTitle>
          <AlertDescription>
            <div className="mt-2">
              <h4 className="font-medium mb-1 text-sm">Extracted Information:</h4>
              <div className="p-3 bg-background rounded border text-sm font-mono whitespace-pre-wrap">
                {previewText}
              </div>
              
              {bolData?.extractionConfidence !== undefined && (
                <div className="mt-2 text-xs text-muted-foreground">
                  <span className="font-medium">Extraction Confidence:</span> 
                  <span className={`ml-1 px-2 py-0.5 rounded-full text-xs ${
                    bolData.extractionConfidence > 70 
                      ? 'bg-green-100 text-green-700' 
                      : bolData.extractionConfidence > 40 
                        ? 'bg-yellow-100 text-yellow-700' 
                        : 'bg-red-100 text-red-700'
                  }`}>
                    {bolData.extractionConfidence}%
                  </span>
                </div>
              )}
              
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