import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { BookingWizardProvider, useBookingWizard } from '@/contexts/BookingWizardContext';

// Test component that uses the context
function TestComponent() {
  const { 
    bookingData, 
    resetBooking, 
    updateTruckInfo, 
    updateScheduleDetails,
    setBolFile, 
    setAppointmentDateTime 
  } = useBookingWizard();
  
  return (
    <div>
      <div data-testid="booking-data">{JSON.stringify(bookingData)}</div>
      <button data-testid="reset-button" onClick={() => resetBooking()}>Reset</button>
      <button data-testid="update-truck-info" onClick={() => updateTruckInfo({ carrierName: 'Test Carrier', mcNumber: '123-456-7890' })}>Update Truck Info</button>
      <button data-testid="update-schedule-details" onClick={() => updateScheduleDetails({ bolNumber: 'BOL123', facilityId: 5 })}>Update Schedule Details</button>
      <button data-testid="set-bol-file" onClick={() => {
        const mockFile = new File(['test'], 'test.pdf', { type: 'application/pdf' });
        setBolFile(mockFile, 'This is a test BOL file');
      }}>Set BOL File</button>
      <button data-testid="set-date-time" onClick={() => setAppointmentDateTime('2025-04-21', '09:00', 'America/New_York')}>Set Date Time</button>
    </div>
  );
}

describe('BookingWizardContext', () => {
  test('initializes with default state', () => {
    render(
      <BookingWizardProvider>
        <TestComponent />
      </BookingWizardProvider>
    );
    
    const bookingDataElement = screen.getByTestId('booking-data');
    const bookingData = JSON.parse(bookingDataElement.textContent || '{}');
    
    // Check for default values
    expect(bookingData.carrierId).toBeNull();
    expect(bookingData.carrierName).toBe('');
    expect(bookingData.mcNumber).toBe('');
    expect(bookingData.type).toBe('inbound');
  });
  
  test('updates truck info correctly', () => {
    render(
      <BookingWizardProvider>
        <TestComponent />
      </BookingWizardProvider>
    );
    
    // Click the button to update truck info
    fireEvent.click(screen.getByTestId('update-truck-info'));
    
    // Verify the state was updated
    const bookingDataElement = screen.getByTestId('booking-data');
    const bookingData = JSON.parse(bookingDataElement.textContent || '{}');
    
    expect(bookingData.carrierName).toBe('Test Carrier');
    expect(bookingData.mcNumber).toBe('123-456-7890');
  });
  
  test('updates schedule details correctly', () => {
    render(
      <BookingWizardProvider>
        <TestComponent />
      </BookingWizardProvider>
    );
    
    // Click the button to update schedule details
    fireEvent.click(screen.getByTestId('update-schedule-details'));
    
    // Verify the state was updated
    const bookingDataElement = screen.getByTestId('booking-data');
    const bookingData = JSON.parse(bookingDataElement.textContent || '{}');
    
    expect(bookingData.bolNumber).toBe('BOL123');
    expect(bookingData.facilityId).toBe(5);
  });
  
  test('sets BOL file correctly', () => {
    render(
      <BookingWizardProvider>
        <TestComponent />
      </BookingWizardProvider>
    );
    
    // Click the button to set BOL file
    fireEvent.click(screen.getByTestId('set-bol-file'));
    
    // Verify the state was updated
    const bookingDataElement = screen.getByTestId('booking-data');
    const bookingData = JSON.parse(bookingDataElement.textContent || '{}');
    
    expect(bookingData.bolFile).not.toBeNull();
    expect(bookingData.bolPreviewText).toBe('This is a test BOL file');
  });
  
  test('sets appointment date and time correctly', () => {
    render(
      <BookingWizardProvider>
        <TestComponent />
      </BookingWizardProvider>
    );
    
    // Click the button to set date and time
    fireEvent.click(screen.getByTestId('set-date-time'));
    
    // Verify the state was updated
    const bookingDataElement = screen.getByTestId('booking-data');
    const bookingData = JSON.parse(bookingDataElement.textContent || '{}');
    
    expect(bookingData.appointmentDate).toBe('2025-04-21');
    expect(bookingData.appointmentTime).toBe('09:00');
    expect(bookingData.appointmentDateTime).toBeTruthy(); // Should be a UTC ISO string
  });
  
  test('reset functionality works correctly', () => {
    render(
      <BookingWizardProvider>
        <TestComponent />
      </BookingWizardProvider>
    );
    
    // First update some values
    fireEvent.click(screen.getByTestId('update-truck-info'));
    fireEvent.click(screen.getByTestId('update-schedule-details'));
    
    // Then reset
    fireEvent.click(screen.getByTestId('reset-button'));
    
    // Verify the state was reset
    const bookingDataElement = screen.getByTestId('booking-data');
    const bookingData = JSON.parse(bookingDataElement.textContent || '{}');
    
    expect(bookingData.carrierName).toBe('');
    expect(bookingData.mcNumber).toBe('');
    expect(bookingData.bolNumber).toBe('');
    expect(bookingData.facilityId).toBeNull();
  });
  
  test('can initialize with custom data', () => {
    render(
      <BookingWizardProvider initialData={{ 
        carrierName: 'Initial Carrier',
        type: 'outbound'
      }}>
        <TestComponent />
      </BookingWizardProvider>
    );
    
    const bookingDataElement = screen.getByTestId('booking-data');
    const bookingData = JSON.parse(bookingDataElement.textContent || '{}');
    
    expect(bookingData.carrierName).toBe('Initial Carrier');
    expect(bookingData.type).toBe('outbound');
  });
  
  test('steps maintain independent data integrity', () => {
    render(
      <BookingWizardProvider>
        <TestComponent />
      </BookingWizardProvider>
    );
    
    // Step 1: Update truck info
    fireEvent.click(screen.getByTestId('update-truck-info'));
    
    // Step 2: Update schedule details 
    fireEvent.click(screen.getByTestId('update-schedule-details'));
    
    // Verify both sets of data are preserved
    const bookingDataElement = screen.getByTestId('booking-data');
    const bookingData = JSON.parse(bookingDataElement.textContent || '{}');
    
    // Truck info from step 1 is preserved
    expect(bookingData.carrierName).toBe('Test Carrier');
    expect(bookingData.mcNumber).toBe('123-456-7890');
    
    // Schedule details from step 2 are preserved
    expect(bookingData.bolNumber).toBe('BOL123');
    expect(bookingData.facilityId).toBe(5);
  });
});