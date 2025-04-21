import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
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
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { BookingPage, insertBookingPageSchema } from "@shared/schema";
import { Loader2, Search } from "lucide-react";

// Extend the schema for frontend validation
const bookingPageFormSchema = insertBookingPageSchema.extend({
  name: z.string().min(3, "Name must be at least 3 characters"),
  slug: z.string().min(3, "Slug must be at least 3 characters")
    .regex(/^[a-z0-9-]+$/, "Slug can only contain lowercase letters, numbers, and hyphens"),
  title: z.string().min(3, "Title must be at least 3 characters"),
});

type BookingPageFormProps = {
  bookingPage?: BookingPage;
  onSuccess: () => void;
  onCancel: () => void;
};

// Type definitions for facilities and appointment types
type Facility = {
  id: number;
  name: string;
  address1: string;
  city: string;
  state: string;
  [key: string]: any;
};

type AppointmentType = {
  id: number;
  name: string;
  description: string;
  facilityId: number;
  duration: number;
  color: string;
  type: string;
  [key: string]: any;
};

export default function BookingPageForm({ bookingPage, onSuccess, onCancel }: BookingPageFormProps) {
  const { toast } = useToast();
  const [selectedFacilities, setSelectedFacilities] = useState<number[]>([]);
  const [selectedAppointmentTypes, setSelectedAppointmentTypes] = useState<Record<number, number[]>>({});
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [openAccordionItems, setOpenAccordionItems] = useState<string[]>([]);

  // Queries for data
  const { data: facilitiesData = [], isLoading: isLoadingFacilities } = useQuery<Facility[]>({
    queryKey: ['/api/facilities'],
    retry: false
  });

  // Get appointment types query for each facility
  const { data: appointmentTypesData, isLoading: isLoadingAppointmentTypes } = useQuery<Record<string, AppointmentType>>({
    queryKey: ['/api/appointment-types'],
    enabled: !!facilitiesData,
    retry: false
  });
  
  // Type safe references to the data
  const facilities = facilitiesData;
  const appointmentTypes = appointmentTypesData || {};

  // Initialize form with default values or existing booking page
  const form = useForm<z.infer<typeof bookingPageFormSchema>>({
    resolver: zodResolver(bookingPageFormSchema),
    defaultValues: bookingPage
      ? {
          name: bookingPage.name,
          slug: bookingPage.slug,
          title: bookingPage.title,
          description: bookingPage.description,
          welcomeMessage: bookingPage.welcomeMessage,
          confirmationMessage: bookingPage.confirmationMessage,
          customLogo: bookingPage.customLogo,
          useOrganizationLogo: bookingPage.useOrganizationLogo,
          primaryColor: bookingPage.primaryColor || "#22c55e",
          isActive: bookingPage.isActive
        }
      : {
          name: "",
          slug: "",
          title: "",
          description: "",
          welcomeMessage: "Book your appointment online",
          confirmationMessage: "Your appointment has been successfully booked.",
          customLogo: "",
          useOrganizationLogo: true,
          primaryColor: "#22c55e",
          isActive: true
        }
  });

  // Initialize selected facilities and appointment types if editing
  useEffect(() => {
    if (bookingPage && bookingPage.facilities) {
      if (typeof bookingPage.facilities === 'object' && bookingPage.facilities !== null) {
        // Extract facility IDs
        const facilityIds = Object.keys(bookingPage.facilities).map(id => Number(id));
        setSelectedFacilities(facilityIds);
        
        // Extract appointment types for each facility
        const appointmentTypesMap: Record<number, number[]> = {};
        
        Object.entries(bookingPage.facilities).forEach(([facilityId, facilityData]) => {
          const facilityIdNum = Number(facilityId);
          
          if (facilityData && facilityData.appointmentTypes) {
            const appointmentTypeIds = Object.keys(facilityData.appointmentTypes)
              .filter(typeId => facilityData.appointmentTypes[typeId]?.selected)
              .map(id => Number(id));
              
            appointmentTypesMap[facilityIdNum] = appointmentTypeIds;
          } else {
            appointmentTypesMap[facilityIdNum] = [];
          }
        });
        
        setSelectedAppointmentTypes(appointmentTypesMap);
        
        // Set initial open accordion items for facilities with selections
        const openItems = facilityIds.map(id => `facility-${id}`);
        setOpenAccordionItems(openItems);
      } else if (Array.isArray(bookingPage.facilities)) {
        setSelectedFacilities(bookingPage.facilities);
      }
    }
  }, [bookingPage]);
  
  // Filtered appointment types based on search term
  const filteredAppointmentTypes = useMemo(() => {
    if (!appointmentTypes) return {};
    
    if (!searchTerm.trim()) return appointmentTypes;
    
    const filtered = {};
    for (const typeId in appointmentTypes) {
      const appointmentType = appointmentTypes[typeId];
      if (appointmentType.name.toLowerCase().includes(searchTerm.toLowerCase())) {
        filtered[typeId] = appointmentType;
      }
    }
    
    return filtered;
  }, [appointmentTypes, searchTerm]);
  
  // Toggle appointment type selection
  const toggleAppointmentType = (facilityId: number, appointmentTypeId: number, checked: boolean) => {
    setSelectedAppointmentTypes(prev => {
      const updatedMap = { ...prev };
      
      if (!updatedMap[facilityId]) {
        updatedMap[facilityId] = [];
      }
      
      if (checked) {
        if (!updatedMap[facilityId].includes(appointmentTypeId)) {
          updatedMap[facilityId] = [...updatedMap[facilityId], appointmentTypeId];
        }
      } else {
        updatedMap[facilityId] = updatedMap[facilityId].filter(id => id !== appointmentTypeId);
      }
      
      // Update booking page in real-time
      if (bookingPage) {
        updateAppointmentTypesInBookingPage(updatedMap);
      }
      
      return updatedMap;
    });
  };
  
  // Real-time update of appointment types in the booking page
  const updateAppointmentTypesInBookingPage = async (appointmentTypesMap: Record<number, number[]>) => {
    if (!bookingPage) return;
    
    try {
      // Convert to the expected format
      const facilitiesData: Record<string, any> = {};
      
      selectedFacilities.forEach(facilityId => {
        facilitiesData[facilityId] = {
          selected: true,
          appointmentTypes: {}
        };
        
        const selectedTypes = appointmentTypesMap[facilityId] || [];
        
        if (appointmentTypes) {
          Object.keys(appointmentTypes)
            .map(Number)
            .filter(typeId => appointmentTypes[typeId].facilityId === facilityId)
            .forEach(typeId => {
              facilitiesData[facilityId].appointmentTypes[typeId] = {
                selected: selectedTypes.includes(typeId)
              };
            });
        }
      });
      
      const payload = {
        ...form.getValues(),
        facilities: facilitiesData
      };
      
      await apiRequest('PUT', `/api/booking-pages/${bookingPage.id}`, payload);
      queryClient.invalidateQueries({ queryKey: ['/api/booking-pages'] });
    } catch (error) {
      console.error("Error updating appointment types:", error);
    }
  };

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: z.infer<typeof bookingPageFormSchema>) => {
      // Convert selected facilities to the expected format (JSON object)
      const facilitiesData: Record<string, any> = {};
      
      selectedFacilities.forEach(facilityId => {
        facilitiesData[facilityId] = {
          selected: true,
          appointmentTypes: {}
        };
        
        const selectedTypes = selectedAppointmentTypes[facilityId] || [];
        
        if (appointmentTypes) {
          Object.keys(appointmentTypes)
            .map(Number)
            .filter(typeId => appointmentTypes[typeId].facilityId === facilityId)
            .forEach(typeId => {
              if (!facilitiesData[facilityId].appointmentTypes) {
                facilitiesData[facilityId].appointmentTypes = {};
              }
              facilitiesData[facilityId].appointmentTypes[typeId] = {
                selected: selectedTypes.includes(typeId)
              };
            });
        }
      });

      const payload = {
        ...data,
        facilities: facilitiesData
      };

      const response = await apiRequest('POST', '/api/booking-pages', payload);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Booking page created successfully",
        variant: "default",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/booking-pages'] });
      onSuccess();
    },
    onError: (error) => {
      console.error("Error creating booking page:", error);
      toast({
        title: "Error",
        description: "Failed to create booking page",
        variant: "destructive",
      });
    }
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data: z.infer<typeof bookingPageFormSchema>) => {
      if (!bookingPage) return null;

      // Convert selected facilities to the expected format (JSON object)
      const facilitiesData: Record<string, any> = {};
      
      selectedFacilities.forEach(facilityId => {
        facilitiesData[facilityId] = {
          selected: true,
          appointmentTypes: {}
        };
        
        const selectedTypes = selectedAppointmentTypes[facilityId] || [];
        
        if (appointmentTypes) {
          Object.keys(appointmentTypes)
            .map(Number)
            .filter(typeId => appointmentTypes[typeId].facilityId === facilityId)
            .forEach(typeId => {
              if (!facilitiesData[facilityId].appointmentTypes) {
                facilitiesData[facilityId].appointmentTypes = {};
              }
              facilitiesData[facilityId].appointmentTypes[typeId] = {
                selected: selectedTypes.includes(typeId)
              };
            });
        }
      });

      const payload = {
        ...data,
        facilities: facilitiesData
      };

      const response = await apiRequest('PUT', `/api/booking-pages/${bookingPage.id}`, payload);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Booking page updated successfully",
        variant: "default",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/booking-pages'] });
      onSuccess();
    },
    onError: (error) => {
      console.error("Error updating booking page:", error);
      toast({
        title: "Error",
        description: "Failed to update booking page",
        variant: "destructive",
      });
    }
  });

  // Handle form submission
  const onSubmit = (data: z.infer<typeof bookingPageFormSchema>) => {
    if (selectedFacilities.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one facility",
        variant: "destructive",
      });
      return;
    }

    if (bookingPage) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  // Toggle facility selection
  const toggleFacility = (facilityId: number, checked: boolean) => {
    if (checked) {
      setSelectedFacilities(prev => [...prev, facilityId]);
    } else {
      setSelectedFacilities(prev => prev.filter(id => id !== facilityId));
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;
  const isLoading = isLoadingFacilities || isLoadingAppointmentTypes;

  // Helper to slugify the name
  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Basic Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Enter booking page name"
                    {...field}
                    onChange={(e) => {
                      field.onChange(e);
                      
                      // If this is a new booking page and slug is empty, generate a slug
                      if (!bookingPage && !form.getValues("slug")) {
                        form.setValue("slug", generateSlug(e.target.value));
                      }
                    }}
                  />
                </FormControl>
                <FormDescription>
                  Internal name for this booking page.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="slug"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Slug</FormLabel>
                <FormControl>
                  <Input
                    placeholder="booking-page-url"
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  URL-friendly identifier. Used in the page URL.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Page Title</FormLabel>
              <FormControl>
                <Input
                  placeholder="Enter page title"
                  {...field}
                />
              </FormControl>
              <FormDescription>
                Title displayed to users on the booking page.
              </FormDescription>
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
                <Textarea
                  placeholder="Enter page description"
                  {...field}
                  value={field.value || ""}
                />
              </FormControl>
              <FormDescription>
                Brief description of the booking page.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="welcomeMessage"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Introduction Text</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Welcome message for visitors"
                    {...field}
                    value={field.value || ""}
                  />
                </FormControl>
                <FormDescription>
                  Introduction text displayed at the top of the booking page.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="confirmationMessage"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Success Message</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Message shown after successful booking"
                    {...field}
                    value={field.value || ""}
                  />
                </FormControl>
                <FormDescription>
                  Message displayed after a successful booking.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="useOrganizationLogo"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <FormLabel className="text-base">Use Organization Logo</FormLabel>
                <FormDescription>
                  Use the logo from organization settings.
                </FormDescription>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="customLogo"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Custom Logo URL</FormLabel>
                <FormControl>
                  <Input
                    placeholder="https://example.com/logo.png"
                    {...field}
                    value={field.value || ""}
                    disabled={form.getValues("useOrganizationLogo")}
                  />
                </FormControl>
                <FormDescription>
                  URL to a custom logo if not using organization logo.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="primaryColor"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Primary Color</FormLabel>
                <div className="flex gap-2">
                  <FormControl>
                    <Input
                      type="color"
                      {...field}
                      value={field.value || "#22c55e"}
                      className="w-12 h-9 p-1"
                    />
                  </FormControl>
                  <FormControl>
                    <Input
                      type="text"
                      {...field}
                      value={field.value || "#22c55e"}
                      className="flex-1"
                    />
                  </FormControl>
                </div>
                <FormDescription>
                  Primary color for the booking page theme.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="isActive"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <FormLabel className="text-base">Active Status</FormLabel>
                <FormDescription>
                  Enable or disable this booking page.
                </FormDescription>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
            </FormItem>
          )}
        />

        <Accordion 
          type="multiple" 
          value={openAccordionItems}
          onValueChange={setOpenAccordionItems}
          className="w-full"
        >
          <AccordionItem value="facilities" className="border-b">
            <AccordionTrigger>Facilities & Appointment Types</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-6">
                <div>
                  <div className="font-medium">Select Facilities</div>
                  <div className="text-sm text-muted-foreground mb-2">
                    Choose which facilities should be available for booking on this page.
                  </div>

                  {isLoading ? (
                    <div className="flex justify-center py-4">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {facilities && facilities.length > 0 ? (
                        facilities.map((facility) => (
                          <div key={facility.id} className="flex items-start space-x-2 p-2 border rounded-md">
                            <Checkbox
                              id={`facility-${facility.id}`}
                              checked={selectedFacilities.includes(facility.id)}
                              onCheckedChange={(checked) => 
                                toggleFacility(facility.id, checked as boolean)
                              }
                            />
                            <div className="grid gap-1.5 leading-none">
                              <Label
                                htmlFor={`facility-${facility.id}`}
                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                              >
                                {facility.name}
                              </Label>
                              <p className="text-sm text-muted-foreground">
                                {facility.address1}, {facility.city}, {facility.state}
                              </p>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-4 text-muted-foreground">
                          No facilities found. Please create facilities first.
                        </div>
                      )}
                    </div>
                  )}
                </div>
                
                {selectedFacilities.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">Select Appointment Types</div>
                        <div className="text-sm text-muted-foreground">
                          Choose which appointment types should be available on this booking page.
                        </div>
                      </div>
                      <div className="relative w-[200px]">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search appointment types"
                          className="pl-8"
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                        />
                      </div>
                    </div>
                    
                    <Accordion
                      type="multiple"
                      className="space-y-2"
                      value={openAccordionItems}
                      onValueChange={setOpenAccordionItems}
                    >
                      {facilities
                        .filter(facility => selectedFacilities.includes(facility.id))
                        .map(facility => {
                          // Filter appointment types for this facility
                          const facilityAppointmentTypes = appointmentTypes
                            ? Object.values(appointmentTypes)
                                .filter(type => type.facilityId === facility.id)
                            : [];
                            
                          // Apply search filter if there's a search term
                          const filteredTypes = searchTerm
                            ? facilityAppointmentTypes.filter(type => 
                                type.name.toLowerCase().includes(searchTerm.toLowerCase()))
                            : facilityAppointmentTypes;
                          
                          // Count how many are selected
                          const selectedCount = selectedAppointmentTypes[facility.id]?.length || 0;
                          
                          return (
                            <AccordionItem 
                              key={`facility-types-${facility.id}`} 
                              value={`facility-${facility.id}`}
                              className="border rounded-md overflow-hidden"
                            >
                              <AccordionTrigger className="px-4 py-2 hover:no-underline hover:bg-muted/50">
                                <div className="flex justify-between w-full items-center">
                                  <span>{facility.name}</span>
                                  <Badge variant="outline" className="ml-2 font-mono">
                                    {selectedCount}/{filteredTypes.length}
                                  </Badge>
                                </div>
                              </AccordionTrigger>
                              <AccordionContent className="p-0">
                                <div className="border-t px-4 py-2 space-y-2">
                                  {filteredTypes.length > 0 ? (
                                    filteredTypes.map(type => (
                                      <div key={type.id} className="flex items-start space-x-2 p-2">
                                        <Checkbox
                                          id={`type-${facility.id}-${type.id}`}
                                          checked={(selectedAppointmentTypes[facility.id] || []).includes(type.id)}
                                          onCheckedChange={(checked) => 
                                            toggleAppointmentType(facility.id, type.id, checked as boolean)
                                          }
                                        />
                                        <div className="grid gap-1 leading-none">
                                          <Label
                                            htmlFor={`type-${facility.id}-${type.id}`}
                                            className="text-sm font-medium leading-none"
                                          >
                                            {type.name}
                                          </Label>
                                          <div className="flex items-center mt-1 space-x-2">
                                            <div 
                                              className="w-3 h-3 rounded-full" 
                                              style={{ backgroundColor: type.color }}
                                            />
                                            <p className="text-xs text-muted-foreground">
                                              {type.type.charAt(0).toUpperCase() + type.type.slice(1)} • {type.duration} min
                                            </p>
                                          </div>
                                        </div>
                                      </div>
                                    ))
                                  ) : searchTerm ? (
                                    <div className="text-center py-2 text-sm text-muted-foreground">
                                      No appointment types match "{searchTerm}".
                                    </div>
                                  ) : (
                                    <div className="text-center py-2 text-sm text-muted-foreground">
                                      No appointment types available for this facility.
                                    </div>
                                  )}
                                </div>
                              </AccordionContent>
                            </AccordionItem>
                          );
                        })}
                    </Accordion>
                  </div>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {bookingPage ? "Updating..." : "Creating..."}
              </>
            ) : (
              <>{bookingPage ? "Update" : "Create"} Booking Page</>
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}