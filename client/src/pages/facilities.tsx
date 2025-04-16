import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, Plus, PenIcon, TrashIcon } from "lucide-react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { insertDockSchema, Dock, InsertDock } from "@shared/schema";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";

// Create a schema for dock form validation
const dockFormSchema = insertDockSchema.extend({
  maxTrailerLength: z.number().min(20).max(100).optional(),
  requiresForklift: z.boolean().optional(),
});

type DockFormValues = z.infer<typeof dockFormSchema>;

export default function FacilitiesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [currentDock, setCurrentDock] = useState<Dock | null>(null);
  
  // Fetch all docks
  const { data: docks, isLoading, error } = useQuery({
    queryKey: ["/api/docks"],
    queryFn: async () => {
      const response = await fetch("/api/docks");
      if (!response.ok) {
        throw new Error("Failed to fetch docks");
      }
      return response.json() as Promise<Dock[]>;
    },
  });
  
  // Create dock mutation
  const createDockMutation = useMutation({
    mutationFn: async (values: DockFormValues) => {
      // Transform constraints object
      const dockData: InsertDock = {
        name: values.name,
        type: values.type,
        isActive: values.isActive,
        constraints: {
          maxTrailerLength: values.maxTrailerLength,
          requiresForklift: values.requiresForklift
        }
      };
      
      const res = await apiRequest("POST", "/api/docks", dockData);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/docks"] });
      setIsCreateDialogOpen(false);
      toast({
        title: "Success",
        description: "Dock created successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Failed to create dock: ${error.message}`,
        variant: "destructive",
      });
    }
  });
  
  // Create form
  const createForm = useForm<DockFormValues>({
    resolver: zodResolver(dockFormSchema),
    defaultValues: {
      name: "",
      type: "both",
      isActive: true,
      maxTrailerLength: 53,
      requiresForklift: false
    }
  });
  
  const handleCreateSubmit = (values: DockFormValues) => {
    createDockMutation.mutate(values);
  };
  
  // Update dock mutation
  const updateDockMutation = useMutation({
    mutationFn: async (values: DockFormValues) => {
      if (!currentDock) return null;
      
      // Transform constraints object
      const dockData = {
        name: values.name,
        type: values.type,
        isActive: values.isActive,
        constraints: {
          maxTrailerLength: values.maxTrailerLength,
          requiresForklift: values.requiresForklift
        }
      };
      
      const res = await apiRequest("PUT", `/api/docks/${currentDock.id}`, dockData);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/docks"] });
      setIsEditDialogOpen(false);
      setCurrentDock(null);
      toast({
        title: "Success",
        description: "Dock updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Failed to update dock: ${error.message}`,
        variant: "destructive",
      });
    }
  });
  
  // Edit form
  const editForm = useForm<DockFormValues>({
    resolver: zodResolver(dockFormSchema),
    defaultValues: {
      name: "",
      type: "both",
      isActive: true,
      maxTrailerLength: 53,
      requiresForklift: false
    }
  });
  
  const handleEditSubmit = (values: DockFormValues) => {
    updateDockMutation.mutate(values);
  };
  
  // Delete dock mutation
  const deleteDockMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/docks/${id}`);
      return res.ok;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/docks"] });
      toast({
        title: "Success",
        description: "Dock deleted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Failed to delete dock: ${error.message}`,
        variant: "destructive",
      });
    }
  });
  
  const handleEditClick = (dock: Dock) => {
    setCurrentDock(dock);
    
    // Preload form with dock data
    editForm.reset({
      name: dock.name,
      type: dock.type,
      isActive: dock.isActive,
      maxTrailerLength: dock.constraints?.maxTrailerLength || 53,
      requiresForklift: dock.constraints?.requiresForklift || false
    });
    
    setIsEditDialogOpen(true);
  };
  
  const handleDeleteClick = (dock: Dock) => {
    deleteDockMutation.mutate(dock.id);
  };
  
  // Handle dialog close
  const handleCreateDialogClose = () => {
    setIsCreateDialogOpen(false);
    createForm.reset();
  };
  
  const handleEditDialogClose = () => {
    setIsEditDialogOpen(false);
    setCurrentDock(null);
  };
  
  // Get dock type label
  const getDockTypeLabel = (type: string) => {
    switch (type) {
      case "inbound": return "Inbound";
      case "outbound": return "Outbound";
      case "both": return "Both";
      default: return type;
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-6 flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-6">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          Error loading docks: {error.message}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Facility Management</h1>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Add Dock Door
        </Button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {docks?.map((dock) => (
          <Card key={dock.id}>
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-xl">{dock.name}</CardTitle>
                  <CardDescription>Type: {getDockTypeLabel(dock.type)}</CardDescription>
                </div>
                <Badge className={dock.isActive ? "bg-green-500" : "bg-red-500"}>
                  {dock.isActive ? "Active" : "Inactive"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pb-2">
              <div className="space-y-1 text-sm">
                <div><span className="font-medium">Max Trailer Length:</span> {dock.constraints?.maxTrailerLength || "N/A"} ft</div>
                <div><span className="font-medium">Forklift Required:</span> {dock.constraints?.requiresForklift ? "Yes" : "No"}</div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-end space-x-2">
              <Button variant="outline" size="sm" onClick={() => handleEditClick(dock)}>
                <PenIcon className="mr-2 h-4 w-4" /> Edit
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm">
                    <TrashIcon className="mr-2 h-4 w-4" /> Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete the dock door
                      {dock.name} and remove it from the system.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleDeleteClick(dock)}>
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardFooter>
          </Card>
        ))}
      </div>
      
      {/* Create Dock Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[525px]">
          <DialogHeader>
            <DialogTitle>Add New Dock Door</DialogTitle>
            <DialogDescription>
              Enter the details for the new dock door
            </DialogDescription>
          </DialogHeader>
          
          <Form {...createForm}>
            <form onSubmit={createForm.handleSubmit(handleCreateSubmit)} className="space-y-4">
              <FormField
                control={createForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dock Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. A-01" {...field} />
                    </FormControl>
                    <FormDescription>Enter a unique identifier for this dock door</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={createForm.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select dock type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="inbound">Inbound</SelectItem>
                        <SelectItem value="outbound">Outbound</SelectItem>
                        <SelectItem value="both">Both</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>Select the type of operations for this dock</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={createForm.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 p-4 shadow-sm rounded-md">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Active</FormLabel>
                      <FormDescription>
                        Uncheck to mark this dock as inactive and exclude from scheduling
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />
              
              <FormField
                control={createForm.control}
                name="maxTrailerLength"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Max Trailer Length (ft)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder="53" 
                        {...field} 
                        onChange={e => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
                    <FormDescription>Maximum trailer length this dock can accommodate</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={createForm.control}
                name="requiresForklift"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 p-4 shadow-sm rounded-md">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Requires Forklift</FormLabel>
                      <FormDescription>
                        Check if this dock requires a forklift for loading/unloading
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />
              
              <DialogFooter>
                <Button type="button" variant="outline" onClick={handleCreateDialogClose}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createDockMutation.isPending}>
                  {createDockMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create Dock"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      {/* Edit Dock Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[525px]">
          <DialogHeader>
            <DialogTitle>Edit Dock Door</DialogTitle>
            <DialogDescription>
              Update the details for this dock door
            </DialogDescription>
          </DialogHeader>
          
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(handleEditSubmit)} className="space-y-4">
              <FormField
                control={editForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dock Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. A-01" {...field} />
                    </FormControl>
                    <FormDescription>Enter a unique identifier for this dock door</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={editForm.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select dock type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="inbound">Inbound</SelectItem>
                        <SelectItem value="outbound">Outbound</SelectItem>
                        <SelectItem value="both">Both</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>Select the type of operations for this dock</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={editForm.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 p-4 shadow-sm rounded-md">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Active</FormLabel>
                      <FormDescription>
                        Uncheck to mark this dock as inactive and exclude from scheduling
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />
              
              <FormField
                control={editForm.control}
                name="maxTrailerLength"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Max Trailer Length (ft)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder="53" 
                        {...field} 
                        onChange={e => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
                    <FormDescription>Maximum trailer length this dock can accommodate</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={editForm.control}
                name="requiresForklift"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 p-4 shadow-sm rounded-md">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Requires Forklift</FormLabel>
                      <FormDescription>
                        Check if this dock requires a forklift for loading/unloading
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />
              
              <DialogFooter>
                <Button type="button" variant="outline" onClick={handleEditDialogClose}>
                  Cancel
                </Button>
                <Button type="submit" disabled={updateDockMutation.isPending}>
                  {updateDockMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    "Update Dock"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}