import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { BookingWizardProvider, useBookingWizard } from '@/contexts/BookingWizardContext';
import { BookingThemeProvider } from '@/hooks/use-booking-theme';
import { Loader2, XCircle, CheckCircle, Upload, FileCheck, Mail, AlertCircle, QrCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { DatePicker } from '@/components/ui/date-picker';
import { Textarea } from '@/components/ui/textarea';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, addDays, isSunday, isSaturday, isMonday, isTuesday, isWednesday, isThursday, isFriday, getDay, isBefore, startOfDay, isSameDay } from 'date-fns';
import dockOptimizerLogo from '@/assets/dock_optimizer_logo.jpg';
import { getUserTimeZone } from '@/lib/timezone-utils';
import { safeToString } from '@/lib/utils';
import { Form } from '@/components/ui/form';
import { StandardQuestionsFormFields } from '@/components/shared/standard-questions-form-fields';

const serviceSelectionSchema = z.object({
  facilityId: z.coerce.number().min(1, "Please select a facility"),
  appointmentTypeId: z.coerce.number().min(1, "Please select a service type"),
});

export default function ExternalBooking({ slug }: { slug: string }) {
  const { data: bookingPage, isLoading, error } = useQuery({
    queryKey: [`/api/booking-pages/slug/${slug}`],
    queryFn: async () => {
      const res = await fetch(`/api/booking-pages/slug/${slug}`);
      if (!res.ok) throw new Error('Failed to fetch booking page');
      
      // Get the basic booking page data
      const data = await res.json();
      
      // Process appointment types to add showRemainingSlots property
      if (data?.appointmentTypes && Array.isArray(data.appointmentTypes)) {
        data.appointmentTypes = data.appointmentTypes.map((type: any) => ({
          ...type,
          showRemainingSlots: type.showRemainingSlots || false
        }));
      }
      
      return data;
    }
  });

  if (isLoading) return <Loader2 className="animate-spin" />;
  if (error || !bookingPage) return <div className="text-red-500">Invalid booking link. Please check your URL.</div>;

  return (
    <BookingThemeProvider
      slug={slug}
    >
      <div className="min-h-screen bg-gradient-to-b from-primary/20 to-background">
        <div className="container mx-auto py-8 px-4">
          <div className="bg-white rounded-lg shadow-lg p-6 mx-auto max-w-4xl">
            {/* Header with logo */}
            <div className="flex items-center mb-6">
              {bookingPage.useOrganizationLogo ? (
                <img 
                  src={`/api/admin/organizations/${bookingPage.organizationId}/logo`} 
                  alt={`${bookingPage.name} logo`} 
                  className="h-16 mr-4"
                  onError={(e) => {
                    // Fallback to booking page logo or default
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = bookingPage.logoUrl ? 
                      `/api/booking-pages/logo/${bookingPage.id}` : dockOptimizerLogo;
                  }}
                />
              ) : bookingPage.logoUrl ? (
                <img 
                  src={`/api/booking-pages/logo/${bookingPage.id}`} 
                  alt={`${bookingPage.name} logo`} 
                  className="h-16 mr-4" 
                />
              ) : (
                <img 
                  src={dockOptimizerLogo} 
                  alt="Dock Optimizer" 
                  className="h-16 mr-4" 
                />
              )}
              <div>
                <h1 className="text-2xl font-bold">{bookingPage.name} Dock Appointment Scheduler</h1>
                <p className="text-muted-foreground">
                  Please use this form to pick the type of Dock Appointment that
                  you need at {bookingPage.name}.
                </p>
              </div>
            </div>
            
            {/* Main booking wizard */}
            <BookingWizardContent 
              bookingPage={bookingPage}
              slug={slug}
            />
          </div>
        </div>
      </div>
    </BookingThemeProvider>
  );
}

