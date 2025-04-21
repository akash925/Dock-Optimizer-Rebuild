import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter as Router } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ExternalBooking from '@/pages/external-booking-refactored';

// Mock the fetch API for testing
global.fetch = jest.fn();

// Mock date-fns-tz to handle timezone conversions predictably
jest.mock('date-fns-tz', () => ({
  formatInTimeZone: jest.fn().mockImplementation(() => '2025-04-21T09:00:00.000Z'),
  toZonedTime: jest.fn().mockImplementation((date) => date)
}));

// Create a new QueryClient for each test
const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

describe('External Booking Wizard E2E', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    
    // Mock API responses
    (global.fetch as jest.Mock).mockImplementation((url) => {
      if (url.includes('/api/booking-pages/slug/')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            id: 1,
            name: 'Test Booking Page',
            slug: 'test-page',
            title: 'Schedule an Appointment',
            description: 'Book your appointment with us',
            isActive: true
          })
        });
      }
      
      if (url.includes('/api/facilities')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([
            {
              id: 1,
              name: 'Test Facility',
              timezone: 'America/New_York'
            }
          ])
        });
      }
      
      if (url.includes('/api/appointment-types')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([
            {
              id: 1,
              name: 'Test Appointment Type',
              facilityId: 1,
              duration: 60
            }
          ])
        });
      }
      
      if (url.includes('/api/carriers/search')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([
            {
              id: 1,
              name: 'Test Carrier',
              mcNumber: '123-456-7890'
            }
          ])
        });
      }
      
      if (url.includes('/api/external-booking')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            schedule: { id: 1 },
            confirmationNumber: 'CONF123'
          })
        });
      }
      
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve([])
      });
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  test('Complete booking flow with all steps', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <Router>
          <ExternalBooking />
        </Router>
      </QueryClientProvider>
    );
    
    // Wait for the page to load
    await waitFor(() => expect(screen.getByText('Schedule an Appointment')).toBeInTheDocument());
    
    // STEP 1: Basic Details
    await waitFor(() => expect(screen.getByText('Select a location')).toBeInTheDocument());
    
    // Select location
    fireEvent.click(screen.getByText('Select a location'));
    await waitFor(() => expect(screen.getByText('Test Facility')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Test Facility'));
    
    // Select appointment type
    fireEvent.click(screen.getByText('Select an appointment type'));
    await waitFor(() => expect(screen.getByText('Test Appointment Type')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Test Appointment Type'));
    
    // Select dropoff (inbound)
    fireEvent.click(screen.getByLabelText('Dropoff (Inbound)'));
    
    // Upload BOL file
    const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });
    const fileInput = screen.getByTestId('bolFile');
    Object.defineProperty(fileInput, 'files', {
      value: [file]
    });
    fireEvent.change(fileInput);
    
    // Continue to next step
    fireEvent.click(screen.getByText('Continue'));
    
    // STEP 2: Company Information
    await waitFor(() => expect(screen.getByText('Company Information')).toBeInTheDocument());
    
    // Fill company info
    fireEvent.change(screen.getByLabelText('Company Name*'), { target: { value: 'Test Company' } });
    fireEvent.change(screen.getByLabelText('Contact Name*'), { target: { value: 'John Doe' } });
    fireEvent.change(screen.getByLabelText('Email Address*'), { target: { value: 'john@example.com' } });
    fireEvent.change(screen.getByLabelText('Phone Number*'), { target: { value: '555-111-2222' } });
    
    // Continue to next step
    fireEvent.click(screen.getByText('Continue'));
    
    // STEP 3: Appointment Details
    await waitFor(() => expect(screen.getByText('Appointment Details')).toBeInTheDocument());
    
    // Set date and time
    fireEvent.change(screen.getByLabelText('Appointment Date*'), { target: { value: '2025-04-21' } });
    fireEvent.change(screen.getByLabelText('Appointment Time*'), { target: { value: '09:00' } });
    
    // Select carrier
    fireEvent.click(screen.getByText('Select carrier...'));
    await waitFor(() => expect(screen.getByText('Test Carrier')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Test Carrier'));
    
    // Enter MC number
    fireEvent.change(screen.getByLabelText('MC Number'), { target: { value: '123-456-7890' } });
    
    // Fill driver info
    fireEvent.change(screen.getByLabelText('Truck Number*'), { target: { value: 'TRUCK001' } });
    fireEvent.change(screen.getByLabelText('Trailer Number'), { target: { value: 'TRAILER001' } });
    fireEvent.change(screen.getByLabelText('Driver Name*'), { target: { value: 'Jane Driver' } });
    fireEvent.change(screen.getByLabelText('Driver Phone*'), { target: { value: '555-222-3333' } });
    
    // Fill shipment details
    fireEvent.change(screen.getByLabelText('BOL Number'), { target: { value: 'BOL252300768' } });
    fireEvent.change(screen.getByLabelText('Pallet Count'), { target: { value: '12' } });
    fireEvent.change(screen.getByLabelText('Weight'), { target: { value: '10000 KGS' } });
    fireEvent.change(screen.getByLabelText('Additional Notes'), { target: { value: 'Test notes' } });
    
    // Submit booking
    fireEvent.click(screen.getByText('Schedule Appointment'));
    
    // Verify submission and navigation
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/external-booking', expect.any(Object));
    });
    
    // Check the data sent to the API
    const mockCalls = (global.fetch as jest.Mock).mock.calls;
    const lastCall = mockCalls[mockCalls.length - 1];
    const requestOptions = lastCall[1];
    const requestBody = JSON.parse(requestOptions.body);
    
    // Verify all the key values are correctly passed
    expect(requestBody.carrierName).toBe('Test Carrier');
    expect(requestBody.mcNumber).toBe('123-456-7890');
    expect(requestBody.driverName).toBe('Jane Driver');
    expect(requestBody.driverPhone).toBe('555-222-3333');
    expect(requestBody.appointmentDate).toBe('2025-04-21');
    expect(requestBody.appointmentTime).toBe('09:00');
    expect(requestBody.bolNumber).toBe('BOL252300768');
    expect(requestBody.weight).toBe('10000 KGS');
  });
});