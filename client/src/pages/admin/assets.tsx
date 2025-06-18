import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import AdminLayout from '@/components/layout/admin-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  Package, 
  Search, 
  MoreHorizontal, 
  Edit, 
  Trash2, 
  Eye,
  Download,
  Building2,
  Calendar,
  DollarSign
} from 'lucide-react';
import { CompanyAsset } from '@shared/schema';
import { useToast } from '@/hooks/use-toast';

// Asset status variants for styling
const getStatusVariant = (status: string) => {
  switch (status.toLowerCase()) {
    case 'active':
      return 'default';
    case 'inactive':
      return 'secondary';
    case 'maintenance':
      return 'destructive';
    case 'retired':
      return 'outline';
    default:
      return 'secondary';
  }
};

// Format currency helper
const formatCurrency = (value: string | null): string => {
  if (!value) return '-';
  try {
    const numValue = parseFloat(value);
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(numValue);
  } catch (e) {
    return value;
  }
};

// Format date helper
const formatDate = (date: string | null): string => {
  if (!date) return '-';
  try {
    return new Date(date).toLocaleDateString();
  } catch (e) {
    return '-';
  }
};

export default function AdminAssetsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch all company assets across organizations
  const { data: assets, isLoading, error } = useQuery({
    queryKey: ['/api/admin/assets'],
    queryFn: async () => {
      const response = await fetch('/api/admin/assets');
      if (!response.ok) {
        throw new Error('Failed to fetch assets');
      }
      return response.json();
    }
  });

  // Filter assets based on search term
  const filteredAssets = assets?.filter((asset: CompanyAsset) =>
    asset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    asset.manufacturer.toLowerCase().includes(searchTerm.toLowerCase()) ||
    asset.owner.toLowerCase().includes(searchTerm.toLowerCase()) ||
    asset.category.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  // Handle asset status update
  const handleStatusUpdate = async (assetId: number, newStatus: string) => {
    try {
      const response = await fetch(`/api/admin/assets/${assetId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        throw new Error('Failed to update asset status');
      }

      toast({
        title: 'Status Updated',
        description: `Asset status has been updated to ${newStatus}`,
      });

      // Refresh the data
      queryClient.invalidateQueries({ queryKey: ['/api/admin/assets'] });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update asset status',
        variant: 'destructive',
      });
    }
  };

  // Handle asset deletion
  const handleDeleteAsset = async (assetId: number) => {
    if (!confirm('Are you sure you want to delete this asset? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/assets/${assetId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete asset');
      }

      toast({
        title: 'Asset Deleted',
        description: 'The asset has been successfully deleted',
      });

      // Refresh the data
      queryClient.invalidateQueries({ queryKey: ['/api/admin/assets'] });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete asset',
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="p-6">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Loading assets...</p>
            </div>
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout>
        <div className="p-6">
          <Card>
            <CardContent className="text-center py-8">
              <Package className="h-12 w-12 mx-auto text-destructive mb-4" />
              <h3 className="text-lg font-semibold mb-2">Error Loading Assets</h3>
              <p className="text-muted-foreground">
                There was an error loading the assets. Please try refreshing the page.
              </p>
            </CardContent>
          </Card>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
              <Package className="h-6 w-6" />
              Asset Management
            </h2>
            <p className="text-muted-foreground">
              Manage company assets across all organizations
            </p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Package className="h-4 w-4" />
                Total Assets
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{assets?.length || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Badge className="h-4 w-4" />
                Active Assets
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {assets?.filter((a: CompanyAsset) => a.status && a.status.toLowerCase() === 'active').length || 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Total Value
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(
                  assets?.reduce((sum: number, asset: CompanyAsset) => {
                    const value = asset.assetValue ? parseFloat(asset.assetValue) : 0;
                    return sum + (isNaN(value) ? 0 : value);
                  }, 0).toString()
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Categories
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {new Set(assets?.map((a: CompanyAsset) => a.category)).size || 0}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Asset Search</CardTitle>
            <CardDescription>
              Search assets by name, manufacturer, owner, or category
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search assets..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Assets Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Assets ({filteredAssets.length})</CardTitle>
            <CardDescription>
              Comprehensive list of company assets across all organizations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Asset</TableHead>
                  <TableHead>Manufacturer</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Purchase Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAssets.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">
                        {searchTerm ? 'No assets found matching your search.' : 'No assets found.'}
                      </p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAssets.map((asset: CompanyAsset) => (
                    <TableRow key={asset.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{asset.name}</div>
                          {asset.serialNumber && (
                            <div className="text-sm text-muted-foreground">
                              S/N: {asset.serialNumber}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{asset.manufacturer}</TableCell>
                      <TableCell>{asset.owner}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {asset.category.replace('_', ' ').toLowerCase()}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusVariant(asset.status || 'inactive')} className="capitalize">
                          {asset.status ? asset.status.toLowerCase() : 'inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatCurrency(asset.assetValue)}</TableCell>
                      <TableCell>{formatDate(asset.purchaseDate)}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem>
                              <Eye className="w-4 h-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Edit className="w-4 h-4 mr-2" />
                              Edit Asset
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuLabel>Update Status</DropdownMenuLabel>
                            {['ACTIVE', 'INACTIVE', 'MAINTENANCE', 'RETIRED'].map((status) => (
                              <DropdownMenuItem 
                                key={status}
                                disabled={asset.status === status}
                                onClick={() => handleStatusUpdate(asset.id, status)}
                              >
                                <Badge variant={getStatusVariant(status)} className="mr-2 capitalize">
                                  {status.toLowerCase()}
                                </Badge>
                                {(asset.status || 'INACTIVE') === status ? 'Current' : 'Change to'}
                              </DropdownMenuItem>
                            ))}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              onClick={() => handleDeleteAsset(asset.id)}
                              className="text-red-600"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete Asset
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
} 