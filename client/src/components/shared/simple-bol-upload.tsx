import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FileUp, Upload, CheckCircle, AlertCircle, FileText, X, Download, Eye } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';

interface SimpleBolUploadProps {
  onBolProcessed: (data: any, fileUrl: string) => void;
  onProcessingStateChange: (isProcessing: boolean) => void;
  scheduleId?: number;
  className?: string;
}

export default function SimpleBolUpload({
  onBolProcessed,
  onProcessingStateChange,
  scheduleId,
  className = ''
}: SimpleBolUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [processedFiles, setProcessedFiles] = useState<any[]>([]);
  const { toast } = useToast();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setUploadError(null);
      setUploadSuccess(false);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setUploadError(null);
    onProcessingStateChange(true);

    try {
      const formData = new FormData();
      formData.append('bolFile', selectedFile);
      if (scheduleId) {
        formData.append('scheduleId', scheduleId.toString());
      }

      const response = await fetch('/api/ocr/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.success) {
        setUploadSuccess(true);
        
        // Add to processed files list for email-like display
        const processedFile = {
          id: Date.now(),
          name: selectedFile.name,
          size: selectedFile.size,
          type: selectedFile.type,
          uploadedAt: new Date().toISOString(),
          fileUrl: result.fileUrl,
          extractedData: result.extractedData,
          processingStatus: 'completed',
          confidence: result.extractedData?.confidence || 85
        };
        
        setProcessedFiles(prev => [...prev, processedFile]);
        onBolProcessed(result.extractedData, result.fileUrl);
        
        // Reset file input
        setSelectedFile(null);
        
        toast({
          title: "BOL Upload Success",
          description: "Document processed successfully",
        });
      } else {
        throw new Error(result.message || 'Upload failed');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      setUploadError(errorMessage);
      toast({
        title: "Upload Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      onProcessingStateChange(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (type: string) => {
    if (type.includes('pdf')) return <FileText className="h-5 w-5 text-red-500" />;
    if (type.includes('image')) return <Eye className="h-5 w-5 text-blue-500" />;
    return <FileText className="h-5 w-5 text-gray-500" />;
  };

  const removeFile = (id: number) => {
    setProcessedFiles(prev => prev.filter(f => f.id !== id));
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Processed Files Display (Email-like attachments) */}
      {processedFiles.length > 0 && (
        <div className="space-y-2">
          <Label className="text-sm font-medium text-gray-700">Processed Documents</Label>
          <div className="space-y-2">
            {processedFiles.map((file) => (
              <div
                key={file.id}
                className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  {getFileIcon(file.type)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {file.name}
                      </p>
                      <Badge variant="secondary" className="text-xs">
                        {file.confidence}% confidence
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-500">
                      {formatFileSize(file.size)} • Uploaded {new Date(file.uploadedAt).toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {file.fileUrl && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => window.open(file.fileUrl, '_blank')}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFile(file.id)}
                    className="text-red-600 hover:text-red-800"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* File Input */}
      <div className="space-y-2">
        <Label htmlFor="bol-file">Upload BOL Document</Label>
        <div className="flex items-center gap-2">
          <Input
            id="bol-file"
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
            onChange={handleFileSelect}
            disabled={isUploading}
            className="flex-1"
          />
          <Button 
            onClick={handleUpload}
            disabled={!selectedFile || isUploading}
            variant="outline"
            size="sm"
          >
            {isUploading ? (
              <>
                <Upload className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <FileUp className="h-4 w-4 mr-2" />
                Upload
              </>
            )}
          </Button>
        </div>
      </div>

      {uploadError && (
        <div className="flex items-center gap-2 text-red-600 text-sm">
          <AlertCircle className="h-4 w-4" />
          {uploadError}
        </div>
      )}

      {uploadSuccess && (
        <div className="flex items-center gap-2 text-green-600 text-sm">
          <CheckCircle className="h-4 w-4" />
          BOL document uploaded and processed successfully
        </div>
      )}

      {selectedFile && (
        <div className="text-sm text-gray-600">
          Selected: {selectedFile.name} ({formatFileSize(selectedFile.size)})
        </div>
      )}
    </div>
  );
}