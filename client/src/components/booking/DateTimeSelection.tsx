import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { Label } from '@/components/ui/label';
import { Calendar, Clock, AlertCircle, Info } from 'lucide-react';
import { TimeSlotsSelector } from './TimeSlotsSelector';
import { format, addDays, isSunday, isSaturday, isMonday, isTuesday, isWednesday, isThursday, isFriday, getDay, isBefore, startOfDay, isSameDay } from 'date-fns';

interface DateTimeSelectionProps {
  bookingPage: {
    organization?: any;
    appointmentTypes: Array<{
      id: number;
      name: string;
      showRemainingSlots?: boolean;
    }>;
  };
  facility?: {
    id: number;
    name: string;
    timezone?: string;
    [key: string]: any;
  };
  appointmentTypeId?: number;
  selectedDate?: string;
  selectedTime?: string;
  onDateChange: (date: string) => void;
  onTimeChange: (time: string) => void;
  onBack: () => void;
  onNext: () => void;
}

export function DateTimeSelection({
  bookingPage,
  facility,
  appointmentTypeId,
  selectedDate,
  selectedTime,
  onDateChange,
  onTimeChange,
  onBack,
  onNext
}: DateTimeSelectionProps) {
  const appointmentType = bookingPage.appointmentTypes.find(t => t.id === appointmentTypeId);

  // Business hours checking logic
  const isDateClosed = (date: Date) => {
    if (!facility) return false;
    
    const dayOfWeek = getDay(date);
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayName = dayNames[dayOfWeek];
    
    const dayOpenProperties = [
      `${dayName}Open`,
      `${dayName}_open`,
      `${dayName}Open`.replace(dayName, dayName.charAt(0).toUpperCase() + dayName.slice(1))
    ];
    
    let dayOpen = false;
    
    // Check facility hours first (most specific)
    for (const prop of dayOpenProperties) {
      if (facility.hasOwnProperty(prop) && facility[prop] !== null && facility[prop] !== undefined) {
        dayOpen = Boolean(facility[prop]);
        break;
      }
    }
    
    // If no specific facility hours found, use organization hours if available
    if (!dayOpen && bookingPage?.organization) {
      const org = bookingPage.organization;
      
      for (const prop of dayOpenProperties) {
        if (org.hasOwnProperty(prop) && org[prop] !== null && org[prop] !== undefined) {
          dayOpen = Boolean(org[prop]);
          break;
        }
      }
    }
    
    // Default logic: weekdays are open, weekends are closed (if no explicit configuration)
    if (!dayOpen && dayOfWeek >= 1 && dayOfWeek <= 5) {
      dayOpen = true; // Default weekdays to open
    }

    return !dayOpen;
  };

  const isHoliday = (date: Date) => {
    // Check organization holidays
    if (bookingPage?.organization?.holidays) {
      return bookingPage.organization.holidays.some((holiday: any) => {
        const holidayDate = new Date(holiday.date);
        return isSameDay(date, holidayDate);
      });
    }
    
    // Check facility holidays
    if (facility?.holidays) {
      return facility.holidays.some((holiday: any) => {
        const holidayDate = new Date(holiday.date);
        return isSameDay(date, holidayDate);
      });
    }
    
    return false;
  };

  const findNextAvailableDate = () => {
    const maxDays = 60; // Check up to 60 days ahead
    let currentDate = new Date();
    
    for (let i = 0; i < maxDays; i++) {
      const checkDate = addDays(currentDate, i);
      
      // Skip if date is closed or holiday
      if (!isDateClosed(checkDate) && !isHoliday(checkDate)) {
        return format(checkDate, 'yyyy-MM-dd');
      }
    }
    
    // Fallback to tomorrow if no available date found
    return format(addDays(currentDate, 1), 'yyyy-MM-dd');
  };

  const nextAvailableDate = useMemo(() => {
    if (!facility) return null;
    return findNextAvailableDate();
  }, [facility, bookingPage]);

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      const dateStr = format(date, 'yyyy-MM-dd');
      onDateChange(dateStr);
      
      // Clear selected time when date changes
      if (selectedTime) {
        onTimeChange('');
      }
    }
  };

  const isDateDisabled = (date: Date) => {
    // Disable past dates
    if (isBefore(date, startOfDay(new Date()))) {
      return true;
    }
    
    // Check if date is closed or holiday
    return isDateClosed(date) || isHoliday(date);
  };

  const selectedDateObj = selectedDate ? new Date(selectedDate) : undefined;
  const isValid = selectedDate && selectedTime;

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">Select Date & Time</h2>
        <p className="text-muted-foreground">
          Choose when you'd like your {appointmentType?.name || 'appointment'}
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Date Selection */}
        <div className="space-y-4">
          <Label className="text-lg font-semibold flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Select Date
          </Label>
          
          <DatePicker
            date={selectedDateObj}
            onDateChange={handleDateSelect}
            disabledDays={isDateDisabled}
          />

          {nextAvailableDate && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-2 text-blue-700">
                <Info className="h-4 w-4" />
                <span className="text-sm font-medium">Next available date</span>
              </div>
              <p className="text-sm text-blue-600 mt-1">
                {new Date(nextAvailableDate).toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onDateChange(nextAvailableDate);
                  if (selectedTime) onTimeChange('');
                }}
                className="mt-2"
              >
                Select This Date
              </Button>
            </div>
          )}
        </div>

        {/* Time Selection */}
        <div className="space-y-4">
          <Label className="text-lg font-semibold flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Select Time
          </Label>
          
          {selectedDate ? (
            <TimeSlotsSelector
              date={selectedDate}
              facilityId={facility?.id}
              appointmentTypeId={appointmentTypeId}
              onSelectTime={onTimeChange}
              selectedTime={selectedTime}
              showRemainingSlots={appointmentType?.showRemainingSlots}
            />
          ) : (
            <div className="p-8 bg-gray-50 border border-gray-200 rounded-lg text-center">
              <Calendar className="h-12 w-12 mx-auto text-gray-400 mb-3" />
              <p className="text-gray-500">Please select a date first</p>
            </div>
          )}
        </div>
      </div>

      {/* Selected date/time summary */}
      {selectedDate && selectedTime && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center gap-2 text-green-700 mb-2">
            <Calendar className="h-5 w-5" />
            <span className="font-semibold">Selected Appointment Time</span>
          </div>
          <p className="text-green-800">
            {new Date(selectedDate).toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })} at {selectedTime}
          </p>
          {facility?.timezone && (
            <p className="text-sm text-green-600 mt-1">
              Time zone: {facility.timezone}
            </p>
          )}
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between pt-6">
        <Button
          variant="outline" 
          onClick={onBack}
          size="lg"
        >
          Back
        </Button>
        <Button 
          onClick={onNext}
          disabled={!isValid}
          size="lg"
          className="min-w-32"
        >
          Next: Details & Upload
        </Button>
      </div>
    </div>
  );
} 