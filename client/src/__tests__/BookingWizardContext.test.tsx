import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { BookingWizardProvider, useBookingWizard } from '../contexts/BookingWizardContext';

// Test component that uses the context
function TestComponent() {
  const { 
    currentStep, 
    setCurrentStep, 
    bookingData, 
    updateBookingData,
    resetBookingData
  } = useBookingWizard();
  
  return (
    <div>
      <h1 data-testid="step">Step: {currentStep}</h1>
      <button 
        data-testid="next-step" 
        onClick={() => setCurrentStep(currentStep + 1)}
      >
        Next Step
      </button>
      
      <div data-testid="company-name">Company: {bookingData.companyName}</div>
      <button 
        data-testid="update-company" 
        onClick={() => updateBookingData({ companyName: 'Test Company' })}
      >
        Set Company
      </button>
      
      <div data-testid="appointment-type">
        Appointment Type: {bookingData.appointmentTypeId?.toString() || 'None'}
      </div>
      <button 
        data-testid="update-appointment-type" 
        onClick={() => updateBookingData({ appointmentTypeId: 123 })}
      >
        Set Appointment Type
      </button>
      
      <button data-testid="reset" onClick={resetBookingData}>
        Reset Form
      </button>
    </div>
  );
}

// Tests
describe('BookingWizardContext', () => {
  test('provides the current step and allows changing it', () => {
    render(
      <BookingWizardProvider>
        <TestComponent />
      </BookingWizardProvider>
    );
    
    expect(screen.getByTestId('step').textContent).toBe('Step: 1');
    act(() => {
      screen.getByTestId('next-step').click();
    });
    expect(screen.getByTestId('step').textContent).toBe('Step: 2');
  });
  
  test('allows updating booking data', () => {
    render(
      <BookingWizardProvider>
        <TestComponent />
      </BookingWizardProvider>
    );
    
    expect(screen.getByTestId('company-name').textContent).toBe('Company: ');
    act(() => {
      screen.getByTestId('update-company').click();
    });
    expect(screen.getByTestId('company-name').textContent).toBe('Company: Test Company');
  });
  
  test('allows updating numeric fields', () => {
    render(
      <BookingWizardProvider>
        <TestComponent />
      </BookingWizardProvider>
    );
    
    expect(screen.getByTestId('appointment-type').textContent).toBe('Appointment Type: None');
    act(() => {
      screen.getByTestId('update-appointment-type').click();
    });
    expect(screen.getByTestId('appointment-type').textContent).toBe('Appointment Type: 123');
  });
  
  test('allows resetting form data', () => {
    render(
      <BookingWizardProvider>
        <TestComponent />
      </BookingWizardProvider>
    );
    
    // Set some data first
    act(() => {
      screen.getByTestId('update-company').click();
      screen.getByTestId('update-appointment-type').click();
      screen.getByTestId('next-step').click();
    });
    
    expect(screen.getByTestId('company-name').textContent).toBe('Company: Test Company');
    expect(screen.getByTestId('appointment-type').textContent).toBe('Appointment Type: 123');
    expect(screen.getByTestId('step').textContent).toBe('Step: 2');
    
    // Reset the form
    act(() => {
      screen.getByTestId('reset').click();
    });
    
    // Verify everything is reset
    expect(screen.getByTestId('company-name').textContent).toBe('Company: ');
    expect(screen.getByTestId('appointment-type').textContent).toBe('Appointment Type: None');
    expect(screen.getByTestId('step').textContent).toBe('Step: 1');
  });
  
  test('persists values when navigating between steps', () => {
    render(
      <BookingWizardProvider>
        <TestComponent />
      </BookingWizardProvider>
    );
    
    // Set data in step 1
    act(() => {
      screen.getByTestId('update-company').click();
      screen.getByTestId('update-appointment-type').click();
    });
    
    // Move to step 2
    act(() => {
      screen.getByTestId('next-step').click();
    });
    
    // Verify data persists in step 2
    expect(screen.getByTestId('company-name').textContent).toBe('Company: Test Company');
    expect(screen.getByTestId('appointment-type').textContent).toBe('Appointment Type: 123');
  });
  
  test('maintains separate values for different fields', () => {
    render(
      <BookingWizardProvider>
        <TestComponent />
      </BookingWizardProvider>
    );
    
    // Update only company name
    act(() => {
      screen.getByTestId('update-company').click();
    });
    
    // Verify appointment type is still default
    expect(screen.getByTestId('company-name').textContent).toBe('Company: Test Company');
    expect(screen.getByTestId('appointment-type').textContent).toBe('Appointment Type: None');
    
    // Update only appointment type
    act(() => {
      screen.getByTestId('reset').click();
      screen.getByTestId('update-appointment-type').click();
    });
    
    // Verify company name is still default
    expect(screen.getByTestId('company-name').textContent).toBe('Company: ');
    expect(screen.getByTestId('appointment-type').textContent).toBe('Appointment Type: 123');
  });
});