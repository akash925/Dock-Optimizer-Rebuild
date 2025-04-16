import React, { useState, ChangeEvent, useEffect, useMemo } from "react";
import { useForm, Control, UseFormSetValue } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, TruckIcon, ArrowRight, ArrowLeft, Upload, FileText, AlertCircle, Check, CheckCircle, ChevronsUpDown, PlusCircle, X } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { format, addDays, isAfter, isBefore, parse, startOfDay, startOfToday, endOfDay, getHours, getMinutes, setHours, setMinutes } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { useQuery } from "@tanstack/react-query";
import { Facility, BookingPage, AppointmentType, Carrier } from "@shared/schema";
import hanzoLogo from "@/assets/hanzo_logo.jpeg";
import dockOptimizerLogo from "@/assets/dock_optimizer_logo.jpg";

// Carrier Select Field Component
type CarrierSelectFieldProps = {
  field: any;
  control: Control<any>;
  setValue: UseFormSetValue<any>;
}

function CarrierSelectField({ field, setValue }: CarrierSelectFieldProps) {
  const [open, setOpen] = useState(false);
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [addingNewCarrier, setAddingNewCarrier] = useState(false);
  
  // Function to search carriers
  const searchCarriers = async (query: string) => {
    if (!query || query.length < 2) {
      setCarriers([]);
      return;
    }
    
    try {
      setIsSearching(true);
      const res = await fetch(`/api/carriers/search?query=${encodeURIComponent(query)}`);
      const data = await res.json();
      setCarriers(data);
    } catch (err) {
      console.error("Error searching carriers:", err);
    } finally {
      setIsSearching(false);
    }
  };
  
  // Debounce the search
  useEffect(() => {
    const timer = setTimeout(() => {
      searchCarriers(searchQuery);
    }, 300);
    
    return () => clearTimeout(timer);
  }, [searchQuery]);
  
  // Function to handle selecting a carrier
  const handleSelectCarrier = (carrier: Carrier) => {
    console.log("Selected carrier data:", carrier);
    
    // Make sure we're setting the actual carrier name, not email
    if (carrier && typeof carrier.name === 'string') {
      setValue("carrierName", carrier.name);
      
      // Only set MC number if it exists
      if (carrier.mcNumber && typeof carrier.mcNumber === 'string') {
        setValue("mcNumber", carrier.mcNumber);
      }
    }
    
    setOpen(false);
  };
  
  // Function to handle adding a new carrier
  const handleAddCarrier = () => {
    if (searchQuery.trim()) {
      setValue("carrierName", searchQuery.trim());
      setValue("mcNumber", "");
      setOpen(false);
      setAddingNewCarrier(false);
    }
  };

  return (
    <FormItem className="flex flex-col">
      <FormLabel>Carrier Name*</FormLabel>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <FormControl>
            <Button
              type="button"
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className={cn(
                "w-full justify-between text-left font-normal",
                !field.value && "text-muted-foreground"
              )}
            >
              <span className="flex-grow truncate">
                {field.value ? field.value : "Select or enter carrier name"}
              </span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </FormControl>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-0">
          <Command>
            <CommandInput 
              placeholder="Search carriers..." 
              value={searchQuery}
              onValueChange={setSearchQuery}
            />
            <CommandEmpty>
              {isSearching ? (
                <div className="py-6 text-center text-sm">
                  <Loader2 className="h-4 w-4 animate-spin mx-auto mb-2" />
                  Searching carriers...
                </div>
              ) : (
                <div className="py-3 px-2">
                  <p className="text-sm text-muted-foreground mb-2">No carrier found with that name.</p>
                  {!addingNewCarrier ? (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full" 
                      onClick={() => setAddingNewCarrier(true)}
                    >
                      <PlusCircle className="mr-2 h-4 w-4" />
                      Add "{searchQuery}" as new carrier
                    </Button>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">
                        Adding a new carrier? You can provide their MC Number in the next field if available.
                      </p>
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          className="flex-1" 
                          onClick={handleAddCarrier}
                        >
                          <CheckCircle className="mr-2 h-4 w-4" />
                          Confirm new carrier
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => setAddingNewCarrier(false)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CommandEmpty>
            <CommandGroup heading="Existing Carriers">
              {carriers.map(carrier => (
                <CommandItem
                  key={carrier.id}
                  value={carrier.name}
                  onSelect={() => handleSelectCarrier(carrier)}
                >
                  <div className="flex flex-col">
                    <div className="flex items-center">
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          field.value === carrier.name ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <span>{carrier.name}</span>
                    </div>
                    {carrier.mcNumber && (
                      <span className="text-xs text-muted-foreground ml-6">
                        MC: {carrier.mcNumber}
                      </span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </Command>
        </PopoverContent>
      </Popover>
      <FormMessage />
    </FormItem>
  );
}

interface ParsedFacilities {
  [facilityId: string]: {
    facility: Facility;
    excludedAppointmentTypes: number[];
  }
}

// Step 1: Initial Selections
const initialSelectionSchema = z.object({
  location: z.string().min(1, "Please select a location"),
  appointmentType: z.string().min(1, "Please select an appointment type"),
  bolUploaded: z.boolean().optional(),
});

// Step 2: Company Information
const companyInfoSchema = z.object({
  companyName: z.string().min(2, "Company name is required"),
  contactName: z.string().min(2, "Contact name is required"),
  contactEmail: z.string().email("Please enter a valid email"),
  contactPhone: z.string().min(10, "Please enter a valid phone number"),
});

// Step 3: Appointment Details
const appointmentDetailsSchema = z.object({
  appointmentDate: z.string().min(1, "Please select a date"),
  appointmentTime: z.string().min(1, "Please select a time"),
  carrierName: z.string().min(1, "Carrier name is required"),
  mcNumber: z.string().optional(),
  truckNumber: z.string().min(1, "Truck number is required"),
  trailerNumber: z.string().optional(),
  driverName: z.string().min(1, "Driver name is required"),
  driverPhone: z.string().min(10, "Please enter a valid phone number"),
  poNumber: z.string().optional(),
  bolNumber: z.string().optional(), 
  palletCount: z.string().optional(),
  weight: z.string().optional(),
  additionalNotes: z.string().optional(),
  bolFileUploaded: z.boolean().optional(),
});

// Combine all schemas for the final submission
const bookingSchema = initialSelectionSchema.merge(companyInfoSchema).merge(appointmentDetailsSchema);

type InitialSelectionFormValues = z.infer<typeof initialSelectionSchema>;
type CompanyInfoFormValues = z.infer<typeof companyInfoSchema>;
type AppointmentDetailsFormValues = z.infer<typeof appointmentDetailsSchema>;
type BookingFormValues = z.infer<typeof bookingSchema>;

export default function ExternalBooking() {
  const { slug } = useParams<{ slug: string }>();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<Partial<BookingFormValues>>({});
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [bolFile, setBolFile] = useState<File | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [bolProcessing, setBolProcessing] = useState(false);
  const [bolPreviewText, setBolPreviewText] = useState<string | null>(null);
  const [parsedFacilities, setParsedFacilities] = useState<ParsedFacilities>({});
  // Used to prevent infinite re-renders
  const parsedFacilitiesRef = React.useRef<ParsedFacilities>({});
  
  // Fetch booking page data
  const { data: bookingPage, isLoading: isLoadingBookingPage, error: bookingPageError } = useQuery<BookingPage>({
    queryKey: [`/api/booking-pages/slug/${slug}`],
    enabled: !!slug,
    retry: 1
  });
  
  // Fetch facilities that are in this booking page
  const { data: facilities = [], isLoading: isLoadingFacilities } = useQuery<Facility[]>({
    queryKey: ['/api/facilities'],
    enabled: !!bookingPage,
    retry: false
  });
  
  // Fetch appointment types
  const { data: appointmentTypes = [], isLoading: isLoadingAppointmentTypes } = useQuery<AppointmentType[]>({
    queryKey: ['/api/appointment-types'],
    enabled: !!bookingPage && !!facilities,
    retry: false
  });
  
  // Process facilities data when it's available
  useEffect(() => {
    if (bookingPage && facilities && appointmentTypes) {
      try {
        // Parse the facilities JSON array from the booking page
        const facilityIds = bookingPage.facilities as unknown as number[];
        const excludedAppointmentIds = bookingPage.excludedAppointmentTypes as unknown as number[] || [];
        
        // Create a map of facilities that are included in this booking page
        const facilitiesMap: ParsedFacilities = {};
        
        facilityIds.forEach(facilityId => {
          const facility = facilities.find(f => f.id === facilityId);
          if (facility) {
            facilitiesMap[facilityId] = {
              facility,
              excludedAppointmentTypes: excludedAppointmentIds
            };
          }
        });
        
        setParsedFacilities(facilitiesMap);
      } catch (err) {
        console.error("Error parsing booking page data:", err);
      }
    }
  }, [bookingPage, facilities, appointmentTypes]);
  
  // Step 1 Form
  const initialSelectionForm = useForm<InitialSelectionFormValues>({
    resolver: zodResolver(initialSelectionSchema),
    defaultValues: {
      location: "",
      appointmentType: "",
      bolUploaded: false,
    },
  });
  
  // Step 2 Form
  const companyInfoForm = useForm<CompanyInfoFormValues>({
    resolver: zodResolver(companyInfoSchema),
    defaultValues: {
      companyName: "",
      contactName: "",
      contactEmail: "",
      contactPhone: "",
    },
  });
  
  // Step 3 Form
  const appointmentDetailsForm = useForm<AppointmentDetailsFormValues>({
    resolver: zodResolver(appointmentDetailsSchema),
    defaultValues: {
      appointmentDate: "",
      appointmentTime: "",
      carrierName: "",
      mcNumber: "",
      truckNumber: "",
      trailerNumber: "",
      driverName: "",
      driverPhone: "",
      poNumber: "",
      bolNumber: "",
      palletCount: "",
      weight: "",
      additionalNotes: "",
      bolFileUploaded: false,
    },
  });

  // Watch the location field to update appointment types
  const watchLocation = initialSelectionForm.watch("location");
  
  // Use an effect to update available appointment types when location changes
  useEffect(() => {
    if (watchLocation !== selectedLocation && watchLocation) {
      setSelectedLocation(watchLocation);
      initialSelectionForm.setValue("appointmentType", "");
    }
  }, [watchLocation, selectedLocation]);

  // Handle BOL file upload
  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      setBolFile(file);
      setBolProcessing(true);
      
      // Simulate OCR processing
      setTimeout(() => {
        // Generate a random BOL number
        const bolNumber = `BOL-${Math.floor(Math.random() * 10000)}`;
        
        // Get a random facility from available ones
        const availableFacilities = Object.values(parsedFacilities);
        if (availableFacilities.length === 0) {
          setBolProcessing(false);
          toast({
            title: "Processing Error",
            description: "No facilities available for this booking page.",
            variant: "destructive"
          });
          return;
        }
        
        const randomFacility = availableFacilities[Math.floor(Math.random() * availableFacilities.length)].facility;
        
        // Find appointment types for this facility
        const facilityAppointmentTypes = appointmentTypes.filter(type => 
          type.facilityId === randomFacility.id && 
          !parsedFacilities[randomFacility.id]?.excludedAppointmentTypes.includes(type.id)
        );
        
        const previewText = `Bill of Lading #${bolNumber}
Location: ${randomFacility.name}
Type: ${Math.random() > 0.5 ? 'Pickup' : 'Dropoff'}`;
        
        setBolPreviewText(previewText);
        setBolProcessing(false);
        
        // Pre-select fields based on "OCR"
        initialSelectionForm.setValue("location", randomFacility.id.toString());
        
        // Set appointment type if available
        if (facilityAppointmentTypes.length > 0) {
          const randomAppointmentType = facilityAppointmentTypes[Math.floor(Math.random() * facilityAppointmentTypes.length)];
          initialSelectionForm.setValue("appointmentType", randomAppointmentType.id.toString());
        }
        
        initialSelectionForm.setValue("bolUploaded", true);
        
        // Also set the bol number for step 3
        appointmentDetailsForm.setValue("bolNumber", bolNumber);
        
        toast({
          title: "BOL Uploaded and Processed",
          description: "We've extracted some information to help you with your booking.",
        });
      }, 2000);
    }
  };

  // Update form values when moving between steps
  const updateFormData = (data: Partial<BookingFormValues>) => {
    setFormData(prev => ({...prev, ...data}));
  };

  // Handle Step 1 Submission
  const onInitialSelectionSubmit = (data: InitialSelectionFormValues) => {
    updateFormData(data);
    setStep(2);
  };

  // Handle Step 2 Submission
  const onCompanyInfoSubmit = (data: CompanyInfoFormValues) => {
    updateFormData(data);
    
    // Only proceed to step 3, no more auto-clearing of fields
    // which might have been causing issues with carrier selection
    setStep(3);
  };

  // Handle Step 3 Submission
  const onAppointmentDetailsSubmit = async (data: AppointmentDetailsFormValues) => {
    setIsSubmitting(true);
    try {
      // Combine all form data
      const completeFormData = {...formData, ...data};
      
      // Make API request to create appointment
      const res = await apiRequest("POST", "/api/external-booking", completeFormData);
      const result = await res.json();
      
      toast({
        title: "Appointment Scheduled",
        description: "Your appointment has been successfully scheduled. A confirmation email will be sent shortly.",
      });
      
      // Navigate to confirmation page
      navigate("/booking-confirmation");
    } catch (error: any) {
      toast({
        title: "Booking Failed",
        description: error.message || "There was an error scheduling your appointment. Please try again.",
        variant: "destructive",
      });
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

  // Render the appropriate form based on current step
  const renderForm = () => {
    // No slug provided
    if (!slug) {
      return (
        <div className="flex flex-col items-center justify-center py-12">
          <img src={dockOptimizerLogo} alt="Dock Optimizer" className="h-16 mb-4" />
          <Alert variant="destructive" className="max-w-lg">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Invalid URL</AlertTitle>
            <AlertDescription>
              No booking page specified. Please check the URL or contact the administrator.
            </AlertDescription>
          </Alert>
        </div>
      );
    }
    
    // Loading state
    if (isLoadingBookingPage || isLoadingFacilities || isLoadingAppointmentTypes) {
      return (
        <div className="flex flex-col items-center justify-center py-12">
          <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
          <p className="text-lg font-medium">Loading booking page...</p>
        </div>
      );
    }
    
    // Error state
    if (bookingPageError || !bookingPage) {
      return (
        <div className="flex flex-col items-center justify-center py-12">
          <img src={dockOptimizerLogo} alt="Dock Optimizer" className="h-16 mb-4" />
          <Alert variant="destructive" className="max-w-lg">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>
              {bookingPageError ? bookingPageError.message : `Booking page "${slug}" not found.`}
            </AlertDescription>
          </Alert>
        </div>
      );
    }
    
    // No facilities configured
    if (Object.keys(parsedFacilities).length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-12">
          <img 
            src={bookingPage.customLogo ? `data:image/jpeg;base64,${bookingPage.customLogo}` : dockOptimizerLogo} 
            alt={bookingPage.title} 
            className="h-16 mb-4"
          />
          <Alert variant="destructive" className="max-w-lg">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Configuration Error</AlertTitle>
            <AlertDescription>
              No facilities are configured for this booking page. Please contact the administrator.
            </AlertDescription>
          </Alert>
        </div>
      );
    }
    
    switch (step) {
      case 1:
        return (
          <Form {...initialSelectionForm}>
            <form onSubmit={initialSelectionForm.handleSubmit(onInitialSelectionSubmit)} className="space-y-6">
              <Tabs defaultValue="standard" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="standard">Standard Booking</TabsTrigger>
                  <TabsTrigger value="bol">Upload BOL</TabsTrigger>
                </TabsList>
                <TabsContent value="standard" className="space-y-6">
                  <FormField
                    control={initialSelectionForm.control}
                    name="location"
                    render={({ field }) => (
                      <FormItem className="mt-4">
                        <FormLabel>Location*</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select Location" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Object.values(parsedFacilities).map(({ facility }) => (
                              <SelectItem key={facility.id} value={facility.id.toString()}>{facility.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  {watchLocation && (
                    <FormField
                      control={initialSelectionForm.control}
                      name="appointmentType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Appointment Type*</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select Appointment Type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {appointmentTypes
                                .filter(type => type.facilityId === parseInt(watchLocation))
                                .filter(type => {
                                  // Check if this appointment type is excluded
                                  const facilityInfo = parsedFacilities[parseInt(watchLocation)];
                                  return facilityInfo && !facilityInfo.excludedAppointmentTypes.includes(type.id);
                                })
                                .map(type => (
                                  <SelectItem key={type.id} value={type.id.toString()}>
                                    {type.name}
                                  </SelectItem>
                                ))
                              }
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                </TabsContent>
                
                <TabsContent value="bol" className="space-y-4">
                  <div className="border-2 border-dashed rounded-md border-gray-300 p-6 flex flex-col items-center justify-center bg-gray-50">
                    <input
                      type="file"
                      id="bol-upload"
                      className="hidden"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={handleFileUpload}
                    />
                    <FileText className="h-10 w-10 text-gray-400 mb-2" />
                    {bolProcessing ? (
                      <div className="flex flex-col items-center">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        <p className="mt-2 text-sm text-gray-500">Processing your BOL...</p>
                      </div>
                    ) : bolFile ? (
                      <div className="flex flex-col items-center">
                        <p className="font-medium text-green-600">File Uploaded: {bolFile.name}</p>
                        <div className="mt-4 p-3 bg-white border rounded-md max-w-full w-full">
                          <p className="text-sm font-medium text-gray-700">Extracted Information:</p>
                          <pre className="mt-2 text-xs whitespace-pre-wrap bg-gray-50 p-2 rounded">
                            {bolPreviewText}
                          </pre>
                        </div>
                        <Button 
                          type="button" 
                          variant="outline" 
                          size="sm" 
                          onClick={() => {
                            setBolFile(null);
                            setBolPreviewText(null);
                          }}
                          className="mt-3"
                        >
                          Upload Different File
                        </Button>
                      </div>
                    ) : (
                      <>
                        <p className="mb-2 text-sm font-medium text-gray-500">Upload your Bill of Lading</p>
                        <p className="text-xs text-gray-400 text-center max-w-xs mb-3">
                          We'll extract information to help pre-fill your booking details
                        </p>
                        <label htmlFor="bol-upload">
                          <Button type="button" variant="outline" size="sm">
                            <Upload className="h-4 w-4 mr-2" />
                            Choose File
                          </Button>
                        </label>
                        <p className="mt-2 text-xs text-gray-400">Supported formats: PDF, JPG, PNG</p>
                      </>
                    )}
                  </div>
                  
                  {initialSelectionForm.watch("bolUploaded") && (
                    <>
                      <div className="space-y-3 mt-4">
                        <p className="text-sm font-medium">We've pre-filled the following information:</p>
                        
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <span className="font-medium">Location:</span>
                            <p className="text-gray-600">
                              {Object.values(parsedFacilities).find(({ facility }) => 
                                facility.id.toString() === initialSelectionForm.watch("location")
                              )?.facility.name || "Not detected"}
                            </p>
                          </div>
                          
                          <div>
                            <span className="font-medium">Appointment Type:</span>
                            <p className="text-gray-600">
                              {appointmentTypes.find(type => 
                                type.id.toString() === initialSelectionForm.watch("appointmentType")
                              )?.name || "Not detected"}
                            </p>
                          </div>
                          
                          <div>
                            <span className="font-medium">BOL Number:</span>
                            <p className="text-gray-600">
                              {appointmentDetailsForm.watch("bolNumber") || "Not detected"}
                            </p>
                          </div>
                        </div>
                        
                        <p className="text-xs text-gray-500 italic">
                          You can review and modify these details in the following steps.
                        </p>
                      </div>
                      
                      <FormField
                        control={initialSelectionForm.control}
                        name="location"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Confirm Location*</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select Location" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {Object.values(parsedFacilities).map(({ facility }) => (
                                  <SelectItem key={facility.id} value={facility.id.toString()}>{facility.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      {watchLocation && (
                        <FormField
                          control={initialSelectionForm.control}
                          name="appointmentType"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Confirm Appointment Type*</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select Appointment Type" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {appointmentTypes
                                    .filter(type => type.facilityId === parseInt(watchLocation))
                                    .filter(type => {
                                      // Check if this appointment type is excluded
                                      const facilityInfo = parsedFacilities[parseInt(watchLocation)];
                                      return facilityInfo && !facilityInfo.excludedAppointmentTypes.includes(type.id);
                                    })
                                    .map(type => (
                                      <SelectItem key={type.id} value={type.id.toString()}>
                                        {type.name}
                                      </SelectItem>
                                    ))
                                  }
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                    </>
                  )}
                </TabsContent>
              </Tabs>
              
              <Button type="submit" className="w-full flex items-center justify-center">
                Next <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </form>
          </Form>
        );
      
      case 2:
        return (
          <Form {...companyInfoForm}>
            <form onSubmit={companyInfoForm.handleSubmit(onCompanyInfoSubmit)} className="space-y-6">
              <FormField
                control={companyInfoForm.control}
                name="companyName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company Name*</FormLabel>
                    <FormControl>
                      <Input placeholder="Your Company" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={companyInfoForm.control}
                name="contactName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact Name*</FormLabel>
                    <FormControl>
                      <Input placeholder="Full Name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={companyInfoForm.control}
                name="contactEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact Email*</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="email@company.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={companyInfoForm.control}
                name="contactPhone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact Phone*</FormLabel>
                    <FormControl>
                      <Input placeholder="(123) 456-7890" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-0 sm:justify-between">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={goBack}
                  className="w-full sm:w-auto order-2 sm:order-1 flex items-center justify-center"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" /> Back
                </Button>
                <Button 
                  type="submit"
                  className="w-full sm:w-auto order-1 sm:order-2 flex items-center justify-center"
                >
                  Next <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </form>
          </Form>
        );
      
      case 3:
        return (
          <Form {...appointmentDetailsForm}>
            <form onSubmit={appointmentDetailsForm.handleSubmit(onAppointmentDetailsSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={appointmentDetailsForm.control}
                  name="appointmentDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Appointment Date*</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={"outline"}
                              className={cn(
                                "w-full pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value ? (
                                format(new Date(field.value), "MM/dd/yyyy")
                              ) : (
                                <span>Select a date</span>
                              )}
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value ? new Date(field.value) : undefined}
                            onSelect={(date) => {
                              if (date) {
                                // Ensure we're selecting the correct date (not the prior day)
                                const today = startOfToday();
                                const selectedDate = startOfDay(date);
                                
                                // Convert to ISO string for form storage
                                field.onChange(format(selectedDate, "yyyy-MM-dd"));
                              } else {
                                field.onChange("");
                              }
                            }}
                            disabled={(date) => 
                              // Disable dates before today and weekends (Saturday and Sunday)
                              isBefore(date, startOfToday()) ||
                              date.getDay() === 0 || 
                              date.getDay() === 6
                            }
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={appointmentDetailsForm.control}
                  name="appointmentTime"
                  render={({ field }) => {
                    // Get the currently selected appointment date
                    const selectedDate = appointmentDetailsForm.watch("appointmentDate");
                    const now = new Date();
                    const currentHour = now.getHours();
                    const currentMinute = now.getMinutes();
                    
                    // Only show future times if the selected date is today
                    const isToday = selectedDate ? 
                      format(new Date(selectedDate), "yyyy-MM-dd") === format(now, "yyyy-MM-dd") : 
                      false;
                    
                    // Available time slots
                    const timeSlots = [
                      { value: "08:00", label: "8:00 AM", available: 2 },
                      { value: "08:30", label: "8:30 AM", available: 3 },
                      { value: "09:00", label: "9:00 AM", available: 1 },
                      { value: "09:30", label: "9:30 AM", available: 2 },
                      { value: "10:00", label: "10:00 AM", available: 2 },
                      { value: "10:30", label: "10:30 AM", available: 3 },
                      { value: "11:00", label: "11:00 AM", available: 1 },
                      { value: "11:30", label: "11:30 AM", available: 2 },
                      { value: "12:00", label: "12:00 PM", available: 3 },
                      { value: "12:30", label: "12:30 PM", available: 2 },
                      { value: "13:00", label: "1:00 PM", available: 2 },
                      { value: "13:30", label: "1:30 PM", available: 1 },
                      { value: "14:00", label: "2:00 PM", available: 3 },
                      { value: "14:30", label: "2:30 PM", available: 2 },
                      { value: "15:00", label: "3:00 PM", available: 3 },
                      { value: "15:30", label: "3:30 PM", available: 1 },
                      { value: "16:00", label: "4:00 PM", available: 2 },
                      { value: "16:30", label: "4:30 PM", available: 3 },
                    ];
                    
                    // Filter out past times if the selected date is today
                    const availableTimeSlots = timeSlots.filter(slot => {
                      if (!selectedDate) return false;
                      
                      if (isToday) {
                        const [hour, minute] = slot.value.split(":").map(Number);
                        if (hour < currentHour || (hour === currentHour && minute <= currentMinute)) {
                          return false;
                        }
                      }
                      
                      return true;
                    });
                    
                    // Use effect to clear time selection when date changes
                    useEffect(() => {
                      if (!selectedDate && field.value) {
                        field.onChange("");
                      }
                    }, [selectedDate, field.value]);
                    
                    return (
                      <FormItem>
                        <FormLabel>Appointment Time*</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          value={field.value}
                          disabled={!selectedDate}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a time slot" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {!availableTimeSlots.length && (
                              <div className="px-2 py-4 text-center">
                                <p className="text-sm text-muted-foreground">
                                  {!selectedDate 
                                    ? "Please select a date first" 
                                    : "No available time slots for the selected date"}
                                </p>
                              </div>
                            )}
                            {availableTimeSlots.map(slot => (
                              <SelectItem key={slot.value} value={slot.value}>
                                <div className="flex justify-between items-center w-full">
                                  <span>{slot.label}</span>
                                  <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-800">
                                    {slot.available} {slot.available === 1 ? "slot" : "slots"}
                                  </span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />
              </div>

              <div className="bg-yellow-50 p-3 rounded-md border border-yellow-200">
                <p className="text-sm text-yellow-800">
                  <strong>Important:</strong> MC Numbers are required for all shipments as of August 1st, 2023.
                </p>
              </div>
              
              <FormField
                control={appointmentDetailsForm.control}
                name="carrierName"
                render={({ field }) => (
                  <CarrierSelectField 
                    field={field}
                    control={appointmentDetailsForm.control} 
                    setValue={appointmentDetailsForm.setValue} 
                  />
                )}
              />

              <FormField
                control={appointmentDetailsForm.control}
                name="mcNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>MC Number</FormLabel>
                    <FormDescription>Motor Carrier number (if available)</FormDescription>
                    <FormControl>
                      <Input 
                        placeholder="MC Number (Optional)" 
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={appointmentDetailsForm.control}
                  name="truckNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Truck Number*</FormLabel>
                      <FormControl>
                        <Input placeholder="Truck Number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={appointmentDetailsForm.control}
                  name="trailerNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Trailer Number</FormLabel>
                      <FormControl>
                        <Input placeholder="Trailer Number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={appointmentDetailsForm.control}
                  name="driverName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Driver Name*</FormLabel>
                      <FormControl>
                        <Input placeholder="Driver Name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={appointmentDetailsForm.control}
                  name="driverPhone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Driver Phone*</FormLabel>
                      <FormControl>
                        <Input placeholder="(123) 456-7890" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={appointmentDetailsForm.control}
                  name="poNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>PO Number</FormLabel>
                      <FormControl>
                        <Input placeholder="PO Number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={appointmentDetailsForm.control}
                  name="bolNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>BOL Number</FormLabel>
                      <FormControl>
                        <Input placeholder="BOL Number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={appointmentDetailsForm.control}
                  name="palletCount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Pallet Count</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="Number of Pallets" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={appointmentDetailsForm.control}
                  name="weight"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Weight (lbs)</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="Total Weight" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={appointmentDetailsForm.control}
                name="additionalNotes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Additional Notes</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Any special instructions or requirements" 
                        className="resize-none min-h-[100px]" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {/* BOL Upload */}
              <div className="border-2 border-dashed rounded-md border-gray-300 p-6">
                <div className="mb-2 flex items-start">
                  <FileText className="h-5 w-5 text-gray-500 mr-2 mt-0.5" />
                  <div>
                    <h3 className="font-medium text-gray-900">BOL Document Upload</h3>
                    <p className="text-sm text-gray-500">
                      If you have a BOL document ready, you can upload it here. Accepted formats: PDF, JPG, PNG.
                    </p>
                  </div>
                </div>
                
                <div className="mt-4">
                  <input
                    type="file"
                    id="bol-upload-step3"
                    className="hidden"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => {
                      const files = e.target.files;
                      if (files && files.length > 0) {
                        const file = files[0];
                        setBolFile(file);
                        appointmentDetailsForm.setValue("bolFileUploaded", true);
                        appointmentDetailsForm.setValue("bolNumber", appointmentDetailsForm.getValues("bolNumber") || `BOL-${Date.now().toString().slice(-6)}`);
                        
                        toast({
                          title: "BOL Uploaded",
                          description: `File "${file.name}" has been attached to this appointment.`,
                        });
                      }
                    }}
                  />
                  
                  <div className="flex items-center">
                    {bolFile ? (
                      <div className="flex-1 flex items-center bg-green-50 border border-green-200 rounded-md p-3">
                        <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-green-800">BOL Document Uploaded</p>
                          <p className="text-xs text-green-700">{bolFile.name}</p>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => {
                            setBolFile(null);
                            appointmentDetailsForm.setValue("bolFileUploaded", false);
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <label htmlFor="bol-upload-step3" className="flex cursor-pointer">
                        <Button type="button" variant="outline" size="sm">
                          <Upload className="h-4 w-4 mr-2" />
                          Choose File
                        </Button>
                      </label>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-0 sm:justify-between">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={goBack}
                  className="w-full sm:w-auto order-2 sm:order-1 flex items-center justify-center"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" /> Back
                </Button>
                <Button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="w-full sm:w-auto order-1 sm:order-2 flex items-center justify-center"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 
                      Submitting
                    </>
                  ) : (
                    "Schedule Appointment"
                  )}
                </Button>
              </div>
            </form>
          </Form>
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-green-50 py-6 md:py-12 px-2 md:px-4">
      {step === 1 ? (
        // Step 1: Two-column layout with information on left, form on right
        <div className="max-w-7xl mx-auto w-full">
          {/* Header with logo */}
          <div className="flex items-center justify-center mb-8">
            {bookingPage && (
              <img 
                src={bookingPage?.customLogo ? `data:image/jpeg;base64,${bookingPage.customLogo}` : hanzoLogo} 
                alt={bookingPage?.title || "Hanzo Logistics"} 
                className="h-16" 
              />
            )}
          </div>
          
          {/* Two-column layout for desktop, stacked for mobile */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
            {/* Left Side - Information Block */}
            <div className="md:col-span-5 space-y-6">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                  {bookingPage?.title || "Hanzo Logistics Dock Appointment Scheduler"}
                </h1>
                <p className="text-gray-600 mb-4">
                  Please use this form to pick the type of Dock Appointment that
                  you need at Hanzo Logistics. For support using this page,
                  please <a href="#" className="text-blue-600 hover:underline">check out this video</a>.
                </p>
              </div>
              
              <div className="border-l-4 border-yellow-400 bg-yellow-50 p-4">
                <p className="text-sm text-gray-800">
                  <span className="font-semibold">Please provide MC Numbers when available for
                  incoming and outgoing shipments.</span> This helps protect the
                  security of our customer's shipments and reduce the risk of
                  fraud.
                </p>
              </div>
              
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">HANZO LOGISTICS INC.</h3>
                <p className="text-gray-700 mb-1">Select from the following locations:</p>
                <div className="space-y-1 text-sm text-gray-700">
                  <p>450 Airtech Pkwy Plainfield IN 46168</p>
                  <p>8370 E Camby Rd Plainfield IN 46168</p>
                  <p>4001 W Minnesota Street Indianapolis, IN 46241</p>
                  <p>(HANZO Cold-Chain)</p>
                  <p>4334 Plainfield Road Plainfield, IN 46231</p>
                  <p>9915 Lacy Knot Dr, Brownsburg, IN 46112</p>
                </div>
              </div>
              
              <p className="text-sm text-gray-700">
                Please arrive 15 minutes before your appointment and check in at the guard shack.
              </p>
            </div>
            
            {/* Right Side - Form Block */}
            <div className="md:col-span-7">
              <Card className="border-0 shadow-lg rounded-lg overflow-hidden">
                <CardContent className="pt-6 px-6 pb-6">
                  {renderForm()}
                </CardContent>
              </Card>
            </div>
          </div>
          
          {/* Footer */}
          <div className="mt-8 text-center text-xs text-gray-500">
            &copy; {new Date().getFullYear()} Conmitto Inc. All rights reserved.
          </div>
        </div>
      ) : (
        // Steps 2 and 3: Standard layout with card
        <div className="max-w-4xl mx-auto w-full">
          {/* Header */}
          <div className="flex flex-col items-center mb-6 md:mb-8">
            <div className="flex flex-col md:flex-row items-center justify-between mb-4 text-center w-full">
              {bookingPage && (
                <div className="flex items-center gap-3">
                  <img 
                    src={bookingPage.customLogo ? `data:image/jpeg;base64,${bookingPage.customLogo}` : hanzoLogo} 
                    alt={bookingPage.title || "Hanzo Logistics"} 
                    className="h-16" 
                  />
                  <h1 className="text-2xl font-bold text-gray-800">{bookingPage.title || "Schedule Appointment"}</h1>
                </div>
              )}
              <div className="text-sm text-gray-500 mt-2 md:mt-0">
                Powered by <span className="font-medium">Dock Optimizer</span>
              </div>
            </div>
          </div>
          
          {/* Progress indicator */}
          <div className="w-full max-w-3xl mx-auto mb-6">
            <div className="relative pt-1">
              <div className="flex mb-2 items-center justify-between">
                <div className="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full text-primary bg-primary-50">
                  Step {step} of 3
                </div>
              </div>
              <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-primary-100">
                <div
                  style={{ width: `${(step / 3) * 100}%` }}
                  className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-primary"
                ></div>
              </div>
            </div>
          </div>
          
          {/* Main form card */}
          <Card className="w-full shadow-lg mb-8">
            <CardHeader>
              <CardTitle>
                {step === 2 && "Company Information"}
                {step === 3 && "Appointment Details"}
              </CardTitle>
              <CardDescription>
                {step === 2 && "Please provide your company and contact information"}
                {step === 3 && "Please provide details about your appointment"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {renderForm()}
            </CardContent>
            <CardFooter className="flex flex-col">
              <p className="text-xs text-center text-neutral-500 mt-4">
                Please arrive 15 minutes before your appointment and check in at the security desk.
              </p>
              {formData.appointmentType === "shipping" && (
                <p className="text-xs text-center text-neutral-500 mt-2">
                  For shipping appointments, please ensure all paperwork is ready upon arrival.
                </p>
              )}
            </CardFooter>
          </Card>
          
          {/* Footer */}
          <div className="text-center text-xs text-gray-500 mt-4">
            &copy; {new Date().getFullYear()} Conmitto Inc. All rights reserved.
          </div>
        </div>
      )}
    </div>
  );
}