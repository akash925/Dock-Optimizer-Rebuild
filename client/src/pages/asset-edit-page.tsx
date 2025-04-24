import { useState } from 'react';
import { useRoute } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { CompanyAssetForm } from '@/components/asset-manager/company-asset-form';
import { Skeleton } from '@/components/ui/skeleton';
import { CompanyAsset } from '@shared/schema';
import { Loader2, ArrowLeft, Barcode, QrCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLocation } from 'wouter';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { BarcodeGenerator } from '@/components/asset-manager/barcode-generator';

export default function AssetEditPage() {
  const [, params] = useRoute<{ id: string }>('/asset-manager/assets/:id/edit');
  const [, navigate] = useLocation();
  const assetId = params?.id;
  const [barcodeDialogOpen, setBarcodeDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: asset, isLoading, error } = useQuery<CompanyAsset>({
    queryKey: [`/api/asset-manager/company-assets/${assetId}`],
    queryFn: async () => {
      const response = await fetch(`/api/asset-manager/company-assets/${assetId}`);
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
      const response = await apiRequest('PATCH', `/api/asset-manager/company-assets/${assetId}/barcode`, { barcode });
      if (!response.ok) {
        throw new Error('Failed to update barcode');
      }
      return response.json();
    },
    onSuccess: () => {
      // Invalidate the asset query to refresh the data
      queryClient.invalidateQueries({ queryKey: [`/api/asset-manager/company-assets/${assetId}`] });
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
                onClick={() => navigate('/asset-manager')}
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
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Asset Manager</h2>
            <p className="text-muted-foreground mt-2">Managing assets and equipment</p>
          </div>
          <Button 
            onClick={() => navigate('/asset-manager')}
            variant="outline"
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Assets
          </Button>
        </div>
      </div>
      
      <div className="flex justify-between items-center my-6">
        <h3 className="text-2xl font-semibold">Edit Asset: {asset.name}</h3>
        <div className="flex space-x-2">
          <Button 
            variant="outline" 
            onClick={() => setBarcodeDialogOpen(true)}
            className="flex items-center gap-2"
          >
            {asset.barcode ? (
              <>
                <Barcode className="h-4 w-4" />
                Manage Barcode
              </>
            ) : (
              <>
                <Barcode className="h-4 w-4" />
                Add Barcode
              </>
            )}
          </Button>
        </div>
      </div>
      
      {/* Display barcode information if available */}
      {asset.barcode && (
        <div className="mb-6 p-4 bg-muted/50 rounded-lg">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <div className="text-sm text-muted-foreground mb-1">Asset Barcode</div>
              <div className="font-mono text-lg">{asset.barcode}</div>
            </div>
            <div className="flex space-x-2">
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
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setBarcodeDialogOpen(true)}
              >
                Edit
              </Button>
            </div>
          </div>
        </div>
      )}
      
      {/* Display asset image if available */}
      {asset.photoUrl && (
        <div className="mb-6 max-w-sm mx-auto">
          <div className="rounded-md overflow-hidden border shadow-sm">
            <img 
              src={asset.photoUrl} 
              alt={asset.name} 
              className="w-full h-auto object-contain"
            />
          </div>
        </div>
      )}
      
      <CompanyAssetForm 
        assetToEdit={asset} 
        onSuccess={() => navigate('/asset-manager')} 
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