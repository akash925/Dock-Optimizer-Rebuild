// Standard Questions Form Fields Component
// This ensures the Appointment Master page has the required interfaces

export interface StandardQuestion {
  id: number;
  label: string;
  fieldType: string;
  required: boolean;
  included: boolean;
  orderPosition: number;
  appointmentTypeId: number;
  options?: string[];
  placeholder?: string;
  defaultValue?: string;
}

export interface QuestionFormField {
  id: number;
  label: string;
  type: string;
  required: boolean;
  included: boolean;
  order: number;
  appointmentType: string;
  options?: string[];
  placeholder?: string;
}

// This component provides the interface definitions needed by the Appointment Master page
export default function StandardQuestionsFormFields() {
  return null; // This is just for interface exports
}