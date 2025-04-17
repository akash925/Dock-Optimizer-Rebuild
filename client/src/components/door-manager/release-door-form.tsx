import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, ImagePlus, X, Camera } from "lucide-react";

interface ReleaseDoorFormProps {
  isOpen: boolean;
  onClose: () => void;
  scheduleId: number;
  onSuccess: () => void;
}

export default function ReleaseDoorForm({
  isOpen,
  onClose,
  scheduleId,
  onSuccess
}: ReleaseDoorFormProps) {
  const { toast } = useToast();
  const [notes, setNotes] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  
  // File input ref
  const fileInputRef = React.createRef<HTMLInputElement>();
  
  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setSelectedFile(file);
      
      // Create preview URL
      const previewUrl = URL.createObjectURL(file);
      setImagePreview(previewUrl);
    }
  };
  
  // Handle removing selected image
  const handleRemoveImage = () => {
    setSelectedFile(null);
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
      setImagePreview(null);
    }
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };
  
  // Release door mutation
  const releaseMutation = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      formData.append("notes", notes);
      formData.append("releaseType", "normal");
      
      if (selectedFile) {
        formData.append("photo", selectedFile);
      }
      
      const response = await apiRequest(
        "POST", 
        `/api/schedules/${scheduleId}/release`,
        formData,
        { useFormData: true }
      );
      
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Door Released",
        description: "The door has been successfully released.",
      });
      onSuccess();
      
      // Cleanup
      if (imagePreview) {
        URL.revokeObjectURL(imagePreview);
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Failed to release door: ${error.message}`,
        variant: "destructive",
      });
    },
  });
  
  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    releaseMutation.mutate();
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Release Door</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              placeholder="Add any notes about the door release..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-[100px]"
            />
          </div>
          
          <div className="space-y-2">
            <Label>Photo (Optional)</Label>
            <div className="flex items-center space-x-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                <ImagePlus className="h-4 w-4 mr-2" />
                {selectedFile ? "Change Photo" : "Upload Photo"}
              </Button>
              
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
              
              {/* Mobile camera button */}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  if (fileInputRef.current) {
                    fileInputRef.current.accept = "image/*;capture=camera";
                    fileInputRef.current.click();
                  }
                }}
              >
                <Camera className="h-4 w-4 mr-2" />
                Take Photo
              </Button>
            </div>
            
            {/* Image preview */}
            {imagePreview && (
              <div className="relative mt-2 inline-block">
                <img 
                  src={imagePreview} 
                  alt="Preview" 
                  className="max-h-[200px] rounded-md border"
                />
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="absolute -top-2 -right-2 h-6 w-6 p-0 rounded-full"
                  onClick={handleRemoveImage}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
          
          <DialogFooter className="pt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={onClose} 
              disabled={releaseMutation.isPending}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={releaseMutation.isPending}
            >
              {releaseMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Releasing...
                </>
              ) : (
                "Release Door"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}