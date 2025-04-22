import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import UnifiedAppointmentForm from '@/components/shared/unified-appointment-form-fixed';
import { useToast } from '@/hooks/use-toast';

export default function TestFixedAppointmentPage() {
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
          <CardTitle>Test Fixed Appointment Form</CardTitle>
          <CardDescription>
            This page is for testing the fixed version of the appointment form component
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Internal Mode Test */}
          <div className="mb-8">
            <h2 className="text-lg font-bold mb-4">Internal Mode Test</h2>
            <Button
              onClick={() => {
                toast({
                  title: "Opening modal",
                  description: "The internal appointment form would open in a modal dialog"
                });
              }}
            >
              Open Internal Form Modal
            </Button>
          </div>

          {/* External Mode Test */}
          <div>
            <h2 className="text-lg font-bold mb-4">External Mode Test</h2>
            <div className="border rounded-md p-4">
              <UnifiedAppointmentForm
                mode="external"
                initialDate={initialDate}
                facilityId={1}
                appointmentTypeId={1}
                facilityTimezone="America/New_York"
                onSubmitSuccess={handleSubmitSuccess}
                bookingPageSlug="test-page"
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}