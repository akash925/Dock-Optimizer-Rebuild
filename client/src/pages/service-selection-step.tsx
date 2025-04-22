import React, { useState, useMemo } from 'react';
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
  
  // Fetch facilities data
  const { 
    data: facilities = [], 
    isLoading: facilitiesLoading 
  } = useQuery<any[]>({
    queryKey: ['/api/facilities'],
  });
  
  // Fetch appointment types
  const { 
    data: appointmentTypes = [], 
    isLoading: typesLoading 
  } = useQuery<any[]>({
    queryKey: ['/api/appointment-types'],
  });
  
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
    
    // Create preview text from the extracted data for display
    const preview = `
BOL Number: ${data.bolNumber || ''}
Customer: ${data.customerName || ''}
Carrier: ${data.carrierName || ''} ${data.mcNumber ? `(${data.mcNumber})` : ''}
${data.weight ? `Weight: ${data.weight}` : ''}
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
            Please use this form to schedule a dock appointment at Hanzo Logistics. 
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
                            onClick={() => form.setValue("pickupOrDropoff", "pickup")}
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
                            onClick={() => form.setValue("pickupOrDropoff", "dropoff")}
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