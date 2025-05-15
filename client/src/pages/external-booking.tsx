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
  facilityId: z.number(),
  appointmentTypeId: z.number(),
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
      facilityId: undefined,
      appointmentTypeId: undefined,
    },
  });

  const facilities = bookingPage.facilities || [];
  console.log("Facilities loaded from bookingPage:", facilities);

  const appointmentTypes = useMemo(() => {
    const selectedFacility = form.watch('facilityId');
    return bookingPage.appointmentTypes?.filter((t: any) => t.facilityId === selectedFacility) || [];
  }, [form.watch('facilityId')]);

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
    queryKey: ["availability", bookingData],
    queryFn: async () => {
      const res = await fetch("/api/availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          facilityId: bookingData?.facilityId,
          appointmentTypeId: bookingData?.appointmentTypeId,
          date: bookingData?.date,
          timezone: bookingData?.timezone,
        }),
      });
      if (!res.ok) throw new Error("Failed to load availability");
      return res.json();
    },
    enabled: !!bookingData?.date && step === 2,
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
                    .map((f: any) => (
                      <SelectItem key={`facility-${f.id}`} value={safeToString(f.id)}>
                        {f.name}
                      </SelectItem>
                  ))}

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
                  {appointmentTypes.map((t: any) => (
                    <SelectItem key={`apptType-${t.id}`} value={safeToString(t.id)}>
                      {t.name}
                    </SelectItem>
                  ))}
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
          <DatePicker onChange={(d) => updateBookingData({ date: format(d, 'yyyy-MM-dd') })} />

          {loadingAvailability ? (
            <Loader2 className="animate-spin" />
          ) : availability && availability.length > 0 ? (
            <div className="grid grid-cols-2 gap-2">
              {availability.map((slot: any) => (
                <Button
                  key={slot.time}
                  variant={bookingData?.time === slot.time ? 'default' : 'outline'}
                  onClick={() => updateBookingData({ time: slot.time })}
                  disabled={!slot.available}
                >
                  {slot.time}
                </Button>
              ))}
            </div>
          ) : (
            <p>No availability found for selected date.</p>
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
