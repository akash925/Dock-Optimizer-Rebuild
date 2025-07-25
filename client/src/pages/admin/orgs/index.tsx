import React from 'react';
import { Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { 
  ArrowLeft, 
  Building2, 
  Plus, 
  Search,
  Filter,
  MoreHorizontal,
  Check,
  X,
  Users,
  Package,
  Edit,
  Trash2
} from 'lucide-react';
import { AdminHeader } from '@/components/admin/admin-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';

// Types
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

export default function OrganizationsListPage() {
  const { 
    data: organizations, 
    isLoading, 
    error 
  } = useQuery<Organization[]>({
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
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="flex gap-4 mb-4">
        <Skeleton className="h-10 flex-1" />
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="border rounded-md">
        <div className="border-b h-12 px-4 flex items-center">
          <Skeleton className="h-5 w-full" />
        </div>
        {Array(5).fill(0).map((_, i) => (
          <div key={i} className="h-16 px-4 flex items-center border-b last:border-0">
            <Skeleton className="h-5 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-muted/30">
        <AdminHeader />
        <main className="container py-6">
          <div className="flex items-center space-x-4 mb-6">
            <Button variant="outline" size="sm" asChild>
              <Link href="/admin">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Link>
            </Button>
            <h1 className="text-3xl font-bold tracking-tight">Organizations</h1>
          </div>
          {renderSkeleton()}
        </main>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="min-h-screen bg-muted/30">
        <AdminHeader />
        <main className="container py-6">
          <div className="flex items-center space-x-4 mb-6">
            <Button variant="outline" size="sm" asChild>
              <Link href="/admin">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Link>
            </Button>
            <h1 className="text-3xl font-bold tracking-tight">Organizations</h1>
          </div>
          
          <Card>
            <CardHeader>
              <CardTitle>Error</CardTitle>
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
        </main>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-muted/30">
      <AdminHeader />
      <main className="container py-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <Button variant="outline" size="sm" asChild>
              <Link href="/admin">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Link>
            </Button>
            <h1 className="text-3xl font-bold tracking-tight">Organizations</h1>
          </div>
          <Button asChild>
            <Link href="/admin/orgs/new">
              <Plus className="mr-2 h-4 w-4" />
              Add Organization
            </Link>
          </Button>
        </div>
        
        <div className="flex gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search organizations..."
              className="pl-8"
            />
          </div>
          <Button variant="outline" size="icon">
            <Filter className="h-4 w-4" />
          </Button>
        </div>
        
        <Card>
          <CardContent className="p-0">
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
                  {organizations.map((org: any) => <TableRow key={org.id}>
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
                          <p className="text-sm font-medium leading-none">
                            <Link href={`/admin/orgs/${org.id}`}>
                              {org.name}
                            </Link>
                          </p>
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
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/admin/orgs/${org.id}`}>
                              <Building2 className="mr-2 h-4 w-4" />
                              View Details
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href={`/admin/orgs/${org.id}/edit`}>
                              <Edit className="mr-2 h-4 w-4" />
                              Edit
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem asChild>
                            <Link href={`/admin/orgs/${org.id}/users`}>
                              <Users className="mr-2 h-4 w-4" />
                              Manage Users
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href={`/admin/orgs/${org.id}/modules`}>
                              <Package className="mr-2 h-4 w-4" />
                              Configure Modules
                            </Link>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>)}
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
      </main>
    </div>
  );
}