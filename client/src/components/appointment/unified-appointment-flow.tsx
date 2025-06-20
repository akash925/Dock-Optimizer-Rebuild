import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, addDays, startOfDay } from 'date-fns';
import { Calendar as CalendarIcon, Clock, ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { apiRequest } from '@/lib/queryClient';
import { getUserTimeZone } from "@/lib/timezone-utils";

// Unified appointment form schema
const appointmentSchema = z.object({
  // Location & Type
  facilityId: z.number().min(1, 'Please select a facility'),
  appointmentTypeId: z.number().min(1, 'Please select an appointment type'),
  
  // Scheduling
  appointmentDate: z.date(),
  startTime: z.string().min(1, 'Please select a start time'),
  endTime: z.string().min(1, 'Please select an end time'),
  dockId: z.number().optional().nullable(),
  
  // Company & Contact
  companyName: z.string().min(1, 'Company name is required'),
  contactName: z.string().min(1, 'Contact name is required'),
  email: z.string().email('Valid email is required'),
  phone: z.string().min(1, 'Phone number is required'),
  customerRef: z.string().optional(),
  
  // Carrier & Vehicle
  carrierId: z.number().optional().nullable(),
  carrierName: z.string().optional(),
  driverName: z.string().min(1, 'Driver name is required'),
  driverPhone: z.string().optional(),
  driverEmail: z.string().optional(),
  mcNumber: z.string().optional(),
  truckNumber: z.string().min(1, 'Truck number is required'),
  trailerNumber: z.string().optional(),
  
  // Additional
  notes: z.string().optional(),
  pickupOrDropoff: z.enum(['pickup', 'dropoff']).default('dropoff'),
});

type AppointmentFormData = z.infer<typeof appointmentSchema>;

interface UnifiedAppointmentFlowProps {
  // Mode determines data access and UI behavior
  mode: 'internal' | 'external';
  
  // Common props
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (appointmentData: any) => void;
  
  // Pre-filled data
  initialData?: Partial<AppointmentFormData>;
  editMode?: 'create' | 'edit';
  appointmentId?: number;
  
  // Preselected values
  facilityId?: number;
  appointmentTypeId?: number;
  selectedDate?: Date;
  selectedDockId?: number;
  
  // External mode specific
  bookingPageSlug?: string;
  timezone?: string;
  
  // Internal mode specific
  allowAllAppointmentTypes?: boolean;
}

export default function UnifiedAppointmentFlow({
  mode,
  isOpen,
  onClose,
  onSuccess,
  initialData,
  editMode = 'create',
  appointmentId,
  facilityId: preselectedFacilityId,
  appointmentTypeId: preselectedAppointmentTypeId,
  selectedDate,
  selectedDockId,
  bookingPageSlug,
  timezone,
  allowAllAppointmentTypes = true,
}: UnifiedAppointmentFlowProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [availableTimeSlots, setAvailableTimeSlots] = useState<any[]>([]);
  const [isLoadingTimeSlots, setIsLoadingTimeSlots] = useState(false);

  const form = useForm<AppointmentFormData>({
    resolver: zodResolver(appointmentSchema),
    defaultValues: {
      facilityId: preselectedFacilityId || initialData?.facilityId || 1, // Use 1 instead of 0 to avoid validation issues
      appointmentTypeId: preselectedAppointmentTypeId || initialData?.appointmentTypeId || 1, // Use 1 instead of 0 to avoid validation issues
      appointmentDate: selectedDate || initialData?.appointmentDate || addDays(new Date(), 1),
      pickupOrDropoff: initialData?.pickupOrDropoff || 'dropoff',
      dockId: selectedDockId || initialData?.dockId || null,
      companyName: initialData?.companyName || '',
      contactName: initialData?.contactName || '',
      email: initialData?.email || '',
      phone: initialData?.phone || '',
      customerRef: initialData?.customerRef || '',
      carrierId: initialData?.carrierId || null,
      carrierName: initialData?.carrierName || '',
      driverName: initialData?.driverName || '',
      driverPhone: initialData?.driverPhone || '',
      driverEmail: initialData?.driverEmail || '',
      mcNumber: initialData?.mcNumber || '',
      truckNumber: initialData?.truckNumber || '',
      trailerNumber: initialData?.trailerNumber || '',
      notes: initialData?.notes || '',
      startTime: initialData?.startTime || '',
      endTime: initialData?.endTime || '',
    },
  });

  // ENHANCED: Dynamic timezone resolution
  const [effectiveTimezone, setEffectiveTimezone] = useState<string>(getUserTimeZone());
  
  // Fetch facility data to get timezone
  const { data: facility } = useQuery({
    queryKey: [`/api/facilities/${preselectedFacilityId}`],
    queryFn: async () => {
      if (!preselectedFacilityId) return null;
      const response = await fetch(`/api/facilities/${preselectedFacilityId}`);
      if (!response.ok) throw new Error('Failed to fetch facility');
      return response.json();
    },
    enabled: !!preselectedFacilityId
  });

  // Set effective timezone based on available data
  useEffect(() => {
    let targetTimezone = getUserTimeZone(); // Default to user timezone
    
    // Priority 1: Explicitly passed timezone prop
    if (timezone) {
      targetTimezone = timezone;
    }
    // Priority 2: Facility timezone from facility data
    else if (facility?.timezone) {
      targetTimezone = facility.timezone;
    }
    
    setEffectiveTimezone(targetTimezone);
    
    console.log('[UnifiedAppointmentFlow] Timezone Resolution:', {
      userTimezone: getUserTimeZone(),
      propTimezone: timezone,
      facilityTimezone: facility?.timezone,
      effectiveTimezone: targetTimezone,
      facilityId: preselectedFacilityId
    });
  }, [timezone, facility, preselectedFacilityId]);

  // Fetch facilities - internal mode gets all, external gets booking page specific
  const { data: facilities = [], isLoading: isLoadingFacilities } = useQuery({
    queryKey: mode === 'internal' ? ['/api/facilities'] : [`/api/booking-pages/slug/${bookingPageSlug}/facilities`],
    enabled: mode === 'internal' || !!bookingPageSlug,
  });

  // Fetch appointment types based on mode and selected facility
  const selectedFacilityId = form.watch('facilityId');
  const { data: appointmentTypes = [], isLoading: isLoadingAppointmentTypes } = useQuery({
    queryKey: mode === 'internal' 
      ? ['/api/appointment-types', selectedFacilityId]
      : [`/api/booking-pages/slug/${bookingPageSlug}/appointment-types`, selectedFacilityId],
    enabled: !!selectedFacilityId && (mode === 'internal' || !!bookingPageSlug),
    queryFn: async () => {
      if (mode === 'internal') {
        // Internal mode: Get ALL appointment types for the facility
        const res = await fetch(`/api/appointment-types?facilityId=${selectedFacilityId}`);
        if (!res.ok) throw new Error('Failed to fetch appointment types');
        return res.json();
      } else {
        // External mode: Get filtered appointment types based on booking page
        const res = await fetch(`/api/booking-pages/slug/${bookingPageSlug}/appointment-types?facilityId=${selectedFacilityId}`);
        if (!res.ok) throw new Error('Failed to fetch appointment types');
        return res.json();
      }
    },
  });

  // Fetch carriers
  const { data: carriers = [] } = useQuery({
    queryKey: ['/api/carriers'],
  });

  // Fetch available time slots when needed
  const selectedAppointmentTypeId = form.watch('appointmentTypeId');
  const appointmentDate = form.watch('appointmentDate');

  useEffect(() => {
    if (selectedFacilityId && selectedAppointmentTypeId && appointmentDate && step === 2) {
      fetchAvailableTimeSlots();
    }
  }, [selectedFacilityId, selectedAppointmentTypeId, appointmentDate, step]);

  const fetchAvailableTimeSlots = async () => {
    if (!appointmentDate) return;
    
    setIsLoadingTimeSlots(true);
    try {
      const dateStr = format(appointmentDate, 'yyyy-MM-dd');
      let url = `/api/availability?date=${dateStr}&facilityId=${selectedFacilityId}&typeId=${selectedAppointmentTypeId}`;
      
      // For external mode, include booking page context
      if (mode === 'external' && bookingPageSlug) {
        url += `&bookingPageSlug=${encodeURIComponent(bookingPageSlug)}`;
      }
      
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch available times');
      
      const data = await res.json();
      setAvailableTimeSlots(data.availableSlots || []);
    } catch (error) {
      console.error('Error fetching time slots:', error);
      toast({
        title: 'Error',
        description: 'Failed to load available time slots',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingTimeSlots(false);
    }
  };

  // Create/Update mutation
  const appointmentMutation = useMutation({
    mutationFn: async (data: AppointmentFormData) => {
      const payload = {
        ...data,
        startTime: new Date(`${format(data.appointmentDate, 'yyyy-MM-dd')}T${data.startTime}`),
        endTime: new Date(`${format(data.appointmentDate, 'yyyy-MM-dd')}T${data.endTime}`),
        status: 'scheduled',
        createdVia: mode,
      };

      if (editMode === 'edit' && appointmentId) {
        const res = await apiRequest('PUT', `/api/schedules/${appointmentId}`, payload);
        return res.json();
      } else {
        // Use unified endpoint that handles both internal and external
        const endpoint = mode === 'internal' ? '/api/schedules' : '/api/schedules/external';
        const res = await apiRequest('POST', endpoint, payload);
        return res.json();
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/schedules'] });
      toast({
        title: editMode === 'edit' ? 'Appointment Updated' : 'Appointment Created',
        description: editMode === 'edit' 
          ? 'The appointment has been successfully updated.' 
          : `Appointment created successfully. ${data.confirmationCode ? `Confirmation: ${data.confirmationCode}` : ''}`,
      });
      // Safely call onSuccess if it exists
      if (onSuccess) {
        onSuccess(data);
      }
      if (mode === 'internal') {
        onClose();
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save appointment',
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = (data: AppointmentFormData) => {
    appointmentMutation.mutate(data);
  };

  const handleNextStep = () => {
    if (step === 1) {
      // Validate facility and appointment type selection
      const facilityId = form.getValues('facilityId');
      const appointmentTypeId = form.getValues('appointmentTypeId');
      
      if (!facilityId || !appointmentTypeId) {
        toast({
          title: 'Required Fields',
          description: 'Please select both facility and appointment type',
          variant: 'destructive',
        });
        return;
      }
      setStep(2);
    } else if (step === 2) {
      setStep(3);
    }
  };

  const renderStepContent = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
              <FormField
                control={form.control}
                name="facilityId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Facility *</FormLabel>
                    <Select 
                      value={field.value?.toString() || ''} 
                      onValueChange={(value) => field.onChange(parseInt(value))}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a facility" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Array.isArray(facilities) && facilities.map((facility: any) => (
                          <SelectItem key={facility.id} value={facility.id.toString()}>
                            {facility.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="appointmentTypeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Appointment Type *</FormLabel>
                    <Select 
                      value={field.value?.toString() || ''} 
                      onValueChange={(value) => field.onChange(parseInt(value))}
                      disabled={!selectedFacilityId}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={
                            selectedFacilityId ? "Select appointment type" : "Select facility first"
                          } />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Array.isArray(appointmentTypes) && appointmentTypes.map((type: any) => (
                          <SelectItem key={type.id} value={type.id.toString()}>
                            {type.name} ({type.duration} min)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="pickupOrDropoff"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="dropoff">Drop-off</SelectItem>
                        <SelectItem value="pickup">Pickup</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end">
              <Button onClick={handleNextStep} type="button">
                Next <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <FormField
              control={form.control}
              name="appointmentDate"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Appointment Date *</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value ? format(field.value, "PPP") : "Pick a date"}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        disabled={(date) => date < startOfDay(new Date())}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            {isLoadingTimeSlots ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span className="ml-2">Loading available times...</span>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="startTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Time *</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select time" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Array.isArray(availableTimeSlots) && availableTimeSlots.map((slot: any) => (
                            <SelectItem key={slot.start} value={slot.start}>
                              {slot.start}
                            </SelectItem>
                          ))}
                          {!Array.isArray(availableTimeSlots) || availableTimeSlots.length === 0 ? (
                            <SelectItem value="" disabled>
                              No time slots available
                            </SelectItem>
                          ) : null}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="endTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>End Time *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Auto-calculated" readOnly />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)} type="button">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
              </Button>
              <Button onClick={handleNextStep} type="button">
                Next <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="companyName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company Name *</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="contactName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact Name *</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email *</FormLabel>
                    <FormControl>
                      <Input {...field} type="email" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone *</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="driverName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Driver Name *</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="truckNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Truck Number *</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={3} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(2)} type="button">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
              </Button>
              <Button 
                type="submit" 
                disabled={appointmentMutation.isPending}
                onClick={form.handleSubmit(handleSubmit)}
              >
                {appointmentMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editMode === 'edit' ? 'Update Appointment' : 'Create Appointment'}
              </Button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  // Render as dialog for internal mode, or as standalone component for external
  if (mode === 'internal') {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editMode === 'edit' ? 'Edit Appointment' : 'Create Appointment'}
            </DialogTitle>
            <DialogDescription>
              Step {step} of 3: {
                step === 1 ? 'Select service' : 
                step === 2 ? 'Choose date & time' : 
                'Enter details'
              }
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            {renderStepContent()}
          </Form>
        </DialogContent>
      </Dialog>
    );
  }

  // External mode - standalone component
  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold">Book Your Appointment</h2>
        <p className="text-muted-foreground">
          Step {step} of 3: {
            step === 1 ? 'Select service' : 
            step === 2 ? 'Choose date & time' : 
            'Enter details'
          }
        </p>
      </div>
      <Form {...form}>
        {renderStepContent()}
      </Form>
    </div>
  );
} 