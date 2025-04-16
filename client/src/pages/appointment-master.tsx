import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import Layout from "@/components/layout";
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
import { CalendarDays, Clock, FilePlus, PlusCircle, Save, Settings, Shield, Trash2, AlertTriangle, HelpCircle, Loader2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { weekDays } from "@/lib/utils";

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
  const [activeTab, setActiveTab] = useState("questions");
  const [selectedQuestionId, setSelectedQuestionId] = useState<number | null>(null);
  const [showQuestionDialog, setShowQuestionDialog] = useState(false);
  const [showAvailabilityDialog, setShowAvailabilityDialog] = useState(false);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  
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
  
  // Mock data for question form fields
  const [customFields, setCustomFields] = useState<QuestionFormField[]>([
    { 
      id: 1, 
      label: "Special Handling Instructions", 
      type: "textarea", 
      required: false, 
      placeholder: "Enter any special handling instructions", 
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
  
  // Mock save custom field mutation
  const saveCustomFieldMutation = useMutation({
    mutationFn: async (field: Partial<QuestionFormField>) => {
      // This would be replaced with an actual API call
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
  
  // Mock save availability rule mutation
  const saveAvailabilityRuleMutation = useMutation({
    mutationFn: async (rule: Partial<AvailabilityRule>) => {
      // This would be replaced with an actual API call
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
      case "inbound": return <Badge variant="outline" className="bg-blue-50">Inbound</Badge>;
      case "outbound": return <Badge variant="outline" className="bg-green-50">Outbound</Badge>;
      case "both": return <Badge variant="outline" className="bg-purple-50">Both</Badge>;
      default: return null;
    }
  };
  
  return (
    <Layout>
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold">Appointment Master</h1>
            <p className="text-muted-foreground">
              Configure appointment forms and availability
            </p>
          </div>
        </div>
        
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
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
                            {isClosed && <Badge variant="outline" className="bg-red-50">Closed</Badge>}
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
                    <p className="text-sm text-muted-foreground">
                      When disabled, appointments require manual approval by staff
                    </p>
                  </div>
                </div>
                
                <div className="flex justify-end pt-4">
                  <Button>
                    <Save className="h-4 w-4 mr-2" />
                    Save Settings
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
      
      {/* Question Form Dialog */}
      <Dialog open={showQuestionDialog} onOpenChange={setShowQuestionDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedQuestionId ? "Edit" : "Add"} Custom Question</DialogTitle>
            <DialogDescription>
              Create a custom question for the appointment booking form.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="field-label">Field Label*</Label>
              <Input 
                id="field-label" 
                placeholder="Enter field label" 
                value={questionForm.label} 
                onChange={(e) => handleQuestionFormChange("label", e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="field-type">Field Type*</Label>
              <Select 
                value={questionForm.type} 
                onValueChange={(value) => handleQuestionFormChange("type", value)}
              >
                <SelectTrigger id="field-type">
                  <SelectValue placeholder="Select field type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Text Input</SelectItem>
                  <SelectItem value="textarea">Text Area</SelectItem>
                  <SelectItem value="select">Dropdown</SelectItem>
                  <SelectItem value="radio">Radio Buttons</SelectItem>
                  <SelectItem value="checkbox">Checkboxes</SelectItem>
                  <SelectItem value="file">File Upload</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="field-type">Appointment Type*</Label>
              <Select 
                value={questionForm.appointmentType} 
                onValueChange={(value) => handleQuestionFormChange("appointmentType", value)}
              >
                <SelectTrigger id="appointment-type">
                  <SelectValue placeholder="Select appointment type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="both">Both Inbound & Outbound</SelectItem>
                  <SelectItem value="inbound">Inbound Only</SelectItem>
                  <SelectItem value="outbound">Outbound Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {(questionForm.type === "text" || questionForm.type === "textarea") && (
              <div className="space-y-2">
                <Label htmlFor="field-placeholder">Placeholder</Label>
                <Input 
                  id="field-placeholder" 
                  placeholder="Enter placeholder text" 
                  value={questionForm.placeholder} 
                  onChange={(e) => handleQuestionFormChange("placeholder", e.target.value)}
                />
              </div>
            )}
            
            {(questionForm.type === "select" || questionForm.type === "radio" || questionForm.type === "checkbox") && (
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label>Options*</Label>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm" 
                    onClick={addOption}
                  >
                    Add Option
                  </Button>
                </div>
                
                {(questionForm.options || []).length === 0 ? (
                  <div className="p-4 border rounded border-dashed text-center text-muted-foreground">
                    <p>No options added yet</p>
                    <p className="text-xs mt-1">Click "Add Option" to add your first option</p>
                  </div>
                ) : (
                  <div className="space-y-2">
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
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            
            <div className="flex items-center space-x-2">
              <Switch 
                id="required-field" 
                checked={questionForm.required}
                onCheckedChange={(checked) => handleQuestionFormChange("required", checked)}
              />
              <Label htmlFor="required-field">This field is required</Label>
            </div>
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowQuestionDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => saveCustomFieldMutation.mutate(questionForm)}
              disabled={saveCustomFieldMutation.isPending || !questionForm.label}
            >
              {saveCustomFieldMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>Save Question</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Availability Rule Dialog */}
      <Dialog open={showAvailabilityDialog} onOpenChange={setShowAvailabilityDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit {weekDays[availabilityForm.dayOfWeek || 0]} Availability</DialogTitle>
            <DialogDescription>
              Set the availability rules for this day of the week.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-2">
            <div className="flex items-center space-x-2">
              <Switch 
                id="day-enabled" 
                checked={availabilityForm.maxAppointments !== 0}
                onCheckedChange={(checked) => {
                  handleAvailabilityFormChange("maxAppointments", checked ? 10 : 0);
                }}
              />
              <Label htmlFor="day-enabled">Allow appointments on this day</Label>
            </div>
            
            {availabilityForm.maxAppointments !== 0 && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="start-time">Start Time</Label>
                    <Input 
                      id="start-time" 
                      type="time" 
                      value={availabilityForm.startTime}
                      onChange={(e) => handleAvailabilityFormChange("startTime", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="end-time">End Time</Label>
                    <Input 
                      id="end-time" 
                      type="time" 
                      value={availabilityForm.endTime}
                      onChange={(e) => handleAvailabilityFormChange("endTime", e.target.value)}
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="max-appointments">Maximum Appointments</Label>
                  <Input 
                    id="max-appointments" 
                    type="number" 
                    min="1" 
                    value={availabilityForm.maxAppointments} 
                    onChange={(e) => handleAvailabilityFormChange("maxAppointments", parseInt(e.target.value) || 0)}
                  />
                  <p className="text-sm text-muted-foreground">
                    The maximum number of appointments that can be scheduled for this day
                  </p>
                </div>
                
                <div className="space-y-2">
                  <Label>Appointment Types Allowed</Label>
                  <RadioGroup 
                    value={availabilityForm.appointmentType} 
                    onValueChange={(value) => handleAvailabilityFormChange("appointmentType", value)}
                    className="flex flex-col space-y-1"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="both" id="both" />
                      <Label htmlFor="both">Both inbound and outbound</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="inbound" id="inbound" />
                      <Label htmlFor="inbound">Inbound only</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="outbound" id="outbound" />
                      <Label htmlFor="outbound">Outbound only</Label>
                    </div>
                  </RadioGroup>
                </div>
              </>
            )}
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowAvailabilityDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => saveAvailabilityRuleMutation.mutate(availabilityForm)}
              disabled={saveAvailabilityRuleMutation.isPending}
            >
              {saveAvailabilityRuleMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>Save Availability</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}