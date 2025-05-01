import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { Loader2 } from 'lucide-react';
import { useBookingWizard } from '@/contexts/BookingWizardContext';
import { useBookingTheme } from '@/contexts/BookingThemeContext';
import ServiceSelectionStepForm from './service-selection-step';
// Import directly from original external-booking-fixed
import { DateTimeSelectionStep, CustomerInfoStep, ConfirmationStep } from './external-booking-fixed';
import hanzoLogoImport from '@assets/hanzo logo.jpeg';

// This is a clean rewrite of the BookingWizardContent component with proper hooks order
export function FixedBookingWizardContent({ bookingPage }: { bookingPage: any }) {
  // All React hooks must be called at the top level, before any conditional logic
  const { 
    currentStep, 
    setCurrentStep,
    isLoading,
    setIsLoading,
    appointmentCreated,
    setAppointmentCreated,
    confirmationCode,
    setConfirmationCode,
    bookingData,
    updateBookingData,
    resetBookingData
  } = useBookingWizard();
  
  const { theme, isLoading: themeLoading } = useBookingTheme();
  
  // Fetch facilities data
  const { data: facilities = [] } = useQuery<any[]>({
    queryKey: ['/api/facilities'],
  });
  
  // Get facility and appointment type information
  const selectedFacilityId = bookingData.facilityId;
  const selectedTypeId = bookingData.appointmentTypeId;
  
  // Calculate progress percentage
  const totalSteps = 3; // We have 3 steps (confirmation is not counted in progress)
  const progressPercentage = Math.min(((currentStep - 1) / totalSteps) * 100, 100);
  
  // Set document title
  useEffect(() => {
    // Set the document title
    document.title = `Book Appointment - Hanzo Logistics Dock Appointment Scheduler`;
  }, []);
  
  // Find facility name with useMemo
  const facilityName = useMemo(() => {
    if (!selectedFacilityId) return '';
    
    // First check if we have the name directly in bookingData
    if (bookingData.facilityName) {
      return bookingData.facilityName;
    }
    
    // Then try to find in the API-fetched facilities
    if (Array.isArray(facilities)) {
      const selectedFacility = facilities.find((f: any) => f.id === selectedFacilityId);
      if (selectedFacility?.name) {
        return selectedFacility.name;
      }
    }
    
    return 'Unknown Facility';
  }, [selectedFacilityId, facilities, bookingData]);
  
  // Find appointment type name with useMemo
  const appointmentTypeName = useMemo(() => {
    if (!selectedTypeId) return '';
    
    // First check if we have the name directly in bookingData
    if (bookingData.appointmentTypeName) {
      return bookingData.appointmentTypeName;
    }
    
    // Then check in appointment types array
    const appointmentType = bookingData.appointmentTypes 
      ? bookingData.appointmentTypes.find((t: any) => t.id === selectedTypeId)
      : null;
      
    if (appointmentType?.name) {
      return appointmentType.name;
    }
    
    return '';
  }, [selectedTypeId, bookingData]);
  
  // Function to handle form submission
  const handleSubmit = async () => {
    try {
      setIsLoading(true);
      
      // Validate essential data before submission
      const requiredFields = [
        { field: 'facilityId', label: 'Facility' },
        { field: 'appointmentTypeId', label: 'Appointment Type' },
        { field: 'startTime', label: 'Appointment Time' },
        { field: 'endTime', label: 'Appointment End Time' },
        { field: 'companyName', label: 'Company Name' },
        { field: 'contactName', label: 'Contact Name' },
        { field: 'email', label: 'Email' },
        { field: 'phone', label: 'Phone' },
        { field: 'driverName', label: 'Driver Name' },
        { field: 'driverPhone', label: 'Driver Phone' },
        { field: 'truckNumber', label: 'Truck Number' }
      ];
      
      const missingFields = requiredFields.filter(
        field => !bookingData[field.field as keyof typeof bookingData]
      );
      
      // Special validation for carrier: need either carrierId or carrierName
      const hasCarrierInfo = bookingData.carrierId || (bookingData.carrierName && bookingData.carrierName.trim());
      if (!hasCarrierInfo) {
        missingFields.push({ field: 'carrierName', label: 'Carrier Name' });
      }
      
      if (missingFields.length > 0) {
        const missingFieldNames = missingFields.map(f => f.label).join(', ');
        throw new Error(`Please complete all required fields: ${missingFieldNames}`);
      }
      
      // Build the schedule data
      const scheduleData = {
        ...bookingData,
        bookingPageId: bookingPage.id,
        status: 'scheduled',
        // Ensure dates are properly formatted
        startTime: bookingData.startTime,
        endTime: bookingData.endTime,
        createdVia: 'external',
        // Ensure MC Number is properly handled (optional but included)
        mcNumber: bookingData.mcNumber || ''
      };
      
      console.log('Submitting appointment data:', scheduleData);
      
      let responseData;
      
      try {
        // Submit to API
        console.log('Sending data to API:', JSON.stringify(scheduleData, null, 2));
        
        const response = await fetch('/api/schedules/external', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(scheduleData),
        });
        
        let responseText = '';
        try {
          // Try to get the response as text first
          responseText = await response.text();
          
          // Then try to parse it as JSON if possible
          try {
            responseData = JSON.parse(responseText);
          } catch (parseError) {
            console.error('Failed to parse response as JSON:', responseText);
            throw new Error('Server returned an invalid response format');
          }
        } catch (textError) {
          console.error('Failed to get response text:', textError);
          throw new Error('Could not read server response');
        }
        
        if (!response.ok) {
          const errorMessage = responseData?.message || 'Failed to create appointment';
          console.error('API error:', errorMessage, responseData);
          throw new Error(errorMessage);
        }
        
        console.log('Appointment created successfully:', responseData);
        
        // Invalidate schedules query to refresh the calendar
        if (queryClient) {
          queryClient.invalidateQueries({ queryKey: ['/api/schedules'] });
          console.log('Invalidated schedules query to refresh calendar');
        }
      } catch (error) {
        console.error('Error during appointment creation:', error);
        throw error; // Re-throw the error to be caught by the outer catch block
      }
      
      // Store the confirmation code
      setConfirmationCode(responseData.confirmationCode);
      
      // Mark as created
      setAppointmentCreated(true);
      
      // Move to confirmation step
      setCurrentStep(4);
    } catch (error: any) {
      console.error('Error creating appointment:', error);
      // Use a more user-friendly alert
      alert(error.message || 'There was an error creating your appointment. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Show loading state when loading theme
  if (themeLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }
  
  // Determine which step to show - no hooks in conditional logic
  let stepContent;
  if (currentStep === 1) {
    stepContent = <ServiceSelectionStepForm bookingPage={bookingPage} />;
  } else if (currentStep === 2) {
    stepContent = <DateTimeSelectionStep bookingPage={bookingPage} />;
  } else if (currentStep === 3) {
    stepContent = <CustomerInfoStep bookingPage={bookingPage} onSubmit={handleSubmit} />;
  } else if (currentStep === 4) {
    stepContent = <ConfirmationStep bookingPage={bookingPage} confirmationCode={confirmationCode} />;
  }

  return (
    <div className="booking-wizard-container">
      <div className="booking-wizard-header">
        <img 
          src={hanzoLogoImport} 
          alt="Hanzo Logistics Logo" 
          className="booking-wizard-logo"
        />
        <h1 className="booking-wizard-title">Hanzo Logistics Dock Appointment Scheduler</h1>
        <p className="booking-wizard-subtitle">
          Please use this form to pick the type of Dock Appointment that you need at Hanzo Logistics.
        </p>
        
        {/* Add prominent facility and appointment type banner */}
        {(facilityName || appointmentTypeName || bookingData.startTime) && (
          <div className="booking-info-banner">
            {facilityName && (
              <div className="booking-info-item">
                <strong>Facility:</strong> {facilityName}
              </div>
            )}
            {appointmentTypeName && (
              <div className="booking-info-item">
                <strong>Appointment Type:</strong> {appointmentTypeName}
              </div>
            )}
            {bookingData.startTime && (
              <div className="booking-info-item">
                <strong>Time:</strong> {new Date(bookingData.startTime).toLocaleTimeString()} 
                {bookingData.facilityTimezone && ` (${bookingData.facilityTimezone})`}
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Step indicator/progress bar - only show for steps 1-3 */}
      {currentStep <= 3 && (
        <div className="booking-step-indicator">
          <div className="booking-step-text">
            STEP {currentStep} OF {totalSteps}
          </div>
          <div className="booking-progress-container">
            <div 
              className="booking-progress-bar" 
              style={{ width: `${progressPercentage}%` }}
            ></div>
          </div>
        </div>
      )}
      
      {/* The current step content */}
      {stepContent}
    </div>
  );
}