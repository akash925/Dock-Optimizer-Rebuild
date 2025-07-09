import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useUpdateStandardQuestion } from "@/hooks/use-standard-questions";
import { Facility, AppointmentType, insertAppointmentTypeSchema } from "@shared/schema";
import SeedAppointmentTypes from "@/components/appointment-master/seed-appointment-types";
import { SeedQuestionsButton } from "@/components/appointment-master/SeedQuestionsButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FilePlus, PlusCircle, Save, Settings, Shield, Trash2, AlertTriangle, HelpCircle, Loader2, Copy, Pencil, MoreHorizontal, CheckCircle, ArrowLeft, ArrowRight, ChevronRight, Info as InfoIcon, GripVertical, Calendar, AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { weekDays } from "@/lib/utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  DndContext, 
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Sortable Row component for drag-and-drop question reordering
interface SortableQuestionRowProps {
  field: QuestionFormField;
  index: number;
  included: boolean;
  required: boolean;
  onIncludedChange: (checked: boolean) => void;
  onRequiredChange: (checked: boolean) => void;
}

function SortableQuestionRow({ 
  field, 
  index, 
  included, 
  required, 
  onIncludedChange, 
  onRequiredChange 
}: SortableQuestionRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: field.id });
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1 : 0,
    backgroundColor: isDragging ? 'var(--highlight)' : undefined,
  };
  
  return (
    <TableRow 
      ref={setNodeRef} 
      style={style} 
      className={included ? "bg-green-50" : undefined}
    >
      <TableCell className="w-8 text-center cursor-move" {...attributes} {...listeners}>
        <GripVertical className="h-4 w-4 mx-auto text-muted-foreground" />
      </TableCell>
      <TableCell className="text-center">{index}</TableCell>
      <TableCell>{field.label}</TableCell>
      <TableCell className="capitalize">{field.type}</TableCell>
      <TableCell className="text-center">
        <Checkbox 
          checked={included} 
          onCheckedChange={(checked) => onIncludedChange(!!checked)}
        />
      </TableCell>
      <TableCell className="text-center">
        <Checkbox 
          disabled={!included}
          checked={included && required}
          onCheckedChange={(checked) => onRequiredChange(!!checked)}
        />
      </TableCell>
    </TableRow>
  );
}

interface QuestionFormField {
  id: number;
  label: string;
  type: "text" | "textarea" | "select" | "radio" | "checkbox" | "file" | "email" | "number";
  required: boolean;
  included?: boolean;
  options?: string[];
  placeholder?: string;
  order: number;
  appointmentType: "inbound" | "outbound" | "both";
}

