import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { BookingWizardProvider, useBookingWizard } from '@/contexts/BookingWizardContext';
import { BookingThemeProvider } from '@/hooks/use-booking-theme';
import { Loader2, CheckCircle, AlertCircle, Upload, Mail, XCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, addDays, startOfDay, isAfter } from 'date-fns';
import { getUserTimeZone } from '@shared/timezone-utils';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { StandardQuestionsFormFields } from '@/components/shared/standard-questions-form-fields';
import { SimpleTimeSlots } from '@/components/booking/simple-time-slots';
import { BOLUploadWizard } from '@/components/booking/bol-upload-wizard';
import dockOptimizerLogo from '@/assets/dock_optimizer_logo.jpg';

// Organization Logo Component
function OrganizationLogo({ bookingPage, className }: { bookingPage: any; className: string }) {
  const { data: logoData, isLoading } = useQuery({
    queryKey: [`/api/booking-pages/logo/${bookingPage.tenantId}`],
    queryFn: async () => {
      const res = await fetch(`/api/booking-pages/logo/${bookingPage.tenantId}`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!bookingPage.tenantId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  if (isLoading) {
    return (
      <div className={className}>
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (logoData?.logo) {
    return (
      <div className={className}>
        <img 
          src={logoData.logo} 
          alt={`${bookingPage.name} logo`}
          className="h-full w-full object-contain rounded-lg"
        />
      </div>
    );
  }

  // Fallback to organization initial
  return (
    <div className={className}>
      <div className="bg-primary text-primary-foreground rounded-lg w-full h-full flex items-center justify-center">
        <span className="font-bold text-xl">
          {bookingPage.name?.charAt(0) || 'O'}
        </span>
      </div>
    </div>
  );
}

interface BookingData {
  facilityId?: number;
  appointmentTypeId?: number;
  date?: string;
  time?: string;
  timezone?: string;
}

interface BookingDetails {
  confirmationCode?: string;
  emailSent?: boolean;
  startTime?: string;
  endTime?: string;
  facilityName?: string;
  appointmentTypeName?: string;
  [key: string]: any;
}

// Main external booking component
export default function ExternalBookingConsolidated({ slug }: { slug: string }) {
  const { toast } = useToast();
  
  // Fetch booking page data
  const { data: bookingPage, isLoading, error } = useQuery({
    queryKey: [`/api/booking-pages/slug/${slug}`],
    queryFn: async () => {
      const res = await fetch(`/api/booking-pages/slug/${slug}`);
      if (!res.ok) throw new Error('Failed to fetch booking page');
      
      const data = await res.json();
      
      // Process appointment types to add showRemainingSlots property
      if (data?.appointmentTypes && Array.isArray(data.appointmentTypes)) {
        data.appointmentTypes = data.appointmentTypes.map((type: any) => ({
          ...type,
          showRemainingSlots: type.showRemainingSlots || false
        }));
      }
      
      return data;
    }
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="animate-spin h-8 w-8" />
      </div>
    );
  }

  if (error || !bookingPage) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-red-500 text-center">
          <AlertCircle className="h-8 w-8 mx-auto mb-2" />
          <p>Invalid booking link. Please check your URL.</p>
        </div>
      </div>
    );
  }

  return (
    <BookingThemeProvider slug={slug}>
      <div className="min-h-screen bg-gradient-to-b from-primary/20 to-background">
        <div className="container mx-auto py-8 px-4">
          <div className="bg-white rounded-lg shadow-lg p-6 mx-auto max-w-4xl">
            <BookingWizardContent bookingPage={bookingPage} slug={slug} />
          </div>
        </div>
      </div>
    </BookingThemeProvider>
  );
}

// Main booking wizard component
function BookingWizardContent({ bookingPage, slug }: { bookingPage: any, slug: string }) {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [bookingData, setBookingData] = useState<BookingData>({
    timezone: getUserTimeZone()
  });
  const [confirmationCode, setConfirmationCode] = useState<string | null>(null);
  const [bookingDetails, setBookingDetails] = useState<BookingDetails>({});
  const [isLoadingTimes, setIsLoadingTimes] = useState(false);
  const [availableTimes, setAvailableTimes] = useState<string[]>([]);

  // Form setup for standard questions
  const bookingFormSchema = z.object({
    customFields: z.object({
      customerName: z.string().min(1, "Customer name is required"),
      email: z.string().email("A valid email address is required"),
    }).passthrough()
  });

  const form = useForm({
    defaultValues: {
      customFields: {}
    },
    resolver: zodResolver(bookingFormSchema)
  });

  // Check for direct confirmation code in URL params
  const params = new URLSearchParams(window.location.search);
  const confirmationParam = params.get('confirmation');

  useEffect(() => {
    if (confirmationParam) {
      console.log("Direct confirmation mode with code:", confirmationParam);
      setConfirmationCode(confirmationParam);
      setStep(4);
      
      // Fetch the appointment details by confirmation code
      fetch(`/api/schedules/confirmation/${confirmationParam}`)
        .then(res => {
          if (!res.ok) throw new Error("Failed to fetch appointment details");
          return res.json();
        })
        .then(data => {
          console.log("Fetched appointment details for confirmation:", data);
          if (data && data.schedule) {
            setBookingDetails({
              confirmationCode: confirmationParam,
              id: data.schedule.id,
              scheduleId: data.schedule.id,
              facilityId: data.schedule.facilityId,
              facilityName: data.facilityName || data.facility?.name,
              facilityAddress: data.facilityAddress || data.facility?.address,
              startTime: data.schedule.startTime,
              endTime: data.schedule.endTime,
              appointmentTypeId: data.schedule.appointmentTypeId,
              appointmentTypeName: data.appointmentTypeName || data.appointmentType?.name,
              timezone: data.timezone,
              emailSent: true
            });
          }
        })
        .catch(err => {
          console.error("Error fetching confirmation details:", err);
          toast({
            title: "Error",
            description: "Could not load appointment details. Please try again.",
            variant: "destructive"
          });
        });
    }
  }, [confirmationParam, toast]);

  // Fetch standard questions based on appointment type using public API
  const { data: standardQuestions, isLoading: loadingQuestions, error: questionsError } = useQuery({
    queryKey: [`/api/booking-pages/standard-questions/appointment-type/${bookingData.appointmentTypeId}`],
    queryFn: async () => {
      if (!bookingData.appointmentTypeId) {
        console.log("[StandardQuestions] No appointment type ID, returning empty array");
        return [];
      }
      
      console.log(`[StandardQuestions] Fetching questions for appointment type ${bookingData.appointmentTypeId}`);
      const res = await fetch(`/api/booking-pages/standard-questions/appointment-type/${bookingData.appointmentTypeId}`);
      if (!res.ok) {
        console.error(`[StandardQuestions] Failed to fetch questions: ${res.status} ${res.statusText}`);
        throw new Error(`Failed to fetch questions: ${res.status} ${res.statusText}`);
      }
      
      const data = await res.json();
      console.log(`[StandardQuestions] Received data:`, data);
      if (!Array.isArray(data)) {
        console.error(`[StandardQuestions] Data is not an array:`, typeof data);
        throw new Error(`Invalid response format: expected array, got ${typeof data}`);
      }
      
      const mappedQuestions = data.map((q: any) => ({
        id: q.id,
        label: q.label || '',
        fieldKey: q.fieldKey || `field_${q.id}`,
        fieldType: q.fieldType || 'TEXT',
        required: q.required || false,
        included: q.included || false,
        orderPosition: q.orderPosition || q.order || 0,
        appointmentTypeId: q.appointmentTypeId || bookingData.appointmentTypeId,
        options: q.options || []
      }));
      
      console.log(`[StandardQuestions] Mapped ${mappedQuestions.length} questions:`, mappedQuestions);
      return mappedQuestions;
    },
    enabled: !!bookingData.appointmentTypeId,
    staleTime: 60000,
    retry: 1
  });

  // Fetch available times when date and appointment type are selected
  useEffect(() => {
    if (bookingData.date && bookingData.appointmentTypeId && bookingData.facilityId) {
      fetchAvailableTimes();
    }
  }, [bookingData.date, bookingData.appointmentTypeId, bookingData.facilityId]);

  const fetchAvailableTimes = async () => {
    if (!bookingData.date || !bookingData.appointmentTypeId || !bookingData.facilityId) return;
    
    setIsLoadingTimes(true);
    try {
      const response = await fetch(
        `/api/availability/slots?date=${bookingData.date}&appointmentTypeId=${bookingData.appointmentTypeId}&facilityId=${bookingData.facilityId}`
      );
      
      if (response.ok) {
        const data = await response.json();
        const times = data.map((slot: any) => slot.time);
        setAvailableTimes(times);
      } else {
        setAvailableTimes([]);
      }
    } catch (error) {
      console.error('Error fetching available times:', error);
      setAvailableTimes([]);
    } finally {
      setIsLoadingTimes(false);
    }
  };

  // Create booking mutation
  const bookingMutation = useMutation({
    mutationFn: async (data: any) => {
      console.log("Creating booking with data:", data);
      
      const res = await fetch(`/api/booking-pages/${slug}/book`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      let responseData;
      const contentType = res.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        responseData = await res.json();
      } else {
        responseData = { message: await res.text() };
      }
      
      if (!res.ok) {
        throw new Error(responseData.message || 'Failed to create booking');
      }
      
      return responseData;
    },
    onSuccess: (data) => {
      console.log("Booking created successfully:", data);
      
      const confirmationCode = data.appointment?.confirmationCode || 
                              data.confirmationCode ||
                              `${slug.toUpperCase()}-${Math.floor(Date.now() / 1000)}`;
      
      setConfirmationCode(confirmationCode);
      
      // Set booking details for confirmation page
      const appointment = data.appointment || {};
      
      setBookingDetails({
        confirmationCode,
        id: appointment.id,
        scheduleId: appointment.id,
        emailSent: data.emailSent || false,
        startTime: appointment.startTime,
        endTime: appointment.endTime,
        timezone: bookingData.timezone,
        facilityId: appointment.facilityId,
        facilityName: bookingPage.facilities?.find((f: any) => f.id === appointment.facilityId)?.name,
        appointmentTypeId: appointment.appointmentTypeId,
        appointmentTypeName: bookingPage.appointmentTypes?.find((t: any) => t.id === appointment.appointmentTypeId)?.name,
      });
      
      // Trigger real-time notification update
      try {
        fetch('/api/notifications/trigger', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'new_appointment',
            appointmentId: appointment.id,
            message: `New appointment scheduled: ${confirmationCode}`
          })
        }).catch(notificationError => {
          console.log('Could not trigger notification update:', notificationError);
        });
      } catch (notificationError) {
        console.log('Could not trigger notification update:', notificationError);
      }
      
      setStep(4);
    },
    onError: (error) => {
      console.error("Booking creation failed:", error);
      toast({
        title: "Booking Failed",
        description: error instanceof Error ? error.message : "An error occurred while creating your booking",
        variant: "destructive"
      });
    }
  });

  // Handle form submission
  const handleSubmitBooking = async (formData: any) => {
    console.log('=== EXTERNAL BOOKING SUBMISSION ===');
    console.log('handleSubmitBooking called with formData:', formData);
    console.log('Current bookingData:', bookingData);
    
    if (!bookingData.facilityId || !bookingData.appointmentTypeId || !bookingData.date || !bookingData.time) {
      console.error('Missing required booking data:', {
        facilityId: bookingData.facilityId,
        appointmentTypeId: bookingData.appointmentTypeId,
        date: bookingData.date,
        time: bookingData.time
      });
      toast({
        title: "Missing Information",
        description: "Please complete all required fields",
        variant: "destructive"
      });
      return;
    }

    // Create proper start and end times
    const startTime = new Date(`${bookingData.date}T${bookingData.time}`).toISOString();
    const endTime = new Date(new Date(startTime).getTime() + 60 * 60 * 1000).toISOString(); // 1 hour later

    const bookingPayload = {
      facilityId: bookingData.facilityId,
      appointmentTypeId: bookingData.appointmentTypeId,
      date: bookingData.date,
      time: bookingData.time,
      timezone: bookingData.timezone,
      pickupOrDropoff: "pickup",
      
      // Extract contact information from form data
      customerName: formData.customerName || '',
      contactName: formData.customerName || '',
      email: formData.email || '',
      phone: formData.phone || '',
      driverName: formData.driverName || formData.customerName || '',
      driverPhone: formData.driverPhone || formData.phone || '',
      driverEmail: formData.driverEmail || formData.email || '',
      
      // Additional fields
      carrierName: formData.carrierName || 'External Carrier',
      truckNumber: formData.truckNumber || '',
      trailerNumber: formData.trailerNumber || '',
      bolNumber: formData.bolNumber || '',
      mcNumber: formData.mcNumber || '',
      notes: formData.notes || '',
      
      // Custom fields for standard questions
      customFields: {
        ...formData
      }
    };

    console.log("Submitting booking with payload:", bookingPayload);
    console.log("bookingMutation.mutate about to be called");
    bookingMutation.mutate(bookingPayload);
  };

  // Render step content
  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-2">Select Service</h2>
              <p className="text-muted-foreground">
                Choose your facility and appointment type
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="facility">Facility</Label>
                <Select 
                  value={bookingData.facilityId?.toString()} 
                  onValueChange={(value) => setBookingData(prev => ({ 
                    ...prev, 
                    facilityId: parseInt(value),
                    appointmentTypeId: undefined // Reset appointment type when facility changes
                  }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a facility" />
                  </SelectTrigger>
                  <SelectContent>
                    {bookingPage.facilities?.map((facility: any) => (
                      <SelectItem key={facility.id} value={facility.id.toString()}>
                        {facility.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="appointmentType">Appointment Type</Label>
                <Select 
                  value={bookingData.appointmentTypeId?.toString()} 
                  onValueChange={(value) => setBookingData(prev => ({ ...prev, appointmentTypeId: parseInt(value) }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select appointment type" />
                  </SelectTrigger>
                  <SelectContent>
                    {bookingPage.appointmentTypes?.filter((type: any) => 
                      !bookingData.facilityId || type.facilityId === bookingData.facilityId
                    ).map((type: any) => (
                      <SelectItem key={type.id} value={type.id.toString()}>
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {/* BOL Upload Section - Added to Step 1 */}
            <div className="space-y-4">
              <div className="border-t pt-4">
                <h3 className="font-semibold mb-3 flex items-center">
                  <Upload className="h-5 w-5 mr-2" />
                  Bill of Lading Upload (Optional)
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Upload your Bill of Lading document to speed up the check-in process
                </p>
                <BOLUploadWizard
                  bookingPageSlug={slug}
                  onUploadSuccess={(result) => {
                    console.log('BOL upload successful:', result);
                    toast({
                      title: "Success",
                      description: "Bill of Lading uploaded successfully",
                    });
                  }}
                  onExtractedDataChange={(data) => {
                    console.log('BOL data extracted:', data);
                  }}
                />
              </div>
            </div>
            
            <div className="flex justify-end">
              <Button 
                onClick={() => setStep(2)}
                disabled={!bookingData.facilityId || !bookingData.appointmentTypeId}
              >
                Next
              </Button>
            </div>
          </div>
        );
      
      case 2:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-2">Select Date & Time</h2>
              <p className="text-muted-foreground">
                Choose your preferred date and time
              </p>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="date">Date</Label>
                <DatePicker
                  date={bookingData.date ? new Date(bookingData.date) : undefined}
                  onDateChange={(date) => {
                    if (date) {
                      const dateStr = format(date, 'yyyy-MM-dd');
                      setBookingData(prev => ({ ...prev, date: dateStr, time: undefined }));
                    }
                  }}
                  disabledDays={(date) => {
                    const today = startOfDay(new Date());
                    if (date < today) return true;
                    
                    // Check if this date has availability
                    const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday
                    
                    // Block Sundays (0) and Saturdays (6) by default since most facilities are closed
                    if (dayOfWeek === 0 || dayOfWeek === 6) {
                      return true;
                    }
                    
                    return false;
                  }}
                  disablePastDates={true}
                />
              </div>
              
              {bookingData.date && (
                <div className="space-y-2">
                  <Label htmlFor="time">Time</Label>
                  <SimpleTimeSlots
                    date={bookingData.date}
                    facilityId={bookingData.facilityId || 0}
                    appointmentTypeId={bookingData.appointmentTypeId || 0}
                    bookingPageSlug={slug}
                    onTimeSelect={(time) => setBookingData(prev => ({ ...prev, time }))}
                    selectedTime={bookingData.time}
                  />
                </div>
              )}
            </div>
            
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button 
                onClick={() => setStep(3)}
                disabled={!bookingData.date || !bookingData.time}
              >
                Next
              </Button>
            </div>
          </div>
        );
      
      case 3:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-2">Complete Your Booking</h2>
              <p className="text-muted-foreground">
                Fill out your details to complete the appointment
              </p>
            </div>
            
            <Form {...form}>
              <form 
                onSubmit={form.handleSubmit((data) => {
                  console.log('=== FORM SUBMISSION DEBUG ===');
                  console.log('Form data being submitted:', data);
                  console.log('Form validation state:', form.formState.errors);
                  console.log('Current booking data:', bookingData);
                  console.log('form.formState.isValid:', form.formState.isValid);
                  // Handle both nested and flat form data structures
                  const formData = data.customFields || data;
                  console.log('Processed form data:', formData);
                  handleSubmitBooking(formData);
                })}
                className="space-y-6"
              >

                
                <StandardQuestionsFormFields
                  questions={standardQuestions || []}
                  form={form}
                  fieldNamePrefix="customFields"
                  isLoading={loadingQuestions}
                />
                

                
                <div className="flex justify-between">
                  <Button type="button" variant="outline" onClick={() => setStep(2)}>
                    Back
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={bookingMutation.isPending}
                    onClick={() => {
                      console.log("=== BOOKING FORM BUTTON CLICKED ===");
                      console.log("Form state:", form.formState);
                      console.log("Form errors:", form.formState.errors);
                      console.log("Form values:", form.getValues());
                      console.log("Current booking data:", bookingData);
                      console.log("Standard questions:", standardQuestions);
                    }}
                  >
                    {bookingMutation.isPending ? (
                      <>
                        <Loader2 className="animate-spin h-4 w-4 mr-2" />
                        Creating...
                      </>
                    ) : (
                      'Create Booking'
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        );
      
      case 4:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2 text-green-600">Booking Confirmed!</h2>
              <p className="text-muted-foreground">
                Your appointment has been successfully scheduled
              </p>
            </div>
            
            <div className="p-6 bg-green-50 border border-green-200 rounded-lg">
              <h3 className="font-semibold text-green-800 mb-4">Confirmation Details</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="font-medium">Confirmation Code:</span>
                  <span className="font-mono">{confirmationCode}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Date:</span>
                  <span>{bookingDetails.startTime ? new Date(bookingDetails.startTime).toLocaleDateString() : bookingData.date}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Time:</span>
                  <span>{bookingDetails.startTime ? new Date(bookingDetails.startTime).toLocaleTimeString() : bookingData.time}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Facility:</span>
                  <span>{bookingDetails.facilityName || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Appointment Type:</span>
                  <span>{bookingDetails.appointmentTypeName || 'N/A'}</span>
                </div>
              </div>
              
              {bookingDetails.emailSent && (
                <div className="mt-4 p-3 bg-green-100 border border-green-300 rounded-md">
                  <div className="flex items-center">
                    <Mail className="h-4 w-4 text-green-600 mr-2" />
                    <span className="text-green-800 text-sm">Confirmation email sent successfully</span>
                  </div>
                </div>
              )}
            </div>
            
            <div className="text-center">
              <Button onClick={() => {
                setStep(1);
                setBookingData({ timezone: getUserTimeZone() });
                setConfirmationCode(null);
                setBookingDetails({});
                form.reset();
              }}>
                Create Another Booking
              </Button>
            </div>
          </div>
        );
      
      default:
        return <div>Invalid step</div>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with organization logo */}
      <div className="flex items-center mb-6">
        <OrganizationLogo 
          bookingPage={bookingPage} 
          className="h-16 w-16 bg-primary/10 rounded-lg flex items-center justify-center mr-4"
        />
        <div>
          <h1 className="text-2xl font-bold">{bookingPage.name} Dock Appointment Scheduler</h1>
          <p className="text-muted-foreground">
            Please use this form to schedule your dock appointment with {bookingPage.name}.
          </p>
        </div>
      </div>
      
      {/* Main content */}
      {renderStep()}
    </div>
  );
} 