import React, { createContext, useContext, useState, ReactNode } from 'react';

// Define the booking data interface
interface BookingFormData {
  // Step 1: Select Service
  facilityId: number | null;
  appointmentTypeId: number | null;
  pickupOrDropoff: string; // "pickup" or "dropoff"
  
  // BOL Data
  bolFile?: File | null;
  bolFileUploaded: boolean;
  bolPreviewText?: string;
  bolExtractedData?: {
    bolNumber?: string;
    customerName?: string;
    carrierName?: string;
    mcNumber?: string;
    driverName?: string;
    driverPhone?: string;
    appointmentDate?: Date;
    weight?: string;
    notes?: string;
  };
  
  // Step 2: Select Date and Time
  startTime: Date | null; 
  endTime: Date | null;
  timezone: string;
  facilityTimezone?: string; // Facility timezone if different from user timezone
  
  // Step 3: Customer Information
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  customerRef: string;
  
  // Vehicle Information
  carrierName: string;
  driverName: string;
  driverPhone: string;
  mcNumber?: string; // MC Number for carrier
  truckNumber: string;
  trailerNumber: string;
  
  // Additional Information
  notes: string;
  
  // Custom Questions answers
  customFields: Record<string, string>;
}

// Default empty state
const defaultBookingData: BookingFormData = {
  facilityId: null,
  appointmentTypeId: null,
  pickupOrDropoff: '',
  bolFileUploaded: false,
  startTime: null,
  endTime: null,
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  companyName: '',
  contactName: '',
  email: '',
  phone: '',
  customerRef: '',
  carrierName: '',
  driverName: '',
  driverPhone: '',
  truckNumber: '',
  trailerNumber: '',
  notes: '',
  customFields: {},
  bolExtractedData: {
    bolNumber: '',
    customerName: '',
    carrierName: '',
    mcNumber: '',
    driverName: '',
    driverPhone: '',
    weight: '',
    notes: ''
  }
};

// Define the context type
interface BookingWizardContextType {
  currentStep: number;
  setCurrentStep: (step: number) => void;
  
  bookingData: BookingFormData;
  updateBookingData: (data: Partial<BookingFormData>) => void;
  resetBookingData: () => void;
  
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  
  appointmentCreated: boolean;
  setAppointmentCreated: (created: boolean) => void;
  
  confirmationCode: string | null;
  setConfirmationCode: (code: string | null) => void;
}

// Create the context
const BookingWizardContext = createContext<BookingWizardContextType | undefined>(undefined);

// Provider component
export function BookingWizardProvider({ children }: { children: ReactNode }) {
  // Step state
  const [currentStep, setCurrentStep] = useState(1);
  
  // Booking data state
  const [bookingData, setBookingData] = useState<BookingFormData>(defaultBookingData);
  
  // Loading state
  const [isLoading, setIsLoading] = useState(false);
  
  // Appointment creation state
  const [appointmentCreated, setAppointmentCreated] = useState(false);
  
  // Confirmation code
  const [confirmationCode, setConfirmationCode] = useState<string | null>(null);
  
  // Update booking data
  const updateBookingData = (data: Partial<BookingFormData>) => {
    setBookingData(prevData => ({
      ...prevData,
      ...data
    }));
  };
  
  // Reset booking data
  const resetBookingData = () => {
    setBookingData(defaultBookingData);
    setCurrentStep(1);
    setAppointmentCreated(false);
    setConfirmationCode(null);
  };
  
  return (
    <BookingWizardContext.Provider
      value={{
        currentStep,
        setCurrentStep,
        bookingData,
        updateBookingData,
        resetBookingData,
        isLoading,
        setIsLoading,
        appointmentCreated,
        setAppointmentCreated,
        confirmationCode,
        setConfirmationCode
      }}
    >
      {children}
    </BookingWizardContext.Provider>
  );
}

// Custom hook to use the booking wizard context
export function useBookingWizard() {
  const context = useContext(BookingWizardContext);
  
  if (!context) {
    throw new Error('useBookingWizard must be used within a BookingWizardProvider');
  }
  
  return context;
}