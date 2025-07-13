import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FileUp, Upload, CheckCircle, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

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
        onBolProcessed(result.extractedData, result.fileUrl);
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

  return (
    <div className={`space-y-4 ${className}`}>
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
          Selected: {selectedFile.name}
        </div>
      )}
    </div>
  );
}