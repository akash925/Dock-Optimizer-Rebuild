import { useState, useEffect } from 'react';
import { useRoute } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { CompanyAssetForm } from '@/components/asset-manager/company-asset-form';
import { Skeleton } from '@/components/ui/skeleton';
import { CompanyAsset } from '@shared/schema';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLocation } from 'wouter';

export default function AssetEditPage() {
  const [, params] = useRoute<{ id: string }>('/asset-manager/assets/:id/edit');
  const [, navigate] = useLocation();
  const assetId = params?.id;

  const { data: asset, isLoading, error } = useQuery<CompanyAsset>({
    queryKey: [`/api/asset-manager/company-assets/${assetId}`],
    enabled: !!assetId,
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
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Asset Manager</h2>
          <p className="text-muted-foreground mt-2">Managing assets and equipment</p>
        </div>
      </div>
      
      <h3 className="text-2xl font-semibold my-6">Edit Asset: {asset.name}</h3>
      
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
    </div>
  );
}