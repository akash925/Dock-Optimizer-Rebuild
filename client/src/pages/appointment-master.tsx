import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import Layout from "@/components/layout/index";
import { Facility, AppointmentType, insertAppointmentTypeSchema } from "@shared/schema";
import SeedAppointmentTypes from "@/components/appointment-master/seed-appointment-types";
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
import { CalendarDays, Clock, FilePlus, PlusCircle, Save, Settings, Shield, Trash2, AlertTriangle, HelpCircle, Loader2, Copy, Pencil, MoreHorizontal, CheckCircle, ArrowLeft, ArrowRight, ChevronRight } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { weekDays } from "@/lib/utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";

interface QuestionFormField {
  id: number;
  label: string;
  type: "text" | "textarea" | "select" | "radio" | "checkbox" | "file";
  required: boolean;
  options?: string[];
  placeholder?: string;
  order: number;
  appointmentType: "inbound" | "outbound" | "both";
}

interface AvailabilityRule {
  id: number;
  dayOfWeek: number; // 0-6 for Sunday-Saturday
  maxAppointments: number;
  startTime: string;
  endTime: string;
  appointmentType: "inbound" | "outbound" | "both";
}

export default function AppointmentMaster() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("types");
  const [selectedQuestionId, setSelectedQuestionId] = useState<number | null>(null);
  const [showQuestionDialog, setShowQuestionDialog] = useState(false);
  const [showAvailabilityDialog, setShowAvailabilityDialog] = useState(false);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  
  // Appointment Type Management
  const [showNewAppointmentTypeDialog, setShowNewAppointmentTypeDialog] = useState(false);
  const [selectedAppointmentTypeId, setSelectedAppointmentTypeId] = useState<number | null>(null);
  const [appointmentTypeFormStep, setAppointmentTypeFormStep] = useState(1); // 1: Details, 2: Scheduling, 3: Questions
  
  // Appointment Type Form Data
  const [appointmentTypeForm, setAppointmentTypeForm] = useState({
    name: "",
    description: "",
    facilityId: 0,
    color: "#4CAF50",
    duration: 60,
    type: "both", // Default to "both" for inbound/outbound
    maxSlots: 1,
    timezone: "America/New_York",
    gracePeriod: 15,
    emailReminderTime: 24,
    showRemainingSlots: true,
    location: ""
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
  
  // Form fields for availability rule editing
  const [availabilityForm, setAvailabilityForm] = useState<Partial<AvailabilityRule>>({
    dayOfWeek: 1, // Monday default
    maxAppointments: 10,
    startTime: "08:00",
    endTime: "17:00",
    appointmentType: "both"
  });
  
  // Fetch facilities from API
  const { data: facilities = [], isLoading: isLoadingFacilities } = useQuery<Facility[]>({
    queryKey: ["/api/facilities"],
  });

  // Fetch appointment types from API
  const { data: apiAppointmentTypes = [], isLoading: isLoadingAppointmentTypes } = useQuery<AppointmentType[]>({
    queryKey: ["/api/appointment-types"],
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
  
  // Mock data for question form fields
  const [customFields, setCustomFields] = useState<QuestionFormField[]>([
    { 
      id: 1, 
      label: "Customer Name", 
      type: "text", 
      required: true, 
      placeholder: "Enter customer name", 
      order: 1,
      appointmentType: "both"
    },
    { 
      id: 2, 
      label: "Hazardous Materials", 
      type: "radio", 
      required: true, 
      options: ["Yes", "No"], 
      order: 2,
      appointmentType: "inbound"
    },
    { 
      id: 3, 
      label: "Packaging Type", 
      type: "select", 
      required: true, 
      options: ["Pallets", "Boxes", "Containers", "Loose Items"], 
      order: 3,
      appointmentType: "outbound"
    },
    { 
      id: 4, 
      label: "Temperature Requirements", 
      type: "select", 
      required: false, 
      options: ["Ambient", "Refrigerated", "Frozen"], 
      order: 4,
      appointmentType: "both"
    }
  ]);
  
  // Mock data for availability rules
  const [availabilityRules, setAvailabilityRules] = useState<AvailabilityRule[]>([
    { id: 1, dayOfWeek: 1, maxAppointments: 15, startTime: "08:00", endTime: "17:00", appointmentType: "both" },
    { id: 2, dayOfWeek: 2, maxAppointments: 15, startTime: "08:00", endTime: "17:00", appointmentType: "both" },
    { id: 3, dayOfWeek: 3, maxAppointments: 15, startTime: "08:00", endTime: "17:00", appointmentType: "both" },
    { id: 4, dayOfWeek: 4, maxAppointments: 15, startTime: "08:00", endTime: "17:00", appointmentType: "both" },
    { id: 5, dayOfWeek: 5, maxAppointments: 12, startTime: "08:00", endTime: "16:00", appointmentType: "both" },
    { id: 6, dayOfWeek: 6, maxAppointments: 8, startTime: "09:00", endTime: "13:00", appointmentType: "inbound" },
    { id: 7, dayOfWeek: 0, maxAppointments: 0, startTime: "00:00", endTime: "00:00", appointmentType: "both" },
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
      const response = await apiRequest("PATCH", `/api/appointment-types/${appointmentType.id}`, appointmentType);
      return await response.json();
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
      const response = await apiRequest("POST", `/api/appointment-types`, appointmentType);
      return await response.json();
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
      
      const response = await apiRequest("POST", `/api/appointment-types`, duplicateData);
      return await response.json();
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
      // Mock API call
      return new Promise<QuestionFormField>((resolve) => {
        setTimeout(() => {
          const newField = {
            id: selectedQuestionId || Math.max(0, ...customFields.map(f => f.id)) + 1,
            label: field.label || "Untitled Field",
            type: field.type || "text",
            required: !!field.required,
            options: field.options || [],
            placeholder: field.placeholder || "",
            order: field.order || customFields.length + 1,
            appointmentType: field.appointmentType || "both"
          } as QuestionFormField;
          resolve(newField);
        }, 500);
      });
    },
    onSuccess: (newField) => {
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
      
      toast({
        title: "Success",
        description: `Field ${selectedQuestionId ? "updated" : "created"} successfully`,
      });
    }
  });
  
  const saveAvailabilityRuleMutation = useMutation({
    mutationFn: async (rule: Partial<AvailabilityRule>) => {
      // Mock API call
      return new Promise<AvailabilityRule>((resolve) => {
        setTimeout(() => {
          const newRule = {
            id: selectedDay !== null 
              ? availabilityRules.find(r => r.dayOfWeek === selectedDay)?.id || Math.max(0, ...availabilityRules.map(r => r.id)) + 1
              : Math.max(0, ...availabilityRules.map(r => r.id)) + 1,
            dayOfWeek: rule.dayOfWeek || 1,
            maxAppointments: rule.maxAppointments || 0,
            startTime: rule.startTime || "08:00",
            endTime: rule.endTime || "17:00",
            appointmentType: rule.appointmentType || "both"
          } as AvailabilityRule;
          resolve(newRule);
        }, 500);
      });
    },
    onSuccess: (newRule) => {
      const existingRuleIndex = availabilityRules.findIndex(r => r.dayOfWeek === newRule.dayOfWeek);
      
      let updatedRules;
      if (existingRuleIndex >= 0) {
        updatedRules = [...availabilityRules];
        updatedRules[existingRuleIndex] = newRule;
      } else {
        updatedRules = [...availabilityRules, newRule];
      }
      
      setAvailabilityRules(updatedRules);
      setShowAvailabilityDialog(false);
      setSelectedDay(null);
      
      toast({
        title: "Success",
        description: "Availability rule updated successfully",
      });
    }
  });
  
  // Delete custom field
  const deleteCustomField = (id: number) => {
    setCustomFields(customFields.filter(field => field.id !== id));
    toast({
      title: "Field Deleted",
      description: "The custom field has been removed",
    });
  };
  
  // Edit custom field
  const editCustomField = (field: QuestionFormField) => {
    setSelectedQuestionId(field.id);
    setQuestionForm({
      label: field.label,
      type: field.type,
      required: field.required,
      options: field.options || [],
      placeholder: field.placeholder,
      appointmentType: field.appointmentType
    });
    setShowQuestionDialog(true);
  };
  
  // Edit availability rule
  const editAvailabilityRule = (dayOfWeek: number) => {
    const rule = availabilityRules.find(r => r.dayOfWeek === dayOfWeek);
    if (rule) {
      setSelectedDay(dayOfWeek);
      setAvailabilityForm({
        dayOfWeek: rule.dayOfWeek,
        maxAppointments: rule.maxAppointments,
        startTime: rule.startTime,
        endTime: rule.endTime,
        appointmentType: rule.appointmentType
      });
    } else {
      setSelectedDay(dayOfWeek);
      setAvailabilityForm({
        dayOfWeek: dayOfWeek,
        maxAppointments: 0,
        startTime: "08:00",
        endTime: "17:00",
        appointmentType: "both"
      });
    }
    setShowAvailabilityDialog(true);
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
    setQuestionForm(prev => ({
      ...prev,
      options: (prev.options || []).filter((_, i) => i !== index)
    }));
  };
  
  // Handle form changes for availability rules
  const handleAvailabilityFormChange = (field: string, value: any) => {
    setAvailabilityForm(prev => ({ ...prev, [field]: value }));
  };
  
  const getAppointmentTypeLabel = (type: string) => {
    switch (type) {
      case "inbound": return <Badge variant="outline" className="bg-slate-50 text-blue-700 border-blue-200">Inbound</Badge>;
      case "outbound": return <Badge variant="outline" className="bg-slate-50 text-emerald-700 border-emerald-200">Outbound</Badge>;
      case "both": return <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200">Both</Badge>;
      default: return null;
    }
  };
  
  return (
    <Layout>
      <div className="container mx-auto py-6 space-y-6">
        <h1 className="text-3xl font-bold text-center mb-6">Appointment Master</h1>
        
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center space-x-2">
            <span className="text-muted-foreground">Configure appointment types, forms, and availability</span>
          </div>
        </div>
        
        <div className="border rounded-md">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="types">
                <FilePlus className="h-4 w-4 mr-2" />
                Appointment Types
              </TabsTrigger>
              <TabsTrigger value="questions">
                <FilePlus className="h-4 w-4 mr-2" />
                Custom Questions
              </TabsTrigger>
              <TabsTrigger value="availability">
                <Clock className="h-4 w-4 mr-2" />
                Availability Rules
              </TabsTrigger>
              <TabsTrigger value="settings">
                <Settings className="h-4 w-4 mr-2" />
                General Settings
              </TabsTrigger>
            </TabsList>
          
          {/* Appointment Types Tab */}
          <TabsContent value="types">
            <Card>
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
                    setAppointmentTypeForm({
                      name: "",
                      description: "",
                      facilityId: facilities.length > 0 ? facilities[0].id : 0,
                      color: "#4CAF50",
                      duration: 60,
                      type: "both",
                      maxSlots: 1,
                      timezone: "America/New_York",
                      gracePeriod: 15,
                      emailReminderTime: 24,
                      showRemainingSlots: true,
                      location: ""
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
                                  setSelectedAppointmentTypeId(appointmentType.id);
                                  // Set the form data from the selected appointment type
                                  setAppointmentTypeForm({
                                    name: appointmentType.name || "",
                                    description: appointmentType.description || "",
                                    facilityId: appointmentType.facilityId || (facilities.length > 0 ? facilities[0].id : 0),
                                    color: appointmentType.color || "#4CAF50",
                                    duration: appointmentType.duration || 60,
                                    type: appointmentType.type || "both",
                                    maxSlots: appointmentType.maxSlots || 1,
                                    timezone: appointmentType.timezone || "America/New_York",
                                    gracePeriod: appointmentType.gracePeriod || 15,
                                    emailReminderTime: appointmentType.emailReminderTime || 24,
                                    showRemainingSlots: appointmentType.showRemainingSlots ?? true,
                                    location: appointmentType.location || ""
                                  });
                                  setAppointmentTypeFormStep(1);
                                  setShowNewAppointmentTypeDialog(true);
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
              </CardContent>
            </Card>
            
            <div className="mt-6">
              <SeedAppointmentTypes />
            </div>
          </TabsContent>
          
          {/* Custom Questions Tab */}
          <TabsContent value="questions">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Custom Form Questions</CardTitle>
                    <CardDescription>
                      Create and manage custom fields for appointment forms
                    </CardDescription>
                  </div>
                  <Button onClick={() => {
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
                  }}>
                    <PlusCircle className="h-4 w-4 mr-2" />
                    Add Question
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {customFields.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>No custom questions have been created yet.</p>
                    <p className="text-sm mt-2">Click "Add Question" to create your first custom question.</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[50px]">Order</TableHead>
                        <TableHead>Field Label</TableHead>
                        <TableHead>Field Type</TableHead>
                        <TableHead>Required</TableHead>
                        <TableHead>Appointment Type</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {customFields.map((field) => (
                        <TableRow key={field.id}>
                          <TableCell>{field.order}</TableCell>
                          <TableCell className="font-medium">{field.label}</TableCell>
                          <TableCell className="capitalize">{field.type}</TableCell>
                          <TableCell>{field.required ? "Yes" : "No"}</TableCell>
                          <TableCell>{getAppointmentTypeLabel(field.appointmentType)}</TableCell>
                          <TableCell className="text-right">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => editCustomField(field)}
                            >
                              Edit
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="text-red-500"
                              onClick={() => deleteCustomField(field.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Availability Rules Tab */}
          <TabsContent value="availability">
            <Card>
              <CardHeader>
                <CardTitle>Appointment Availability Rules</CardTitle>
                <CardDescription>
                  Set the maximum number of appointments allowed for each day of the week
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {weekDays.map((day, index) => {
                    const dayRule = availabilityRules.find(r => r.dayOfWeek === index);
                    const isClosed = !dayRule || dayRule.maxAppointments === 0;
                    
                    return (
                      <Card key={index} className={isClosed ? "border-dashed opacity-70" : ""}>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base flex justify-between items-center">
                            <span>{day}</span>
                            {isClosed && <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200">Closed</Badge>}
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          {!isClosed ? (
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Hours:</span>
                                <span>{dayRule?.startTime} - {dayRule?.endTime}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Max Appointments:</span>
                                <span>{dayRule?.maxAppointments}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Type:</span>
                                <span>{getAppointmentTypeLabel(dayRule?.appointmentType || 'both')}</span>
                              </div>
                            </div>
                          ) : (
                            <div className="py-2 text-center text-muted-foreground text-sm">
                              Facility is closed on this day
                            </div>
                          )}
                        </CardContent>
                        <CardFooter className="pt-0">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="w-full"
                            onClick={() => editAvailabilityRule(index)}
                          >
                            {isClosed ? "Set hours" : "Edit"}
                          </Button>
                        </CardFooter>
                      </Card>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* General Settings Tab */}
          <TabsContent value="settings">
            <Card>
              <CardHeader>
                <CardTitle>General Appointment Settings</CardTitle>
                <CardDescription>
                  Configure global appointment settings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Advance Notice Requirements</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="inbound-advance">Inbound appointments (hours)</Label>
                      <Input id="inbound-advance" type="number" defaultValue="24" />
                      <p className="text-sm text-muted-foreground">
                        Minimum hours in advance for scheduling inbound appointments
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="outbound-advance">Outbound appointments (hours)</Label>
                      <Input id="outbound-advance" type="number" defaultValue="48" />
                      <p className="text-sm text-muted-foreground">
                        Minimum hours in advance for scheduling outbound appointments
                      </p>
                    </div>
                  </div>
                </div>
                
                <Separator />
                
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Scheduling Window</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="max-days">Maximum days in advance</Label>
                      <Input id="max-days" type="number" defaultValue="30" />
                      <p className="text-sm text-muted-foreground">
                        Maximum number of days in advance appointments can be scheduled
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="booking-buffer">Booking buffer (minutes)</Label>
                      <Input id="booking-buffer" type="number" defaultValue="15" />
                      <p className="text-sm text-muted-foreground">
                        Buffer time between appointments
                      </p>
                    </div>
                  </div>
                </div>
                
                <Separator />
                
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Notification Settings</h3>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Switch id="email-confirm" defaultChecked />
                      <Label htmlFor="email-confirm">
                        Send email confirmation to carriers
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch id="email-reminder" defaultChecked />
                      <Label htmlFor="email-reminder">
                        Send reminder 24 hours before appointment
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch id="sms-notification" />
                      <Label htmlFor="sms-notification">
                        Enable SMS notifications
                      </Label>
                    </div>
                  </div>
                </div>
                
                <Separator />
                
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Approval Settings</h3>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Switch id="auto-approval" defaultChecked />
                      <Label htmlFor="auto-approval">
                        Automatically approve appointments
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch id="manual-approval" />
                      <Label htmlFor="manual-approval">
                        Require manual approval for outbound appointments
                      </Label>
                    </div>
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <Button>
                  <Save className="h-4 w-4 mr-2" />
                  Save Settings
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>
        </Tabs>
        </div> {/* Close the border rounded-md div */}
        
        {/* Question Dialog */}
        <Dialog open={showQuestionDialog} onOpenChange={setShowQuestionDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{selectedQuestionId ? "Edit Question" : "Add New Question"}</DialogTitle>
              <DialogDescription>
                {selectedQuestionId 
                  ? "Update the properties of this custom question"
                  : "Add a new custom question to the appointment form"
                }
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="question-label">Label</Label>
                <Input 
                  id="question-label" 
                  value={questionForm.label || ""} 
                  onChange={(e) => handleQuestionFormChange("label", e.target.value)}
                  placeholder="Enter question label" 
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="question-type">Field Type</Label>
                <Select 
                  value={questionForm.type} 
                  onValueChange={(value) => handleQuestionFormChange("type", value)}
                >
                  <SelectTrigger id="question-type">
                    <SelectValue placeholder="Select field type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Text</SelectItem>
                    <SelectItem value="textarea">Textarea</SelectItem>
                    <SelectItem value="select">Dropdown</SelectItem>
                    <SelectItem value="radio">Radio Buttons</SelectItem>
                    <SelectItem value="checkbox">Checkboxes</SelectItem>
                    <SelectItem value="file">File Upload</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="question-required" 
                  checked={questionForm.required} 
                  onCheckedChange={(checked) => handleQuestionFormChange("required", checked)}
                />
                <Label htmlFor="question-required">Required field</Label>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="question-placeholder">Placeholder (optional)</Label>
                <Input 
                  id="question-placeholder" 
                  value={questionForm.placeholder || ""} 
                  onChange={(e) => handleQuestionFormChange("placeholder", e.target.value)}
                  placeholder="Enter placeholder text" 
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="question-applicable">Applicable To</Label>
                <Select 
                  value={questionForm.appointmentType || "both"} 
                  onValueChange={(value) => handleQuestionFormChange("appointmentType", value)}
                >
                  <SelectTrigger id="question-applicable">
                    <SelectValue placeholder="Select applicable appointment types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="both">All Appointments</SelectItem>
                    <SelectItem value="inbound">Inbound Only</SelectItem>
                    <SelectItem value="outbound">Outbound Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {(questionForm.type === "select" || questionForm.type === "radio" || questionForm.type === "checkbox") && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label>Options</Label>
                    <Button variant="outline" size="sm" onClick={addOption}>
                      <PlusCircle className="h-4 w-4 mr-2" />
                      Add Option
                    </Button>
                  </div>
                  
                  <div className="space-y-2">
                    {(questionForm.options || []).map((option, index) => (
                      <div key={index} className="flex items-center space-x-2">
                        <Input 
                          value={option} 
                          onChange={(e) => updateOption(index, e.target.value)}
                          placeholder={`Option ${index + 1}`} 
                        />
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="text-red-500"
                          onClick={() => removeOption(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    
                    {(questionForm.options || []).length === 0 && (
                      <div className="text-center py-2 text-muted-foreground text-sm">
                        No options added yet. Click "Add Option" to create some.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowQuestionDialog(false)}>
                Cancel
              </Button>
              <Button 
                onClick={() => saveCustomFieldMutation.mutate(questionForm)}
                disabled={saveCustomFieldMutation.isPending}
              >
                {saveCustomFieldMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {selectedQuestionId ? "Update Question" : "Add Question"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        
        {/* Availability Rule Dialog */}
        <Dialog open={showAvailabilityDialog} onOpenChange={setShowAvailabilityDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                Edit {weekDays[availabilityForm.dayOfWeek as number]} Availability
              </DialogTitle>
              <DialogDescription>
                Configure the availability for this day of the week
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="avail-open">Open for appointments</Label>
                <div className="flex items-center space-x-2">
                  <Switch 
                    id="avail-open" 
                    checked={availabilityForm.maxAppointments !== 0}
                    onCheckedChange={(checked) => {
                      handleAvailabilityFormChange("maxAppointments", checked ? 10 : 0);
                    }}
                  />
                  <Label htmlFor="avail-open">
                    {availabilityForm.maxAppointments === 0 ? "Closed" : "Open"}
                  </Label>
                </div>
              </div>
              
              {availabilityForm.maxAppointments !== 0 && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="avail-start">Start Time</Label>
                      <Input 
                        id="avail-start" 
                        type="time" 
                        value={availabilityForm.startTime || "08:00"} 
                        onChange={(e) => handleAvailabilityFormChange("startTime", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="avail-end">End Time</Label>
                      <Input 
                        id="avail-end" 
                        type="time" 
                        value={availabilityForm.endTime || "17:00"} 
                        onChange={(e) => handleAvailabilityFormChange("endTime", e.target.value)}
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="avail-max">Maximum Appointments</Label>
                    <Input 
                      id="avail-max" 
                      type="number" 
                      min="1"
                      value={availabilityForm.maxAppointments || 10} 
                      onChange={(e) => handleAvailabilityFormChange("maxAppointments", parseInt(e.target.value))}
                    />
                    <p className="text-sm text-muted-foreground">
                      Maximum number of appointments that can be scheduled on this day
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="avail-type">Appointment Type</Label>
                    <Select 
                      value={availabilityForm.appointmentType || "both"} 
                      onValueChange={(value) => handleAvailabilityFormChange("appointmentType", value)}
                    >
                      <SelectTrigger id="avail-type">
                        <SelectValue placeholder="Select appointment type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="both">All Appointments</SelectItem>
                        <SelectItem value="inbound">Inbound Only</SelectItem>
                        <SelectItem value="outbound">Outbound Only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAvailabilityDialog(false)}>
                Cancel
              </Button>
              <Button 
                onClick={() => saveAvailabilityRuleMutation.mutate(availabilityForm)}
                disabled={saveAvailabilityRuleMutation.isPending}
              >
                {saveAvailabilityRuleMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save Rule
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        
        {/* New Appointment Type Dialog */}
        <Dialog open={showNewAppointmentTypeDialog} onOpenChange={setShowNewAppointmentTypeDialog}>
          <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {selectedAppointmentTypeId ? "Edit Appointment Type" : "Create Appointment Type"}
              </DialogTitle>
              <DialogDescription>
                {selectedAppointmentTypeId 
                  ? "Update the properties of this appointment type"
                  : "Configure the details for your new appointment type"
                }
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6">
              {/* Step Navigation */}
              <div className="flex justify-between">
                <div className="flex space-x-1">
                  <Button 
                    variant={appointmentTypeFormStep === 1 ? "default" : "outline"}
                    size="sm"
                    onClick={() => setAppointmentTypeFormStep(1)}
                    className="rounded-full w-8 h-8 p-0"
                  >1</Button>
                  <Button 
                    variant={appointmentTypeFormStep === 2 ? "default" : "outline"}
                    size="sm"
                    onClick={() => setAppointmentTypeFormStep(2)}
                    className="rounded-full w-8 h-8 p-0"
                  >2</Button>
                  <Button 
                    variant={appointmentTypeFormStep === 3 ? "default" : "outline"}
                    size="sm"
                    onClick={() => setAppointmentTypeFormStep(3)}
                    className="rounded-full w-8 h-8 p-0"
                  >3</Button>
                </div>
                <div className="text-sm text-muted-foreground">
                  Step {appointmentTypeFormStep} of 3: {
                    appointmentTypeFormStep === 1 ? "Appointment Details" : 
                    appointmentTypeFormStep === 2 ? "Scheduling Settings" : 
                    "Custom Questions"
                  }
                </div>
              </div>
              
              {/* Step 1: Basic Details */}
              {appointmentTypeFormStep === 1 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="appointment-name">Appointment Type Name</Label>
                      <Input 
                        id="appointment-name" 
                        value={appointmentTypeForm.name} 
                        onChange={(e) => setAppointmentTypeForm({...appointmentTypeForm, name: e.target.value})}
                        placeholder="e.g., 1 Hour Trailer Appointment" 
                      />
                    </div>
                    
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="appointment-desc">Description (optional)</Label>
                      <Textarea 
                        id="appointment-desc" 
                        value={appointmentTypeForm.description || ""} 
                        onChange={(e) => setAppointmentTypeForm({...appointmentTypeForm, description: e.target.value})}
                        placeholder="Add a description for this appointment type" 
                        rows={3}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="appointment-facility">Facility</Label>
                      <Select 
                        value={appointmentTypeForm.facilityId.toString()} 
                        onValueChange={(value) => setAppointmentTypeForm({
                          ...appointmentTypeForm, 
                          facilityId: parseInt(value)
                        })}
                      >
                        <SelectTrigger id="appointment-facility">
                          <SelectValue placeholder="Select a facility" />
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
                    
                    <div className="space-y-2">
                      <Label htmlFor="appointment-duration">Duration (minutes)</Label>
                      <Input 
                        id="appointment-duration" 
                        type="number" 
                        min="15"
                        step="15"
                        value={appointmentTypeForm.duration} 
                        onChange={(e) => setAppointmentTypeForm({
                          ...appointmentTypeForm, 
                          duration: parseInt(e.target.value)
                        })}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="appointment-color">Color</Label>
                      <div className="flex items-center space-x-2">
                        <div 
                          className="w-6 h-6 rounded-full border" 
                          style={{ backgroundColor: appointmentTypeForm.color }}
                        />
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
                          <Label htmlFor="appointment-type-both">Both Inbound and Outbound</Label>
                        </div>
                      </RadioGroup>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Step 2: Scheduling Options */}
              {appointmentTypeFormStep === 2 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="appointment-slots">Maximum concurrent appointments</Label>
                      <Input 
                        id="appointment-slots" 
                        type="number" 
                        min="1"
                        value={appointmentTypeForm.maxSlots} 
                        onChange={(e) => setAppointmentTypeForm({
                          ...appointmentTypeForm, 
                          maxSlots: parseInt(e.target.value)
                        })}
                      />
                      <p className="text-sm text-muted-foreground">
                        Maximum number of appointments that can be scheduled at the same time
                      </p>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="appointment-grace">Grace period (minutes)</Label>
                      <Input 
                        id="appointment-grace" 
                        type="number" 
                        min="0"
                        step="5"
                        value={appointmentTypeForm.gracePeriod} 
                        onChange={(e) => setAppointmentTypeForm({
                          ...appointmentTypeForm, 
                          gracePeriod: parseInt(e.target.value)
                        })}
                      />
                      <p className="text-sm text-muted-foreground">
                        Buffer time between appointments
                      </p>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="appointment-reminder">Email reminder time (hours)</Label>
                      <Input 
                        id="appointment-reminder" 
                        type="number" 
                        min="1"
                        value={appointmentTypeForm.emailReminderTime} 
                        onChange={(e) => setAppointmentTypeForm({
                          ...appointmentTypeForm, 
                          emailReminderTime: parseInt(e.target.value)
                        })}
                      />
                      <p className="text-sm text-muted-foreground">
                        Hours before appointment to send email reminder
                      </p>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="appointment-tz">Timezone</Label>
                      <Select 
                        value={appointmentTypeForm.timezone} 
                        onValueChange={(value) => setAppointmentTypeForm({...appointmentTypeForm, timezone: value})}
                      >
                        <SelectTrigger id="appointment-tz">
                          <SelectValue placeholder="Select timezone" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="America/New_York">Eastern (ET)</SelectItem>
                          <SelectItem value="America/Chicago">Central (CT)</SelectItem>
                          <SelectItem value="America/Denver">Mountain (MT)</SelectItem>
                          <SelectItem value="America/Los_Angeles">Pacific (PT)</SelectItem>
                        </SelectContent>
                      </Select>
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
                    
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="appointment-days">Available Days</Label>
                      <div className="space-y-2 mt-1">
                        {weekDays.map((day, index) => (
                          <div key={index} className="flex items-center space-x-2">
                            <Checkbox 
                              id={`appointment-day-${index}`}
                              checked={schedulingSettings.availableDays.includes(index)}
                              onCheckedChange={(checked) => {
                                const updatedDays = checked 
                                  ? [...schedulingSettings.availableDays, index].sort((a, b) => a - b)
                                  : schedulingSettings.availableDays.filter(d => d !== index);
                                
                                setSchedulingSettings({
                                  ...schedulingSettings,
                                  availableDays: updatedDays
                                });
                              }}
                            />
                            <Label htmlFor={`appointment-day-${index}`}>{day}</Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Step 3: Required and Custom Questions */}
              {appointmentTypeFormStep === 3 && (
                <div className="space-y-6">
                  {/* Core Questions Section */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Core Questions</h3>
                    <p className="text-sm text-muted-foreground">These standard questions are required for all appointments.</p>
                    
                    <div className="space-y-3 bg-slate-50 p-4 rounded-md">
                      <div className="flex items-center justify-between py-2 border-b">
                        <div className="flex items-center space-x-3">
                          <Checkbox id="core-carrier-name" defaultChecked disabled />
                          <Label htmlFor="core-carrier-name" className="font-medium">Carrier Name</Label>
                        </div>
                        <Badge>Required</Badge>
                      </div>
                      
                      <div className="flex items-center justify-between py-2 border-b">
                        <div className="flex items-center space-x-3">
                          <Checkbox id="core-mc-number" defaultChecked />
                          <Label htmlFor="core-mc-number">MC Number</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Switch id="req-mc-number" defaultChecked />
                          <Label htmlFor="req-mc-number" className="text-sm">Required</Label>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between py-2 border-b">
                        <div className="flex items-center space-x-3">
                          <Checkbox id="core-driver-email" defaultChecked />
                          <Label htmlFor="core-driver-email">Driver/Dispatcher Email</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Switch id="req-driver-email" defaultChecked />
                          <Label htmlFor="req-driver-email" className="text-sm">Required</Label>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between py-2 border-b">
                        <div className="flex items-center space-x-3">
                          <Checkbox id="core-driver-phone" defaultChecked />
                          <Label htmlFor="core-driver-phone">Driver/Dispatcher Phone</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Switch id="req-driver-phone" defaultChecked />
                          <Label htmlFor="req-driver-phone" className="text-sm">Required</Label>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between py-2">
                        <div className="flex items-center space-x-3">
                          <Checkbox id="core-driver-license" defaultChecked />
                          <Label htmlFor="core-driver-license">Driver's License Number</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Switch id="req-driver-license" defaultChecked />
                          <Label htmlFor="req-driver-license" className="text-sm">Required</Label>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Custom Questions Section */}
                  <div className="space-y-4 pt-4 border-t">
                    <div className="flex justify-between items-center">
                      <h3 className="text-lg font-medium">Custom Questions</h3>
                      <Button variant="outline" size="sm" onClick={() => {
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
                      }}>
                        <PlusCircle className="h-4 w-4 mr-2" />
                        Add Question
                      </Button>
                    </div>
                    
                    {customFields.length === 0 ? (
                      <div className="text-center py-8 border rounded-md bg-slate-50 text-muted-foreground">
                        <p>No custom questions have been created yet.</p>
                        <p className="text-sm mt-2">Custom questions will be displayed on the appointment booking form.</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {customFields.map((field) => (
                          <Card key={field.id}>
                            <CardHeader className="py-3">
                              <div className="flex justify-between items-center">
                                <div className="flex items-center space-x-2">
                                  <Checkbox 
                                    id={`include-field-${field.id}`}
                                    defaultChecked={field.appointmentType === "both" || field.appointmentType === appointmentTypeForm.type}
                                  />
                                  <Label htmlFor={`include-field-${field.id}`} className="font-medium">
                                    {field.label}
                                  </Label>
                                </div>
                                <Badge variant="outline" className="capitalize">
                                  {field.type}
                                </Badge>
                              </div>
                            </CardHeader>
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            
            <DialogFooter>
              <div className="flex justify-between w-full">
                <div>
                  {appointmentTypeFormStep > 1 && (
                    <Button 
                      variant="outline" 
                      onClick={() => setAppointmentTypeFormStep(appointmentTypeFormStep - 1)}
                    >
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Back
                    </Button>
                  )}
                </div>
                <div className="flex space-x-2">
                  <Button variant="outline" onClick={() => setShowNewAppointmentTypeDialog(false)}>
                    Cancel
                  </Button>
                  
                  {appointmentTypeFormStep < 3 ? (
                    <Button onClick={() => setAppointmentTypeFormStep(appointmentTypeFormStep + 1)}>
                      Next
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  ) : (
                    <Button 
                      onClick={() => {
                        if (selectedAppointmentTypeId) {
                          // Update existing appointment type
                          updateAppointmentTypeMutation.mutate({
                            ...appointmentTypeForm,
                            id: selectedAppointmentTypeId
                          });
                        } else {
                          // Create new appointment type
                          createAppointmentTypeMutation.mutate(appointmentTypeForm);
                        }
                      }}
                      disabled={updateAppointmentTypeMutation.isPending || createAppointmentTypeMutation.isPending}
                    >
                      {(updateAppointmentTypeMutation.isPending || createAppointmentTypeMutation.isPending) ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4 mr-2" />
                      )}
                      {selectedAppointmentTypeId ? "Update Appointment Type" : "Create Appointment Type"}
                    </Button>
                  )}
                </div>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}