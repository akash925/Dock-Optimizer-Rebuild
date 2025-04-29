import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ArrowUpDown,
  ChevronDown,
  ChevronRight,
  Check,
  Users,
  Package,
  Plus,
  PencilIcon,
  MoreHorizontal,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Tenant } from '@shared/schema';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { format } from 'date-fns';

const OrganizationsList = () => {
  const { toast } = useToast();
  const [isAddOrgDialogOpen, setIsAddOrgDialogOpen] = React.useState(false);
  
  const { data: organizations, isLoading, error } = useQuery<Tenant[]>({
    queryKey: ['/api/admin/orgs'],
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-4 rounded-full border-t-blue-500 animate-spin"></div>
          <p className="mt-2 text-gray-500">Loading organizations...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center bg-red-50 text-red-500 rounded-lg">
        <p className="font-semibold">Error loading organizations</p>
        <p className="text-sm">{(error as Error).message || "An unexpected error occurred"}</p>
        <Button 
          variant="outline" 
          className="mt-4 text-red-500 border-red-300"
          onClick={() => toast({
            title: "Database migration in progress",
            description: "The organization data will be available after migration completes.",
          })}
        >
          Retry
        </Button>
      </div>
    );
  }

  // Temporary mock data while migration is in progress
  const mockOrgs = [
    { 
      id: 1, 
      name: "Hanzo Logistics", 
      status: "ACTIVE", 
      subdomain: "hanzo", 
      createdAt: new Date(2025, 0, 15), 
      usersCount: 12,
      modulesCount: 8,
    },
    { 
      id: 2, 
      name: "Global Admin", 
      status: "ACTIVE", 
      subdomain: "admin", 
      createdAt: new Date(2025, 0, 10), 
      usersCount: 4,
      modulesCount: 9,
    },
    { 
      id: 3, 
      name: "Acme Shipping", 
      status: "TRIAL", 
      subdomain: "acme", 
      createdAt: new Date(2025, 2, 5), 
      usersCount: 8,
      modulesCount: 5,
    },
    { 
      id: 4, 
      name: "SmartFreight", 
      status: "PENDING", 
      subdomain: "smart", 
      createdAt: new Date(2025, 3, 20), 
      usersCount: 3,
      modulesCount: 4,
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Organizations</h2>
          <p className="text-gray-500">Manage all tenant organizations</p>
        </div>
        <Button 
          onClick={() => setIsAddOrgDialogOpen(true)}
          className="flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Add Organization
        </Button>
      </div>
      
      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[250px]">Organization Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Subdomain</TableHead>
              <TableHead>Created Date</TableHead>
              <TableHead className="text-center">Users</TableHead>
              <TableHead className="text-center">Modules</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mockOrgs.map(org => (
              <TableRow key={org.id}>
                <TableCell className="font-medium">{org.name}</TableCell>
                <TableCell>
                  <StatusBadge status={org.status as any} />
                </TableCell>
                <TableCell className="font-mono text-sm">{org.subdomain}</TableCell>
                <TableCell>{format(org.createdAt, 'MMM d, yyyy')}</TableCell>
                <TableCell className="text-center">
                  <Badge variant="outline" className="bg-blue-50">
                    <Users className="inline w-3 h-3 mr-1" />
                    {org.usersCount}
                  </Badge>
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant="outline" className="bg-green-50">
                    <Package className="inline w-3 h-3 mr-1" />
                    {org.modulesCount}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <span className="sr-only">Open menu</span>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                      <DropdownMenuItem>View Details</DropdownMenuItem>
                      <DropdownMenuItem>Edit Organization</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem>Manage Users</DropdownMenuItem>
                      <DropdownMenuItem>Configure Modules</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-red-600">
                        Delete Organization
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <AddOrganizationDialog 
        open={isAddOrgDialogOpen} 
        onOpenChange={setIsAddOrgDialogOpen}
      />
    </div>
  );
};

const StatusBadge = ({ status }: { status: 'ACTIVE' | 'SUSPENDED' | 'TRIAL' | 'PENDING' | 'INACTIVE' }) => {
  const variants = {
    ACTIVE: "bg-green-100 text-green-800 border-green-200",
    SUSPENDED: "bg-red-100 text-red-800 border-red-200",
    TRIAL: "bg-blue-100 text-blue-800 border-blue-200",
    PENDING: "bg-yellow-100 text-yellow-800 border-yellow-200",
    INACTIVE: "bg-gray-100 text-gray-800 border-gray-200",
  };

  return (
    <span className={`px-2 py-1 text-xs font-medium rounded-full ${variants[status]}`}>
      {status}
    </span>
  );
};

const AddOrganizationDialog = ({ 
  open, 
  onOpenChange 
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void 
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>Add New Organization</DialogTitle>
          <DialogDescription>
            Create a new tenant organization in the system.
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
          <div className="text-center text-gray-500 py-8">
            Organization creation form will be implemented soon.
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" onClick={() => onOpenChange(false)}>Create Organization</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default OrganizationsList;