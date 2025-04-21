import React, { useState, useEffect } from 'react';
import { useRoute } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DatePicker } from '@/components/ui/date-picker';
import { TimePicker } from '@/components/ui/time-picker';
import { Loader2 } from 'lucide-react';
import { format, addHours, isValid, parseISO } from 'date-fns';
import { toZonedTime, formatInTimeZone } from 'date-fns-tz';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { FileUpload } from '@/components/ui/file-upload';
import { BookingWizardProvider, useBookingWizard } from '@/contexts/BookingWizardContext';
import { BookingThemeProvider, useBookingTheme } from '@/contexts/BookingThemeContext';
import '../styles/booking-wizard.css';
import hanzoLogo from '@assets/hanzo logo.jpeg';

// Main component
export default function ExternalBooking() {
  // Get the slug from the URL
  const [_, params] = useRoute('/external/:slug');
  const slug = params?.slug || '';
  
  // Fetch booking page data
  const { 
    data: bookingPage, 
    isLoading: pageLoading, 
    error: pageError 
  } = useQuery({
    queryKey: [`/api/booking-pages/slug/${slug}`],
    enabled: !!slug,
  });
  
  if (pageLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }
  
  if (pageError || !bookingPage) {
    return (
      <div className="p-8 max-w-lg mx-auto">
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            We couldn't find the booking page you're looking for. Please check the URL and try again.
          </AlertDescription>
        </Alert>
      </div>
    );
  }
  
  // Return the booking page with the theme provider
  return (
    <BookingThemeProvider slug={slug}>
      <BookingWizardProvider>
        <BookingWizardContent bookingPage={bookingPage} />
      </BookingWizardProvider>
    </BookingThemeProvider>
  );
}

