import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { UploadCloud, Loader2 } from 'lucide-react';

export function FileUploader() {
  const [file, setFile] = useState<File | null>(null);
  const [description, setDescription] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!file) {
        throw new Error('No file selected');
      }

      const formData = new FormData();
      formData.append('file', file);
      formData.append('description', description);

      // Use the new asset-manager endpoint
      const response = await fetch('/api/company-assets/assets', {
        method: 'POST',
        body: formData,
        // Do not set Content-Type here, it will be set automatically with the correct boundary
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to upload file');
      }

      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: 'File uploaded',
        description: 'Your file has been uploaded successfully.',
      });
      
      setFile(null);
      setDescription('');
      
      // Invalidate both asset queries to refresh the list
      queryClient.invalidateQueries({ queryKey: ['/api/assets'] });
      queryClient.invalidateQueries({ queryKey: ['/api/company-assets/assets'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Upload failed',
        description: error.message,
        variant: 'destructive',
      });
    }
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    uploadMutation.mutate();
  };

  return (
    <Card className="mb-6">
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="file">File</Label>
              <Input
                id="file"
                type="file"
                onChange={handleFileChange}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                placeholder="Add a description for this file..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            
            <Button 
              type="submit" 
              disabled={!file || uploadMutation.isPending}
              className="w-full"
            >
              {uploadMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <UploadCloud className="mr-2 h-4 w-4" />
                  Upload File
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}