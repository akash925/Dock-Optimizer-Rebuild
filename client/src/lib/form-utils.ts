import { z } from "zod";
// @ts-ignore - Missing module declaration
import { DEFAULT_APPOINTMENT_SETTINGS } from "./constants";

// Common form validation schemas to reduce duplication
export const commonValidationSchemas = {
  bolNumber: z.string().optional(),
  poNumber: z.string().optional(),
  truckNumber: z.string().min(1, "Truck number is required"),
  trailerNumber: z.string().optional(),
  driverName: z.string().min(1, "Driver name is required"),
  driverPhone: z.string().min(10, "Valid phone number is required"),
  driverEmail: z.string().email("Valid email is required").optional().or(z.literal("")),
  customerName: z.string().min(1, "Customer name is required"),
  carrierName: z.string().optional(),
  mcNumber: z.string().optional(),
  appointmentType: z.enum(["inbound", "outbound"]),
  appointmentDate: z.string().min(1, "Date is required"),
  appointmentTime: z.string().min(1, "Time is required"),
  palletCount: z.string().optional(),
  weight: z.string().optional(),
  notes: z.string().optional(),
};

// Base appointment form schema
export const baseAppointmentFormSchema = z.object({
  ...commonValidationSchemas,
  carrierId: z.number().optional(),
  facilityId: z.number().optional(),
  appointmentTypeId: z.number().optional(),
});

export type BaseAppointmentFormValues = z.infer<typeof baseAppointmentFormSchema>;

// Common form field configurations
export const commonFormFields = {
  truck: {
    truckNumber: {
      label: "Truck Number",
      placeholder: "Enter truck number",
      required: true
    },
    trailerNumber: {
      label: "Trailer Number", 
      placeholder: "Enter trailer number"
    },
    mcNumber: {
      label: "MC Number",
      placeholder: "Enter MC number"
    }
  },
  driver: {
    driverName: {
      label: "Driver Name",
      placeholder: "Enter driver name",
      required: true
    },
    driverPhone: {
      label: "Driver Phone",
      placeholder: "Enter driver phone number",
      required: true
    },
    driverEmail: {
      label: "Driver Email",
      placeholder: "Enter driver email"
    }
  },
  shipment: {
    bolNumber: {
      label: "BOL Number",
      placeholder: "Enter BOL number"
    },
    poNumber: {
      label: "PO Number", 
      placeholder: "Enter PO number"
    },
    customerName: {
      label: "Customer Name",
      placeholder: "Enter customer name",
      required: true
    },
    palletCount: {
      label: "Pallet Count",
      placeholder: "Enter number of pallets"
    },
    weight: {
      label: "Weight",
      placeholder: "Enter weight"
    }
  }
};

// Common form utilities
export const formUtils = {
  // Calculate end time based on start time and duration
  calculateEndTime: (startTime: Date, durationMinutes: number = DEFAULT_APPOINTMENT_SETTINGS.duration): Date => {
    return new Date(startTime.getTime() + durationMinutes * 60 * 1000);
  },

  // Format form data for API submission
  formatAppointmentForAPI: (data: BaseAppointmentFormValues): any => {
    const startTime = new Date(`${data.appointmentDate}T${data.appointmentTime}`);
    const endTime = formUtils.calculateEndTime(startTime);

    return {
      ...data,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      type: data.appointmentType,
      status: "scheduled",
      // Convert string numbers to numbers where needed
      palletCount: data.palletCount ? parseInt(data.palletCount, 10) : undefined,
      weight: data.weight ? parseFloat(data.weight) : undefined,
    };
  },

  // Validate appointment time slot
  validateTimeSlot: (date: string, time: string): boolean => {
    const appointmentDateTime = new Date(`${date}T${time}`);
    const now = new Date();
    
    // Check if appointment is in the future
    if (appointmentDateTime <= now) {
      return false;
    }
    
    // Additional validations can be added here
    return true;
  },

  // Common error message formatter
  formatValidationErrors: (errors: any): string[] => {
    const messages: string[] = [];
    
    Object.entries(errors).forEach(([field, error]: [string, any]) => {
      if (error?.message) {
        messages.push(`${field}: ${error.message}`);
      }
    });
    
    return messages;
  },

  // Extract BOL data from form
  extractBolData: (data: BaseAppointmentFormValues) => {
    return {
      bolNumber: data.bolNumber,
      poNumber: data.poNumber,
      palletCount: data.palletCount,
      weight: data.weight,
      customerName: data.customerName,
      carrierName: data.carrierName,
    };
  }
};

// Common form state management
export const createFormState = () => {
  return {
    step: 1,
    isSubmitting: false,
    bolProcessing: false,
    bolPreviewText: "",
    errors: [] as string[],
  };
};

// Common form step management
export const formStepUtils = {
  getStepTitle: (step: number): string => {
    switch (step) {
      case 1: return "Truck & Driver Information";
      case 2: return "Shipment Details";
      case 3: return "Schedule Appointment";
      case 4: return "Confirmation";
      default: return "Appointment Form";
    }
  },

  getStepDescription: (step: number): string => {
    switch (step) {
      case 1: return "Enter truck and driver details";
      case 2: return "Provide shipment and BOL information";
      case 3: return "Select date and time for your appointment";
      case 4: return "Review and confirm your appointment";
      default: return "";
    }
  },

  isStepValid: (step: number, formData: Partial<BaseAppointmentFormValues>): boolean => {
    switch (step) {
      case 1:
        return !!(formData.truckNumber && formData.driverName && formData.driverPhone);
      case 2:
        return !!(formData.customerName);
      case 3:
        return !!(formData.appointmentDate && formData.appointmentTime);
      default:
        return true;
    }
  }
}; 