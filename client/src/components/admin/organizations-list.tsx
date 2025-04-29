import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MoreHorizontal, Building2, UserPlus, ToggleLeft } from "lucide-react";
import { TenantStatus, Tenant } from "@shared/schema";

export function OrganizationsList() {
  const {
    data: organizations,
    isLoading,
    error,
  } = useQuery<Tenant[]>({
    queryKey: ["/api/admin/orgs"],
  });

  if (isLoading) {
    return <OrganizationsListSkeleton />;
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Error</CardTitle>
          <CardDescription>Failed to load organizations</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-destructive">{error.message}</p>
          <Button variant="outline" className="mt-4" onClick={() => window.location.reload()}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Organizations</CardTitle>
          <CardDescription>Manage all tenant organizations in the system</CardDescription>
        </div>
        <Button className="flex items-center gap-2">
          <Building2 className="w-4 h-4" />
          Add Organization
        </Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Subdomain</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {organizations?.map((org) => (
              <TableRow key={org.id}>
                <TableCell className="font-medium">
                  <Link href={`/admin/orgs/${org.id}`}>{org.name}</Link>
                </TableCell>
                <TableCell>{org.subdomain}</TableCell>
                <TableCell>
                  <StatusBadge status={org.status as TenantStatus} />
                </TableCell>
                <TableCell>
                  {org.contactEmail || '-'}
                </TableCell>
                <TableCell>{new Date(org.createdAt).toLocaleDateString()}</TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">Open menu</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>
                        <Link href={`/admin/orgs/${org.id}`}>View Details</Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Link href={`/admin/orgs/${org.id}/users`}>Manage Users</Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Link href={`/admin/orgs/${org.id}/modules`}>Manage Modules</Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Link href={`/admin/orgs/${org.id}/edit`}>Edit Organization</Link>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
            
            {organizations?.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No organizations found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: TenantStatus }) {
  const getVariant = () => {
    switch (status) {
      case "ACTIVE":
        return "success";
      case "TRIAL":
        return "warning";
      case "SUSPENDED":
        return "destructive";
      case "PENDING":
        return "secondary";
      case "INACTIVE":
        return "outline";
      default:
        return "default";
    }
  };

  // @ts-ignore - shadcn variants typing issue
  return <Badge variant={getVariant()}>{status}</Badge>;
}

function OrganizationsListSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96 mt-2" />
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <Skeleton className="h-4 w-[120px]" />
            <Skeleton className="h-4 w-[80px]" />
            <Skeleton className="h-4 w-[100px]" />
            <Skeleton className="h-4 w-[150px]" />
            <Skeleton className="h-4 w-[120px]" />
            <Skeleton className="h-4 w-[50px]" />
          </div>
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex justify-between items-center">
              <Skeleton className="h-4 w-[180px]" />
              <Skeleton className="h-4 w-[120px]" />
              <Skeleton className="h-4 w-[80px]" />
              <Skeleton className="h-4 w-[200px]" />
              <Skeleton className="h-4 w-[100px]" />
              <Skeleton className="h-8 w-8 rounded-full" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default OrganizationsList;