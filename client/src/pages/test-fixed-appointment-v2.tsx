import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import UnifiedAppointmentForm from '@/components/shared/unified-appointment-form-fixed';
import { useToast } from '@/hooks/use-toast';

export default function TestFixedAppointmentV2() {
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
          <CardTitle>Test Fixed Appointment Form v2</CardTitle>
          <CardDescription>
            This page tests the fixed appointment form with the updated availability hook
          </CardDescription>
        </CardHeader>
        <CardContent>
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