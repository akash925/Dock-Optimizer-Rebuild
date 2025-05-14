import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { apiRequest, queryClient } from "@/lib/queryClient";

import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Clock, Loader2, Save } from "lucide-react";

// Helper function to ensure Input value is always a string
const safeValueAsString = (value: string | null | undefined): string => {
  if (value === null || value === undefined) return "";
  return value;
};

// Define schema for the form - similar to facility hours but simplified for organization defaults
const defaultHoursSchema = z.object({
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
    if (data.saturdayOpen && data.saturdayStart >= data.saturdayEnd) {
      return false;
    }
    if (data.sundayOpen && data.sundayStart >= data.sundayEnd) {
      return false;
    }
    return true;
  },
  {
    message: "Start time must be before end time for each day",
    path: ["mondayStart"] // this is a bit of a hack, it will highlight the first day
  }
);

type DefaultHoursFormValues = z.infer<typeof defaultHoursSchema>;

// Helper function to format time inputs - will convert "800" to "08:00", etc.
const formatTimeInput = (input: string): string => {
  // If already formatted or empty, return as is
  if (!input || input.includes(':')) return input;
  
  // Remove any non-numeric characters
  const numbersOnly = input.replace(/[^0-9]/g, '');
  
  // Handle different input lengths
  if (numbersOnly.length <= 2) {
    // Assume it's just minutes (e.g., "30" -> "00:30")
    return `00:${numbersOnly.padStart(2, '0')}`;
  } else if (numbersOnly.length === 3) {
    // Format as H:MM (e.g., "130" -> "01:30")
    return `0${numbersOnly[0]}:${numbersOnly.substring(1)}`;
  } else {
    // Format as HH:MM (e.g., "1430" -> "14:30")
    return `${numbersOnly.substring(0, 2)}:${numbersOnly.substring(2, 4)}`;
  }
};

// Helper component for time inputs with auto-formatting
const TimeInput = ({ field, placeholder, disabled = false }) => {
  const [value, setValue] = useState(field.value || "");
  
  const handleBlur = (e) => {
    const formattedValue = formatTimeInput(e.target.value);
    setValue(formattedValue);
    field.onChange(formattedValue);
  };
  
  return (
    <Input 
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={handleBlur}
      placeholder={placeholder}
      disabled={disabled}
    />
  );
};

// Helper function to transform form data to API format
const transformFormToApi = (formData: DefaultHoursFormValues) => {
  return {
    monday: {
      open: formData.mondayOpen,
      start: formData.mondayStart,
      end: formData.mondayEnd,
      breakStart: formData.mondayBreakStart || null,
      breakEnd: formData.mondayBreakEnd || null,
    },
    tuesday: {
      open: formData.tuesdayOpen,
      start: formData.tuesdayStart,
      end: formData.tuesdayEnd,
      breakStart: formData.tuesdayBreakStart || null,
      breakEnd: formData.tuesdayBreakEnd || null,
    },
    wednesday: {
      open: formData.wednesdayOpen,
      start: formData.wednesdayStart,
      end: formData.wednesdayEnd,
      breakStart: formData.wednesdayBreakStart || null,
      breakEnd: formData.wednesdayBreakEnd || null,
    },
    thursday: {
      open: formData.thursdayOpen,
      start: formData.thursdayStart,
      end: formData.thursdayEnd,
      breakStart: formData.thursdayBreakStart || null,
      breakEnd: formData.thursdayBreakEnd || null,
    },
    friday: {
      open: formData.fridayOpen,
      start: formData.fridayStart,
      end: formData.fridayEnd,
      breakStart: formData.fridayBreakStart || null,
      breakEnd: formData.fridayBreakEnd || null,
    },
    saturday: {
      open: formData.saturdayOpen,
      start: formData.saturdayStart,
      end: formData.saturdayEnd,
      breakStart: formData.saturdayBreakStart || null,
      breakEnd: formData.saturdayBreakEnd || null,
    },
    sunday: {
      open: formData.sundayOpen,
      start: formData.sundayStart,
      end: formData.sundayEnd,
      breakStart: formData.sundayBreakStart || null,
      breakEnd: formData.sundayBreakEnd || null,
    },
  };
};

