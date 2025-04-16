import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { apiRequest } from "@/lib/queryClient";
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
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
import { Button } from "@/components/ui/button";
import { Loader2, Pencil, Trash, Plus } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

// Define the facility schema for form validation
const facilitySchema = z.object({
  id: z.number().optional(),
  name: z.string().min(2, "Name must be at least 2 characters"),
  address1: z.string().min(2, "Address line 1 is required"),
  address2: z.string().optional(),
  city: z.string().min(2, "City is required"),
  state: z.string().min(2, "State is required"),
  pincode: z.string().min(5, "Postal code is required"),
  country: z.string().min(2, "Country is required"),
});

type FacilityFormValues = z.infer<typeof facilitySchema>;

interface Facility {
  id: number;
  name: string;
  address1: string;
  address2?: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
}

export default function FacilityMaster() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [currentFacility, setCurrentFacility] = useState<Facility | null>(null);
  const [entriesPerPage, setEntriesPerPage] = useState(10);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // Mock data for demonstration
  const mockFacilities: Facility[] = [
    {
      id: 1,
      name: "Sam Prime Products",
      address1: "450 Airtech Pkwy",
      address2: "Sam Prime Products, Floor Loaded Container Drop (4+ Hours Unloading)",
      city: "Indianapolis",
      state: "IN",
      pincode: "46168",
      country: "USA"
    },
    {
      id: 2,
      name: "Hanzo Cold Chain",
      address1: "4001 W Minnesota Street",
      address2: "A",
      city: "Indianapolis",
      state: "IN",
      pincode: "46241",
      country: "USA"
    },
    {
      id: 3,
      name: "Hanzo Brownsburg",
      address1: "9915 Lacy Knot Dr",
      address2: "Suite 200",
      city: "Brownsburg",
      state: "IN",
      pincode: "46112",
      country: "USA"
    },
    {
      id: 4,
      name: "Hanzo Metro",
      address1: "4334 Plainfield Road",
      address2: "A",
      city: "Indianapolis",
      state: "IN", 
      pincode: "46321",
      country: "USA"
    },
    {
      id: 5,
      name: "Camby Road",
      address1: "8370 E Camby Road",
      address2: "Suite 103",
      city: "Camby",
      state: "IN",
      pincode: "46168",
      country: "USA"
    },
    {
      id: 6,
      name: "450 Airtech",
      address1: "450 Airtech Pkwy Plainfield IN 46168",
      address2: "A",
      city: "Plainfield",
      state: "IN",
      pincode: "46168",
      country: "USA"
    }
  ];

  // Fetch facilities (using mock data for now)
  const { data: facilities, isLoading, error } = useQuery({
    queryKey: ["/api/facilities"],
    queryFn: async () => {
      // In a real implementation, you would fetch from the backend
      // const response = await fetch("/api/facilities");
      // if (!response.ok) {
      //   throw new Error("Failed to fetch facilities");
      // }
      // return response.json() as Promise<Facility[]>;
      
      // For now, return mock data
      return Promise.resolve(mockFacilities);
    },
  });

  // Create form
  const createForm = useForm<FacilityFormValues>({
    resolver: zodResolver(facilitySchema),
    defaultValues: {
      name: "",
      address1: "",
      address2: "",
      city: "",
      state: "",
      pincode: "",
      country: "USA"
    }
  });

  // Create facility mutation
  const createFacilityMutation = useMutation({
    mutationFn: async (values: FacilityFormValues) => {
      // In a real implementation, you would send to the backend
      // const res = await apiRequest("POST", "/api/facilities", values);
      // return res.json();
      
      // For now, just return the values with a mock ID
      return Promise.resolve({ ...values, id: Math.floor(Math.random() * 1000) });
    },
    onSuccess: () => {
      // queryClient.invalidateQueries({ queryKey: ["/api/facilities"] });
      setIsCreateDialogOpen(false);
      createForm.reset();
      toast({
        title: "Success",
        description: "Facility created successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Failed to create facility: ${error.message}`,
        variant: "destructive",
      });
    }
  });

  // Edit form
  const editForm = useForm<FacilityFormValues>({
    resolver: zodResolver(facilitySchema),
    defaultValues: {
      name: "",
      address1: "",
      address2: "",
      city: "",
      state: "",
      pincode: "",
      country: "USA"
    }
  });

  // Update facility mutation
  const updateFacilityMutation = useMutation({
    mutationFn: async (values: FacilityFormValues) => {
      // In a real implementation, you would send to the backend
      // const res = await apiRequest("PUT", `/api/facilities/${values.id}`, values);
      // return res.json();
      
      // For now, just return the values
      return Promise.resolve(values);
    },
    onSuccess: () => {
      // queryClient.invalidateQueries({ queryKey: ["/api/facilities"] });
      setIsEditDialogOpen(false);
      setCurrentFacility(null);
      toast({
        title: "Success",
        description: "Facility updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Failed to update facility: ${error.message}`,
        variant: "destructive",
      });
    }
  });

  // Delete facility mutation
  const deleteFacilityMutation = useMutation({
    mutationFn: async (id: number) => {
      // In a real implementation, you would send to the backend
      // const res = await apiRequest("DELETE", `/api/facilities/${id}`);
      // return res.ok;
      
      // For now, just return true
      return Promise.resolve(true);
    },
    onSuccess: () => {
      // queryClient.invalidateQueries({ queryKey: ["/api/facilities"] });
      toast({
        title: "Success",
        description: "Facility deleted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Failed to delete facility: ${error.message}`,
        variant: "destructive",
      });
    }
  });

  const handleCreateSubmit = (values: FacilityFormValues) => {
    createFacilityMutation.mutate(values);
  };

  const handleEditClick = (facility: Facility) => {
    setCurrentFacility(facility);
    editForm.reset({
      id: facility.id,
      name: facility.name,
      address1: facility.address1,
      address2: facility.address2 || "",
      city: facility.city,
      state: facility.state,
      pincode: facility.pincode,
      country: facility.country
    });
    setIsEditDialogOpen(true);
  };

  const handleEditSubmit = (values: FacilityFormValues) => {
    updateFacilityMutation.mutate(values);
  };

  const handleDeleteClick = (facility: Facility) => {
    deleteFacilityMutation.mutate(facility.id);
  };

  // Filter facilities based on search query
  const filteredFacilities = facilities?.filter((facility) => {
    if (!searchQuery) return true;
    
    const query = searchQuery.toLowerCase();
    return (
      facility.name.toLowerCase().includes(query) ||
      facility.address1.toLowerCase().includes(query) ||
      (facility.address2?.toLowerCase() || "").includes(query) ||
      facility.city.toLowerCase().includes(query) ||
      facility.state.toLowerCase().includes(query) ||
      facility.pincode.toLowerCase().includes(query) ||
      facility.country.toLowerCase().includes(query)
    );
  });

  // Paginate facilities
  const paginatedFacilities = filteredFacilities?.slice(
    (currentPage - 1) * entriesPerPage,
    currentPage * entriesPerPage
  );

  // Calculate total pages
  const totalPages = filteredFacilities
    ? Math.ceil(filteredFacilities.length / entriesPerPage)
    : 1;

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
          Error loading facilities: {error instanceof Error ? error.message : "Unknown error"}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <h1 className="text-3xl font-bold text-center mb-6">Facility Master</h1>
      
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center space-x-2">
          <span>Show</span>
          <Select
            value={entriesPerPage.toString()}
            onValueChange={(value) => setEntriesPerPage(parseInt(value))}
          >
            <SelectTrigger className="w-[70px]">
              <SelectValue placeholder="10" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="5">5</SelectItem>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="25">25</SelectItem>
              <SelectItem value="50">50</SelectItem>
            </SelectContent>
          </Select>
          <span>entries</span>
        </div>

        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <span>Search:</span>
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-[200px] md:w-[300px]"
            />
          </div>
          
          <Button 
            onClick={() => setIsCreateDialogOpen(true)}
            className="bg-green-600 hover:bg-green-700"
          >
            <Plus className="mr-2 h-4 w-4" /> Add New
          </Button>
        </div>
      </div>
      
      <div className="border rounded-md">
        <Table>
          <TableHeader className="bg-gray-100">
            <TableRow>
              <TableHead className="w-[80px] text-center font-bold">ID</TableHead>
              <TableHead className="font-bold">Facility Name</TableHead>
              <TableHead className="font-bold">Address 1</TableHead>
              <TableHead className="font-bold">Address 2</TableHead>
              <TableHead className="font-bold">Pincode</TableHead>
              <TableHead className="font-bold">Country</TableHead>
              <TableHead className="w-[120px] text-center font-bold">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedFacilities?.map((facility) => (
              <TableRow key={facility.id}>
                <TableCell className="text-center">{facility.id}</TableCell>
                <TableCell>{facility.name}</TableCell>
                <TableCell>{facility.address1}</TableCell>
                <TableCell>{facility.address2 || ""}</TableCell>
                <TableCell>{facility.pincode}</TableCell>
                <TableCell>{facility.country}</TableCell>
                <TableCell>
                  <div className="flex justify-center space-x-2">
                    <Button 
                      variant="outline" 
                      size="icon" 
                      className="h-8 w-8 p-0 bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-600"
                      onClick={() => handleEditClick(facility)}
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
                            This action cannot be undone. This will permanently delete the facility
                            "{facility.name}" and may affect related data.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction 
                            onClick={() => handleDeleteClick(facility)}
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
            ))}

            {(paginatedFacilities?.length || 0) === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No facilities found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex justify-between items-center">
        <Button
          variant="outline"
          onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
          disabled={currentPage === 1}
        >
          Previous
        </Button>

        <div className="text-center">
          <span className="px-3 py-1 bg-gray-100 rounded-full">{currentPage}</span>
        </div>

        <Button
          variant="outline"
          onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
          disabled={currentPage === totalPages}
        >
          Next
        </Button>
      </div>

      {/* Create Facility Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Add New Facility</DialogTitle>
            <DialogDescription>
              Enter the details for the new facility
            </DialogDescription>
          </DialogHeader>
          
          <Form {...createForm}>
            <form onSubmit={createForm.handleSubmit(handleCreateSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={createForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Facility Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter facility name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={createForm.control}
                  name="address1"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address Line 1</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter address line 1" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={createForm.control}
                  name="address2"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address Line 2</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter address line 2 (optional)" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={createForm.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>City</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter city" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={createForm.control}
                  name="state"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>State/Province</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter state or province" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={createForm.control}
                  name="pincode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Postal Code</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter postal code" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={createForm.control}
                  name="country"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Country</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a country" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="USA">USA</SelectItem>
                          <SelectItem value="Canada">Canada</SelectItem>
                          <SelectItem value="Mexico">Mexico</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <DialogFooter className="mt-6">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsCreateDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createFacilityMutation.isPending}
                >
                  {createFacilityMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create Facility"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Facility Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Edit Facility</DialogTitle>
            <DialogDescription>
              Update facility information
            </DialogDescription>
          </DialogHeader>
          
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(handleEditSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Facility Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter facility name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={editForm.control}
                  name="address1"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address Line 1</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter address line 1" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={editForm.control}
                  name="address2"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address Line 2</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter address line 2 (optional)" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={editForm.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>City</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter city" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={editForm.control}
                  name="state"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>State/Province</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter state or province" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={editForm.control}
                  name="pincode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Postal Code</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter postal code" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={editForm.control}
                  name="country"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Country</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a country" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="USA">USA</SelectItem>
                          <SelectItem value="Canada">Canada</SelectItem>
                          <SelectItem value="Mexico">Mexico</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
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
                  disabled={updateFacilityMutation.isPending}
                >
                  {updateFacilityMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    "Update Facility"
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