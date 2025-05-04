import React, { createContext, useContext, useState, ReactNode } from 'react';

interface BookingFormData {
  // Step 1: General Info
  facilityId?: number;
  appointmentTypeId?: number;
  pickupOrDropoff?: 'pickup' | 'dropoff';
  
  // Step 2: Customer Info 
  companyName?: string;
  contactName?: string;
  email?: string;
  phone?: string;
  customFields?: Record<string, string>;
  
  // Step 3: Truck & Carrier Info
  carrierId?: number;
  carrierName?: string;
  driverName?: string;
  driverPhone?: string;
  truckNumber?: string;
  trailerNumber?: string;
  
  // Schedule Info
  startTime?: Date;
  endTime?: Date;
  
  // Additional
  notes?: string;
  bolFile?: File;
}

interface BookingWizardContextType {
  currentStep: number;
  setCurrentStep: (step: number) => void;
  bookingData: BookingFormData;
  updateBookingData: (data: Partial<BookingFormData>) => void;
  resetBookingData: () => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

const BookingWizardContext = createContext<BookingWizardContextType | null>(null);

export function BookingWizardProvider({ children }: { children: ReactNode }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [bookingData, setBookingData] = useState<BookingFormData>({});

  const updateBookingData = (data: Partial<BookingFormData>) => {
    setBookingData(prev => ({ ...prev, ...data }));
  };

  const resetBookingData = () => {
    setBookingData({});
    setCurrentStep(1);
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
        setIsLoading
      }}
    >
      {children}
    </BookingWizardContext.Provider>
  );
}

export function useBookingWizard() {
  const context = useContext(BookingWizardContext);
  if (!context) {
    throw new Error('useBookingWizard must be used within a BookingWizardProvider');
  }
  return context;
}