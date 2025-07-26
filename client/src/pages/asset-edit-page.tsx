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
import { useAuth } from '@/hooks/use-auth';
import { apiRequest } from '@/lib/queryClient';
import { BarcodeGenerator } from '@/components/company-assets/barcode-generator';
import AssetPhotoDropzone from '@/components/AssetPhotoDropzone';

export default function AssetEditPage() {
  const [, params] = useRoute<{ id: string }>('/company-assets/assets/:id/edit');
  const [, navigate] = useLocation();
  const assetId = params?.id;
  const [barcodeDialogOpen, setBarcodeDialogOpen] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: asset, isLoading, error } = useQuery<CompanyAsset>({
    queryKey: ['companyAssets', user?.tenantId, assetId],
    queryFn: async () => {
      const response = await fetch(`/api/company-assets/${assetId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch asset details');
      }
      return response.json();
    },
    enabled: !!assetId,
  });
  
  // Mutation for uploading asset photo
  const uploadPhotoMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('photo', file);
      
      const response = await fetch(`/api/company-assets/${assetId}/photo`, {
        method: 'PUT',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error('Failed to upload photo');
      }
      
      return response.json();
    },
    onSuccess: () => {
      // Invalidate the asset query to refresh the data
      queryClient.invalidateQueries({ queryKey: ['companyAssets', user?.tenantId, assetId] });
    },
    onError: (error: any) => {
      toast({
        title: 'Upload failed',
        description: error.message || 'Failed to upload photo',
        variant: 'destructive',
      });
    },
  });

  // Mutation for updating the barcode
  const updateBarcodeMutation = useMutation({
    mutationFn: async (barcode: string) => {
      const response = await apiRequest('PATCH', `/api/company-assets/${assetId}/barcode`, { barcode });
      if (!response.ok) {
        throw new Error('Failed to update barcode');
      }
      return response.json();
    },
    onSuccess: () => {
      // Invalidate the asset query to refresh the data
      queryClient.invalidateQueries({ queryKey: ['companyAssets', user?.tenantId, assetId] });
    },
    onError: (error: any) => {
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
      
      {/* Asset Photo Upload */}
      <div className="mb-6 max-w-2xl mx-auto">
        <AssetPhotoDropzone 
          onUpload={uploadPhotoMutation.mutateAsync}
          existing={asset.photoUrl}
          assetId={assetId ? Number(assetId) : undefined}
          tenantId={asset.tenantId}
        />
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
                        JsBarcode(ref, asset.barcode || '', {
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
        assetId={assetId ? Number(assetId) : 0}
        assetName={asset.name}
        currentBarcode={asset.barcode}
        onSave={updateBarcodeMutation.mutateAsync}
        open={barcodeDialogOpen}
        onOpenChange={setBarcodeDialogOpen}
      />
    </div>
  );
}