import { useState, useEffect } from "react";
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
import { BookingPage, insertBookingPageSchema } from "@shared/schema";
import { Loader2 } from "lucide-react";

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

export default function BookingPageForm({ bookingPage, onSuccess, onCancel }: BookingPageFormProps) {
  const { toast } = useToast();
  const [selectedFacilities, setSelectedFacilities] = useState<number[]>([]);

  // Facilities query for dropdown
  const { data: facilities, isLoading: isLoadingFacilities } = useQuery({
    queryKey: ['/api/facilities'],
    retry: false
  });

  // Get appointment types query for each facility
  const { data: appointmentTypes, isLoading: isLoadingAppointmentTypes } = useQuery({
    queryKey: ['/api/appointment-types'],
    enabled: !!facilities,
    retry: false
  });

  // Initialize form with default values or existing booking page
  const form = useForm<z.infer<typeof bookingPageFormSchema>>({
    resolver: zodResolver(bookingPageFormSchema),
    defaultValues: bookingPage
      ? {
          name: bookingPage.name,
          slug: bookingPage.slug,
          title: bookingPage.title,
          description: bookingPage.description,
          introText: bookingPage.introText,
          successMessage: bookingPage.successMessage,
          logoUrl: bookingPage.logoUrl,
          primaryColor: bookingPage.primaryColor || "#22c55e",
          isActive: bookingPage.isActive
        }
      : {
          name: "",
          slug: "",
          title: "",
          description: "",
          introText: "Book your appointment online",
          successMessage: "Your appointment has been successfully booked.",
          logoUrl: "",
          primaryColor: "#22c55e",
          isActive: true
        }
  });

  // Initialize selected facilities if editing
  useEffect(() => {
    if (bookingPage && bookingPage.facilities) {
      const facilityIds = Array.isArray(bookingPage.facilities) 
        ? bookingPage.facilities
        : typeof bookingPage.facilities === 'object' && bookingPage.facilities !== null
          ? Object.keys(bookingPage.facilities).map(id => Number(id))
          : [];
      
      setSelectedFacilities(facilityIds);
    }
  }, [bookingPage]);

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: z.infer<typeof bookingPageFormSchema>) => {
      // Convert selected facilities to the expected format (JSON object)
      const facilitiesData = {};
      selectedFacilities.forEach(facilityId => {
        facilitiesData[facilityId] = {
          selected: true,
          appointmentTypes: {}
        };
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
      const facilitiesData = {};
      selectedFacilities.forEach(facilityId => {
        facilitiesData[facilityId] = {
          selected: true,
          appointmentTypes: {}
        };
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
            name="introText"
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
            name="successMessage"
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="logoUrl"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Logo URL</FormLabel>
                <FormControl>
                  <Input
                    placeholder="https://example.com/logo.png"
                    {...field}
                    value={field.value || ""}
                  />
                </FormControl>
                <FormDescription>
                  URL to the logo displayed on the booking page.
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

        <Accordion type="single" collapsible defaultValue="facilities" className="w-full">
          <AccordionItem value="facilities">
            <AccordionTrigger>Facilities & Appointment Types</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4">
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