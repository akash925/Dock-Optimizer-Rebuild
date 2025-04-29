import React from 'react';
import { Link } from 'wouter';
import { Building2, MoreHorizontal, Check, X, Package, Users, CalendarDays } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

interface Organization {
  id: number;
  name: string;
  subdomain: string;
  status: string;
  createdAt: Date;
  userCount: number;
  moduleCount: number;
  logoUrl?: string | null;
  contactEmail?: string | null;
  primaryContact?: string | null;
}

export const OrganizationsList: React.FC = () => {
  const { data: organizations, isLoading, error } = useQuery<Organization[]>({
    queryKey: ['/api/admin/orgs'],
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const getStatusBadgeStyle = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-green-100 text-green-800 hover:bg-green-100';
      case 'INACTIVE':
        return 'bg-gray-100 text-gray-800 hover:bg-gray-100';
      case 'SUSPENDED':
        return 'bg-amber-100 text-amber-800 hover:bg-amber-100';
      case 'PENDING':
        return 'bg-blue-100 text-blue-800 hover:bg-blue-100';
      default:
        return 'bg-gray-100 text-gray-800 hover:bg-gray-100';
    }
  };

  const renderSkeleton = () => (
    <Card>
      <CardHeader>
        <Skeleton className="h-8 w-64 mb-2" />
        <Skeleton className="h-4 w-96" />
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {Array(5).fill(0).map((_, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-32" />
              </div>
              <Skeleton className="h-8 w-8 rounded-full" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );

  if (isLoading) {
    return renderSkeleton();
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Organizations</CardTitle>
          <CardDescription>Failed to load organizations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32 border rounded-md border-dashed">
            <div className="flex flex-col items-center text-center text-muted-foreground">
              <Building2 className="h-10 w-10 mb-2" />
              <p>Failed to load organizations. Please try again later.</p>
              <Button variant="outline" className="mt-4" onClick={() => window.location.reload()}>
                Refresh
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between">
        <div>
          <CardTitle>Organizations</CardTitle>
          <CardDescription>
            Manage all tenant organizations across the platform
          </CardDescription>
        </div>
        <Button asChild>
          <Link href="/admin/orgs/new">
            Add Organization
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        {organizations && organizations.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Organization</TableHead>
                <TableHead>Subdomain</TableHead>
                <TableHead className="hidden md:table-cell">Status</TableHead>
                <TableHead className="hidden md:table-cell">Users</TableHead>
                <TableHead className="hidden md:table-cell">Modules</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {organizations.map((org) => (
                <TableRow key={org.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center space-x-2">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border bg-muted text-muted-foreground">
                        {org.logoUrl ? (
                          <img src={org.logoUrl} alt={org.name} className="h-6 w-6" />
                        ) : (
                          <Building2 className="h-4 w-4" />
                        )}
                      </span>
                      <div className="space-y-1">
                        <p className="text-sm font-medium leading-none">{org.name}</p>
                        <p className="text-xs text-muted-foreground hidden sm:inline-block">
                          {org.contactEmail || 'No contact email'}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{org.subdomain}</TableCell>
                  <TableCell className="hidden md:table-cell">
                    <Badge variant="outline" className={getStatusBadgeStyle(org.status)}>
                      {org.status === 'ACTIVE' ? (
                        <Check className="mr-1 h-3 w-3" />
                      ) : org.status === 'INACTIVE' || org.status === 'SUSPENDED' ? (
                        <X className="mr-1 h-3 w-3" />
                      ) : null}
                      {org.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <div className="flex items-center">
                      <Users className="mr-1 h-3 w-3 text-muted-foreground" />
                      <span>{org.userCount}</span>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <div className="flex items-center">
                      <Package className="mr-1 h-3 w-3 text-muted-foreground" />
                      <span>{org.moduleCount}</span>
                    </div>
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
                        <DropdownMenuItem asChild>
                          <Link href={`/admin/orgs/${org.id}`}>
                            View Details
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href={`/admin/orgs/${org.id}/edit`}>
                            Edit Organization
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild>
                          <Link href={`/admin/orgs/${org.id}/users`}>
                            Manage Users
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href={`/admin/orgs/${org.id}/modules`}>
                            Configure Modules
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild>
                          <Link href={`/admin/orgs/${org.id}/access`}>
                            Access Control
                          </Link>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="flex items-center justify-center h-32 border rounded-md border-dashed">
            <div className="flex flex-col items-center text-center text-muted-foreground">
              <Building2 className="h-10 w-10 mb-2" />
              <p>No organizations found</p>
              <p className="text-sm">Create your first organization to get started</p>
              <Button variant="outline" className="mt-4" asChild>
                <Link href="/admin/orgs/new">
                  Create Organization
                </Link>
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};