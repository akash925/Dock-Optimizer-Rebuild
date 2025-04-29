import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  MoreHorizontal, 
  Edit, 
  Trash, 
  Users, 
  Settings, 
  RefreshCw,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  ClockIcon,
  XCircle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// Define the tenant status types and their corresponding badges
const getTenantStatusBadge = (status: string | null) => {
  switch(status) {
    case 'ACTIVE':
      return <Badge className="bg-green-100 text-green-800 hover:bg-green-200"><CheckCircle2 className="h-3 w-3 mr-1" /> Active</Badge>;
    case 'SUSPENDED':
      return <Badge variant="destructive" className="bg-orange-100 text-orange-800 hover:bg-orange-200"><AlertCircle className="h-3 w-3 mr-1" /> Suspended</Badge>;
    case 'PENDING':
      return <Badge variant="outline" className="bg-blue-100 text-blue-800 hover:bg-blue-200"><ClockIcon className="h-3 w-3 mr-1" /> Pending</Badge>;
    case 'ARCHIVED':
      return <Badge variant="secondary" className="bg-gray-100 text-gray-800 hover:bg-gray-200"><XCircle className="h-3 w-3 mr-1" /> Archived</Badge>;
    default:
      return <Badge variant="outline">Unknown</Badge>;
  }
};

// Define the organization interface
interface Organization {
  id: number;
  name: string;
  subdomain: string;
  status: string | null;
  createdAt: Date;
  contactEmail: string | null;
  userCount?: number;
  moduleCount?: number;
}

export const OrganizationsList = () => {
  const { toast } = useToast();
  
  // Fetch organizations from the API
  const { data: orgs, isLoading, error, refetch } = useQuery<Organization[]>({
    queryKey: ['/api/admin/orgs'],
    retry: 1,
    refetchOnWindowFocus: false,
  });

  // Format date to a readable string
  const formatDate = (date: Date) => {
    if (!date) return '';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="text-xl">Organizations</CardTitle>
          <CardDescription>
            Manage all tenant organizations in the platform
          </CardDescription>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => refetch()}
          disabled={isLoading}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </CardHeader>
      <CardContent>
        {error ? (
          <div className="flex justify-center items-center p-6 text-red-500">
            <AlertCircle className="h-5 w-5 mr-2" />
            Failed to load organizations
          </div>
        ) : isLoading ? (
          <div className="flex justify-center items-center p-6">
            <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
            Loading organizations...
          </div>
        ) : orgs && orgs.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Organization</TableHead>
                <TableHead>Subdomain</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Users</TableHead>
                <TableHead>Modules</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orgs.map((org) => (
                <TableRow key={org.id}>
                  <TableCell className="font-medium">
                    <Link href={`/admin/orgs/${org.id}`} className="hover:underline flex items-center text-primary">
                      {org.name}
                      <ChevronRight className="ml-1 h-4 w-4" />
                    </Link>
                  </TableCell>
                  <TableCell>{org.subdomain}</TableCell>
                  <TableCell>{getTenantStatusBadge(org.status)}</TableCell>
                  <TableCell>{formatDate(org.createdAt)}</TableCell>
                  <TableCell>{org.userCount || 0}</TableCell>
                  <TableCell>{org.moduleCount || 0}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <span className="sr-only">Open menu</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>
                          <Link href={`/admin/orgs/${org.id}`} className="flex items-center">
                            <ChevronRight className="mr-2 h-4 w-4" />
                            View Details
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Link href={`/admin/orgs/${org.id}/edit`} className="flex items-center">
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Link href={`/admin/orgs/${org.id}/users`} className="flex items-center">
                            <Users className="mr-2 h-4 w-4" />
                            Manage Users
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Link href={`/admin/orgs/${org.id}/modules`} className="flex items-center">
                            <Settings className="mr-2 h-4 w-4" />
                            Configure Modules
                          </Link>
                        </DropdownMenuItem>
                        {org.status !== 'ARCHIVED' && (
                          <DropdownMenuItem className="text-red-600">
                            <Trash className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="flex justify-center items-center p-6 text-muted-foreground">
            No organizations found. Create your first organization.
          </div>
        )}
      </CardContent>
    </Card>
  );
};