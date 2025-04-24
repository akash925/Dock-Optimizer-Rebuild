import React from "react";
import { useParams, useNavigate } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Save } from "lucide-react";
import { TimePicker } from "@/components/ui/date-time-picker/time-picker";
import Layout from "@/components/layout/layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";

const timeFormatRegex = /^([0-1][0-9]|2[0-3]):([0-5][0-9])$/;

// Time schema for form validation
const timeSchema = z.string()
  .regex(timeFormatRegex, { message: "Time must be in 24-hour format (HH:MM)" });

// Define the facility form schema
const facilityEditSchema = z.object({
  name: z.string().min(1, "Facility name is required"),
  address1: z.string().min(1, "Address is required"),
  address2: z.string().optional(),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  pincode: z.string().min(1, "Postal code is required"),
  country: z.string().min(1, "Country is required"),
  timezone: z.string().min(1, "Timezone is required"),
  
  // Operating hours - Monday
  mondayOpen: z.boolean().default(true),
  mondayStart: timeSchema.default("08:00"),
  mondayEnd: timeSchema.default("17:00"),
  mondayBreakStart: timeSchema.default("12:00"),
  mondayBreakEnd: timeSchema.default("13:00"),
  
  // Tuesday
  tuesdayOpen: z.boolean().default(true),
  tuesdayStart: timeSchema.default("08:00"),
  tuesdayEnd: timeSchema.default("17:00"),
  tuesdayBreakStart: timeSchema.default("12:00"),
  tuesdayBreakEnd: timeSchema.default("13:00"),
  
  // Wednesday
  wednesdayOpen: z.boolean().default(true),
  wednesdayStart: timeSchema.default("08:00"),
  wednesdayEnd: timeSchema.default("17:00"),
  wednesdayBreakStart: timeSchema.default("12:00"),
  wednesdayBreakEnd: timeSchema.default("13:00"),
  
  // Thursday
  thursdayOpen: z.boolean().default(true),
  thursdayStart: timeSchema.default("08:00"),
  thursdayEnd: timeSchema.default("17:00"),
  thursdayBreakStart: timeSchema.default("12:00"),
  thursdayBreakEnd: timeSchema.default("13:00"),
  
  // Friday
  fridayOpen: z.boolean().default(true),
  fridayStart: timeSchema.default("08:00"),
  fridayEnd: timeSchema.default("17:00"),
  fridayBreakStart: timeSchema.default("12:00"),
  fridayBreakEnd: timeSchema.default("13:00"),
  
  // Saturday
  saturdayOpen: z.boolean().default(false),
  saturdayStart: timeSchema.default("08:00"),
  saturdayEnd: timeSchema.default("13:00"),
  saturdayBreakStart: timeSchema.optional(),
  saturdayBreakEnd: timeSchema.optional(),
  
  // Sunday
  sundayOpen: z.boolean().default(false),
  sundayStart: timeSchema.default("08:00"),
  sundayEnd: timeSchema.default("17:00"),
  sundayBreakStart: timeSchema.optional(),
  sundayBreakEnd: timeSchema.optional(),
});

export type FacilityFormValues = z.infer<typeof facilityEditSchema>;

const timezones = [
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "America/Anchorage", label: "Alaska Time (AKT)" },
  { value: "Pacific/Honolulu", label: "Hawaii Time (HT)" },
  { value: "Europe/London", label: "London (GMT)" },
  { value: "Europe/Paris", label: "Central European Time (CET)" },
  { value: "Asia/Tokyo", label: "Japan Standard Time (JST)" },
  { value: "Australia/Sydney", label: "Australian Eastern Time (AET)" },
];

