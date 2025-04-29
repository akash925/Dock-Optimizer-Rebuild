import React, { useState } from 'react';
import { useRoute } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  ArrowLeft, 
  Building2, 
  Users, 
  Package, 
  Edit, 
  Trash2, 
  Check, 
  X, 
  Plus,
  RefreshCw,
  Save
} from 'lucide-react';
import { AdminHeader } from '@/components/admin/admin-header';
import { Link } from 'wouter';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

import { AvailableModule } from '@shared/schema';

// Types
interface OrganizationDetail {
  id: number;
  name: string;
  subdomain: string;
  status: string;
  createdAt: Date;
  contactEmail: string | null;
  contactPhone: string | null;
  logoUrl: string | null;
  users: OrganizationUser[];
  modules: OrganizationModule[];
}

interface OrganizationUser {
  userId: number;
  organizationId: number;
  roleId: number;
  user: User;
  role: Role;
}

interface User {
  id: number;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
}

interface Role {
  id: number;
  name: string;
  description: string | null;
}

interface OrganizationModule {
  id: number;
  organizationId: number;
  moduleName: string;
  enabled: boolean;
  createdAt: Date;
}

interface AssignUserForm {
  userId: number;
  roleId: number;
}

export default function OrganizationDetailPage() {
  const [, params] = useRoute<{ id: string }>('/admin/orgs/:id');
  const id = params?.id ? parseInt(params.id, 10) : 0;
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AssignUserForm>({ userId: 0, roleId: 0 });
  
  // Fetch organization detail
  const { 
    data: org, 
    isLoading: isLoadingOrg, 
    error: orgError 
  } = useQuery<OrganizationDetail>({
    queryKey: [`/api/admin/orgs/${id}`],
    enabled: !!id,
  });
  
  // Fetch all users (for user assignment)
  const { 
    data: allUsers, 
    isLoading: isLoadingUsers 
  } = useQuery<User[]>({
    queryKey: ['/api/admin/users'],
    enabled: userDialogOpen,
  });
  
  // Fetch all roles
  const { 
    data: allRoles, 
    isLoading: isLoadingRoles 
  } = useQuery<Role[]>({
    queryKey: ['/api/admin/roles'],
    enabled: userDialogOpen,
  });
  
  // Mutation to add user to organization
  const addUserMutation = useMutation({
    mutationFn: async (data: AssignUserForm) => {
      const response = await apiRequest('POST', `/api/admin/orgs/${id}/users`, data);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: 'User added successfully',
        description: 'The user has been added to the organization',
      });
      setUserDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: [`/api/admin/orgs/${id}`] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to add user',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
  
  // Mutation to remove user from organization
  const removeUserMutation = useMutation({
    mutationFn: async (userId: number) => {
      await apiRequest('DELETE', `/api/admin/orgs/${id}/users/${userId}`);
    },
    onSuccess: () => {
      toast({
        title: 'User removed successfully',
        description: 'The user has been removed from the organization',
      });
      queryClient.invalidateQueries({ queryKey: [`/api/admin/orgs/${id}`] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to remove user',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
  
  // Mutation to update organization modules
  const updateModulesMutation = useMutation({
    mutationFn: async (modules: { moduleName: string; enabled: boolean }[]) => {
      const response = await apiRequest('PUT', `/api/admin/orgs/${id}/modules`, modules);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Modules updated successfully',
        description: 'The organization modules have been updated',
      });
      queryClient.invalidateQueries({ queryKey: [`/api/admin/orgs/${id}`] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to update modules',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
  
  // Function to handle module toggle
  const handleModuleToggle = (moduleName: string, enabled: boolean) => {
    if (!org) return;
    
    // Create a new array with updated module status
    const updatedModules = org.modules.map(module => {
      if (module.moduleName === moduleName) {
        return { ...module, enabled };
      }
      return module;
    });
    
    // Format for API
    const modulesForUpdate = updatedModules.map(module => ({
      moduleName: module.moduleName,
      enabled: module.enabled
    }));
    
    // Update via mutation
    updateModulesMutation.mutate(modulesForUpdate);
  };
  
  // Function to handle add user form submission
  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedUser.userId && selectedUser.roleId) {
      addUserMutation.mutate(selectedUser);
    } else {
      toast({
        title: 'Invalid form data',
        description: 'Please select both a user and a role',
        variant: 'destructive',
      });
    }
  };
  
  const handleRemoveUser = (userId: number) => {
    if (confirm('Are you sure you want to remove this user from the organization?')) {
      removeUserMutation.mutate(userId);
    }
  };
  
  // Filter out users that are already in the organization
  const availableUsers = allUsers?.filter(
    user => !org?.users.some(ou => ou.userId === user.id)
  );
  
  // Helper to display a user's full name
  const getUserFullName = (user: User) => {
    return `${user.firstName} ${user.lastName}`;
  };
  
  // Format module name for display
  const formatModuleName = (name: string) => {
    // Convert camelCase to space-separated words
    return name
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase());
  };
  
  // Get module description
  const getModuleDescription = (moduleName: string) => {
    const descriptions: Record<string, string> = {
      appointments: 'Schedule and manage dock appointments',
      calendar: 'Visual calendar interface for appointments',
      assetManager: 'Track and manage physical assets',
      emailNotifications: 'Send email notifications for events',
      analytics: 'View usage and performance analytics',
      bookingPages: 'Create external booking pages',
      facilityManagement: 'Manage facilities and locations',
      doorManager: 'Control and monitor dock doors',
      userManagement: 'Manage users and permissions',
    };
    
    return descriptions[moduleName] || 'Module functionality';
  };
  
  if (isLoadingOrg) {
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
            <div className="flex-1">
              <div className="h-6 w-64 bg-muted animate-pulse rounded-md"></div>
            </div>
          </div>
          
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="h-8 w-48 bg-muted animate-pulse rounded-md"></div>
                <div className="h-4 w-64 bg-muted animate-pulse rounded-md"></div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Array(4).fill(0).map((_, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="h-4 w-32 bg-muted animate-pulse rounded-md"></div>
                      <div className="h-4 w-48 bg-muted animate-pulse rounded-md"></div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    );
  }
  
  if (orgError || !org) {
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
            <h1 className="text-3xl font-bold tracking-tight">Organization Not Found</h1>
          </div>
          
          <Card>
            <CardHeader>
              <CardTitle>Error</CardTitle>
              <CardDescription>Failed to load organization details</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                The organization you are looking for does not exist or there was an error loading it.
              </p>
            </CardContent>
            <CardFooter>
              <Button variant="outline" asChild>
                <Link href="/admin">Go Back</Link>
              </Button>
            </CardFooter>
          </Card>
        </main>
      </div>
    );
  }
  
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
          <div className="flex-1">
            <h1 className="text-3xl font-bold tracking-tight flex items-center">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border bg-muted text-muted-foreground mr-2">
                {org.logoUrl ? (
                  <img src={org.logoUrl} alt={org.name} className="h-6 w-6" />
                ) : (
                  <Building2 className="h-5 w-5" />
                )}
              </span>
              {org.name}
            </h1>
            <p className="text-muted-foreground mt-1">
              <Badge variant="outline" className={
                org.status === 'ACTIVE' ? 'bg-green-100 text-green-800 hover:bg-green-100' :
                org.status === 'INACTIVE' ? 'bg-gray-100 text-gray-800 hover:bg-gray-100' :
                org.status === 'SUSPENDED' ? 'bg-amber-100 text-amber-800 hover:bg-amber-100' :
                'bg-blue-100 text-blue-800 hover:bg-blue-100'
              }>
                {org.status === 'ACTIVE' ? (
                  <Check className="mr-1 h-3 w-3" />
                ) : org.status === 'INACTIVE' || org.status === 'SUSPENDED' ? (
                  <X className="mr-1 h-3 w-3" />
                ) : null}
                {org.status}
              </Badge>
              <span className="mx-2">•</span>
              <span className="text-sm">{org.subdomain}.example.com</span>
            </p>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/admin/orgs/${id}/edit`}>
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </Link>
          </Button>
        </div>
        
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Organization Details</CardTitle>
              <CardDescription>Basic information about the organization</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">Contact</h3>
                  <p className="mt-1">{org.contactEmail || 'No contact email'}</p>
                  <p>{org.contactPhone || 'No contact phone'}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">Details</h3>
                  <p className="mt-1">Created on {new Date(org.createdAt).toLocaleDateString()}</p>
                  <p>URL: {org.subdomain}.example.com</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Tabs defaultValue="users">
            <TabsList className="mb-4">
              <TabsTrigger value="users" className="flex items-center">
                <Users className="mr-2 h-4 w-4" />
                Users ({org.users.length})
              </TabsTrigger>
              <TabsTrigger value="modules" className="flex items-center">
                <Package className="mr-2 h-4 w-4" />
                Modules ({org.modules.filter(m => m.enabled).length})
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="users">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Users</CardTitle>
                    <CardDescription>
                      Manage users assigned to this organization
                    </CardDescription>
                  </div>
                  <Dialog open={userDialogOpen} onOpenChange={setUserDialogOpen}>
                    <DialogTrigger asChild>
                      <Button>
                        <Plus className="mr-2 h-4 w-4" />
                        Add User
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Add User to Organization</DialogTitle>
                        <DialogDescription>
                          Assign a user to this organization and set their role.
                        </DialogDescription>
                      </DialogHeader>
                      
                      <form onSubmit={handleAddUser}>
                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <Label htmlFor="user">Select User</Label>
                            <Select
                              value={selectedUser.userId.toString()}
                              onValueChange={(value) => setSelectedUser({
                                ...selectedUser,
                                userId: parseInt(value, 10)
                              })}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select a user" />
                              </SelectTrigger>
                              <SelectContent>
                                {isLoadingUsers ? (
                                  <div className="flex items-center justify-center p-4">
                                    <RefreshCw className="h-4 w-4 animate-spin" />
                                  </div>
                                ) : availableUsers && availableUsers.length > 0 ? (
                                  availableUsers.map((user) => (
                                    <SelectItem key={user.id} value={user.id.toString()}>
                                      {getUserFullName(user)} ({user.email})
                                    </SelectItem>
                                  ))
                                ) : (
                                  <div className="p-2 text-center text-muted-foreground">
                                    No available users
                                  </div>
                                )}
                              </SelectContent>
                            </Select>
                          </div>
                          
                          <div className="space-y-2">
                            <Label htmlFor="role">Select Role</Label>
                            <Select
                              value={selectedUser.roleId.toString()}
                              onValueChange={(value) => setSelectedUser({
                                ...selectedUser,
                                roleId: parseInt(value, 10)
                              })}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select a role" />
                              </SelectTrigger>
                              <SelectContent>
                                {isLoadingRoles ? (
                                  <div className="flex items-center justify-center p-4">
                                    <RefreshCw className="h-4 w-4 animate-spin" />
                                  </div>
                                ) : allRoles && allRoles.length > 0 ? (
                                  allRoles.map((role) => (
                                    <SelectItem key={role.id} value={role.id.toString()}>
                                      {role.name}
                                    </SelectItem>
                                  ))
                                ) : (
                                  <div className="p-2 text-center text-muted-foreground">
                                    No roles available
                                  </div>
                                )}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        
                        <DialogFooter>
                          <Button 
                            type="submit" 
                            disabled={addUserMutation.isPending}
                          >
                            {addUserMutation.isPending && (
                              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                            )}
                            Add User
                          </Button>
                        </DialogFooter>
                      </form>
                    </DialogContent>
                  </Dialog>
                </CardHeader>
                <CardContent>
                  {org.users.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>User</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {org.users.map((orgUser) => (
                          <TableRow key={orgUser.userId}>
                            <TableCell>
                              <div className="flex items-center space-x-2">
                                <Avatar className="h-8 w-8">
                                  <AvatarImage src="" />
                                  <AvatarFallback>
                                    {orgUser.user.firstName[0]}{orgUser.user.lastName[0]}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="text-sm font-medium">{getUserFullName(orgUser.user)}</p>
                                  <p className="text-xs text-muted-foreground">@{orgUser.user.username}</p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>{orgUser.user.email}</TableCell>
                            <TableCell>
                              <Badge variant="secondary">
                                {orgUser.role.name}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                    <span className="sr-only">Open menu</span>
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    className="text-destructive focus:text-destructive"
                                    onClick={() => handleRemoveUser(orgUser.userId)}
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Remove
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
                        <Users className="h-10 w-10 mb-2" />
                        <p>No users assigned to this organization</p>
                        <p className="text-sm">Add users to give them access to this organization</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="modules">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Modules</CardTitle>
                    <CardDescription>
                      Configure which modules are available for this organization
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={updateModulesMutation.isPending}
                    onClick={() => {
                      const modulesForUpdate = org.modules.map(module => ({
                        moduleName: module.moduleName,
                        enabled: module.enabled
                      }));
                      updateModulesMutation.mutate(modulesForUpdate);
                    }}
                  >
                    {updateModulesMutation.isPending ? (
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    Save Changes
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2">
                    {org.modules.map((module) => (
                      <Card key={module.id} className="overflow-hidden">
                        <div className="flex items-center p-4">
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center">
                              <h3 className="text-sm font-medium">
                                {formatModuleName(module.moduleName)}
                              </h3>
                              <Badge 
                                variant={module.enabled ? "default" : "outline"} 
                                className="ml-2"
                              >
                                {module.enabled ? "Enabled" : "Disabled"}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {getModuleDescription(module.moduleName)}
                            </p>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Label htmlFor={`module-${module.id}`} className="sr-only">
                              Toggle {formatModuleName(module.moduleName)}
                            </Label>
                            <Switch
                              id={`module-${module.id}`}
                              checked={module.enabled}
                              onCheckedChange={(checked) => 
                                handleModuleToggle(module.moduleName, checked)
                              }
                            />
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}