import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { CompanyAsset, AssetCategory, AssetStatus, AssetLocation } from '@shared/schema';
import { useLocation } from 'wouter';
import { formatDate } from '@/lib/date-utils';
import React from 'react';

// Add type declaration for window.searchTimeout
declare global {
  interface Window {
    searchTimeout: number;
  }
}
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
  ArrowUpDown,
  Download,
  Filter,
  X,
  MoreHorizontal,
  Calendar,
  MapPin,
  Tag,
  DollarSign,
  Clock,
  Eye,
  Maximize2,
  ExternalLink,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CompanyAssetForm } from './company-asset-form';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

interface CompanyAssetListProps {
  onEditAsset?: (asset: CompanyAsset) => void;
}

interface FilterOptions {
  category: AssetCategory | null;
  location: AssetLocation | null;
  status: AssetStatus | null;
  tags: string[];
}

export function CompanyAssetList({ onEditAsset }: CompanyAssetListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAssetId, setSelectedAssetId] = useState<number | null>(null);
  const [assetToEdit, setAssetToEdit] = useState<CompanyAsset | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [sortBy, setSortBy] = useState<string>('name');
  const [filters, setFilters] = useState<FilterOptions>({
    category: null,
    location: null,
    status: null,
    tags: []
  });
  const itemsPerPage = 10;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();

  // Search and filter states
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  
  // Manual debouncing for search
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500);
    
    return () => clearTimeout(timer);
  }, [searchTerm]);
  
  // Build query params for API request
  const buildQueryParams = () => {
    const params = new URLSearchParams();
    
    // Add search term if exists
    if (debouncedSearchTerm) {
      params.append('q', debouncedSearchTerm);
    }
    
    // Add category filter if selected - ensure it's not 'all' or empty string
    if (filters.category && filters.category !== 'all' && filters.category !== '') {
      params.append('category', filters.category);
      console.log("Adding category filter:", filters.category);
    }
    
    // Add location filter if selected - ensure it's not 'all' or empty string
    if (filters.location && filters.location !== 'all' && filters.location !== '') {
      params.append('location', filters.location);
      console.log("Adding location filter:", filters.location);
    }
    
    // Add status filter if selected - ensure it's not 'all' or empty string
    if (filters.status && filters.status !== 'all' && filters.status !== '') {
      params.append('status', filters.status);
      console.log("Adding status filter:", filters.status);
    }
    
    // Add tags filter if selected
    if (filters.tags.length > 0) {
      params.append('tags', filters.tags.join(','));
      console.log("Adding tags filter:", filters.tags.join(','));
    }
    
    // Add sort parameter if selected
    if (sortBy) {
      params.append('sort', sortBy);
      console.log("Adding sort parameter:", sortBy);
    }
    
    const queryString = params.toString();
    console.log("Query params:", queryString);
    return queryString;
  };
  
  // Get the query string
  const queryString = buildQueryParams();
  
  // Fetch company assets with filters
  const { data: assets, isLoading, error, refetch } = useQuery<CompanyAsset[]>({
    queryKey: ['/api/company-assets/company-assets', queryString],
    queryFn: async () => {
      const endpoint = `/api/company-assets/company-assets${queryString ? `?${queryString}` : ''}`;
      const response = await apiRequest('GET', endpoint);
      if (!response.ok) {
        throw new Error('Error fetching assets');
      }
      return response.json();
    },
    placeholderData: [],
  });
  
  // Refetch when debounced search term, filters, or sort options change
  useEffect(() => {
    refetch();
  }, [debouncedSearchTerm, filters.category, filters.location, filters.status, filters.tags, sortBy, refetch]);

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest('DELETE', `/api/company-assets/company-assets/${id}`);
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
      
      // Invalidate query to refresh the list with current search parameters
      // Build query key that includes current search/filter context
      let queryKey = ['/api/company-assets/company-assets'];
      // Add the current search term and filters to maintain context
      if (debouncedSearchTerm || Object.values(filters).some(val => val !== null && (Array.isArray(val) ? val.length > 0 : true))) {
        queryKey.push('filtered');
      }
      
      queryClient.invalidateQueries({ 
        queryKey,
        exact: false
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Deletion failed',
        description: error.message,
        variant: 'destructive',
      });
    }
  });
  
  // Status update mutation
  const statusUpdateMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number, status: AssetStatus }) => {
      const response = await apiRequest('PATCH', `/api/company-assets/company-assets/${id}/status`, { status });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update asset status');
      }
      return { id, status };
    },
    onSuccess: ({ status }) => {
      toast({
        title: 'Status updated',
        description: `Asset status has been updated to ${status}`,
      });
      
      // Invalidate query to refresh the list with current search parameters
      // Build query key that includes current search/filter context
      let queryKey = ['/api/company-assets/company-assets'];
      // Add the current search term and filters to maintain context
      if (debouncedSearchTerm || Object.values(filters).some(val => val !== null && (Array.isArray(val) ? val.length > 0 : true))) {
        queryKey.push('filtered');
      }
      
      queryClient.invalidateQueries({ 
        queryKey,
        exact: false
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Status update failed',
        description: error.message,
        variant: 'destructive',
      });
    }
  });

  // Server-side filtering and pagination
  // Let's assume the API doesn't handle pagination yet, so we'll do it on the client side
  
  // Pagination
  const totalPages = Math.ceil((assets?.length || 0) / itemsPerPage);
  const paginatedAssets = assets?.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
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
  
  // Get badge variant based on asset status
  const getStatusVariant = (status: AssetStatus): "default" | "outline" | "destructive" | "secondary" => {
    switch (status) {
      case AssetStatus.ACTIVE:
        return "default"; // green
      case AssetStatus.MAINTENANCE:
        return "secondary"; // yellow/orange
      case AssetStatus.RETIRED:
        return "destructive"; // red
      case AssetStatus.INACTIVE:
      case AssetStatus.LOST:
      default:
        return "outline"; // gray
    }
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
  
  // Handle status update
  const handleStatusUpdate = (id: number, status: AssetStatus) => {
    statusUpdateMutation.mutate({ id, status });
  };
  
  // Navigate to full edit page
  const navigateToFullEditPage = (asset: CompanyAsset) => {
    navigate(`/company-assets/assets/${asset.id}/edit`);
  };

  // Format currency
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

  // Format tags
  const formatTags = (tags: string | null | unknown): string[] => {
    if (!tags) return [];
    
    if (typeof tags === 'string') {
      try {
        return JSON.parse(tags);
      } catch (e) {
        return [];
      }
    }
    
    return [];
  };

  // Clear all filters
  const clearFilters = () => {
    setFilters({
      category: null,
      location: null,
      status: null,
      tags: []
    });
    setSearchTerm('');
    setDebouncedSearchTerm(''); // Also clear the debounced search term to trigger a refetch
  };

  // Get all available tags from assets
  const getAllTags = (): string[] => {
    const allTags = new Set<string>();
    assets?.forEach(asset => {
      if (asset.tags) {
        try {
          // Only parse if it's a string
          const tagList = typeof asset.tags === 'string' ? JSON.parse(asset.tags) : asset.tags;
          if (Array.isArray(tagList)) {
            tagList.forEach(tag => {
              if (typeof tag === 'string') {
                allTags.add(tag);
              }
            });
          }
        } catch (e) {
          // Ignore parsing errors
        }
      }
    });
    return Array.from(allTags);
  };

  // Handle page change
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  // ENHANCED: Full-screen image viewer state
  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const [currentImageUrl, setCurrentImageUrl] = useState<string>('');
  const [currentImageAlt, setCurrentImageAlt] = useState<string>('');

  // ENHANCED: Full-screen image viewer handler
  const openImageViewer = (imageUrl: string, assetName: string) => {
    setCurrentImageUrl(imageUrl);
    setCurrentImageAlt(assetName);
    setImageViewerOpen(true);
  };

  const closeImageViewer = () => {
    setImageViewerOpen(false);
    setCurrentImageUrl('');
    setCurrentImageAlt('');
  };

  // ENHANCED: Fixed image viewing function
  const viewAssetImage = (asset: CompanyAsset) => {
    if (!asset.photoUrl) {
      toast({
        title: 'No image available',
        description: 'This asset does not have an image.',
        variant: 'destructive',
      });
      return;
    }

    // Check if the URL is accessible
    const img = new Image();
    img.onload = () => {
      openImageViewer(asset.photoUrl!, asset.name);
    };
    img.onerror = () => {
      toast({
        title: 'Image not found',
        description: 'The image file could not be loaded. It may have been moved or deleted.',
        variant: 'destructive',
      });
    };
    img.src = asset.photoUrl!;
  };

  // ENHANCED: Download image function
  const downloadAssetImage = async (asset: CompanyAsset) => {
    if (!asset.photoUrl) {
      toast({
        title: 'No image available',
        description: 'This asset does not have an image to download.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const response = await fetch(asset.photoUrl);
      if (!response.ok) throw new Error('Failed to download image');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${asset.name}_image.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast({
        title: 'Download started',
        description: 'The asset image has been downloaded.',
      });
    } catch (error) {
      toast({
        title: 'Download failed',
        description: 'Failed to download the asset image.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Card className="shadow-sm border-0 w-full">
      <CardContent className="p-4 sm:p-6 w-full">
        <div className="flex flex-col space-y-4 mb-4 w-full">
          {/* Search and filter row */}
          <div className="flex items-center justify-between w-full">
            <div className="relative w-full max-w-md">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, manufacturer, owner, serial number..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2">
              {/* Sort Dropdown */}
              <Select 
                value={sortBy || 'name'} 
                onValueChange={(value) => setSortBy(value)}
              >
                <SelectTrigger className="w-[180px]">
                  <span className="flex items-center gap-2">
                    <ArrowUpDown className="h-4 w-4" />
                    <span>Sort By</span>
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Name</SelectItem>
                  <SelectItem value="category">Category</SelectItem>
                  <SelectItem value="status">Status</SelectItem>
                  <SelectItem value="location">Location</SelectItem>
                  <SelectItem value="updated_at">Recently Updated</SelectItem>
                  <SelectItem value="purchase_date">Purchase Date</SelectItem>
                </SelectContent>
              </Select>

              <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <Filter className="h-4 w-4" />
                    Filters
                    {(filters.category || filters.location || filters.status || filters.tags.length > 0) && (
                      <Badge variant="secondary" className="ml-1 rounded-full px-1 py-0.5">
                        {Object.values(filters).filter(v => v !== null && (Array.isArray(v) ? v.length > 0 : true)).length}
                      </Badge>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-0" align="end">
                  <div className="p-4 border-b">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">Filters</h4>
                      {(filters.category || filters.location || filters.status || filters.tags.length > 0) && (
                        <Button variant="ghost" size="sm" onClick={clearFilters} className="h-auto p-0 text-muted-foreground">
                          Clear all
                          <X className="ml-2 h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="p-4 space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Category</label>
                      <Select 
                        value={filters.category || "all"} 
                        onValueChange={(value) => {
                          console.log("Category changed to:", value);
                          setFilters({...filters, category: value === "all" ? null : value as AssetCategory});
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="All categories" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All categories</SelectItem>
                          {Object.values(AssetCategory).map(category => (
                            <SelectItem key={category} value={category}>{formatCategory(category)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Location</label>
                      <Select 
                        value={filters.location || "all"} 
                        onValueChange={(value) => {
                          console.log("Location changed to:", value);
                          setFilters({...filters, location: value === "all" ? null : value as AssetLocation});
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="All locations" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All locations</SelectItem>
                          {Object.values(AssetLocation).map(location => (
                            <SelectItem key={location} value={location}>{location}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Status</label>
                      <Select 
                        value={filters.status || "all"} 
                        onValueChange={(value) => {
                          console.log("Status changed to:", value);
                          setFilters({...filters, status: value === "all" ? null : value as AssetStatus});
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="All statuses" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All statuses</SelectItem>
                          {Object.values(AssetStatus).map(status => (
                            <SelectItem key={status} value={status}>{status}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Tags</label>
                      <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto p-2 border rounded-md">
                        {getAllTags().map(tag => (
                          <Badge 
                            key={tag}
                            variant={filters.tags.includes(tag) ? "default" : "outline"}
                            className="cursor-pointer"
                            onClick={() => {
                              if (filters.tags.includes(tag)) {
                                setFilters({...filters, tags: filters.tags.filter(t => t !== tag)});
                              } else {
                                setFilters({...filters, tags: [...filters.tags, tag]});
                              }
                            }}
                          >
                            {tag}
                          </Badge>
                        ))}
                        {getAllTags().length === 0 && (
                          <span className="text-sm text-muted-foreground">No tags found</span>
                        )}
                      </div>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>

        {/* Active filters display */}
        {(filters.category || filters.location || filters.status || filters.tags.length > 0) && (
          <div className="flex flex-wrap gap-2 mb-4">
            {filters.category && (
              <Badge variant="secondary" className="flex items-center gap-1">
                Category: {formatCategory(filters.category)}
                <X 
                  className="h-3 w-3 cursor-pointer" 
                  onClick={() => setFilters({...filters, category: null})}
                />
              </Badge>
            )}
            {filters.location && (
              <Badge variant="secondary" className="flex items-center gap-1">
                Location: {filters.location}
                <X 
                  className="h-3 w-3 cursor-pointer" 
                  onClick={() => setFilters({...filters, location: null})}
                />
              </Badge>
            )}
            {filters.status && (
              <Badge variant="secondary" className="flex items-center gap-1">
                Status: {filters.status}
                <X 
                  className="h-3 w-3 cursor-pointer" 
                  onClick={() => setFilters({...filters, status: null})}
                />
              </Badge>
            )}
            {filters.tags.map(tag => (
              <Badge key={tag} variant="secondary" className="flex items-center gap-1">
                Tag: {tag}
                <X 
                  className="h-3 w-3 cursor-pointer" 
                  onClick={() => setFilters({...filters, tags: filters.tags.filter(t => t !== tag)})}
                />
              </Badge>
            ))}
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : error ? (
          <div className="text-center text-red-500 py-8">
            Failed to load company assets. Please try again.
          </div>
        ) : assets && assets.length > 0 ? (
          <>
            <div className="w-full rounded-md border">
              {/* Responsive table with horizontal scroll */}
              <div className="w-full overflow-x-auto">
                <Table className="w-full border-collapse">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10 p-2"></TableHead>
                      <TableHead className="whitespace-nowrap p-2">Asset Name</TableHead>
                      <TableHead className="whitespace-nowrap p-2">Category</TableHead>
                      <TableHead className="whitespace-nowrap p-2">Manufacturer</TableHead>
                      <TableHead className="whitespace-nowrap p-2">Status</TableHead>
                      <TableHead className="whitespace-nowrap p-2">Location</TableHead>
                      <TableHead className="whitespace-nowrap p-2">Serial/Barcode</TableHead>
                      {/* Hide less important columns on smaller screens */}
                      <TableHead className="hidden lg:table-cell whitespace-nowrap p-2">Owner</TableHead>
                      <TableHead className="hidden lg:table-cell whitespace-nowrap p-2">Department</TableHead>
                      <TableHead className="hidden md:table-cell whitespace-nowrap p-2">Purchase Price</TableHead>
                      <TableHead className="hidden md:table-cell whitespace-nowrap p-2">Purchase Date</TableHead>
                      <TableHead className="hidden xl:table-cell whitespace-nowrap p-2">Implementation Date</TableHead>
                      <TableHead className="hidden xl:table-cell whitespace-nowrap p-2">Next Maintenance</TableHead>
                      <TableHead className="hidden lg:table-cell whitespace-nowrap p-2">Tags</TableHead>
                      <TableHead className="text-right whitespace-nowrap p-2">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                <TableBody>
                  {paginatedAssets?.map((asset) => (
                    <TableRow 
                      key={asset.id} 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigateToFullEditPage(asset)}
                    >
                      <TableCell className="pl-4" onClick={(e) => e.stopPropagation()}>{getCategoryIcon(asset.category)}</TableCell>
                      <TableCell className="font-medium whitespace-nowrap">{asset.name}</TableCell>
                      <TableCell className="whitespace-nowrap">{formatCategory(asset.category)}</TableCell>
                      <TableCell className="whitespace-nowrap">{asset.manufacturer || '-'}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {asset.status ? (
                          <Badge variant={getStatusVariant(asset.status)} className="capitalize">
                            {asset.status}
                          </Badge>
                        ) : '-'}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{asset.location || '-'}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {asset.serialNumber && <div className="text-xs">{asset.serialNumber}</div>}
                        {asset.barcode && <div className="text-xs text-muted-foreground">{asset.barcode}</div>}
                        {!asset.serialNumber && !asset.barcode && '-'}
                      </TableCell>
                      {/* Hidden on smaller screens */}
                      <TableCell className="hidden lg:table-cell whitespace-nowrap">{asset.owner || '-'}</TableCell>
                      <TableCell className="hidden lg:table-cell whitespace-nowrap">{asset.department || '-'}</TableCell>
                      <TableCell className="hidden md:table-cell whitespace-nowrap">{formatCurrency(asset.purchasePrice)}</TableCell>
                      <TableCell className="hidden md:table-cell whitespace-nowrap">{asset.purchaseDate ? formatDate(new Date(asset.purchaseDate)) : '-'}</TableCell>
                      <TableCell className="hidden xl:table-cell whitespace-nowrap">{asset.implementationDate ? formatDate(new Date(asset.implementationDate)) : '-'}</TableCell>
                      <TableCell className="hidden xl:table-cell whitespace-nowrap">
                        {asset.nextMaintenanceDate ? (
                          <div className="flex items-center">
                            <Calendar className="h-3 w-3 mr-1 text-muted-foreground" />
                            {formatDate(new Date(asset.nextMaintenanceDate))}
                          </div>
                        ) : '-'}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell whitespace-nowrap">
                        <div className="flex flex-wrap gap-1 max-w-[150px]">
                          {formatTags(asset.tags).map((tag, i) => (
                            <Badge key={i} variant="outline" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                          {(!asset.tags || formatTags(asset.tags).length === 0) && '-'}
                        </div>
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuGroup>
                              <DropdownMenuItem onClick={() => navigateToFullEditPage(asset)}>
                                <Pencil className="w-4 h-4 mr-2" />
                                Edit Asset
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuLabel>Update Status</DropdownMenuLabel>
                              {Object.values(AssetStatus).map((status) => (
                                <DropdownMenuItem 
                                  key={status}
                                  disabled={asset.status === status}
                                  onClick={() => handleStatusUpdate(asset.id, status)}
                                >
                                  <Badge variant={getStatusVariant(status)} className="mr-2 capitalize">
                                    {status}
                                  </Badge>
                                  {asset.status === status ? 'Current' : 'Change to'}
                                </DropdownMenuItem>
                              ))}
                              <DropdownMenuSeparator />
                              {asset.photoUrl && (
                                <>
                                  <DropdownMenuItem onClick={() => viewAssetImage(asset)}>
                                    <Eye className="w-4 h-4 mr-2" />
                                    View Full Image
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => openImageViewer(asset.photoUrl!, asset.name)}>
                                    <Maximize2 className="w-4 h-4 mr-2" />
                                    Full Screen View
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => downloadAssetImage(asset)}>
                                    <Download className="w-4 h-4 mr-2" />
                                    Download Image
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => window.open(asset.photoUrl!, '_blank')}>
                                    <ExternalLink className="w-4 h-4 mr-2" />
                                    Open in New Tab
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                </>
                              )}
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-red-600">
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Delete
                                  </DropdownMenuItem>
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
                                      onClick={() => handleDelete(asset.id)}
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
                            </DropdownMenuGroup>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            </div>
            
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center my-6">
                <Pagination>
                  <PaginationContent className="flex items-center gap-1">
                    <PaginationItem>
                      <PaginationPrevious 
                        href="#" 
                        onClick={(e) => {
                          e.preventDefault();
                          if (currentPage > 1) handlePageChange(currentPage - 1);
                        }}
                        className={`rounded-md ${currentPage === 1 ? 'pointer-events-none opacity-50' : 'hover:bg-secondary'}`}
                      />
                    </PaginationItem>
                    
                    {/* Pages are generated in the next section */}
                    {(() => {
                      // Generate page range with proper logic
                      const visiblePages: number[] = [];
                      
                      // Always include current page and 1 page before/after (if they exist)
                      for (let i = Math.max(1, currentPage - 1); i <= Math.min(totalPages, currentPage + 1); i++) {
                        visiblePages.push(i);
                      }
                      
                      // Always include page 1 if not already included
                      if (!visiblePages.includes(1)) {
                        visiblePages.unshift(1);
                      }
                      
                      // Always include last page if not already included
                      if (!visiblePages.includes(totalPages) && totalPages > 1) {
                        visiblePages.push(totalPages);
                      }
                      
                      // Create the final pagination with ellipsis if needed
                      const result: React.ReactNode[] = [];
                      let prevPage: number | null = null;
                      
                      for (const page of visiblePages) {
                        // Add ellipsis if there's a gap
                        if (prevPage !== null && page - prevPage > 1) {
                          result.push(
                            <PaginationItem key={`ellipsis-${prevPage}`}>
                              <span className="flex h-9 w-9 items-center justify-center text-sm">...</span>
                            </PaginationItem>
                          );
                        }
                        
                        // Add the page number
                        result.push(
                          <PaginationItem key={page}>
                            <PaginationLink 
                              href="#" 
                              onClick={(e) => {
                                e.preventDefault();
                                handlePageChange(page);
                              }}
                              isActive={page === currentPage}
                              className="rounded-md hover:bg-secondary"
                            >
                              {page}
                            </PaginationLink>
                          </PaginationItem>
                        );
                        
                        prevPage = page;
                      }
                      
                      return result;
                    })()}
                    {/* Pages are generated in the previous section */}
                    
                    <PaginationItem>
                      <PaginationNext 
                        href="#" 
                        onClick={(e) => {
                          e.preventDefault();
                          if (currentPage < totalPages) handlePageChange(currentPage + 1);
                        }}
                        className={`rounded-md ${currentPage === totalPages ? 'pointer-events-none opacity-50' : 'hover:bg-secondary'}`}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </>
        ) : (
          <div className="text-center text-muted-foreground py-8">
            {searchTerm || filters.category || filters.location || filters.status || filters.tags.length > 0 ? 
              "No company assets match your search or filters." : 
              "No company assets found. Add some assets to get started."}
          </div>
        )}

        {/* Edit Dialog */}
        {!onEditAsset && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Edit Company Asset</DialogTitle>
              </DialogHeader>
              {assetToEdit && (
                <CompanyAssetForm 
                  assetToEdit={assetToEdit} 
                  onSuccess={() => {
                    setIsDialogOpen(false);
                    
                    // Build query key that includes current search/filter context
                    let queryKey = ['/api/company-assets/company-assets'];
                    // Add the current search term and filters to maintain context
                    if (debouncedSearchTerm || Object.values(filters).some(val => val !== null && (Array.isArray(val) ? val.length > 0 : true))) {
                      queryKey.push('filtered');
                    }
                    
                    queryClient.invalidateQueries({ 
                      queryKey,
                      exact: false 
                    });
                    toast({
                      title: 'Asset updated',
                      description: 'Company asset has been updated successfully.',
                    });
                  }} 
                />
              )}
            </DialogContent>
          </Dialog>
        )}

        {/* ENHANCED: Full-Screen Image Viewer Modal */}
        <Dialog open={imageViewerOpen} onOpenChange={setImageViewerOpen}>
          <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 bg-black/95 border-0">
            <div className="relative w-full h-full flex items-center justify-center">
              {/* Close button */}
              <button
                onClick={closeImageViewer}
                className="absolute top-4 right-4 z-50 p-2 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
              
              {/* Download button */}
              <button
                onClick={() => downloadAssetImage({ photoUrl: currentImageUrl, name: currentImageAlt } as CompanyAsset)}
                className="absolute top-4 right-16 z-50 p-2 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
              >
                <Download className="w-6 h-6" />
              </button>
              
              {/* Open in new tab button */}
              <button
                onClick={() => window.open(currentImageUrl, '_blank')}
                className="absolute top-4 right-28 z-50 p-2 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
              >
                <ExternalLink className="w-6 h-6" />
              </button>
              
              {/* Image */}
              <div className="w-full h-full flex items-center justify-center p-8">
                <img 
                  src={currentImageUrl} 
                  alt={currentImageAlt}
                  className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                  style={{ maxWidth: '100%', maxHeight: '100%' }}
                />
              </div>
              
              {/* Image title overlay */}
              <div className="absolute bottom-4 left-4 right-4 z-50">
                <div className="bg-black/50 backdrop-blur-sm rounded-lg p-3 text-white">
                  <h3 className="text-lg font-semibold">{currentImageAlt}</h3>
                  <p className="text-sm text-gray-300">Asset Image</p>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}