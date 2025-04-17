import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Camera, Upload, X } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

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
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [notes, setNotes] = useState<string>("");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  // Handle photo upload from file
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setPhotoPreview(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle taking a photo with camera (just opens file selection on web)
  const handleTakePhoto = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Handle removing the photo
  const handleRemovePhoto = () => {
    setPhotoPreview(null);
    setPhotoFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Mutation for releasing door (completing appointment)
  const releaseDoorMutation = useMutation({
    mutationFn: async () => {
      if (!scheduleId) throw new Error("No appointment ID provided");
      
      const formData = new FormData();
      formData.append("notes", notes);
      formData.append("releaseType", "normal");
      formData.append("lastModifiedBy", String(user?.id || 1));
      
      if (photoFile) {
        formData.append("photo", photoFile);
      }
      
      // Use different content type handling for FormData
      const res = await fetch(`/api/schedules/${scheduleId}/release`, {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });
      
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || "Failed to release door");
      }
      
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/schedules"] });
      toast({
        title: "Door released",
        description: "The door has been successfully released.",
      });
      onSuccess();
    },
    onError: (error: Error) => {
      toast({
        title: "Error releasing door",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Handle form submission
  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await releaseDoorMutation.mutateAsync();
    } catch (error) {
      console.error("Form submission error:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Release Door</DialogTitle>
          <DialogDescription>
            Add optional notes and/or photo before releasing the door.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              placeholder="Add any notes about the appointment..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
          
          <div className="space-y-2">
            <Label>Photo (Optional)</Label>
            <div className="flex space-x-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={handleTakePhoto}
                className="flex-1"
              >
                <Camera className="h-4 w-4 mr-2" />
                Take Photo
              </Button>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => fileInputRef.current?.click()}
                className="flex-1"
              >
                <Upload className="h-4 w-4 mr-2" />
                Upload
              </Button>
              <Input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
            
            {photoPreview && (
              <div className="mt-4 relative">
                <Button
                  type="button"
                  size="icon"
                  variant="secondary"
                  className="absolute top-2 right-2 h-8 w-8 rounded-full bg-black bg-opacity-50 hover:bg-opacity-70 text-white"
                  onClick={handleRemovePhoto}
                >
                  <X className="h-4 w-4" />
                </Button>
                <img 
                  src={photoPreview} 
                  alt="Preview" 
                  className="w-full rounded-md max-h-60 object-contain" 
                />
              </div>
            )}
          </div>
        </div>
        
        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Releasing..." : "Release Door"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}