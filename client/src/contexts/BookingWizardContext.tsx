import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { dateTimeToUtcIso } from '@/lib/appointment-availability';

// Define the shape of our booking data
export interface BookingData {
  // Step 1: Truck Info
  carrierId: number | null;
  carrierName: string;
  customerName: string;
  mcNumber: string;
  truckNumber: string;
  trailerNumber: string;
  driverName: string;
  driverPhone: string;
  type: 'inbound' | 'outbound';
  appointmentMode: 'trailer' | 'container';
  
  // Step 2: Schedule Details
  appointmentDate: string; // YYYY-MM-DD
  appointmentTime: string; // HH:MM
  appointmentDateTime: string; // ISO string in UTC, incorporating timezone
  dockId: number | null;
  bolNumber: string;
  bolFile: File | null;
  bolPreviewText: string | null;
  poNumber: string;
  palletCount: string;
  weight: string;
  notes: string;
  facilityId: number | null;
  facilityTimezone: string;
  appointmentTypeId: number | null;
}

// Action types for our reducer
type BookingAction =
  | { type: 'RESET'; payload?: Partial<BookingData> }
  | { type: 'UPDATE_TRUCK_INFO'; payload: Partial<BookingData> }
  | { type: 'UPDATE_SCHEDULE_DETAILS'; payload: Partial<BookingData> }
  | { type: 'SET_BOL_FILE'; payload: { bolFile: File | null; bolPreviewText: string | null } }
  | { type: 'SET_APPOINTMENT_DATE_TIME'; payload: { 
      appointmentDate: string; 
      appointmentTime: string;
      facilityTimezone: string; 
    } };

// Default state for a new booking
const defaultBookingData: BookingData = {
  // Step 1: Truck Info
  carrierId: null,
  carrierName: '',
  customerName: '',
  mcNumber: '',
  truckNumber: '',
  trailerNumber: '',
  driverName: '',
  driverPhone: '',
  type: 'inbound',
  appointmentMode: 'trailer',
  
  // Step 2: Schedule Details
  appointmentDate: '',
  appointmentTime: '',
  appointmentDateTime: '',
  dockId: null,
  bolNumber: '',
  bolFile: null,
  bolPreviewText: null,
  poNumber: '',
  palletCount: '',
  weight: '',
  notes: '',
  facilityId: null,
  facilityTimezone: 'America/New_York', // Default timezone
  appointmentTypeId: null,
};

// Reducer function to handle state updates
function bookingReducer(state: BookingData, action: BookingAction): BookingData {
  switch (action.type) {
    case 'RESET':
      return { ...defaultBookingData, ...action.payload };
      
    case 'UPDATE_TRUCK_INFO':
      return { ...state, ...action.payload };
      
    case 'UPDATE_SCHEDULE_DETAILS':
      return { ...state, ...action.payload };
      
    case 'SET_BOL_FILE':
      return {
        ...state,
        bolFile: action.payload.bolFile,
        bolPreviewText: action.payload.bolPreviewText
      };
      
    case 'SET_APPOINTMENT_DATE_TIME': {
      const { appointmentDate, appointmentTime, facilityTimezone } = action.payload;
      // Convert to UTC ISO string using the facility's timezone
      const appointmentDateTime = dateTimeToUtcIso(appointmentDate, appointmentTime, facilityTimezone);
      
      return {
        ...state,
        appointmentDate,
        appointmentTime,
        appointmentDateTime
      };
    }
      
    default:
      return state;
  }
}

// Create our context
interface BookingWizardContextType {
  bookingData: BookingData;
  dispatch: React.Dispatch<BookingAction>;
  resetBooking: (initialData?: Partial<BookingData>) => void;
  updateTruckInfo: (data: Partial<BookingData>) => void;
  updateScheduleDetails: (data: Partial<BookingData>) => void;
  setBolFile: (file: File | null, previewText: string | null) => void;
  setAppointmentDateTime: (date: string, time: string, timezone: string) => void;
}

const BookingWizardContext = createContext<BookingWizardContextType | null>(null);

// Provider component
export function BookingWizardProvider({ children, initialData }: { 
  children: ReactNode; 
  initialData?: Partial<BookingData>;
}) {
  const [bookingData, dispatch] = useReducer(
    bookingReducer, 
    { ...defaultBookingData, ...initialData }
  );
  
  // Helper functions for common actions
  const resetBooking = (data?: Partial<BookingData>) => {
    dispatch({ type: 'RESET', payload: data });
  };
  
  const updateTruckInfo = (data: Partial<BookingData>) => {
    dispatch({ type: 'UPDATE_TRUCK_INFO', payload: data });
  };
  
  const updateScheduleDetails = (data: Partial<BookingData>) => {
    dispatch({ type: 'UPDATE_SCHEDULE_DETAILS', payload: data });
  };
  
  const setBolFile = (file: File | null, previewText: string | null) => {
    dispatch({ 
      type: 'SET_BOL_FILE', 
      payload: { bolFile: file, bolPreviewText: previewText } 
    });
  };
  
  const setAppointmentDateTime = (date: string, time: string, timezone: string) => {
    dispatch({ 
      type: 'SET_APPOINTMENT_DATE_TIME', 
      payload: { appointmentDate: date, appointmentTime: time, facilityTimezone: timezone } 
    });
  };
  
  // Reset booking when the component mounts
  useEffect(() => {
    resetBooking(initialData);
  }, []);
  
  return (
    <BookingWizardContext.Provider
      value={{
        bookingData,
        dispatch,
        resetBooking,
        updateTruckInfo,
        updateScheduleDetails,
        setBolFile,
        setAppointmentDateTime
      }}
    >
      {children}
    </BookingWizardContext.Provider>
  );
}

// Custom hook for using the booking context
export function useBookingWizard() {
  const context = useContext(BookingWizardContext);
  
  if (!context) {
    throw new Error('useBookingWizard must be used within a BookingWizardProvider');
  }
  
  return context;
}