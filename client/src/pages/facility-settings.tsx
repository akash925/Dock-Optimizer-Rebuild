import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { useForm, ControllerRenderProps } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Facility } from "@shared/schema";

import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Clock, Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Helper function to ensure Input value is always a string
const safeValueAsString = (value: string | null | undefined): string => {
  if (value === null || value === undefined) return "";
  return value;
};

// Reusable component for time inputs that handles null values
interface TimeInputProps {
  field: ControllerRenderProps<any, any>;
  placeholder: string;
}

const TimeInput = ({ field, placeholder }: TimeInputProps) => {
  // Add pattern and title for better browser validation
  return (
    <Input 
      onChange={(e) => {
        // Ensure proper time format HH:MM
        const value = e.target.value;
        field.onChange(value);
        
        // Log to help debug
        console.log(`TimeInput ${field.name} changed to: ${value}`);
      }}
      onBlur={field.onBlur}
      name={field.name}
      ref={field.ref}
      value={safeValueAsString(field.value)}
      placeholder={placeholder}
      pattern="([01]?[0-9]|2[0-3]):[0-5][0-9]"
      title="Enter time in 24-hour format (HH:MM)"
    />
  );
};

// Define facility edit schema with operating hours validation
const facilityEditSchema = z.object({
  // Basic facility information
  name: z.string().min(1, "Facility name is required"),
  address1: z.string().min(1, "Address is required"),
  address2: z.string().optional(),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  pincode: z.string().min(1, "Postal code is required"),
  country: z.string().min(1, "Country is required"),
  timezone: z.string().min(1, "Timezone is required"),
  
  // Operating hours for each day of the week
  mondayOpen: z.boolean(),
  mondayStart: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format. Use HH:MM (24h)"),
  mondayEnd: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format. Use HH:MM (24h)"),
  mondayBreakStart: z.union([
    z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format. Use HH:MM (24h)"),
    z.string().max(0), // empty string
    z.null()
  ]),
  mondayBreakEnd: z.union([
    z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format. Use HH:MM (24h)"),
    z.string().max(0), // empty string
    z.null()
  ]),
  
  tuesdayOpen: z.boolean(),
  tuesdayStart: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format. Use HH:MM (24h)"),
  tuesdayEnd: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format. Use HH:MM (24h)"),
  tuesdayBreakStart: z.union([
    z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format. Use HH:MM (24h)"),
    z.string().max(0), // empty string
    z.null()
  ]),
  tuesdayBreakEnd: z.union([
    z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format. Use HH:MM (24h)"),
    z.string().max(0), // empty string
    z.null()
  ]),
  
  wednesdayOpen: z.boolean(),
  wednesdayStart: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format. Use HH:MM (24h)"),
  wednesdayEnd: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format. Use HH:MM (24h)"),
  wednesdayBreakStart: z.union([
    z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format. Use HH:MM (24h)"),
    z.string().max(0), // empty string
    z.null()
  ]),
  wednesdayBreakEnd: z.union([
    z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format. Use HH:MM (24h)"),
    z.string().max(0), // empty string
    z.null()
  ]),
  
  thursdayOpen: z.boolean(),
  thursdayStart: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format. Use HH:MM (24h)"),
  thursdayEnd: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format. Use HH:MM (24h)"),
  thursdayBreakStart: z.union([
    z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format. Use HH:MM (24h)"),
    z.string().max(0), // empty string
    z.null()
  ]),
  thursdayBreakEnd: z.union([
    z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format. Use HH:MM (24h)"),
    z.string().max(0), // empty string
    z.null()
  ]),
  
  fridayOpen: z.boolean(),
  fridayStart: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format. Use HH:MM (24h)"),
  fridayEnd: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format. Use HH:MM (24h)"),
  fridayBreakStart: z.union([
    z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format. Use HH:MM (24h)"),
    z.string().max(0), // empty string
    z.null()
  ]),
  fridayBreakEnd: z.union([
    z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format. Use HH:MM (24h)"),
    z.string().max(0), // empty string
    z.null()
  ]),
  
  saturdayOpen: z.boolean(),
  saturdayStart: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format. Use HH:MM (24h)"),
  saturdayEnd: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format. Use HH:MM (24h)"),
  saturdayBreakStart: z.union([
    z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format. Use HH:MM (24h)"),
    z.string().max(0), // empty string
    z.null()
  ]),
  saturdayBreakEnd: z.union([
    z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format. Use HH:MM (24h)"),
    z.string().max(0), // empty string
    z.null()
  ]),
  
  sundayOpen: z.boolean(),
  sundayStart: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format. Use HH:MM (24h)"),
  sundayEnd: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format. Use HH:MM (24h)"),
  sundayBreakStart: z.union([
    z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format. Use HH:MM (24h)"),
    z.string().max(0), // empty string
    z.null()
  ]),
  sundayBreakEnd: z.union([
    z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format. Use HH:MM (24h)"),
    z.string().max(0), // empty string
    z.null()
  ]),
}).refine(
  (data) => {
    // For each day that is open, ensure start time is before end time
    if (data.mondayOpen && data.mondayStart >= data.mondayEnd) {
      return false;
    }
    if (data.tuesdayOpen && data.tuesdayStart >= data.tuesdayEnd) {
      return false;
    }
    if (data.wednesdayOpen && data.wednesdayStart >= data.wednesdayEnd) {
      return false;
    }
    if (data.thursdayOpen && data.thursdayStart >= data.thursdayEnd) {
      return false;
    }
    if (data.fridayOpen && data.fridayStart >= data.fridayEnd) {
      return false;
    }
    // Only validate start/end times for Saturday/Sunday if the day is open
    if (data.saturdayOpen && data.saturdayStart >= data.saturdayEnd) {
      return false;
    }
    if (data.sundayOpen && data.sundayStart >= data.sundayEnd) {
      return false;
    }
    return true;
  },
  {
    message: "End time must be after start time",
    path: ["mondayEnd"], // This is a placeholder, the actual error field will vary
  }
).refine(
  (data) => {
    // For each day with a break, ensure break start is after day start and before day end
    // Only validate if both break start and end are provided
    if (data.mondayOpen && data.mondayBreakStart && data.mondayBreakEnd && data.mondayBreakStart.trim() !== "" && data.mondayBreakEnd.trim() !== "") {
      if (data.mondayBreakStart <= data.mondayStart || data.mondayBreakStart >= data.mondayEnd) {
        return false;
      }
      if (data.mondayBreakEnd <= data.mondayBreakStart || data.mondayBreakEnd >= data.mondayEnd) {
        return false;
      }
    }
    
    if (data.tuesdayOpen && data.tuesdayBreakStart && data.tuesdayBreakEnd && data.tuesdayBreakStart.trim() !== "" && data.tuesdayBreakEnd.trim() !== "") {
      if (data.tuesdayBreakStart <= data.tuesdayStart || data.tuesdayBreakStart >= data.tuesdayEnd) {
        return false;
      }
      if (data.tuesdayBreakEnd <= data.tuesdayBreakStart || data.tuesdayBreakEnd >= data.tuesdayEnd) {
        return false;
      }
    }
    
    if (data.wednesdayOpen && data.wednesdayBreakStart && data.wednesdayBreakEnd && data.wednesdayBreakStart.trim() !== "" && data.wednesdayBreakEnd.trim() !== "") {
      if (data.wednesdayBreakStart <= data.wednesdayStart || data.wednesdayBreakStart >= data.wednesdayEnd) {
        return false;
      }
      if (data.wednesdayBreakEnd <= data.wednesdayBreakStart || data.wednesdayBreakEnd >= data.wednesdayEnd) {
        return false;
      }
    }
    
    if (data.thursdayOpen && data.thursdayBreakStart && data.thursdayBreakEnd && data.thursdayBreakStart.trim() !== "" && data.thursdayBreakEnd.trim() !== "") {
      if (data.thursdayBreakStart <= data.thursdayStart || data.thursdayBreakStart >= data.thursdayEnd) {
        return false;
      }
      if (data.thursdayBreakEnd <= data.thursdayBreakStart || data.thursdayBreakEnd >= data.thursdayEnd) {
        return false;
      }
    }
    
    if (data.fridayOpen && data.fridayBreakStart && data.fridayBreakEnd && data.fridayBreakStart.trim() !== "" && data.fridayBreakEnd.trim() !== "") {
      if (data.fridayBreakStart <= data.fridayStart || data.fridayBreakStart >= data.fridayEnd) {
        return false;
      }
      if (data.fridayBreakEnd <= data.fridayBreakStart || data.fridayBreakEnd >= data.fridayEnd) {
        return false;
      }
    }
    
    // For Saturday: Only validate break times if the day is open and break fields are present and non-empty
    // If Saturday is closed, bypass validation completely
    if (data.saturdayOpen) {
      if (data.saturdayBreakStart && data.saturdayBreakEnd && 
          data.saturdayBreakStart.trim() !== "" && data.saturdayBreakEnd.trim() !== "") {
        // Only validate when there are actual break times provided
        if (data.saturdayBreakStart <= data.saturdayStart || data.saturdayBreakStart >= data.saturdayEnd) {
          return false;
        }
        if (data.saturdayBreakEnd <= data.saturdayBreakStart || data.saturdayBreakEnd >= data.saturdayEnd) {
          return false;
        }
      }
    }
    
    // For Sunday: Only validate break times if the day is open and break fields are present and non-empty
    // If Sunday is closed, bypass validation completely
    if (data.sundayOpen) {
      if (data.sundayBreakStart && data.sundayBreakEnd && 
          data.sundayBreakStart.trim() !== "" && data.sundayBreakEnd.trim() !== "") {
        // Only validate when there are actual break times provided
        if (data.sundayBreakStart <= data.sundayStart || data.sundayBreakStart >= data.sundayEnd) {
          return false;
        }
        if (data.sundayBreakEnd <= data.sundayBreakStart || data.sundayBreakEnd >= data.sundayEnd) {
          return false;
        }
      }
    }
    
    return true;
  },
  {
    message: "Break times must be within operating hours",
    path: ["mondayBreakStart"], // This is a placeholder
  }
);

