import { useState } from 'react';
import { useRoute } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { CompanyAssetForm } from '@/components/company-assets/company-asset-form';
import { Skeleton } from '@/components/ui/skeleton';
import { CompanyAsset } from '@shared/schema';
import { Loader2, ArrowLeft, Barcode, QrCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLocation } from 'wouter';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { BarcodeGenerator } from '@/components/company-assets/barcode-generator';

export default function AssetEditPage() {
  const [, params] = useRoute<{ id: string }>('/company-assets/assets/:id/edit');
  const [, navigate] = useLocation();
  const assetId = params?.id;
  const [barcodeDialogOpen, setBarcodeDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: asset, isLoading, error } = useQuery<CompanyAsset>({
    queryKey: [`/api/company-assets/company-assets/${assetId}`],
    queryFn: async () => {
      const response = await fetch(`/api/company-assets/company-assets/${assetId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch asset details');
      }
      return response.json();
    },
    enabled: !!assetId,
  });
  
  // Mutation for updating the barcode
  const updateBarcodeMutation = useMutation({
    mutationFn: async (barcode: string) => {
      const response = await apiRequest('PATCH', `/api/company-assets/company-assets/${assetId}/barcode`, { barcode });
      if (!response.ok) {
        throw new Error('Failed to update barcode');
      }
      return response.json();
    },
    onSuccess: () => {
      // Invalidate the asset query to refresh the data
      queryClient.invalidateQueries({ queryKey: [`/api/company-assets/company-assets/${assetId}`] });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update barcode',
        variant: 'destructive',
      });
    },
  });

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="space-y-4">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Asset Manager</h2>
            <Skeleton className="h-6 w-64 mt-2" />
          </div>
        </div>
        <div className="mt-8 space-y-4">
          <Skeleton className="h-8 w-96" />
          <Card>
            <CardContent className="flex items-center justify-center min-h-[400px]">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (error || !asset) {
    return (
      <div className="container mx-auto py-8">
        <div className="space-y-4">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Asset Manager</h2>
            <p className="text-muted-foreground mt-2">Error loading asset details</p>
          </div>
        </div>
        <Card className="mt-8">
          <CardContent className="p-6">
            <div className="text-center py-8">
              <p className="text-red-500 mb-4">Failed to load asset. The asset may have been deleted or you don't have permission to view it.</p>
              <Button 
                onClick={() => navigate('/company-assets')}
                variant="secondary"
              >
                Return to Asset Manager
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="space-y-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Asset Manager</h2>
          <h3 className="text-2xl font-semibold mt-2">Edit Asset: {asset.name}</h3>
        </div>
        <div className="flex justify-end">
          <Button 
            onClick={() => navigate('/company-assets')}
            variant="outline"
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Assets
          </Button>
        </div>
      </div>
      
      {/* Display asset image prominently */}
      <div className="mb-6 max-w-md mx-auto">
        <div className="rounded-md overflow-hidden border shadow-sm relative group">
          {asset.photoUrl ? (
            <img 
              src={asset.photoUrl} 
              alt={asset.name} 
              className="w-full h-auto max-h-[300px] object-contain"
            />
          ) : (
            <div className="w-full h-[200px] bg-muted/50 flex items-center justify-center">
              <div className="text-muted-foreground text-center p-4">
                <div className="h-8 w-8 mx-auto mb-2 opacity-40">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                    <circle cx="9" cy="9" r="2" />
                    <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                  </svg>
                </div>
                <p>No image available</p>
              </div>
            </div>
          )}
          {/* Overlay button for changing image */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
            <div className="cursor-pointer">
              <label htmlFor="asset-photo-upload" className="cursor-pointer">
                <Button variant="outline" className="bg-background" type="button">
                  Change Display Image
                </Button>
              </label>
              <input 
                id="asset-photo-upload" 
                type="file" 
                className="hidden" 
                accept="image/*,.pdf"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    console.log("Selected file:", file.name, file.type, file.size);
                    // Create FormData to upload the image
                    const formData = new FormData();
                    formData.append('photo', file);
                    
                    toast({
                      title: 'Uploading...',
                      description: 'Uploading image, please wait',
                    });
                    
                    // Upload the image
                    fetch(`/api/company-assets/company-assets/${assetId}/photo`, {
                      method: 'POST',
                      body: formData,
                    })
                    .then(response => {
                      if (!response.ok) {
                        throw new Error('Failed to upload image');
                      }
                      return response.json();
                    })
                    .then(() => {
                      // Invalidate the asset query to refresh the data
                      queryClient.invalidateQueries({ queryKey: [`/api/company-assets/company-assets/${assetId}`] });
                      toast({
                        title: 'Image uploaded',
                        description: 'Asset image has been updated successfully',
                      });
                    })
                    .catch(err => {
                      console.error("Upload error:", err);
                      toast({
                        title: 'Upload failed',
                        description: err.message || 'Failed to upload image',
                        variant: 'destructive',
                      });
                    });
                  }
                }}
              />
            </div>
          </div>
        </div>
      </div>
      
      {/* Display barcode information */}
      <div className="mb-6 p-4 bg-muted/50 rounded-lg">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex flex-row gap-4 items-center">
            <div>
              <div className="text-sm text-muted-foreground mb-1">Asset Barcode</div>
              <div className="font-mono text-lg">{asset.barcode || 'Not assigned'}</div>
            </div>
            
            {/* Display barcode image */}
            {asset.barcode && (
              <div className="bg-white p-2 border rounded">
                <svg ref={(ref) => {
                  if (ref && asset.barcode) {
                    try {
                      // Get organization's default barcode format
                      const barcodeFormat = localStorage.getItem('defaultBarcodeFormat') || "CODE128";
                      
                      import('jsbarcode').then(({ default: JsBarcode }) => {
                        JsBarcode(ref, asset.barcode, {
                          format: barcodeFormat,
                          width: 1.5,
                          height: 40,
                          displayValue: false,
                          margin: 0,
                          background: '#ffffff',
                        });
                      });
                    } catch (error) {
                      console.error('Error generating barcode:', error);
                    }
                  }
                }} className="h-12"></svg>
              </div>
            )}
          </div>
          
          <div className="flex space-x-2">
            {asset.barcode && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(asset.barcode || '');
                  toast({
                    title: 'Copied!',
                    description: 'Barcode copied to clipboard',
                  });
                }}
              >
                Copy
              </Button>
            )}
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setBarcodeDialogOpen(true)}
            >
              {asset.barcode ? 'Edit' : 'Assign Barcode'}
            </Button>
          </div>
        </div>
      </div>
      
      <CompanyAssetForm 
        assetToEdit={asset} 
        onSuccess={() => navigate('/company-assets')} 
      />

      {/* Barcode Generator Dialog */}
      <BarcodeGenerator
        assetId={Number(assetId)}
        assetName={asset.name}
        currentBarcode={asset.barcode}
        onSave={updateBarcodeMutation.mutateAsync}
        open={barcodeDialogOpen}
        onOpenChange={setBarcodeDialogOpen}
      />
    </div>
  );
}