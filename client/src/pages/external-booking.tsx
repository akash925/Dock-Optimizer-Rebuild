import { useState, ChangeEvent } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, TruckIcon, ArrowRight, ArrowLeft, Upload, FileText } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import hanzoLogo from "@/assets/hanzo_logo.jpeg";

// Define location data
const locations = [
  { id: "4334PLAINFIELD-L", name: "4334 Plainfield Road (Hanzo Metro), Plainfield, IN 46231" },
  { id: "450AIRTECH-L", name: "450 Airtech Parkway, Plainfield, IN 46168" },
  { id: "8370CAMBY-L", name: "8370 E Camby Rd, Plainfield, IN 46168" },
  { id: "4001MINNESOTA-L", name: "4001 W Minnesota Street, Indianapolis, IN 46241 (Cold Chain)" },
  { id: "9915LACY-L", name: "9915 Lacy Knot Dr, Brownsburg, IN 46112" },
];

// Define appointment types by location - exact match from reference site
const appointmentTypesByLocation = {
  "4334PLAINFIELD-L": [
    "4334 Plainfield Road (Hanzo Metro) - MVP (1 Hour)",
    "4334 Plainfield Road (Hanzo Metro) - Palletized Load Appointment (1 Hour)"
  ],
  "450AIRTECH-L": [
    "450 Airtech Parkway - Hand-Unload Appointment (4 Hour)",
    "450 Airtech Parkway - LTL Pickup or Dropoff",
    "450 Airtech Parkway - Palletized Load Appointment (1 Hour)"
  ],
  "8370CAMBY-L": [
    "Camby Rd - Hand-Unload Appointment (4 Hour)",
    "Camby Rd - Palletized Load Appointment (1 Hour)"
  ],
  "4001MINNESOTA-L": [
    "HANZO Cold-Chain - Hand-Unload Appointment (4 Hour)",
    "HANZO Cold-Chain - Palletized Load Appointment (1 Hour)",
    "Sam Pride - Floor Loaded Container Drop (4 Hour Unloading)"
  ],
  "9915LACY-L": [
    "9915 Lacy Knot Dr (Hanzo Brownsburg) - Palletized Load Appointment (1 Hour)"
  ],
};

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
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<Partial<BookingFormValues>>({});
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [bolFile, setBolFile] = useState<File | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [bolProcessing, setBolProcessing] = useState(false);
  const [bolPreviewText, setBolPreviewText] = useState<string | null>(null);
  
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
  
  // Update available appointment types when location changes
  if (watchLocation !== selectedLocation && watchLocation) {
    setSelectedLocation(watchLocation);
    initialSelectionForm.setValue("appointmentType", "");
  }

  // Handle BOL file upload
  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      setBolFile(file);
      setBolProcessing(true);
      
      // Simulate OCR processing
      setTimeout(() => {
        const previewText = `Bill of Lading #BOL-${Math.floor(Math.random() * 10000)}
Location: ${locations[Math.floor(Math.random() * locations.length)].name}
Type: ${Math.random() > 0.5 ? 'Pickup' : 'Dropoff'}`;
        
        setBolPreviewText(previewText);
        setBolProcessing(false);
        
        // Pre-select some fields based on "OCR"
        const randomLocationId = locations[Math.floor(Math.random() * locations.length)].id;
        initialSelectionForm.setValue("location", randomLocationId);
        
        // Set appointment type based on selected location
        const appointmentTypes = appointmentTypesByLocation[randomLocationId as keyof typeof appointmentTypesByLocation];
        if (appointmentTypes && appointmentTypes.length > 0) {
          initialSelectionForm.setValue("appointmentType", appointmentTypes[0]);
        }
        
        initialSelectionForm.setValue("bolUploaded", true);
        
        // Also set the bol number for step 3
        appointmentDetailsForm.setValue("bolNumber", `BOL-${Math.floor(Math.random() * 10000)}`);
        
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
                            {locations.map(location => (
                              <SelectItem key={location.id} value={location.id}>{location.name}</SelectItem>
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
                              {watchLocation && appointmentTypesByLocation[watchLocation as keyof typeof appointmentTypesByLocation]?.map(type => (
                                <SelectItem key={type} value={type}>
                                  {type}
                                </SelectItem>
                              ))}
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
                              {locations.find(l => l.id === initialSelectionForm.watch("location"))?.name || "Not detected"}
                            </p>
                          </div>
                          
                          <div>
                            <span className="font-medium">Appointment Type:</span>
                            <p className="text-gray-600">
                              {initialSelectionForm.watch("appointmentType") || "Not detected"}
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
                                {locations.map(location => (
                                  <SelectItem key={location.id} value={location.id}>{location.name}</SelectItem>
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
                                  {watchLocation && appointmentTypesByLocation[watchLocation as keyof typeof appointmentTypesByLocation]?.map(type => (
                                    <SelectItem key={type} value={type}>{type}</SelectItem>
                                  ))}
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
                      <FormControl>
                        <Input type="time" {...field} />
                      </FormControl>
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
            <img 
              src={hanzoLogo} 
              alt="Hanzo Logistics" 
              className="h-16" 
            />
          </div>
        </div>
        <div className="flex flex-col items-center">
          <p className="text-center text-gray-600 max-w-2xl px-4">
            Please use this form to pick the type of Dock Appointment that you need at Hanzo Logistics. 
            For support using this page, <a href="#" className="text-primary underline hover:text-primary/80">please check out this video</a>.
          </p>
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
          <div className="flex items-center justify-center md:justify-start mb-4">
            <img 
              src={hanzoLogo} 
              alt="Hanzo Logistics" 
              className="h-10 mr-2" 
            />
            <h2 className="text-lg md:text-xl font-bold text-center md:text-left">HANZO LOGISTICS INC.</h2>
          </div>
          <p className="mb-2 text-sm md:text-base">Select from the following locations:</p>
          <ul className="space-y-2 text-sm md:text-base text-gray-700">
            <li className="p-2 bg-gray-50 rounded">4334 Plainfield Road, Plainfield, IN 46231 <span className="font-medium">(Hanzo Metro)</span></li>
            <li className="p-2 bg-gray-50 rounded">450 Airtech Pkwy, Plainfield, IN 46168</li>
            <li className="p-2 bg-gray-50 rounded">8370 E Camby Rd, Plainfield, IN 46168</li>
            <li className="p-2 bg-gray-50 rounded">9915 Lacy Knot Dr, Brownsburg, IN 46112</li>
            <li className="p-2 bg-gray-50 rounded">4001 W Minnesota St, Indianapolis, IN 46241 <span className="font-medium">(Cold Chain)</span></li>
          </ul>
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