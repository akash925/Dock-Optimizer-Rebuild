import { useState, useRef, ReactNode } from 'react';
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
  buttonText?: string;
  buttonIcon?: ReactNode;
}

export function FileUpload({
  onFileChange,
  acceptedFileTypes = ".pdf,.jpg,.jpeg,.png",
  maxSizeMB = 10,
  initialFile = null,
  className = "",
  buttonText = "Click to upload or drag & drop",
  buttonIcon = <Paperclip className="h-5 w-5 mx-auto" />,
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
      const fileMimeType = selectedFile.type.toLowerCase();
      const acceptedTypes = acceptedFileTypes.split(',');
      
      // Improved extension and MIME type checking
      const isAccepted = acceptedTypes.some(type => {
        const trimmedType = type.trim().toLowerCase();
        
        // Check if it's an extension match (e.g., .pdf, .doc)
        if (trimmedType.startsWith('.')) {
          return trimmedType === fileExtension;
        }
        
        // Check if it's a MIME type with wildcard (e.g., image/*)
        if (trimmedType.includes('/*')) {
          const mimePrefix = trimmedType.replace('/*', '/');
          return fileMimeType.startsWith(mimePrefix);
        }
        
        // Check specific MIME types and handle common cases
        if (trimmedType === 'application/pdf' && 
           (fileMimeType === 'application/pdf' || 
            fileExtension === '.pdf')) {
          return true;
        }
        
        if ((trimmedType === '.doc' || trimmedType === '.docx') && 
           (fileExtension === '.doc' || 
            fileExtension === '.docx' || 
            fileMimeType.includes('word') || 
            fileMimeType.includes('document'))) {
          return true;
        }
        
        // Check for exact MIME type match
        return trimmedType === fileMimeType;
      });
      
      if (!isAccepted) {
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
          {buttonIcon}
          <span className="text-sm">
            {buttonText}
          </span>
        </Button>
      )}
      
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      <div className="text-xs text-muted-foreground break-words">
        {maxSizeMB && `Maximum file size: ${maxSizeMB}MB. `}
        {acceptedFileTypes && `Accepted file types: ${acceptedFileTypes.split(',').map(t => t.replace(/\./g, '').trim()).join(', ')}`}
      </div>
    </div>
  );
}