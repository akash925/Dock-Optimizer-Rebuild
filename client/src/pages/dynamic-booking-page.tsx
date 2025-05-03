import React, { useState, useEffect, useRef } from "react";
import { useLocation, Link, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { CalendarIcon, Clock, MapPin, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import BolUpload from "@/components/shared/bol-upload";

// Types for API data
type BookingPage = {
  id: number;
  name: string;
  slug: string;
  title: string;
  description?: string;
  welcomeMessage?: string;
  confirmationMessage?: string;
  isActive: boolean;
  facilities: number[] | Record<string, any>;
  excludedAppointmentTypes?: number[];
  useOrganizationLogo: boolean;
  customLogo?: string | null;
  primaryColor?: string;
  createdAt: string | Date;
};

type Facility = {
  id: number;
  name: string;
  address1: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  tenantId: number;
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

type ParsedFacilities = {
  [facilityId: number]: {
    facility: Facility;
    excludedAppointmentTypes: number[];
  };
};

// Form validation schemas for each step
const initialSelectionSchema = z.object({
  location: z.string({ required_error: "Please select a location" }),
  appointmentType: z.string({ required_error: "Please select an appointment type" }),
  pickupOrDropoff: z.enum(["pickup", "dropoff"], { required_error: "Please select pickup or dropoff" }),
  bolUploaded: z.boolean().optional(),
});

const companyInfoSchema = z.object({
  customerName: z.string().min(2, "Customer name is required"),
  contactName: z.string().min(2, "Contact name is required"),
  contactEmail: z.string().email("Please enter a valid email address"),
  contactPhone: z.string().min(10, "Please enter a valid phone number"),
});

const appointmentDetailsSchema = z.object({
  appointmentDate: z.string({ required_error: "Please select a date" }),
  appointmentTime: z.string({ required_error: "Please select a time" }),
  carrierName: z.string().min(2, "Carrier name is required"),
  carrierId: z.number().optional(),
  mcNumber: z.string().optional(),
  truckNumber: z.string().min(1, "Truck number is required"),
  trailerNumber: z.string().optional(),
  driverName: z.string().min(2, "Driver name is required"),
  driverPhone: z.string().min(10, "Please enter a valid phone number"),
  poNumber: z.string().optional(),
  bolNumber: z.string().optional(),
  palletCount: z.string().optional(),
  weight: z.string().optional(),
  additionalNotes: z.string().optional(),
  bolFileUploaded: z.boolean().optional(),
});

// Define the props for the component
type FormValues = {
  location?: string;
  appointmentType?: string;
  pickupOrDropoff?: "pickup" | "dropoff";
  bolUploaded?: boolean;
  customerName?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  appointmentDate?: string;
  appointmentTime?: string;
  carrierName?: string;
  carrierId?: number;
  mcNumber?: string;
  truckNumber?: string;
  trailerNumber?: string;
  driverName?: string;
  driverPhone?: string;
  poNumber?: string;
  bolNumber?: string;
  palletCount?: string;
  weight?: string;
  additionalNotes?: string;
  bolFileUploaded?: boolean;
};

// Typing for our steps
type InitialSelectionFormValues = z.infer<typeof initialSelectionSchema>;
type CompanyInfoFormValues = z.infer<typeof companyInfoSchema>;
type AppointmentDetailsFormValues = z.infer<typeof appointmentDetailsSchema>;

export default function DynamicBookingPage() {
  const [location, setLocation] = useState<string | null>(null);
  const { toast } = useToast();
  const [currentNav, setCurrentNav] = useState("/");
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<FormValues>({});
  const [bolFile, setBolFile] = useState<File | null>(null);
  const [bolPreviewText, setBolPreviewText] = useState<string | null>(null);
  const [bolProcessing, setBolProcessing] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [availableTimes, setAvailableTimes] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isLoadingAvailability, setIsLoadingAvailability] = useState(false);
  
  // Use ref to track parsed facilities to prevent infinite loops
  const parsedFacilitiesRef = useRef<ParsedFacilities>({});
  const [parsedFacilities, setParsedFacilities] = useState<ParsedFacilities>({});
  
  // Get the slug parameter from the URL using proper route matching
  const [matchedRoute, params] = useRoute('/booking/:slug');
  const slug = params?.slug || '';
  
  // Get current location
  const [currentPath] = useLocation();
  
  // Debug the URL and slug extraction
  console.log("DEBUG - Current URL path:", currentPath);
  console.log("DEBUG - Route matched:", matchedRoute);
  console.log("DEBUG - Extracted slug:", slug);
  
  // Check for reset parameter in the URL
  const urlParams = new URLSearchParams(window.location.search);
  const shouldReset = urlParams.get('reset') === 'true';
  
  // Fetch booking page data from API
  const { data: bookingPage, isLoading: isLoadingBookingPage } = useQuery({
    queryKey: ['/api/booking-pages/slug', slug],
    enabled: !!slug,
    retry: 1
  });
  
  // Fetch facilities that are in this booking page
  const { data: facilities = [], isLoading: isLoadingFacilities } = useQuery<Facility[]>({
    queryKey: ['/api/facilities', { bookingPageSlug: slug }],
    enabled: !!bookingPage && !!slug,
    retry: false
  });
  
  // Fetch appointment types
  const { data: appointmentTypes = [], isLoading: isLoadingAppointmentTypes } = useQuery<AppointmentType[]>({
    queryKey: ['/api/appointment-types', { bookingPageSlug: slug }],
    enabled: !!bookingPage && !!facilities && !!slug,
    retry: false
  });
  
  // Process facilities data when it's available - only run once
  useEffect(() => {
    if (bookingPage && facilities && appointmentTypes) {
      console.log("DEBUG - Booking page:", bookingPage.name);
      console.log("DEBUG - Available facilities:", facilities.length);
      console.log("DEBUG - Booking page facilities data:", typeof bookingPage.facilities);
      
      // Only process facilities if we haven't done so yet
      if (Object.keys(parsedFacilitiesRef.current).length === 0) {
        try {
          const facilitiesMap: ParsedFacilities = {};
          
          // Check if booking page has facilities data
          if (bookingPage.facilities) {
            let bookingPageFacilityIds: number[] = [];
            
            // Handle different formats of bookingPage.facilities
            if (Array.isArray(bookingPage.facilities)) {
              bookingPageFacilityIds = bookingPage.facilities.map(id => 
                typeof id === 'string' ? parseInt(id, 10) : id
              );
            } else if (typeof bookingPage.facilities === 'string') {
              try {
                const parsed = JSON.parse(bookingPage.facilities);
                if (Array.isArray(parsed)) {
                  bookingPageFacilityIds = parsed.map(id => 
                    typeof id === 'string' ? parseInt(id, 10) : id
                  );
                }
              } catch (e) {
                console.error("Error parsing facilities JSON string:", e);
                bookingPageFacilityIds = [];
              }
            }
            
            console.log("Booking page facility IDs:", bookingPageFacilityIds);
            
            // Filter facilities to only those specified in the booking page
            const filteredFacilities = facilities.filter(facility => 
              bookingPageFacilityIds.includes(facility.id)
            );
            
            // Add filtered facilities to the map
            filteredFacilities.forEach(facility => {
              facilitiesMap[facility.id] = {
                facility,
                excludedAppointmentTypes: []
              };
            });
            
            console.log("Using filtered facilities for booking page:", Object.keys(facilitiesMap).length);
          } else {
            console.warn("No facilities data found in booking page, using tenant-filtered facilities");
            
            // If no facilities specified, use all tenant-filtered facilities
            facilities.forEach(facility => {
              facilitiesMap[facility.id] = {
                facility,
                excludedAppointmentTypes: []
              };
            });
          }
          
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
      // Reset all forms to default values
      console.log("Resetting all forms based on URL query parameter");
      
      // Reset step 1
      initialSelectionForm.reset({
        location: "",
        appointmentType: "",
        pickupOrDropoff: "dropoff",
        bolUploaded: false,
      });
      
      // Reset step 2
      companyInfoForm.reset({
        customerName: "",
        contactName: "",
        contactEmail: "",
        contactPhone: "",
      });
      
      // Reset step 3
      appointmentDetailsForm.reset({
        appointmentDate: "",
        appointmentTime: "",
        carrierName: "",
        carrierId: undefined, // Clear the carrier ID
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
      });
      
      // Reset the state
      setFormData({});
      setStep(1);
      setBolFile(null);
      setBolPreviewText(null);
      setSelectedLocation(null);
      
      // Clean up the URL by removing the reset parameter
      window.history.replaceState({}, document.title, `/booking/${slug}`);
      
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
      bolUploaded: false,
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
      carrierId: undefined, // Add carrierId field with default undefined
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
      // Only reset the appointment type if we have a new valid location
      if (watchLocation) {
        initialSelectionForm.setValue("appointmentType", "");
      }
    }
  }, [watchLocation, selectedLocation, initialSelectionForm.setValue]);

  // Handle BOL file upload
  const handleFileUpload = (file: File) => {
    if (file) {
      // Make sure we set the file reference immediately for UI feedback
      setBolFile(file);
      setBolProcessing(true);
      
      // Show the file upload in progress
      initialSelectionForm.setValue("bolUploaded", true);
      
      // Simple reader to show that we captured the file
      const reader = new FileReader();
      
      reader.onload = function() {
        try {
          // Create a preview text for the user to confirm file was uploaded
          const previewText = `File uploaded: ${file.name}
          Size: ${(file.size / 1024).toFixed(2)} KB
          Type: ${file.type}
          
          Your file has been uploaded and will be processed with your booking.`;
          
          setBolPreviewText(previewText);
          setBolProcessing(false);
          
          toast({
            title: "File Uploaded",
            description: "Your BOL has been uploaded successfully.",
          });
          
          // When auto-selecting the first facility for convenience
          if (Object.keys(parsedFacilities).length > 0 && !initialSelectionForm.getValues("location")) {
            const firstFacilityId = Object.keys(parsedFacilities)[0];
            initialSelectionForm.setValue("location", firstFacilityId);
          }
          
        } catch (err) {
          console.error("Error processing uploaded file:", err);
          setBolProcessing(false);
          toast({
            title: "Processing Error",
            description: "There was an error processing your uploaded file.",
            variant: "destructive"
          });
        }
      };
      
      reader.readAsText(file);
    }
  };
  
  // Handler for Step 1 form submission
  const handleInitialSelectionSubmit = (data: InitialSelectionFormValues) => {
    console.log("Step 1 form submitted:", data);
    setFormData({ ...formData, ...data });
    setStep(2);
  };
  
  // Handler for Step 2 form submission
  const handleCompanyInfoSubmit = (data: CompanyInfoFormValues) => {
    console.log("Step 2 form submitted:", data);
    setFormData({ ...formData, ...data });
    setStep(3);
  };
  
  // Helper function to fetch available time slots for a given date
  const fetchAvailableTimeSlots = async (date: Date, facilityId: number, appointmentTypeId: number) => {
    setIsLoadingAvailability(true);
    
    try {
      const formattedDate = format(date, "yyyy-MM-dd");
      const response = await apiRequest('GET', `/api/facilities/${facilityId}/availability?date=${formattedDate}&appointmentTypeId=${appointmentTypeId}`);
      const data = await response.json();
      
      if (data.availableTimes) {
        console.log("Available times:", data.availableTimes);
        setAvailableTimes(data.availableTimes);
      } else {
        setAvailableTimes([]);
        toast({
          title: "No Available Times",
          description: "There are no available time slots for the selected date.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Error fetching available times:", error);
      setAvailableTimes([]);
      toast({
        title: "Error",
        description: "Could not fetch available time slots. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoadingAvailability(false);
    }
  };
  
  // Effect to update appointment date when calendar selection changes
  useEffect(() => {
    if (selectedDate) {
      appointmentDetailsForm.setValue("appointmentDate", format(selectedDate, "yyyy-MM-dd"));
      
      // Fetch available times if we have a location and appointment type
      const locationId = Number(initialSelectionForm.getValues("location"));
      const appointmentTypeId = Number(initialSelectionForm.getValues("appointmentType"));
      
      if (locationId && appointmentTypeId) {
        fetchAvailableTimeSlots(selectedDate, locationId, appointmentTypeId);
      }
    }
  }, [selectedDate, initialSelectionForm, appointmentDetailsForm]);
  
  // Handler for Step 3 form submission (final step)
  const handleAppointmentDetailsSubmit = async (data: AppointmentDetailsFormValues) => {
    console.log("Step 3 form submitted:", data);
    
    // Combine all form data
    const completeForm = {
      ...formData,
      ...data,
      facilityId: Number(initialSelectionForm.getValues("location")),
      appointmentTypeId: Number(initialSelectionForm.getValues("appointmentType")),
      bolFile: bolFile,
    };
    
    console.log("Complete form data:", completeForm);
    
    try {
      // Show loading toast
      toast({
        title: "Processing",
        description: "Submitting your appointment...",
      });
      
      // Create FormData object for file upload
      const formDataObj = new FormData();
      
      // Add all form fields to FormData
      Object.entries(completeForm).forEach(([key, value]) => {
        if (key === 'bolFile' && value instanceof File) {
          formDataObj.append('bolFile', value);
        } else if (value !== undefined && value !== null) {
          formDataObj.append(key, String(value));
        }
      });
      
      // Add the booking page slug
      formDataObj.append('bookingPageSlug', slug);
      
      // Make API request to book appointment
      const response = await fetch('/api/booking-pages/book-appointment', {
        method: 'POST',
        body: formDataObj,
      });
      
      if (!response.ok) {
        let errorMsg = "Failed to book appointment";
        try {
          const errorData = await response.json();
          errorMsg = errorData.message || errorMsg;
        } catch (e) {
          console.error("Error parsing API error response:", e);
        }
        throw new Error(errorMsg);
      }
      
      const result = await response.json();
      console.log("Appointment booked successfully:", result);
      
      // Show success toast
      toast({
        title: "Success!",
        description: "Your appointment has been booked successfully.",
      });
      
      // Redirect to confirmation page
      window.location.href = `/booking/${slug}/confirmation?appointmentId=${result.id}`;
      
    } catch (error) {
      console.error("Error submitting appointment:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to book appointment. Please try again.",
        variant: "destructive",
      });
    }
  };
  
  // Function to get the title of the current step
  const getStepTitle = () => {
    switch (step) {
      case 1:
        return "Select Location & Appointment Type";
      case 2:
        return "Company Information";
      case 3:
        return "Appointment Details";
      default:
        return "Book Appointment";
    }
  };
  
  // Handle going back to the previous step
  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };
  
  // If loading, show a loading spinner
  if (isLoadingBookingPage || isLoadingFacilities || isLoadingAppointmentTypes) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="mt-4 text-lg">Loading booking page...</p>
      </div>
    );
  }
  
  // If booking page not found or not active, show error
  if (!bookingPage || !bookingPage.isActive) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4">
        <h1 className="text-2xl font-bold mb-4">Booking Page Not Available</h1>
        <p className="text-muted-foreground text-center mb-6">
          The booking page you're looking for is either not available or has been deactivated.
        </p>
        <Button asChild>
          <Link href="/">Return to Home</Link>
        </Button>
      </div>
    );
  }
  
  // Custom styles based on booking page settings
  const primaryColor = bookingPage.primaryColor || "#22c55e";
  const styleVariables = {
    "--primary-color": primaryColor,
  } as React.CSSProperties;
  
  // Get the selected appointment type name
  const selectedAppointmentTypeId = initialSelectionForm.watch("appointmentType");
  const selectedAppointmentType = appointmentTypes.find(type => type.id.toString() === selectedAppointmentTypeId);
  
  // Get the selected facility name
  const selectedFacilityId = initialSelectionForm.watch("location");
  const selectedFacility = facilities.find(facility => facility.id.toString() === selectedFacilityId);
  
  return (
    <div className="min-h-screen bg-gray-50" style={styleVariables}>
      {/* Header with logo */}
      <header className="bg-white shadow-sm border-b py-4">
        <div className="container max-w-7xl mx-auto px-4 flex items-center justify-between">
          <div className="flex items-center">
            {bookingPage.useOrganizationLogo ? (
              <img 
                src="/api/organization/logo" 
                alt="Organization Logo"
                className="h-10 w-auto object-contain mr-3"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = '/placeholder-logo.png';
                }}
              />
            ) : bookingPage.customLogo ? (
              <img 
                src={bookingPage.customLogo} 
                alt="Custom Logo"
                className="h-10 w-auto object-contain mr-3"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = '/placeholder-logo.png';
                }}
              />
            ) : (
              <h1 className="text-2xl font-bold">{bookingPage.name}</h1>
            )}
          </div>
          
          <div className="text-sm text-muted-foreground">
            {bookingPage.title}
          </div>
        </div>
      </header>
      
      <main className="container max-w-4xl mx-auto py-8 px-4">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold">{bookingPage.title}</h1>
          {bookingPage.description && (
            <p className="mt-2 text-muted-foreground max-w-2xl mx-auto">{bookingPage.description}</p>
          )}
        </div>
        
        {/* Progress indication */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-2">
            <div className="flex-1 flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 1 ? 'bg-primary text-white' : 'bg-gray-200 text-gray-500'}`}>
                1
              </div>
              <div className={`h-1 flex-1 mx-2 ${step > 1 ? 'bg-primary' : 'bg-gray-200'}`}></div>
            </div>
            <div className="flex-1 flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 2 ? 'bg-primary text-white' : 'bg-gray-200 text-gray-500'}`}>
                2
              </div>
              <div className={`h-1 flex-1 mx-2 ${step > 2 ? 'bg-primary' : 'bg-gray-200'}`}></div>
            </div>
            <div className="flex-1 flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 3 ? 'bg-primary text-white' : 'bg-gray-200 text-gray-500'}`}>
                3
              </div>
            </div>
          </div>
          <div className="flex justify-between text-sm">
            <div className="w-1/3 text-center">Location & Type</div>
            <div className="w-1/3 text-center">Company Info</div>
            <div className="w-1/3 text-center">Appointment Details</div>
          </div>
        </div>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>{getStepTitle()}</CardTitle>
            <CardDescription>
              {step === 1 && "Select a facility location and appointment type"}
              {step === 2 && "Provide your company and contact information"}
              {step === 3 && "Complete your appointment details"}
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            {/* Step 1: Location & Appointment Type Selection */}
            {step === 1 && (
              <Form {...initialSelectionForm}>
                <form onSubmit={initialSelectionForm.handleSubmit(handleInitialSelectionSubmit)} className="space-y-6">
                  <div className="space-y-4">
                    <FormField
                      control={initialSelectionForm.control}
                      name="location"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Location</FormLabel>
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
                              {Object.values(parsedFacilities).map(({ facility }) => (
                                <SelectItem key={facility.id} value={facility.id.toString()}>
                                  {facility.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            Choose the facility location for your appointment
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={initialSelectionForm.control}
                      name="appointmentType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Appointment Type</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                            disabled={!selectedLocation}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder={selectedLocation ? "Select appointment type" : "Select a location first"} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {selectedLocation && appointmentTypes
                                .filter(type => type.facilityId === Number(selectedLocation))
                                .map(type => (
                                  <SelectItem key={type.id} value={type.id.toString()}>
                                    {type.name} ({type.duration} min)
                                  </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            Select the type of appointment you need
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={initialSelectionForm.control}
                      name="pickupOrDropoff"
                      render={({ field }) => (
                        <FormItem className="space-y-3">
                          <FormLabel>Appointment Direction</FormLabel>
                          <FormControl>
                            <RadioGroup
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                              className="flex space-x-4"
                            >
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="dropoff" id="dropoff" />
                                <label htmlFor="dropoff" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                  Dropoff
                                </label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="pickup" id="pickup" />
                                <label htmlFor="pickup" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                  Pickup
                                </label>
                              </div>
                            </RadioGroup>
                          </FormControl>
                          <FormDescription>
                            Specify whether this is a dropoff or pickup appointment
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <div className="space-y-2">
                      <FormLabel>Upload BOL (Optional)</FormLabel>
                      <BolUpload onFileUpload={handleFileUpload} />
                      <FormDescription>
                        Upload your Bill of Lading (BOL) document to expedite the check-in process
                      </FormDescription>
                      
                      {bolProcessing && (
                        <div className="mt-2 flex items-center space-x-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span className="text-sm">Processing uploaded file...</span>
                        </div>
                      )}
                      
                      {bolPreviewText && (
                        <div className="mt-2 p-3 bg-gray-50 border rounded-md text-sm whitespace-pre-line">
                          {bolPreviewText}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex justify-end">
                    <Button type="submit">
                      Continue
                      <ChevronRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </form>
              </Form>
            )}
            
            {/* Step 2: Company Information */}
            {step === 2 && (
              <Form {...companyInfoForm}>
                <form onSubmit={companyInfoForm.handleSubmit(handleCompanyInfoSubmit)} className="space-y-6">
                  <div className="space-y-4">
                    <FormField
                      control={companyInfoForm.control}
                      name="customerName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Company Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter your company name" {...field} />
                          </FormControl>
                          <FormDescription>
                            The legal name of your business
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={companyInfoForm.control}
                      name="contactName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Contact Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter contact person's name" {...field} />
                          </FormControl>
                          <FormDescription>
                            Name of the person responsible for this appointment
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={companyInfoForm.control}
                        name="contactEmail"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email Address</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter email address" {...field} />
                            </FormControl>
                            <FormDescription>
                              Used for booking confirmations and updates
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={companyInfoForm.control}
                        name="contactPhone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Phone Number</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter phone number" {...field} />
                            </FormControl>
                            <FormDescription>
                              Used for urgent communications
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                  
                  <div className="flex justify-between">
                    <Button type="button" variant="outline" onClick={handleBack}>
                      <ChevronLeft className="mr-2 h-4 w-4" />
                      Back
                    </Button>
                    <Button type="submit">
                      Continue
                      <ChevronRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </form>
              </Form>
            )}
            
            {/* Step 3: Appointment Details */}
            {step === 3 && (
              <Form {...appointmentDetailsForm}>
                <form onSubmit={appointmentDetailsForm.handleSubmit(handleAppointmentDetailsSubmit)} className="space-y-6">
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Appointment Date */}
                      <FormField
                        control={appointmentDetailsForm.control}
                        name="appointmentDate"
                        render={({ field }) => (
                          <FormItem className="flex flex-col">
                            <FormLabel>Appointment Date</FormLabel>
                            <Popover>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button
                                    variant={"outline"}
                                    className={cn(
                                      "pl-3 text-left font-normal",
                                      !field.value && "text-muted-foreground"
                                    )}
                                  >
                                    {field.value ? (
                                      format(new Date(field.value), "MMMM d, yyyy")
                                    ) : (
                                      <span>Select a date</span>
                                    )}
                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                  </Button>
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                  mode="single"
                                  selected={selectedDate}
                                  onSelect={setSelectedDate}
                                  initialFocus
                                  disabled={(date) => {
                                    const today = new Date();
                                    today.setHours(0, 0, 0, 0);
                                    // Disable past dates and weekends
                                    return (
                                      date < today || 
                                      date.getDay() === 0 || 
                                      date.getDay() === 6
                                    );
                                  }}
                                />
                              </PopoverContent>
                            </Popover>
                            <FormDescription>
                              Select your preferred appointment date
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      {/* Appointment Time */}
                      <FormField
                        control={appointmentDetailsForm.control}
                        name="appointmentTime"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Appointment Time</FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                              disabled={!selectedDate || isLoadingAvailability}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder={
                                    isLoadingAvailability 
                                      ? "Loading available times..." 
                                      : selectedDate 
                                        ? "Select a time" 
                                        : "Select a date first"
                                  } />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {isLoadingAvailability ? (
                                  <div className="flex items-center justify-center py-2">
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                    <span>Loading...</span>
                                  </div>
                                ) : availableTimes.length > 0 ? (
                                  availableTimes.map(time => (
                                    <SelectItem key={time} value={time}>
                                      {time}
                                    </SelectItem>
                                  ))
                                ) : (
                                  <div className="p-2 text-sm text-center text-muted-foreground">
                                    No available times for selected date
                                  </div>
                                )}
                              </SelectContent>
                            </Select>
                            <FormDescription>
                              Available time slots for the selected date
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    <Separator />
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={appointmentDetailsForm.control}
                        name="carrierName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Carrier Name</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter carrier name" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={appointmentDetailsForm.control}
                        name="mcNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>MC Number (Optional)</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter MC number" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={appointmentDetailsForm.control}
                        name="truckNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Truck Number</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter truck number" {...field} />
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
                            <FormLabel>Trailer Number (Optional)</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter trailer number" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={appointmentDetailsForm.control}
                        name="driverName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Driver Name</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter driver name" {...field} />
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
                            <FormLabel>Driver Phone</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter driver phone number" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    <Separator />
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={appointmentDetailsForm.control}
                        name="poNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>PO Number (Optional)</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter PO number" {...field} />
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
                            <FormLabel>BOL Number (Optional)</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter BOL number" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={appointmentDetailsForm.control}
                        name="palletCount"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Pallet Count (Optional)</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter pallet count" {...field} />
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
                            <FormLabel>Weight (Optional)</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter weight" {...field} />
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
                          <FormLabel>Additional Notes (Optional)</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="Enter any additional information or special instructions"
                              className="min-h-[100px]"
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <div className="flex justify-between">
                    <Button type="button" variant="outline" onClick={handleBack}>
                      <ChevronLeft className="mr-2 h-4 w-4" />
                      Back
                    </Button>
                    <Button type="submit">
                      Book Appointment
                    </Button>
                  </div>
                </form>
              </Form>
            )}
          </CardContent>
        </Card>
        
        {/* Booking Summary */}
        {step > 1 && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Booking Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {selectedFacility && (
                  <div className="flex items-start space-x-3">
                    <MapPin className="h-5 w-5 mt-0.5 text-primary" />
                    <div>
                      <h4 className="font-medium">{selectedFacility.name}</h4>
                      <p className="text-sm text-muted-foreground">
                        {selectedFacility.address1}, {selectedFacility.city}, {selectedFacility.state} {selectedFacility.zipCode}
                      </p>
                    </div>
                  </div>
                )}
                
                {selectedAppointmentType && (
                  <div className="flex items-start space-x-3">
                    <Calendar className="h-5 w-5 mt-0.5 text-primary" />
                    <div>
                      <h4 className="font-medium">{selectedAppointmentType.name}</h4>
                      <div className="flex items-center mt-1">
                        <div 
                          className="w-3 h-3 rounded-full mr-2" 
                          style={{ backgroundColor: selectedAppointmentType.color }}
                        />
                        <span className="text-sm text-muted-foreground">
                          {selectedAppointmentType.duration} minutes
                        </span>
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="flex items-start space-x-3">
                  <Clock className="h-5 w-5 mt-0.5 text-primary" />
                  <div>
                    <h4 className="font-medium">
                      {initialSelectionForm.watch("pickupOrDropoff") === "pickup" ? "Pickup" : "Dropoff"}
                    </h4>
                  </div>
                </div>
                
                {step > 2 && formData.customerName && (
                  <div>
                    <h4 className="font-medium mb-2">Company Information</h4>
                    <p className="text-sm">{formData.customerName}</p>
                    <p className="text-sm text-muted-foreground">
                      Contact: {formData.contactName} • {formData.contactEmail} • {formData.contactPhone}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </main>
      
      <footer className="bg-gray-50 border-t py-8">
        <div className="container max-w-7xl mx-auto px-4">
          <div className="text-center text-sm text-muted-foreground">
            <p>© {new Date().getFullYear()} {bookingPage.name}</p>
            <p className="mt-1">Powered by Dock Optimizer</p>
          </div>
        </div>
      </footer>
    </div>
  );
}