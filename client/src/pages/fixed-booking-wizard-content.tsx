import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useBookingWizard } from '@/contexts/BookingWizardContext';
import { useBookingTheme } from '@/contexts/BookingThemeContext';
import ServiceSelectionStepForm from './service-selection-step';
import { DateTimeSelectionStep, CustomerInfoStep, ConfirmationStep } from './external-booking-fixed';
import { queryClient } from '@/lib/queryClient';

// Simplified component that avoids complex hook patterns
export function FixedBookingWizardContent({ bookingPage }: { bookingPage: any }) {
  // Use only the necessary hooks
  const { 
    currentStep, 
    confirmationCode, 
    setConfirmationCode, 
    bookingData, 
    setAppointmentCreated,
    setCurrentStep, 
    setIsLoading, 
    isLoading 
  } = useBookingWizard();
  const { isLoading: themeLoading } = useBookingTheme();
  
  // Show loading state when loading theme or during form submission
  if (themeLoading || isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
        {isLoading && <p className="ml-2">Submitting your appointment...</p>}
      </div>
    );
  }
  
  // Handle form submission
  const handleSubmit = async () => {
    try {
      setIsLoading(true);
      
      // Build the schedule data
      const scheduleData = {
        ...bookingData,
        bookingPageId: bookingPage.id,
        status: 'scheduled',
        startTime: bookingData.startTime,
        endTime: bookingData.endTime,
        createdVia: 'external',
        mcNumber: bookingData.mcNumber || ''
      };
      
      console.log('Submitting appointment data:', scheduleData);
      
      // Submit to API
      const response = await fetch('/api/schedules/external', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(scheduleData),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('API error response:', errorText);
        throw new Error(`Failed to create appointment: ${errorText}`);
      }
      
      const responseData = await response.json();
      console.log('Appointment created successfully:', responseData);
      
      // Aggressively invalidate schedules query to refresh the calendar
      queryClient.invalidateQueries({ queryKey: ['/api/schedules'] });
      
      // Store the confirmation code
      setConfirmationCode(responseData.confirmationCode);
      
      // Mark as created
      setAppointmentCreated(true);
      
      // Move to confirmation step
      setCurrentStep(4);
    } catch (error) {
      console.error('Error creating appointment:', error);
      alert(error instanceof Error ? error.message : 'There was an error creating your appointment. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Determine which step to show
  if (currentStep === 1) {
    return <ServiceSelectionStepForm bookingPage={bookingPage} />;
  } else if (currentStep === 2) {
    return <DateTimeSelectionStep bookingPage={bookingPage} />;
  } else if (currentStep === 3) {
    return <CustomerInfoStep bookingPage={bookingPage} onSubmit={handleSubmit} />;
  } else if (currentStep === 4) {
    return <ConfirmationStep bookingPage={bookingPage} confirmationCode={confirmationCode} />;
  }
  
  // Fallback
  return <ServiceSelectionStepForm bookingPage={bookingPage} />;
}