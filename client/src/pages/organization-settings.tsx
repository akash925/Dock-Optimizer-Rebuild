import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Clock, 
  Calendar, 
  Settings, 
  Plus, 
  Trash2, 
  Edit, 
  Save,
  Building2,
  Users,
  Shield,
  Bell,
  Database,
  Loader2
} from 'lucide-react';
import { OrganizationSettings } from "@shared/schema";

// Types for organization settings
interface OrganizationInfo {
  id: number;
  name: string;
  description?: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
  timezone: string;
  status: string;
  createdAt: string;
}

interface DefaultHours {
  id: number;
  dayOfWeek: number; // 0 = Sunday, 1 = Monday, etc.
  dayName: string;
  isOpen: boolean;
  openTime: string;
  closeTime: string;
  breakStart?: string;
  breakEnd?: string;
}

interface Holiday {
  id: number;
  name: string;
  date: string;
  isRecurring: boolean;
  description?: string;
  createdAt: string;
}

interface OrganizationModule {
  id: number;
  moduleName: string;
  enabled: boolean;
  description?: string;
}

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' }
];

const TIMEZONES = [
  'America/New_York',
  'America/Chicago', 
  'America/Denver',
  'America/Los_Angeles',
  'America/Phoenix',
  'Europe/London',
  'Europe/Paris',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Australia/Sydney'
];

