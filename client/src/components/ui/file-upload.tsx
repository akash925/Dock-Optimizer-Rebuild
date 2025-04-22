import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FilePenLine, X, FileIcon, Paperclip } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface FileUploadProps {
  onFileChange: (file: File | null) => void;
  acceptedFileTypes?: string;
  maxSizeMB?: number;
  initialFile?: File | null;
  className?: string;
}

export function FileUpload({
  onFileChange,
  acceptedFileTypes = ".pdf,.jpg,.jpeg,.png",
  maxSizeMB = 10,
  initialFile = null,
  className = "",
}: FileUploadProps) {
  const [file, setFile] = useState<File | null>(initialFile);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const selectedFile = e.target.files?.[0] || null;
    
    if (!selectedFile) {
      setFile(null);
      onFileChange(null);
      return;
    }
    
    // Check file size (convert MB to bytes)
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    if (selectedFile.size > maxSizeBytes) {
      setError(`File size exceeds maximum allowed size (${maxSizeMB}MB)`);
      return;
    }
    
    // Check file type if acceptedFileTypes is provided
    if (acceptedFileTypes) {
      const fileExtension = `.${selectedFile.name.split('.').pop()?.toLowerCase()}`;
      const acceptedTypes = acceptedFileTypes.split(',');
      
      // Allow if extension matches or mime type matches
      const isAcceptedExtension = acceptedTypes.some(type => 
        type.trim().toLowerCase() === fileExtension ||
        type.trim().includes('/*') && selectedFile.type.startsWith(type.trim().replace('/*', '/'))
      );
      
      if (!isAcceptedExtension) {
        setError(`File type not supported. Please upload ${acceptedFileTypes.replace(/\./g, '')} files`);
        return;
      }
    }
    
    setFile(selectedFile);
    onFileChange(selectedFile);
  };

  const handleClearFile = () => {
    setFile(null);
    setError(null);
    onFileChange(null);
    
    // Reset the input field
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  const triggerFileInput = () => {
    if (inputRef.current) {
      inputRef.current.click();
    }
  };

  const getFileIcon = () => {
    if (!file) return <FileIcon className="h-5 w-5" />;
    
    const fileType = file.type.split('/')[0];
    switch (fileType) {
      case 'image':
        return <FilePenLine className="h-5 w-5" />;
      default:
        return <FileIcon className="h-5 w-5" />;
    }
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <Input
        type="file"
        ref={inputRef}
        onChange={handleFileChange}
        accept={acceptedFileTypes}
        className="hidden"
        aria-hidden="true"
      />
      
      {file ? (
        <div className="flex items-center justify-between p-2 border rounded-md bg-muted/30">
          <div className="flex items-center space-x-2 overflow-hidden">
            {getFileIcon()}
            <span className="truncate text-sm">{file.name}</span>
            <span className="text-xs text-muted-foreground">
              ({(file.size / 1024 / 1024).toFixed(2)} MB)
            </span>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={handleClearFile} 
            className="h-8 w-8"
            type="button"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          className="w-full border-dashed h-20 flex flex-col justify-center space-y-2"
          onClick={triggerFileInput}
        >
          <Paperclip className="h-5 w-5 mx-auto" />
          <span className="text-sm">
            Click to upload or drag & drop
          </span>
        </Button>
      )}
      
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      <div className="text-xs text-muted-foreground">
        {maxSizeMB && `Maximum file size: ${maxSizeMB}MB. `}
        {acceptedFileTypes && `Accepted file types: ${acceptedFileTypes.replace(/\./g, '')}`}
      </div>
    </div>
  );
}