import { useState } from "react";
import { useParams, useLocation, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Loader2, ArrowLeft, Plus, Trash2, UserCog, Activity, Building } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { apiRequest, queryClient } from "@/lib/queryClient";
import AdminLayout from "@/components/layout/admin-layout";

// Types for user details
interface UserRole {
  orgId: number;
  orgName: string;
  roleId: number;
  roleName: string;
}

interface ActivityLog {
  id: number;
  timestamp: string;
  action: string;
  details: string;
}

interface UserDetail {
  id: number;
  username: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  roles: UserRole[];
  activityLogs: ActivityLog[];
}

// Type for adding user to organization
const addToOrgSchema = z.object({
  orgId: z.string().min(1, "Organization is required"),
  roleId: z.string().min(1, "Role is required"),
});

type AddToOrgFormValues = z.infer<typeof addToOrgSchema>;

// Organization selector component
function AddToOrgDialog({ userId, onSuccess }: { userId: number, onSuccess: () => void }) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  
  // Fetch organizations
  const { data: orgs, isLoading: orgsLoading } = useQuery({
    queryKey: ['/api/admin/orgs'],
  });
  
  // Fetch roles
  const { data: roles, isLoading: rolesLoading } = useQuery({
    queryKey: ['/api/admin/settings/roles'],
  });

  const form = useForm<AddToOrgFormValues>({
    resolver: zodResolver(addToOrgSchema),
    defaultValues: {
      orgId: "",
      roleId: "",
    },
  });

  // Add user to organization mutation
  const addToOrgMutation = useMutation({
    mutationFn: async (data: AddToOrgFormValues) => {
      const response = await apiRequest("PUT", `/api/admin/users/${userId}/orgs`, {
        orgId: Number(data.orgId),
        roleId: Number(data.roleId),
        action: "add",
      });
      return await response.json();
    },
    onSuccess: () => {
      setIsOpen(false);
      queryClient.invalidateQueries({ queryKey: [`/api/admin/users/${userId}`] });
      toast({
        title: "Success",
        description: "User added to organization successfully",
      });
      form.reset();
      onSuccess();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add user to organization",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: AddToOrgFormValues) => {
    addToOrgMutation.mutate(data);
  };

  const isLoading = orgsLoading || rolesLoading || addToOrgMutation.isPending;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Add to Organization
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add User to Organization</DialogTitle>
          <DialogDescription>
            Assign this user to an organization with a specific role
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="orgId"
              render={({
                field
              }: any) => (
                <FormItem>
                  <FormLabel>Organization</FormLabel>
                  <Select
                    disabled={isLoading}
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select Organization" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {orgs?.map((org: any) => (
                        <SelectItem key={org.id} value={org.id.toString()}>
                          {org.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="roleId"
              render={({
                field
              }: any) => (
                <FormItem>
                  <FormLabel>Role</FormLabel>
                  <Select
                    disabled={isLoading}
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select Role" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {roles?.map((role: any) => (
                        <SelectItem key={role.id} value={role.id.toString()}>
                          {role.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline" type="button">Cancel</Button>
              </DialogClose>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Add User
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const userId = Number(id);
  const [activeTab, setActiveTab] = useState("organizations");

  // Fetch user details
  const { 
    data: user, 
    isLoading: userLoading,
    refetch: refetchUser
  } = useQuery<UserDetail>({
    queryKey: [`/api/admin/users/${userId}`],
    enabled: !isNaN(userId),
  });

  // Mutation to remove user from organization
  const removeFromOrgMutation = useMutation({
    mutationFn: async ({ orgId }: { orgId: number }) => {
      const response = await apiRequest("PUT", `/api/admin/users/${userId}/orgs`, {
        orgId,
        action: "remove",
      });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/admin/users/${userId}`] });
      toast({
        title: "Success",
        description: "User removed from organization successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to remove user from organization",
        variant: "destructive",
      });
    },
  });

  const handleRemoveFromOrg = (orgId: number) => {
    removeFromOrgMutation.mutate({ orgId });
  };

  if (isNaN(userId)) {
    return (
      <AdminLayout>
        <div className="flex flex-col p-6">
          <h2 className="text-2xl font-semibold tracking-tight">Invalid User ID</h2>
          <p className="text-sm text-muted-foreground mt-2">The provided user ID is not valid.</p>
          <Button asChild className="mt-4 self-start">
            <Link href="/admin/users">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Users
            </Link>
          </Button>
        </div>
      </AdminLayout>
    );
  }

  if (userLoading) {
    return (
      <AdminLayout>
        <div className="flex flex-col space-y-6 p-6">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (!user) {
    return (
      <AdminLayout>
        <div className="flex flex-col p-6">
          <h2 className="text-2xl font-semibold tracking-tight">User Not Found</h2>
          <p className="text-sm text-muted-foreground mt-2">The requested user could not be found.</p>
          <Button asChild className="mt-4 self-start">
            <Link href="/admin/users">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Users
            </Link>
          </Button>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="flex flex-col space-y-6 p-6">
        {/* Header */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm" className="h-8 w-8 p-0">
              <Link href="/admin/users">
                <ArrowLeft className="h-4 w-4" />
                <span className="sr-only">Back</span>
              </Link>
            </Button>
            <div className="flex items-center">
              <UserCog className="mr-2 h-6 w-6 text-primary" />
              <h2 className="text-2xl font-semibold tracking-tight">Edit User</h2>
            </div>
          </div>
          <div className="flex flex-col">
            <p className="text-muted-foreground">
              ID: {user.id} • Username: {user.username}
            </p>
            <p className="font-medium text-lg">
              {user.firstName || ''} {user.lastName || ''} {!user.firstName && !user.lastName && '(No name provided)'}
            </p>
            <p className="text-sm">{user.email}</p>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="organizations">
              <Building className="mr-2 h-4 w-4" />
              Organizations
            </TabsTrigger>
            <TabsTrigger value="activity">
              <Activity className="mr-2 h-4 w-4" />
              Activity Logs
            </TabsTrigger>
          </TabsList>

          {/* Organizations Tab */}
          <TabsContent value="organizations" className="mt-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Organization Memberships</CardTitle>
                  <CardDescription>
                    Manage this user's organization assignments and roles
                  </CardDescription>
                </div>
                <AddToOrgDialog userId={userId} onSuccess={refetchUser} />
              </CardHeader>
              <CardContent>
                {user.roles.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[200px]">Organization</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {user.roles.map((role: any) => <TableRow key={role.orgId}>
                        <TableCell className="font-medium">{role.orgName}</TableCell>
                        <TableCell>
                          <Badge variant={role.roleName === 'super-admin' ? 'destructive' : role.roleName === 'admin' ? 'default' : 'secondary'}>
                            {role.roleName}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveFromOrg(role.orgId)}
                            disabled={removeFromOrgMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                            <span className="sr-only">Remove</span>
                          </Button>
                        </TableCell>
                      </TableRow>)}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="flex flex-col items-center justify-center py-6 text-center">
                    <p className="text-muted-foreground">
                      This user is not a member of any organizations
                    </p>
                    <AddToOrgDialog userId={userId} onSuccess={refetchUser} />
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Activity Logs Tab */}
          <TabsContent value="activity" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Activity Logs</CardTitle>
                <CardDescription>
                  Track user actions and system events
                </CardDescription>
              </CardHeader>
              <CardContent>
                {user.activityLogs && user.activityLogs.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[180px]">Timestamp</TableHead>
                        <TableHead className="w-[150px]">Action</TableHead>
                        <TableHead>Details</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {user.activityLogs.map((log: any) => <TableRow key={log.id}>
                        <TableCell className="font-mono text-xs">
                          {new Date(log.timestamp).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{log.action}</Badge>
                        </TableCell>
                        <TableCell>{log.details}</TableCell>
                      </TableRow>)}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="flex flex-col items-center justify-center py-6 text-center">
                    <p className="text-muted-foreground">
                      No activity logs available for this user
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}