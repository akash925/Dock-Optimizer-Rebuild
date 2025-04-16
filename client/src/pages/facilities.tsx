import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Dock, InsertDock, insertDockSchema } from "@shared/schema";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Form,
  FormControl,
  FormDescription,
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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlusCircle, Pencil, Trash2 } from "lucide-react";

const dockFormSchema = insertDockSchema.extend({
  maxTrailerLength: z.coerce.number().min(20).max(100).optional(),
  requiresForklift: z.boolean().optional(),
});

type DockFormValues = z.infer<typeof dockFormSchema>;

export default function FacilitiesPage() {
  const { toast } = useToast();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [editingDock, setEditingDock] = useState<Dock | null>(null);
  const [deletingDock, setDeletingDock] = useState<Dock | null>(null);

  // Fetch all docks
  const { data: docks = [], isLoading } = useQuery<Dock[]>({
    queryKey: ["/api/docks"],
  });

  // Create new dock
  const createForm = useForm<DockFormValues>({
    resolver: zodResolver(dockFormSchema),
    defaultValues: {
      name: "",
      type: "both",
      isActive: true,
      requiresForklift: false,
      maxTrailerLength: 53,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (values: DockFormValues) => {
      // Convert form values to proper dock structure
      const dockData: InsertDock = {
        name: values.name,
        type: values.type,
        isActive: values.isActive,
        constraints: {
          maxTrailerLength: values.maxTrailerLength || 53,
          requiresForklift: values.requiresForklift || false,
        },
      };
      
      const res = await apiRequest("POST", "/api/docks", dockData);
      return await res.json();
    },
    onSuccess: () => {
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: ["/api/docks"] });
      setIsCreateModalOpen(false);
      createForm.reset();
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
    },
  });

  const handleCreateSubmit = (values: DockFormValues) => {
    createMutation.mutate(values);
  };

  // Edit dock
  const editForm = useForm<DockFormValues>({
    resolver: zodResolver(dockFormSchema),
  });

  const editMutation = useMutation({
    mutationFn: async (values: DockFormValues) => {
      if (!editingDock) return null;
      
      // Convert form values to proper dock structure
      const dockData: Partial<Dock> = {
        name: values.name,
        type: values.type,
        isActive: values.isActive,
        constraints: {
          maxTrailerLength: values.maxTrailerLength || 53,
          requiresForklift: values.requiresForklift || false,
        },
      };
      
      const res = await apiRequest("PUT", `/api/docks/${editingDock.id}`, dockData);
      return await res.json();
    },
    onSuccess: () => {
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: ["/api/docks"] });
      setIsEditModalOpen(false);
      setEditingDock(null);
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
    },
  });

  const handleEditSubmit = (values: DockFormValues) => {
    editMutation.mutate(values);
  };

  // Delete dock
  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!deletingDock) return null;
      
      const res = await apiRequest("DELETE", `/api/docks/${deletingDock.id}`, {});
      if (!res.ok) {
        throw new Error("Failed to delete dock");
      }
      return true;
    },
    onSuccess: () => {
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: ["/api/docks"] });
      setIsDeleteModalOpen(false);
      setDeletingDock(null);
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
    },
  });

  const handleDelete = () => {
    deleteMutation.mutate();
  };

  // Set up editing dock
  const handleEditClick = (dock: Dock) => {
    setEditingDock(dock);
    // Extract constraints for form
    const constraints = dock.constraints || {};
    editForm.reset({
      name: dock.name,
      type: dock.type,
      isActive: dock.isActive,
      maxTrailerLength: (constraints as any).maxTrailerLength || 53,
      requiresForklift: (constraints as any).requiresForklift || false,
    });
    setIsEditModalOpen(true);
  };

  // Set up deleting dock
  const handleDeleteClick = (dock: Dock) => {
    setDeletingDock(dock);
    setIsDeleteModalOpen(true);
  };

  const getDockTypeLabel = (type: string) => {
    switch (type) {
      case "inbound": return "Inbound Only";
      case "outbound": return "Outbound Only";
      case "both": return "Both";
      default: return type;
    }
  };

  return (
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Facilities Management</h1>
        <Button onClick={() => setIsCreateModalOpen(true)}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Add New Dock
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dock Facilities</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-4">Loading docks...</div>
          ) : (
            <Table>
              <TableCaption>List of all dock facilities</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Max Trailer Length</TableHead>
                  <TableHead>Requires Forklift</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {docks.map((dock) => {
                  const constraints = dock.constraints || {};
                  return (
                    <TableRow key={dock.id}>
                      <TableCell className="font-medium">{dock.name}</TableCell>
                      <TableCell>{getDockTypeLabel(dock.type)}</TableCell>
                      <TableCell>
                        <span
                          className={`px-2 py-1 rounded-full text-xs ${
                            dock.isActive
                              ? "bg-green-100 text-green-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {dock.isActive ? "Active" : "Inactive"}
                        </span>
                      </TableCell>
                      <TableCell>{(constraints as any).maxTrailerLength || 53} ft</TableCell>
                      <TableCell>{(constraints as any).requiresForklift ? "Yes" : "No"}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditClick(dock)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteClick(dock)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {docks.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-4">
                      No docks found. Add your first dock to get started.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Dock Modal */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Dock</DialogTitle>
            <DialogDescription>
              Create a new dock facility for scheduling appointments.
            </DialogDescription>
          </DialogHeader>

          <Form {...createForm}>
            <form
              onSubmit={createForm.handleSubmit(handleCreateSubmit)}
              className="space-y-4"
            >
              <FormField
                control={createForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dock Name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="A-01" />
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
                    <FormLabel>Dock Type</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a dock type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="inbound">Inbound Only</SelectItem>
                        <SelectItem value="outbound">Outbound Only</SelectItem>
                        <SelectItem value="both">Both Inbound & Outbound</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={createForm.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-4">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Active</FormLabel>
                      <FormDescription>
                        Whether this dock is currently active and available for scheduling
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
                      <Input type="number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={createForm.control}
                name="requiresForklift"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-4">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Requires Forklift</FormLabel>
                      <FormDescription>
                        Whether this dock requires a forklift for loading/unloading
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending}
                >
                  {createMutation.isPending ? "Creating..." : "Create Dock"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Dock Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Dock</DialogTitle>
            <DialogDescription>
              Update the details of this dock facility.
            </DialogDescription>
          </DialogHeader>

          <Form {...editForm}>
            <form
              onSubmit={editForm.handleSubmit(handleEditSubmit)}
              className="space-y-4"
            >
              <FormField
                control={editForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dock Name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="A-01" />
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
                    <FormLabel>Dock Type</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a dock type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="inbound">Inbound Only</SelectItem>
                        <SelectItem value="outbound">Outbound Only</SelectItem>
                        <SelectItem value="both">Both Inbound & Outbound</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-4">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Active</FormLabel>
                      <FormDescription>
                        Whether this dock is currently active and available for scheduling
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
                      <Input type="number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="requiresForklift"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-4">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Requires Forklift</FormLabel>
                      <FormDescription>
                        Whether this dock requires a forklift for loading/unloading
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={editMutation.isPending}
                >
                  {editMutation.isPending ? "Updating..." : "Update Dock"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete dock {deletingDock?.name}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => setIsDeleteModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete Dock"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}