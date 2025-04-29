import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Loader2, Edit, Check, X, Settings as SettingsIcon } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import AdminLayout from "@/components/layout/admin-layout";

// Type definitions
interface Role {
  id: number;
  name: string;
  description: string | null;
}

interface FeatureFlag {
  name: string;
  description: string;
  enabled: boolean;
}

// Zod schema for role editing
const roleFormSchema = z.object({
  name: z.string().min(1, "Role name is required"),
  description: z.string().optional(),
});

type RoleFormValues = z.infer<typeof roleFormSchema>;

// Component for editing a role
function EditRoleDialog({ role, onSave }: { role: Role, onSave: (values: RoleFormValues) => void }) {
  const form = useForm<RoleFormValues>({
    resolver: zodResolver(roleFormSchema),
    defaultValues: {
      name: role.name,
      description: role.description || "",
    },
  });

  const handleSave = (values: RoleFormValues) => {
    onSave(values);
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="ml-2">
          <Edit className="mr-2 h-4 w-4" />
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Role</DialogTitle>
          <DialogDescription>
            Update the role name and description
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSave)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role Name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea {...field} />
                  </FormControl>
                  <FormDescription>
                    Provide a brief description of this role's responsibilities
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline" type="button">Cancel</Button>
              </DialogClose>
              <Button type="submit">Save Changes</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminSettingsPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("roles");

  // Fetch roles
  const { data: roles, isLoading: rolesLoading } = useQuery<Role[]>({
    queryKey: ['/api/admin/settings/roles'],
  });

  // Fetch feature flags
  const { data: featureFlags, isLoading: flagsLoading } = useQuery<FeatureFlag[]>({
    queryKey: ['/api/admin/settings/feature-flags'],
  });

  // Update role mutation
  const updateRoleMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number, data: RoleFormValues }) => {
      const response = await apiRequest("PUT", `/api/admin/settings/roles/${id}`, data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/settings/roles'] });
      toast({
        title: "Role updated",
        description: "The role has been updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update role",
        description: error.message || "An error occurred while updating the role",
        variant: "destructive",
      });
    },
  });

  // Update feature flag mutation
  const updateFeatureFlagMutation = useMutation({
    mutationFn: async ({ name, enabled }: { name: string, enabled: boolean }) => {
      const response = await apiRequest("PUT", `/api/admin/settings/feature-flags/${name}`, { enabled });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/settings/feature-flags'] });
      toast({
        title: "Feature flag updated",
        description: "The feature flag setting has been updated",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update feature flag",
        description: error.message || "An error occurred while updating the feature flag",
        variant: "destructive",
      });
    },
  });

  const handleRoleUpdate = (role: Role, values: RoleFormValues) => {
    updateRoleMutation.mutate({ id: role.id, data: values });
  };

  const handleFeatureFlagToggle = (flag: FeatureFlag, enabled: boolean) => {
    updateFeatureFlagMutation.mutate({ name: flag.name, enabled });
  };

  const isLoading = rolesLoading || flagsLoading;

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex flex-col space-y-6 p-6">
          <h2 className="text-2xl font-semibold tracking-tight">Settings</h2>
          <p className="text-sm text-muted-foreground">Manage system-wide settings</p>
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="flex flex-col space-y-6 p-6">
        <div className="flex items-center">
          <SettingsIcon className="mr-2 h-6 w-6 text-primary" />
          <h2 className="text-2xl font-semibold tracking-tight">Admin Settings</h2>
        </div>
        <p className="text-sm text-muted-foreground">Manage global system settings and configurations</p>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="roles">Roles</TabsTrigger>
            <TabsTrigger value="feature-flags">Feature Flags</TabsTrigger>
          </TabsList>

          <TabsContent value="roles" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>System Roles</CardTitle>
                <CardDescription>
                  Manage system role definitions and permissions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {roles && roles.map((role) => (
                    <div key={role.id} className="flex items-center justify-between p-3 border rounded-md">
                      <div>
                        <div className="font-medium">{role.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {role.description || "No description"}
                        </div>
                      </div>
                      <EditRoleDialog 
                        role={role} 
                        onSave={(values) => handleRoleUpdate(role, values)} 
                      />
                    </div>
                  ))}
                  {(!roles || roles.length === 0) && (
                    <div className="text-center py-4 text-muted-foreground">
                      No roles found
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="feature-flags" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Global Feature Flags</CardTitle>
                <CardDescription>
                  Toggle system-wide features on and off
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {featureFlags && featureFlags.map((flag) => (
                    <div key={flag.name} className="flex items-center justify-between p-3 border rounded-md">
                      <div className="flex-1">
                        <div className="flex items-center">
                          <span className="font-medium mr-2">{flag.name}</span>
                          <Badge variant={flag.enabled ? "default" : "secondary"} className={flag.enabled ? "bg-green-500 hover:bg-green-600" : ""}>
                            {flag.enabled ? "Enabled" : "Disabled"}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                          {flag.description}
                        </div>
                      </div>
                      <div className="flex items-center">
                        <span className="text-sm mr-2">
                          {flag.enabled ? "On" : "Off"}
                        </span>
                        <Switch
                          checked={flag.enabled}
                          onCheckedChange={(checked) => handleFeatureFlagToggle(flag, checked)}
                          disabled={updateFeatureFlagMutation.isPending}
                        />
                      </div>
                    </div>
                  ))}
                  {(!featureFlags || featureFlags.length === 0) && (
                    <div className="text-center py-4 text-muted-foreground">
                      No feature flags found
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}