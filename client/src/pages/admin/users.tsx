import { useQuery, useMutation } from "@tanstack/react-query";
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
import adminApi from "@/api/admin";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { queryClient } from "@/lib/queryClient";

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

// Define schema for adding a new user
const addUserSchema = z.object({
  email: z.string().email("Valid email is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
});

type AddUserFormValues = z.infer<typeof addUserSchema>;

export default function UsersPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredUsers, setFilteredUsers] = useState<UserWithRoles[]>([]);
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  
  // Fetch users data using the admin API
  const { data: users = [], isLoading, error } = useQuery({
    queryKey: ['adminUsers'],
    queryFn: () => adminApi.getUsers(page, limit)
  });
  
  // Add user form
  const form = useForm<AddUserFormValues>({
    resolver: zodResolver(addUserSchema),
    defaultValues: {
      email: "",
      password: "",
      firstName: "",
      lastName: "",
    },
  });
  
  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: (data: AddUserFormValues) => adminApi.createUser(data),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "User created successfully",
      });
      // Reset form and close modal
      form.reset();
      setIsAddUserOpen(false);
      // Refresh users list
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Failed to create user: ${error.message}`,
        variant: "destructive",
      });
    }
  });

  // Handle form submission
  const onSubmit = (data: AddUserFormValues) => {
    createUserMutation.mutate(data);
  };
  
  // Handle data in a useEffect to update filtered users when data changes
  useEffect(() => {
    if (users) {
      console.log("Received users data:", users);
      // If there's a search term, apply filtering, otherwise show all users
      if (searchTerm) {
        const lowerCaseSearch = searchTerm.toLowerCase();
        const filtered = users.filter((user: UserWithRoles) => 
          user.email?.toLowerCase().includes(lowerCaseSearch) || 
          (user.firstName && user.firstName.toLowerCase().includes(lowerCaseSearch)) ||
          (user.lastName && user.lastName.toLowerCase().includes(lowerCaseSearch)) ||
          user.username?.toLowerCase().includes(lowerCaseSearch)
        );
        setFilteredUsers(filtered);
      } else {
        setFilteredUsers(users);
      }
    }
  }, [users, searchTerm]);

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
      const filtered = users.filter((user: UserWithRoles) => 
        user.email?.toLowerCase().includes(lowerCaseSearch) || 
        (user.firstName && user.firstName.toLowerCase().includes(lowerCaseSearch)) ||
        (user.lastName && user.lastName.toLowerCase().includes(lowerCaseSearch)) ||
        user.username?.toLowerCase().includes(lowerCaseSearch)
      );
      
      setFilteredUsers(filtered);
    }, 300),
    [users]
  );
  
  // Add user dialog handler
  const handleAddUser = () => {
    setIsAddUserOpen(true);
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
        
        {/* Add User Dialog */}
        <Dialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Add New User</DialogTitle>
              <DialogDescription>
                Create a new user account. You can assign them to organizations later.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input placeholder="user@example.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="••••••••" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>First Name</FormLabel>
                        <FormControl>
                          <Input placeholder="John" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Last Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Doe" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <DialogFooter className="pt-4">
                  <Button type="submit" disabled={createUserMutation.isPending}>
                    {createUserMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Create User
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

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
            
            {/* Render users table or empty state */}
            {Array.isArray(filteredUsers) && filteredUsers.length > 0 ? (
              <UsersTable users={filteredUsers} />
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                <Search className="h-8 w-8 mb-2 opacity-50" />
                {searchTerm ? (
                  <>
                    <p>No users found matching "{searchTerm}"</p>
                    <Button 
                      variant="link" 
                      onClick={() => {
                        setSearchTerm("");
                        setFilteredUsers(Array.isArray(users) ? users : []);
                      }}
                    >
                      Clear search
                    </Button>
                  </>
                ) : (
                  <p>No users available. Click "Add User" to create one.</p>
                )}
              </div>
            )}
          </CardContent>
          <CardFooter className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Showing {Array.isArray(filteredUsers) ? filteredUsers.length : 0} users
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
                Page {page}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(prev => prev + 1)}
                disabled={!Array.isArray(users) || users.length < limit}
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