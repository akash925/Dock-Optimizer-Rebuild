import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import AppointmentForm from '@/components/shared/appointment-form-patched';
import { useToast } from '@/hooks/use-toast';

export default function TestAppointmentPatchedPage() {
  const { toast } = useToast();
  const initialDate = new Date();
  initialDate.setHours(initialDate.getHours() + 24); // Set to tomorrow

  const handleSubmitSuccess = (data: any) => {
    toast({
      title: "Success",
      description: "Appointment data submitted successfully",
    });
    console.log("Submitted data:", data);
  };

  return (
    <div className="container mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>Patched Appointment Form Test</CardTitle>
          <CardDescription>
            This page tests the improved appointment form with the patched availability hook
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md p-4">
            <AppointmentForm 
              facilityId={1}
              appointmentTypeId={1}
              initialDate={initialDate}
              facilityTimezone="America/New_York"
              onSubmitSuccess={handleSubmitSuccess}
              bookingPageSlug="test-page"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}