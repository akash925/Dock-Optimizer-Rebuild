import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Plus, Edit, AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import AdminLayout from "@/components/layout/admin-layout";
import { FixedSizeList as List } from "react-window";

// Type for user with roles
interface UserWithRoles {
  userId: number;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  roles: {
    orgId: number;
    orgName: string;
    roleName: string;
  }[];
}

interface PaginatedResponse {
  items: UserWithRoles[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export default function UsersPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [limit] = useState(20);

  // Fetch paginated users data
  const { data, isLoading, error } = useQuery<PaginatedResponse>({
    queryKey: ['/api/admin/users', page, limit],
    queryFn: async () => {
      const response = await fetch(`/api/admin/users?page=${page}&limit=${limit}`);
      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }
      return response.json();
    },
  });

  const users = data?.items || [];

  // Future enhancement: add a new user
  const handleAddUser = () => {
    // Navigate to a new user form in the future
    toast({
      title: "Not implemented",
      description: "Adding new users will be implemented in a future update",
    });
  };

  // Format the roles as a comma-separated list
  const formatRoles = (roles: UserWithRoles['roles']) => {
    if (!roles || roles.length === 0) return 'None';
    
    return roles.map(role => `${role.orgName} (${role.roleName})`).join(', ');
  };

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex flex-col space-y-6 p-6">
          <h2 className="text-2xl font-semibold tracking-tight">Users</h2>
          <p className="text-sm text-muted-foreground">Manage users across all organizations</p>
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout>
        <div className="flex flex-col space-y-6 p-6">
          <h2 className="text-2xl font-semibold tracking-tight">Users</h2>
          <p className="text-sm text-muted-foreground">Manage users across all organizations</p>
          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-6">
              <div className="flex items-center space-x-2 text-red-600">
                <AlertTriangle />
                <span>Failed to load users: {(error as Error).message}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="flex flex-col space-y-6 p-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Users</h2>
            <p className="text-sm text-muted-foreground">Manage users across all organizations</p>
          </div>
          <Button onClick={handleAddUser} className="flex items-center gap-2">
            <Plus className="h-4 w-4" /> Add User
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Global Users List</CardTitle>
            <CardDescription>
              View and manage all users across organizations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Organizations & Roles</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users && users.length > 0 ? (
                  users.map((user) => (
                    <TableRow key={user.userId}>
                      <TableCell className="font-medium">{user.email}</TableCell>
                      <TableCell>{user.firstName} {user.lastName}</TableCell>
                      <TableCell>
                        {formatRoles(user.roles)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/admin/users/${user.userId}`)}
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
                    <TableCell colSpan={4} className="h-24 text-center">
                      No users found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}