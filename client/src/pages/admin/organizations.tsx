import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Loader2, Plus, Edit, Users, Package, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Tenant } from "@shared/schema";
import Layout from "@/components/layout/layout";

// Extended tenant type with additional counts
type EnhancedTenant = Tenant & {
  userCount: number;
  moduleCount: number;
};

export default function OrganizationsPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  // Fetch organizations data
  const { data: organizations, isLoading, error } = useQuery<EnhancedTenant[]>({
    queryKey: ['/api/admin/orgs'],
  });

  // Handle add organization
  const handleAddOrganization = () => {
    navigate('/admin/orgs/new');
  };

  // Get status badge variant
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return <Badge className="bg-green-500">Active</Badge>;
      case 'SUSPENDED':
        return <Badge variant="destructive">Suspended</Badge>;
      case 'TRIAL':
        return <Badge className="bg-blue-500">Trial</Badge>;
      case 'PENDING':
        return <Badge variant="outline">Pending</Badge>;
      case 'INACTIVE':
        return <Badge variant="secondary">Inactive</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex flex-col space-y-6 p-6">
          <h2 className="text-2xl font-semibold tracking-tight">Organizations</h2>
          <p className="text-sm text-muted-foreground">Manage tenant organizations</p>
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="flex flex-col space-y-6 p-6">
          <h2 className="text-2xl font-semibold tracking-tight">Organizations</h2>
          <p className="text-sm text-muted-foreground">Manage tenant organizations</p>
          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-6">
              <div className="flex items-center space-x-2 text-red-600">
                <AlertTriangle />
                <span>Failed to load organizations: {error.message}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex flex-col space-y-6 p-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Organizations</h2>
            <p className="text-sm text-muted-foreground">Manage tenant organizations</p>
          </div>
          <Button onClick={handleAddOrganization} className="flex items-center gap-2">
            <Plus className="h-4 w-4" /> Add Organization
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Organization List</CardTitle>
            <CardDescription>
              View and manage all organizations in the platform
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>
                    <div className="flex items-center gap-1">
                      <Users className="h-4 w-4" /> Users
                    </div>
                  </TableHead>
                  <TableHead>
                    <div className="flex items-center gap-1">
                      <Package className="h-4 w-4" /> Modules
                    </div>
                  </TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {organizations && organizations.length > 0 ? (
                  organizations.map((org) => (
                    <TableRow key={org.id}>
                      <TableCell className="font-medium">{org.name}</TableCell>
                      <TableCell>{getStatusBadge(org.status || 'ACTIVE')}</TableCell>
                      <TableCell>{org.userCount}</TableCell>
                      <TableCell>{org.moduleCount}</TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/admin/orgs/${org.id}`)}
                          className="flex items-center gap-1"
                        >
                          <Edit className="h-3.5 w-3.5" />
                          Edit
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
                      No organizations found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}