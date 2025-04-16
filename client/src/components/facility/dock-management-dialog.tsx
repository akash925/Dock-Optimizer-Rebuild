import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dock, Facility, DoorType } from "@shared/schema";
import { Loader2, Pencil, Plus, Trash } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
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

// Define the door types with display names
const doorTypes: { value: DoorType; label: string }[] = [
  { value: "dry", label: "Dry" },
  { value: "refrigerated", label: "Refrigerated" },
  { value: "frozen", label: "Frozen" },
  { value: "hazmat", label: "Hazardous Materials" },
  { value: "extra_heavy", label: "Extra Heavy" },
  { value: "custom", label: "Custom" }
];

// Define the dock form schema
const dockSchema = z.object({
  id: z.number().optional(),
  name: z.string().min(1, "Door name is required"),
  type: z.enum(["dry", "refrigerated", "frozen", "hazmat", "extra_heavy", "custom"] as const),
  customType: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
  facilityId: z.number(),
});

type DockFormValues = z.infer<typeof dockSchema>;

interface DockManagementDialogProps {
  isOpen: boolean;
  onClose: () => void;
  facility: Facility;
}

export function DockManagementDialog({ isOpen, onClose, facility }: DockManagementDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [currentDock, setCurrentDock] = useState<Dock | null>(null);

  // Query to fetch docks for the facility
  const {
    data: docks,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["/api/facilities", facility.id, "docks"],
    queryFn: async () => {
      const res = await fetch(`/api/facilities/${facility.id}/docks`);
      if (!res.ok) {
        throw new Error(`Failed to fetch docks: ${res.statusText}`);
      }
      return res.json();
    },
    enabled: isOpen, // Only fetch when dialog is open
  });

  // Create dock form
  const createForm = useForm<DockFormValues>({
    resolver: zodResolver(dockSchema),
    defaultValues: {
      name: "",
      type: "dry",
      customType: null,
      isActive: true,
      facilityId: facility.id,
    },
  });

  // Create dock mutation
  const createDockMutation = useMutation({
    mutationFn: async (values: DockFormValues) => {
      console.log("Creating dock with data:", values);
      const res = await apiRequest("POST", `/api/facilities/${facility.id}/docks`, values);
      
      if (!res.ok) {
        const errorData = await res.json();
        console.error("Dock creation error:", errorData);
        throw new Error(errorData.message || "Failed to create dock");
      }
      
      return await res.json();
    },
    onSuccess: (data) => {
      console.log("Dock created successfully:", data);
      queryClient.invalidateQueries({ queryKey: ["/api/facilities", facility.id, "docks"] });
      setIsAddDialogOpen(false);
      createForm.reset();
      toast({
        title: "Success",
        description: "Dock added successfully",
      });
    },
    onError: (error: Error) => {
      console.error("Dock creation error:", error);
      toast({
        title: "Error",
        description: `Failed to add dock: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Edit form
  const editForm = useForm<DockFormValues>({
    resolver: zodResolver(dockSchema),
    defaultValues: {
      name: "",
      type: "dry",
      customType: null,
      isActive: true,
      facilityId: facility.id,
    },
  });

  // Update dock mutation
  const updateDockMutation = useMutation({
    mutationFn: async (values: DockFormValues) => {
      console.log("Updating dock with data:", values);
      
      const res = await apiRequest("PUT", `/api/docks/${values.id}`, values);
      
      if (!res.ok) {
        const errorData = await res.json();
        console.error("Dock update error:", errorData);
        throw new Error(errorData.message || "Failed to update dock");
      }
      
      return await res.json();
    },
    onSuccess: (data) => {
      console.log("Dock updated successfully:", data);
      queryClient.invalidateQueries({ queryKey: ["/api/facilities", facility.id, "docks"] });
      setIsEditDialogOpen(false);
      setCurrentDock(null);
      toast({
        title: "Success",
        description: "Dock updated successfully",
      });
    },
    onError: (error: Error) => {
      console.error("Dock update error:", error);
      toast({
        title: "Error",
        description: `Failed to update dock: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Delete dock mutation
  const deleteDockMutation = useMutation({
    mutationFn: async (id: number) => {
      console.log(`Deleting dock ID: ${id}`);
      const res = await apiRequest("DELETE", `/api/docks/${id}`);
      
      if (!res.ok) {
        const errorData = await res.json();
        console.error("Dock deletion error:", errorData);
        throw new Error(errorData.message || "Failed to delete dock");
      }
      
      return res.ok;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/facilities", facility.id, "docks"] });
      toast({
        title: "Success",
        description: "Dock deleted successfully",
      });
    },
    onError: (error: Error) => {
      console.error("Dock deletion error:", error);
      toast({
        title: "Error",
        description: `Failed to delete dock: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Handle form submission for creating a dock
  const handleCreateSubmit = (values: DockFormValues) => {
    createDockMutation.mutate(values);
  };

  // Handle edit button click
  const handleEditClick = (dock: Dock) => {
    setCurrentDock(dock);
    
    // Set the form values
    editForm.reset({
      id: dock.id,
      name: dock.name,
      type: dock.type as DoorType,
      customType: dock.customType || null,
      isActive: dock.isActive,
      facilityId: dock.facilityId,
    });
    
    setIsEditDialogOpen(true);
  };

  // Handle form submission for updating a dock
  const handleEditSubmit = (values: DockFormValues) => {
    updateDockMutation.mutate(values);
  };

  // Handle delete button click
  const handleDeleteClick = (dock: Dock) => {
    deleteDockMutation.mutate(dock.id);
  };

  // Watch for changes in the door type to show/hide custom type field
  const createDoorType = createForm.watch("type");
  const editDoorType = editForm.watch("type");

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Door Configuration for {facility.name}</DialogTitle>
          <DialogDescription>
            Manage the dock doors for this facility. Configure names and types for each door.
          </DialogDescription>
        </DialogHeader>

        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium">Doors</h3>
          <Button 
            onClick={() => setIsAddDialogOpen(true)}
            className="bg-green-600 hover:bg-green-700"
          >
            <Plus className="mr-2 h-4 w-4" /> Add Door
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center p-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded">
            Error loading doors: {error instanceof Error ? error.message : "Unknown error"}
          </div>
        ) : (
          <div className="border rounded-md">
            <Table>
              <TableHeader className="bg-gray-100">
                <TableRow>
                  <TableHead className="w-[60px] text-center font-bold">ID</TableHead>
                  <TableHead className="font-bold">Door Name</TableHead>
                  <TableHead className="font-bold">Type</TableHead>
                  <TableHead className="font-bold">Status</TableHead>
                  <TableHead className="w-[120px] text-center font-bold">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {docks?.length > 0 ? (
                  docks.map((dock: Dock) => (
                    <TableRow key={dock.id}>
                      <TableCell className="text-center">{dock.id}</TableCell>
                      <TableCell>{dock.name}</TableCell>
                      <TableCell>
                        {dock.type === "custom" ? dock.customType : 
                          doorTypes.find(t => t.value === dock.type)?.label || dock.type}
                      </TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded-full text-sm ${
                          dock.isActive 
                          ? "bg-green-100 text-green-800" 
                          : "bg-gray-100 text-gray-800"
                        }`}>
                          {dock.isActive ? "Active" : "Inactive"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-center space-x-2">
                          <Button 
                            variant="outline" 
                            size="icon" 
                            className="h-8 w-8 p-0 bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-600"
                            onClick={() => handleEditClick(dock)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button 
                                variant="outline" 
                                size="icon" 
                                className="h-8 w-8 p-0 bg-red-50 hover:bg-red-100 border-red-200 text-red-600"
                              >
                                <Trash className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This action cannot be undone. This will permanently delete the door
                                  "{dock.name}" and remove it from the system.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction 
                                  onClick={() => handleDeleteClick(dock)}
                                  className="bg-red-600 hover:bg-red-700"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                      No doors found for this facility. Click "Add Door" to create one.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}

        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Add Door Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add New Door</DialogTitle>
            <DialogDescription>
              Enter the details for the new door
            </DialogDescription>
          </DialogHeader>
          
          <Form {...createForm}>
            <form onSubmit={createForm.handleSubmit(handleCreateSubmit)} className="space-y-4">
              <FormField
                control={createForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Door Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter door name (e.g., D1, Door 1)" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={createForm.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Door Type</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a door type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {doorTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {createDoorType === "custom" && (
                <FormField
                  control={createForm.control}
                  name="customType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Custom Type Name</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Enter custom door type" 
                          {...field} 
                          value={field.value || ""}
                          onChange={(e) => field.onChange(e.target.value)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              
              <FormField
                control={createForm.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                    <FormControl>
                      <input
                        type="checkbox"
                        checked={field.value}
                        onChange={field.onChange}
                        className="h-4 w-4 mt-1"
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Active</FormLabel>
                      <p className="text-sm text-muted-foreground">
                        Door is available for scheduling
                      </p>
                    </div>
                  </FormItem>
                )}
              />
              
              <DialogFooter className="mt-6">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsAddDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createDockMutation.isPending}
                >
                  {createDockMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    "Add Door"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Door Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Door</DialogTitle>
            <DialogDescription>
              Update the door details
            </DialogDescription>
          </DialogHeader>
          
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(handleEditSubmit)} className="space-y-4">
              <FormField
                control={editForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Door Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter door name (e.g., D1, Door 1)" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={editForm.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Door Type</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a door type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {doorTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {editDoorType === "custom" && (
                <FormField
                  control={editForm.control}
                  name="customType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Custom Type Name</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Enter custom door type" 
                          {...field} 
                          value={field.value || ""}
                          onChange={(e) => field.onChange(e.target.value)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              
              <FormField
                control={editForm.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                    <FormControl>
                      <input
                        type="checkbox"
                        checked={field.value}
                        onChange={field.onChange}
                        className="h-4 w-4 mt-1"
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Active</FormLabel>
                      <p className="text-sm text-muted-foreground">
                        Door is available for scheduling
                      </p>
                    </div>
                  </FormItem>
                )}
              />
              
              <DialogFooter className="mt-6">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsEditDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={updateDockMutation.isPending}
                >
                  {updateDockMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    "Update Door"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}