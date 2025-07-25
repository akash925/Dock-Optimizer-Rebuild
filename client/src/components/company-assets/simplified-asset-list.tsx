import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Asset } from '@shared/schema';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  FileIcon,
  Trash2,
  Eye,
  Download,
  Search,
  Loader2,
} from 'lucide-react';
import AssetThumbnail from '@/components/AssetThumbnail';
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle, 
  AlertDialogTrigger 
} from '@/components/ui/alert-dialog';

export function AssetList() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAssetId, setSelectedAssetId] = useState<number | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: assets, isLoading, error } = useQuery<Asset[]>({
    queryKey: ['companyAssets'],
    placeholderData: [],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest('DELETE', `/api/company-assets/${id}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete asset');
      }
      return id;
    },
    onSuccess: () => {
      toast({
        title: 'Asset deleted',
        description: 'Asset has been deleted successfully.',
      });
      
      // Invalidate assets query to refresh the list
      queryClient.invalidateQueries({ queryKey: ['companyAssets'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Deletion failed',
        description: error.message,
        variant: 'destructive',
      });
    }
  });

  // Filter assets based on search term
  const filteredAssets = assets?.filter((asset: any) => asset.filename.toLowerCase().includes(searchTerm.toLowerCase()) ||
  (asset.description && asset.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const isImageFile = (filename: string): boolean => {
    const extension = filename.split('.').pop()?.toLowerCase();
    return ['jpg', 'jpeg', 'png', 'gif', 'svg'].includes(extension || '');
  };

  const formatFileSize = (bytes?: number | null) => {
    if (!bytes) return 'Unknown';
    
    const kb = bytes / 1024;
    if (kb < 1024) {
      return `${kb.toFixed(2)} KB`;
    } else {
      const mb = kb / 1024;
      return `${mb.toFixed(2)} MB`;
    }
  };

  const formatDate = (date: Date): string => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hour12: true
    }).format(date);
  };

  const handleDelete = (id: number) => {
    deleteMutation.mutate(id);
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-4">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search files..."
              className="pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : error ? (
          <div className="text-center text-red-500 py-8">
            Failed to load assets. Please try again.
          </div>
        ) : filteredAssets && filteredAssets.length > 0 ? (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead>Filename</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Uploaded</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAssets.map((asset: any) => <TableRow key={asset.id}>
                  <TableCell className="pl-4">
                    {isImageFile(asset.filename) ? (
                      <AssetThumbnail 
                        id={asset.id} 
                        filename={asset.filename}
                        className="h-12 w-12" 
                      />
                    ) : (
                      <FileIcon className="h-5 w-5 text-blue-500" />
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{asset.filename}</TableCell>
                  <TableCell>{asset.description || '-'}</TableCell>
                  <TableCell>{formatFileSize(asset.fileSize)}</TableCell>
                  <TableCell>{asset.createdAt ? formatDate(new Date(asset.createdAt)) : '-'}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        title="View"
                        onClick={() => window.open(asset.url, '_blank')}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Download"
                        onClick={() => {
                          const link = document.createElement('a');
                          link.href = asset.url;
                          link.download = asset.filename;
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                        }}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Delete"
                            onClick={() => setSelectedAssetId(asset.id)}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Asset</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete this asset? This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction 
                              onClick={() => selectedAssetId !== null && handleDelete(selectedAssetId)}
                              className="bg-red-500 hover:bg-red-600 text-white"
                            >
                              {deleteMutation.isPending ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  Deleting...
                                </>
                              ) : (
                                'Delete'
                              )}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>)}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center text-muted-foreground py-8">
            {searchTerm ? "No assets match your search." : "No assets found. Upload some files to get started."}
          </div>
        )}
      </CardContent>
    </Card>
  );
}