import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { BookingWizardProvider, useBookingWizard } from '@/contexts/BookingWizardContext';
import { BookingThemeProvider } from '@/hooks/use-booking-theme';
import { useToast } from '@/hooks/use-toast';
import { BookingHeader } from '@/components/booking/BookingHeader';
import { ServiceSelection } from '@/components/booking/ServiceSelection';
import { DateTimeSelection } from '@/components/booking/DateTimeSelection';
import { getUserTimeZone } from '@shared/timezone-utils';

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
  [key: string]: any;
}

export default function ExternalBookingRefactored({ slug }: { slug: string }) {
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

  if (isLoading) return <div className="flex justify-center items-center min-h-screen">Loading...</div>;
  if (error || !bookingPage) return <div className="text-red-500">Invalid booking link. Please check your URL.</div>;

  return (
    <BookingThemeProvider slug={slug}>
      <div className="min-h-screen bg-gradient-to-b from-primary/20 to-background">
        <div className="container mx-auto py-8 px-4">
          <div className="bg-white rounded-lg shadow-lg p-6 mx-auto max-w-4xl">
            <BookingHeader bookingPage={bookingPage} />
            <BookingWizardContent bookingPage={bookingPage} slug={slug} />
          </div>
        </div>
      </div>
    </BookingThemeProvider>
  );
}

