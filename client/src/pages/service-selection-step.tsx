import React, { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Card, 
  CardContent
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Form, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormControl, 
  FormMessage 
} from '@/components/ui/form';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import BolUpload from '@/components/shared/bol-upload';
import { ParsedBolData } from '@/lib/ocr-service';
import { useBookingWizard } from '@/contexts/BookingWizardContext';

// Define the step 1 form schema
const serviceSelectionSchema = z.object({
  facilityId: z.string().min(1, { message: "Location is required" }),
  appointmentTypeId: z.string().min(1, { message: "Appointment type is required" }),
  pickupOrDropoff: z.enum(["pickup", "dropoff"], { 
    required_error: "Please select if this is a pickup or dropoff" 
  })
});

type ServiceSelectionFormValues = z.infer<typeof serviceSelectionSchema>;

// Step 1: Service Selection
export default function ServiceSelectionStep({ bookingPage }: { bookingPage: any }) {
  const { bookingData, updateBookingData, setCurrentStep } = useBookingWizard();
  const [bolPreviewText, setBolPreviewText] = useState<string | null>(null);
  const [bolProcessing, setBolProcessing] = useState(false);
  
  // Set up react-hook-form
  const form = useForm<ServiceSelectionFormValues>({
    resolver: zodResolver(serviceSelectionSchema),
    defaultValues: {
      facilityId: bookingData.facilityId?.toString() || "",
      appointmentTypeId: bookingData.appointmentTypeId?.toString() || "",
      pickupOrDropoff: bookingData.pickupOrDropoff as "pickup" | "dropoff" || undefined
    }
  });
  
  // Fetch facilities data - use booking page slug to get the correct tenant's facilities
  const { 
    data: facilities = [], 
    isLoading: facilitiesLoading,
    error: facilitiesError
  } = useQuery<any[]>({
    queryKey: ['/api/facilities', { bookingPageSlug: bookingPage?.slug }],
    queryFn: async ({ queryKey }) => {
      const [baseUrl, params] = queryKey;
      // Important: Use port 5000 directly for API requests
      const apiUrl = `${baseUrl}?bookingPageSlug=${params.bookingPageSlug}`;
      console.log(`[ServiceSelectionStep] Fetching facilities with URL: ${apiUrl}`);
      
      try {
        const response = await fetch(apiUrl);
        console.log(`[ServiceSelectionStep] Facilities API response status:`, response.status);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[ServiceSelectionStep] Error fetching facilities: ${errorText}`);
          throw new Error(`Failed to fetch facilities: ${response.status} ${errorText}`);
        }
        
        const data = await response.json();
        console.log(`[ServiceSelectionStep] Successfully fetched ${data.length} facilities`);
        return data;
      } catch (err) {
        console.error(`[ServiceSelectionStep] Exception fetching facilities:`, err);
        throw err;
      }
    },
    enabled: !!bookingPage?.slug
  });
  
  // Log any facilities errors
  useEffect(() => {
    if (facilitiesError) {
      console.error('[ServiceSelectionStep] Error from facilities query:', facilitiesError);
    }
  }, [facilitiesError]);
  
  // Fetch appointment types - add bookingPageSlug for tenant isolation
  const { 
    data: appointmentTypes = [], 
    isLoading: typesLoading,
    error: typesError
  } = useQuery<any[]>({
    queryKey: ['/api/appointment-types', { bookingPageSlug: bookingPage?.slug }],
    queryFn: async ({ queryKey }) => {
      const [baseUrl, params] = queryKey;
      // Use relative URL path for API requests to work in any environment
      const apiUrl = `${baseUrl}?bookingPageSlug=${params.bookingPageSlug}`;
      console.log(`[ServiceSelectionStep] Fetching appointment types with URL: ${apiUrl}`);
      console.log(`[ServiceSelectionStep] Booking page slug: ${params.bookingPageSlug}, full bookingPage:`, bookingPage);
      
      try {
        const response = await fetch(apiUrl);
        console.log(`[ServiceSelectionStep] Appointment types API response status:`, response.status);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[ServiceSelectionStep] Error fetching appointment types: ${errorText}`);
          throw new Error(`Failed to fetch appointment types: ${response.status} ${errorText}`);
        }
        
        const data = await response.json();
        console.log(`[ServiceSelectionStep] Successfully fetched ${data.length} appointment types`);
        
        // Store appointment types in booking data for reference elsewhere
        if (data.length > 0) {
          updateBookingData({ appointmentTypes: data });
        }
        
        return data;
      } catch (err) {
        console.error(`[ServiceSelectionStep] Exception fetching appointment types:`, err);
        throw err;
      }
    },
    enabled: !!bookingPage?.slug
  });
  
  // Log any errors
  useEffect(() => {
    if (typesError) {
      console.error('[ServiceSelectionStep] Error from appointment types query:', typesError);
    }
  }, [typesError]);
  
  // Filter facilities based on booking page configuration
  const availableFacilities = useMemo(() => {
    if (!facilities || !bookingPage?.facilities) return [];
    
    return bookingPage.facilities && Array.isArray(bookingPage.facilities)
      ? facilities.filter((f: any) => bookingPage.facilities.includes(f.id))
      : facilities;
  }, [facilities, bookingPage]);
  
  // Get appointment types for the selected facility
  const facilityAppointmentTypes = useMemo(() => {
    const facilityId = parseInt(form.watch("facilityId") || "0", 10);
    if (!appointmentTypes || !facilityId) return [];
    
    // Filter for the selected facility and sort alphabetically by name
    return appointmentTypes
      .filter((type: any) => type.facilityId === facilityId)
      .sort((a: any, b: any) => a.name.localeCompare(b.name));
  }, [appointmentTypes, form.watch("facilityId")]);
  
  // Handle BOL processing from the BolUpload component
  const handleBolProcessed = (data: ParsedBolData, fileUrl: string) => {
    // Update booking data with the parsed BOL information
    updateBookingData({
      bolExtractedData: {
        bolNumber: data.bolNumber || '',
        customerName: data.customerName || '',
        carrierName: data.carrierName || '',
        mcNumber: data.mcNumber || '',
        weight: data.weight || '',
        notes: data.notes || ''
      },
      bolFileUploaded: true
    });
    
    // Try to prefill pickup/dropoff from BOL data
    if (data.pickupOrDropoff && !form.watch("pickupOrDropoff")) {
      form.setValue("pickupOrDropoff", data.pickupOrDropoff);
      updateBookingData({ pickupOrDropoff: data.pickupOrDropoff });
    }
    
    // Try to prefill location based on address info in the BOL
    if (!form.watch("facilityId") && (data.fromAddress || data.toAddress)) {
      // Helper function to find matching facility based on address
      const findFacilityMatch = (address: string | undefined) => {
        if (!address) return null;
        const addressLower = address.toLowerCase();
        
        // Try to find facility by matching address keywords
        return availableFacilities.find((facility: any) => {
          // Match by name
          if (addressLower.includes(facility.name.toLowerCase())) {
            return true;
          }
          
          // Match by address parts if present in the BOL address
          if (facility.address1 && addressLower.includes(facility.address1.toLowerCase())) {
            return true;
          }
          
          if (facility.city && addressLower.includes(facility.city.toLowerCase())) {
            return true;
          }
          
          return false;
        });
      };
      
      // Look for matches based on direction (pickup vs dropoff)
      let matchedFacility = null;
      if (data.pickupOrDropoff === 'pickup') {
        // If pickup, look for facility in fromAddress
        matchedFacility = findFacilityMatch(data.fromAddress);
      } else if (data.pickupOrDropoff === 'dropoff') {
        // If dropoff, look for facility in toAddress
        matchedFacility = findFacilityMatch(data.toAddress);
      }
      
      // If no direction-specific match, try matching any address
      if (!matchedFacility) {
        matchedFacility = findFacilityMatch(data.fromAddress) || findFacilityMatch(data.toAddress);
      }
      
      // If we found a matching facility, select it
      if (matchedFacility) {
        form.setValue("facilityId", matchedFacility.id.toString());
        updateBookingData({ facilityId: matchedFacility.id });
        
        // Try to auto-select an appointment type for the facility
        setTimeout(() => {
          const facilityId = parseInt(form.watch("facilityId") || "0", 10);
          const types = appointmentTypes
            .filter((type: any) => type.facilityId === facilityId)
            .sort((a: any, b: any) => a.name.localeCompare(b.name));
            
          // Auto-select the first appointment type that matches the BOL direction
          if (types.length > 0) {
            const pickupOrDropoff = form.watch("pickupOrDropoff");
            const matchingType = types.find((type: any) => {
              const isInbound = type.type?.toLowerCase() === 'inbound';
              const isOutbound = type.type?.toLowerCase() === 'outbound';
              
              return (isInbound && pickupOrDropoff === 'dropoff') || 
                     (isOutbound && pickupOrDropoff === 'pickup');
            }) || types[0]; // Fallback to first type if no direction match
            
            form.setValue("appointmentTypeId", matchingType.id.toString());
            updateBookingData({ appointmentTypeId: matchingType.id });
          }
        }, 100); // Small delay to ensure the appointment types have updated after facility change
      }
    }
    
    // Create enhanced preview text from the extracted data for display
    const preview = `
BOL Number: ${data.bolNumber || ''}
Customer: ${data.customerName || ''}
Carrier: ${data.carrierName || ''} ${data.mcNumber ? `(${data.mcNumber})` : ''}
${data.weight ? `Weight: ${data.weight}` : ''}
${data.pickupOrDropoff ? `Type: ${data.pickupOrDropoff === 'pickup' ? 'Pickup (Outbound)' : 'Dropoff (Inbound)'}` : ''}
${data.fromAddress ? `From: ${data.fromAddress}` : ''}
${data.toAddress ? `To: ${data.toAddress}` : ''}
${data.notes ? `Notes: ${data.notes}` : ''}
    `.trim();
    
    setBolPreviewText(preview);
  };
  
  // Handle BOL processing state changes
  const handleProcessingStateChange = (isProcessing: boolean) => {
    setBolProcessing(isProcessing);
  };
  
  // Handle form submission
  const onSubmit = (values: ServiceSelectionFormValues) => {
    updateBookingData({
      facilityId: parseInt(values.facilityId, 10),
      appointmentTypeId: parseInt(values.appointmentTypeId, 10),
      pickupOrDropoff: values.pickupOrDropoff
    });
    
    setCurrentStep(2);
  };
  
  // When facilityId changes, reset appointmentTypeId
  const handleFacilityChange = (value: string) => {
    form.setValue("facilityId", value);
    form.setValue("appointmentTypeId", "");
    
    // Update the bookingData as well for consistency
    updateBookingData({ 
      facilityId: parseInt(value, 10),
      appointmentTypeId: null 
    });
  };
  
  // Loading state
  if (facilitiesLoading || typesLoading) {
    return (
      <div className="flex justify-center my-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }
  
  return (
    <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
      {/* Left side - Information panel */}
      <div className="md:col-span-1 space-y-6">
        <div className="prose max-w-none">
          <h2 className="text-xl font-bold">Schedule Your Appointment</h2>
          <p className="text-sm">
            Please use this form to schedule a dock appointment at {bookingPage?.name || 'Dock Optimizer'}.
            For support using this page, please <a href="#" className="text-blue-600 hover:underline">check out this video</a>.
          </p>
          
          <p className="text-sm mt-4 font-semibold">
            Effective August 1st, 2023, MC Numbers are required for all
            incoming and outgoing shipments. This is to protect the
            security of our customer's shipments and reduce the risk of
            fraud.
          </p>
        </div>
      </div>
      
      {/* Right side - Form Card */}
      <div className="md:col-span-2">
        <Card className="w-full">
          <CardContent className="pt-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* Step 1: Location */}
                <FormField
                  control={form.control}
                  name="facilityId"
                  render={({ field }) => (
                    <FormItem className="space-y-2">
                      <FormLabel className="font-medium">
                        Location<span className="text-red-500">*</span>
                      </FormLabel>
                      <Select
                        onValueChange={(value) => handleFacilityChange(value)}
                        defaultValue={field.value}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger id="facilityId">
                            <SelectValue placeholder="Select a location" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {availableFacilities.map((facility: any) => (
                            <SelectItem 
                              key={facility.id} 
                              value={facility.id.toString()}
                            >
                              {facility.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* Step 2: Dock Appointment Type */}
                <FormField
                  control={form.control}
                  name="appointmentTypeId"
                  render={({ field }) => (
                    <FormItem className="space-y-2">
                      <FormLabel className="font-medium">
                        Dock Appointment Type<span className="text-red-500">*</span>
                      </FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                        disabled={!form.watch("facilityId")}
                      >
                        <FormControl>
                          <SelectTrigger id="appointmentTypeId">
                            <SelectValue placeholder={
                              !form.watch("facilityId") 
                                ? "Please select a location first" 
                                : "Select an appointment type"
                            } />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {facilityAppointmentTypes.map((type: any) => (
                            <SelectItem 
                              key={type.id} 
                              value={type.id.toString()}
                            >
                              {type.name} ({type.duration} min)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                      
                      {facilityAppointmentTypes.length === 0 && form.watch("facilityId") && (
                        <p className="text-sm text-orange-600 mt-1">
                          No appointment types are available for this location.
                        </p>
                      )}
                    </FormItem>
                  )}
                />
                
                {/* Step 3: Pickup or Dropoff */}
                <FormField
                  control={form.control}
                  name="pickupOrDropoff"
                  render={({ field }) => (
                    <FormItem className="space-y-2">
                      <FormLabel className="font-medium">
                        Pickup or Dropoff<span className="text-red-500">*</span>
                      </FormLabel>
                      <FormControl>
                        <div className="grid grid-cols-2 gap-4">
                          <div
                            className={`border rounded-md p-4 cursor-pointer transition-colors ${
                              field.value === 'pickup'
                                ? 'border-primary bg-primary/10'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                            onClick={() => {
                              form.setValue("pickupOrDropoff", "pickup");
                              updateBookingData({ pickupOrDropoff: 'pickup' });
                            }}
                          >
                            <div className="font-medium">Pickup</div>
                            <div className="text-sm text-gray-500">I'm picking up goods from the facility</div>
                          </div>
                          
                          <div
                            className={`border rounded-md p-4 cursor-pointer transition-colors ${
                              field.value === 'dropoff'
                                ? 'border-primary bg-primary/10'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                            onClick={() => {
                              form.setValue("pickupOrDropoff", "dropoff");
                              updateBookingData({ pickupOrDropoff: 'dropoff' });
                            }}
                          >
                            <div className="font-medium">Dropoff</div>
                            <div className="text-sm text-gray-500">I'm delivering goods to the facility</div>
                          </div>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* Step 4: Bill of Lading Upload */}
                <div className="space-y-2">
                  <Label className="font-medium">
                    Bill of Lading Upload (optional)
                  </Label>
                  
                  <BolUpload 
                    onBolProcessed={handleBolProcessed}
                    onProcessingStateChange={handleProcessingStateChange}
                  />
                  
                  {/* BOL Preview shown when file uploaded but not while processing */}
                  {bolProcessing && (
                    <div className="p-4 border rounded-md mt-3 animate-pulse flex items-center justify-center">
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      <p className="text-sm text-gray-600">Processing Bill of Lading...</p>
                    </div>
                  )}
                  
                  {bolPreviewText && !bolProcessing && (
                    <div className="p-4 border rounded-md mt-3">
                      <h3 className="text-sm font-semibold mb-2">Extracted BOL Information:</h3>
                      <pre className="text-xs whitespace-pre-wrap">{bolPreviewText}</pre>
                    </div>
                  )}
                </div>
                
                {/* Navigation buttons */}
                <div className="flex justify-end pt-4">
                  <Button 
                    type="submit"
                    className="booking-button" 
                  >
                    Next
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}