function BookingWizardContent({ bookingPage, slug }: { bookingPage: any, slug: string }) {
  const [step, setStep] = useState(1);
  const [bookingData, setBookingData] = useState<{
    facilityId?: number;
    appointmentTypeId?: number;
    date?: string;
    time?: string;
    timezone?: string;
  }>({
    timezone: getUserTimeZone()
  });
  const [confirmationCode, setConfirmationCode] = useState<string | null>(null);
  const [bookingDetails, setBookingDetails] = useState<Record<string, any>>({});
  const [bolFile, setBolFile] = useState<File | null>(null);
  const [isProcessingBol, setIsProcessingBol] = useState(false);
  const [bolData, setBolData] = useState<any | null>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);
  
  // Setup form for standard questions
  const form = useForm({
    defaultValues: {
      customFields: {}
    }
  });
  
  // Fetch standards questions based on appointment type with comprehensive error handling
  const { data: standardQuestions, isLoading: loadingQuestions } = useQuery({
    queryKey: [`/api/standard-questions/appointment-type/${bookingData.appointmentTypeId || 'unknown'}`],
    queryFn: async () => {
      if (!bookingData.appointmentTypeId) {
        console.log("Cannot fetch standard questions: appointment type ID is missing");
        return [];
      }
      try {
        console.log(`Fetching standard questions for appointment type ${bookingData.appointmentTypeId}`);
        const res = await fetch(`/api/standard-questions/appointment-type/${bookingData.appointmentTypeId}`);
        
        if (!res.ok) {
          console.warn(`Failed to load standard questions: ${res.status}`);
          return [];
        }
        
        const data = await res.json();
        
        // Validate data to ensure it's what we expect
        if (!Array.isArray(data)) {
          console.warn("Standard questions API did not return an array:", typeof data);
          return [];
        }
        
        console.log("[StandardQuestions] Loaded", data.length, "questions for appointment type", bookingData.appointmentTypeId);
        
        // Transform data if needed to match expected format
        return data.map((q) => ({
          id: q.id,
          label: q.label || '',
          fieldKey: q.fieldKey || `field_${q.id}`,
          fieldType: q.fieldType || 'TEXT',
          required: q.required || false,
          included: q.included || false,
          orderPosition: q.orderPosition || q.order || 0,
          appointmentTypeId: q.appointmentTypeId || bookingData.appointmentTypeId,
          options: q.options || []
        }));
      } catch (error) {
        console.error("Error fetching standard questions:", error);
        return [];
      }
    },
    enabled: !!bookingData.appointmentTypeId && step === 3,
    staleTime: 60000, // Cache results for 1 minute
    retry: 1 // Only retry once to avoid excessive requests
  });
  
  // Fetch custom questions based on booking page
  const { data: customQuestions, isLoading: loadingCustomQuestions } = useQuery({
    queryKey: [`/api/booking-pages/${bookingPage?.id || 'unknown'}/questions`],
    queryFn: async () => {
      if (!bookingPage?.id) {
        console.log("Cannot fetch custom questions: booking page ID is missing");
        return [];
      }
      try {
        console.log(`Fetching custom questions for booking page ${bookingPage.id}`);
        const res = await fetch(`/api/booking-pages/${bookingPage.id}/questions`);
        
        if (!res.ok) {
          console.warn(`Failed to load custom questions: ${res.status}`);
          return [];
        }
        
        const data = await res.json();
        
        // Validate data to ensure it's what we expect
        if (!Array.isArray(data)) {
          console.warn("Custom questions API did not return an array:", typeof data);
          return [];
        }
        
        console.log("[CustomQuestions] Loaded", data.length, "questions for booking page", bookingPage.id);
        
        // Transform data to match expected format for StandardQuestionsFormFields
        return data.map((q) => ({
          id: q.id,
          label: q.label || '',
          fieldKey: q.fieldKey || `custom_${q.id}`,
          fieldType: q.fieldType || 'TEXT',
          required: q.required || false,
          included: q.included !== false, // Default to true if not specified
          orderPosition: q.orderPosition || q.order || 100, // Custom questions come after standard ones
          appointmentTypeId: q.appointmentTypeId || 0,
          options: q.options || []
        }));
      } catch (error) {
        console.error("Error fetching custom questions:", error);
        return [];
      }
    },
    enabled: step === 3 && !!bookingPage?.id,
    staleTime: 60000, // Cache results for 1 minute
    retry: 1 // Only retry once to avoid excessive requests
  });

  // Create booking mutation with enhanced error handling and BOL handling
  const bookingMutation = useMutation({
    mutationFn: async (data: any) => {
      console.log("Starting booking creation with payload:", data);
      
      // Add BOL document information if available
      if (bolData) {
        data.bolFileUploaded = true;
        data.bolData = {
          documentId: bolData.documentId || null,
          fileUrl: bolData.fileUrl || null,
          fileName: bolData.fileName || null,
          extractedData: bolData.extractedFields || bolData.metadata || {},
          uploadedAt: bolData.uploadedAt || new Date().toISOString()
        };
        
        // Add extracted BOL number if available
        if (bolData.extractedFields?.bolNumber || bolData.metadata?.bolNumber) {
          data.bolNumber = bolData.extractedFields?.bolNumber || bolData.metadata?.bolNumber;
        }
      }
      
      try {
        const res = await fetch(`/api/booking-pages/book/${slug}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
        });
        
        let responseData;
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          responseData = await res.json();
        } else {
          responseData = { message: await res.text() };
        }
        
        if (!res.ok) {
          console.error("Booking error response:", responseData);
          throw new Error(responseData.message || 'Failed to create booking');
        }
        
        return responseData;
      } catch (error) {
        console.error("Booking creation exception:", error);
        throw error;
      }
    },
    onSuccess: async (data) => {
      // Store confirmation code and go to success step
      console.log("Booking created successfully:", data);
      
      // Use the standardized confirmation code from the response
      const confirmationCode = data.confirmationCode || data.code || `HZL-${Math.floor(100000 + Math.random() * 900000)}`;
      setConfirmationCode(confirmationCode);
      
      // Link BOL document to the created appointment if available
      let bolLinked = false;
      if (bolFile && bolData && bolData.documentId && data.schedule?.id) {
        try {
          console.log("Linking BOL document to appointment...", {
            documentId: bolData.documentId,
            scheduleId: data.schedule.id
          });
          
          // Try to link the existing BOL document to the appointment
          const linkResponse = await fetch('/api/bol-upload/link', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              documentId: bolData.documentId,
              scheduleId: data.schedule.id
            }),
          });
          
          if (linkResponse.ok) {
            const linkResult = await linkResponse.json();
            console.log("BOL document linked successfully:", linkResult);
            bolLinked = true;
          } else {
            console.warn("Failed to link BOL document, trying re-upload with scheduleId");
            
            // Fallback: Re-upload the file with scheduleId
            const formData = new FormData();
            formData.append('bolFile', bolFile);
            formData.append('scheduleId', String(data.schedule.id));
            
            const reuploadResponse = await fetch('/api/bol-upload/upload', {
              method: 'POST',
              body: formData,
            });
            
            if (reuploadResponse.ok) {
              const reuploadResult = await reuploadResponse.json();
              console.log("BOL document re-uploaded with scheduleId:", reuploadResult);
              bolLinked = reuploadResult.appointmentLinked || false;
            }
          }
        } catch (error) {
          console.error("Error linking BOL document:", error);
        }
      }
      
      // Store additional booking details for the confirmation page
      setBookingDetails({
        ...bookingDetails,
        confirmationCode,
        id: data.schedule?.id,
        scheduleId: data.schedule?.id, // Ensure scheduleId is available
        emailSent: data.emailSent || false,
        startTime: data.schedule?.startTime,
        endTime: data.schedule?.endTime,
        facilityName: data.facilityName || bookingDetails.facilityName,
        appointmentTypeName: data.appointmentTypeName || bookingDetails.appointmentTypeName,
        bolUploaded: !!bolData && (bolLinked || !!bolData.documentId)
      });
      
      setStep(4); // Move to confirmation step
    },
    onError: (error: any) => {
      console.error("Booking error:", error);
      // Stay on the same step and show error message in the UI
      setBookingError(error.message || "Failed to create your appointment. Please try again.");
    }
  });
  
  // Function to handle BOL file upload and processing
  const handleBolUpload = async (file: File) => {
    if (!file) return;
    
    setIsProcessingBol(true);
    setBolFile(file);
    
    const formData = new FormData();
    formData.append('bolFile', file); // Changed to 'bolFile' for the BOL-specific endpoints
    
    // Add compression flag to request
    formData.append('compress', 'true');
    
    try {
      console.log('Uploading BOL document...');
      
      // Try to use the updated BOL upload endpoint first
      const response = await fetch('/api/bol-upload/upload', {
        method: 'POST',
        body: formData,
      }).catch(error => {
        console.warn('Primary BOL upload endpoint failed:', error);
        // Fallback to secondary BOL endpoint if primary fails
        return fetch('/api/bol-ocr/upload', {
          method: 'POST',
          body: formData,
        }).catch(secondError => {
          console.warn('Secondary BOL endpoint failed:', secondError);
          // Last resort fallback to generic document processing
          return fetch('/api/document-processing', {
            method: 'POST',
            body: formData,
          });
        });
      });
      
      if (!response.ok) {
        throw new Error(`Failed to process BOL document: ${response.status} - ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('BOL upload successful. Extracted data:', data);
      
      // Store both raw response and the BOL data for later use
      setBolData({
        ...data,
        fileUrl: data.fileUrl || null,
        fileName: data.filename || file.name,
        fileSize: data.size || file.size,
        documentId: data.documentId || null, // Important: Save document ID for later linking
        uploadedAt: new Date().toISOString()
      });
      
      // More intelligent pre-filling of form fields with extracted BOL data
      if (data && (data.extractedFields || data.metadata || data.ocrData)) {
        // Normalize the data structure (handle multiple possible formats)
        const extractedData = data.extractedFields || data.metadata || (data.ocrData && data.ocrData.metadata) || {};
        
        // Try to extract facility/location information
        if (extractedData.toAddress || extractedData.shipToAddress) {
          const addressText = extractedData.toAddress || extractedData.shipToAddress || '';
          
          // Try to match address to a facility
          const matchingFacility = facilities.find((facility: any) => 
            addressText.toLowerCase().includes(facility.name.toLowerCase()) ||
            (facility.address && addressText.toLowerCase().includes(facility.address.toLowerCase()))
          );
          
          if (matchingFacility) {
            // Auto-select the facility
            setBookingData(prev => ({
              ...prev,
              facilityId: matchingFacility.id
            }));
          }
        }
        
        // Store all extracted data for the booking
        setBookingDetails(prev => ({
          ...prev,
          ...extractedData,
          bolProcessed: true,
          bolUploadTimestamp: new Date().toISOString()
        }));
      }
    } catch (error) {
      console.error('Error processing BOL:', error);
    } finally {
      setIsProcessingBol(false);
    }
  };

  // Get facilities from the booking page
  const facilities = useMemo(() => {
    if (!bookingPage?.facilities) return [];
    
    console.log("Facilities loaded from bookingPage:", bookingPage.facilities);
    return bookingPage.facilities;
  }, [bookingPage]);
  
  // Get appointment types from the booking page, filtered by the selected facility
  const appointmentTypes = useMemo(() => {
    if (!bookingPage?.appointmentTypes || !bookingData.facilityId) return [];
    
    return bookingPage.appointmentTypes.filter((type: any) => 
      type.facilityId === bookingData.facilityId
    );
  }, [bookingPage, bookingData.facilityId]);
  
  // Check if a date is a holiday
  const isHoliday = (date: Date) => {
    if (!bookingPage?.holidays || !Array.isArray(bookingPage.holidays)) return false;
    
    const dateStr = format(date, 'yyyy-MM-dd');
    return bookingPage.holidays.some((holiday: any) => holiday.date === dateStr);
  };
  
  // Check if a date is closed based on facility schedule
  const isDateClosed = (date: Date) => {
    // Don't allow past dates
    const today = startOfDay(new Date());
    if (date < today) {
      return true;
    }
    
    if (!bookingData.facilityId || !facilities.length) return true;
    
    const facility = facilities.find((f: any) => f.id === bookingData.facilityId);
    if (!facility) return true;
    
    // Check if the date is a holiday
    if (isHoliday(date)) return true;
    
    // Check day of week and see if facility is open
    if (isSunday(date) && !facility.sunday_open) return true;
    if (isMonday(date) && !facility.monday_open) return true;
    if (isTuesday(date) && !facility.tuesday_open) return true;
    if (isWednesday(date) && !facility.wednesday_open) return true;
    if (isThursday(date) && !facility.thursday_open) return true;
    if (isFriday(date) && !facility.friday_open) return true;
    if (isSaturday(date) && !facility.saturday_open) return true;
    
    // If it's today, check if there's enough buffer time for scheduling
    const now = new Date();
    const dateYear = date.getFullYear();
    const dateMonth = date.getMonth();
    const dateDay = date.getDate();
    const todayYear = now.getFullYear();
    const todayMonth = now.getMonth();
    const todayDay = now.getDate();
    const isToday = dateYear === todayYear && dateMonth === todayMonth && dateDay === todayDay;
    
    if (isToday) {
      // Get current time in hours since midnight
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      const currentTimeInMinutes = currentHour * 60 + currentMinute;
      
      // Get the facility's closing time for today
      let closingTime = '';
      if (isSunday(date)) closingTime = facility.sunday_end;
      else if (isMonday(date)) closingTime = facility.monday_end;
      else if (isTuesday(date)) closingTime = facility.tuesday_end;
      else if (isWednesday(date)) closingTime = facility.wednesday_end;
      else if (isThursday(date)) closingTime = facility.thursday_end;
      else if (isFriday(date)) closingTime = facility.friday_end;
      else if (isSaturday(date)) closingTime = facility.saturday_end;
      
      // Parse closing time (expected format "HH:MM")
      if (closingTime) {
        const [closingHour, closingMinute] = closingTime.split(':').map(Number);
        const closingTimeInMinutes = closingHour * 60 + closingMinute;
        
        // Default buffer of 60 minutes (adjust if needed)
        const bufferMinutes = 60;
        
        // Check if there's enough time left in the day for booking
        if (currentTimeInMinutes + bufferMinutes >= closingTimeInMinutes) {
          return true; // Not enough time left today
        }
      }
    }
    
    return false;
  };
  
  // Find the next available date based on facility hours
  const findNextAvailableDate = () => {
    let date = new Date();
    let daysChecked = 0;
    
    // Always start with tomorrow to avoid buffer time "Too soon" issues
    date = addDays(date, 1);
    
    // Check up to 30 days in the future to avoid infinite loop
    while (daysChecked < 30) {
      if (!isDateClosed(date)) return date;
      date = addDays(date, 1);
      daysChecked++;
    }
    
    // If no available date found, return tomorrow
    return addDays(new Date(), 1);
  };

  return (
    <div className="space-y-6">
      {/* Progress steps */}
      <div className="relative mb-8">
        <div className="flex justify-between">
          <div className={`text-center ${step >= 1 ? 'text-primary' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 mx-auto rounded-full flex items-center justify-center border-2 ${step >= 1 ? 'border-primary bg-primary text-white' : 'border-gray-300'}`}>
              1
            </div>
            <div className="text-xs mt-1">Select Service</div>
          </div>
          
          <div className={`text-center ${step >= 2 ? 'text-primary' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 mx-auto rounded-full flex items-center justify-center border-2 ${step >= 2 ? 'border-primary bg-primary text-white' : 'border-gray-300'}`}>
              2
            </div>
            <div className="text-xs mt-1">Select Date & Time</div>
          </div>
          
          <div className={`text-center ${step >= 3 ? 'text-primary' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 mx-auto rounded-full flex items-center justify-center border-2 ${step >= 3 ? 'border-primary bg-primary text-white' : 'border-gray-300'}`}>
              3
            </div>
            <div className="text-xs mt-1">Enter Details</div>
          </div>
        </div>
        
        <div className="absolute top-4 left-0 right-0 h-0.5 bg-gray-200 -z-10">
          <div 
            className="h-full bg-primary transition-all duration-300" 
            style={{ width: `${(step - 1) * 50}%` }}
          ></div>
        </div>
      </div>
      
      {/* Step 1: Select Service Type */}
      {step === 1 && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold">Select Service Type</h2>
          
          {/* BOL Upload Section */}
          <div className="bg-blue-50 p-4 rounded-md border border-blue-200 mb-4">
            <h3 className="text-md font-semibold mb-2 flex items-center">
              <Upload className="h-4 w-4 mr-2" />
              Upload BOL Document (Optional)
            </h3>
            <p className="text-sm text-muted-foreground mb-2">
              Upload your Bill of Lading to automatically fill in appointment details.
            </p>
            <div className="flex items-center space-x-2">
              <Input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleBolUpload(file);
                }}
                disabled={isProcessingBol}
              />
              {isProcessingBol && <Loader2 className="animate-spin h-4 w-4" />}
            </div>
            {bolFile && (
              <div className="mt-2 text-sm text-green-600">
                <CheckCircle className="inline-block h-4 w-4 mr-1" />
                {bolFile.name} uploaded successfully
              </div>
            )}
            {bolData && (
              <div className="mt-2 text-sm p-2 bg-blue-100 rounded">
                <p className="font-medium">Extracted information:</p>
                <ul className="list-disc pl-5 mt-1">
                  {Object.entries(bolData.extractedFields || {}).map(([key, value]) => (
                    <li key={key}>
                      {key}: {String(value)}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="facility">Facility</Label>
              <Select
                value={bookingData.facilityId?.toString() || ''}
                onValueChange={(value) => {
                  setBookingData({
                    ...bookingData,
                    facilityId: Number(value),
                    appointmentTypeId: undefined // Reset appointment type when facility changes
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a facility" />
                </SelectTrigger>
                <SelectContent>
                  {facilities.map((facility: any) => (
                    <SelectItem key={facility.id} value={facility.id.toString()}>
                      {facility.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="appointmentType">Service Type</Label>
              <Select
                value={bookingData.appointmentTypeId?.toString() || ''}
                onValueChange={(value) => {
                  setBookingData({
                    ...bookingData,
                    appointmentTypeId: Number(value)
                  });
                }}
                disabled={!bookingData.facilityId}
              >
                <SelectTrigger>
                  <SelectValue placeholder={bookingData.facilityId ? "Select a service type" : "Select a facility first"} />
                </SelectTrigger>
                <SelectContent>
                  {appointmentTypes.map((type: any) => (
                    <SelectItem key={type.id} value={type.id.toString()}>
                      {type.name} ({type.duration} min)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="pt-4">
            <Button 
              onClick={() => setStep(2)}
              disabled={!bookingData.facilityId || !bookingData.appointmentTypeId}
            >
              Next: Select Date & Time
            </Button>
          </div>
        </div>
      )}
      
      {/* Step 2: Select Date and Time */}
      {step === 2 && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold">Select Date and Time</h2>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <DatePicker
                date={bookingData.date ? new Date(bookingData.date) : findNextAvailableDate()}
                onDateChange={(date) => {
                  if (date) {
                    // IMPORTANT: Get the date components directly from the date object's UI display
                    // This ensures we use exactly the date shown in the calendar UI
                    const calendarDateString = date.toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      timeZone: 'America/New_York' // Use facility timezone
                    });
                    
                    // Parse the calendar date string (MM/DD/YYYY format in en-US locale)
                    const [month, day, year] = calendarDateString.split('/');
                    
                    // Create YYYY-MM-DD format for API
                    const formattedDate = `${year}-${month}-${day}`;
                    
                    console.log("Calendar shows date:", calendarDateString);
                    console.log("API formatted date:", formattedDate);
                    
                    // Set the exact date shown in the UI calendar
                    setBookingData({
                      ...bookingData,
                      date: formattedDate,
                      time: undefined // Reset time when date changes
                    });
                  }
                }}
                disabledDays={(date) => {
                  // Check facility schedule
                  return isDateClosed(date);
                }}
                disablePastDates={true}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="time">Available Times</Label>
              {bookingData.date ? (
                <TimeSlotsSelector
                  date={bookingData.date}
                  facilityId={bookingData.facilityId}
                  appointmentTypeId={bookingData.appointmentTypeId}
                  onSelectTime={(time) => {
                    setBookingData({
                      ...bookingData,
                      time
                    });
                  }}
                  selectedTime={bookingData.time}
                />
              ) : (
                <div className="text-muted-foreground">Please select a date first</div>
              )}
            </div>
          </div>
          
          <div className="flex justify-between pt-4">
            <Button onClick={() => setStep(1)} variant="outline">Back</Button>
            <Button 
              onClick={() => setStep(3)}
              disabled={!bookingData.date || !bookingData.time}
            >
              Next: Enter Details
            </Button>
          </div>
        </div>
      )}
      
      {/* Step 3: Enter Booking Details */}
      {step === 3 && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold">Enter Booking Details</h2>
          
          {(loadingQuestions || loadingCustomQuestions) ? (
            <div className="flex justify-center py-8">
              <Loader2 className="animate-spin h-8 w-8 text-primary" />
              <span className="ml-2">Loading booking questions...</span>
            </div>
          ) : (
            <Form {...form}>
              <form 
                className="space-y-6" 
                onSubmit={form.handleSubmit((data) => {
                  console.log("Form submitted with data:", data);
                  // Store the answers
                  setBookingDetails(data.customFields || {});
                  
                  // Create the booking
                  const bookingPayload = {
                    facilityId: Number(bookingData.facilityId),
                    appointmentTypeId: Number(bookingData.appointmentTypeId),
                    date: bookingData.date,
                    time: bookingData.time,
                    timezone: bookingData.timezone,
                    pickupOrDropoff: "pickup", // Default
                    ...data.customFields // Include all custom field answers
                  };
                  
                  console.log("Submitting booking with data:", bookingPayload);
                  bookingMutation.mutate(bookingPayload);
                })}
              >
                {/* BOL Data Summary - show if available */}
                {bolData && (
                  <div className="mb-6 border rounded-md p-4 bg-blue-50 border-blue-200">
                    <div className="flex items-center mb-2">
                      <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                      <h3 className="font-medium text-blue-800">BOL Processed Successfully</h3>
                    </div>
                    <div className="text-sm text-blue-700 space-y-1">
                      {bolData.summary && (
                        <p className="font-medium">{bolData.summary}</p>
                      )}
                      {bolData.extractedFields && (
                        <div className="grid grid-cols-2 gap-2 mt-2">
                          {Object.entries(bolData.extractedFields as Record<string, any>).map(([key, value]) => {
                            if (!value) return null;
                            return (
                              <div key={key} className="flex flex-col">
                                <span className="text-xs text-blue-500 uppercase">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                                <span className="font-medium truncate">{String(value)}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {bolFile && (
                        <p className="text-xs text-blue-500 mt-2">
                          File: {bolFile.name} ({(bolFile.size / 1024).toFixed(1)} KB)
                        </p>
                      )}
                    </div>
                    <p className="text-xs text-blue-600 mt-2">These values have been pre-filled in the form below.</p>
                  </div>
                )}
                
                {/* Show error message if booking failed */}
                {bookingError && (
                  <div className="mb-6 p-4 border border-red-300 bg-red-50 rounded-md">
                    <div className="flex items-center">
                      <XCircle className="h-5 w-5 text-red-500 mr-2" />
                      <h3 className="font-medium text-red-800">Booking Failed</h3>
                    </div>
                    <p className="mt-2 text-sm text-red-700">{bookingError}</p>
                    <p className="mt-1 text-xs text-red-600">Please check your information and try again.</p>
                  </div>
                )}
                
                {/* Show message when no questions are available */}
                {(standardQuestions?.length === 0 && customQuestions?.length === 0) ? (
                  <div className="my-6 p-4 border border-blue-100 rounded-md bg-blue-50 text-center">
                    <p className="text-sm text-blue-700">
                      No standard questions are configured for this appointment type.
                    </p>
                    <p className="mt-2 text-xs text-blue-600">
                      You can proceed with booking without additional information.
                    </p>
                  </div>
                ) : (
                  <StandardQuestionsFormFields
                    form={form}
                    questions={[...(standardQuestions || []), ...(customQuestions || [])]}
                    isLoading={loadingQuestions || loadingCustomQuestions}
                    existingAnswers={bolData?.extractedFields}
                  />
                )}
                
                <div className="flex justify-between pt-4">
                  <Button 
                    type="button" 
                    onClick={() => {
                      setBookingError(null); // Clear any errors when going back
                      setStep(2);
                    }} 
                    variant="outline"
                  >
                    Back
                  </Button>
                  <Button 
                    type="submit"
                    disabled={bookingMutation.isPending}
                    onClick={() => {
                      // Clear any previous error when attempting to submit again
                      setBookingError(null);
                    }}
                  >
                    {bookingMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating Booking...
                      </>
                    ) : "Confirm Booking"}
                  </Button>
                </div>
              </form>
            </Form>
          )}
        </div>
      )}
      
      {/* Step 4: Booking Confirmation */}
      {step === 4 && confirmationCode && (
        <div className="text-center space-y-4">
          <CheckCircle className="text-green-500 w-10 h-10 mx-auto" />
          <h2 className="text-lg font-bold">Booking Confirmed!</h2>
          <p>Your appointment has been successfully scheduled.</p>
          
          {/* QR Code for Check-in */}
          <div className="bg-white p-4 rounded-lg shadow-sm mb-4 inline-block mx-auto">
            <div className="bg-gradient-to-tr from-primary-100 to-primary-50 p-3 rounded-lg">
              <div className="bg-white p-3 rounded-lg">
                {/* Generate QR code based on confirmation code */}
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(confirmationCode)}`} 
                  alt="Check-in QR Code" 
                  className="w-32 h-32 mx-auto"
                />
                <div className="flex items-center justify-center mt-2">
                  <QrCode className="h-4 w-4 mr-1 text-primary" />
                  <p className="text-xs text-muted-foreground">Scan for quick check-in</p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Confirmation Code Card */}
          <div className="bg-primary/10 rounded-md p-4 my-4">
            <p className="text-sm">Confirmation Code:</p>
            <p className="text-lg font-bold">{confirmationCode}</p>
            
            {/* Show appointment details if available */}
            {bookingDetails.startTime && (
              <div className="mt-2 pt-2 border-t border-primary/20 text-sm">
                <div className="grid grid-cols-2 gap-2 text-left">
                  <p className="text-muted-foreground">Date:</p>
                  <p>{new Date(bookingDetails.startTime).toLocaleDateString()}</p>
                  
                  <p className="text-muted-foreground">Time:</p>
                  <p>{new Date(bookingDetails.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                  
                  {bookingDetails.facilityName && (
                    <>
                      <p className="text-muted-foreground">Location:</p>
                      <p>{bookingDetails.facilityName}</p>
                    </>
                  )}
                  
                  {bookingDetails.appointmentTypeName && (
                    <>
                      <p className="text-muted-foreground">Service:</p>
                      <p>{bookingDetails.appointmentTypeName}</p>
                    </>
                  )}
                  
                  {/* Driver Information */}
                  {bookingDetails.driverName && (
                    <>
                      <p className="text-muted-foreground">Driver:</p>
                      <p>{bookingDetails.driverName}</p>
                    </>
                  )}
                  
                  {bookingDetails.driverPhone && (
                    <>
                      <p className="text-muted-foreground">Driver Phone:</p>
                      <p>{bookingDetails.driverPhone}</p>
                    </>
                  )}
                  
                  {/* Customer/Carrier Information */}
                  {bookingDetails.carrierName && (
                    <>
                      <p className="text-muted-foreground">Carrier:</p>
                      <p>{bookingDetails.carrierName}</p>
                    </>
                  )}
                  
                  {bookingDetails.companyName && (
                    <>
                      <p className="text-muted-foreground">Company:</p>
                      <p>{bookingDetails.companyName}</p>
                    </>
                  )}
                  
                  {/* Vehicle Information */}
                  {bookingDetails.truckNumber && (
                    <>
                      <p className="text-muted-foreground">Truck #:</p>
                      <p>{bookingDetails.truckNumber}</p>
                    </>
                  )}
                  
                  {bookingDetails.trailerNumber && (
                    <>
                      <p className="text-muted-foreground">Trailer #:</p>
                      <p>{bookingDetails.trailerNumber}</p>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
          
          {/* BOL Information Section */}
          {bookingDetails.bolUploaded && (
            <div className="bg-blue-50 rounded-md p-4 my-4 border border-blue-100">
              <div className="flex items-center justify-center mb-2">
                <FileCheck className="h-5 w-5 text-blue-500 mr-2" />
                <p className="text-sm font-medium">Bill of Lading Document Uploaded</p>
              </div>
              <p className="text-xs text-muted-foreground">
                Your BOL has been linked to this appointment and will be available to the facility.
              </p>
            </div>
          )}
          
          {/* Email Notification Status */}
          <div className={`rounded-md p-4 my-4 ${bookingDetails.emailSent ? 'bg-green-50 border border-green-100' : 'bg-yellow-50 border border-yellow-100'}`}>
            <div className="flex items-center justify-center mb-1">
              {bookingDetails.emailSent ? (
                <>
                  <Mail className="h-5 w-5 text-green-500 mr-2" />
                  <p className="text-sm font-medium">Confirmation Email Sent</p>
                </>
              ) : (
                <>
                  <AlertCircle className="h-5 w-5 text-yellow-500 mr-2" />
                  <p className="text-sm font-medium">Email Notification Status</p>
                </>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {bookingDetails.emailSent 
                ? "A confirmation email has been sent with your appointment details." 
                : "Please make note of your confirmation code as the email could not be sent."}
            </p>
          </div>
          
          <p className="text-sm text-muted-foreground">
            Please keep your confirmation code for check-in.
          </p>
          
          <Button 
            onClick={() => {
              // Reset the form and go back to step 1
              setStep(1);
              setBookingData({
                timezone: getUserTimeZone()
              });
              setConfirmationCode(null);
              setBookingDetails({});
              setBolFile(null);
              setBolData(null);
            }}
            className="mt-4"
          >
            Book Another Appointment
          </Button>
        </div>
      )}
    </div>
  );
}

function TimeSlotsSelector({ 
  date, 
  facilityId, 
  appointmentTypeId, 
  onSelectTime, 
  selectedTime 
}: { 
  date: string, 
  facilityId?: number, 
  appointmentTypeId?: number,
  onSelectTime: (time: string) => void,
  selectedTime?: string
}) {
  const [slots, setSlots] = useState<Array<{
    time: string;
    available: boolean;
    reason?: string;
    remaining?: number;
  }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    async function fetchAvailability() {
      if (!date || !facilityId || !appointmentTypeId) return;
      
      setIsLoading(true);
      setError(null);
      
      try {
        // Use the special endpoint for external booking
        // Get the booking page slug from the URL path
        const pathSegments = window.location.pathname.split('/');
        const pageSlug = pathSegments[pathSegments.length - 1]; 
        
        console.log(`Fetching availability for date=${date}, facility=${facilityId}, type=${appointmentTypeId}, page=${pageSlug}`);
        
        // First try the v2 endpoint which has better concurrency handling
        let res;
        try {
          res = await fetch(`/api/availability/v2?date=${date}&facilityId=${facilityId}&appointmentTypeId=${appointmentTypeId}&bookingPageSlug=${pageSlug}`);
          console.log("Using enhanced v2 availability endpoint");
        } catch (e) {
          // Fallback to original endpoint if v2 fails
          console.log("Falling back to classic availability endpoint");
          res = await fetch(`/api/availability?date=${date}&facilityId=${facilityId}&appointmentTypeId=${appointmentTypeId}&bookingPageSlug=${pageSlug}`);
        }
        
        if (!res.ok) {
          console.error('Availability API error:', res.status, res.statusText);
          let errorMessage = `Failed to fetch availability (${res.status})`;
          
          try {
            const errorData = await res.json();
            console.error('Error details:', errorData);
            errorMessage = errorData.message || errorMessage;
          } catch (e) {
            // If we can't parse the error as JSON, use default message
          }
          
          throw new Error(errorMessage);
        }
        
        const data = await res.json();
        console.log('Availability data received:', data);
        
        // Handle different response formats for compatibility
        if (data.slots && Array.isArray(data.slots)) {
          // Process slots to properly show remaining capacity
          const processedSlots = data.slots.map((slot: any) => ({
            ...slot,
            // Ensure proper display of remaining slots
            remaining: slot.remaining || slot.remainingCapacity || 0,
            // Make sure available flag is a boolean
            available: Boolean(slot.available)
          }));
          setSlots(processedSlots);
        } else if (data.availableTimes && Array.isArray(data.availableTimes)) {
          // Convert simple time array to slot format
          setSlots(data.availableTimes.map((time: string) => ({
            time: time,
            available: true,
            reason: '',
            remaining: 1
          })));
        } else {
          setSlots([]);
        }
      } catch (err) {
        console.error('Error fetching availability:', err);
        setError('Failed to load available time slots');
        setSlots([]);
      } finally {
        setIsLoading(false);
      }
    }
    
    fetchAvailability();
  }, [date, facilityId, appointmentTypeId]);
  
  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-4">
        <Loader2 className="animate-spin h-6 w-6 text-primary mr-2" />
        <span>Loading available time slots...</span>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="text-red-500 py-4">
        <XCircle className="inline-block h-4 w-4 mr-1" />
        {error}
      </div>
    );
  }
  
  if (slots.length === 0) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
        <p className="text-amber-700 font-medium">No Available Times</p>
        <p className="text-sm text-amber-600">
          There are no available times for the selected date. Please choose another date.
        </p>
      </div>
    );
  }
  
  // Group slots by morning/afternoon for better organization
  const morningSlots = slots.filter(slot => {
    const hour = parseInt(slot.time.split(':')[0], 10);
    return hour < 12;
  });
  
  const afternoonSlots = slots.filter(slot => {
    const hour = parseInt(slot.time.split(':')[0], 10);
    return hour >= 12;
  });
  
  return (
    <div className="space-y-4">
      {morningSlots.length > 0 && (
        <div>
          <h3 className="text-sm font-medium mb-2">Morning</h3>
          <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
            {morningSlots.map((slot) => (
              <Button
                key={slot.time}
                variant={selectedTime === slot.time ? "default" : "outline"}
                size="sm"
                className={`w-full ${!slot.available ? 'opacity-50 cursor-not-allowed' : ''}`}
                onClick={() => {
                  if (slot.available) {
                    onSelectTime(slot.time);
                  }
                }}
                disabled={!slot.available}
                title={!slot.available ? (slot.reason || 'Unavailable') : undefined}
              >
                {safeToString(slot.time)}
                {slot.remaining !== undefined && slot.available && (
                  <span className="ml-1 text-xs">({slot.remaining})</span>
                )}
              </Button>
            ))}
          </div>
        </div>
      )}
      
      {afternoonSlots.length > 0 && (
        <div>
          <h3 className="text-sm font-medium mb-2">Afternoon</h3>
          <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
            {afternoonSlots.map((slot) => (
              <Button
                key={slot.time}
                variant={selectedTime === slot.time ? "default" : "outline"}
                size="sm"
                className={`w-full ${!slot.available ? 'opacity-50 cursor-not-allowed' : ''}`}
                onClick={() => {
                  if (slot.available) {
                    onSelectTime(slot.time);
                  }
                }}
                disabled={!slot.available}
                title={!slot.available ? (slot.reason || 'Unavailable') : undefined}
              >
                {safeToString(slot.time)}
                {slot.remaining !== undefined && slot.available && (
                  <span className="ml-1 text-xs">({slot.remaining})</span>
                )}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}