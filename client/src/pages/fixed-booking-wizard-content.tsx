import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { Loader2 } from 'lucide-react';
import { useBookingWizard } from '@/contexts/BookingWizardContext';
import { useBookingTheme } from '@/contexts/BookingThemeContext';
import ServiceSelectionStepForm from './service-selection-step';
// Import directly from original external-booking-fixed
import { DateTimeSelectionStep, CustomerInfoStep, ConfirmationStep } from './external-booking-fixed';
// We'll use the dynamic logo endpoint instead of a static logo
// Using relative path to assets
import hanzoLogoImport from '../assets/hanzo_logo.jpeg'; // Fallback logo
import { formatInTimeZone } from 'date-fns-tz';
import { getTimeZoneAbbreviation } from '@/lib/timezone-utils';

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
  
  // Get the slug from the booking page
  const slug = bookingPage?.slug || '';
  
  // Fetch facilities data - include bookingPageSlug for tenant isolation
  const { data: facilities = [] } = useQuery<any[]>({
    queryKey: ['/api/facilities', { bookingPageSlug: slug }],
    queryFn: async ({ queryKey }) => {
      const [baseUrl, params] = queryKey as [string, { bookingPageSlug: string }]; // Type assertion to fix TS error
      // Important: Use port 5000 directly for API requests
      const apiUrl = `http://localhost:5000${baseUrl}?bookingPageSlug=${params.bookingPageSlug}`;
      console.log(`[FixedBookingWizardContent] Fetching facilities with URL: ${apiUrl}`);
      
      try {
        const response = await fetch(apiUrl);
        console.log(`[FixedBookingWizardContent] Facilities API response status:`, response.status);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[FixedBookingWizardContent] Error fetching facilities: ${errorText}`);
          throw new Error(`Failed to fetch facilities: ${response.status} ${errorText}`);
        }
        
        const data = await response.json();
        console.log(`[FixedBookingWizardContent] Successfully fetched ${data.length} facilities`);
        return data;
      } catch (err) {
        console.error(`[FixedBookingWizardContent] Exception fetching facilities:`, err);
        throw err;
      }
    },
    enabled: !!slug
  });
  
  // Get facility and appointment type information
  const selectedFacilityId = bookingData.facilityId;
  const selectedTypeId = bookingData.appointmentTypeId;
  
  // Calculate progress percentage
  const totalSteps = 3; // We have 3 steps (confirmation is not counted in progress)
  const progressPercentage = Math.min(((currentStep - 1) / totalSteps) * 100, 100);
  
  // Get the organization name from booking page for use throughout the component
  const organizationName = bookingPage?.organizationName || bookingPage?.name?.split(' - ')[0] || 'Logistics';

  // Set document title
  useEffect(() => {
    // Set the document title
    document.title = `Book Appointment - ${organizationName} Dock Appointment Scheduler`;
  }, [organizationName]);
  
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
        
        // Aggressively invalidate schedules query to refresh the calendar
        if (queryClient) {
          // First invalidate the query
          queryClient.invalidateQueries({ queryKey: ['/api/schedules'] });
          console.log('Invalidated schedules query to refresh calendar');
          
          // Then immediately force a refetch
          queryClient.fetchQuery({ queryKey: ['/api/schedules'] });
          console.log('Force fetching schedules to ensure immediate update');
          
          // Set a timeout for a second forced refetch to handle any potential race conditions
          setTimeout(() => {
            queryClient.invalidateQueries({ queryKey: ['/api/schedules'] });
            queryClient.fetchQuery({ queryKey: ['/api/schedules'] });
            console.log('Performed second refresh to ensure calendar is updated');
          }, 2000);
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
    console.log('[FixedBookingWizardContent] Rendering ServiceSelectionStepForm with bookingPage:', {
      id: bookingPage?.id,
      slug: bookingPage?.slug,
      tenantId: bookingPage?.tenantId,
      facilities: bookingPage?.facilities ? JSON.stringify(bookingPage?.facilities).substring(0, 100) : null
    });
    stepContent = <ServiceSelectionStepForm bookingPage={bookingPage} />;
  } else if (currentStep === 2) {
    stepContent = <DateTimeSelectionStep bookingPage={bookingPage} />;
  } else if (currentStep === 3) {
    stepContent = <CustomerInfoStep bookingPage={bookingPage} onSubmit={handleSubmit} />;
  } else if (currentStep === 4) {
    stepContent = <ConfirmationStep bookingPage={bookingPage} confirmationCode={confirmationCode} />;
  }

  // Set up logo URL - use tenant-specific logo from booking-pages-logo endpoint if available
  const logoUrl = slug ? `/api/booking-pages/logo/${slug}` : hanzoLogoImport;
  
  return (
    <div className="booking-wizard-container">
      <div className="booking-wizard-header">
        <img 
          src={logoUrl}
          alt={`${organizationName} Logo`}
          className="booking-wizard-logo"
          onError={(e) => {
            // Fallback to default logo if the dynamic URL fails
            const target = e.target as HTMLImageElement;
            if (target.src !== hanzoLogoImport) {
              target.src = hanzoLogoImport;
              console.warn(`Failed to load tenant logo for slug ${slug}, falling back to default`);
            }
          }}
        />
        <h1 className="booking-wizard-title">{organizationName} Dock Appointment Scheduler</h1>
        <p className="booking-wizard-subtitle">
          Please use this form to pick the type of Dock Appointment that you need at {organizationName}.
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
                <strong>Time:</strong> {(() => {
                  // Get the facility timezone from the selected facility
                  const facilityTimezone = 
                    bookingData.facilityTimezone || 
                    (facilities.find((f: any) => f.id === bookingData.facilityId)?.timezone || 'America/New_York');
                  
                  // Format the time in the facility timezone with abbreviation
                  const facilityTime = formatInTimeZone(
                    new Date(bookingData.startTime),
                    facilityTimezone,
                    'h:mm a'
                  );
                  
                  // Get the timezone abbreviation
                  const facilityAbbr = getTimeZoneAbbreviation(facilityTimezone);
                  
                  return `${facilityTime} (${facilityAbbr})`;
                })()}
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