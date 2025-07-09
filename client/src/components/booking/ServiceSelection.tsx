import React from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { MapPin, Clock, Users } from 'lucide-react';

interface ServiceSelectionProps {
  bookingPage: {
    facilities: Array<{
      id: number;
      name: string;
      address1: string;
      city: string;
      state: string;
    }>;
    appointmentTypes: Array<{
      id: number;
      name: string;
      description?: string;
      duration: number;
      maxConcurrent?: number;
      showRemainingSlots?: boolean;
    }>;
  };
  selectedFacilityId?: number;
  selectedAppointmentTypeId?: number;
  onFacilityChange: (facilityId: number) => void;
  onAppointmentTypeChange: (appointmentTypeId: number) => void;
  onNext: () => void;
}

export function ServiceSelection({
  bookingPage,
  selectedFacilityId,
  selectedAppointmentTypeId,
  onFacilityChange,
  onAppointmentTypeChange,
  onNext
}: ServiceSelectionProps) {
  const isValid = selectedFacilityId && selectedAppointmentTypeId;
  
  const selectedFacility = bookingPage.facilities.find(f => f.id === selectedFacilityId);
  const selectedAppointmentType = bookingPage.appointmentTypes.find(t => t.id === selectedAppointmentTypeId);

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">Select Service</h2>
        <p className="text-muted-foreground">
          Choose the facility and type of appointment you need
        </p>
      </div>

      <div className="grid gap-6">
        {/* Facility Selection */}
        <div className="space-y-3">
          <Label htmlFor="facility-select" className="text-lg font-semibold flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Select Facility
          </Label>
          <Select
            value={selectedFacilityId?.toString()}
            onValueChange={(value) => onFacilityChange(parseInt(value))}
          >
            <SelectTrigger id="facility-select" className="h-12">
              <SelectValue placeholder="Choose a facility..." />
            </SelectTrigger>
            <SelectContent>
              {bookingPage.facilities.map((facility) => (
                <SelectItem key={facility.id} value={facility.id.toString()}>
                  <div className="flex flex-col items-start">
                    <span className="font-medium">{facility.name}</span>
                    <span className="text-sm text-muted-foreground">
                      {facility.address1}, {facility.city}, {facility.state}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          {selectedFacility && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-2 text-blue-700">
                <MapPin className="h-4 w-4" />
                <span className="font-medium">{selectedFacility.name}</span>
              </div>
              <p className="text-sm text-blue-600 mt-1">
                {selectedFacility.address1}, {selectedFacility.city}, {selectedFacility.state}
              </p>
            </div>
          )}
        </div>

        {/* Appointment Type Selection */}
        <div className="space-y-3">
          <Label htmlFor="appointment-type-select" className="text-lg font-semibold flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Select Appointment Type
          </Label>
          <Select
            value={selectedAppointmentTypeId?.toString()}
            onValueChange={(value) => onAppointmentTypeChange(parseInt(value))}
          >
            <SelectTrigger id="appointment-type-select" className="h-12">
              <SelectValue placeholder="Choose an appointment type..." />
            </SelectTrigger>
            <SelectContent>
              {bookingPage.appointmentTypes.map((type) => (
                <SelectItem key={type.id} value={type.id.toString()}>
                  <div className="flex flex-col items-start">
                    <span className="font-medium">{type.name}</span>
                    {type.description && (
                      <span className="text-sm text-muted-foreground">{type.description}</span>
                    )}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {type.duration} min
                      </span>
                      {type.maxConcurrent && (
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {type.maxConcurrent} concurrent
                        </span>
                      )}
                    </div>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selectedAppointmentType && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-2 text-green-700">
                <Clock className="h-4 w-4" />
                <span className="font-medium">{selectedAppointmentType.name}</span>
              </div>
              <div className="flex items-center gap-4 text-sm text-green-600 mt-1">
                <span>Duration: {selectedAppointmentType.duration} minutes</span>
                {selectedAppointmentType.maxConcurrent && (
                  <span>Max Concurrent: {selectedAppointmentType.maxConcurrent}</span>
                )}
              </div>
              {selectedAppointmentType.description && (
                <p className="text-sm text-green-600 mt-1">{selectedAppointmentType.description}</p>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end pt-6">
        <Button 
          onClick={onNext}
          disabled={!isValid}
          size="lg"
          className="min-w-32"
        >
          Next: Select Date & Time
        </Button>
      </div>
    </div>
  );
} 