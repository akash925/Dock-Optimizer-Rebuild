import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Plus, Search, AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import AdminLayout from "@/components/layout/admin-layout";
import UsersTable from "@/components/admin/UsersTable";
import debounce from "lodash.debounce";

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
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredUsers, setFilteredUsers] = useState<UserWithRoles[]>([]);

  // Fetch users data with proper array handling
  const { data, isLoading, error } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await fetch(`/api/admin/users?page=${page}&limit=${limit}`);
      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }
      return response.json();
    }
  });
  
  // Handle data in a useEffect to avoid the onSuccess callback issue
  useEffect(() => {
    if (data) {
      console.log("Received users data:", data);
      // Ensure we have an array of users
      const usersArray = Array.isArray(data) ? data : 
                        (data && data.items && Array.isArray(data.items)) ? data.items : [];
      setFilteredUsers(usersArray);
    }
  }, [data]);

  // Make sure users is always an array
  const users = Array.isArray(data) ? data : 
              (data && data.items && Array.isArray(data.items)) ? data.items : [];

  // Handle search with debounce
  const handleSearch = useCallback(
    debounce((searchValue: string) => {
      if (!users || users.length === 0) return;
      
      setSearchTerm(searchValue);
      if (!searchValue.trim()) {
        setFilteredUsers(users);
        return;
      }
      
      const lowerCaseSearch = searchValue.toLowerCase();
      const filtered = users.filter(user => 
        user.email.toLowerCase().includes(lowerCaseSearch) || 
        (user.firstName && user.firstName.toLowerCase().includes(lowerCaseSearch)) ||
        (user.lastName && user.lastName.toLowerCase().includes(lowerCaseSearch)) ||
        user.username.toLowerCase().includes(lowerCaseSearch)
      );
      
      setFilteredUsers(filtered);
    }, 300),
    [users]
  );

  // Future enhancement: add a new user
  const handleAddUser = () => {
    // Navigate to a new user form in the future
    toast({
      title: "Not implemented",
      description: "Adding new users will be implemented in a future update",
    });
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
            <div className="flex items-center mb-4">
              <div className="relative w-full max-w-sm">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search users..."
                  className="pl-8 w-full"
                  value={searchTerm}
                  onChange={(e) => handleSearch(e.target.value)}
                />
              </div>
            </div>
            
            {/* Memoized users table component */}
            <UsersTable users={filteredUsers} />
            
            {/* Empty state when filtered results are empty */}
            {filteredUsers.length === 0 && searchTerm && (
              <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                <Search className="h-8 w-8 mb-2 opacity-50" />
                <p>No users found matching "{searchTerm}"</p>
                <Button 
                  variant="link" 
                  onClick={() => {
                    setSearchTerm("");
                    setFilteredUsers(users);
                  }}
                >
                  Clear search
                </Button>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {data?.pagination && `Showing ${(data.pagination.page - 1) * data.pagination.limit + 1}-${Math.min(data.pagination.page * data.pagination.limit, data.pagination.total)} of ${data.pagination.total} users`}
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(prev => Math.max(prev - 1, 1))}
                disabled={page <= 1}
                className="h-8 w-8 p-0"
              >
                <ChevronLeft className="h-4 w-4" />
                <span className="sr-only">Previous page</span>
              </Button>
              <div className="text-sm">
                Page {data?.pagination?.page} of {data?.pagination?.totalPages || 1}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(prev => Math.min(prev + 1, data?.pagination?.totalPages || 1))}
                disabled={page >= (data?.pagination?.totalPages || 1)}
                className="h-8 w-8 p-0"
              >
                <ChevronRight className="h-4 w-4" />
                <span className="sr-only">Next page</span>
              </Button>
            </div>
          </CardFooter>
        </Card>
      </div>
    </AdminLayout>
  );
}