export type FacilityFormValues = z.infer<typeof facilityEditSchema>;

export default function FacilitySettingsPage() {
  const [, setLocation] = useLocation();
  const params = useParams<{ id: string }>();
  const facilityId = params?.id ? parseInt(params.id) : undefined;
  const { toast } = useToast();
  
  // Fetch facility data
  const { data: facility, isLoading, error } = useQuery<Facility, Error>({
    queryKey: ['/api/facilities', facilityId],
    queryFn: async () => {
      if (!facilityId) throw new Error("Facility ID is required");
      const response = await fetch(`/api/facilities/${facilityId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch facility");
      }
      return response.json();
    },
    enabled: !!facilityId,
  });
  
  // Form setup
  const form = useForm<FacilityFormValues>({
    resolver: zodResolver(facilityEditSchema),
    defaultValues: {
      name: "",
      address1: "",
      address2: "",
      city: "",
      state: "",
      pincode: "",
      country: "",
      timezone: "America/New_York",
      
      mondayOpen: true,
      mondayStart: "08:00",
      mondayEnd: "17:00",
      mondayBreakStart: "12:00",
      mondayBreakEnd: "13:00",
      
      tuesdayOpen: true,
      tuesdayStart: "08:00",
      tuesdayEnd: "17:00",
      tuesdayBreakStart: "12:00",
      tuesdayBreakEnd: "13:00",
      
      wednesdayOpen: true,
      wednesdayStart: "08:00",
      wednesdayEnd: "17:00",
      wednesdayBreakStart: "12:00",
      wednesdayBreakEnd: "13:00",
      
      thursdayOpen: true,
      thursdayStart: "08:00",
      thursdayEnd: "17:00",
      thursdayBreakStart: "12:00",
      thursdayBreakEnd: "13:00",
      
      fridayOpen: true,
      fridayStart: "08:00",
      fridayEnd: "17:00",
      fridayBreakStart: "12:00",
      fridayBreakEnd: "13:00",
      
      saturdayOpen: false,
      saturdayStart: "08:00",
      saturdayEnd: "13:00",
      saturdayBreakStart: "",
      saturdayBreakEnd: "",
      
      sundayOpen: false,
      sundayStart: "08:00",
      sundayEnd: "17:00",
      sundayBreakStart: "",
      sundayBreakEnd: "",
    },
  });
  
  // Update form when facility data is loaded
  useEffect(() => {
    if (facility) {
      form.reset({
        name: facility.name || "",
        address1: facility.address1 || "",
        address2: facility.address2 || "",
        city: facility.city || "",
        state: facility.state || "",
        pincode: facility.pincode || "",
        country: facility.country || "",
        timezone: facility.timezone || "America/New_York",
        
        mondayOpen: facility.mondayOpen ?? true,
        mondayStart: facility.mondayStart || "08:00",
        mondayEnd: facility.mondayEnd || "17:00",
        mondayBreakStart: facility.mondayBreakStart || "12:00",
        mondayBreakEnd: facility.mondayBreakEnd || "13:00",
        
        tuesdayOpen: facility.tuesdayOpen ?? true,
        tuesdayStart: facility.tuesdayStart || "08:00",
        tuesdayEnd: facility.tuesdayEnd || "17:00",
        tuesdayBreakStart: facility.tuesdayBreakStart || "12:00",
        tuesdayBreakEnd: facility.tuesdayBreakEnd || "13:00",
        
        wednesdayOpen: facility.wednesdayOpen ?? true,
        wednesdayStart: facility.wednesdayStart || "08:00",
        wednesdayEnd: facility.wednesdayEnd || "17:00",
        wednesdayBreakStart: facility.wednesdayBreakStart || "12:00",
        wednesdayBreakEnd: facility.wednesdayBreakEnd || "13:00",
        
        thursdayOpen: facility.thursdayOpen ?? true,
        thursdayStart: facility.thursdayStart || "08:00",
        thursdayEnd: facility.thursdayEnd || "17:00",
        thursdayBreakStart: facility.thursdayBreakStart || "12:00",
        thursdayBreakEnd: facility.thursdayBreakEnd || "13:00",
        
        fridayOpen: facility.fridayOpen ?? true,
        fridayStart: facility.fridayStart || "08:00",
        fridayEnd: facility.fridayEnd || "17:00",
        fridayBreakStart: facility.fridayBreakStart || "12:00",
        fridayBreakEnd: facility.fridayBreakEnd || "13:00",
        
        saturdayOpen: facility.saturdayOpen ?? false,
        saturdayStart: facility.saturdayStart || "08:00",
        saturdayEnd: facility.saturdayEnd || "13:00",
        saturdayBreakStart: facility.saturdayBreakStart || "",
        saturdayBreakEnd: facility.saturdayBreakEnd || "",
        
        sundayOpen: facility.sundayOpen ?? false,
        sundayStart: facility.sundayStart || "08:00",
        sundayEnd: facility.sundayEnd || "17:00",
        sundayBreakStart: facility.sundayBreakStart || "",
        sundayBreakEnd: facility.sundayBreakEnd || "",
      });
    }
  }, [facility, form]);
  
  // Submit handler
  const updateMutation = useMutation({
    mutationFn: async (data: FacilityFormValues) => {
      if (!facilityId) throw new Error("Facility ID is required");
      
      // Log data being submitted for debugging
      console.log("Submitting facility data:", data);
      
      // Ensure all data is properly normalized before submission
      const normalizedData = { ...data };
      
      // Always include Saturday and Sunday fields explicitly
      // When a day is closed, ensure break times are empty strings
      // This ensures the backend receives consistent data format
      
      // For Saturday
      normalizedData.saturdayStart = normalizedData.saturdayStart || "08:00";
      normalizedData.saturdayEnd = normalizedData.saturdayEnd || "17:00";
      if (!normalizedData.saturdayOpen) {
        normalizedData.saturdayBreakStart = "";
        normalizedData.saturdayBreakEnd = "";
      }
      
      // For Sunday
      normalizedData.sundayStart = normalizedData.sundayStart || "08:00";
      normalizedData.sundayEnd = normalizedData.sundayEnd || "17:00";
      if (!normalizedData.sundayOpen) {
        normalizedData.sundayBreakStart = "";
        normalizedData.sundayBreakEnd = "";
      }
      
      console.log("Normalized data being sent:", normalizedData);
      
      const response = await apiRequest(
        "PATCH",
        `/api/facilities/${facilityId}`,
        normalizedData
      );
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to update facility");
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      // Log success for debugging
      console.log("Facility updated successfully:", data);
      
      queryClient.invalidateQueries({ queryKey: ['/api/facilities'] });
      queryClient.invalidateQueries({ queryKey: ['/api/facilities', facilityId] });
      
      toast({
        title: "Facility updated",
        description: "Facility settings have been updated successfully.",
      });
    },
    onError: (error: Error) => {
      console.error("Facility update error:", error);
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  const onSubmit = (data: FacilityFormValues) => {
    updateMutation.mutate(data);
  };
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <p className="text-destructive">Error: {error.message}</p>
        <Button onClick={() => setLocation("/facilities")}>
          Back to Facilities
        </Button>
      </div>
    );
  }
  
  return (
    <div className="container py-8">
      <div className="flex items-center mb-6">
        <Button 
          variant="ghost" 
          className="mr-4"
          onClick={() => setLocation("/facilities")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <h1 className="text-3xl font-bold">Facility Settings</h1>
      </div>
      
      <Tabs defaultValue="general">
        <TabsList className="mb-6">
          <TabsTrigger value="general">General Information</TabsTrigger>
          <TabsTrigger value="hours">Operating Hours</TabsTrigger>
        </TabsList>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <TabsContent value="general">
              <Card>
                <CardHeader>
                  <CardTitle>General Information</CardTitle>
                  <CardDescription>Update the facility's basic information.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Facility Name</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="timezone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Timezone</FormLabel>
                          <Select 
                            onValueChange={field.onChange} 
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select timezone" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="America/New_York">Eastern Time (ET)</SelectItem>
                              <SelectItem value="America/Chicago">Central Time (CT)</SelectItem>
                              <SelectItem value="America/Denver">Mountain Time (MT)</SelectItem>
                              <SelectItem value="America/Los_Angeles">Pacific Time (PT)</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="address1"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Address Line 1</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="address2"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Address Line 2</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="city"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>City</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="state"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>State/Province</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="pincode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Postal Code</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="country"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Country</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="hours">
              <Card>
                <CardHeader>
                  <CardTitle>Facility Operating Hours</CardTitle>
                  <CardDescription>
                    Configure when this facility is open for appointments. All times are in 24-hour format (HH:MM).
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Monday */}
                  <div className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center">
                        <Clock className="mr-2 h-5 w-5 text-muted-foreground" />
                        <h3 className="text-lg font-medium">Monday</h3>
                      </div>
                      <FormField
                        control={form.control}
                        name="mondayOpen"
                        render={({ field }) => (
                          <FormItem className="flex items-center space-x-2 space-y-0">
                            <FormLabel>Open</FormLabel>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    {form.watch("mondayOpen") && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex items-center gap-4">
                          <FormField
                            control={form.control}
                            name="mondayStart"
                            render={({ field }) => (
                              <FormItem className="flex-1">
                                <FormLabel>Opening Time</FormLabel>
                                <FormControl>
                                  <Input {...field} placeholder="08:00" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="mondayEnd"
                            render={({ field }) => (
                              <FormItem className="flex-1">
                                <FormLabel>Closing Time</FormLabel>
                                <FormControl>
                                  <Input {...field} placeholder="17:00" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        
                        <div className="flex items-center gap-4">
                          <FormField
                            control={form.control}
                            name="mondayBreakStart"
                            render={({ field }) => (
                              <FormItem className="flex-1">
                                <FormLabel>Break Start</FormLabel>
                                <FormControl>
                                  <TimeInput field={field} placeholder="12:00" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="mondayBreakEnd"
                            render={({ field }) => (
                              <FormItem className="flex-1">
                                <FormLabel>Break End</FormLabel>
                                <FormControl>
                                  <TimeInput field={field} placeholder="13:00" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Tuesday */}
                  <div className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center">
                        <Clock className="mr-2 h-5 w-5 text-muted-foreground" />
                        <h3 className="text-lg font-medium">Tuesday</h3>
                      </div>
                      <FormField
                        control={form.control}
                        name="tuesdayOpen"
                        render={({ field }) => (
                          <FormItem className="flex items-center space-x-2 space-y-0">
                            <FormLabel>Open</FormLabel>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    {form.watch("tuesdayOpen") && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex items-center gap-4">
                          <FormField
                            control={form.control}
                            name="tuesdayStart"
                            render={({ field }) => (
                              <FormItem className="flex-1">
                                <FormLabel>Opening Time</FormLabel>
                                <FormControl>
                                  <Input {...field} placeholder="08:00" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="tuesdayEnd"
                            render={({ field }) => (
                              <FormItem className="flex-1">
                                <FormLabel>Closing Time</FormLabel>
                                <FormControl>
                                  <Input {...field} placeholder="17:00" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        
                        <div className="flex items-center gap-4">
                          <FormField
                            control={form.control}
                            name="tuesdayBreakStart"
                            render={({ field }) => (
                              <FormItem className="flex-1">
                                <FormLabel>Break Start</FormLabel>
                                <FormControl>
                                  <TimeInput field={field} placeholder="12:00" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="tuesdayBreakEnd"
                            render={({ field }) => (
                              <FormItem className="flex-1">
                                <FormLabel>Break End</FormLabel>
                                <FormControl>
                                  <TimeInput field={field} placeholder="13:00" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Wednesday */}
                  <div className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center">
                        <Clock className="mr-2 h-5 w-5 text-muted-foreground" />
                        <h3 className="text-lg font-medium">Wednesday</h3>
                      </div>
                      <FormField
                        control={form.control}
                        name="wednesdayOpen"
                        render={({ field }) => (
                          <FormItem className="flex items-center space-x-2 space-y-0">
                            <FormLabel>Open</FormLabel>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    {form.watch("wednesdayOpen") && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex items-center gap-4">
                          <FormField
                            control={form.control}
                            name="wednesdayStart"
                            render={({ field }) => (
                              <FormItem className="flex-1">
                                <FormLabel>Opening Time</FormLabel>
                                <FormControl>
                                  <Input {...field} placeholder="08:00" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="wednesdayEnd"
                            render={({ field }) => (
                              <FormItem className="flex-1">
                                <FormLabel>Closing Time</FormLabel>
                                <FormControl>
                                  <Input {...field} placeholder="17:00" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        
                        <div className="flex items-center gap-4">
                          <FormField
                            control={form.control}
                            name="wednesdayBreakStart"
                            render={({ field }) => (
                              <FormItem className="flex-1">
                                <FormLabel>Break Start</FormLabel>
                                <FormControl>
                                  <TimeInput field={field} placeholder="12:00" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="wednesdayBreakEnd"
                            render={({ field }) => (
                              <FormItem className="flex-1">
                                <FormLabel>Break End</FormLabel>
                                <FormControl>
                                  <TimeInput field={field} placeholder="13:00" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Thursday */}
                  <div className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center">
                        <Clock className="mr-2 h-5 w-5 text-muted-foreground" />
                        <h3 className="text-lg font-medium">Thursday</h3>
                      </div>
                      <FormField
                        control={form.control}
                        name="thursdayOpen"
                        render={({ field }) => (
                          <FormItem className="flex items-center space-x-2 space-y-0">
                            <FormLabel>Open</FormLabel>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    {form.watch("thursdayOpen") && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex items-center gap-4">
                          <FormField
                            control={form.control}
                            name="thursdayStart"
                            render={({ field }) => (
                              <FormItem className="flex-1">
                                <FormLabel>Opening Time</FormLabel>
                                <FormControl>
                                  <Input {...field} placeholder="08:00" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="thursdayEnd"
                            render={({ field }) => (
                              <FormItem className="flex-1">
                                <FormLabel>Closing Time</FormLabel>
                                <FormControl>
                                  <Input {...field} placeholder="17:00" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        
                        <div className="flex items-center gap-4">
                          <FormField
                            control={form.control}
                            name="thursdayBreakStart"
                            render={({ field }) => (
                              <FormItem className="flex-1">
                                <FormLabel>Break Start</FormLabel>
                                <FormControl>
                                  <TimeInput field={field} placeholder="12:00" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="thursdayBreakEnd"
                            render={({ field }) => (
                              <FormItem className="flex-1">
                                <FormLabel>Break End</FormLabel>
                                <FormControl>
                                  <TimeInput field={field} placeholder="13:00" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Friday */}
                  <div className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center">
                        <Clock className="mr-2 h-5 w-5 text-muted-foreground" />
                        <h3 className="text-lg font-medium">Friday</h3>
                      </div>
                      <FormField
                        control={form.control}
                        name="fridayOpen"
                        render={({ field }) => (
                          <FormItem className="flex items-center space-x-2 space-y-0">
                            <FormLabel>Open</FormLabel>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    {form.watch("fridayOpen") && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex items-center gap-4">
                          <FormField
                            control={form.control}
                            name="fridayStart"
                            render={({ field }) => (
                              <FormItem className="flex-1">
                                <FormLabel>Opening Time</FormLabel>
                                <FormControl>
                                  <Input {...field} placeholder="08:00" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="fridayEnd"
                            render={({ field }) => (
                              <FormItem className="flex-1">
                                <FormLabel>Closing Time</FormLabel>
                                <FormControl>
                                  <Input {...field} placeholder="17:00" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        
                        <div className="flex items-center gap-4">
                          <FormField
                            control={form.control}
                            name="fridayBreakStart"
                            render={({ field }) => (
                              <FormItem className="flex-1">
                                <FormLabel>Break Start</FormLabel>
                                <FormControl>
                                  <TimeInput field={field} placeholder="12:00" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="fridayBreakEnd"
                            render={({ field }) => (
                              <FormItem className="flex-1">
                                <FormLabel>Break End</FormLabel>
                                <FormControl>
                                  <TimeInput field={field} placeholder="13:00" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Saturday */}
                  <div className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center">
                        <Clock className="mr-2 h-5 w-5 text-muted-foreground" />
                        <h3 className="text-lg font-medium">Saturday</h3>
                      </div>
                      <FormField
                        control={form.control}
                        name="saturdayOpen"
                        render={({ field }) => (
                          <FormItem className="flex items-center space-x-2 space-y-0">
                            <FormLabel>Open</FormLabel>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    {form.watch("saturdayOpen") && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex items-center gap-4">
                          <FormField
                            control={form.control}
                            name="saturdayStart"
                            render={({ field }) => (
                              <FormItem className="flex-1">
                                <FormLabel>Opening Time</FormLabel>
                                <FormControl>
                                  <Input {...field} placeholder="08:00" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="saturdayEnd"
                            render={({ field }) => (
                              <FormItem className="flex-1">
                                <FormLabel>Closing Time</FormLabel>
                                <FormControl>
                                  <Input {...field} placeholder="13:00" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        
                        <div className="flex items-center gap-4">
                          <FormField
                            control={form.control}
                            name="saturdayBreakStart"
                            render={({ field }) => (
                              <FormItem className="flex-1">
                                <FormLabel>Break Start</FormLabel>
                                <FormControl>
                                  <TimeInput field={field} placeholder="12:00" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="saturdayBreakEnd"
                            render={({ field }) => (
                              <FormItem className="flex-1">
                                <FormLabel>Break End</FormLabel>
                                <FormControl>
                                  <TimeInput field={field} placeholder="13:00" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Sunday */}
                  <div className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center">
                        <Clock className="mr-2 h-5 w-5 text-muted-foreground" />
                        <h3 className="text-lg font-medium">Sunday</h3>
                      </div>
                      <FormField
                        control={form.control}
                        name="sundayOpen"
                        render={({ field }) => (
                          <FormItem className="flex items-center space-x-2 space-y-0">
                            <FormLabel>Open</FormLabel>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    {form.watch("sundayOpen") && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex items-center gap-4">
                          <FormField
                            control={form.control}
                            name="sundayStart"
                            render={({ field }) => (
                              <FormItem className="flex-1">
                                <FormLabel>Opening Time</FormLabel>
                                <FormControl>
                                  <Input {...field} placeholder="08:00" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="sundayEnd"
                            render={({ field }) => (
                              <FormItem className="flex-1">
                                <FormLabel>Closing Time</FormLabel>
                                <FormControl>
                                  <Input {...field} placeholder="17:00" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        
                        <div className="flex items-center gap-4">
                          <FormField
                            control={form.control}
                            name="sundayBreakStart"
                            render={({ field }) => (
                              <FormItem className="flex-1">
                                <FormLabel>Break Start</FormLabel>
                                <FormControl>
                                  <TimeInput field={field} placeholder="12:00" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="sundayBreakEnd"
                            render={({ field }) => (
                              <FormItem className="flex-1">
                                <FormLabel>Break End</FormLabel>
                                <FormControl>
                                  <TimeInput field={field} placeholder="13:00" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            <CardFooter className="flex justify-end border rounded-lg p-4 mt-6">
              <Button 
                type="submit"
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Save Changes
              </Button>
            </CardFooter>
          </form>
        </Form>
      </Tabs>
    </div>
  );
}
