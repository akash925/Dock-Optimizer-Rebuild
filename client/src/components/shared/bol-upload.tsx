import { useState } from 'react';
import { FileUpload } from '@/components/ui/file-upload';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, FileText, CheckCircle, AlertTriangle, Download, FileUp, Clock, Database, Zap, XCircle } from 'lucide-react';
import { FormLabel } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { queryClient } from '@/lib/queryClient';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tooltip } from '@/components/ui/tooltip';
import { TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// ENHANCED: Add defensive imports and fallback handling
let parseBol: any;
let compressFile: any;
let ParsedBolData: any;

try {
  const ocrModule = require('@/lib/ocr-service');
  parseBol = ocrModule.parseBol;
  compressFile = ocrModule.compressFile;
  ParsedBolData = ocrModule.ParsedBolData;
} catch (error) {
  console.warn('OCR service not available, using fallback:', error);
  // Provide fallback functions
  parseBol = async (file: File) => {
    return {
      bolNumber: `BOL${Date.now().toString().slice(-6)}`,
      customerName: '',
      carrierName: '',
      mcNumber: '',
      weight: '',
      palletCount: '',
      fromAddress: '',
      toAddress: '',
      pickupOrDropoff: 'pickup' as const,
      extractionMethod: 'fallback',
      extractionConfidence: 0,
      processingTimestamp: new Date().toISOString()
    };
  };
  compressFile = async (file: File) => file;
  ParsedBolData = {};
}

interface BolUploadProps {
  onBolProcessed: (data: any, fileUrl: string) => void;
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
  const [bolData, setBolData] = useState<any | null>(null);
  const [uploadedFileUrl, setUploadedFileUrl] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStage, setUploadStage] = useState<'idle' | 'uploading' | 'compressing' | 'processing' | 'analyzing' | 'validating' | 'extracting' | 'saved' | 'completed' | 'error'>('idle');
  const [fileSaved, setFileSaved] = useState(false);
  const [ocrProcessed, setOcrProcessed] = useState(false);
  const [ocrSuccess, setOcrSuccess] = useState(false);

  const handleFileChange = async (file: File | null) => {
    // Clear previous state
    setProcessingError(null);
    setPreviewText(null);
    setBolData(null);
    setUploadedFileUrl(null);
    setUploadedFileName(null);
    setUploadProgress(0);
    setUploadStage('idle');
    setFileSaved(false);
    setOcrProcessed(false);
    setOcrSuccess(false);
    
    if (!file) {
      onProcessingStateChange(false);
      return;
    }

    try {
      // Start processing - show uploading state
      setIsProcessing(true);
      setUploadStage('uploading');
      setUploadProgress(10);
      onProcessingStateChange(true);
      
      console.log(`Starting BOL processing for file: ${file.name} (${file.size} bytes)`);

      // 1. Parse the BOL using the enhanced OCR service (with fallback)
      setUploadStage('processing');
      setUploadProgress(20);
      setOcrProcessed(true);
      
      let parsedData;
      let ocrSucceeded = false;
      try {
        if (parseBol && typeof parseBol === 'function') {
        parsedData = await parseBol(file);
        setBolData(parsedData);
        setOcrSuccess(true);
        ocrSucceeded = true;
        console.log('BOL parsed successfully:', parsedData);
        } else {
          throw new Error('OCR service not available');
        }
      } catch (ocrError) {
        console.warn('OCR parsing failed, using fallback:', ocrError);
        setOcrSuccess(false);
        // Enhanced fallback to basic data structure if OCR fails
        parsedData = {
          bolNumber: `BOL${Date.now().toString().slice(-6)}`,
          customerName: '',
          carrierName: '',
          mcNumber: '',
          weight: '',
          palletCount: '',
          fromAddress: '',
          toAddress: '',
          pickupOrDropoff: 'pickup' as const,
          extractionMethod: 'fallback',
          extractionConfidence: 0,
          processingTimestamp: new Date().toISOString()
        };
        setBolData(parsedData);
      }
      
      // 2. Compress the file for upload (with fallback)
      setUploadStage('compressing');
      setUploadProgress(35);
      
      let compressedFile;
      try {
        if (compressFile && typeof compressFile === 'function') {
        compressedFile = await compressFile(file);
        // Update progress based on compression result
        setUploadProgress(45);
        if (compressedFile.size < file.size) {
          console.log(`File compressed: ${file.size} → ${compressedFile.size} bytes (${Math.round((1 - compressedFile.size / file.size) * 100)}% reduction)`);
        } else {
          console.log('File not compressed (not an image or already optimized)');
          }
        } else {
          throw new Error('Compression service not available');
        }
      } catch (compressionError) {
        console.warn('File compression failed, using original file:', compressionError);
        compressedFile = file;
        setUploadProgress(45);
      }
      
      // 3. Upload the file to S3 using presigned URL
      setUploadStage('uploading');
      setUploadProgress(50); 
      
      console.log('Getting presigned URL for BOL upload...');
      
      // Step 3a: Get presigned URL
      let presignResponse;
      try {
        presignResponse = await fetch('/api/bol-upload/presign', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            fileName: compressedFile.name,
            fileType: compressedFile.type,
            fileSize: compressedFile.size,
            scheduleId: scheduleId,
            appointmentId: scheduleId,
          }),
        });
      } catch (networkError) {
        console.error('Network error getting presigned URL:', networkError);
        const errorMessage = networkError instanceof Error ? networkError.message : 'Unknown network error';
        throw new Error(`Network error: ${errorMessage}. Please check your connection and try again.`);
      }
      
      if (!presignResponse.ok) {
        let errorText = '';
        try {
          const errorData = await presignResponse.json();
          errorText = errorData.error || `Server error: ${presignResponse.status} ${presignResponse.statusText}`;
        } catch (e) {
          errorText = `Server error: ${presignResponse.status} ${presignResponse.statusText}`;
        }
        console.error('Error getting presigned URL:', errorText);
        throw new Error(`Failed to get upload URL: ${errorText}`);
      }

      const presignedData = await presignResponse.json();
      setUploadProgress(60);

      // Step 3b: Upload directly to S3
      console.log('Uploading BOL file directly to S3...');
      
      let s3Response;
      try {
        s3Response = await fetch(presignedData.uploadUrl, {
          method: 'PUT',
          body: compressedFile,
          headers: {
            'Content-Type': compressedFile.type,
          },
        });
      } catch (networkError) {
        console.error('Network error during S3 upload:', networkError);
        const errorMessage = networkError instanceof Error ? networkError.message : 'Unknown network error';
        throw new Error(`S3 upload error: ${errorMessage}. Please check your connection and try again.`);
      }
      
      if (!s3Response.ok) {
        console.error('S3 upload failed:', s3Response.status, s3Response.statusText);
        throw new Error(`S3 upload failed: ${s3Response.status} ${s3Response.statusText}`);
      }

      setUploadProgress(75);

      // Step 3c: Confirm upload and update database
      console.log('Confirming BOL upload...');
      
      let confirmResponse;
      try {
        confirmResponse = await fetch('/api/bol-upload/confirm', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            key: presignedData.key,
            fileName: compressedFile.name,
            fileType: compressedFile.type,
            scheduleId: scheduleId,
            appointmentId: scheduleId,
            // Include extracted metadata
            bolNumber: parsedData.bolNumber,
            customerName: parsedData.customerName,
            carrierName: parsedData.carrierName,
            mcNumber: parsedData.mcNumber,
            weight: parsedData.weight,
            fromAddress: parsedData.fromAddress,
            toAddress: parsedData.toAddress,
            pickupOrDropoff: parsedData.pickupOrDropoff,
            extractionMethod: parsedData.extractionMethod || 'unknown',
            extractionConfidence: parsedData.extractionConfidence || 0,
            processingTimestamp: parsedData.processingTimestamp || new Date().toISOString(),
          }),
        });
      } catch (networkError) {
        console.error('Network error confirming upload:', networkError);
        const errorMessage = networkError instanceof Error ? networkError.message : 'Unknown network error';
        throw new Error(`Network error: ${errorMessage}. Please check your connection and try again.`);
      }
      
      if (!confirmResponse.ok) {
        let errorText = '';
        try {
          const errorData = await confirmResponse.json();
          errorText = errorData.error || `Server error: ${confirmResponse.status} ${confirmResponse.statusText}`;
        } catch (e) {
          errorText = `Server error: ${confirmResponse.status} ${confirmResponse.statusText}`;
        }
        console.error('Error confirming upload:', errorText);
        throw new Error(`Upload confirmation failed: ${errorText}`);
      }
      
      // File has been successfully saved
      setUploadStage('saved');
      setUploadProgress(85);
      setFileSaved(true);
      
      let responseData;
      try {
        responseData = await confirmResponse.json();
        console.log('File upload and confirmation successful:', responseData);
      } catch (jsonError) {
        console.error('Failed to parse confirmation response:', jsonError);
        throw new Error('Server returned invalid response. Please try again.');
      }
      
      // Set completed stage
      setUploadStage('completed');
      setUploadProgress(100);
      
      setUploadedFileUrl(responseData.fileUrl);
      setUploadedFileName(responseData.filename || responseData.originalName);
      
      // 4. Build a formatted preview text using both parsed data and server response
      const previewLines: string[] = [];
      
      try {
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
      } catch (previewError) {
        console.warn('Error building preview text:', previewError);
        previewLines.push('Data extracted from BOL document');
      }
      
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
          try {
          const updatedScheduleResponse = await fetch(`/api/schedules/${scheduleId}`);
          if (updatedScheduleResponse.ok) {
            const updatedSchedule = await updatedScheduleResponse.json();
            console.log('Updated schedule with BOL data:', updatedSchedule);
            
            // Invalidate any cached data for this schedule
              if (queryClient) {
            queryClient.invalidateQueries({ queryKey: [`/api/schedules/${scheduleId}`] });
            queryClient.invalidateQueries({ queryKey: ['/api/schedules'] });
              }
            }
          } catch (scheduleUpdateError) {
            console.warn('Error fetching updated schedule:', scheduleUpdateError);
            // Don't fail the entire process for this
          }
        } catch (associateError) {
          console.error('Error associating BOL file with schedule:', associateError);
          // We'll show a warning but continue, as the file was uploaded successfully
          setProcessingError(`File uploaded but could not be linked to appointment: ${associateError instanceof Error ? associateError.message : 'Unknown error'}`);
        }
      }
      
      // 5. Pass the parsed data and file URL to the parent component
      try {
      onBolProcessed(parsedData, responseData.fileUrl);
      } catch (callbackError) {
        console.error('Error in onBolProcessed callback:', callbackError);
        // Don't fail the entire process for callback errors
      }
    } catch (error) {
      console.error('Error processing BOL file:', error);
      setProcessingError(error instanceof Error ? error.message : 'Failed to process BOL file');
      setUploadStage('error');
      setUploadProgress(100);
    } finally {
      setIsProcessing(false);
      onProcessingStateChange(false);
    }
  };

  // ENHANCED: Add error boundary-like error handling for the render
  try {
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
        <div className="space-y-2 p-4 bg-muted/25 rounded-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              {uploadStage === 'uploading' && <FileUp className="mr-2 h-5 w-5 text-primary animate-pulse" />}
              {uploadStage === 'processing' && <Zap className="mr-2 h-5 w-5 animate-pulse text-yellow-500" />}
              {uploadStage === 'saved' && <Database className="mr-2 h-5 w-5 text-green-500" />}
              {uploadStage === 'completed' && <CheckCircle className="mr-2 h-5 w-5 text-green-500" />}
              <span className="font-medium">
                {uploadStage === 'uploading' && 'Uploading document...'}
                {uploadStage === 'processing' && 'Running OCR analysis...'}
                {uploadStage === 'saved' && 'File saved successfully!'}
                {uploadStage === 'completed' && 'Processing complete!'}
              </span>
            </div>
            <Badge variant={uploadStage === 'completed' ? 'default' : 'secondary'}>
              {uploadProgress}%
            </Badge>
          </div>
          <Progress value={uploadProgress} className="h-2" />
          <p className="text-xs text-muted-foreground">
            {uploadStage === 'uploading' && 'Sending document to server...'}
            {uploadStage === 'processing' && 'Extracting text and data from document using OCR...'}
            {uploadStage === 'saved' && 'Document has been saved to the database.'}
            {uploadStage === 'completed' && 'All processing steps completed successfully.'}
          </p>
        </div>
      )}

      {/* File Saved Success Indicator */}
      {fileSaved && !isProcessing && (
        <Alert className="bg-blue-50 border-blue-200">
          <Database className="h-4 w-4 text-blue-600" />
          <AlertTitle className="text-blue-800">✅ File Saved Successfully</AlertTitle>
          <AlertDescription className="text-blue-700">
            <div className="flex items-center justify-between">
              <span>Your BOL document has been securely saved to our system.</span>
              <Badge variant="outline" className="text-blue-600 border-blue-300">
                Saved
              </Badge>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* OCR Processing Status */}
      {ocrProcessed && !isProcessing && (
        <Alert className={ocrSuccess ? "bg-green-50 border-green-200" : "bg-yellow-50 border-yellow-200"}>
          {ocrSuccess ? (
            <Zap className="h-4 w-4 text-green-600" />
          ) : (
            <XCircle className="h-4 w-4 text-yellow-600" />
          )}
          <AlertTitle className={ocrSuccess ? "text-green-800" : "text-yellow-800"}>
            {ocrSuccess ? "✅ OCR Processing Successful" : "⚠️ OCR Processing Incomplete"}
          </AlertTitle>
          <AlertDescription className={ocrSuccess ? "text-green-700" : "text-yellow-700"}>
            <div className="flex items-center justify-between">
              <span>
                {ocrSuccess 
                  ? "Text extraction and data analysis completed successfully."
                  : "OCR had difficulty extracting text. You may need to enter information manually."
                }
              </span>
              <Badge variant="outline" className={ocrSuccess 
                ? "text-green-600 border-green-300" 
                : "text-yellow-600 border-yellow-300"
              }>
                {ocrSuccess ? "OCR Success" : "OCR Partial"}
              </Badge>
            </div>
          </AlertDescription>
        </Alert>
      )}
      
      {processingError && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error Processing Document</AlertTitle>
          <AlertDescription>
            {processingError}
            {uploadStage === 'error' && uploadedFileUrl && (
              <div className="mt-2">
                <p className="text-sm">Document was saved but data extraction failed. You can still access the file.</p>
                <div className="mt-2 flex items-center space-x-2">
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
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="text-xs"
                    onClick={() => handleFileChange(null)}
                  >
                    <span className="mr-1">⟳</span>
                    Try Again
                  </Button>
                </div>
              </div>
            )}
          </AlertDescription>
        </Alert>
      )}
      
      {uploadedFileUrl && !isProcessing && !previewText && (
        <div className="space-y-2">
          {uploadStage === 'error' && (
            <div className="p-3 border border-yellow-300 rounded-md bg-yellow-50 mb-2">
              <div className="flex items-center">
                <AlertTriangle className="h-4 w-4 text-yellow-600 mr-2" />
                <span className="text-sm text-yellow-800">
                  Document was saved but data extraction was incomplete. You may need to enter information manually.
                </span>
              </div>
            </div>
          )}
          
          <div className="flex items-center justify-between p-3 border rounded-md bg-muted/10">
            <div className="flex items-center">
              <FileText className="h-4 w-4 text-primary mr-2" />
              <span className="text-sm font-medium">{uploadedFileName || 'BOL Document'}</span>
              {uploadStage === 'error' && (
                <Badge variant="outline" className="ml-2 text-yellow-600 border-yellow-300">
                  Partial Processing
                </Badge>
              )}
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
        </div>
      )}
      
      {previewText && uploadedFileUrl && !isProcessing && !processingError && (
        <Alert className="bg-green-50 border-green-200">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertTitle className="text-green-800">Document Processed Successfully</AlertTitle>
          <AlertDescription className="text-green-700">
            <div className="mt-2">
              <h4 className="font-medium mb-1 text-sm">Extracted Information:</h4>
              <div className="p-3 bg-background rounded border text-sm font-mono whitespace-pre-wrap">
                {previewText}
              </div>
              
              <div className="grid grid-cols-2 gap-4 mt-3">
                {bolData?.extractionConfidence !== undefined && (
                  <div className="text-xs flex items-center">
                    <span className="font-medium mr-2">Confidence:</span> 
                    <span className={`px-2 py-0.5 rounded-full text-xs ${
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
                
                {bolData?.extractionMethod && (
                  <div className="text-xs flex items-center">
                    <span className="font-medium mr-2">Method:</span>
                    <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                      {bolData.extractionMethod}
                    </span>
                  </div>
                )}
              </div>
              
              {bolData?.pickupOrDropoff && (
                <div className="mt-3 text-sm">
                  <span className="font-medium">Shipment Type:</span> 
                  <span className="ml-1 px-2 py-0.5 rounded-full text-xs bg-primary/10 text-primary">
                    {bolData.pickupOrDropoff === 'pickup' ? 'Outbound (Pickup)' : 'Inbound (Dropoff)'}
                  </span>
                </div>
              )}
              
              {scheduleId && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="mt-3 text-xs inline-flex items-center text-green-700 bg-green-100 px-2 py-1 rounded">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Linked to appointment #{scheduleId}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">This document has been associated with the current appointment</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              
              <p className="text-xs mt-3 text-muted-foreground">
                This information has been pre-filled in the form below. You can still edit any fields as needed.
              </p>
            </div>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
  } catch (renderError) {
    console.error('Error rendering BOL upload component:', renderError);
    return (
      <div className={`space-y-4 ${className}`}>
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Component Error</AlertTitle>
          <AlertDescription>
            There was an error loading the BOL upload component. Please refresh the page and try again.
          </AlertDescription>
        </Alert>
      </div>
    );
  }
}