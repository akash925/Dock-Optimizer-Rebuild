import { useState } from "react";
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
import { Loader2, TruckIcon, ArrowRight, ArrowLeft } from "lucide-react";

// Step 1: Appointment Type Selection
const appointmentTypeSchema = z.object({
  appointmentType: z.string().min(1, "Please select an appointment type"),
  pickupOrDropoff: z.string().min(1, "Please select pickup or dropoff"),
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
  location: z.string().min(1, "Please select a location"),
  mcNumber: z.string().optional(),
  truckNumber: z.string().min(1, "Truck number is required"),
  trailerNumber: z.string().optional(),
  driverName: z.string().min(1, "Driver name is required"),
  driverPhone: z.string().min(10, "Please enter a valid phone number"),
  additionalNotes: z.string().optional(),
});

// Combine all schemas for the final submission
const bookingSchema = appointmentTypeSchema.merge(companyInfoSchema).merge(appointmentDetailsSchema);

type AppointmentTypeFormValues = z.infer<typeof appointmentTypeSchema>;
type CompanyInfoFormValues = z.infer<typeof companyInfoSchema>;
type AppointmentDetailsFormValues = z.infer<typeof appointmentDetailsSchema>;
type BookingFormValues = z.infer<typeof bookingSchema>;

export default function ExternalBooking() {
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<Partial<BookingFormValues>>({});
  const [, navigate] = useLocation();
  const { toast } = useToast();
  
  // Step 1 Form
  const appointmentTypeForm = useForm<AppointmentTypeFormValues>({
    resolver: zodResolver(appointmentTypeSchema),
    defaultValues: {
      appointmentType: "",
      pickupOrDropoff: "",
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
      location: "",
      mcNumber: "",
      truckNumber: "",
      trailerNumber: "",
      driverName: "",
      driverPhone: "",
      additionalNotes: "",
    },
  });

  // Update form values when moving between steps
  const updateFormData = (data: Partial<BookingFormValues>) => {
    setFormData(prev => ({...prev, ...data}));
  };

  // Handle Step 1 Submission
  const onAppointmentTypeSubmit = (data: AppointmentTypeFormValues) => {
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
      
      // Navigate to confirmation page or show confirmation component
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
          <Form {...appointmentTypeForm}>
            <form onSubmit={appointmentTypeForm.handleSubmit(onAppointmentTypeSubmit)} className="space-y-6">
              <FormField
                control={appointmentTypeForm.control}
                name="appointmentType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dock Appointment Type*</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select Dock Appointment Type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="shipping">Shipping</SelectItem>
                        <SelectItem value="receiving">Receiving</SelectItem>
                        <SelectItem value="returns">Returns</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={appointmentTypeForm.control}
                name="pickupOrDropoff"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pickup or Dropoff*</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select Pickup or Dropoff" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="pickup">Pickup</SelectItem>
                        <SelectItem value="dropoff">Dropoff</SelectItem>
                        <SelectItem value="both">Both</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <Button type="submit" className="w-full">
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
              
              <div className="flex justify-between">
                <Button type="button" variant="outline" onClick={goBack}>
                  <ArrowLeft className="mr-2 h-4 w-4" /> Back
                </Button>
                <Button type="submit">
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
              
              <FormField
                control={appointmentDetailsForm.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location*</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select Location" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="450-airtech">450 Airtech Pkwy Plainfield IN 46168</SelectItem>
                        <SelectItem value="8370-camby">8370 E Camby Rd Plainfield IN 46168</SelectItem>
                        <SelectItem value="4001-minnesota">4001 W Minnesota Street Indianapolis, IN 46241</SelectItem>
                        <SelectItem value="4334-plainfield">4334 Plainfield Road Plainfield, IN 46231</SelectItem>
                        <SelectItem value="9915-lacy">9915 Lacy Knot Dr, Brownsburg, IN 46112</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={appointmentDetailsForm.control}
                name="mcNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>MC Number</FormLabel>
                    <FormDescription>Motor Carrier number (required for all shipments as of August 1st, 2023)</FormDescription>
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
                        <Input placeholder="Driver Phone" {...field} />
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
                        className="resize-none" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="flex justify-between">
                <Button type="button" variant="outline" onClick={goBack}>
                  <ArrowLeft className="mr-2 h-4 w-4" /> Back
                </Button>
                <Button type="submit" disabled={isSubmitting}>
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
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-green-100 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center mb-4">
            <TruckIcon className="h-10 w-10 text-primary mr-3" />
            <h1 className="text-3xl font-bold text-gray-800">Hanzo Logistics Dock Appointment Scheduler</h1>
          </div>
          <p className="text-center text-gray-600 max-w-2xl">
            Please use this form to schedule a dock appointment with Hanzo Logistics. 
            For support using this page, please contact our customer service team.
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
              {step === 1 && "Select Appointment Type"}
              {step === 2 && "Company Information"}
              {step === 3 && "Appointment Details"}
            </CardTitle>
            <CardDescription>
              {step === 1 && "Please select the type of appointment you need"}
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
        
        <div className="mt-8 text-center text-gray-600">
          <p>Effective August 1st, 2023, MC Numbers are required for all incoming and outgoing shipments.</p>
          <p className="mt-2">This is to protect the security of our customer's shipments and reduce the risk of fraud.</p>
        </div>

        <div className="mt-8">
          <h2 className="text-xl font-bold mb-4">HANZO LOGISTICS INC.</h2>
          <p className="mb-2">Select from the following locations:</p>
          <ul className="space-y-1 text-gray-700">
            <li>450 Airtech Pkwy Plainfield IN 46168</li>
            <li>8370 E Camby Rd Plainfield IN 46168</li>
            <li>4001 W Minnesota Street Indianapolis, IN 46241 (HANZO Cold-Chain)</li>
            <li>4334 Plainfield Road Plainfield, IN 46231</li>
            <li>9915 Lacy Knot Dr, Brownsburg, IN 46112</li>
          </ul>
        </div>
      </div>
    </div>
  );
}