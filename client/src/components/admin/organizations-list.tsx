import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { 
  Edit, 
  Trash2, 
  Plus, 
  Search,
  Loader2
} from 'lucide-react';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { TenantStatus } from '@shared/schema';
import { Badge } from '@/components/ui/badge';

interface Organization {
  id: number;
  name: string;
  subdomain: string;
  status: TenantStatus | null;
  createdAt: Date;
  contactEmail: string | null;
  userCount?: number;
  moduleCount?: number;
}

export const OrganizationsList = () => {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgSubdomain, setNewOrgSubdomain] = useState('');
  const pageSize = 10;

  // Fetch organizations
  const { 
    data: organizations = [], 
    isLoading, 
    isError,
    refetch 
  } = useQuery<Organization[]>({
    queryKey: ['/api/admin/orgs'],
    // Mock data for initial development
    queryFn: async () => {
      // Attempt to fetch real data
      try {
        const response = await fetch('/api/admin/orgs');
        if (!response.ok) {
          throw new Error(`Error fetching organizations: ${response.statusText}`);
        }
        return await response.json();
      } catch (error) {
        console.error('Failed to fetch organizations:', error);
        // Return empty array on failure
        return [];
      }
    }
  });

  // Create new organization mutation
  const createOrgMutation = useMutation({
    mutationFn: async (newOrg: { name: string; subdomain: string }) => {
      const response = await fetch('/api/admin/orgs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newOrg),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to create organization');
      }
      
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Organization created',
        description: 'The organization was created successfully.',
      });
      setIsCreateDialogOpen(false);
      setNewOrgName('');
      setNewOrgSubdomain('');
      refetch();
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to create organization',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Filter organizations by search term
  const filteredOrganizations = organizations.filter((org) => 
    org.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    org.subdomain.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (org.contactEmail && org.contactEmail.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Paginate organizations
  const paginatedOrganizations = filteredOrganizations.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  // Total pages
  const totalPages = Math.ceil(filteredOrganizations.length / pageSize);

  // Handle create organization
  const handleCreateOrg = (e: React.FormEvent) => {
    e.preventDefault();
    createOrgMutation.mutate({
      name: newOrgName,
      subdomain: newOrgSubdomain,
    });
  };

  // Navigate to organization detail
  const navigateToOrgDetail = (orgId: number) => {
    setLocation(`/admin/orgs/${orgId}`);
  };

  // Status badge color mapping
  const getStatusColor = (status: TenantStatus | null): string => {
    if (!status) return 'secondary';
    
    switch (status) {
      case TenantStatus.ACTIVE:
        return 'success';
      case TenantStatus.SUSPENDED:
        return 'destructive';
      case TenantStatus.PENDING:
        return 'warning';
      default:
        return 'secondary';
    }
  };

  // Format date
  const formatDate = (date: Date) => {
    if (!date) return 'N/A';
    
    try {
      return new Date(date).toLocaleDateString();
    } catch (error) {
      return 'Invalid date';
    }
  };

  // Generate pagination items
  const renderPaginationItems = () => {
    const items = [];
    const maxVisiblePages = 5;
    
    // Previous button
    items.push(
      <PaginationItem key="prev">
        <PaginationPrevious 
          onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
          className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
        />
      </PaginationItem>
    );
    
    // First page
    if (currentPage > maxVisiblePages - 2) {
      items.push(
        <PaginationItem key={1}>
          <PaginationLink 
            onClick={() => setCurrentPage(1)}
            isActive={currentPage === 1}
          >
            1
          </PaginationLink>
        </PaginationItem>
      );
      
      // Add ellipsis if there's a gap
      if (currentPage > maxVisiblePages - 1) {
        items.push(
          <PaginationItem key="ellipsis1">
            <PaginationEllipsis />
          </PaginationItem>
        );
      }
    }
    
    // Calculate range of visible page numbers
    let startPage = Math.max(1, currentPage - Math.floor((maxVisiblePages - 2) / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 3);
    
    if (endPage - startPage < maxVisiblePages - 3) {
      startPage = Math.max(1, endPage - (maxVisiblePages - 3));
    }
    
    // Add visible page numbers
    for (let i = startPage; i <= endPage; i++) {
      if (i <= 0) continue; // Skip non-positive page numbers
      items.push(
        <PaginationItem key={i}>
          <PaginationLink 
            onClick={() => setCurrentPage(i)}
            isActive={currentPage === i}
          >
            {i}
          </PaginationLink>
        </PaginationItem>
      );
    }
    
    // Add ellipsis if there's a gap before the last page
    if (endPage < totalPages - 1) {
      items.push(
        <PaginationItem key="ellipsis2">
          <PaginationEllipsis />
        </PaginationItem>
      );
    }
    
    // Last page
    if (endPage < totalPages) {
      items.push(
        <PaginationItem key={totalPages}>
          <PaginationLink 
            onClick={() => setCurrentPage(totalPages)}
            isActive={currentPage === totalPages}
          >
            {totalPages}
          </PaginationLink>
        </PaginationItem>
      );
    }
    
    // Next button
    items.push(
      <PaginationItem key="next">
        <PaginationNext 
          onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
          className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
        />
      </PaginationItem>
    );
    
    return items;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Organizations</h2>
        <Button onClick={() => setIsCreateDialogOpen(true)} className="gap-1">
          <Plus className="w-4 h-4" />
          Add Organization
        </Button>
      </div>
      
      <div className="relative flex items-center mb-6">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search organizations..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>
      
      {isLoading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-6 h-6 mr-2 animate-spin" />
          <span>Loading organizations...</span>
        </div>
      ) : isError ? (
        <div className="p-6 text-center text-destructive">
          <p>Failed to load organizations. Please try again later.</p>
        </div>
      ) : paginatedOrganizations.length > 0 ? (
        <>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px]">Name</TableHead>
                  <TableHead className="w-[150px]">Subdomain</TableHead>
                  <TableHead className="w-[120px]">Status</TableHead>
                  <TableHead className="w-[100px]">Created</TableHead>
                  <TableHead className="w-[100px]">Users</TableHead>
                  <TableHead className="w-[100px]">Modules</TableHead>
                  <TableHead className="w-[100px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedOrganizations.map((org) => (
                  <TableRow key={org.id}>
                    <TableCell className="font-medium">{org.name}</TableCell>
                    <TableCell>{org.subdomain}</TableCell>
                    <TableCell>
                      <Badge variant={getStatusColor(org.status) as any}>
                        {org.status || 'Unknown'}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDate(org.createdAt)}</TableCell>
                    <TableCell>{org.userCount || 0}</TableCell>
                    <TableCell>{org.moduleCount || 0}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => navigateToOrgDetail(org.id)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          
          {totalPages > 1 && (
            <Pagination className="mt-4">
              <PaginationContent>
                {renderPaginationItems()}
              </PaginationContent>
            </Pagination>
          )}
        </>
      ) : (
        <div className="p-6 text-center text-muted-foreground border rounded-md">
          {searchTerm ? (
            <p>No organizations found matching "{searchTerm}".</p>
          ) : (
            <p>No organizations available. Create your first organization.</p>
          )}
        </div>
      )}
      
      {/* Create Organization Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Organization</DialogTitle>
            <DialogDescription>
              Add a new organization to the system. Organizations are separate tenants with their own users and settings.
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleCreateOrg} className="space-y-4 mt-4">
            <div>
              <Label htmlFor="orgName">Organization Name</Label>
              <Input
                id="orgName"
                value={newOrgName}
                onChange={(e) => setNewOrgName(e.target.value)}
                placeholder="Enter organization name"
                required
              />
            </div>
            
            <div>
              <Label htmlFor="orgSubdomain">Subdomain</Label>
              <Input
                id="orgSubdomain"
                value={newOrgSubdomain}
                onChange={(e) => setNewOrgSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                placeholder="organization-subdomain"
                pattern="[a-z0-9-]+"
                required
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Only lowercase letters, numbers, and hyphens. No spaces.
              </p>
            </div>
            
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createOrgMutation.isPending}
              >
                {createOrgMutation.isPending && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                Create Organization
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};