// Helper function to transform API data to form format
const transformApiToForm = (apiData: any): DefaultHoursFormValues => {
  if (!apiData) {
    // Default values if no data available
    return {
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
      saturdayEnd: "17:00",
      saturdayBreakStart: "",
      saturdayBreakEnd: "",
      
      sundayOpen: false,
      sundayStart: "08:00",
      sundayEnd: "17:00",
      sundayBreakStart: "",
      sundayBreakEnd: "",
    };
  }
  
  return {
    mondayOpen: apiData.monday?.open || false,
    mondayStart: apiData.monday?.start || "08:00",
    mondayEnd: apiData.monday?.end || "17:00",
    mondayBreakStart: apiData.monday?.breakStart || "",
    mondayBreakEnd: apiData.monday?.breakEnd || "",
    
    tuesdayOpen: apiData.tuesday?.open || false,
    tuesdayStart: apiData.tuesday?.start || "08:00",
    tuesdayEnd: apiData.tuesday?.end || "17:00",
    tuesdayBreakStart: apiData.tuesday?.breakStart || "",
    tuesdayBreakEnd: apiData.tuesday?.breakEnd || "",
    
    wednesdayOpen: apiData.wednesday?.open || false,
    wednesdayStart: apiData.wednesday?.start || "08:00",
    wednesdayEnd: apiData.wednesday?.end || "17:00",
    wednesdayBreakStart: apiData.wednesday?.breakStart || "",
    wednesdayBreakEnd: apiData.wednesday?.breakEnd || "",
    
    thursdayOpen: apiData.thursday?.open || false,
    thursdayStart: apiData.thursday?.start || "08:00",
    thursdayEnd: apiData.thursday?.end || "17:00",
    thursdayBreakStart: apiData.thursday?.breakStart || "",
    thursdayBreakEnd: apiData.thursday?.breakEnd || "",
    
    fridayOpen: apiData.friday?.open || false,
    fridayStart: apiData.friday?.start || "08:00",
    fridayEnd: apiData.friday?.end || "17:00",
    fridayBreakStart: apiData.friday?.breakStart || "",
    fridayBreakEnd: apiData.friday?.breakEnd || "",
    
    saturdayOpen: apiData.saturday?.open || false,
    saturdayStart: apiData.saturday?.start || "08:00",
    saturdayEnd: apiData.saturday?.end || "17:00",
    saturdayBreakStart: apiData.saturday?.breakStart || "",
    saturdayBreakEnd: apiData.saturday?.breakEnd || "",
    
    sundayOpen: apiData.sunday?.open || false,
    sundayStart: apiData.sunday?.start || "08:00",
    sundayEnd: apiData.sunday?.end || "17:00",
    sundayBreakStart: apiData.sunday?.breakStart || "",
    sundayBreakEnd: apiData.sunday?.breakEnd || "",
  };
};

// Helper function to copy hours from one day to other days
const copyDayToOthers = (
  form: any, 
  sourceDay: string, 
  targetDays: string[]
) => {
  const sourceDayOpen = form.getValues(`${sourceDay}Open`);
  const sourceDayStart = form.getValues(`${sourceDay}Start`);
  const sourceDayEnd = form.getValues(`${sourceDay}End`);
  const sourceDayBreakStart = form.getValues(`${sourceDay}BreakStart`);
  const sourceDayBreakEnd = form.getValues(`${sourceDay}BreakEnd`);
  
  targetDays.forEach(targetDay => {
    form.setValue(`${targetDay}Open`, sourceDayOpen);
    form.setValue(`${targetDay}Start`, sourceDayStart);
    form.setValue(`${targetDay}End`, sourceDayEnd);
    form.setValue(`${targetDay}BreakStart`, sourceDayBreakStart);
    form.setValue(`${targetDay}BreakEnd`, sourceDayBreakEnd);
  });
};