// The main content component that uses both contexts
function BookingWizardContent({ bookingPage }: { bookingPage: any }) {
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
  const [hanzoLogo, setHanzoLogo] = useState<string>("/assets/hanzo_logo.png");
  
  useEffect(() => {
    // Set the document title with the booking page name
    document.title = `Book Appointment - Hanzo Logistics Dock Appointment Scheduler`;
    
    // Attempt to load the Hanzo logo
    import("@assets/hanzo logo.jpeg")
      .then(logoModule => {
        setHanzoLogo(logoModule.default);
      })
      .catch(err => {
        console.error("Could not load Hanzo logo:", err);
      });
  }, []);
  
  // Show loading state when loading theme
  if (themeLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }
  
  // Function to handle form submission
  const handleSubmit = async () => {
    try {
      setIsLoading(true);
      
      // Build the schedule data
      const scheduleData = {
        ...bookingData,
        bookingPageId: bookingPage.id,
        status: 'pending',
        // Convert dates to UTC for server storage
        startTime: bookingData.startTime,
        endTime: bookingData.endTime,
        createdVia: 'external',
      };
      
      // Submit to API
      const response = await fetch('/api/schedules/external', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(scheduleData),
      });
      
      if (!response.ok) {
        throw new Error('Failed to create appointment');
      }
      
      const data = await response.json();
      
      // Store the confirmation code
      setConfirmationCode(data.confirmationCode);
      
      // Mark as created
      setAppointmentCreated(true);
      
      // Move to confirmation step
      setCurrentStep(4);
    } catch (error) {
      console.error('Error creating appointment:', error);
      alert('There was an error creating your appointment. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Determine which step to show
  let stepContent;
  
  if (currentStep === 1) {
    stepContent = <ServiceSelectionStep bookingPage={bookingPage} />;
  } else if (currentStep === 2) {
    stepContent = <DateTimeSelectionStep bookingPage={bookingPage} />;
  } else if (currentStep === 3) {
    stepContent = <CustomerInfoStep bookingPage={bookingPage} onSubmit={handleSubmit} />;
  } else if (currentStep === 4) {
    stepContent = <ConfirmationStep bookingPage={bookingPage} confirmationCode={confirmationCode} />;
  }
  
  // Calculate progress percentage based on current step
  const totalSteps = 3; // We have 3 steps (confirmation is not counted in progress)
  const progressPercentage = Math.min(((currentStep - 1) / totalSteps) * 100, 100);
  
  return (
    <div className="booking-wizard-container">
      <div className="booking-wizard-header">
        <img 
          src={hanzoLogo} 
          alt="Hanzo Logistics Logo" 
          className="booking-wizard-logo"
        />
        <h1 className="booking-wizard-title">Hanzo Logistics Dock Appointment Scheduler</h1>
        <p className="booking-wizard-subtitle">
          Please use this form to pick the type of Dock Appointment that you need at Hanzo Logistics.
        </p>
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

// Step 1: Service Selection
function ServiceSelectionStep({ bookingPage }: { bookingPage: any }) {
  const { bookingData, updateBookingData, setCurrentStep } = useBookingWizard();
  
  // Fetch facilities data
  const { 
    data: facilities, 
    isLoading: facilitiesLoading 
  } = useQuery({
    queryKey: ['/api/facilities'],
  });
  
  // Fetch appointment types
  const { 
    data: appointmentTypes, 
    isLoading: typesLoading 
  } = useQuery({
    queryKey: ['/api/appointment-types'],
  });
  
  // Handle next button click
  const handleNext = () => {
    if (!bookingData.facilityId || !bookingData.appointmentTypeId) {
      alert('Please select both a facility and appointment type.');
      return;
    }
    
    setCurrentStep(2);
  };
  
  if (facilitiesLoading || typesLoading) {
    return (
      <div className="flex justify-center my-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }
  
  // Filter facilities based on booking page configuration
  const availableFacilities = bookingPage.facilities
    ? facilities?.filter((f: any) => 
        (bookingPage.facilities as number[]).includes(f.id)
      )
    : facilities;
  
  // Group appointment types by facility for easier selection
  const getFacilityAppointmentTypes = (facilityId: number) => {
    return appointmentTypes?.filter((type: any) => 
      type.facilityId === facilityId
    ) || [];
  };
  
  return (
    <div className="booking-form-section">
      <div className="prose max-w-none mb-6">
        <p className="text-sm">
          Please use this form to pick the type of Dock Appointment that
          you need at Hanzo Logistics. For support using this page,
          please <a href="#" className="text-blue-600 hover:underline">check out this video</a>.
        </p>
        
        <p className="text-sm mt-4 font-semibold">
          Effective August 1st, 2023, MC Numbers are required for all
          incoming and outgoing shipments. This is to protect the
          security of our customer's shipments and reduce the risk of
          fraud.
        </p>
      </div>
      
      <div className="booking-form-field">
        <Label className="booking-label font-semibold" htmlFor="facilitySelect">
          Dock Appointment Type<span className="text-red-500">*</span>
        </Label>
        <Select
          value={bookingData.appointmentTypeId?.toString() || ''}
          onValueChange={(value) => {
            const typeId = parseInt(value, 10);
            const selectedType = appointmentTypes?.find(t => t.id === typeId);
            
            if (selectedType) {
              updateBookingData({ 
                appointmentTypeId: typeId,
                facilityId: selectedType.facilityId
              });
            }
          }}
        >
          <SelectTrigger id="facilitySelect">
            <SelectValue placeholder="Select Dock Appointment Type" />
          </SelectTrigger>
          <SelectContent>
            {appointmentTypes && Array.isArray(appointmentTypes) && appointmentTypes.map((type: any) => {
              // Find the facility for this appointment type
              const facility = facilities?.find((f: any) => f.id === type.facilityId);
              
              if (!facility) return null;
              
              return (
                <SelectItem 
                  key={type.id} 
                  value={type.id.toString()}
                >
                  {type.name} ({type.duration} min) - {facility.name}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>
      
      <div className="booking-form-field">
        <Label className="booking-label font-semibold" htmlFor="pickupDropoff">
          Pickup or Dropoff<span className="text-red-500">*</span>
        </Label>
        <Select
          value={bookingData.type || ''}
          onValueChange={(value) => updateBookingData({ type: value })}
          disabled={!bookingData.appointmentTypeId}
        >
          <SelectTrigger id="pickupDropoff">
            <SelectValue placeholder="Select Pickup or Dropoff" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pickup">Pickup</SelectItem>
            <SelectItem value="dropoff">Dropoff</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      {/* Facility information display */}
      {bookingData.facilityId && (
        <div className="mt-6 p-4 bg-gray-50 rounded-lg border text-sm">
          <h3 className="font-semibold mb-2">HANZO LOGISTICS INC.</h3>
          <p className="mb-2">Select from the following locations:</p>
          <div className="space-y-1">
            {facilities && Array.isArray(facilities) && facilities.map((facility: any) => (
              <div 
                key={facility.id} 
                className={`flex ${facility.id === bookingData.facilityId ? 'font-semibold' : ''}`}
              >
                {facility.id === bookingData.facilityId && (
                  <div className="mr-2">✓</div>
                )}
                <div className={facility.id === bookingData.facilityId ? '' : 'ml-6'}>
                  {facility.name} {facility.address}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4">Please arrive 15 minutes before your appointment and check in at the office.</p>
        </div>
      )}
      
      <div className="booking-nav-buttons">
        <div></div> {/* Empty div for spacing */}
        <Button 
          className="booking-button" 
          onClick={handleNext}
          disabled={!bookingData.facilityId || !bookingData.appointmentTypeId || !bookingData.type}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

// Step 2: Date and Time Selection
// Define the AvailabilitySlot interface
interface AvailabilitySlot {
  time: string;
  available: boolean;
  reason?: string;
  remaining: number;
}

function DateTimeSelectionStep({ bookingPage }: { bookingPage: any }) {
  const { bookingData, updateBookingData, setCurrentStep } = useBookingWizard();
  const [availableTimes, setAvailableTimes] = useState<string[]>([]);
  const [availabilitySlots, setAvailabilitySlots] = useState<AvailabilitySlot[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    bookingData.startTime ? new Date(bookingData.startTime) : undefined
  );
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [loading, setLoading] = useState(false);
  
  // Get the appointment type to determine duration
  const { data: appointmentTypes } = useQuery({
    queryKey: ['/api/appointment-types'],
  });
  
  // Get the facility to determine timezone
  const { data: facilities } = useQuery({
    queryKey: ['/api/facilities'],
  });
  
  // Get the selected appointment type
  const selectedAppointmentType = appointmentTypes?.find(
    (type: any) => type.id === bookingData.appointmentTypeId
  );
  
  // Get the selected facility
  const selectedFacility = facilities?.find(
    (facility: any) => facility.id === bookingData.facilityId
  );
  
  // When date changes, fetch available times
  useEffect(() => {
    if (!selectedDate || !bookingData.facilityId || !bookingData.appointmentTypeId) return;
    
    const fetchAvailableTimes = async () => {
      try {
        setLoading(true);
        setAvailableTimes([]); // Clear previous times while loading
        
        // Format the date for the API
        const dateStr = format(selectedDate, 'yyyy-MM-dd');
        
        console.log(`Fetching available times for date=${dateStr}, facilityId=${bookingData.facilityId}, typeId=${bookingData.appointmentTypeId}`);
        
        // Call the API to get available times using the standardized parameter name (typeId)
        const response = await fetch(`/api/availability?date=${dateStr}&facilityId=${bookingData.facilityId}&typeId=${bookingData.appointmentTypeId}`);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`API Error (${response.status}):`, errorText);
          throw new Error(`Failed to fetch available times: ${response.status} ${errorText}`);
        }
        
        const data = await response.json();
        console.log("Available times response:", data);
        
        // Log the response data structure in detail
        console.log('[EXTERNAL FLOW] API response data structure:', JSON.stringify(data, null, 2));
        console.log('[EXTERNAL FLOW] Checking for remaining slots in response:', 
          data.slots ? 'has slots array with details' : 'only has simple availableTimes array');
          
        // Store all availability slot data if available
        if (data.slots && Array.isArray(data.slots)) {
          console.log('[EXTERNAL FLOW] Using enhanced slot data with capacity information');
          // Filter for available slots and sort by time
          const availableSlots = data.slots
            .filter(slot => slot.available)
            .sort((a, b) => a.time.localeCompare(b.time));
          setAvailabilitySlots(availableSlots);
          
          // Set the available times for backward compatibility
          const times = availableSlots.map(slot => slot.time);
          setAvailableTimes(times);
        } else {
          // Fallback to old format if slots aren't available
          console.log('[EXTERNAL FLOW] Using backward compatible simple time array');
          const sortedTimes = [...(data.availableTimes || [])].sort();
          setAvailableTimes(sortedTimes);
          
          // Create basic slots with default remaining = 1
          const basicSlots = sortedTimes.map(time => ({
            time,
            available: true,
            remaining: 1
          }));
          setAvailabilitySlots(basicSlots);
        }
        
        // If we previously had a selected time on this date, check if it's still available
        if (bookingData.startTime) {
          const existingTimeString = format(new Date(bookingData.startTime), 'HH:mm');
          const times = availabilitySlots.map(slot => slot.time);
          if (!times.includes(existingTimeString)) {
            // Previous time is no longer available
            setSelectedTime('');
          } else {
            setSelectedTime(existingTimeString);
          }
        } else {
          // No time was previously selected
          setSelectedTime('');
        }
        
        if (availabilitySlots.length === 0) {
          console.log("No available times for selected date");
        }
      } catch (error) {
        console.error('Error fetching available times:', error);
        setAvailableTimes([]);
        setSelectedTime('');
      } finally {
        setLoading(false);
      }
    };
    
    fetchAvailableTimes();
  }, [selectedDate, bookingData.facilityId, bookingData.appointmentTypeId]);
  
  // When time changes, update the bookingData
  useEffect(() => {
    if (!selectedDate || !selectedTime || !selectedAppointmentType) return;
    
    // Parse the selected time
    const [hours, minutes] = selectedTime.split(':').map(Number);
    
    // Create a new date with the selected date and time
    const startDate = new Date(selectedDate);
    startDate.setHours(hours, minutes, 0, 0);
    
    // Calculate the end time based on appointment duration
    const endDate = addHours(startDate, selectedAppointmentType.duration / 60);
    
    // Update the booking data
    updateBookingData({
      startTime: startDate,
      endTime: endDate,
      timezone: selectedFacility?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
  }, [selectedDate, selectedTime, selectedAppointmentType, selectedFacility]);
  
  // Handle date change
  const handleDateChange = (date: Date | undefined) => {
    setSelectedDate(date);
    setSelectedTime(''); // Clear time when date changes
  };
  
  // Handle time selection
  const handleTimeChange = (value: string) => {
    setSelectedTime(value);
  };
  
  // Handle back button
  const handleBack = () => {
    setCurrentStep(1);
  };
  
  // Handle next button
  const handleNext = () => {
    if (!bookingData.startTime || !bookingData.endTime) {
      alert('Please select both a date and time.');
      return;
    }
    
    setCurrentStep(3);
  };
  
  return (
    <div className="booking-form-section">
      <h2 className="booking-form-section-title">Select Date and Time</h2>
      
      <div className="booking-form-field">
        <Label className="booking-label">Date</Label>
        <div className="booking-date-picker">
          <DatePicker
            date={selectedDate}
            onDateChange={handleDateChange}
            disablePastDates
          />
        </div>
      </div>
      
      <div className="booking-form-field">
        <Label className="booking-label">Available Times</Label>
        {loading ? (
          <div className="flex justify-center my-4">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : selectedDate ? (
          availableTimes.length > 0 ? (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {availabilitySlots.map((slot) => {
                // Create a date object from the time string for display formatting
                const [hours, minutes] = slot.time.split(':').map(Number);
                const timeObj = new Date();
                timeObj.setHours(hours, minutes, 0, 0);
                
                // Format for display (e.g., "9:30 AM")
                const displayTime = format(timeObj, 'h:mm a');
                
                console.log('[EXTERNAL FLOW] rendering time slot:', slot.time, 'display:', displayTime, 'capacity:', slot.remaining);
                
                // Get the selected appointment type to check if we should show remaining slots
                const selectedType = appointmentTypes?.find(
                  (type: any) => type.id === bookingData.appointmentTypeId
                );
                
                // Display slots with remaining capacity indicator if the appointment type is configured to show them
                return (
                  <Button
                    key={slot.time}
                    type="button"
                    variant={selectedTime === slot.time ? "default" : "outline"}
                    className={`relative ${selectedTime === slot.time ? "booking-button" : "booking-button-secondary"}`}
                    onClick={() => handleTimeChange(slot.time)}
                  >
                    {displayTime}
                    
                    {/* Show capacity badge if appointment type is configured to show remaining slots */}
                    {selectedType?.showRemainingSlots && (
                      <span className="absolute top-0 right-0 -mt-2 -mr-2 flex h-5 w-5 items-center justify-center rounded-full bg-green-500 text-xs font-bold text-white">
                        {slot.remaining}
                      </span>
                    )}
                  </Button>
                );
              })}
            </div>
          ) : (
            <Alert>
              <AlertTitle>No Available Times</AlertTitle>
              <AlertDescription>
                There are no available times for the selected date. Please choose another date.
              </AlertDescription>
            </Alert>
          )
        ) : (
          <Alert>
            <AlertDescription>
              Please select a date to see available times.
            </AlertDescription>
          </Alert>
        )}
      </div>
      
      <div className="booking-nav-buttons">
        <Button className="booking-button-secondary" onClick={handleBack}>
          Back
        </Button>
        <Button 
          className="booking-button" 
          onClick={handleNext}
          disabled={!bookingData.startTime || !bookingData.endTime}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

// Step 3: Customer Information
function CustomerInfoStep({ bookingPage, onSubmit }: { bookingPage: any; onSubmit: () => Promise<void> }) {
  const { bookingData, updateBookingData, setCurrentStep, isLoading } = useBookingWizard();
  
  // Get the custom questions if any
  const { data: customQuestions } = useQuery({
    queryKey: [`/api/appointment-types/${bookingData.appointmentTypeId}/questions`],
    enabled: !!bookingData.appointmentTypeId,
  });
  
  // Handle back button
  const handleBack = () => {
    setCurrentStep(2);
  };
  
  // Handle field changes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    updateBookingData({
      [e.target.name]: e.target.value
    });
  };
  
  // Handle custom field changes
  const handleCustomFieldChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>, questionId: number) => {
    updateBookingData({
      customFields: {
        ...bookingData.customFields,
        [questionId]: e.target.value
      }
    });
  };
  
  // Handle file upload
  const handleFileChange = (file: File | null) => {
    if (!file) return;
    
    // Here you would typically upload the file to your server
    // and store the reference in the booking data
    console.log('File selected:', file.name);
    
    // For demonstration, we're just storing the file object
    // In a real implementation, you'd use something like FormData to upload it
    updateBookingData({
      bolFile: file
    });
  };
  
  return (
    <div className="booking-form-section">
      <h2 className="booking-form-section-title">Customer Information</h2>
      
      <div className="booking-form-field">
        <Label className="booking-label" htmlFor="companyName">Company Name</Label>
        <Input
          id="companyName"
          name="companyName"
          className="booking-input"
          value={bookingData.companyName || ''}
          onChange={handleChange}
          required
        />
      </div>
      
      <div className="booking-form-field">
        <Label className="booking-label" htmlFor="contactName">Contact Name</Label>
        <Input
          id="contactName"
          name="contactName"
          className="booking-input"
          value={bookingData.contactName || ''}
          onChange={handleChange}
          required
        />
      </div>
      
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="booking-form-field">
          <Label className="booking-label" htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            className="booking-input"
            value={bookingData.email || ''}
            onChange={handleChange}
            required
          />
        </div>
        
        <div className="booking-form-field">
          <Label className="booking-label" htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            className="booking-input"
            value={bookingData.phone || ''}
            onChange={handleChange}
            required
          />
        </div>
      </div>
      
      <div className="booking-form-field">
        <Label className="booking-label" htmlFor="customerRef">Order/Reference Number</Label>
        <Input
          id="customerRef"
          name="customerRef"
          className="booking-input"
          value={bookingData.customerRef || ''}
          onChange={handleChange}
        />
      </div>
      
      <h2 className="booking-form-section-title mt-8">Vehicle Information</h2>
      
      <div className="booking-form-field">
        <Label className="booking-label" htmlFor="carrierName">Carrier Name</Label>
        <Input
          id="carrierName"
          name="carrierName"
          className="booking-input"
          value={bookingData.carrierName || ''}
          onChange={handleChange}
        />
      </div>
      
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="booking-form-field">
          <Label className="booking-label" htmlFor="driverName">Driver Name</Label>
          <Input
            id="driverName"
            name="driverName"
            className="booking-input"
            value={bookingData.driverName || ''}
            onChange={handleChange}
          />
        </div>
        
        <div className="booking-form-field">
          <Label className="booking-label" htmlFor="driverPhone">Driver Phone</Label>
          <Input
            id="driverPhone"
            name="driverPhone"
            type="tel"
            className="booking-input"
            value={bookingData.driverPhone || ''}
            onChange={handleChange}
          />
        </div>
      </div>
      
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="booking-form-field">
          <Label className="booking-label" htmlFor="truckNumber">Truck Number</Label>
          <Input
            id="truckNumber"
            name="truckNumber"
            className="booking-input"
            value={bookingData.truckNumber || ''}
            onChange={handleChange}
          />
        </div>
        
        <div className="booking-form-field">
          <Label className="booking-label" htmlFor="trailerNumber">Trailer Number</Label>
          <Input
            id="trailerNumber"
            name="trailerNumber"
            className="booking-input"
            value={bookingData.trailerNumber || ''}
            onChange={handleChange}
          />
        </div>
      </div>
      
      {/* File Upload */}
      <div className="booking-form-field">
        <Label className="booking-label">Bill of Lading (Optional)</Label>
        <FileUpload
          onFileChange={handleFileChange}
          acceptedFileTypes="application/pdf,image/*"
          maxSizeMB={5}
        />
      </div>
      
      <div className="booking-form-field">
        <Label className="booking-label" htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          name="notes"
          className="booking-input"
          value={bookingData.notes || ''}
          onChange={handleChange}
        />
      </div>
      
      {/* Custom questions if any */}
      {customQuestions && customQuestions.length > 0 && (
        <>
          <h2 className="booking-form-section-title mt-8">Additional Information</h2>
          
          {customQuestions.map((question: any) => (
            <div key={question.id} className="booking-form-field">
              <Label className="booking-label" htmlFor={`custom-${question.id}`}>
                {question.questionText} {question.isRequired && <span className="text-red-500">*</span>}
              </Label>
              
              {question.fieldType === 'text' ? (
                <Input
                  id={`custom-${question.id}`}
                  className="booking-input"
                  value={bookingData.customFields[question.id] || ''}
                  onChange={(e) => handleCustomFieldChange(e, question.id)}
                  required={question.isRequired}
                />
              ) : question.fieldType === 'textarea' ? (
                <Textarea
                  id={`custom-${question.id}`}
                  className="booking-input"
                  value={bookingData.customFields[question.id] || ''}
                  onChange={(e) => handleCustomFieldChange(e, question.id)}
                  required={question.isRequired}
                />
              ) : question.fieldType === 'select' ? (
                <Select
                  value={bookingData.customFields[question.id] || ''}
                  onValueChange={(value) => {
                    updateBookingData({
                      customFields: {
                        ...bookingData.customFields,
                        [question.id]: value
                      }
                    })
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select an option" />
                  </SelectTrigger>
                  <SelectContent>
                    {question.options?.split(',').map((option: string) => (
                      <SelectItem key={option.trim()} value={option.trim()}>
                        {option.trim()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null}
            </div>
          ))}
        </>
      )}
      
      <div className="booking-nav-buttons">
        <Button className="booking-button-secondary" onClick={handleBack} disabled={isLoading}>
          Back
        </Button>
        <Button 
          className="booking-button" 
          onClick={onSubmit}
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Submitting...
            </>
          ) : (
            'Book Appointment'
          )}
        </Button>
      </div>
    </div>
  );
}

// Step 4: Confirmation
function ConfirmationStep({ bookingPage, confirmationCode }: { bookingPage: any; confirmationCode: string | null }) {
  const { bookingData, resetBookingData } = useBookingWizard();
  
  // Format the appointment date and time for display
  const formatAppointmentTime = () => {
    if (!bookingData.startTime || !bookingData.endTime) return '';
    
    const start = new Date(bookingData.startTime);
    const end = new Date(bookingData.endTime);
    
    const dateStr = format(start, 'EEEE, MMMM d, yyyy');
    const timeStr = `${format(start, 'h:mm a')} - ${format(end, 'h:mm a')}`;
    
    return `${dateStr} | ${timeStr}`;
  };
  
  return (
    <div className="booking-form-section">
      <Card className="border-green-500 bg-green-50">
        <CardHeader className="pb-2">
          <CardTitle className="text-green-700">Appointment Confirmed!</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-green-700 mb-4">
            Your appointment has been successfully scheduled. Please save your confirmation code for reference.
          </p>
          
          <div className="bg-white p-4 rounded-md border border-gray-200 mb-6">
            <div className="text-gray-500 text-sm">Confirmation Code</div>
            <div className="text-xl font-bold">{confirmationCode}</div>
          </div>
          
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold">Appointment Details</h3>
              <p>{formatAppointmentTime()}</p>
              <p className="text-sm text-gray-500">
                Timezone: {bookingData.timezone}
              </p>
            </div>
            
            <div>
              <h3 className="font-semibold">Contact Information</h3>
              <p>{bookingData.contactName} | {bookingData.companyName}</p>
              <p>{bookingData.email} | {bookingData.phone}</p>
            </div>
            
            {bookingData.carrierName && (
              <div>
                <h3 className="font-semibold">Vehicle Information</h3>
                <p>Carrier: {bookingData.carrierName}</p>
                {bookingData.driverName && (
                  <p>Driver: {bookingData.driverName} {bookingData.driverPhone ? `| ${bookingData.driverPhone}` : ''}</p>
                )}
                {(bookingData.truckNumber || bookingData.trailerNumber) && (
                  <p>
                    {bookingData.truckNumber && `Truck: ${bookingData.truckNumber}`}
                    {bookingData.truckNumber && bookingData.trailerNumber && ' | '}
                    {bookingData.trailerNumber && `Trailer: ${bookingData.trailerNumber}`}
                  </p>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      
      <div className="mt-8 text-center">
        <Button
          className="booking-button"
          onClick={() => {
            resetBookingData();
            window.location.reload();
          }}
        >
          Book Another Appointment
        </Button>
      </div>
    </div>
  );
}