export default function OrganizationSettingsPage() {
  const [activeTab, setActiveTab] = useState('general');
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [isHolidayDialogOpen, setIsHolidayDialogOpen] = useState(false);
  const [isFederalHolidayDialogOpen, setIsFederalHolidayDialogOpen] = useState(false);
  const [selectedFederalHolidays, setSelectedFederalHolidays] = useState<string[]>([]);
  const [editingHoliday, setEditingHoliday] = useState<Holiday | null>(null);
  const [newHoliday, setNewHoliday] = useState({
    name: '',
    date: '',
    isRecurring: false,
    description: ''
  });
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [settings, setSettings] = useState<Partial<OrganizationSettings>>({});
  const [isDirty, setIsDirty] = useState(false);

  // Fetch organization info
  const { data: orgInfo, isLoading: orgLoading } = useQuery<OrganizationInfo>({
    queryKey: ['/api/organizations/current'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/organizations/current');
      if (!response.ok) throw new Error('Failed to fetch organization info');
      return response.json();
    }
  });

  // Fetch default hours
  const { data: defaultHours, isLoading: hoursLoading } = useQuery<DefaultHours[]>({
    queryKey: ['/api/organizations/default-hours'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/organizations/default-hours');
      if (!response.ok) throw new Error('Failed to fetch default hours');
      return response.json();
    }
  });

  // Fetch holidays
  const { data: holidays, isLoading: holidaysLoading } = useQuery<Holiday[]>({
    queryKey: ['/api/organizations/holidays'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/organizations/holidays');
      if (!response.ok) throw new Error('Failed to fetch holidays');
      return response.json();
    }
  });

  // Fetch organization modules
  const { data: modules, isLoading: modulesLoading } = useQuery<OrganizationModule[]>({
    queryKey: ['/api/organizations/modules'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/organizations/modules');
      if (!response.ok) throw new Error('Failed to fetch organization modules');
      return response.json();
    }
  });

  // Fetch organization settings
  const { data: organizationSettings, isLoading: settingsLoading } = useQuery<OrganizationSettings>({
    queryKey: ['organizationSettings'],
    queryFn: async () => {
      const response = await fetch('/api/organizations/settings', {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error('Failed to fetch organization settings');
      }
      return response.json();
    }
  });

  // Update local state when data is loaded
  useEffect(() => {
    if (organizationSettings) {
      setSettings(organizationSettings);
    }
  }, [organizationSettings]);

  // Update organization info mutation
  const updateOrgMutation = useMutation({
    mutationFn: async (data: Partial<OrganizationInfo>) => {
      const response = await apiRequest('PATCH', '/api/organizations/current', data);
      if (!response.ok) throw new Error('Failed to update organization');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Organization information updated successfully"
      });
      queryClient.invalidateQueries({ queryKey: ['/api/organizations/current'] });
      setIsEditingInfo(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update organization",
        variant: "destructive"
      });
    }
  });

  // Update default hours mutation
  const updateHoursMutation = useMutation({
    mutationFn: async (data: { dayOfWeek: number; isOpen: boolean; openTime?: string; closeTime?: string; breakStart?: string; breakEnd?: string }) => {
      const response = await apiRequest('PATCH', '/api/organizations/default-hours', data);
      if (!response.ok) throw new Error('Failed to update default hours');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Default hours updated successfully"
      });
      queryClient.invalidateQueries({ queryKey: ['/api/organizations/default-hours'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update default hours",
        variant: "destructive"
      });
    }
  });

  // Create/update holiday mutation
  const saveHolidayMutation = useMutation({
    mutationFn: async (data: Partial<Holiday>) => {
      const url = editingHoliday ? `/api/organizations/holidays/${editingHoliday.id}` : '/api/organizations/holidays';
      const method = editingHoliday ? 'PATCH' : 'POST';
      const response = await apiRequest(method, url, data);
      if (!response.ok) throw new Error(`Failed to ${editingHoliday ? 'update' : 'create'} holiday`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: `Holiday ${editingHoliday ? 'updated' : 'created'} successfully`
      });
      queryClient.invalidateQueries({ queryKey: ['/api/organizations/holidays'] });
      setIsHolidayDialogOpen(false);
      setEditingHoliday(null);
      setNewHoliday({ name: '', date: '', isRecurring: false, description: '' });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || `Failed to ${editingHoliday ? 'update' : 'create'} holiday`,
        variant: "destructive"
      });
    }
  });

  // Delete holiday mutation
  const deleteHolidayMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest('DELETE', `/api/organizations/holidays/${id}`);
      if (!response.ok) throw new Error('Failed to delete holiday');
      return id;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Holiday deleted successfully"
      });
      queryClient.invalidateQueries({ queryKey: ['/api/organizations/holidays'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete holiday",
        variant: "destructive"
      });
    }
  });

  // Toggle module mutation
  const toggleModuleMutation = useMutation({
    mutationFn: async ({ moduleName, enabled }: { moduleName: string; enabled: boolean }) => {
      const response = await apiRequest('PATCH', '/api/organizations/modules', { moduleName, enabled });
      if (!response.ok) throw new Error('Failed to update module');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Module settings updated successfully"
      });
      queryClient.invalidateQueries({ queryKey: ['/api/organizations/modules'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update module",
        variant: "destructive"
      });
    }
  });

  // Update settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async (newSettings: Partial<OrganizationSettings>) => {
      const response = await fetch('/api/organizations/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(newSettings)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update settings');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizationSettings'] });
      setIsDirty(false);
      toast({
        title: "Settings Updated",
        description: "Organization settings have been saved successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Federal holidays data
  const getFederalHolidays = (year: number) => [
    { name: "New Year's Day", date: `${year}-01-01`, key: 'new-years' },
    { name: "Martin Luther King Jr. Day", date: calculateMLKDay(year), key: 'mlk-day' },
    { name: "Presidents' Day", date: calculatePresidentsDay(year), key: 'presidents-day' },
    { name: "Memorial Day", date: calculateMemorialDay(year), key: 'memorial-day' },
    { name: "Juneteenth", date: `${year}-06-19`, key: 'juneteenth' },
    { name: "Independence Day", date: `${year}-07-04`, key: 'independence-day' },
    { name: "Labor Day", date: calculateLaborDay(year), key: 'labor-day' },
    { name: "Columbus Day", date: calculateColumbusDay(year), key: 'columbus-day' },
    { name: "Veterans Day", date: `${year}-11-11`, key: 'veterans-day' },
    { name: "Thanksgiving Day", date: calculateThanksgiving(year), key: 'thanksgiving' },
    { name: "Christmas Day", date: `${year}-12-25`, key: 'christmas' },
  ];

  // Helper functions for calculating floating holidays
  const calculateNthDayOfMonth = (year: number, month: number, dayOfWeek: number, n: number) => {
    const date = new Date(year, month, 1);
    while (date.getDay() !== dayOfWeek) {
      date.setDate(date.getDate() + 1);
    }
    date.setDate(date.getDate() + (n - 1) * 7);
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };

  const calculateLastDayOfMonth = (year: number, month: number, dayOfWeek: number) => {
    const date = new Date(year, month + 1, 0);
    while (date.getDay() !== dayOfWeek) {
      date.setDate(date.getDate() - 1);
    }
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };

  const calculateMLKDay = (year: number) => calculateNthDayOfMonth(year, 0, 1, 3); // 3rd Monday in January
  const calculatePresidentsDay = (year: number) => calculateNthDayOfMonth(year, 1, 1, 3); // 3rd Monday in February
  const calculateMemorialDay = (year: number) => calculateLastDayOfMonth(year, 4, 1); // Last Monday in May
  const calculateLaborDay = (year: number) => calculateNthDayOfMonth(year, 8, 1, 1); // 1st Monday in September
  const calculateColumbusDay = (year: number) => calculateNthDayOfMonth(year, 9, 1, 2); // 2nd Monday in October
  const calculateThanksgiving = (year: number) => calculateNthDayOfMonth(year, 10, 4, 4); // 4th Thursday in November

  const currentYear = new Date().getFullYear();
  const nextYear = currentYear + 1;
  const federalHolidays = [...getFederalHolidays(currentYear), ...getFederalHolidays(nextYear)];

  // Sync federal holidays mutation
  const syncFederalHolidaysMutation = useMutation({
    mutationFn: async (selectedHolidays: string[]) => {
      const holidaysToAdd = federalHolidays.filter(holiday => 
        selectedHolidays.includes(holiday.key)
      );

      // Check for existing holidays to avoid duplicates
      const existingDates = holidays?.map(h => h.date) || [];
      const newHolidays = holidaysToAdd.filter(h => !existingDates.includes(h.date));

      // Add each new holiday
      for (const holiday of newHolidays) {
        const response = await apiRequest('POST', '/api/organizations/holidays', {
          name: holiday.name,
          date: holiday.date,
          isRecurring: true,
          description: `Federal Holiday - ${holiday.name}`
        });
        if (!response.ok) throw new Error(`Failed to add ${holiday.name}`);
      }

      return { added: newHolidays.length, skipped: holidaysToAdd.length - newHolidays.length };
    },
    onSuccess: (result) => {
      toast({
        title: "Federal Holidays Synced",
        description: `Added ${result.added} new holidays. ${result.skipped} holidays were already configured.`
      });
      queryClient.invalidateQueries({ queryKey: ['/api/organizations/holidays'] });
      setIsFederalHolidayDialogOpen(false);
      setSelectedFederalHolidays([]);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to sync federal holidays",
        variant: "destructive"
      });
    }
  });

  const handleSaveOrgInfo = (formData: FormData) => {
    const data = {
      name: formData.get('name') as string,
      description: formData.get('description') as string,
      contactEmail: formData.get('contactEmail') as string,
      contactPhone: formData.get('contactPhone') as string,
      address: formData.get('address') as string,
      timezone: formData.get('timezone') as string,
    };
    updateOrgMutation.mutate(data);
  };

  const handleUpdateHours = (dayOfWeek: number, field: string, value: any) => {
    const currentHour = defaultHours?.find(h => h.dayOfWeek === dayOfWeek);
    if (!currentHour) return;

    const updateData: any = { dayOfWeek };
    
    if (field === 'isOpen') {
      updateData.isOpen = value;
      if (!value) {
        updateData.openTime = '';
        updateData.closeTime = '';
        updateData.breakStart = '';
        updateData.breakEnd = '';
      }
    } else {
      updateData.isOpen = currentHour.isOpen;
      updateData[field] = value;
    }

    updateHoursMutation.mutate(updateData);
  };

  const handleSaveHoliday = () => {
    if (!newHoliday.name || !newHoliday.date) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    saveHolidayMutation.mutate(newHoliday);
  };

  const handleEditHoliday = (holiday: Holiday) => {
    setEditingHoliday(holiday);
    setNewHoliday({
      name: holiday.name,
      date: holiday.date,
      isRecurring: holiday.isRecurring,
      description: holiday.description || ''
    });
    setIsHolidayDialogOpen(true);
  };

  const handleInputChange = (key: keyof OrganizationSettings, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setIsDirty(true);
  };

  const handleSave = () => {
    updateSettingsMutation.mutate(settings);
  };

  if (orgLoading || hoursLoading || holidaysLoading || modulesLoading || settingsLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">Loading organization settings...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Settings className="h-6 w-6" />
            Organization Settings
          </h1>
          <p className="text-muted-foreground">
            Configure your organization's preferences and branding
          </p>
        </div>
        
        {isDirty && (
          <Button 
            onClick={handleSave} 
            disabled={updateSettingsMutation.isPending}
            className="flex items-center gap-2"
          >
            {updateSettingsMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save Changes
          </Button>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="flex space-x-1 bg-muted p-1 rounded-lg mb-6">
        {[
          { id: 'general', label: 'General', icon: Building2 },
          { id: 'hours', label: 'Default Hours', icon: Clock },
          { id: 'holidays', label: 'Holidays', icon: Calendar },
          { id: 'modules', label: 'Modules', icon: Database }
        ].map((tab) => (
          <Button
            key={tab.id}
            variant={activeTab === tab.id ? 'default' : 'ghost'}
            onClick={() => setActiveTab(tab.id)}
            className="flex items-center gap-2"
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </Button>
        ))}
      </div>

      {/* General Tab */}
      {activeTab === 'general' && (
        <div className="space-y-6">
        {/* Organization Information Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Organization Information</span>
              {!isEditingInfo && (
                <Button variant="outline" onClick={() => setIsEditingInfo(true)}>
                  <Edit className="h-4 w-4 mr-1" />
                  Edit
                </Button>
              )}
            </CardTitle>
            <CardDescription>
              Basic information about your organization
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isEditingInfo ? (
              <form onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                handleSaveOrgInfo(formData);
              }} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">Organization Name *</Label>
                    <Input
                      id="name"
                      name="name"
                      defaultValue={orgInfo?.name}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="timezone">Timezone</Label>
                    <Select name="timezone" defaultValue={orgInfo?.timezone}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select timezone" />
                      </SelectTrigger>
                      <SelectContent>
                        {TIMEZONES.map((tz) => (
                          <SelectItem key={tz} value={tz}>
                            {tz}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="contactEmail">Contact Email</Label>
                    <Input
                      id="contactEmail"
                      name="contactEmail"
                      type="email"
                      defaultValue={orgInfo?.contactEmail}
                    />
                  </div>
                  <div>
                    <Label htmlFor="contactPhone">Contact Phone</Label>
                    <Input
                      id="contactPhone"
                      name="contactPhone"
                      defaultValue={orgInfo?.contactPhone}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    name="description"
                    defaultValue={orgInfo?.description}
                  />
                </div>
                <div>
                  <Label htmlFor="address">Address</Label>
                  <Input
                    id="address"
                    name="address"
                    defaultValue={orgInfo?.address}
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" disabled={updateOrgMutation.isPending}>
                    {updateOrgMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    ) : (
                      <Save className="h-4 w-4 mr-1" />
                    )}
                    Save Changes
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setIsEditingInfo(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium">Organization Name</Label>
                    <p className="mt-1">{orgInfo?.name || 'Not set'}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Status</Label>
                    <p className="mt-1">
                      <Badge variant={orgInfo?.status === 'ACTIVE' ? 'default' : 'secondary'}>
                        {orgInfo?.status || 'Unknown'}
                      </Badge>
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Contact Email</Label>
                    <p className="mt-1">{orgInfo?.contactEmail || 'Not set'}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Contact Phone</Label>
                    <p className="mt-1">{orgInfo?.contactPhone || 'Not set'}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Timezone</Label>
                    <p className="mt-1">{orgInfo?.timezone || 'Not set'}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Created</Label>
                    <p className="mt-1">
                      {orgInfo?.createdAt ? new Date(orgInfo.createdAt).toLocaleDateString() : 'Unknown'}
                    </p>
                  </div>
                </div>
                {orgInfo?.description && (
                  <div>
                    <Label className="text-sm font-medium">Description</Label>
                    <p className="mt-1">{orgInfo.description}</p>
                  </div>
                )}
                {orgInfo?.address && (
                  <div>
                    <Label className="text-sm font-medium">Address</Label>
                    <p className="mt-1">{orgInfo.address}</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Confirmation Code Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Confirmation Codes</CardTitle>
            <CardDescription>
              Customize how appointment confirmation codes are generated for your organization
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="confirmationCodePrefix">Confirmation Code Prefix</Label>
              <Input
                id="confirmationCodePrefix"
                value={settings.confirmationCodePrefix || ''}
                onChange={(e) => handleInputChange('confirmationCodePrefix', e.target.value.toUpperCase().slice(0, 5))}
                placeholder="APP"
                maxLength={5}
                className="max-w-xs"
              />
              <p className="text-sm text-muted-foreground">
                2-5 characters, letters and numbers only. Example: "FRE" → "FRE-123456"
              </p>
              {settings.confirmationCodePrefix && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Preview: </span>
                  <code className="bg-muted px-2 py-1 rounded">
                    {settings.confirmationCodePrefix}-123456
                  </code>
                </div>
              )}
            </div>
            
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Send confirmation emails</Label>
                <p className="text-sm text-muted-foreground">
                  Automatically send confirmation emails for new appointments
                </p>
              </div>
              <Switch
                checked={settings.emailNotifications !== false}
                onCheckedChange={(checked) => handleInputChange('emailNotifications', checked)}
              />
            </div>
          </CardContent>
        </Card>
        </div>
      )}

      {/* Default Hours Tab */}
      {activeTab === 'hours' && (
        <Card>
          <CardHeader>
            <CardTitle>Default Operating Hours</CardTitle>
            <CardDescription>
              Set your organization's default operating hours. These will be used as the default for new facilities and appointment availability.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {DAYS_OF_WEEK.map((day) => {
                const dayHours = defaultHours?.find(h => h.dayOfWeek === day.value);
                const isOpen = dayHours?.isOpen || false;
                
                return (
                  <div key={day.value} className="flex items-center space-x-4 p-4 border rounded-lg">
                    <div className="w-24">
                      <Label className="font-medium">{day.label}</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={isOpen}
                        onCheckedChange={(checked) => handleUpdateHours(day.value, 'isOpen', checked)}
                        disabled={updateHoursMutation.isPending}
                      />
                      <Label className="text-sm">Open</Label>
                    </div>
                    {isOpen && (
                      <>
                        <div className="flex items-center space-x-2">
                          <Label className="text-sm">From:</Label>
                          <Input
                            type="time"
                            value={dayHours?.openTime || '09:00'}
                            onChange={(e) => handleUpdateHours(day.value, 'openTime', e.target.value)}
                            className="w-24"
                            disabled={updateHoursMutation.isPending}
                          />
                        </div>
                        <div className="flex items-center space-x-2">
                          <Label className="text-sm">To:</Label>
                          <Input
                            type="time"
                            value={dayHours?.closeTime || '17:00'}
                            onChange={(e) => handleUpdateHours(day.value, 'closeTime', e.target.value)}
                            className="w-24"
                            disabled={updateHoursMutation.isPending}
                          />
                        </div>
                        <div className="flex items-center space-x-2">
                          <Label className="text-sm">Break:</Label>
                          <Input
                            type="time"
                            placeholder="Start"
                            value={dayHours?.breakStart || ''}
                            onChange={(e) => handleUpdateHours(day.value, 'breakStart', e.target.value)}
                            className="w-24"
                            disabled={updateHoursMutation.isPending}
                          />
                          <span className="text-sm">-</span>
                          <Input
                            type="time"
                            placeholder="End"
                            value={dayHours?.breakEnd || ''}
                            onChange={(e) => handleUpdateHours(day.value, 'breakEnd', e.target.value)}
                            className="w-24"
                            disabled={updateHoursMutation.isPending}
                          />
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Holidays Tab */}
      {activeTab === 'holidays' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Organization Holidays</span>
              <div className="flex gap-2">
                <Dialog open={isFederalHolidayDialogOpen} onOpenChange={setIsFederalHolidayDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline">
                      <Calendar className="h-4 w-4 mr-1" />
                      Add Federal Holidays
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Add Federal Holidays</DialogTitle>
                      <DialogDescription>
                        Select which federal holidays you'd like to add to your organization calendar.
                        These will be added as recurring holidays for {currentYear} and {nextYear}.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="max-h-96 overflow-y-auto">
                      <div className="space-y-3">
                        {federalHolidays.map((holiday) => {
                          const isAlreadyAdded = holidays?.some(h => h.date === holiday.date);
                          return (
                            <div key={`${holiday.key}-${holiday.date}`} className="flex items-center space-x-3 p-2 rounded-md hover:bg-gray-50">
                              <Checkbox
                                id={`${holiday.key}-${holiday.date}`}
                                checked={selectedFederalHolidays.includes(holiday.key) || isAlreadyAdded}
                                disabled={isAlreadyAdded}
                                onCheckedChange={(checked: boolean) => {
                                  if (checked) {
                                    setSelectedFederalHolidays(prev => [...prev, holiday.key]);
                                  } else {
                                    setSelectedFederalHolidays(prev => prev.filter(k => k !== holiday.key));
                                  }
                                }}
                              />
                              <div className="flex-1">
                                <Label htmlFor={`${holiday.key}-${holiday.date}`} className="flex items-center justify-between cursor-pointer">
                                  <div>
                                    <span className={`font-medium ${isAlreadyAdded ? 'text-gray-500' : ''}`}>
                                      {holiday.name}
                                    </span>
                                    {isAlreadyAdded && (
                                      <Badge variant="secondary" className="ml-2">Already Added</Badge>
                                    )}
                                  </div>
                                  <span className="text-sm text-gray-500">
                                    {new Date(holiday.date).toLocaleDateString()}
                                  </span>
                                </Label>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => {
                        setIsFederalHolidayDialogOpen(false);
                        setSelectedFederalHolidays([]);
                      }}>
                        Cancel
                      </Button>
                      <Button 
                        onClick={() => syncFederalHolidaysMutation.mutate(selectedFederalHolidays)}
                        disabled={selectedFederalHolidays.length === 0 || syncFederalHolidaysMutation.isPending}
                      >
                        {syncFederalHolidaysMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-1" />
                        ) : null}
                        Add Selected Holidays ({selectedFederalHolidays.length})
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
                <Dialog open={isHolidayDialogOpen} onOpenChange={setIsHolidayDialogOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="h-4 w-4 mr-1" />
                      Add Custom Holiday
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>
                        {editingHoliday ? 'Edit Holiday' : 'Add New Holiday'}
                      </DialogTitle>
                      <DialogDescription>
                        Add or edit organization holidays that will affect appointment availability.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="holidayName">Holiday Name *</Label>
                        <Input
                          id="holidayName"
                          value={newHoliday.name}
                          onChange={(e) => setNewHoliday(prev => ({ ...prev, name: e.target.value }))}
                          placeholder="e.g., Christmas Day"
                        />
                      </div>
                      <div>
                        <Label htmlFor="holidayDate">Date *</Label>
                        <Input
                          id="holidayDate"
                          type="date"
                          value={newHoliday.date}
                          onChange={(e) => setNewHoliday(prev => ({ ...prev, date: e.target.value }))}
                        />
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch
                          checked={newHoliday.isRecurring}
                          onCheckedChange={(checked) => setNewHoliday(prev => ({ ...prev, isRecurring: checked }))}
                        />
                        <Label>Recurring yearly</Label>
                      </div>
                      <div>
                        <Label htmlFor="holidayDescription">Description</Label>
                        <Input
                          id="holidayDescription"
                          value={newHoliday.description}
                          onChange={(e) => setNewHoliday(prev => ({ ...prev, description: e.target.value }))}
                          placeholder="Optional description"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => {
                        setIsHolidayDialogOpen(false);
                        setEditingHoliday(null);
                        setNewHoliday({ name: '', date: '', isRecurring: false, description: '' });
                      }}>
                        Cancel
                      </Button>
                      <Button onClick={handleSaveHoliday} disabled={saveHolidayMutation.isPending}>
                        {saveHolidayMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-1" />
                        ) : null}
                        {editingHoliday ? 'Update' : 'Add'} Holiday
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardTitle>
            <CardDescription>
              Manage organization-wide holidays that will affect appointment availability across all facilities.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {holidays && holidays.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Holiday Name</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {holidays.map((holiday) => (
                    <TableRow key={holiday.id}>
                      <TableCell className="font-medium">{holiday.name}</TableCell>
                      <TableCell>{new Date(holiday.date).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Badge variant={holiday.isRecurring ? 'default' : 'secondary'}>
                          {holiday.isRecurring ? 'Recurring' : 'One-time'}
                        </Badge>
                      </TableCell>
                      <TableCell>{holiday.description || '-'}</TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditHoliday(holiday)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteHolidayMutation.mutate(holiday.id)}
                            disabled={deleteHolidayMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8">
                <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No holidays configured yet.</p>
                <p className="text-sm text-muted-foreground">Add holidays to manage appointment availability.</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Modules Tab */}
      {activeTab === 'modules' && (
        <Card>
          <CardHeader>
            <CardTitle>Organization Modules</CardTitle>
            <CardDescription>
              Enable or disable specific modules for your organization. Changes will affect all users in your organization.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {modules && modules.length > 0 ? (
              <div className="space-y-4">
                {modules.map((module) => (
                  <div key={module.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <h4 className="font-medium">{module.moduleName}</h4>
                      {module.description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {module.description}
                        </p>
                      )}
                    </div>
                    <Switch
                      checked={module.enabled}
                      onCheckedChange={(checked) => 
                        toggleModuleMutation.mutate({ 
                          moduleName: module.moduleName, 
                          enabled: checked 
                        })
                      }
                      disabled={toggleModuleMutation.isPending}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Database className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No modules available.</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}