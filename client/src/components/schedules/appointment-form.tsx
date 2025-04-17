import { useState, ChangeEvent, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { insertScheduleSchema } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Schedule, Dock, Carrier } from "@shared/schema";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { format, addHours } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Upload, Loader2, ArrowLeft, ArrowRight, Truck, CalendarIcon } from "lucide-react";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";

// Tab 1: Truck Information
const truckInfoSchema = z.object({
  carrierId: z.coerce.number().optional(),
  carrierName: z.string().optional(),
  mcNumber: z.string().optional(), // MC Number field
  truckNumber: z.string().min(1, "Truck number is required"),
  trailerNumber: z.string().optional(),
  driverName: z.string().min(1, "Driver name is required"),
  driverPhone: z.string().min(6, "Valid phone number is required"),
  type: z.enum(["inbound", "outbound"]),
  appointmentMode: z.enum(["trailer", "container"]),
}).refine(
  (data) => {
    // Either carrierId or carrierName must be provided, unless carrierName is explicitly empty string
    return data.carrierId !== undefined || data.carrierName !== undefined || data.carrierName === '';
  },
  {
    message: "Either select a carrier or enter a custom carrier name",
    path: ["carrierId"],
  }
);

// Tab 2: Schedule Details
const scheduleDetailsSchema = z.object({
  appointmentDate: z.string().min(1, "Date is required"),
  appointmentTime: z.string().min(1, "Time is required"),
  dockId: z.coerce.number().min(1, "Please select a dock"),
  bolNumber: z.string().optional(),
  poNumber: z.string().optional(),
  palletCount: z.string().optional(),
  weight: z.string().optional(),
  notes: z.string().optional(),
});

// Combine schemas
const appointmentFormSchema = z.object({
  // Truck info fields
  carrierId: z.coerce.number().optional(),
  carrierName: z.string().optional(),
  mcNumber: z.string().optional(),
  truckNumber: z.string().min(1, "Truck number is required"),
  trailerNumber: z.string().optional(),
  driverName: z.string().min(1, "Driver name is required"),
  driverPhone: z.string().min(6, "Valid phone number is required"),
  type: z.enum(["inbound", "outbound"]),
  appointmentMode: z.enum(["trailer", "container"]),
  
  // Schedule details fields
  appointmentDate: z.string().min(1, "Date is required"),
  appointmentTime: z.string().min(1, "Time is required"),
  dockId: z.coerce.number().min(1, "Please select a dock"),
  bolNumber: z.string().optional(),
  poNumber: z.string().optional(),
  palletCount: z.string().optional(),
  weight: z.string().optional(),
  notes: z.string().optional(),
  
  // Other fields
  createdBy: z.number(),
  status: z.string(),
});

type TruckInfoFormValues = z.infer<typeof truckInfoSchema>;
type ScheduleDetailsFormValues = z.infer<typeof scheduleDetailsSchema>;
type AppointmentFormValues = z.infer<typeof appointmentFormSchema>;

interface AppointmentFormProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: Schedule;
  mode: "create" | "edit";
  initialDate?: Date;
}