export default function OrganizationHoursPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  // Fetch organization default hours
  const { data: defaultHours, isLoading } = useQuery({
    queryKey: ['/api/organizations/default-hours'],
    queryFn: async () => {
      const response = await fetch('/api/organizations/default-hours');
      if (!response.ok) {
        // If 404, this is expected for new organizations without defaults set
        if (response.status === 404) {
          return null;
        }
        throw new Error("Failed to fetch organization default hours");
      }
      return response.json();
    },
    retry: 1, // Only retry once, as 404 is expected for new orgs
  });
  
  // Set up form with default values
  const form = useForm<DefaultHoursFormValues>({
    resolver: zodResolver(defaultHoursSchema),
    defaultValues: transformApiToForm(defaultHours),
  });
  
  // Update form when API data loads
  useEffect(() => {
    if (defaultHours) {
      const formValues = transformApiToForm(defaultHours);
      Object.entries(formValues).forEach(([key, value]) => {
        form.setValue(key as any, value);
      });
    }
  }, [defaultHours, form]);
  
  // Mutation for saving default hours
  const mutation = useMutation({
    mutationFn: async (data: DefaultHoursFormValues) => {
      const apiData = transformFormToApi(data);
      const response = await apiRequest("PUT", "/api/organizations/default-hours", {
        defaultHours: apiData
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to update default hours: ${errorText}`);
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/organizations/default-hours'] });
      toast({
        title: "Default Hours Saved",
        description: "Organization default hours have been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error Saving Hours",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  const onSubmit = (data: DefaultHoursFormValues) => {
    mutation.mutate(data);
  };
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  return (
    <div className="container max-w-5xl mx-auto py-8">
      <div className="flex items-center mb-8">
        <Button
          variant="ghost"
          onClick={() => setLocation("/settings")}
          className="mr-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Settings
        </Button>
        <h1 className="text-3xl font-bold">Organization Default Hours</h1>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Default Operating Hours</CardTitle>
          <CardDescription>
            Configure default operating hours for all facilities in your organization. 
            Individual facilities can override these settings. All times are in 24-hour format (HH:MM).
          </CardDescription>
        </CardHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardContent className="space-y-6">
              {/* Monday */}
              <div className="border rounded-lg p-4">
                <div className="flex flex-col space-y-4">
                  <div className="flex items-center justify-between">
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
                  
                  <div className="flex items-center justify-end space-x-2">
                    <Button 
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        copyDayToOthers(form, "monday", ["tuesday", "wednesday", "thursday", "friday"]);
                        toast({
                          title: "Hours Copied",
                          description: "Monday hours copied to all weekdays.",
                        });
                      }}
                    >
                      Copy to All Weekdays
                    </Button>
                    
                    <Button 
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        copyDayToOthers(form, "monday", ["tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]);
                        toast({
                          title: "Hours Copied",
                          description: "Monday hours copied to all days.",
                        });
                      }}
                    >
                      Copy to All Days
                    </Button>
                  </div>
                </div>
                
                {form.watch("mondayOpen") && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <div className="flex items-center gap-4">
                      <FormField
                        control={form.control}
                        name="mondayStart"
                        render={({ field }) => (
                          <FormItem className="flex-1">
                            <FormLabel>Opening Time</FormLabel>
                            <FormControl>
                              <TimeInput field={field} placeholder="08:00" />
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
                              <TimeInput field={field} placeholder="17:00" />
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
                <div className="flex items-center justify-between">
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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <div className="flex items-center gap-4">
                      <FormField
                        control={form.control}
                        name="tuesdayStart"
                        render={({ field }) => (
                          <FormItem className="flex-1">
                            <FormLabel>Opening Time</FormLabel>
                            <FormControl>
                              <TimeInput field={field} placeholder="08:00" />
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
                              <TimeInput field={field} placeholder="17:00" />
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
                <div className="flex items-center justify-between">
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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <div className="flex items-center gap-4">
                      <FormField
                        control={form.control}
                        name="wednesdayStart"
                        render={({ field }) => (
                          <FormItem className="flex-1">
                            <FormLabel>Opening Time</FormLabel>
                            <FormControl>
                              <TimeInput field={field} placeholder="08:00" />
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
                              <TimeInput field={field} placeholder="17:00" />
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
                <div className="flex items-center justify-between">
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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <div className="flex items-center gap-4">
                      <FormField
                        control={form.control}
                        name="thursdayStart"
                        render={({ field }) => (
                          <FormItem className="flex-1">
                            <FormLabel>Opening Time</FormLabel>
                            <FormControl>
                              <TimeInput field={field} placeholder="08:00" />
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
                              <TimeInput field={field} placeholder="17:00" />
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
                <div className="flex items-center justify-between">
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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <div className="flex items-center gap-4">
                      <FormField
                        control={form.control}
                        name="fridayStart"
                        render={({ field }) => (
                          <FormItem className="flex-1">
                            <FormLabel>Opening Time</FormLabel>
                            <FormControl>
                              <TimeInput field={field} placeholder="08:00" />
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
                              <TimeInput field={field} placeholder="17:00" />
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
                <div className="flex items-center justify-between">
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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <div className="flex items-center gap-4">
                      <FormField
                        control={form.control}
                        name="saturdayStart"
                        render={({ field }) => (
                          <FormItem className="flex-1">
                            <FormLabel>Opening Time</FormLabel>
                            <FormControl>
                              <TimeInput field={field} placeholder="08:00" />
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
                              <TimeInput field={field} placeholder="17:00" />
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
                <div className="flex items-center justify-between">
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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <div className="flex items-center gap-4">
                      <FormField
                        control={form.control}
                        name="sundayStart"
                        render={({ field }) => (
                          <FormItem className="flex-1">
                            <FormLabel>Opening Time</FormLabel>
                            <FormControl>
                              <TimeInput field={field} placeholder="08:00" />
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
                              <TimeInput field={field} placeholder="17:00" />
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
            
            <CardFooter className="flex justify-end">
              <Button 
                type="submit" 
                disabled={mutation.isPending}
                className="w-full md:w-auto"
              >
                {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Save className="mr-2 h-4 w-4" />
                Save Default Hours
              </Button>
            </CardFooter>
          </form>
        </Form>
      </Card>
    </div>
  );
}