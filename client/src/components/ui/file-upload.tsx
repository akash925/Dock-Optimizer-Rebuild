import * as React from "react";
import { useState, useRef } from "react";
import { UploadCloud, X, FileIcon, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";

export interface FileUploadProps {
  onFileChange: (file: File | null) => void;
  acceptedFileTypes?: string;
  maxSizeMB?: number;
  currentFileName?: string;
}

export function FileUpload({
  onFileChange,
  acceptedFileTypes = "*",
  maxSizeMB = 10,
  currentFileName,
}: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string | undefined>(currentFileName);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const maxSizeBytes = maxSizeMB * 1024 * 1024;

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      validateAndProcessFile(file);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      validateAndProcessFile(file);
    }
  };

  const validateAndProcessFile = (file: File) => {
    setError(null);

    // Validate file type if acceptedFileTypes is specified
    if (
      acceptedFileTypes !== "*" &&
      !isFileTypeAccepted(file.type, acceptedFileTypes)
    ) {
      setError(`File type not accepted. Please upload ${acceptedFileTypes}.`);
      return;
    }

    // Validate file size
    if (file.size > maxSizeBytes) {
      setError(`File size exceeds ${maxSizeMB}MB limit.`);
      return;
    }

    setFileName(file.name);
    onFileChange(file);
  };

  const handleRemove = () => {
    setFileName(undefined);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    onFileChange(null);
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="w-full">
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept={acceptedFileTypes}
        onChange={handleFileInputChange}
      />

      {error && (
        <Alert variant="destructive" className="mb-3">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!fileName ? (
        <div
          className={cn(
            "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
            isDragging
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary hover:bg-primary/5"
          )}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleButtonClick}
        >
          <UploadCloud className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
          <p className="text-sm font-medium mb-1">
            Drag & drop or click to upload
          </p>
          <p className="text-xs text-muted-foreground">
            {acceptedFileTypes !== "*"
              ? `Accepted file types: ${acceptedFileTypes}`
              : "All file types accepted"}
            {" · "}
            Max size: {maxSizeMB}MB
          </p>
        </div>
      ) : (
        <div className="flex items-center p-3 border rounded-lg">
          <FileIcon className="h-6 w-6 mr-2 text-primary" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{fileName}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="ml-2"
            onClick={handleRemove}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

// Helper function to check if file type is in the list of accepted types
function isFileTypeAccepted(fileType: string, acceptedTypes: string): boolean {
  const acceptedTypesArray = acceptedTypes.split(",");
  
  return acceptedTypesArray.some((type) => {
    // Exact match
    if (fileType === type.trim()) {
      return true;
    }
    
    // Wildcard match (e.g., 'image/*')
    if (type.trim().endsWith("/*")) {
      const category = type.trim().split("/")[0];
      return fileType.startsWith(`${category}/`);
    }
    
    return false;
  });
}