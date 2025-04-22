import React, { useState } from 'react';
import UnifiedAppointmentForm from '@/components/shared/unified-appointment-form-fixed';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function TestFixedAppointmentPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  return (
    <div className="container mx-auto p-4 max-w-7xl">
      <h1 className="text-3xl font-bold mb-6">Test Fixed Appointment Form</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Internal Form (Modal)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4">Test the internal appointment form in a modal dialog.</p>
            <Button onClick={() => setIsDialogOpen(true)}>
              Open Modal Form
            </Button>
            
            <UnifiedAppointmentForm 
              mode="internal"
              isOpen={isDialogOpen}
              onClose={() => setIsDialogOpen(false)}
              facilityId={1}
              appointmentTypeId={1}
              facilityTimezone="America/New_York"
              onSubmitSuccess={(data) => {
                console.log("Appointment created:", data);
                setIsDialogOpen(false);
              }}
            />
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>External Form (Embedded)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4">The external booking form is embedded below.</p>
            
            <div className="border rounded-lg p-4 bg-gray-50">
              <UnifiedAppointmentForm 
                mode="external"
                facilityId={1}
                appointmentTypeId={1}
                facilityTimezone="America/New_York"
                onSubmitSuccess={(data) => {
                  console.log("External appointment created:", data);
                }}
                containerClass="bg-white p-6 rounded-lg shadow"
                showBackButton={true}
                goBack={() => alert("Go back clicked")}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}