export default function AppointmentForm({
  isOpen,
  onClose,
  initialData,
  mode,
  initialDate,
}: AppointmentFormProps) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<Partial<AppointmentFormValues>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bolFile, setBolFile] = useState<File | null>(null);
  const [bolProcessing, setBolProcessing] = useState(false);
  const [bolPreviewText, setBolPreviewText] = useState<string | null>(null);
  
  const { toast } = useToast();
  const { user } = useAuth();
  
  // Set up default end time based on appointment type
  const getDefaultEndTime = (startDate: Date, type: "trailer" | "container") => {
    // Trailer = 1 hour, Container = 4 hours
    const hours = type === "trailer" ? 1 : 4;
    return addHours(startDate, hours);
  };
  
  // Fetch docks
  const { data: docks = [] } = useQuery<Dock[]>({
    queryKey: ["/api/docks"],
  });
  
  // Fetch carriers
  const { data: carriers = [] } = useQuery<Carrier[]>({
    queryKey: ["/api/carriers"],
  });
  
  // Step 1 Form: Truck Information
  const truckInfoForm = useForm<TruckInfoFormValues>({
    resolver: zodResolver(truckInfoSchema),
    defaultValues: initialData
      ? {
          carrierId: initialData.carrierId,
          mcNumber: "", // Will be set when carrier is loaded
          truckNumber: initialData.truckNumber,
          trailerNumber: initialData.trailerNumber || "",
          driverName: initialData.driverName || "",
          driverPhone: initialData.driverPhone || "",
          type: initialData.type as "inbound" | "outbound",
          appointmentMode: initialData.appointmentMode as "trailer" | "container" || "trailer"
        }
      : {
          carrierId: undefined,
          carrierName: "",
          mcNumber: "",
          truckNumber: "",
          trailerNumber: "",
          driverName: "",
          driverPhone: "",
          type: "inbound",
          appointmentMode: "trailer"
        },
  });
  
  // Force MC Number to be empty when the component mounts
  useEffect(() => {
    // Clear MC Number field on component mount
    truckInfoForm.setValue("mcNumber", "");
  }, [truckInfoForm]);
  
  // Watch the appointment mode for duration changes
  const appointmentMode = truckInfoForm.watch("appointmentMode");
  
  // Step 2 Form: Schedule Details
  const scheduleDetailsForm = useForm<ScheduleDetailsFormValues>({
    resolver: zodResolver(scheduleDetailsSchema),
    defaultValues: initialData
      ? {
          appointmentDate: format(new Date(initialData.startTime), "yyyy-MM-dd"),
          appointmentTime: format(new Date(initialData.startTime), "HH:mm"),
          dockId: initialData.dockId,
          bolNumber: initialData.bolNumber || "",
          poNumber: initialData.poNumber || "",
          palletCount: initialData.palletCount || "",
          weight: initialData.weight || "",
          notes: initialData.notes || "",
        }
      : {
          appointmentDate: initialDate ? format(initialDate, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
          appointmentTime: initialDate ? format(initialDate, "HH:mm") : "09:00",
          dockId: docks && docks.length > 0 ? docks[0].id : undefined,
          bolNumber: "",
          poNumber: "",
          palletCount: "",
          weight: "",
          notes: "",
        },
  });
  
  // Handle BOL file upload
  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      setBolFile(file);
      setBolProcessing(true);
      
      // Simulate processing - this would be connected to a real document processing service
      setTimeout(() => {
        const previewText = `Bill of Lading #BOL-${Math.floor(Math.random() * 10000)}
Type: ${Math.random() > 0.5 ? 'Inbound' : 'Outbound'}
Items: ${Math.floor(Math.random() * 50) + 1} pallets
Carrier: ${carriers[Math.floor(Math.random() * carriers.length)]?.name || 'Unknown'}`;
        
        setBolPreviewText(previewText);
        setBolProcessing(false);
        
        // Set the BOL number
        scheduleDetailsForm.setValue("bolNumber", `BOL-${Math.floor(Math.random() * 10000)}`);
        
        // Set pallet count
        scheduleDetailsForm.setValue("palletCount", `${Math.floor(Math.random() * 50) + 1}`);
        
        toast({
          title: "BOL Uploaded and Processed",
          description: "We've extracted some information to help you with your appointment.",
        });
      }, 1500);
    }
  };
  
  // Handle step 1 submission
  const onTruckInfoSubmit = (data: TruckInfoFormValues) => {
    // Filter out any phone numbers in MC Number field
    const cleanedData = {
      ...data,
      mcNumber: data.mcNumber && data.mcNumber.includes('-') ? '' : data.mcNumber
    };
    setFormData(prev => ({...prev, ...cleanedData}));
    setStep(2);
  };
  
  // Create mutation
  const createScheduleMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/schedules", data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/schedules"] });
      toast({
        title: "Appointment created",
        description: "The appointment has been created successfully.",
      });
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create appointment",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Update mutation
  const updateScheduleMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<AppointmentFormValues> }) => {
      const res = await apiRequest("PUT", `/api/schedules/${id}`, data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/schedules"] });
      toast({
        title: "Appointment updated",
        description: "The appointment has been updated successfully.",
      });
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update appointment",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Final submit
  const onScheduleDetailsSubmit = async (data: ScheduleDetailsFormValues) => {
    setIsSubmitting(true);
    
    try {
      // Type assertion for combined form data
      type CompleteFormData = AppointmentFormValues;
      
      // Combine all data (use type assertion to handle combined data structure)
      const completeData = {...formData, ...data} as CompleteFormData;
      
      // Create date objects from form inputs
      const appointmentDate = data.appointmentDate;
      const appointmentTime = data.appointmentTime;
      
      // Create Date object from input
      const rawStartTime = new Date(`${appointmentDate}T${appointmentTime}`);
      
      // Round to nearest 15-minute interval
      const minutes = rawStartTime.getMinutes();
      const roundedMinutes = Math.round(minutes / 15) * 15;
      const newHours = roundedMinutes === 60 ? rawStartTime.getHours() + 1 : rawStartTime.getHours();
      const newMinutes = roundedMinutes === 60 ? 0 : roundedMinutes;
      
      // Create new date with rounded minutes
      const startTime = new Date(rawStartTime);
      startTime.setHours(newHours, newMinutes, 0, 0);
      
      // Get appointment mode from step 1 form data and calculate end time
      const appointmentMode = formData.appointmentMode as "trailer" | "container";
      const endTime = getDefaultEndTime(startTime, appointmentMode);
      
      // Format for API
      const scheduleData: any = {
        carrierId: formData.carrierId,
        dockId: data.dockId,
        truckNumber: formData.truckNumber,
        trailerNumber: formData.trailerNumber,
        driverName: formData.driverName,
        driverPhone: formData.driverPhone,
        bolNumber: data.bolNumber,
        poNumber: data.poNumber,
        palletCount: data.palletCount,
        weight: data.weight,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        type: formData.type,
        appointmentMode: formData.appointmentMode,
        status: "scheduled",
        notes: data.notes,
        createdBy: user?.id || 0,
      };
      
      // If it's a custom carrier (no carrierId but has name), include carrier info
      const mcNumber = formData.mcNumber || '';
      const carrierName = formData.carrierName || '';
      
      if (!formData.carrierId && carrierName) {
        scheduleData.newCarrier = {
          name: carrierName,
          mcNumber: mcNumber.includes('-') ? '' : mcNumber
        };
      }
      
      if (mode === "create") {
        await createScheduleMutation.mutateAsync(scheduleData);
      } else if (mode === "edit" && initialData) {
        await updateScheduleMutation.mutateAsync({ id: initialData.id, data: scheduleData });
      }
    } catch (error) {
      console.error("Error submitting form:", error);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Go back to previous step
  const goBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };
  
  // Close handler to reset state
  const handleClose = () => {
    setStep(1);
    setBolFile(null);
    setBolPreviewText(null);
    onClose();
  };
  
  // Dialog title based on mode
  const dialogTitle = mode === "create" 
    ? "Create New Appointment" 
    : "Edit Appointment";
  
  // Dialog description based on mode
  const dialogDescription = mode === "create"
    ? "Schedule a new dock appointment."
    : "Modify the existing appointment details.";
  
  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>{dialogDescription}</DialogDescription>
        </DialogHeader>
        
        {/* Step indicator */}
        <div className="relative mb-6">
          <div className="flex justify-between">
            <div className="text-center">
              <div className={`w-8 h-8 flex items-center justify-center rounded-full border-2 ${step === 1 ? 'bg-primary text-white border-primary' : 'border-gray-300 text-gray-500'} mx-auto`}>
                1
              </div>
              <div className={`text-sm mt-1 ${step === 1 ? 'text-primary font-medium' : 'text-gray-500'}`}>
                Truck Info
              </div>
            </div>
            
            <div className="flex-1 flex items-center">
              <div className={`h-1 flex-grow ${step > 1 ? 'bg-primary' : 'bg-gray-200'}`}></div>
            </div>
            
            <div className="text-center">
              <div className={`w-8 h-8 flex items-center justify-center rounded-full border-2 ${step === 2 ? 'bg-primary text-white border-primary' : 'border-gray-300 text-gray-500'} mx-auto`}>
                2
              </div>
              <div className={`text-sm mt-1 ${step === 2 ? 'text-primary font-medium' : 'text-gray-500'}`}>
                Schedule Details
              </div>
            </div>
          </div>
        </div>
        
        {/* Step 1: Truck Information */}
        {step === 1 && (
          <Form {...truckInfoForm}>
            <form onSubmit={truckInfoForm.handleSubmit(onTruckInfoSubmit)} className="space-y-4">
              <Tabs defaultValue="standard" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="standard">Standard Entry</TabsTrigger>
                  <TabsTrigger value="bol">Upload BOL (Coming Soon)</TabsTrigger>
                </TabsList>
                
                <TabsContent value="standard" className="space-y-4 pt-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="grid grid-cols-1 gap-4">
                      <FormField
                        control={truckInfoForm.control}
                        name="carrierId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Carrier</FormLabel>
                            <Select 
                              value={field.value?.toString() || ""} 
                              onValueChange={(value) => {
                                field.onChange(value ? parseInt(value) : undefined);
                                // First clear the MC Number field 
                                truckInfoForm.setValue("mcNumber", "");
                                
                                // Find the carrier name for the selected ID
                                if (value) {
                                  const carrier = carriers.find(c => c.id.toString() === value);
                                  if (carrier) {
                                    truckInfoForm.setValue("carrierName", carrier.name);
                                    
                                    // Use a timeout to ensure field updates in the correct order
                                    setTimeout(() => {
                                      if (carrier.mcNumber) {
                                        console.log("Setting MC Number to:", carrier.mcNumber);
                                        truckInfoForm.setValue("mcNumber", carrier.mcNumber);
                                      } else {
                                        console.log("No MC Number available for carrier, keeping field blank");
                                      }
                                    }, 100);
                                  }
                                } else {
                                  truckInfoForm.setValue("carrierName", "");
                                  truckInfoForm.setValue("mcNumber", "");
                                }
                              }}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select a carrier (optional)" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <div className="p-2">
                                  <Input 
                                    placeholder="Search carriers..." 
                                    className="mb-2"
                                    onChange={(e) => {
                                      // This would filter the carriers list in a real implementation
                                      // For now, we'll just log the search term
                                      console.log("Searching for:", e.target.value);
                                    }}
                                  />
                                </div>
                                {carriers.map(carrier => (
                                  <SelectItem key={carrier.id} value={carrier.id.toString()}>
                                    {carrier.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormDescription>
                              Optional: Select an existing carrier or enter a new one below
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={truckInfoForm.control}
                        name="carrierName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Custom Carrier Name</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="Enter carrier name if not in list above" 
                                {...field}
                                onChange={(e) => {
                                  field.onChange(e);
                                  // Clear carrier ID if custom name is entered
                                  if (e.target.value) {
                                    truckInfoForm.setValue("carrierId", undefined);
                                  }
                                }}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={truckInfoForm.control}
                        name="mcNumber"
                        render={({ field }) => {
                          // Replace any phone numbers with empty string to avoid showing that data
                          const fieldValue = field.value && field.value.includes('-') ? '' : field.value;
                          
                          return (
                            <FormItem>
                              <FormLabel>MC Number</FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="Enter Motor Carrier number" 
                                  value={fieldValue || ""}
                                  onChange={(e) => {
                                    // Allow direct editing of the field
                                    field.onChange(e.target.value);
                                  }}
                                  onBlur={field.onBlur}
                                  name={field.name}
                                  ref={field.ref}
                                />
                              </FormControl>
                              <FormDescription>
                                The MC Number is used for carrier verification with the FMCSA
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          );
                        }}
                      />
                    </div>
                    
                    <FormField
                      control={truckInfoForm.control}
                      name="type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Appointment Type*</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="inbound">Inbound</SelectItem>
                              <SelectItem value="outbound">Outbound</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <FormField
                    control={truckInfoForm.control}
                    name="appointmentMode"
                    render={({ field }) => (
                      <FormItem className="space-y-3">
                        <FormLabel>Appointment Mode*</FormLabel>
                        <FormControl>
                          <RadioGroup
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                            className="flex space-x-4"
                          >
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="trailer" id="trailer" />
                              <Label htmlFor="trailer">Trailer (1 hour)</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="container" id="container" />
                              <Label htmlFor="container">Container (4 hours)</Label>
                            </div>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={truckInfoForm.control}
                      name="truckNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Truck Number*</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter truck identification" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={truckInfoForm.control}
                      name="trailerNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Trailer Number</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter trailer identification" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={truckInfoForm.control}
                      name="driverName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Driver Name*</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter driver's name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={truckInfoForm.control}
                      name="driverPhone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Driver Phone*</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter driver's phone" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </TabsContent>
                
                <TabsContent value="bol" className="pt-4">
                  <div className="border-2 border-dashed rounded-md border-gray-300 p-6 flex flex-col items-center justify-center bg-gray-50">
                    <FileText className="h-10 w-10 text-gray-400 mb-2" />
                    <p className="text-center text-gray-500">BOL upload functionality is coming soon.</p>
                    <p className="text-center text-sm text-gray-400 mt-1">
                      This feature will allow automatic extraction of appointment information from your BOL documents.
                    </p>
                  </div>
                </TabsContent>
              </Tabs>
              
              <DialogFooter className="flex justify-between gap-2 pt-4">
                <Button type="button" variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
                <Button type="submit">
                  Continue <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
        
        {/* Step 2: Schedule Details */}
        {step === 2 && (
          <Form {...scheduleDetailsForm}>
            <form onSubmit={scheduleDetailsForm.handleSubmit(onScheduleDetailsSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={scheduleDetailsForm.control}
                  name="appointmentDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date*</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={scheduleDetailsForm.control}
                  name="appointmentTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Time*</FormLabel>
                      <Select 
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select an appointment time" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {/* Generate time slots from 5am to 7pm based on configured interval */}
                          {(() => {
                            // Get facility settings or use defaults
                            // In a real implementation, this would be fetched from the server
                            // For example: const settings = await storage.getAppointmentSettings(facilityId);
                            // And then: const timeInterval = settings.timeInterval;
                            // For now, we use these defaults
                            const timeInterval = 15; // Default to 15 minutes for finer time slot control
                            const startHour = 5; // 5 AM
                            const endHour = 19; // 7 PM
                            
                            // Calculate total minutes from start to end
                            const totalMinutes = (endHour - startHour) * 60;
                            const slots = Math.floor(totalMinutes / timeInterval);
                            
                            return Array.from({ length: slots }).map((_, i) => {
                              // Calculate time for this slot
                              const minutesFromStart = i * timeInterval;
                              const hour = Math.floor(minutesFromStart / 60) + startHour;
                              const minute = minutesFromStart % 60;
                              
                              const formattedHour = hour.toString().padStart(2, '0');
                              const formattedMinute = minute.toString().padStart(2, '0');
                              const timeValue = `${formattedHour}:${formattedMinute}`;
                              const displayHour = hour > 12 ? hour - 12 : hour;
                              const displayTime = `${displayHour}:${formattedMinute.padStart(2, '0')} ${hour >= 12 ? 'PM' : 'AM'}`;
                              
                              return (
                                <SelectItem key={timeValue} value={timeValue}>
                                  {displayTime}
                                </SelectItem>
                              );
                            });
                          })()}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                      <FormDescription>
                        Duration: {appointmentMode === 'trailer' ? '1 hour' : '4 hours'}
                      </FormDescription>
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={scheduleDetailsForm.control}
                name="dockId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dock Door*</FormLabel>
                    <Select 
                      value={field.value.toString()} 
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a dock" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {docks.map(dock => (
                          <SelectItem key={dock.id} value={dock.id.toString()}>
                            {dock.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={scheduleDetailsForm.control}
                  name="bolNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>BOL Number</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter BOL number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={scheduleDetailsForm.control}
                  name="poNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>PO Number</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter PO number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={scheduleDetailsForm.control}
                  name="palletCount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Pallet Count</FormLabel>
                      <FormControl>
                        <Input placeholder="Number of pallets" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={scheduleDetailsForm.control}
                  name="weight"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Weight</FormLabel>
                      <FormControl>
                        <Input placeholder="Weight in lbs" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={scheduleDetailsForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Add any additional information about this appointment"
                        className="resize-none" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <DialogFooter className="flex justify-between gap-2 pt-4">
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={handleClose}>
                    Cancel
                  </Button>
                  <Button type="button" variant="outline" onClick={goBack}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back
                  </Button>
                </div>
                
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Saving..." : mode === "create" ? "Create Appointment" : "Update Appointment"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}