// Component for time input fields
const TimeInputFields = ({ dayName, form, isDisabled = false }: { 
  dayName: string; 
  form: any;
  isDisabled?: boolean;
}) => {
  const dayIsOpenField = `${dayName}Open`;
  const isOpen = form.watch(dayIsOpenField);
  
  return (
    <Card className="mb-4">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-bold">{dayName.charAt(0).toUpperCase() + dayName.slice(1)}</CardTitle>
          <FormField
            control={form.control}
            name={dayIsOpenField}
            render={({ field }) => (
              <FormItem className="flex items-center gap-2">
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
      </CardHeader>
      <CardContent>
        <div className={`grid gap-4 ${isOpen ? "grid-cols-2" : "grid-cols-2 opacity-50"}`}>
          <FormField
            control={form.control}
            name={`${dayName}Start`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Start Time</FormLabel>
                <FormControl>
                  <Input
                    placeholder="HH:MM"
                    {...field}
                    disabled={!isOpen || isDisabled}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name={`${dayName}End`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>End Time</FormLabel>
                <FormControl>
                  <Input
                    placeholder="HH:MM"
                    {...field}
                    disabled={!isOpen || isDisabled}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name={`${dayName}BreakStart`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Break Start</FormLabel>
                <FormControl>
                  <Input
                    placeholder="HH:MM"
                    {...field}
                    value={field.value || ""}
                    disabled={!isOpen || isDisabled}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name={`${dayName}BreakEnd`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Break End</FormLabel>
                <FormControl>
                  <Input
                    placeholder="HH:MM"
                    {...field}
                    value={field.value || ""}
                    disabled={!isOpen || isDisabled}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </CardContent>
    </Card>
  );
};

export default function FacilitySettingsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const facilityId = id ? parseInt(id) : null;
  
  const isEditMode = !!facilityId;
  
  // Fetch facility data if in edit mode
  const { data: facility, isLoading: isLoadingFacility } = useQuery({
    queryKey: ['/api/facilities', facilityId],
    queryFn: async () => {
      if (!facilityId) return null;
      const res = await fetch(`/api/facilities/${facilityId}`);
      if (!res.ok) throw new Error("Failed to load facility");
      return res.json();
    },
    enabled: !!facilityId,
  });

  // Set up form with default values
  const form = useForm<FacilityFormValues>({
    resolver: zodResolver(facilityEditSchema),
    defaultValues: facility || {
      name: "",
      address1: "",
      address2: "",
      city: "",
      state: "",
      pincode: "",
      country: "USA",
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
      
      sundayOpen: false,
      sundayStart: "08:00",
      sundayEnd: "17:00",
    },
  });
  
  // Update form values when facility data is loaded
  React.useEffect(() => {
    if (facility) {
      form.reset(facility);
    }
  }, [facility, form]);
  
  // Mutation for saving facility
  const saveFacilityMutation = useMutation({
    mutationFn: async (data: FacilityFormValues) => {
      if (isEditMode) {
        // Update existing facility
        return apiRequest("PATCH", `/api/facilities/${facilityId}`, data);
      } else {
        // Create new facility
        return apiRequest("POST", "/api/facilities", data);
      }
    },
    onSuccess: async () => {
      // Show success message
      toast({
        title: `Facility ${isEditMode ? "updated" : "created"} successfully`,
        description: `The facility has been ${isEditMode ? "updated" : "created"} with the new settings.`,
      });
      
      // Invalidate facilities query to refresh data
      queryClient.invalidateQueries({ queryKey: ['/api/facilities'] });
      
      // Navigate back to facilities list
      navigate("/facilities");
    },
    onError: (error) => {
      console.error("Error saving facility:", error);
      toast({
        title: "Error saving facility",
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
      });
    },
  });
  
  // Form submission handler
  const onSubmit = (data: FacilityFormValues) => {
    saveFacilityMutation.mutate(data);
  };
  
  if (isLoadingFacility) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }
  
  return (
    <Layout>
      <div className="container py-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">
            {isEditMode ? "Edit Facility" : "Add New Facility"}
          </h1>
          <Button variant="outline" onClick={() => navigate("/facilities")}>
            Back to Facilities
          </Button>
        </div>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Tabs defaultValue="general">
              <TabsList className="mb-4">
                <TabsTrigger value="general">General Information</TabsTrigger>
                <TabsTrigger value="hours">Operating Hours</TabsTrigger>
              </TabsList>
              
              {/* General Information Tab */}
              <TabsContent value="general">
                <Card>
                  <CardHeader>
                    <CardTitle>Facility Details</CardTitle>
                    <CardDescription>
                      Enter the basic information about this facility
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Facility Name</FormLabel>
                            <FormControl>
                              <Input placeholder="Facility Name" {...field} />
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
                                {timezones.map((tz) => (
                                  <SelectItem key={tz.value} value={tz.value}>
                                    {tz.label}
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
                        name="address1"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Address Line 1</FormLabel>
                            <FormControl>
                              <Input placeholder="Street Address" {...field} />
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
                              <Input placeholder="Suite, Floor, etc." {...field} />
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
                              <Input placeholder="City" {...field} />
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
                              <Input placeholder="State/Province" {...field} />
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
                              <Input placeholder="Postal/ZIP Code" {...field} />
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
                              <Input placeholder="Country" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
              
              {/* Operating Hours Tab */}
              <TabsContent value="hours">
                <Card>
                  <CardHeader>
                    <CardTitle>Facility Operating Hours</CardTitle>
                    <CardDescription>
                      Set the operating hours for this facility. These hours will be used as the default for scheduling appointments.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <TimeInputFields dayName="monday" form={form} />
                      <TimeInputFields dayName="tuesday" form={form} />
                      <TimeInputFields dayName="wednesday" form={form} />
                      <TimeInputFields dayName="thursday" form={form} />
                      <TimeInputFields dayName="friday" form={form} />
                      <TimeInputFields dayName="saturday" form={form} />
                      <TimeInputFields dayName="sunday" form={form} />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
            
            <div className="flex justify-end space-x-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => navigate("/facilities")}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={saveFacilityMutation.isPending}
              >
                {saveFacilityMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {isEditMode ? "Update Facility" : "Create Facility"}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </Layout>
  );
}