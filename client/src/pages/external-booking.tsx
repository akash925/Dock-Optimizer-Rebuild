import { useState, ChangeEvent, useEffect, useMemo } from "react";
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
import { Loader2, TruckIcon, ArrowRight, ArrowLeft, Upload, FileText, AlertCircle, Check, ChevronsUpDown } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { format, addDays, isAfter, isBefore, parse } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { useQuery } from "@tanstack/react-query";
import { Facility, BookingPage, AppointmentType } from "@shared/schema";
import hanzoLogo from "@/assets/hanzo_logo.jpeg";
import dockOptimizerLogo from "@/assets/dock_optimizer_logo.jpg";

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
  mcNumber: z.string().min(1, "MC Number is required"),
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
  
  // Fetch booking page data
  const { data: bookingPage, isLoading: isLoadingBookingPage, error: bookingPageError } = useQuery<BookingPage>({
    queryKey: [`/api/booking-pages/slug/${slug}`],
    enabled: !!slug,
    retry: false
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
                    <FormItem>
                      <FormLabel>Appointment Date*</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
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
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a time slot" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="08:00">8:00 AM</SelectItem>
                          <SelectItem value="08:30">8:30 AM</SelectItem>
                          <SelectItem value="09:00">9:00 AM</SelectItem>
                          <SelectItem value="09:30">9:30 AM</SelectItem>
                          <SelectItem value="10:00">10:00 AM</SelectItem>
                          <SelectItem value="10:30">10:30 AM</SelectItem>
                          <SelectItem value="11:00">11:00 AM</SelectItem>
                          <SelectItem value="11:30">11:30 AM</SelectItem>
                          <SelectItem value="12:00">12:00 PM</SelectItem>
                          <SelectItem value="12:30">12:30 PM</SelectItem>
                          <SelectItem value="13:00">1:00 PM</SelectItem>
                          <SelectItem value="13:30">1:30 PM</SelectItem>
                          <SelectItem value="14:00">2:00 PM</SelectItem>
                          <SelectItem value="14:30">2:30 PM</SelectItem>
                          <SelectItem value="15:00">3:00 PM</SelectItem>
                          <SelectItem value="15:30">3:30 PM</SelectItem>
                          <SelectItem value="16:00">4:00 PM</SelectItem>
                          <SelectItem value="16:30">4:30 PM</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="bg-yellow-50 p-3 rounded-md border border-yellow-200">
                <p className="text-sm text-yellow-800">
                  <strong>Important:</strong> MC Numbers are required for all shipments as of August 1st, 2023.
                </p>
              </div>
              
              <FormField
                control={appointmentDetailsForm.control}
                name="mcNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>MC Number*</FormLabel>
                    <FormDescription>Motor Carrier number (required for all shipments)</FormDescription>
                    <FormControl>
                      <Input placeholder="MC Number" {...field} />
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
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-green-100 py-6 md:py-12 px-2 md:px-4">
      <div className="max-w-4xl mx-auto w-full">
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
        <div className="flex flex-col items-center">
          {bookingPage && bookingPage.welcomeMessage ? (
            <div className="bg-blue-50 p-4 rounded-md border border-blue-100 mb-4 max-w-2xl">
              <p className="text-blue-700">{bookingPage.welcomeMessage}</p>
            </div>
          ) : (
            <p className="text-center text-gray-600 max-w-2xl px-4">
              Please use this form to pick the type of Dock Appointment that you need. 
              For support using this page, <a href="#" className="text-primary underline hover:text-primary/80">please check out this video</a>.
            </p>
          )}
          <p className="text-center text-gray-700 font-medium mt-4 max-w-2xl px-4">
            Effective August 1st, 2023, MC Numbers are required for all incoming and outgoing shipments. 
            This is to protect the security of our customer's shipments and reduce the risk of fraud.
          </p>
          
          <div className="w-full max-w-3xl mt-6">
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
        </div>

        <Card className="w-full shadow-lg">
          <CardHeader>
            <CardTitle>
              {step === 1 && "Schedule Your Appointment"}
              {step === 2 && "Company Information"}
              {step === 3 && "Appointment Details"}
            </CardTitle>
            <CardDescription>
              {step === 1 && "Select your facility location and appointment type"}
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

        <div className="mt-8 p-4 bg-white rounded-lg shadow-sm">
          {bookingPage && (
            <>
              <div className="flex items-center justify-center md:justify-start mb-4">
                <img 
                  src={bookingPage.customLogo ? `data:image/jpeg;base64,${bookingPage.customLogo}` : hanzoLogo} 
                  alt={bookingPage.title} 
                  className="h-10 mr-2" 
                />
                <h2 className="text-lg md:text-xl font-bold text-center md:text-left">
                  {bookingPage.title}
                </h2>
              </div>
              {Object.keys(parsedFacilities).length > 0 && (
                <>
                  <p className="mb-2 text-sm md:text-base">Facilities available for booking:</p>
                  <ul className="space-y-2 text-sm md:text-base text-gray-700">
                    {Object.values(parsedFacilities).map(({ facility }) => (
                      <li key={facility.id} className="p-2 bg-gray-50 rounded">
                        {facility.address1}, {facility.city}, {facility.state} {facility.pincode} 
                        {facility.company && <span className="font-medium"> ({facility.company})</span>}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </>
          )}
          <div className="mt-6 flex flex-col items-center">
            <p className="text-center text-sm text-gray-600 mb-3">
              Please arrive 15 minutes before your appointment and check in at the security desk.
            </p>
            <div className="flex items-center text-xs text-gray-500">
              <span>© 2025 Conmitto Inc. All rights reserved</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}