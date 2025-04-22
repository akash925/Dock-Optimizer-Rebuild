import React from 'react';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BookingWizardProvider } from '@/contexts/BookingWizardContext';
import { BookingThemeProvider } from '@/contexts/BookingThemeContext';
import ExternalBooking from '@/pages/external-booking-fixed';

// Mock window.matchMedia for testing responsive layouts
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock the routing
jest.mock('wouter', () => ({
  useRoute: () => [true, { slug: 'test-booking-page' }],
  Link: ({ children }: { children: React.ReactNode }) => <a href="#">{children}</a>,
}));

// Mock the queries
jest.mock('@tanstack/react-query', () => {
  const originalModule = jest.requireActual('@tanstack/react-query');
  return {
    ...originalModule,
    useQuery: jest.fn().mockImplementation(({ queryKey }) => {
      if (Array.isArray(queryKey) && queryKey[0].includes('booking-pages/slug')) {
        return {
          data: {
            id: 1,
            name: 'Test Booking Page',
            slug: 'test-booking-page',
            description: 'Test Description',
            isActive: true,
            facilities: [1, 2, 3]
          },
          isLoading: false,
          error: null
        };
      }
      
      if (Array.isArray(queryKey) && queryKey[0] === '/api/facilities') {
        return {
          data: [
            { id: 1, name: 'Test Facility 1' },
            { id: 2, name: 'Test Facility 2' },
            { id: 3, name: 'Test Facility 3' }
          ],
          isLoading: false
        };
      }
      
      if (Array.isArray(queryKey) && queryKey[0] === '/api/appointment-types') {
        return {
          data: [
            { 
              id: 1, 
              name: '1 Hour Appointment', 
              facilityId: 1, 
              duration: 60,
              type: 'both'
            },
            { 
              id: 2, 
              name: '2 Hour Appointment', 
              facilityId: 1, 
              duration: 120,
              type: 'both'
            },
            { 
              id: 3, 
              name: '4 Hour Appointment', 
              facilityId: 1, 
              duration: 240,
              type: 'both'
            }
          ],
          isLoading: false
        };
      }
      
      return { data: undefined, isLoading: false, error: null };
    })
  };
});

// Mock assets
jest.mock('@assets/hanzo logo.jpeg', () => 'hanzo-logo.jpeg');

describe('External Booking Step 1', () => {
  // Set up the QueryClient for tests
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  
  // Desktop viewport test
  test('renders correctly on desktop', () => {
    // Mock desktop viewport
    window.matchMedia = jest.fn().mockImplementation(query => ({
      matches: query.includes('(min-width: 768px)'),
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    }));
    
    const { container, getByText } = render(
      <QueryClientProvider client={queryClient}>
        <BookingThemeProvider slug="test-booking-page">
          <BookingWizardProvider>
            <ExternalBooking />
          </BookingWizardProvider>
        </BookingThemeProvider>
      </QueryClientProvider>
    );
    
    // Verify key elements are in the DOM
    expect(getByText(/Scheduler/i)).toBeInTheDocument();
    expect(getByText(/Schedule Your Appointment/i)).toBeInTheDocument();
    expect(getByText(/Location/i)).toBeInTheDocument();
    expect(getByText(/Dock Appointment Type/i)).toBeInTheDocument();
    expect(getByText(/Pickup or Dropoff/i)).toBeInTheDocument();
    expect(getByText(/Bill of Lading/i)).toBeInTheDocument();
    expect(getByText(/Next/i)).toBeInTheDocument();
    
    // Snapshot the container
    expect(container).toMatchSnapshot('external-booking-step1-desktop');
  });
  
  // Mobile viewport test
  test('renders correctly on mobile', () => {
    // Mock mobile viewport
    window.matchMedia = jest.fn().mockImplementation(query => ({
      matches: query.includes('(max-width: 767px)'),
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    }));
    
    const { container, getByText } = render(
      <QueryClientProvider client={queryClient}>
        <BookingThemeProvider slug="test-booking-page">
          <BookingWizardProvider>
            <ExternalBooking />
          </BookingWizardProvider>
        </BookingThemeProvider>
      </QueryClientProvider>
    );
    
    // Verify key elements are in the DOM
    expect(getByText(/Scheduler/i)).toBeInTheDocument();
    expect(getByText(/Schedule Your Appointment/i)).toBeInTheDocument();
    expect(getByText(/Location/i)).toBeInTheDocument();
    expect(getByText(/Dock Appointment Type/i)).toBeInTheDocument();
    expect(getByText(/Pickup or Dropoff/i)).toBeInTheDocument();
    expect(getByText(/Bill of Lading/i)).toBeInTheDocument();
    expect(getByText(/Next/i)).toBeInTheDocument();
    
    // Snapshot the container
    expect(container).toMatchSnapshot('external-booking-step1-mobile');
  });
  
  // Test form validation and FormContext
  test('form validation works with FormContext', () => {
    const { container, getByText, queryByText } = render(
      <QueryClientProvider client={queryClient}>
        <BookingThemeProvider slug="test-booking-page">
          <BookingWizardProvider>
            <ExternalBooking />
          </BookingWizardProvider>
        </BookingThemeProvider>
      </QueryClientProvider>
    );
    
    // Verify FormContext is working - we should not see any errors about useFormContext() being null
    expect(container).toBeTruthy();
    expect(queryByText(/Cannot destructure/i)).toBeNull();
    expect(queryByText(/cannot read property/i)).toBeNull();
    expect(queryByText(/null is not an object/i)).toBeNull();
    
    // Verify form components are rendered
    expect(getByText(/Location/i)).toBeInTheDocument();
    expect(getByText(/Dock Appointment Type/i)).toBeInTheDocument();
    expect(getByText(/Pickup or Dropoff/i)).toBeInTheDocument();
  });
});