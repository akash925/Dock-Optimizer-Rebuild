import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { useBookingWizard } from '@/contexts/BookingWizardContext';
import { useBookingTheme } from '@/contexts/BookingThemeContext';
import ServiceSelectionStepForm from './service-selection-step';
import { DateTimeSelectionStep, CustomerInfoStep, ConfirmationStep } from './external-booking-fixed';
import { queryClient } from '@/lib/queryClient';

// Define fallback logos
const hanzoLogoPath = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAPoAAAD6CAIAAAAHjs1qAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAyZpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuNi1jMTQ1IDc5LjE2MzQ5OSwgMjAxOC8wOC8xMy0xNjo0MDoyMiAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RSZWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZVJlZiMiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIENDIDIwMTkgKFdpbmRvd3MpIiB4bXBNTTpJbnN0YW5jZUlEPSJ4bXAuaWlkOjcwMkIzQTMyRTFEQTExRUE5QjRGQjQzNTJFODFCNzY1IiB4bXBNTTpEb2N1bWVudElEPSJ4bXAuZGlkOjcwMkIzQTMzRTFEQTExRUE5QjRGQjQzNTJFODFCNzY1Ij4gPHhtcE1NOkRlcml2ZWRGcm9tIHN0UmVmOmluc3RhbmNlSUQ9InhtcC5paWQ6NzAyQjNBMzBFMURBMTFFQTlCNEZCNDM1MkU4MUI3NjUiIHN0UmVmOmRvY3VtZW50SUQ9InhtcC5kaWQ6NzAyQjNBMzFFMURBMTFFQTlCNEZCNDM1MkU4MUI3NjUiLz4gPC9yZGY6RGVzY3JpcHRpb24+IDwvcmRmOlJERj4gPC94OnhtcG1ldGE+IDw/eHBhY2tldCBlbmQ9InIiPz4/ZdnrAAAMsElEQVR42uyd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';
const freshConnectLogoPath = 'data:image/png;base64,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';

// Enhanced component with better styling and proper organization
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
  const { theme, isLoading: themeLoading } = useBookingTheme();
  
  // Logo handling state
  const [logoLoaded, setLogoLoaded] = useState(false);
  const [logoSrc, setLogoSrc] = useState('');
  
  // Get organization name from booking page
  const organizationName = bookingPage?.organizationName || bookingPage?.name?.split(' - ')[0] || 'Logistics';
  
  // Set document title
  useEffect(() => {
    document.title = `Book Appointment - ${organizationName} Dock Appointment Scheduler`;
  }, [organizationName]);
  
  // Get logo from server or use fallback
  useEffect(() => {
    if (bookingPage?.tenantId) {
      fetch(`/api/booking-pages/logo/${bookingPage.tenantId}`)
        .then(response => {
          if (!response.ok) {
            throw new Error('Logo not found');
          }
          return response.json();
        })
        .then(data => {
          if (data.logo) {
            setLogoSrc(data.logo);
            setLogoLoaded(true);
          } else {
            throw new Error('Logo data missing');
          }
        })
        .catch(error => {
          console.error(`Error loading logo: ${error.message}, using fallback`);
          // Select appropriate fallback logo
          if (bookingPage?.tenantId === 5 || 
              (organizationName && organizationName.includes('Fresh Connect'))) {
            setLogoSrc(freshConnectLogoPath);
          } else {
            setLogoSrc(hanzoLogoPath);
          }
          setLogoLoaded(true);
        });
    } else {
      // Default fallback
      if (organizationName && organizationName.includes('Fresh Connect')) {
        setLogoSrc(freshConnectLogoPath);
      } else {
        setLogoSrc(hanzoLogoPath);
      }
      setLogoLoaded(true);
    }
  }, [bookingPage?.tenantId, organizationName]);
  
  // Show loading state when loading theme or during form submission
  if (themeLoading || isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center p-8 max-w-md">
          <Loader2 className="h-10 w-10 animate-spin mx-auto mb-4" />
          <p className="text-lg font-medium">{isLoading ? 'Submitting your appointment...' : 'Loading booking system...'}</p>
        </div>
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
  
  // Calculate step progress
  const totalSteps = 3;
  const currentProgress = Math.min(((currentStep - 1) / totalSteps) * 100, 100);
  
  // Shared wrapper for all steps
  return (
    <div className="booking-wizard-container max-w-4xl mx-auto px-4 py-8 md:px-8">
      {/* Header Section */}
      <header className="booking-wizard-header mb-8 text-center">
        {/* Logo */}
        <div className="flex justify-center mb-6">
          {logoLoaded ? (
            <img 
              src={logoSrc}
              alt={`${organizationName} Logo`}
              className="h-24 md:h-32 w-auto object-contain"
            />
          ) : (
            <div className="h-24 md:h-32 w-full flex items-center justify-center">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
          )}
        </div>
        
        {/* Title */}
        <h1 className="text-2xl md:text-3xl font-bold mb-3 text-primary">
          {organizationName} Dock Appointment Scheduler
        </h1>
        
        {/* Dynamic welcome message from booking page content */}
        <div
          className="text-base md:text-lg text-gray-700 mb-6"
          dangerouslySetInnerHTML={{ 
            __html: bookingPage?.welcomeMessage || 
              "Please use this form to schedule your dock appointment." 
          }}
        />
        
        {/* Progress bar - only show for steps 1-3 */}
        {currentStep <= 3 && (
          <div className="mb-8">
            <div className="text-sm text-gray-600 mb-2">
              Step {currentStep} of {totalSteps}
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div 
                className="bg-primary h-2.5 rounded-full transition-all duration-300 ease-in-out" 
                style={{ width: `${currentProgress}%` }} 
              />
            </div>
          </div>
        )}
      </header>
      
      {/* Main content - step components */}
      <main className="bg-white rounded-lg shadow-md p-6 mb-8">
        {currentStep === 1 ? (
          <ServiceSelectionStepForm bookingPage={bookingPage} />
        ) : currentStep === 2 ? (
          <DateTimeSelectionStep bookingPage={bookingPage} />
        ) : currentStep === 3 ? (
          <CustomerInfoStep bookingPage={bookingPage} onSubmit={handleSubmit} />
        ) : (
          <ConfirmationStep bookingPage={bookingPage} confirmationCode={confirmationCode} />
        )}
      </main>
      
      {/* Footer with branding */}
      <footer className="text-center text-sm text-gray-500 mt-8">
        <p>Powered by <span className="font-semibold">Dock Optimizer</span></p>
      </footer>
    </div>
  );
}