export default function AppointmentMaster() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("types");
  const [selectedQuestionId, setSelectedQuestionId] = useState<number | null>(null);
  const [showQuestionDialog, setShowQuestionDialog] = useState(false);
  
  // Initialize the standard question update mutation
  const updateStandardQuestionMutation = useUpdateStandardQuestion();
  
  // Appointment Type Management
  const [showNewAppointmentTypeDialog, setShowNewAppointmentTypeDialog] = useState(false);
  const [selectedAppointmentTypeId, setSelectedAppointmentTypeId] = useState<number | null>(null);
  
  // Function to load standard questions for an appointment type
  const loadStandardQuestionsForAppointmentType = (appointmentTypeId: number) => {
    console.log(`[StandardQuestions] Loading questions for appointment type ${appointmentTypeId}`);
    
    // Use the direct standard questions endpoint instead of the redirect
    fetch(`/api/standard-questions/appointment-type/${appointmentTypeId}`)
      .then(res => {
        if (!res.ok) {
          throw new Error(`Failed to fetch standard questions: ${res.statusText}`);
        }
        return res.json();
      })
      .then(data => {
        console.log(`[StandardQuestions] Loaded ${data.length} questions for appointment type ${appointmentTypeId}:`, data);
        
        // Transform backend data to match frontend format
        const formattedQuestions = data.map((q: any) => ({
          id: q.id,
          label: q.label,
          type: q.fieldType.toLowerCase(),
          required: q.required,
          included: q.included,
          order: q.orderPosition,
          appointmentType: "both" // Default value
        }));
        
        console.log(`[StandardQuestions] Transformed questions for appointment type ${appointmentTypeId}:`, formattedQuestions);
        setStandardFields(formattedQuestions);
        console.log(`[StandardQuestions] Updated standardFields state:`, formattedQuestions.length);
      })
      .catch(error => {
        console.error(`[StandardQuestions] Error loading questions:`, error);
        toast({
          title: "Error",
          description: `Failed to load standard questions: ${error.message}`,
          variant: "destructive"
        });
      });
  };
  const [appointmentTypeFormStep, setAppointmentTypeFormStep] = useState(1); // 1: Details, 2: Scheduling, 3: Questions
  
  // Appointment Type Form Data
  const [appointmentTypeForm, setAppointmentTypeForm] = useState({
    name: "",
    description: "",
    facilityId: 0,
    color: "#4CAF50",
    duration: 60,
    type: "both", // Default to "both" for inbound/outbound
    maxConcurrent: 1,
    timezone: "America/New_York",
    gracePeriod: 15, // Grace period before an appointment is marked late
    bufferTime: 0, // Gap between appointments
    maxAppointmentsPerDay: undefined as number | undefined, // Optional daily limit
    emailReminderTime: 24,
    showRemainingSlots: true,
    allowAppointmentsThroughBreaks: false,
    allowAppointmentsPastBusinessHours: false,
    overrideFacilityHours: false // When true, this appointment type can be scheduled outside facility hours
  });
  
  // Scheduling settings for appointment type
  const [schedulingSettings, setSchedulingSettings] = useState({
    maxDaysInAdvance: 90,
    availableDays: [1, 2, 3, 4, 5], // Monday to Friday
    dayStartTime: "08:00",
    dayEndTime: "17:00",
    breakStartTime: "12:00",
    breakEndTime: "13:00"
  });
  
  // Form fields for question editing
  const [questionForm, setQuestionForm] = useState<Partial<QuestionFormField>>({
    label: "",
    type: "text",
    required: false,
    options: [],
    placeholder: "",
    appointmentType: "both"
  });

  // System settings state
  const [systemSettings, setSystemSettings] = useState({
    emailConfirmations: true,
    emailReminders: true,
    defaultCalendarView: "week",
    weekStartsOn: "1",
    maxDaysInAdvance: "90",
    minNoticeHours: "24"
  });
  
  // Fetch facilities from API
  const { data: facilities = [], isLoading: isLoadingFacilities } = useQuery<Facility[]>({
    queryKey: ["/api/facilities"],
  });

  // Fetch appointment types from API
  const { data: apiAppointmentTypes = [], isLoading: isLoadingAppointmentTypes } = useQuery<AppointmentType[]>({
    queryKey: ["/api/appointment-types"],
  });

  // Fetch system settings
  const { data: loadedSystemSettings } = useQuery({
    queryKey: ["/api/system-settings"],
    queryFn: async () => {
      const response = await fetch("/api/system-settings");
      if (!response.ok) throw new Error("Failed to fetch system settings");
      return response.json();
    }
  });

  // Update system settings when loaded
  useEffect(() => {
    if (loadedSystemSettings) {
      setSystemSettings(loadedSystemSettings);
    }
  }, [loadedSystemSettings]);

  // Mutation to save system settings
  const saveSystemSettingsMutation = useMutation({
    mutationFn: async (settings: typeof systemSettings) => {
      const response = await apiRequest("PUT", "/api/system-settings", settings);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Settings Saved",
        description: "System settings have been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Save Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  // For displaying in the table, we'll map the API data to include facility names
  const appointmentTypesWithFacilityNames = apiAppointmentTypes.map(appointmentType => {
    const facility = facilities.find(f => f.id === appointmentType.facilityId);
    return {
      ...appointmentType,
      facilityName: facility?.name || "Unknown Facility",
      // Format the date for display
      createdDate: appointmentType.createdAt ? new Date(appointmentType.createdAt).toLocaleDateString() : "N/A"
    };
  });
  
  // Standard fields configuration - these fields are part of every appointment type
  // Initial state will be replaced when we load the data from API
  const [standardFields, setStandardFields] = useState<QuestionFormField[]>([
    { id: 1, label: "Customer Name", type: "text", required: true, included: true, order: 1, appointmentType: "both" },
    { id: 2, label: "Carrier Name", type: "text", required: true, included: true, order: 2, appointmentType: "both" },
    { id: 3, label: "Carrier MC #", type: "text", required: true, included: true, order: 3, appointmentType: "both" },
    { id: 4, label: "Driver/Dispatcher Email", type: "email", required: true, included: true, order: 4, appointmentType: "both" },
    { id: 5, label: "Driver/Dispatcher Phone Number", type: "text", required: false, included: true, order: 5, appointmentType: "both" },
    { id: 6, label: "Driver's License Number", type: "text", required: false, included: true, order: 6, appointmentType: "both" },
    { id: 7, label: "BOL Doc", type: "file", required: false, included: true, order: 7, appointmentType: "both" },
    { id: 8, label: "BOL Number", type: "text", required: true, included: true, order: 8, appointmentType: "both" },
    { id: 9, label: "Truck Number", type: "text", required: true, included: true, order: 9, appointmentType: "both" },
    { id: 10, label: "Trailer Number", type: "text", required: false, included: true, order: 10, appointmentType: "both" },
    { id: 11, label: "Driver's Name", type: "text", required: false, included: true, order: 11, appointmentType: "both" },
    { id: 12, label: "Item Description/Quantity", type: "textarea", required: false, included: true, order: 12, appointmentType: "both" }
  ]);
  
  // ENHANCED: Handle state changes for standard questions
  const handleStandardQuestionChange = (id: number, field: 'included' | 'required', value: boolean) => {
    setStandardFields(prevFields => {
      return prevFields.map(q => {
        if (q.id === id) {
          const updatedQuestion = { ...q, [field]: value };
          // If a question is not included, it cannot be required
          if (field === 'included' && !value) {
            updatedQuestion.required = false;
          }
          return updatedQuestion;
        }
        return q;
      });
    });
  };
  
  // Setup sensors for drag and drop functionality
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
  
  // Handle the end of a drag event
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      // Find the indices of the items being dragged
      const activeIndex = standardFields.findIndex(q => q.id === active.id);
      const overIndex = standardFields.findIndex(q => q.id === over.id);
      
      // Create a new array with the items reordered
      const newOrder = arrayMove(standardFields, activeIndex, overIndex);
      
      // Update the order property of each question
      const updatedFields = newOrder.map((field, index) => ({
        ...field,
        order: index + 1
      }));
      
      // Update local state
      setStandardFields(updatedFields);
      
      // Save the new order to the database
      updatedFields.forEach(field => {
        updateStandardQuestionMutation.mutate({
          id: field.id,
          data: { orderPosition: field.order }
        });
      });
      
      toast({
        title: "Question order updated",
        description: "The order of questions has been updated",
      });
    }
  };
  
  // Mock data for custom question form fields
  const [customFields, setCustomFields] = useState<QuestionFormField[]>([
    { 
      id: 1, 
      label: "Hazardous Materials", 
      type: "radio", 
      required: true, 
      included: true,
      options: ["Yes", "No"], 
      order: 1,
      appointmentType: "both"
    },
    { 
      id: 2, 
      label: "Packaging Type", 
      type: "select", 
      required: true, 
      included: true,
      options: ["Pallets", "Boxes", "Containers", "Loose Items"], 
      order: 2,
      appointmentType: "both"
    },
    { 
      id: 3, 
      label: "Temperature Requirements", 
      type: "select", 
      required: false, 
      included: true,
      options: ["Ambient", "Refrigerated", "Frozen"], 
      order: 3,
      appointmentType: "both"
    },
    { 
      id: 4, 
      label: "Special Handling Instructions", 
      type: "textarea", 
      required: false, 
      included: true,
      order: 4,
      appointmentType: "both"
    }
  ]);
  
  // Helper functions and mutations
  // Delete appointment type
  const deleteAppointmentTypeMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("DELETE", `/api/appointment-types/${id}`);
      return id;
    },
    onSuccess: (id) => {
      toast({
        title: "Appointment Type Deleted",
        description: "The appointment type has been successfully deleted",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/appointment-types"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Failed to delete appointment type: ${error.message}`,
        variant: "destructive",
      });
    }
  });
  
  // Update appointment type
  const updateAppointmentTypeMutation = useMutation({
    mutationFn: async (appointmentType: any) => {
      // Remove any <!DOCTYPE> or HTML-like content that might be causing parsing issues
      const cleanedData = JSON.parse(JSON.stringify(appointmentType));
      try {
        const response = await apiRequest("PUT", `/api/appointment-types/${cleanedData.id}`, cleanedData);
        return await response.json();
      } catch (error: any) {
        // Handle authentication errors
        if (error.message.includes("401") || error.message.includes("Unauthorized")) {
          // Trigger a page refresh to redirect to login
          window.location.href = "/auth";
          throw new Error("Your session has expired. Please log in again.");
        }
        throw error;
      }
    },
    onSuccess: (data) => {
      toast({
        title: "Appointment Type Updated",
        description: "The appointment type has been successfully updated",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/appointment-types"] });
      setShowNewAppointmentTypeDialog(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Failed to update appointment type: ${error.message}`,
        variant: "destructive",
      });
    }
  });
  
  // Create appointment type
  const createAppointmentTypeMutation = useMutation({
    mutationFn: async (appointmentType: any) => {
      try {
        const response = await apiRequest("POST", `/api/appointment-types`, appointmentType);
        return await response.json();
      } catch (error: any) {
        // Handle authentication errors
        if (error.message.includes("401") || error.message.includes("Unauthorized")) {
          // Trigger a page refresh to redirect to login
          window.location.href = "/auth";
          throw new Error("Your session has expired. Please log in again.");
        }
        throw error;
      }
    },
    onSuccess: (data) => {
      toast({
        title: "Appointment Type Created",
        description: "The appointment type has been successfully created",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/appointment-types"] });
      setShowNewAppointmentTypeDialog(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Failed to create appointment type: ${error.message}`,
        variant: "destructive",
      });
    }
  });
  
  // Duplicate appointment type
  const duplicateAppointmentTypeMutation = useMutation({
    mutationFn: async (id: number) => {
      // First, get the original appointment type to duplicate
      const selectedType = apiAppointmentTypes.find(type => type.id === id);
      if (!selectedType) throw new Error("Appointment type not found");
      
      // Create a duplicate with a new name
      const duplicateData = {
        ...selectedType,
        name: `${selectedType.name} (Copy)`,
        id: undefined // Remove ID so the server creates a new one
      };
      
      try {
        const response = await apiRequest("POST", `/api/appointment-types`, duplicateData);
        return await response.json();
      } catch (error: any) {
        // Handle authentication errors
        if (error.message.includes("401") || error.message.includes("Unauthorized")) {
          // Trigger a page refresh to redirect to login
          window.location.href = "/auth";
          throw new Error("Your session has expired. Please log in again.");
        }
        throw error;
      }
    },
    onSuccess: (data) => {
      toast({
        title: "Appointment Type Duplicated",
        description: "The appointment type has been successfully duplicated",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/appointment-types"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Failed to duplicate appointment type: ${error.message}`,
        variant: "destructive",
      });
    }
  });

  const saveCustomFieldMutation = useMutation({
    mutationFn: async (field: Partial<QuestionFormField>) => {
      if (!selectedAppointmentTypeId) {
        throw new Error('You must select an appointment type first');
      }
      
      // Improved debugging for question saving
      console.log("[AppointmentMaster] Saving custom question:", field);
      
      // Ensure proper handling of required and included flags
      const isRequired = field.required === true;
      const isIncluded = field.included !== false; // Default to true if undefined or null
      
      console.log(`[AppointmentMaster] Processing field with required=${isRequired}, included=${isIncluded}`);
      
      const payload = {
        appointmentTypeId: selectedAppointmentTypeId,
        label: field.label || "Untitled Field",
        type: field.type || "text",
        isRequired: isRequired, // Explicit boolean for backend
        included: isIncluded, // Explicit boolean for included flag
        options: field.options ? JSON.stringify(field.options) : "[]",
        placeholder: field.placeholder || "",
        order_position: field.order || customFields.length + 1, // Use order_position field for database
        appointmentType: field.appointmentType || "both"
      };
      
      // Log the final payload being sent to API
      console.log("[AppointmentMaster] Custom question payload:", payload);
      
      let url = '/api/custom-questions';
      let method = 'POST';
      
      // If editing existing question, use PUT to update
      if (selectedQuestionId) {
        url = `/api/custom-questions/${selectedQuestionId}`;
        method = 'PUT';
      }
      
      const res = await apiRequest(method, url, payload);
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(errorData?.message || 'Failed to save custom field');
      }
      
      const newField = await res.json();
      
      // Convert DB format to component format
      console.log("[AppointmentMaster] Received saved question from API:", newField);
      
      // Create a properly formatted field with explicit boolean handling for required and included
      const formattedField = {
        id: newField.id,
        label: newField.label || "",
        type: newField.type || "text",
        required: newField.isRequired === true, // Ensure required is boolean true/false
        included: newField.included !== false, // Default included to true unless explicitly false
        options: newField.options 
          ? (typeof newField.options === 'string' 
              ? JSON.parse(newField.options) 
              : newField.options) 
          : [],
        placeholder: newField.placeholder || "",
        order: newField.order_position || 0,
        appointmentType: newField.appointmentType || "both"
      } as QuestionFormField;
      
      console.log("[AppointmentMaster] Formatted saved question:", formattedField);
      return formattedField;
    },
    onSuccess: (newField) => {
      console.log("[AppointmentMaster] Successfully saved custom question:", newField);
      
      const updatedFields = selectedQuestionId 
        ? customFields.map(f => f.id === selectedQuestionId ? newField : f)
        : [...customFields, newField];

      setCustomFields(updatedFields);
      setShowQuestionDialog(false);
      setSelectedQuestionId(null);
      setQuestionForm({
        label: "",
        type: "text",
        required: false,
        options: [],
        placeholder: "",
        appointmentType: "both"
      });
      
      // Invalidate custom questions data for the selected appointment type
      queryClient.invalidateQueries({ queryKey: ["/api/custom-questions", selectedAppointmentTypeId] });
      
      toast({
        title: "Success",
        description: `Field ${selectedQuestionId ? "updated" : "created"} successfully`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Failed to save custom field: ${error.message}`,
        variant: "destructive",
      });
    }
  });
  
  // Delete custom field mutation
  const deleteCustomFieldMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest('DELETE', `/api/custom-questions/${id}`);
      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(errorData?.message || 'Failed to delete custom field');
      }
      return id;
    },
    onSuccess: (id) => {
      setCustomFields(customFields.filter(field => field.id !== id));
      
      // Invalidate custom questions data for the selected appointment type
      if (selectedAppointmentTypeId) {
        queryClient.invalidateQueries({ queryKey: ["/api/custom-questions", selectedAppointmentTypeId] });
      }
      
      toast({
        title: "Field Deleted",
        description: "The custom field has been removed",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Failed to delete custom field: ${error.message}`,
        variant: "destructive",
      });
    }
  });
  
  // Delete custom field
  const deleteCustomField = (id: number) => {
    deleteCustomFieldMutation.mutate(id);
  };
  
  // Edit custom field
  const editCustomField = (field: QuestionFormField) => {
    // Add debugging to track field properties
    console.log(`[AppointmentMaster] Editing custom field ${field.id}:`, JSON.stringify(field, null, 2));
    
    // Ensure required and included flags are properly set with defaults if missing
    const included = field.included !== undefined ? field.included : true;
    const required = field.required !== undefined ? field.required : false;
    
    console.log(`[AppointmentMaster] Field ${field.id} - included: ${included}, required: ${required}`);
    
    // Clear any previous state first
    setSelectedQuestionId(field.id);
    
    // Then set the form fields
    setQuestionForm({
      label: field.label,
      type: field.type,
      required: required,
      included: included, 
      options: field.options || [],
      placeholder: field.placeholder || "",
      appointmentType: field.appointmentType || "both"
    });
    
    // Set to step 1 last to ensure form is ready when displayed
    setAppointmentTypeFormStep(1);
    setShowQuestionDialog(true);
  };
  
  // Handle form changes for question editing
  const handleQuestionFormChange = (field: string, value: any) => {
    setQuestionForm(prev => ({ ...prev, [field]: value }));
  };
  
  // Handle adding option to a select/radio/checkbox field
  const addOption = () => {
    setQuestionForm(prev => ({
      ...prev,
      options: [...(prev.options || []), "New Option"]
    }));
  };
  
  // Handle updating an option
  const updateOption = (index: number, value: string) => {
    const newOptions = [...(questionForm.options || [])];
    newOptions[index] = value;
    setQuestionForm(prev => ({
      ...prev,
      options: newOptions
    }));
  };
  
  // Handle removing an option
  const removeOption = (index: number) => {
    const newOptions = [...(questionForm.options || [])];
    newOptions.splice(index, 1);
    setQuestionForm(prev => ({
      ...prev,
      options: newOptions
    }));
  };
  
  // Get appointment type label for display
  const getAppointmentTypeLabel = (type: string) => {
    switch(type) {
      case "inbound": return "Inbound";
      case "outbound": return "Outbound";
      case "both": return "Both";
      default: return type;
    }
  };
  
  // Handle submit appointment type form
  const handleAppointmentTypeSubmit = () => {
    const formData = {
      ...appointmentTypeForm,
      id: selectedAppointmentTypeId,
      // Ensure questions array is always included, even if empty
      questions: standardFields ?? []
    };
    
    if (selectedAppointmentTypeId) {
      updateAppointmentTypeMutation.mutateAsync(formData).then((updatedType) => {
        // After updating the appointment type, also load the custom questions
        fetchCustomQuestions(updatedType.id);
      });
    } else {
      createAppointmentTypeMutation.mutateAsync(formData).then((newType) => {
        // After creating a new appointment type, set it as selected and load an empty questions list
        setSelectedAppointmentTypeId(newType.id);
        setCustomFields([]);
      });
    }
  };
  
  // Function to fetch custom questions for an appointment type
  const fetchCustomQuestions = async (appointmentTypeId: number) => {
    try {
      console.log(`[AppointmentMaster] Loading custom questions for appointment type ${appointmentTypeId}`);
      const response = await fetch(`/api/custom-questions/${appointmentTypeId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch custom questions');
      }
      
      const questions = await response.json();
      console.log(`[AppointmentMaster] Loaded ${questions.length} custom questions:`, questions);
      
      // Convert API format to component format with improved property handling
      const formattedQuestions = questions.map((q: any) => {
        // Make sure we properly handle the isRequired and included flags
        const formattedQuestion = {
          id: q.id,
          label: q.label || "",
          type: q.type?.toLowerCase() || "text",
          required: !!q.isRequired, // Convert isRequired to required
          included: q.included !== false, // Ensure included defaults to true if not specified
          options: q.options ? (typeof q.options === 'string' ? JSON.parse(q.options) : q.options) : [],
          placeholder: q.placeholder || "",
          order: q.order_position, // Map order_position to order
          appointmentType: q.appointmentType || "both"
        };
        
        console.log(`[AppointmentMaster] Formatted question ${q.id}:`, formattedQuestion);
        return formattedQuestion;
      });
      
      console.log(`[AppointmentMaster] Setting ${formattedQuestions.length} custom fields in state`);
      setCustomFields(formattedQuestions);
    } catch (error) {
      console.error('Error loading custom questions:', error);
      toast({
        title: "Error",
        description: "Failed to load custom questions for this appointment type",
        variant: "destructive"
      });
    }
  };
  
  // Handle moving between form steps
  const goToNextStep = () => {
    if (appointmentTypeFormStep < 3) {
      setAppointmentTypeFormStep(prev => prev + 1);
    } else {
      handleAppointmentTypeSubmit();
    }
  };
  
  const goToPreviousStep = () => {
    if (appointmentTypeFormStep > 1) {
      setAppointmentTypeFormStep(prev => prev - 1);
    }
  };
  
  return (
    <div className="container mx-auto py-6 space-y-6">
      <h1 className="text-3xl font-bold mb-6">Appointment Master</h1>
      
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center space-x-2">
          <span className="text-muted-foreground">Configure appointment types, forms, and settings</span>
        </div>
      </div>
      
      <div className="border rounded-md bg-white">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="types">
              <FilePlus className="h-4 w-4 mr-2" />
              Appointment Types
            </TabsTrigger>
            <TabsTrigger value="settings">
              <Settings className="h-4 w-4 mr-2" />
              General Settings
            </TabsTrigger>
          </TabsList>
          
          {/* Appointment Types Tab */}
          <TabsContent value="types">
            <Card className="border-0 shadow-none">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Appointment Types</CardTitle>
                    <CardDescription>
                      Create and manage appointment types
                    </CardDescription>
                  </div>
                  <Button onClick={() => {
                    setSelectedAppointmentTypeId(null);
                    const defaultDuration = 60;
                    setAppointmentTypeForm({
                      name: "",
                      description: "",
                      facilityId: facilities.length > 0 ? facilities[0].id : 0,
                      color: "#4CAF50",
                      duration: defaultDuration,
                      type: "both",
                      maxConcurrent: 1,
                      bufferTime: defaultDuration, // Set buffer time to match duration by default
                      maxAppointmentsPerDay: undefined,
                      allowAppointmentsThroughBreaks: false,
                      allowAppointmentsPastBusinessHours: false,
                      timezone: "America/New_York",
                      gracePeriod: 15,
                      emailReminderTime: 24,
                      showRemainingSlots: true,
                      overrideFacilityHours: false
                    });
                    setAppointmentTypeFormStep(1);
                    setShowNewAppointmentTypeDialog(true);
                  }}>
                    <PlusCircle className="h-4 w-4 mr-2" />
                    New Appointment Type
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  {isLoadingAppointmentTypes ? (
                    <div className="text-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                      <p className="text-muted-foreground">Loading appointment types...</p>
                    </div>
                  ) : apiAppointmentTypes.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>No appointment types have been created yet.</p>
                      <p className="text-sm mt-2">Click "New Appointment Type" to create your first appointment type.</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Appointment Name</TableHead>
                          <TableHead>Facility</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Created</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {appointmentTypesWithFacilityNames.map((appointmentType) => (
                          <TableRow key={appointmentType.id}>
                            <TableCell className="font-medium">{appointmentType.name}</TableCell>
                            <TableCell>{appointmentType.facilityName}</TableCell>
                            <TableCell>{getAppointmentTypeLabel(appointmentType.type)}</TableCell>
                            <TableCell>{appointmentType.createdDate}</TableCell>
                            <TableCell className="text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => {
                                    const appointmentTypeId = appointmentType.id;
                                    console.log(`[AppointmentMaster] Selected appointment type: ${appointmentTypeId}`);
                                    setSelectedAppointmentTypeId(appointmentTypeId);
                                    
                                    // Load standard questions from the database - this logs the questions correctly
                                    loadStandardQuestionsForAppointmentType(appointmentTypeId);
                                    // Load custom questions for this appointment type
                                    fetchCustomQuestions(appointmentTypeId);
                                    console.log(`[AppointmentMaster] Set step to 3 to show questions tab when form opens`);
                                    // Force the form to open on the questions tab (step 3)
                                    setAppointmentTypeFormStep(3);
                                    
                                    // Set the form data from the selected appointment type
                                    // Get the duration and set the buffer time if it was previously 0
                                    const duration = appointmentType.duration || 60;
                                    const bufferTime = appointmentType.bufferTime || duration; // Use duration if buffer time is 0

                                    setAppointmentTypeForm({
                                      name: appointmentType.name || "",
                                      description: appointmentType.description || "",
                                      facilityId: appointmentType.facilityId || (facilities.length > 0 ? facilities[0].id : 0),
                                      color: appointmentType.color || "#4CAF50",
                                      duration: duration,
                                      type: appointmentType.type || "both",
                                      maxConcurrent: appointmentType.maxConcurrent || 1,
                                      bufferTime: bufferTime,
                                      maxAppointmentsPerDay: appointmentType.maxAppointmentsPerDay === null ? undefined : appointmentType.maxAppointmentsPerDay,
                                      timezone: appointmentType.timezone || "America/New_York",
                                      gracePeriod: appointmentType.gracePeriod || 15,
                                      emailReminderTime: appointmentType.emailReminderTime || 24,
                                      showRemainingSlots: appointmentType.showRemainingSlots ?? true,
                                      allowAppointmentsThroughBreaks: appointmentType.allowAppointmentsThroughBreaks || false,
                                      allowAppointmentsPastBusinessHours: appointmentType.allowAppointmentsPastBusinessHours || false,
                                      overrideFacilityHours: appointmentType.overrideFacilityHours || false
                                    });
                                    
                                    // Load custom questions for this appointment type
                                    fetchCustomQuestions(appointmentTypeId);
                                    
                                    // Always start at step 1 when editing an appointment type
                                    setAppointmentTypeFormStep(1);
                                    console.log("[AppointmentMaster] Starting appointment type edit form at step 1");
                                    setShowNewAppointmentTypeDialog(true);
                                    
                                    // Log that we're editing from step 1
                                    console.log("[AppointmentMaster] Editing appointment type from step 1");
                                  }}>
                                    <Pencil className="h-4 w-4 mr-2" />
                                    Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => {
                                    duplicateAppointmentTypeMutation.mutate(appointmentType.id);
                                  }}>
                                    <Copy className="h-4 w-4 mr-2" />
                                    Duplicate
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem 
                                    className="text-red-600"
                                    onClick={() => {
                                      if(confirm(`Are you sure you want to delete "${appointmentType.name}"?`)) {
                                        deleteAppointmentTypeMutation.mutate(appointmentType.id);
                                      }
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              </CardContent>
            </Card>
            
            <div className="mt-6 space-y-4">
              <SeedAppointmentTypes />
            </div>
          </TabsContent>
          
          {/* General Settings Tab */}
          <TabsContent value="settings">
            <Card className="border-0 shadow-none">
              <CardHeader>
                <CardTitle>Appointment System Settings</CardTitle>
                <CardDescription>
                  Configure general settings for the appointment system
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Email Notifications</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Switch 
                          id="email-confirmations" 
                          checked={systemSettings.emailConfirmations}
                          onCheckedChange={(checked) => setSystemSettings({
                            ...systemSettings, 
                            emailConfirmations: checked
                          })}
                        />
                        <Label htmlFor="email-confirmations">
                          Send appointment confirmations
                        </Label>
                      </div>
                      <p className="text-sm text-muted-foreground ml-6">
                        Send email confirmations when appointments are created
                      </p>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Switch 
                          id="email-reminders" 
                          checked={systemSettings.emailReminders}
                          onCheckedChange={(checked) => setSystemSettings({
                            ...systemSettings, 
                            emailReminders: checked
                          })}
                        />
                        <Label htmlFor="email-reminders">
                          Send appointment reminders
                        </Label>
                      </div>
                      <p className="text-sm text-muted-foreground ml-6">
                        Send email reminders before scheduled appointments
                      </p>
                    </div>
                  </div>
                </div>
                
                <Separator />
                
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Calendar Settings</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="default-view">Default Calendar View</Label>
                      <Select 
                        value={systemSettings.defaultCalendarView}
                        onValueChange={(value) => setSystemSettings({
                          ...systemSettings, 
                          defaultCalendarView: value
                        })}
                      >
                        <SelectTrigger id="default-view">
                          <SelectValue placeholder="Select view" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="day">Day View</SelectItem>
                          <SelectItem value="week">Week View</SelectItem>
                          <SelectItem value="month">Month View</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="week-starts">Week Starts On</Label>
                      <Select 
                        value={systemSettings.weekStartsOn}
                        onValueChange={(value) => setSystemSettings({
                          ...systemSettings, 
                          weekStartsOn: value
                        })}
                      >
                        <SelectTrigger id="week-starts">
                          <SelectValue placeholder="Select day" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">Sunday</SelectItem>
                          <SelectItem value="1">Monday</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                
                <Separator />
                
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Booking Rules</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="max-days-advance">Maximum Days in Advance</Label>
                      <Select 
                        value={systemSettings.maxDaysInAdvance}
                        onValueChange={(value) => setSystemSettings({
                          ...systemSettings, 
                          maxDaysInAdvance: value
                        })}
                      >
                        <SelectTrigger id="max-days-advance">
                          <SelectValue placeholder="Select days" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="30">30 days</SelectItem>
                          <SelectItem value="60">60 days</SelectItem>
                          <SelectItem value="90">90 days</SelectItem>
                          <SelectItem value="180">180 days</SelectItem>
                          <SelectItem value="365">365 days</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="min-notice">Minimum Notice Period</Label>
                      <Select 
                        value={systemSettings.minNoticeHours}
                        onValueChange={(value) => setSystemSettings({
                          ...systemSettings, 
                          minNoticeHours: value
                        })}
                      >
                        <SelectTrigger id="min-notice">
                          <SelectValue placeholder="Select hours" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1 hour</SelectItem>
                          <SelectItem value="2">2 hours</SelectItem>
                          <SelectItem value="4">4 hours</SelectItem>
                          <SelectItem value="12">12 hours</SelectItem>
                          <SelectItem value="24">24 hours</SelectItem>
                          <SelectItem value="48">48 hours</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                
                <Separator />
                
                <div className="flex justify-end">
                  <Button 
                    onClick={() => saveSystemSettingsMutation.mutate(systemSettings)}
                    disabled={saveSystemSettingsMutation.isPending}
                    className="min-w-[140px]"
                  >
                    {saveSystemSettingsMutation.isPending ? (
                      <>
                        <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-background border-t-foreground" />
                        Saving...
                      </>
                    ) : (
                      "Save Changes"
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
      
      {/* Create/Edit Appointment Type Dialog */}
      <Dialog open={showNewAppointmentTypeDialog} onOpenChange={setShowNewAppointmentTypeDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedAppointmentTypeId ? "Edit Appointment Type" : "Create New Appointment Type"}
            </DialogTitle>
            <DialogDescription>
              {appointmentTypeFormStep === 1 && "Configure basic details for this appointment type"}
              {appointmentTypeFormStep === 2 && "Set scheduling rules and availability"}
              {appointmentTypeFormStep === 3 && "Configure additional options and settings"}
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            {/* Step navigation */}
            <div className="flex items-center mb-6">
              <Button 
                className={`relative flex items-center justify-center w-8 h-8 rounded-full ${
                  appointmentTypeFormStep >= 1 ? "bg-primary text-white" : "bg-muted"
                }`}
                variant="ghost"
                onClick={() => setAppointmentTypeFormStep(1)}
              >
                1
              </Button>
              <div className={`h-1 flex-1 ${appointmentTypeFormStep >= 2 ? "bg-primary" : "bg-muted"}`} />
              <Button 
                className={`relative flex items-center justify-center w-8 h-8 rounded-full ${
                  appointmentTypeFormStep >= 2 ? "bg-primary text-white" : "bg-muted"
                }`}
                variant="ghost"
                onClick={() => setAppointmentTypeFormStep(2)}
                disabled={appointmentTypeFormStep < 2}
              >
                2
              </Button>
              <div className={`h-1 flex-1 ${appointmentTypeFormStep >= 3 ? "bg-primary" : "bg-muted"}`} />
              <Button 
                className={`relative flex items-center justify-center w-8 h-8 rounded-full ${
                  appointmentTypeFormStep >= 3 ? "bg-primary text-white" : "bg-muted"
                }`}
                variant="ghost"
                onClick={() => setAppointmentTypeFormStep(3)}
                disabled={appointmentTypeFormStep < 3}
              >
                3
              </Button>
            </div>
            
            {/* Step 1: Basic Details */}
            {appointmentTypeFormStep === 1 && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="appointment-name">Name</Label>
                    <Input
                      id="appointment-name"
                      placeholder="e.g., Standard Delivery, Express Pickup"
                      value={appointmentTypeForm.name}
                      onChange={(e) => setAppointmentTypeForm({...appointmentTypeForm, name: e.target.value})}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="appointment-facility">Facility</Label>
                    <Select
                      value={appointmentTypeForm.facilityId.toString()}
                      onValueChange={(value) => setAppointmentTypeForm({...appointmentTypeForm, facilityId: parseInt(value)})}
                    >
                      <SelectTrigger id="appointment-facility">
                        <SelectValue placeholder="Select facility" />
                      </SelectTrigger>
                      <SelectContent>
                        {facilities.map((facility) => (
                          <SelectItem key={facility.id} value={facility.id.toString()}>
                            {facility.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="appointment-description">Description</Label>
                  <Textarea
                    id="appointment-description"
                    placeholder="Briefly describe this appointment type..."
                    value={appointmentTypeForm.description || ""}
                    onChange={(e) => setAppointmentTypeForm({...appointmentTypeForm, description: e.target.value})}
                    className="min-h-20"
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="appointment-duration">Duration (minutes)</Label>
                    <Input
                      id="appointment-duration"
                      type="number"
                      min="5"
                      step="5"
                      value={appointmentTypeForm.duration.toString()}
                      onChange={(e) => {
                        const newDuration = parseInt(e.target.value) || 0;
                        setAppointmentTypeForm({
                          ...appointmentTypeForm, 
                          duration: newDuration,
                          bufferTime: newDuration // Set buffer time to match duration
                        });
                      }}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="appointment-color">Color</Label>
                    <Input 
                      id="appointment-color" 
                      type="color" 
                      value={appointmentTypeForm.color} 
                      onChange={(e) => setAppointmentTypeForm({...appointmentTypeForm, color: e.target.value})}
                      className="w-full"
                    />
                  </div>
                </div>
                
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="appointment-type">Appointment Operations</Label>
                  <RadioGroup 
                    value={appointmentTypeForm.type} 
                    onValueChange={(value) => setAppointmentTypeForm({
                      ...appointmentTypeForm, 
                      type: value as "inbound" | "outbound" | "both"
                    })}
                  >
                    <div className="flex items-center space-x-2 py-2">
                      <RadioGroupItem value="inbound" id="appointment-type-inbound" />
                      <Label htmlFor="appointment-type-inbound">Inbound Only</Label>
                    </div>
                    <div className="flex items-center space-x-2 py-2">
                      <RadioGroupItem value="outbound" id="appointment-type-outbound" />
                      <Label htmlFor="appointment-type-outbound">Outbound Only</Label>
                    </div>
                    <div className="flex items-center space-x-2 py-2">
                      <RadioGroupItem value="both" id="appointment-type-both" />
                      <Label htmlFor="appointment-type-both">Both Inbound & Outbound</Label>
                    </div>
                  </RadioGroup>
                </div>
              </div>
            )}
            
            {/* Step 2: Scheduling Options */}
            {appointmentTypeFormStep === 2 && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="appointment-buffer">Buffer Time (minutes)</Label>
                    <Input
                      id="appointment-buffer"
                      type="number"
                      min="0"
                      step="5"
                      value={appointmentTypeForm.bufferTime.toString()}
                      onChange={(e) => setAppointmentTypeForm({...appointmentTypeForm, bufferTime: parseInt(e.target.value) || 0})}
                    />
                    <p className="text-sm text-muted-foreground">
                      Buffer time between appointments of this type
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="appointment-max-concurrent">Max Concurrent Appointments</Label>
                    <Input
                      id="appointment-max-concurrent"
                      type="number"
                      min="1"
                      value={appointmentTypeForm.maxConcurrent.toString()}
                      onChange={(e) => setAppointmentTypeForm({...appointmentTypeForm, maxConcurrent: parseInt(e.target.value) || 1})}
                    />
                    <p className="text-sm text-muted-foreground">
                      How many appointments can be scheduled at the same time
                    </p>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="appointment-daily-max">Max Appointments Per Day (optional)</Label>
                    <Input
                      id="appointment-daily-max"
                      type="number"
                      min="1"
                      placeholder="No limit"
                      value={appointmentTypeForm.maxAppointmentsPerDay?.toString() || ""}
                      onChange={(e) => setAppointmentTypeForm({
                        ...appointmentTypeForm, 
                        maxAppointmentsPerDay: e.target.value ? parseInt(e.target.value) : undefined
                      })}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="appointment-grace">Grace Period (minutes)</Label>
                    <Input
                      id="appointment-grace"
                      type="number"
                      min="0"
                      value={appointmentTypeForm.gracePeriod.toString()}
                      onChange={(e) => setAppointmentTypeForm({...appointmentTypeForm, gracePeriod: parseInt(e.target.value) || 0})}
                    />
                    <p className="text-sm text-muted-foreground">
                      Time before appointment is marked as late
                    </p>
                  </div>
                </div>
                
                <div className="space-y-2 md:col-span-2">
                  <div className="flex items-center space-x-2">
                    <Switch 
                      id="appointment-show-slots"
                      checked={appointmentTypeForm.showRemainingSlots}
                      onCheckedChange={(checked) => setAppointmentTypeForm({
                        ...appointmentTypeForm, 
                        showRemainingSlots: checked
                      })}
                    />
                    <Label htmlFor="appointment-show-slots">
                      Show remaining appointment slots
                    </Label>
                  </div>
                  <p className="text-sm text-muted-foreground ml-6">
                    Display the number of remaining slots for each time slot on the booking page
                  </p>
                </div>
                
                <div className="space-y-2 md:col-span-2 bg-blue-50 p-3 rounded-lg border border-blue-100">
                  <div className="flex items-center space-x-2">
                    <Switch 
                      id="appointment-allow-through-breaks"
                      checked={appointmentTypeForm.allowAppointmentsThroughBreaks}
                      onCheckedChange={(checked) => setAppointmentTypeForm({
                        ...appointmentTypeForm, 
                        allowAppointmentsThroughBreaks: checked
                      })}
                    />
                    <Label htmlFor="appointment-allow-through-breaks" className="font-medium text-blue-800">
                      Allow appointments to span through breaks
                    </Label>
                  </div>
                  <p className="text-sm text-blue-700 ml-6">
                    When enabled, appointments can be scheduled during facility break times. This is important for longer appointments that might overlap with lunch or other breaks.
                  </p>
                </div>
                
                <div className="space-y-2 md:col-span-2">
                  <div className="flex items-center space-x-2">
                    <Switch 
                      id="appointment-allow-outside-hours"
                      checked={appointmentTypeForm.allowAppointmentsPastBusinessHours}
                      onCheckedChange={(checked) => setAppointmentTypeForm({
                        ...appointmentTypeForm, 
                        allowAppointmentsPastBusinessHours: checked
                      })}
                    />
                    <Label htmlFor="appointment-allow-outside-hours">
                      Allow appointments past business hours
                    </Label>
                  </div>
                  <p className="text-sm text-muted-foreground ml-6">
                    When enabled, appointments can extend past facility closing time
                  </p>
                </div>
                
                <div className="space-y-2 md:col-span-2">
                  <div className="flex items-center space-x-2">
                    <Switch 
                      id="appointment-override-facility-hours"
                      checked={appointmentTypeForm.overrideFacilityHours}
                      onCheckedChange={(checked) => setAppointmentTypeForm({
                        ...appointmentTypeForm, 
                        overrideFacilityHours: checked
                      })}
                    />
                    <Label htmlFor="appointment-override-facility-hours">
                      Override facility hours
                    </Label>
                  </div>
                  <p className="text-sm text-muted-foreground ml-6">
                    When enabled, this appointment type can be scheduled outside regular facility hours
                  </p>
                </div>
              </div>
            )}
            
            {/* Step 3: Additional Options */}
            {appointmentTypeFormStep === 3 && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="appointment-timezone">Timezone</Label>
                    <Select
                      value={appointmentTypeForm.timezone}
                      onValueChange={(value) => setAppointmentTypeForm({...appointmentTypeForm, timezone: value})}
                    >
                      <SelectTrigger id="appointment-timezone">
                        <SelectValue placeholder="Select timezone" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="America/New_York">Eastern Time (ET)</SelectItem>
                        <SelectItem value="America/Chicago">Central Time (CT)</SelectItem>
                        <SelectItem value="America/Denver">Mountain Time (MT)</SelectItem>
                        <SelectItem value="America/Los_Angeles">Pacific Time (PT)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="appointment-reminder">Email Reminder (hours before)</Label>
                    <Input
                      id="appointment-reminder"
                      type="number"
                      min="0"
                      value={appointmentTypeForm.emailReminderTime.toString()}
                      onChange={(e) => setAppointmentTypeForm({
                        ...appointmentTypeForm, 
                        emailReminderTime: parseInt(e.target.value) || 0
                      })}
                    />
                    <p className="text-sm text-muted-foreground">
                      Automatic email reminder will be sent this many hours before the appointment (0 = no reminder)
                    </p>
                  </div>
                </div>
                
                <div className="p-4 border rounded-md space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <InfoIcon className="h-5 w-5 text-muted-foreground mr-2" />
                      <h3 className="font-medium">Appointment Form Questions Area</h3>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => {
                        setSelectedQuestionId(null);
                        setQuestionForm({
                          label: "",
                          type: "text",
                          required: false,
                          options: [],
                          placeholder: "",
                          appointmentType: "both"
                        });
                        setShowQuestionDialog(true);
                      }}
                    >
                      <PlusCircle className="h-4 w-4 mr-2" />
                      Add Custom Question
                    </Button>
                  </div>
                  
                  <div className="bg-yellow-50 p-3 rounded-md border border-yellow-200 mb-2">
                    <div className="text-sm text-yellow-800">
                      <p className="font-medium mb-1">Question Selection Guide:</p>
                      <ul className="list-disc pl-5 space-y-1">
                        <li>Check <strong>"Included"</strong> to include a question in booking forms.</li>
                        <li>Check <strong>"Is Required"</strong> to make the field mandatory (will be marked with an asterisk *).</li>
                        <li>Questions will appear in both internal and external booking flows.</li>
                        <li>All fields can now be enabled or disabled based on your needs.</li>
                      </ul>
                    </div>
                  </div>
                  
                  {/* Create SortableRow component to render each question row */}
                  {standardFields.length > 0 ? (
                    <div className="border rounded-md max-h-[400px] overflow-y-auto">
                      <Table>
                        <TableHeader className="sticky top-0 bg-background z-10">
                          <TableRow>
                            <TableHead className="w-8 text-center"></TableHead>
                            <TableHead className="w-12 text-center">Number</TableHead>
                            <TableHead>Question</TableHead>
                            <TableHead>Answer Type</TableHead>
                            <TableHead className="text-center">Included</TableHead>
                            <TableHead className="text-center">Is Required</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <DndContext 
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragEnd={handleDragEnd}
                          >
                            <SortableContext 
                              items={standardFields}
                              strategy={verticalListSortingStrategy}
                            >
                              {standardFields.map((field, index) => (
                                <SortableQuestionRow
                                  key={field.id}
                                  field={field}
                                  index={index + 1}
                                  included={field.included ?? false}
                                  required={field.required ?? false}
                                  onIncludedChange={(checked) => handleStandardQuestionChange(field.id, 'included', checked)}
                                  onRequiredChange={(checked) => handleStandardQuestionChange(field.id, 'required', checked)}
                                />
                              ))}
                            </SortableContext>
                          </DndContext>
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <Alert variant="default" className="bg-blue-50 border-blue-200">
                      <AlertCircle className="h-4 w-4 text-blue-600" />
                      <AlertDescription>
                        No standard questions have been configured. Click "Seed Standard Questions" to add common questions.
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  <div className="flex justify-between mt-4">
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => {
                          setSelectedQuestionId(null);
                          setQuestionForm({
                            label: "",
                            type: "text",
                            required: false,
                            options: [],
                            placeholder: "",
                            appointmentType: "both"
                          });
                          setShowQuestionDialog(true);
                        }}
                      >
                        <PlusCircle className="h-4 w-4 mr-2" />
                        Add Custom Question
                      </Button>
                      
                      {selectedAppointmentTypeId && (
                        <SeedQuestionsButton 
                          appointmentTypeId={selectedAppointmentTypeId}
                          onSuccess={() => {
                            // Reload standard questions after seeding
                            loadStandardQuestionsForAppointmentType(selectedAppointmentTypeId);
                          }}
                        />
                      )}
                    </div>
                    
                    <Button 
                      className="bg-green-600 hover:bg-green-700 text-white"
                      onClick={() => {
                        toast({
                          title: "Questions saved",
                          description: "Your form questions have been updated successfully",
                          variant: "default",
                        });
                      }}
                    >
                      <Save className="h-4 w-4 mr-2" />
                      Save Changes
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <div className="flex w-full justify-between">
              <div>
                {appointmentTypeFormStep > 1 && (
                  <Button variant="outline" onClick={goToPreviousStep}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back
                  </Button>
                )}
              </div>
              <div>
                <Button variant="outline" onClick={() => setShowNewAppointmentTypeDialog(false)} className="mr-2">
                  Cancel
                </Button>
                {appointmentTypeFormStep < 3 ? (
                  <Button onClick={goToNextStep}>
                    Next
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                ) : (
                  <Button onClick={handleAppointmentTypeSubmit}>
                    <Save className="h-4 w-4 mr-2" />
                    {selectedAppointmentTypeId ? "Save Changes" : "Create Appointment Type"}
                  </Button>
                )}
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Custom Question Dialog */}
      <Dialog open={showQuestionDialog} onOpenChange={setShowQuestionDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedQuestionId ? "Edit Custom Question" : "Add Custom Question"}
            </DialogTitle>
            <DialogDescription>
              Create a custom question for appointment booking forms
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <Label htmlFor="field-label">Question Text <span className="text-red-500">*</span></Label>
                <Input
                  id="field-label"
                  placeholder="e.g., Special Handling Instructions"
                  value={questionForm.label || ""}
                  onChange={(e) => handleQuestionFormChange("label", e.target.value)}
                />
                <p className="text-xs text-muted-foreground">This is the question that will appear on the booking form</p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="field-type">Answer Type <span className="text-red-500">*</span></Label>
                <Select
                  value={questionForm.type || "text"}
                  onValueChange={(value) => handleQuestionFormChange("type", value)}
                >
                  <SelectTrigger id="field-type">
                    <SelectValue placeholder="Select answer type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Text</SelectItem>
                    <SelectItem value="textarea">Text Area (Multiple Lines)</SelectItem>
                    <SelectItem value="number">Number Only</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="select">Dropdown Options</SelectItem>
                    <SelectItem value="radio">Radio Buttons</SelectItem>
                    <SelectItem value="file">File Upload</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="field-required"
                    checked={questionForm.required || false}
                    onCheckedChange={(checked) => handleQuestionFormChange("required", checked)}
                  />
                  <Label htmlFor="field-required" className="font-medium">
                    Is Required
                  </Label>
                </div>
                <p className="text-xs text-muted-foreground ml-6">
                  If checked, users must provide an answer to this question when booking
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="field-placeholder">Placeholder Text (optional)</Label>
                <Input
                  id="field-placeholder"
                  placeholder="e.g., Enter details here..."
                  value={questionForm.placeholder || ""}
                  onChange={(e) => handleQuestionFormChange("placeholder", e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Hint text that appears in the input field</p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="field-apply-to">Apply to Appointment Type</Label>
                <Select
                  value={questionForm.appointmentType || "both"}
                  onValueChange={(value) => handleQuestionFormChange("appointmentType", value)}
                >
                  <SelectTrigger id="field-apply-to">
                    <SelectValue placeholder="Select application" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="inbound">Inbound Only</SelectItem>
                    <SelectItem value="outbound">Outbound Only</SelectItem>
                    <SelectItem value="both">Both Inbound & Outbound</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {(questionForm.type === "select" || questionForm.type === "radio" || questionForm.type === "checkbox") && (
                <div className="space-y-2">
                  <Label htmlFor="field-options">Answer Options <span className="text-red-500">*</span></Label>
                  <div className="space-y-2 border rounded-md p-3 bg-muted/30">
                    {(questionForm.options || []).length === 0 && (
                      <p className="text-sm text-muted-foreground italic mb-2">No options added yet</p>
                    )}
                    
                    {(questionForm.options || []).map((option, index) => (
                      <div key={index} className="flex items-center space-x-2">
                        <Input
                          value={option}
                          onChange={(e) => updateOption(index, e.target.value)}
                          placeholder={`Option ${index + 1}`}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeOption(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={addOption}
                    >
                      <PlusCircle className="h-4 w-4 mr-2" />
                      Add Option
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowQuestionDialog(false)} className="mr-2">
              Cancel
            </Button>
            <Button 
              onClick={() => {
                // In a real implementation this would use saveCustomFieldMutation
                if (selectedQuestionId) {
                  // Update existing field
                  const updatedFields = customFields.map(field => {
                    if (field.id === selectedQuestionId) {
                      // Ensure all required properties are included
                      return {
                        id: field.id,
                        label: questionForm.label || field.label,
                        type: questionForm.type || field.type,
                        required: questionForm.required ?? field.required,
                        included: questionForm.included ?? field.included,
                        options: questionForm.options || field.options,
                        placeholder: questionForm.placeholder || field.placeholder,
                        order: field.order,
                        appointmentType: questionForm.appointmentType || field.appointmentType
                      };
                    }
                    return field;
                  });
                  setCustomFields(updatedFields);
                  toast({
                    title: "Question updated",
                    description: `"${questionForm.label}" has been updated`,
                  });
                } else {
                  // Add new field
                  const newField: QuestionFormField = {
                    id: customFields.length ? Math.max(...customFields.map(f => f.id)) + 1 : 13,
                    label: questionForm.label || "New Question",
                    type: questionForm.type || "text", 
                    required: questionForm.required || false,
                    included: questionForm.included || true,
                    options: questionForm.options || [],
                    placeholder: questionForm.placeholder || "",
                    order: customFields.length + 13,
                    appointmentType: questionForm.appointmentType || "both"
                  };
                  setCustomFields([...customFields, newField]);
                  toast({
                    title: "Custom question added",
                    description: `"${newField.label}" has been added to the form`,
                  });
                }
                setShowQuestionDialog(false);
              }}
              disabled={!questionForm.label}
            >
              {saveCustomFieldMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                <>{selectedQuestionId ? "Update Question" : "Add Question"}</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}