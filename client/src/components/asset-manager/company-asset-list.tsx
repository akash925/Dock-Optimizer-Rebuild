import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { CompanyAsset, AssetCategory } from '@shared/schema';
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
  Package,
  Truck,
  Wrench,
  HardHat,
  Box,
  FileQuestion,
  Pencil,
  Trash2,
  Search,
  Loader2,
  Image,
  Eye
} from 'lucide-react';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { CompanyAssetForm } from './company-asset-form';

interface CompanyAssetListProps {
  onEditAsset?: (asset: CompanyAsset) => void;
}

export function CompanyAssetList({ onEditAsset }: CompanyAssetListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAssetId, setSelectedAssetId] = useState<number | null>(null);
  const [assetToEdit, setAssetToEdit] = useState<CompanyAsset | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch company assets
  const { data: assets, isLoading, error } = useQuery<CompanyAsset[]>({
    queryKey: ['/api/asset-manager/company-assets'],
    placeholderData: [],
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest('DELETE', `/api/asset-manager/company-assets/${id}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete company asset');
      }
      return id;
    },
    onSuccess: () => {
      toast({
        title: 'Asset deleted',
        description: 'Company asset has been deleted successfully.',
      });
      
      // Invalidate query to refresh the list
      queryClient.invalidateQueries({ queryKey: ['/api/asset-manager/company-assets'] });
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
  const filteredAssets = assets?.filter(asset => 
    asset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    asset.manufacturer.toLowerCase().includes(searchTerm.toLowerCase()) ||
    asset.owner.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (asset.description && asset.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (asset.barcode && asset.barcode.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Get category icon based on asset category
  const getCategoryIcon = (category: AssetCategory) => {
    switch (category) {
      case AssetCategory.EQUIPMENT:
        return <Wrench className="h-5 w-5 text-blue-500" />;
      case AssetCategory.VEHICLE:
        return <Truck className="h-5 w-5 text-green-500" />;
      case AssetCategory.TOOLS:
        return <HardHat className="h-5 w-5 text-yellow-500" />;
      case AssetCategory.ELECTRONICS:
        return <Box className="h-5 w-5 text-indigo-500" />;
      case AssetCategory.FURNITURE:
        return <Package className="h-5 w-5 text-purple-500" />;
      case AssetCategory.SAFETY:
        return <HardHat className="h-5 w-5 text-orange-500" />;
      case AssetCategory.OTHER:
        return <FileQuestion className="h-5 w-5 text-gray-500" />;
      default:
        return <FileQuestion className="h-5 w-5 text-gray-500" />;
    }
  };

  // Format category for display
  const formatCategory = (category: AssetCategory): string => {
    return category
      .toLowerCase()
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Format date for display
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

  // Handle delete
  const handleDelete = (id: number) => {
    deleteMutation.mutate(id);
  };

  // Handle edit
  const handleEdit = (asset: CompanyAsset) => {
    if (onEditAsset) {
      onEditAsset(asset);
    } else {
      setAssetToEdit(asset);
      setIsDialogOpen(true);
    }
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-4">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search company assets..."
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
            Failed to load company assets. Please try again.
          </div>
        ) : filteredAssets && filteredAssets.length > 0 ? (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead>Asset Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Manufacturer</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Barcode</TableHead>
                  <TableHead>Last Updated</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAssets.map((asset) => (
                  <TableRow key={asset.id}>
                    <TableCell className="pl-4">{getCategoryIcon(asset.category)}</TableCell>
                    <TableCell className="font-medium">{asset.name}</TableCell>
                    <TableCell>{formatCategory(asset.category)}</TableCell>
                    <TableCell>{asset.manufacturer}</TableCell>
                    <TableCell>{asset.owner}</TableCell>
                    <TableCell>{asset.barcode || '-'}</TableCell>
                    <TableCell>{asset.updatedAt ? formatDate(new Date(asset.updatedAt)) : '-'}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {asset.photoUrl && (
                          <Button
                            variant="ghost"
                            size="icon"
                            title="View Photo"
                            onClick={() => window.open(asset.photoUrl!, '_blank')}
                          >
                            <Image className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Edit"
                          onClick={() => handleEdit(asset)}
                        >
                          <Pencil className="h-4 w-4" />
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
                                Are you sure you want to delete this company asset? This action cannot be undone.
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
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center text-muted-foreground py-8">
            {searchTerm ? "No company assets match your search." : "No company assets found. Add some assets to get started."}
          </div>
        )}

        {/* Edit Dialog */}
        {!onEditAsset && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogContent className="max-w-3xl">
              <DialogHeader>
                <DialogTitle>Edit Company Asset</DialogTitle>
              </DialogHeader>
              {assetToEdit && (
                <CompanyAssetForm 
                  assetToEdit={assetToEdit} 
                  onSuccess={() => setIsDialogOpen(false)} 
                />
              )}
            </DialogContent>
          </Dialog>
        )}
      </CardContent>
    </Card>
  );
}