function BookingWizardContent({ bookingPage, slug }: { bookingPage: any, slug: string }) {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [bookingData, setBookingData] = useState<BookingData>({
    timezone: getUserTimeZone()
  });
  const [confirmationCode, setConfirmationCode] = useState<string | null>(null);
  const [bookingDetails, setBookingDetails] = useState<BookingDetails>({});

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
              emailSent: true,
              bolFileUploaded: !!data.schedule.bolUrl
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

  // Get the selected facility
  const selectedFacility = bookingPage.facilities?.find((f: any) => f.id === bookingData.facilityId);
  
  // Create booking mutation
  const bookingMutation = useMutation({
    mutationFn: async (data: any) => {
      console.log("Starting booking creation with payload:", data);
      
      const res = await fetch(`/api/booking-pages/book/${slug}`, {
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
        console.error("Booking error response:", responseData);
        throw new Error(responseData.message || 'Failed to create booking');
      }
      
      return responseData;
    },
    onSuccess: (data: any) => {
      console.log("Booking created successfully:", data);
      
      const confirmationCode = data.confirmationCode || 
                              (data.schedule && data.schedule.confirmationCode) || 
                              (data.schedule && data.schedule.confirmation_code) ||
                              data.code;
                              
      const fallbackCode = `DO-${data.schedule?.id || Math.floor(Date.now() / 1000)}`;
      const finalConfirmationCode = confirmationCode || fallbackCode;
      
      setConfirmationCode(finalConfirmationCode);
      
      // Set booking details for confirmation page
      const schedule = data.schedule || {};
      const facility = data.facility || {};
      const appointmentType = data.appointmentType || {};
      
      setBookingDetails({
        confirmationCode: finalConfirmationCode,
        id: schedule.id,
        scheduleId: schedule.id,
        emailSent: data.emailSent || false,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        timezone: data.timezone || bookingData.timezone,
        facilityId: schedule.facilityId,
        facilityName: facility.name || data.facilityName,
        facilityAddress: facility.address || data.facilityAddress,
        appointmentTypeId: schedule.appointmentTypeId,
        appointmentTypeName: appointmentType.name || data.appointmentTypeName,
      });
      
      setStep(4);
    },
    onError: (error: any) => {
      console.error("Booking creation failed:", error);
      toast({
        title: "Booking Failed",
        description: error instanceof Error ? error.message : "An error occurred while creating your booking",
        variant: "destructive"
      });
    }
  });

  const handleServiceSelection = (facilityId: number, appointmentTypeId: number) => {
    setBookingData(prev => ({
      ...prev,
      facilityId,
      appointmentTypeId
    }));
  };

  const handleDateTimeSelection = (date: string, time: string) => {
    setBookingData(prev => ({
      ...prev,
      date,
      time
    }));
  };

  const handleSubmitBooking = async (formData: any) => {
    if (!bookingData.facilityId || !bookingData.appointmentTypeId || !bookingData.date || !bookingData.time) {
      toast({
        title: "Missing Information",
        description: "Please complete all required fields",
        variant: "destructive"
      });
      return;
    }

    const bookingPayload = {
      ...bookingData,
      customFields: {
        customerName: formData.customerName || '',
        email: formData.email || '',
        ...formData
      }
    };

    bookingMutation.mutate(bookingPayload);
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <ServiceSelection
            bookingPage={bookingPage}
            selectedFacilityId={bookingData.facilityId}
            selectedAppointmentTypeId={bookingData.appointmentTypeId}
            onFacilityChange={(facilityId) => setBookingData(prev => ({ ...prev, facilityId }))}
            onAppointmentTypeChange={(appointmentTypeId) => setBookingData(prev => ({ ...prev, appointmentTypeId }))}
            onNext={() => setStep(2)}
          />
        );
      
      case 2:
        return (
          <DateTimeSelection
            bookingPage={bookingPage}
            facility={selectedFacility}
            appointmentTypeId={bookingData.appointmentTypeId}
            selectedDate={bookingData.date}
            selectedTime={bookingData.time}
            onDateChange={(date) => setBookingData(prev => ({ ...prev, date }))}
            onTimeChange={(time) => setBookingData(prev => ({ ...prev, time }))}
            onBack={() => setStep(1)}
            onNext={() => setStep(3)}
          />
        );
      
      case 3:
        return (
          <div className="space-y-8">
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-2">Complete Your Booking</h2>
              <p className="text-muted-foreground">
                Fill out your details to complete the appointment booking
              </p>
            </div>
            
            {/* TODO: Add form and BOL upload components here */}
            <div className="p-8 bg-gray-50 rounded-lg text-center">
              <p className="text-muted-foreground mb-4">
                Form fields and BOL upload will be added here
              </p>
              <div className="space-y-4">
                <input
                  type="text"
                  placeholder="Customer Name"
                  className="w-full p-3 border rounded-lg"
                  id="customerName"
                />
                <input
                  type="email"
                  placeholder="Email Address"
                  className="w-full p-3 border rounded-lg"
                  id="email"
                />
              </div>
            </div>
            
            <div className="flex justify-between">
              <button
                onClick={() => setStep(2)}
                className="px-6 py-3 border rounded-lg hover:bg-gray-50"
              >
                Back
              </button>
              <button
                onClick={() => {
                  const customerName = (document.getElementById('customerName') as HTMLInputElement)?.value;
                  const email = (document.getElementById('email') as HTMLInputElement)?.value;
                  
                  if (!customerName || !email) {
                    toast({
                      title: "Missing Information",
                      description: "Please fill in all required fields",
                      variant: "destructive"
                    });
                    return;
                  }
                  
                  handleSubmitBooking({ customerName, email });
                }}
                disabled={bookingMutation.isPending}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {bookingMutation.isPending ? 'Creating...' : 'Create Booking'}
              </button>
            </div>
          </div>
        );
      
      case 4:
        return (
          <div className="space-y-8">
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-2 text-green-600">Booking Confirmed!</h2>
              <p className="text-muted-foreground">
                Your appointment has been successfully scheduled
              </p>
            </div>
            
            <div className="p-6 bg-green-50 border border-green-200 rounded-lg">
              <h3 className="font-semibold text-green-800 mb-4">Confirmation Details</h3>
              <div className="space-y-2 text-sm">
                <p><strong>Confirmation Code:</strong> {confirmationCode}</p>
                <p><strong>Date:</strong> {bookingDetails.startTime ? new Date(bookingDetails.startTime).toLocaleDateString() : 'N/A'}</p>
                <p><strong>Time:</strong> {bookingDetails.startTime ? new Date(bookingDetails.startTime).toLocaleTimeString() : 'N/A'}</p>
                <p><strong>Facility:</strong> {bookingDetails.facilityName || 'N/A'}</p>
                <p><strong>Appointment Type:</strong> {bookingDetails.appointmentTypeName || 'N/A'}</p>
                {bookingDetails.emailSent && (
                  <p className="text-green-600">✓ Confirmation email sent</p>
                )}
              </div>
            </div>
          </div>
        );
      
      default:
        return <div>Invalid step</div>;
    }
  };

  return (
    <div className="mt-8">
      {renderStep()}
    </div>
  );
} 