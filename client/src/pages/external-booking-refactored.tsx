import React, { useState, ChangeEvent, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, TruckIcon, ArrowRight, ArrowLeft, Upload, FileText, AlertCircle, CheckCircle } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { format, parse } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { useQuery } from "@tanstack/react-query";
import { Facility, BookingPage, AppointmentType } from "@shared/schema";
import hanzoLogo from "@/assets/hanzo_logo.jpeg";
import dockOptimizerLogo from "@/assets/dock_optimizer_logo.jpg";
import { CarrierSelector } from "@/components/shared/carrier-selector";
import { BookingWizardProvider, useBookingWizard } from "@/contexts/BookingWizardContext";

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
  pickupOrDropoff: z.enum(["pickup", "dropoff"], {
    required_error: "Please select whether this is a pickup or dropoff",
  }),
});

// Step 2: Customer Information
const companyInfoSchema = z.object({
  customerName: z.string().min(2, "Customer name is required"),
  contactName: z.string().min(2, "Contact name is required"),
  contactEmail: z.string().email("Please enter a valid email"),
  contactPhone: z.string().min(10, "Please enter a valid phone number"),
});

// Step 3: Appointment Details
const appointmentDetailsSchema = z.object({
  appointmentDate: z.string().min(1, "Please select a date"),
  appointmentTime: z.string().min(1, "Please select a time"),
  carrierName: z.string().min(1, "Carrier name is required"),
  carrierId: z.number().optional(),
  // Added validation for MC Number format
  mcNumber: z.string().regex(/^\d{3}-\d{3}-\d{4}$/, "MC Number must be in format: XXX-XXX-XXXX").optional().or(z.literal("")),
  truckNumber: z.string().min(1, "Truck number is required"),
  trailerNumber: z.string().optional(),
  driverName: z.string().min(1, "Driver name is required"),
  driverPhone: z.string().min(10, "Please enter a valid phone number"),
  poNumber: z.string().optional(),
  bolNumber: z.string().optional(), 
  palletCount: z.string().optional(),
  weight: z.string().optional(),
  additionalNotes: z.string().optional(),
});

type InitialSelectionFormValues = z.infer<typeof initialSelectionSchema>;
type CompanyInfoFormValues = z.infer<typeof companyInfoSchema>;
type AppointmentDetailsFormValues = z.infer<typeof appointmentDetailsSchema>;

// Main booking component that provides context
export default function ExternalBooking() {
  const { slug } = useParams<{ slug: string }>();
  const [location, navigate] = useLocation();
  const { toast } = useToast();
  
  // Check if URL has reset parameter
  const shouldReset = useMemo(() => {
    if (location && location.search) {
      const searchStr = String(location.search);
      return searchStr.indexOf('reset=true') !== -1;
    }
    return false;
  }, [location]);

  // Fetch booking page data
  const { data: bookingPage, isLoading: isLoadingBookingPage, error: bookingPageError } = useQuery<BookingPage>({
    queryKey: [`/api/booking-pages/slug/${slug}`],
    enabled: !!slug,
    retry: 1
  });
  
  return (
    <BookingWizardProvider initialData={{
      type: 'inbound',  // Default to inbound
      appointmentMode: 'trailer',  // Default to trailer mode
    }}>
      <BookingWizardContent 
        slug={slug} 
        shouldReset={shouldReset} 
        bookingPage={bookingPage}
        isLoadingBookingPage={isLoadingBookingPage}
        bookingPageError={bookingPageError}
        navigate={navigate}
        toast={toast}
      />
    </BookingWizardProvider>
  );
}

