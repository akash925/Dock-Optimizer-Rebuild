// This file replaces: client/src/pages/external-booking.tsx

import React, { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { BookingWizardProvider, useBookingWizard } from '@/contexts/BookingWizardContext';
import { BookingThemeProvider } from '@/hooks/use-booking-theme';
import { Loader2, XCircle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { DatePicker } from '@/components/ui/date-picker';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import dockOptimizerLogo from '@/assets/dock_optimizer_logo.jpg';
import { getUserTimeZone } from '@/lib/timezone-utils';
import { safeToString } from '@/lib/utils';

const serviceSelectionSchema = z.object({
  facilityId: z.number().min(1, "Please select a facility"),
  appointmentTypeId: z.number().min(1, "Please select a service type"),
});

export default function ExternalBooking({ slug }: { slug: string }) {
  const { data: bookingPage, isLoading, error } = useQuery({
    queryKey: [`/api/booking-pages/slug/${slug}`],
    queryFn: async () => {
      const res = await fetch(`/api/booking-pages/slug/${slug}`);
      if (!res.ok) throw new Error('Failed to fetch booking page');
      return res.json();
    },
  });

  if (isLoading) return <Loader2 className="animate-spin" />;
  if (error || !bookingPage) return <div className="text-red-500">Invalid booking link. Please check your URL.</div>;

  return (
    <BookingThemeProvider slug={slug}>
      <BookingWizardProvider>
        <BookingPage bookingPage={bookingPage} />
      </BookingWizardProvider>
    </BookingThemeProvider>
  );
}

function BookingPage({ bookingPage }: { bookingPage: any }) {
  const [step, setStep] = useState(1);
  const [confirmationCode, setConfirmationCode] = useState<string | null>(null);
  const { bookingData, updateBookingData } = useBookingWizard();

  const form = useForm({
    resolver: zodResolver(serviceSelectionSchema),
    defaultValues: {
      facilityId: 0,
      appointmentTypeId: 0,
    },
  });

  const facilities = bookingPage.facilities || [];
  console.log("Facilities loaded from bookingPage:", facilities);

  const appointmentTypes = useMemo(() => {
    const selectedFacilityId = form.watch('facilityId');
    
    // If we have appointment types in the booking page data and a facility is selected, filter by facilityId
    if (selectedFacilityId && bookingPage.appointmentTypes && Array.isArray(bookingPage.appointmentTypes)) {
      console.log(`Filtering appointment types for facility ID: ${selectedFacilityId}`);
      
      // Make sure we're comparing numbers to numbers
      const typesForFacility = bookingPage.appointmentTypes.filter((type: any) => {
        const typeId = Number(type.id);
        const typeFacilityId = Number(type.facilityId);
        const selectedId = Number(selectedFacilityId);
        
        // Debug data
        if (typeFacilityId === selectedId) {
          console.log(`Matched appointment type: ${type.name} (ID: ${typeId}) for facility ${selectedId}`);
        }
        
        return typeFacilityId === selectedId;
      });
      
      console.log(`Found ${typesForFacility.length} appointment types for facility ID ${selectedFacilityId}`);
      return typesForFacility;
    }
    
    return [];
  }, [bookingPage.appointmentTypes, form.watch('facilityId')]);

  const handleSubmit = (values: any) => {
    const selectedFacility = facilities.find((f: any) => f.id === values.facilityId);
    updateBookingData({
      facilityId: values.facilityId,
      appointmentTypeId: values.appointmentTypeId,
      timezone: selectedFacility?.timezone || getUserTimeZone(),
    });
    setStep(2);
  };

  const { data: availability, isLoading: loadingAvailability } = useQuery({
    queryKey: ["availability/v2", bookingData?.facilityId, bookingData?.appointmentTypeId, bookingData?.date],
    queryFn: async () => {
      // Use the enhanced v2 endpoint which properly handles all scheduling rules
      const url = new URL('/api/availability/v2', window.location.origin);
      
      // Format date to string if it's a Date object, or use the string directly
      const dateString = bookingData?.date 
        ? (typeof bookingData.date === 'string' 
            ? bookingData.date 
            : format(bookingData.date, 'yyyy-MM-dd'))
        : '';
        
      url.searchParams.append('date', dateString);
      url.searchParams.append('facilityId', String(bookingData?.facilityId || ''));
      url.searchParams.append('appointmentTypeId', String(bookingData?.appointmentTypeId || ''));
      url.searchParams.append('bookingPageSlug', window.location.pathname.split('/').pop() || '');
      
      console.log(`Fetching availability from: ${url.toString()}`);
      
      const res = await fetch(url.toString());
      if (!res.ok) {
        const errorData = await res.json();
        console.error("Availability fetch error:", errorData);
        throw new Error(errorData.message || "Failed to load availability");
      }
      const data = await res.json();
      console.log("Availability data:", data);
      return data.slots || []; // Use the enhanced slots format that includes availability details
    },
    enabled: !!bookingData?.date && !!bookingData?.facilityId && !!bookingData?.appointmentTypeId && step === 2,
  });

  const bookingMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch("/api/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to book appointment");
      return res.json();
    },
    onSuccess: (data) => {
      setConfirmationCode(data.confirmationCode);
      setStep(3);
    },
  });

  return (
    <div className="max-w-xl mx-auto p-4 space-y-4">
      <img src={dockOptimizerLogo} alt="Dock Optimizer Logo" className="h-12" />

      {step === 1 && (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div>
              <Label>Facility</Label>
              <Select
                onValueChange={(value) => form.setValue('facilityId', Number(value))}
                value={safeToString(form.watch('facilityId'))}
              >
                <SelectTrigger><SelectValue placeholder="Select Facility" /></SelectTrigger>
                <SelectContent>
                  {facilities
                    .filter((f: any) => f?.id && f?.name)
                    .map((f: any) => {
                      const facilityId = String(f.id);
                      return (
                        <SelectItem key={`facility-${facilityId}`} value={facilityId}>
                          {f.name}
                        </SelectItem>
                      );
                    })}

                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Service Type</Label>
              <Select
                onValueChange={(value) => form.setValue('appointmentTypeId', Number(value))}
                value={safeToString(form.watch('appointmentTypeId'))}
                disabled={!form.watch('facilityId')}
              >
                <SelectTrigger><SelectValue placeholder="Select Service" /></SelectTrigger>
                <SelectContent>
                  {appointmentTypes.length === 0 ? (
                    <div className="px-2 py-1.5 text-sm text-neutral-500">
                      No services available for this facility
                    </div>
                  ) : (
                    appointmentTypes.map((t: any) => {
                      console.log(`Rendering appointment type: ${t.name} (ID: ${t.id}, Facility: ${t.facilityId})`);
                      const typeId = String(t.id);
                      return (
                        <SelectItem key={`apptType-${typeId}`} value={typeId}>
                          {t.name}
                        </SelectItem>
                      );
                    })
                  )}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit">Next</Button>
          </form>
        </Form>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <Label>Select Date</Label>
          <DatePicker 
            date={bookingData?.date ? new Date(bookingData.date) : undefined}
            onDateChange={(date) => {
              if (date) {
                // Store the date as formatted string
                const formattedDate = format(date, 'yyyy-MM-dd');
                updateBookingData({ date: formattedDate });
              }
            }}
            disablePastDates={true}
          />

          {loadingAvailability ? (
            <div className="flex justify-center py-8">
              <Loader2 className="animate-spin h-8 w-8 text-primary" />
            </div>
          ) : availability && availability.length > 0 ? (
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground">Available Times</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {availability.map((slot: any) => {
                  // Determine the button styling based on availability
                  let variant: 'default' | 'outline' = 'outline';
                  let className = '';
                  
                  if (bookingData?.time === slot.time) {
                    variant = 'default';
                  } else if (!slot.available) {
                    className = 'opacity-50';
                  } else if (slot.remainingCapacity && slot.remainingCapacity < 2) {
                    // Limited availability styling
                    className = 'border-yellow-400';
                  }
                  
                  return (
                    <Button
                      key={slot.time}
                      variant={variant}
                      className={className}
                      onClick={() => updateBookingData({ time: slot.time })}
                      disabled={!slot.available}
                      title={slot.reason || (slot.available ? 
                        `${slot.remainingCapacity || 1} slot(s) available` : 
                        'Not available')}
                    >
                      {slot.time}
                      {!slot.available && slot.reason === 'facility break' && (
                        <span className="ml-1 text-xs">🍽️</span>
                      )}
                      {!slot.available && slot.reason === 'outside hours' && (
                        <span className="ml-1 text-xs">🔒</span>
                      )}
                      {slot.available && slot.remainingCapacity === 1 && (
                        <span className="ml-1 text-xs">⚠️</span>
                      )}
                    </Button>
                  );
                })}
              </div>
              <div className="text-xs text-muted-foreground mt-2">
                <p>🔒 - Outside facility hours</p>
                <p>🍽️ - Facility break time</p>
                <p>⚠️ - Limited availability</p>
              </div>
            </div>
          ) : (
            <div className="py-4 text-center">
              <p className="text-muted-foreground">No availability found for selected date.</p>
              <p className="text-sm mt-2">Try selecting a different date or service type.</p>
            </div>
          )}

          <Button
            onClick={() => bookingMutation.mutate(bookingData)}
            disabled={!bookingData?.time || bookingMutation.isPending}
          >
            {bookingMutation.isPending ? 'Booking...' : 'Confirm Booking'}
          </Button>
        </div>
      )}

      {step === 3 && confirmationCode && (
        <div className="text-center space-y-4">
          <CheckCircle className="text-green-500 w-10 h-10 mx-auto" />
          <h2 className="text-lg font-bold">Booking Confirmed</h2>
          <p>Your confirmation code is: <code>{confirmationCode}</code></p>
        </div>
      )}

      {bookingMutation.error && (
        <div className="text-red-500 text-sm">{(bookingMutation.error as Error).message}</div>
      )}
    </div>
  );
}
