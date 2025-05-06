# Availability Calculation Implementation Guide

This document provides a detailed guide to the implementation of the `calculateAvailabilitySlots` function in Dock Optimizer, which is responsible for determining available appointment slots based on facility hours, break times, appointment types, and existing appointments.

## Function Overview

The `calculateAvailabilitySlots` function is a core component of the booking system that:

1. Calculates available time slots for a specific date, facility, and appointment type
2. Considers facility operating hours and break times
3. Accounts for existing appointments to determine remaining capacity
4. Handles special configurations like `allowAppointmentsThroughBreaks` and `overrideFacilityHours`

## Key Parameters

- `date`: The date to check availability for (format: "YYYY-MM-DD")
- `facilityId`: The ID of the facility
- `appointmentTypeId`: The ID of the appointment type
- `tenantId`: The tenant ID for multi-tenancy isolation

## Implementation Details

### Step 1: Fetch Required Data

First, the function retrieves the necessary data:
- Facility details including operating hours and break times
- Appointment type configuration including duration, buffer time, and special flags
- Existing appointments for the day that might affect availability

### Step 2: Check Facility Availability

The function checks if the facility is open on the requested day:
```typescript
// Get day of week and check if facility is open
const dayOfWeek = new Date(date).getDay();
const dayName = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][dayOfWeek];
const isOpen = facility[`${dayName}Open`];

// Return empty slots if facility is closed
if (!isOpen) {
  return [];
}
```

### Step 3: Determine Slot Intervals and Time Range

The function then calculates the time range and slot interval duration:
```typescript
// Get facility hours for the day
const openTime = facility[`${dayName}Start`];
const closeTime = facility[`${dayName}End`];
const breakStart = facility[`${dayName}BreakStart`];
const breakEnd = facility[`${dayName}BreakEnd`];

// Determine slot interval (in minutes)
const slotIntervalMinutes = appointmentType.bufferTime || 30;
```

### Step 4: Generate Time Slots

The function generates time slots based on the facility's opening hours:
```typescript
const slots = [];
let currentTime = startTime;

while (currentTime < endTime) {
  // Format time as HH:MM
  const timeString = formatTime(currentTime);
  
  // Create a slot
  slots.push({
    time: timeString,
    available: true,
    remainingCapacity: appointmentType.maxConcurrent,
    remaining: appointmentType.maxConcurrent // Legacy property
  });
  
  // Move to next slot
  currentTime.setMinutes(currentTime.getMinutes() + slotIntervalMinutes);
}
```

### Step 5: Handle Break Times

If break times are configured, the function marks slots during break time as unavailable (unless `allowAppointmentsThroughBreaks` is true):
```typescript
if (breakStart && breakEnd && !appointmentType.allowAppointmentsThroughBreaks) {
  slots.forEach(slot => {
    if (isTimeInRange(slot.time, breakStart, breakEnd)) {
      slot.available = false;
      slot.remainingCapacity = 0;
      slot.remaining = 0;
      slot.reason = "Break Time";
    }
  });
}
```

### Step 6: Account for Existing Appointments

The function reduces the capacity of slots based on existing appointments:
```typescript
appointments.forEach(appointment => {
  slots.forEach(slot => {
    // If this slot overlaps with the appointment
    if (doesSlotOverlapAppointment(slot, appointment, slotIntervalMinutes)) {
      slot.remainingCapacity--;
      slot.remaining--;
      
      // Mark as unavailable if no capacity left
      if (slot.remainingCapacity <= 0) {
        slot.available = false;
        slot.reason = "Slot already booked";
      }
    }
  });
});
```

### Step 7: Return Available Slots

Finally, the function returns the calculated slots:
```typescript
return slots;
```

## Special Features

### Appointments Through Break Times

The `allowAppointmentsThroughBreaks` flag controls whether appointments can be scheduled during facility break times. When set to:
- `true`: Slots during break times remain available and can be booked
- `false`: Slots during break times are marked as unavailable with reason "Break Time"

### Facility Hours Override

The `overrideFacilityHours` flag allows appointment types to override standard facility hours:
- `true`: Slots can be generated outside standard facility operating hours
- `false`: Slots are strictly limited to the facility's configured open hours

### Handling Concurrent Appointments

The `maxConcurrent` property determines how many appointments can be scheduled at the same time:
- Each existing appointment reduces the `remainingCapacity` of overlapping slots
- When `remainingCapacity` reaches zero, the slot is marked as unavailable

## Error Handling

The function includes robust error handling:
- If facility or appointment type data is missing, appropriate errors are thrown
- Date parsing errors are caught and reported
- Server errors are properly propagated with HTTP 500 status codes

## Testing

A comprehensive test suite has been implemented covering:
- Basic functionality
- Break time logic
- Capacity and concurrency
- Complex appointment scenarios

For details on test coverage, see the [Availability Calculations Test Coverage](availability-calculations-test-coverage.md) document.

## Best Practices

When working with the availability calculation system:

1. **Always check tenant isolation**: Ensure facility and appointment type belong to the correct tenant
2. **Use transactions for booking**: Wrap availability checks and appointment creation in database transactions
3. **Return standard error codes**: Use HTTP 409 (Conflict) for unavailable slots
4. **Include reason codes**: When slots are unavailable, always include a clear reason
5. **Test timezone handling**: Be mindful of timezone conversions in availability calculations

## Conclusion

The availability calculation system is a critical component of the Dock Optimizer platform. This implementation provides a robust foundation for handling complex scheduling requirements across different facilities, appointment types, and tenant configurations.