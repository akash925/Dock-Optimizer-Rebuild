import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { 
  Loader2, Users, Package, ArrowLeft, UserPlus, 
  Trash2, Activity, Calendar, Building 
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import AdminLayout from "@/components/layout/admin-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Tenant, AvailableModule } from "@shared/schema";
import adminApi, { OrganizationDetail } from "@/api/admin";

// Form validation schemas
const addUserSchema = z.object({
  userId: z.string().min(1, "User is required"),
  roleId: z.string().min(1, "Role is required"),
});

const moduleUpdateSchema = z.object({
  moduleName: z.string().min(1, "Module name is required"),
  enabled: z.boolean(),
});

const moduleUpdatesSchema = z.array(moduleUpdateSchema);

type AddUserFormValues = z.infer<typeof addUserSchema>;

export default function OrganizationDetailPage() {
  const params = useParams<{ id: string }>();
  const orgId = params.id;
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("users");
  // Define OrgModule type
  interface OrgModule {
    moduleName: string;
    enabled: boolean;
  }
  
  const [modules, setModules] = useState<OrgModule[]>([]);

  // Fetch organization data using the consolidated API
  const {
    data: organization,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['orgDetail', orgId],
    queryFn: () => adminApi.getOrgDetail(orgId),
    staleTime: 300000, // Cache for 5 minutes
    onSuccess: (data) => {
      console.log("Organization data:", data);
      console.log("Modules data:", data?.modules || []);
      if (data?.modules) {
        setModules([...data.modules]);
      }
    },
  });
  
  // Add an effect to log modules data when organization changes
  useEffect(() => {
    if (organization?.modules) {
      console.log("Current modules state:", organization.modules);
    }
  }, [organization]);

  // Fetch all users for add user dropdown
  const { data: usersResponse } = useQuery({
    queryKey: ['allUsers'],
    queryFn: () => adminApi.getUsers(1, 100), // Fetch 100 users for dropdown
    staleTime: 300000, // Cache for 5 minutes
  });
  
  // Extract users from response
  const allUsers = usersResponse?.items || [];

  // Fetch all roles for role dropdown
  const { data: allRoles } = useQuery({
    queryKey: ['allRoles'],
    queryFn: adminApi.getRoles,
    staleTime: 300000, // Cache for 5 minutes
  });

  // Add user form
  const addUserForm = useForm<AddUserFormValues>({
    resolver: zodResolver(addUserSchema),
    defaultValues: {
      userId: "",
      roleId: "",
    },
  });

  // Pagination state for logs
  const [logsPage, setLogsPage] = useState(1);
  const [logsData, setLogsData] = useState<{ logs: ActivityLog[], pagination: any } | null>(null);

  // Fetch paginated logs using our API client
  const { isLoading: logsLoading } = useQuery({
    queryKey: ['orgLogs', orgId, logsPage],
    queryFn: () => adminApi.getOrgLogs(orgId, logsPage),
    enabled: activeTab === 'logs',
    onSuccess: (data) => {
      setLogsData(data);
    },
  });

  // Mutations
  const addUserMutation = useMutation({
    mutationFn: (values: { userId: number; roleId: number }) => 
      adminApi.addUserToOrg(orgId, values.userId, values.roleId),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "User added to organization",
      });
      // Invalidate the cached organization detail
      queryClient.invalidateQueries({
        queryKey: ['orgDetail', orgId],
      });
      setIsAddUserOpen(false);
      addUserForm.reset();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to add user: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const removeUserMutation = useMutation({
    mutationFn: (userId: number) => 
      adminApi.removeUserFromOrg(orgId, userId),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "User removed from organization",
      });
      // Invalidate the cached organization detail
      queryClient.invalidateQueries({
        queryKey: ['orgDetail', orgId],
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to remove user: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const toggleModuleMutation = useMutation({
    mutationFn: ({ moduleName, enabled }: { moduleName: string, enabled: boolean }) => 
      adminApi.toggleOrgModule(orgId, moduleName, enabled),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Module updated successfully",
      });
      // Invalidate the cached organization detail
      queryClient.invalidateQueries({
        queryKey: ['orgDetail', orgId],
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to update module: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Form handlers
  const onAddUserSubmit = (values: AddUserFormValues) => {
    addUserMutation.mutate({
      userId: parseInt(values.userId),
      roleId: parseInt(values.roleId),
    });
  };

  const handleRemoveUser = (userId: number) => {
    if (confirm("Are you sure you want to remove this user from the organization?")) {
      removeUserMutation.mutate(userId);
    }
  };

  const handleModuleToggle = (moduleName: string, checked: boolean) => {
    // Update the modules state for UI
    const updatedModules = modules.map((m) => {
      if (m.moduleName === moduleName) {
        return { ...m, enabled: checked };
      }
      return m;
    });
    setModules(updatedModules);
    
    // Save immediately with the new API
    toggleModuleMutation.mutate({ moduleName, enabled: checked });
  };
  
  const handlePageChange = (page: number) => {
    setLogsPage(page);
  };

  // Helper to get module display name
  const getModuleDisplayName = (moduleName: string) => {
    // Convert camelCase to Title Case
    return moduleName
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (str) => str.toUpperCase())
      .trim();
  };

  // Loading state
  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  // Error state
  if (error) {
    return (
      <AdminLayout>
        <div className="p-6">
          <div className="flex items-center mb-6">
            <Button variant="ghost" onClick={() => navigate("/admin/organizations")} className="mr-2">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>
            <h1 className="text-2xl font-bold">Organization Details</h1>
          </div>
          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-6">
              <div className="text-red-600">Failed to load organization: {error.message}</div>
            </CardContent>
          </Card>
        </div>
      </AdminLayout>
    );
  }

  if (!organization) {
    return (
      <AdminLayout>
        <div className="p-6">
          <div className="flex items-center mb-6">
            <Button variant="ghost" onClick={() => navigate("/admin/organizations")} className="mr-2">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>
            <h1 className="text-2xl font-bold">Organization Details</h1>
          </div>
          <Card>
            <CardContent className="pt-6">
              <div>Organization not found</div>
            </CardContent>
          </Card>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <Button variant="ghost" onClick={() => navigate("/admin/organizations")} className="mr-2">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold">{organization.name}</h1>
              <div className="text-sm text-muted-foreground flex items-center">
                <span>Subdomain: {organization.subdomain}</span>
                <span className="mx-2">•</span>
                <Badge variant={organization.status === 'ACTIVE' ? "default" : "secondary"}>
                  {organization.status}
                </Badge>
              </div>
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="users" className="flex items-center">
              <Users className="mr-2 h-4 w-4" /> Users
            </TabsTrigger>
            <TabsTrigger value="modules" className="flex items-center">
              <Package className="mr-2 h-4 w-4" /> Modules
            </TabsTrigger>
            <TabsTrigger value="logs" className="flex items-center">
              <Activity className="mr-2 h-4 w-4" /> Activity Logs
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Organization Users</CardTitle>
                  <CardDescription>Manage users in this organization</CardDescription>
                </div>
                <Dialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="flex items-center">
                      <UserPlus className="mr-2 h-4 w-4" /> Add User
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add User to Organization</DialogTitle>
                      <DialogDescription>
                        Select a user and assign a role within this organization.
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={addUserForm.handleSubmit(onAddUserSubmit)}>
                      <div className="space-y-4 py-2">
                        <div className="space-y-2">
                          <Label htmlFor="userId">User</Label>
                          <Select
                            onValueChange={(value) => addUserForm.setValue("userId", value)}
                            defaultValue={addUserForm.watch("userId")}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select a user" />
                            </SelectTrigger>
                            <SelectContent>
                              {Array.isArray(allUsers) && allUsers.map((user: any) => (
                                <SelectItem key={user.userId} value={user.userId.toString()}>
                                  {user.email} 
                                  {user.firstName && user.lastName ? ` - ${user.firstName} ${user.lastName}` : ''}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {addUserForm.formState.errors.userId && (
                            <p className="text-sm text-red-600">
                              {addUserForm.formState.errors.userId.message}
                            </p>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="roleId">Role</Label>
                          <Select
                            onValueChange={(value) => addUserForm.setValue("roleId", value)}
                            defaultValue={addUserForm.watch("roleId")}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select a role" />
                            </SelectTrigger>
                            <SelectContent>
                              {Array.isArray(allRoles) && allRoles.map((role: any) => (
                                <SelectItem 
                                  key={role.id} 
                                  value={role.id.toString()}
                                >
                                  {role.name || "Unknown Role"}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {addUserForm.formState.errors.roleId && (
                            <p className="text-sm text-red-600">
                              {addUserForm.formState.errors.roleId.message}
                            </p>
                          )}
                        </div>
                      </div>
                      <DialogFooter className="mt-4">
                        <Button type="button" variant="outline" onClick={() => setIsAddUserOpen(false)}>
                          Cancel
                        </Button>
                        <Button type="submit" disabled={addUserMutation.isPending}>
                          {addUserMutation.isPending && (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          )}
                          Add User
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {organization.users && organization.users.length > 0 ? (
                      organization.users.map((user) => (
                        <TableRow key={user.userId}>
                          <TableCell className="font-medium">
                            {user.firstName} {user.lastName}
                          </TableCell>
                          <TableCell>{user.email}</TableCell>
                          <TableCell>{user.roleName}</TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveUser(user.userId)}
                              disabled={removeUserMutation.isPending}
                              className="text-red-500 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                              <span className="sr-only">Remove</span>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={4} className="h-24 text-center">
                          No users found in this organization.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="modules">
            <Card>
              <CardHeader>
                <CardTitle>Organization Modules</CardTitle>
                <CardDescription>
                  Enable or disable modules for this organization
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary"/>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {toggleModuleMutation.isPending && (
                      <div className="mb-2 text-sm text-muted-foreground flex items-center">
                        <Loader2 className="h-3 w-3 animate-spin mr-2" />
                        Saving changes...
                      </div>
                    )}
                    
                    {organization?.modules && organization.modules.length > 0 ? (
                      <>
                        {organization.modules.map((module) => (
                          <div key={module.moduleName} className="flex items-center justify-between py-2 border-b">
                            <Label htmlFor={`module-${module.moduleName}`} className="flex-1 font-medium">
                              {getModuleDisplayName(module.moduleName)}
                            </Label>
                            <Switch
                              id={`module-${module.moduleName}`}
                              checked={module.enabled}
                              onCheckedChange={(checked) =>
                                handleModuleToggle(module.moduleName, checked)
                              }
                            />
                          </div>
                        ))}
                        <div className="mt-6 text-sm text-muted-foreground">
                          Changes are saved automatically
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        No modules configured for this organization
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="logs">
            <Card>
              <CardHeader>
                <CardTitle>Activity Logs</CardTitle>
                <CardDescription>
                  View organization activity history
                </CardDescription>
              </CardHeader>
              <CardContent>
                {logsLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary"/>
                  </div>
                ) : (
                  <>
                    {((organization.logs && organization.logs.length > 0) || (logsData?.logs && logsData.logs.length > 0)) ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[180px]">Timestamp</TableHead>
                            <TableHead className="w-[150px]">Action</TableHead>
                            <TableHead>Details</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(logsData?.logs || organization.logs || []).map((log) => (
                            <TableRow key={log.id || Math.random()}>
                              <TableCell className="font-mono text-xs">
                                {log.timestamp ? new Date(log.timestamp).toLocaleString() : 'Unknown date'}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">{log.action || 'Unknown'}</Badge>
                              </TableCell>
                              <TableCell>{log.details || 'No details'}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        No activity logs available
                      </div>
                    )}

                    {logsData?.pagination && logsData.pagination.totalPages > 1 && (
                      <div className="mt-4">
                        <Pagination>
                          <PaginationContent>
                            <PaginationItem>
                              <PaginationPrevious 
                                onClick={() => handlePageChange(Math.max(1, logsPage - 1))}
                                disabled={logsPage === 1}
                              />
                            </PaginationItem>
                            
                            {Array.from({ length: Math.min(5, logsData?.pagination?.totalPages || 1) }, (_, i) => {
                              // Show pages around current page
                              const totalPages = logsData?.pagination?.totalPages || 1;
                              const currentPage = logsPage;
                              let pageNum = i + 1;
                              
                              if (totalPages > 5) {
                                if (currentPage > 3 && currentPage < totalPages - 1) {
                                  // Show current page in the middle
                                  pageNum = currentPage + i - 2;
                                  if (pageNum < 1) pageNum = 1;
                                  if (pageNum > totalPages) pageNum = totalPages;
                                } else if (currentPage >= totalPages - 1) {
                                  // Near the end
                                  pageNum = totalPages - 4 + i;
                                }
                              }
                              
                              return (
                                <PaginationItem key={i}>
                                  <PaginationLink
                                    onClick={() => handlePageChange(pageNum)}
                                    isActive={pageNum === logsPage}
                                  >
                                    {pageNum}
                                  </PaginationLink>
                                </PaginationItem>
                              );
                            })}
                            
                            {logsData?.pagination?.totalPages > 5 && logsPage < logsData?.pagination?.totalPages - 2 && (
                              <PaginationItem>
                                <PaginationEllipsis />
                              </PaginationItem>
                            )}
                            
                            <PaginationItem>
                              <PaginationNext 
                                onClick={() => handlePageChange(Math.min(logsData?.pagination?.totalPages || 1, logsPage + 1))}
                                disabled={logsPage === (logsData?.pagination?.totalPages || 1)}
                              />
                            </PaginationItem>
                          </PaginationContent>
                        </Pagination>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}