// Content component that consumes the context
// Note: This component is also exported for use in the internal appointment modal
export function BookingWizardContent({ 
  slug, 
  shouldReset,
  bookingPage,
  isLoadingBookingPage,
  bookingPageError,
  navigate,
  toast
}: { 
  slug?: string; 
  shouldReset: boolean;
  bookingPage?: BookingPage;
  isLoadingBookingPage: boolean;
  bookingPageError: Error | null;
  navigate: (to: string, options?: { replace?: boolean }) => void;
  toast: any;
}) {
  const { 
    bookingData, 
    resetBooking, 
    updateTruckInfo,
    updateScheduleDetails,
    setBolFile,
    setAppointmentDateTime
  } = useBookingWizard();
  
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bolProcessing, setBolProcessing] = useState(false);
  const [parsedFacilities, setParsedFacilities] = useState<ParsedFacilities>({});
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  
  // Reference to prevent infinite re-renders
  const parsedFacilitiesRef = React.useRef<ParsedFacilities>({});
  
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
      console.log("DEBUG - Booking page:", bookingPage.name);
      console.log("DEBUG - Available facilities:", facilities.length);
      
      // Only process facilities once
      if (Object.keys(parsedFacilitiesRef.current).length === 0) {
        try {
          // Use all facilities by default
          const facilitiesMap: ParsedFacilities = {};
          
          // Add every facility to the map
          facilities.forEach(facility => {
            facilitiesMap[facility.id] = {
              facility,
              excludedAppointmentTypes: []
            };
          });
          
          console.log("Using all facilities for booking page:", Object.keys(facilitiesMap).length);
          
          // Store in ref to prevent infinite updates
          parsedFacilitiesRef.current = facilitiesMap;
          
          // Set facilities state once
          setParsedFacilities(facilitiesMap);
        } catch (err) {
          console.error("Error processing booking page data:", err);
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingPage, facilities, appointmentTypes]);
  
  // Handle form reset when coming from booking confirmation page
  useEffect(() => {
    if (shouldReset) {
      console.log("Resetting all forms based on URL query parameter");
      
      // Reset the context state
      resetBooking();
      
      // Reset forms to default values
      initialSelectionForm.reset({
        location: "",
        appointmentType: "",
        pickupOrDropoff: "dropoff",
      });
      
      companyInfoForm.reset({
        customerName: "",
        contactName: "",
        contactEmail: "",
        contactPhone: "",
      });
      
      appointmentDetailsForm.reset({
        appointmentDate: "",
        appointmentTime: "",
        carrierName: "",
        carrierId: undefined,
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
      });
      
      // Reset the step
      setStep(1);
      setSelectedLocation(null);
      
      // Clean up the URL
      navigate("/external-booking", { replace: true });
      
      toast({
        title: "Form Reset",
        description: "Starting a new appointment booking.",
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldReset]);
  
  // Step 1 Form
  const initialSelectionForm = useForm<InitialSelectionFormValues>({
    resolver: zodResolver(initialSelectionSchema),
    defaultValues: {
      location: "",
      appointmentType: "",
      pickupOrDropoff: "dropoff", // Default to dropoff
    },
  });
  
  // Step 2 Form
  const companyInfoForm = useForm<CompanyInfoFormValues>({
    resolver: zodResolver(companyInfoSchema),
    defaultValues: {
      customerName: "",
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
      carrierId: undefined,
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
    },
  });
  
  // Watch the location field to update appointment types
  const watchLocation = initialSelectionForm.watch("location");
  
  // Update available appointment types when location changes
  useEffect(() => {
    if (watchLocation !== selectedLocation && watchLocation) {
      setSelectedLocation(watchLocation);
      
      // Reset the appointment type when location changes
      if (watchLocation) {
        initialSelectionForm.setValue("appointmentType", "");
      }
    }
  }, [watchLocation, selectedLocation, initialSelectionForm.setValue]);
  
  // Handle BOL file upload
  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      
      setBolProcessing(true);
      
      // Read file contents for preview
      const reader = new FileReader();
      
      reader.onload = function(event) {
        try {
          // Extract text from the file for preview
          const previewText = event.target?.result as string || `File: ${file.name}`;
          
          // Update the central state with the file and preview text
          setBolFile(file, previewText.substring(0, 500));
          
          // Get appointment type details if available
          if (watchLocation && facilities && appointmentTypes) {
            const facilityId = parseInt(watchLocation);
            const facility = facilities.find(f => f.id === facilityId);
            
            if (facility) {
              // Update facility info in context
              updateScheduleDetails({
                facilityId: facility.id,
                facilityTimezone: facility.timezone || 'America/New_York'
              });
            }
          }
          
          setBolProcessing(false);
          
          toast({
            title: "File Uploaded",
            description: `Successfully uploaded ${file.name}`,
          });
          
        } catch (error) {
          console.error("Error processing file:", error);
          setBolProcessing(false);
          toast({
            title: "Upload Failed",
            description: "There was an error processing the file",
            variant: "destructive"
          });
        }
      };
      
      // Handle errors
      reader.onerror = function() {
        setBolProcessing(false);
        toast({
          title: "Upload Failed",
          description: "There was an error reading the file",
          variant: "destructive"
        });
      };
      
      // Read as text
      reader.readAsText(file);
    }
  };
  
  // Handle Step 1 Submission
  const onInitialSelectionSubmit = (data: InitialSelectionFormValues) => {
    // Get facility details
    let facilityTimezone = 'America/New_York'; // Default timezone
    let appointmentDuration = 60; // Default duration in minutes
    
    // Get facility details if possible
    if (data.location && facilities) {
      const facilityId = parseInt(data.location);
      const facility = facilities.find(f => f.id === facilityId);
      
      if (facility) {
        facilityTimezone = facility.timezone || facilityTimezone;
      }
    }
    
    // Get appointment type details if possible
    if (data.appointmentType && appointmentTypes) {
      const appointmentTypeId = parseInt(data.appointmentType);
      const appointmentType = appointmentTypes.find(t => t.id === appointmentTypeId);
      
      if (appointmentType) {
        appointmentDuration = appointmentType.duration || appointmentDuration;
      }
    }
    
    // Update booking wizard context with step 1 data
    updateScheduleDetails({
      facilityId: parseInt(data.location),
      facilityTimezone,
      appointmentTypeId: parseInt(data.appointmentType)
    });
    
    // Update direction (type) based on pickup/dropoff selection
    updateTruckInfo({
      type: data.pickupOrDropoff === 'pickup' ? 'outbound' : 'inbound'
    });
    
    // Proceed to next step
    setStep(2);
  };
  
  // Handle Step 2 Submission
  const onCompanyInfoSubmit = (data: CompanyInfoFormValues) => {
    // Update booking wizard context with step 2 data
    updateTruckInfo({
      customerName: data.customerName
    });
    
    // Set the values in the appointments form, but maintain separation of concerns
    appointmentDetailsForm.setValue("driverName", data.contactName);
    appointmentDetailsForm.setValue("driverPhone", data.contactPhone);
    
    // Proceed to step 3
    setStep(3);
  };
  
  // Handle Step 3 Submission
  const onAppointmentDetailsSubmit = async (data: AppointmentDetailsFormValues) => {
    setIsSubmitting(true);
    
    try {
      // Update booking wizard context with step 3 data
      updateTruckInfo({
        carrierId: data.carrierId || null,
        carrierName: data.carrierName,
        mcNumber: data.mcNumber || '',
        truckNumber: data.truckNumber,
        trailerNumber: data.trailerNumber || '',
        driverName: data.driverName,
        driverPhone: data.driverPhone
      });
      
      // Update schedule details
      updateScheduleDetails({
        bolNumber: data.bolNumber || '',
        poNumber: data.poNumber || '',
        palletCount: data.palletCount || '',
        weight: data.weight || '',
        notes: data.additionalNotes || ''
      });
      
      // Set the appointment date and time, properly handling timezone
      setAppointmentDateTime(
        data.appointmentDate,
        data.appointmentTime,
        bookingData.facilityTimezone || 'America/New_York'
      );
      
      // Make API request to create appointment
      const res = await apiRequest("POST", "/api/external-booking", bookingData);
      const result = await res.json();
      
      toast({
        title: "Appointment Scheduled",
        description: "Your appointment has been successfully scheduled. A confirmation email will be sent shortly.",
      });
      
      // Navigate to confirmation page with booking ID and confirmation number
      if (result.schedule && result.confirmationNumber) {
        navigate(`/booking-confirmation?bookingId=${result.schedule.id}&confirmationNumber=${result.confirmationNumber}`);
      } else {
        navigate("/booking-confirmation");
      }
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
              No booking page slug provided. Please check the URL and try again.
            </AlertDescription>
          </Alert>
        </div>
      );
    }
    
    // Loading booking page
    if (isLoadingBookingPage) {
      return (
        <div className="flex flex-col items-center justify-center py-12">
          <Loader2 className="h-12 w-12 animate-spin mb-4" />
          <p>Loading booking page...</p>
        </div>
      );
    }
    
    // Error loading booking page
    if (bookingPageError) {
      return (
        <div className="flex flex-col items-center justify-center py-12">
          <img src={dockOptimizerLogo} alt="Dock Optimizer" className="h-16 mb-4" />
          <Alert variant="destructive" className="max-w-lg">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>
              {bookingPageError.message || "Failed to load booking page. Please try again."}
            </AlertDescription>
          </Alert>
        </div>
      );
    }
    
    // Booking page not found
    if (!bookingPage) {
      return (
        <div className="flex flex-col items-center justify-center py-12">
          <img src={dockOptimizerLogo} alt="Dock Optimizer" className="h-16 mb-4" />
          <Alert variant="destructive" className="max-w-lg">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Booking Page Not Found</AlertTitle>
            <AlertDescription>
              The booking page "{slug}" does not exist. Please check the URL and try again.
            </AlertDescription>
          </Alert>
        </div>
      );
    }
    
    // Get available facility IDs
    const availableFacilityIds = Object.keys(parsedFacilities).map(Number);
    
    // Get filtered appointment types for selected location
    const filteredAppointmentTypes = selectedLocation ? 
      appointmentTypes.filter(type => 
        type.facilityId === parseInt(selectedLocation) && 
        !parsedFacilities[selectedLocation]?.excludedAppointmentTypes.includes(type.id)
      ) : [];
    
    // Step 1: Initial Selection
    if (step === 1) {
      return (
        <Card className="w-full md:max-w-3xl mx-auto mb-8">
          <CardHeader className="pb-6">
            <div className="flex justify-center mb-4">
              <img src={bookingPage.logoUrl || hanzoLogo} alt="Company Logo" className="h-12" />
            </div>
            <CardTitle className="text-center">{bookingPage.title || "Schedule an Appointment"}</CardTitle>
            <CardDescription className="text-center">{bookingPage.description || "Please select your preferences to begin."}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={initialSelectionForm.handleSubmit(onInitialSelectionSubmit)} className="space-y-6">
              <div className="flex items-center gap-4 mb-6">
                <div className="bg-primary text-primary-foreground rounded-full h-8 w-8 flex items-center justify-center font-bold">1</div>
                <h3 className="text-lg font-medium">Basic Details</h3>
                <Separator className="flex-1" />
              </div>
              
              {/* Location Selector */}
              <FormField
                control={initialSelectionForm.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location*</FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a location" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {isLoadingFacilities ? (
                          <div className="flex items-center justify-center p-4">
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            <span>Loading...</span>
                          </div>
                        ) : (
                          availableFacilityIds.map(id => {
                            const facility = parsedFacilities[id].facility;
                            return (
                              <SelectItem key={facility.id} value={facility.id.toString()}>
                                {facility.name}
                              </SelectItem>
                            );
                          })
                        )}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Select the facility you need to schedule with.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {/* Appointment Type Selector */}
              <FormField
                control={initialSelectionForm.control}
                name="appointmentType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Appointment Type*</FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      defaultValue={field.value}
                      disabled={!selectedLocation}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={selectedLocation ? "Select an appointment type" : "Select a location first"} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {isLoadingAppointmentTypes ? (
                          <div className="flex items-center justify-center p-4">
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            <span>Loading...</span>
                          </div>
                        ) : filteredAppointmentTypes.length === 0 ? (
                          <div className="p-3 text-center text-sm text-muted-foreground">
                            {selectedLocation ? "No appointment types available for selected location" : "Select a location first"}
                          </div>
                        ) : (
                          filteredAppointmentTypes.map(type => {
                            // Set the appointment mode based on type duration for BookingWizardContext
                            const appointmentMode = type.duration > 60 ? 'container' : 'trailer';
                            console.log("Selected appointment type:", type.id, type.name, "Duration:", type.duration, "minutes");
                            console.log("Setting appointment mode to", appointmentMode, "based on appointment type duration:", type.duration, "minutes");
                            
                            // Update the appointment mode in the context
                            if (field.value === type.id.toString()) {
                              updateTruckInfo({ appointmentMode });
                            }
                            
                            return (
                              <SelectItem 
                                key={type.id} 
                                value={type.id.toString()}
                                onSelect={() => updateTruckInfo({ appointmentMode })}
                              >
                                <div className="flex flex-col">
                                  <span>{type.name}</span>
                                  <span className="text-xs text-muted-foreground">{type.description}</span>
                                </div>
                              </SelectItem>
                            );
                          })
                        )}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Select the type of appointment you need to schedule.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {/* Pickup/Dropoff Selection */}
              <FormField
                control={initialSelectionForm.control}
                name="pickupOrDropoff"
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormLabel>Appointment Direction*</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        className="flex flex-col space-y-1"
                      >
                        <div className="flex items-center space-x-3 space-y-0">
                          <RadioGroupItem value="dropoff" id="dropoff" />
                          <Label htmlFor="dropoff">Dropoff (Inbound)</Label>
                        </div>
                        <div className="flex items-center space-x-3 space-y-0">
                          <RadioGroupItem value="pickup" id="pickup" />
                          <Label htmlFor="pickup">Pickup (Outbound)</Label>
                        </div>
                      </RadioGroup>
                    </FormControl>
                    <FormDescription>
                      Specify whether you are dropping off or picking up goods.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {/* BOL File Upload */}
              <div className="space-y-3">
                <FormLabel>BOL File (Optional)</FormLabel>
                <div className="flex flex-col border-2 border-dashed rounded-md p-4">
                  <div className="flex items-center gap-3">
                    <Button 
                      type="button" 
                      variant="outline" 
                      className="gap-2"
                      onClick={() => document.getElementById('bolFile')?.click()}
                      disabled={bolProcessing}
                    >
                      {bolProcessing ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4" />
                      )}
                      {bookingData.bolFile ? "Replace File" : "Upload BOL"}
                    </Button>
                    
                    <input
                      type="file"
                      id="bolFile"
                      accept=".pdf,.jpg,.jpeg,.png"
                      className="hidden"
                      onChange={handleFileUpload}
                      disabled={bolProcessing}
                    />
                    
                    {bookingData.bolFile && (
                      <div className="flex-1 truncate">
                        <span className="font-medium">{bookingData.bolFile.name}</span>
                        <span className="text-muted-foreground ml-2">
                          ({Math.round(bookingData.bolFile.size / 1024)} KB)
                        </span>
                      </div>
                    )}
                  </div>
                  
                  {bookingData.bolPreviewText && (
                    <div className="mt-3 p-3 rounded bg-muted max-h-40 overflow-y-auto text-sm">
                      <div className="flex items-center gap-2 mb-2">
                        <FileText className="h-4 w-4" />
                        <span className="font-medium">Extracted Data:</span>
                      </div>
                      <pre className="whitespace-pre-wrap">{bookingData.bolPreviewText}</pre>
                    </div>
                  )}
                </div>
                <FormDescription>
                  Upload your Bill of Lading (BOL) if available. We can extract information to pre-fill your booking.
                </FormDescription>
              </div>
              
              <div className="pt-4">
                <Button type="submit" className="w-full">
                  Continue <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      );
    }
    
    // Step 2: Company Information
    if (step === 2) {
      return (
        <Card className="w-full md:max-w-3xl mx-auto mb-8">
          <CardHeader className="pb-6">
            <div className="flex justify-center mb-4">
              <img src={bookingPage.logoUrl || hanzoLogo} alt="Company Logo" className="h-12" />
            </div>
            <CardTitle className="text-center">{bookingPage.title || "Schedule an Appointment"}</CardTitle>
            <CardDescription className="text-center">{bookingPage.description || "Please provide your company and contact information."}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={companyInfoForm.handleSubmit(onCompanyInfoSubmit)} className="space-y-6">
              <div className="flex items-center gap-4 mb-6">
                <div className="bg-muted text-muted-foreground rounded-full h-8 w-8 flex items-center justify-center font-bold">1</div>
                <div className="bg-primary text-primary-foreground rounded-full h-8 w-8 flex items-center justify-center font-bold">2</div>
                <h3 className="text-lg font-medium">Company Information</h3>
                <Separator className="flex-1" />
              </div>
              
              {/* Company Name */}
              <FormField
                control={companyInfoForm.control}
                name="customerName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company Name*</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter company name"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {/* Contact Name */}
              <FormField
                control={companyInfoForm.control}
                name="contactName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact Name*</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter contact name"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {/* Contact Email */}
              <FormField
                control={companyInfoForm.control}
                name="contactEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Address*</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="Enter email address"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {/* Contact Phone */}
              <FormField
                control={companyInfoForm.control}
                name="contactPhone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number*</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter phone number"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="pt-4 flex justify-between">
                <Button type="button" variant="outline" onClick={goBack}>
                  <ArrowLeft className="mr-2 h-4 w-4" /> Back
                </Button>
                <Button type="submit">
                  Continue <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      );
    }
    
    // Step 3: Appointment Details
    if (step === 3) {
      return (
        <Card className="w-full md:max-w-3xl mx-auto mb-8">
          <CardHeader className="pb-6">
            <div className="flex justify-center mb-4">
              <img src={bookingPage.logoUrl || hanzoLogo} alt="Company Logo" className="h-12" />
            </div>
            <CardTitle className="text-center">{bookingPage.title || "Schedule an Appointment"}</CardTitle>
            <CardDescription className="text-center">{bookingPage.description || "Please provide appointment details."}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={appointmentDetailsForm.handleSubmit(onAppointmentDetailsSubmit)} className="space-y-6">
              <div className="flex items-center gap-4 mb-6">
                <div className="bg-muted text-muted-foreground rounded-full h-8 w-8 flex items-center justify-center font-bold">1</div>
                <div className="bg-muted text-muted-foreground rounded-full h-8 w-8 flex items-center justify-center font-bold">2</div>
                <div className="bg-primary text-primary-foreground rounded-full h-8 w-8 flex items-center justify-center font-bold">3</div>
                <h3 className="text-lg font-medium">Appointment Details</h3>
                <Separator className="flex-1" />
              </div>
              
              {/* Date and Time Selection */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={appointmentDetailsForm.control}
                  name="appointmentDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Appointment Date*</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          placeholder="Select date"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={appointmentDetailsForm.control}
                  name="appointmentTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Appointment Time*</FormLabel>
                      <FormControl>
                        <Input
                          type="time"
                          placeholder="Select time"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              {/* Carrier Selection */}
              <div className="space-y-6">
                <CarrierSelector
                  form={appointmentDetailsForm}
                  nameFieldName="carrierName"
                  idFieldName="carrierId"
                  mcNumberFieldName="mcNumber"
                  label="Carrier Name*"
                  required
                />
                
                {/* MC Number */}
                <FormField
                  control={appointmentDetailsForm.control}
                  name="mcNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>MC Number</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="XXX-XXX-XXXX"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Motor Carrier Number in format XXX-XXX-XXXX
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              {/* Truck/Trailer Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={appointmentDetailsForm.control}
                  name="truckNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Truck Number*</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter truck number"
                          {...field}
                        />
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
                        <Input
                          placeholder="Enter trailer number"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              {/* Driver Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={appointmentDetailsForm.control}
                  name="driverName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Driver Name*</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter driver name"
                          {...field}
                        />
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
                        <Input
                          placeholder="Enter driver phone"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              {/* Shipment Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* BOL Number */}
                {(bookingData.bolFile || initialSelectionForm.getValues("pickupOrDropoff") === "dropoff") && (
                  <FormField
                    control={appointmentDetailsForm.control}
                    name="bolNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>BOL Number</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Enter BOL number"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                
                {/* PO Number */}
                {(initialSelectionForm.getValues("pickupOrDropoff") === "pickup") && (
                  <FormField
                    control={appointmentDetailsForm.control}
                    name="poNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>PO Number</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Enter PO number"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                
                {/* Pallet Count */}
                <FormField
                  control={appointmentDetailsForm.control}
                  name="palletCount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Pallet Count</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter pallet count"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* Weight */}
                <FormField
                  control={appointmentDetailsForm.control}
                  name="weight"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Weight</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter weight"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              {/* Additional Notes */}
              <FormField
                control={appointmentDetailsForm.control}
                name="additionalNotes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Additional Notes</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Enter any additional notes or special instructions"
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {/* Submission */}
              <div className="pt-4 flex justify-between">
                <Button type="button" variant="outline" onClick={goBack}>
                  <ArrowLeft className="mr-2 h-4 w-4" /> Back
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      Schedule Appointment <CheckCircle className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      );
    }
  };
  
  // Booking Wizard Layout
  return (
    <div className="p-4 md:p-8 container">
      <div className="flex flex-col space-y-4">
        {/* Step Indicator */}
        <div className="w-full max-w-3xl mx-auto mb-4">
          <div className="flex items-center">
            <div className={`flex items-center justify-center w-8 h-8 rounded-full ${step >= 1 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
              1
            </div>
            <div className={`flex-1 h-1 mx-2 ${step >= 2 ? 'bg-primary' : 'bg-muted'}`}></div>
            <div className={`flex items-center justify-center w-8 h-8 rounded-full ${step >= 2 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
              2
            </div>
            <div className={`flex-1 h-1 mx-2 ${step >= 3 ? 'bg-primary' : 'bg-muted'}`}></div>
            <div className={`flex items-center justify-center w-8 h-8 rounded-full ${step >= 3 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
              3
            </div>
          </div>
          <div className="flex justify-between mt-2 text-sm">
            <span className={step >= 1 ? 'text-primary font-medium' : 'text-muted-foreground'}>Basic Details</span>
            <span className={step >= 2 ? 'text-primary font-medium' : 'text-muted-foreground'}>Company Info</span>
            <span className={step >= 3 ? 'text-primary font-medium' : 'text-muted-foreground'}>Schedule</span>
          </div>
        </div>
        
        {/* Form Content */}
        {renderForm()}
      </div>
    </div>
  );
}