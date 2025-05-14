import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Save, Clock, Mail, Bell, LogOut, Building, CalendarDays, Globe, Loader2, Upload, Calendar, Download } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { TimeInterval } from "@shared/schema";
import organizationLogo from "@/assets/organization_logo.jpeg";

// Helper function to correctly format holiday dates for display
// This ensures that dates are displayed correctly regardless of timezone
const formatDisplayDate = (dateStr: string): string => {
  // Split the date string (YYYY-MM-DD) and create a new UTC date
  // This prevents browsers from applying timezone offsets that shift the day
  if (!dateStr) return '';
  
  const [year, month, day] = dateStr.split('-').map(num => parseInt(num, 10));
  
  // Create a date object and format it with localization
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC' // Critical: ensures no timezone shift
  });
};

export default function Settings() {
  const { toast } = useToast();
  const { user, logoutMutation } = useAuth();
  const [activeTab, setActiveTab] = useState("account");
  
  // User notification preference states
  const [emailNotificationsEnabled, setEmailNotificationsEnabled] = useState(true);
  const [emailScheduleChanges, setEmailScheduleChanges] = useState(true);
  const [emailTruckArrivals, setEmailTruckArrivals] = useState(true);
  const [emailDockAssignments, setEmailDockAssignments] = useState(true);
  const [emailWeeklyReports, setEmailWeeklyReports] = useState(false);
  const [pushNotificationsEnabled, setPushNotificationsEnabled] = useState(true);
  const [pushUrgentAlertsOnly, setPushUrgentAlertsOnly] = useState(true);
  const [pushAllUpdates, setPushAllUpdates] = useState(false);
  
  // Other states
  const [darkMode, setDarkMode] = useState(false);
  
  // Scheduling states
  const [selectedFacility, setSelectedFacility] = useState<number | null>(null);
  const [timeInterval, setTimeInterval] = useState<string>("30");
  const [maxInbound, setMaxInbound] = useState<number>(3);
  const [maxOutbound, setMaxOutbound] = useState<number>(2);
  const [shareAvailability, setShareAvailability] = useState<boolean>(true);
  
  // Organization states
  const [orgTimeZone, setOrgTimeZone] = useState("America/New_York");
  const [selectedHoliday, setSelectedHoliday] = useState<string | null>(null);
  const [customHolidayName, setCustomHolidayName] = useState("");
  const [customHolidayDate, setCustomHolidayDate] = useState("");
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [defaultBarcodeFormat, setDefaultBarcodeFormat] = useState<string>("CODE128");
  const [barcodePrefix, setBarcodePrefix] = useState<string>("H");
  
  // Fetch user notification preferences
  const { data: userPreferencesData, isLoading: isLoadingPreferences } = useQuery({
    queryKey: ['/api/user-preferences'],
    queryFn: async () => {
      const response = await fetch(`/api/user-preferences?organizationId=${user?.tenantId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch user preferences');
      }
      return response.json();
    },
    enabled: !!user?.tenantId
  });
  
  // Update preference states from fetched data
  useEffect(() => {
    if (userPreferencesData) {
      // Email notification settings
      setEmailNotificationsEnabled(userPreferencesData.emailNotificationsEnabled);
      setEmailScheduleChanges(userPreferencesData.emailScheduleChanges);
      setEmailTruckArrivals(userPreferencesData.emailTruckArrivals);
      setEmailDockAssignments(userPreferencesData.emailDockAssignments);
      setEmailWeeklyReports(userPreferencesData.emailWeeklyReports);
      
      // Push notification settings
      setPushNotificationsEnabled(userPreferencesData.pushNotificationsEnabled);
      setPushUrgentAlertsOnly(userPreferencesData.pushUrgentAlertsOnly);
      setPushAllUpdates(userPreferencesData.pushAllUpdates);
    }
  }, [userPreferencesData]);
  
  // Save notification preferences mutation
  const saveNotificationPreferencesMutation = useMutation({
    mutationFn: async (data: any) => {
      if (!user?.tenantId) throw new Error('User tenant ID is required');
      
      // Build the payload with proper boolean values
      const payload = {
        organizationId: user.tenantId,
        emailNotificationsEnabled: emailNotificationsEnabled === true,
        emailScheduleChanges: emailScheduleChanges === true,
        emailTruckArrivals: emailTruckArrivals === true,
        emailDockAssignments: emailDockAssignments === true,
        emailWeeklyReports: emailWeeklyReports === true,
        pushNotificationsEnabled: pushNotificationsEnabled === true,
        pushUrgentAlertsOnly: pushUrgentAlertsOnly === true,
        pushAllUpdates: pushAllUpdates === true
      };
      
      console.log('Saving notification preferences:', payload);
      
      // For PUT requests, use a simpler endpoint with the payload containing organizationId
      const response = await apiRequest(
        userPreferencesData ? "PUT" : "POST", 
        "/api/user-preferences", 
        payload
      );
      
      if (!response.ok) {
        throw new Error('Failed to save notification preferences');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Notification Settings Saved",
        description: "Your notification preferences have been updated."
      });
      
      // Invalidate preferences query to refetch with updated data
      queryClient.invalidateQueries({ queryKey: ['/api/user-preferences'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error Saving Preferences",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  
  // Load organization logo from API and barcode settings from localStorage
  const { data: orgData, isLoading: isLoadingOrg } = useQuery({
    queryKey: ['/api/admin/organizations', user?.tenantId, 'logo'],
    queryFn: async () => {
      if (!user?.tenantId) return null;
      const res = await fetch(`/api/admin/organizations/${user.tenantId}/logo`);
      if (!res.ok) throw new Error('Failed to fetch organization logo');
      return res.json();
    },
    enabled: !!user?.tenantId
  });
  
  // Set logo preview when data is loaded
  useEffect(() => {
    if (orgData?.logo) {
      setLogoPreview(orgData.logo);
    }
  }, [orgData]);
  
  // Load barcode settings from localStorage
  useEffect(() => {
    const savedFormat = localStorage.getItem('defaultBarcodeFormat');
    if (savedFormat) {
      setDefaultBarcodeFormat(savedFormat);
    }
    
    const savedPrefix = localStorage.getItem('barcodePrefix');
    if (savedPrefix) {
      setBarcodePrefix(savedPrefix);
    }
  }, []);
  
  // Default holidays used when no holidays are set yet
  const defaultHolidays = [
    { name: "New Year's Day", date: "2025-01-01", enabled: true },
    { name: "Memorial Day", date: "2025-05-26", enabled: true },
    { name: "Independence Day", date: "2025-07-04", enabled: true },
    { name: "Labor Day", date: "2025-09-01", enabled: true },
    { name: "Thanksgiving Day", date: "2025-11-27", enabled: true },
    { name: "Christmas Day", date: "2025-12-25", enabled: true },
  ];
  
  const [organizationHolidays, setOrganizationHolidays] = useState(defaultHolidays);
  
  // Fetch organization holidays
  const { data: holidaysData, isLoading: isLoadingHolidays } = useQuery({
    queryKey: ['/api/organizations', user?.tenantId, 'holidays'],
    queryFn: async () => {
      if (!user?.tenantId) return defaultHolidays;
      const res = await fetch(`/api/organizations/${user.tenantId}/holidays`);
      if (!res.ok) {
        console.error('Failed to fetch holidays, using defaults');
        return defaultHolidays;
      }
      return await res.json();
    },
    enabled: !!user?.tenantId
  });
  
  // Update local state when holidays are fetched
  useEffect(() => {
    if (holidaysData && Array.isArray(holidaysData) && holidaysData.length > 0) {
      setOrganizationHolidays(holidaysData);
    }
  }, [holidaysData]);
  
  // Mutation to save holidays
  const saveHolidaysMutation = useMutation({
    mutationFn: async (holidays: any) => {
      if (!user?.tenantId) throw new Error('User tenant ID is required');
      const response = await fetch(`/api/organizations/${user.tenantId}/holidays`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ holidays }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to save holidays');
      }
      
      return response.json();
    },
    onSuccess: () => {
      // Invalidate the holidays query to refetch with new data
      queryClient.invalidateQueries({ 
        queryKey: ['/api/organizations', user?.tenantId, 'holidays'] 
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to save holidays",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  // Fetch facilities
  const { data: facilities } = useQuery({
    queryKey: ["/api/facilities"],
    queryFn: async () => {
      const response = await fetch("/api/facilities");
      if (!response.ok) throw new Error("Failed to fetch facilities");
      return response.json();
    }
  });
  
  // Set default facility when facilities are loaded
  useEffect(() => {
    if (facilities && facilities.length > 0 && !selectedFacility) {
      setSelectedFacility(facilities[0].id);
    }
  }, [facilities, selectedFacility]);
  
  // Fetch appointment settings for selected facility
  const {
    data: appointmentSettings,
    isLoading: isLoadingSettings,
    error: settingsError
  } = useQuery({
    queryKey: ["/api/facilities", selectedFacility, "appointment-settings"],
    queryFn: async () => {
      if (!selectedFacility) return null;
      const response = await fetch(`/api/facilities/${selectedFacility}/appointment-settings`);
      if (!response.ok) throw new Error("Failed to fetch appointment settings");
      return response.json();
    },
    enabled: !!selectedFacility
  });
  
  // Update appointment settings when they're loaded
  useEffect(() => {
    if (appointmentSettings) {
      setTimeInterval(appointmentSettings.timeInterval.toString());
      setMaxInbound(appointmentSettings.maxConcurrentInbound);
      setMaxOutbound(appointmentSettings.maxConcurrentOutbound);
      setShareAvailability(appointmentSettings.shareAvailabilityInfo);
    }
  }, [appointmentSettings]);
  
  // Mutation to update appointment settings
  const updateSettingsMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("PUT", `/api/facilities/${selectedFacility}/appointment-settings`, data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Settings Updated",
        description: "Appointment settings have been updated successfully.",
      });
      
      // Invalidate the settings query to refetch with new data
      queryClient.invalidateQueries({ 
        queryKey: ["/api/facilities", selectedFacility, "appointment-settings"] 
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

  // Handle save settings
  const handleSaveSettings = (settingType: string) => {
    // Save barcode format settings to localStorage if organization settings
    if (settingType === "organization") {
      localStorage.setItem('defaultBarcodeFormat', defaultBarcodeFormat);
      localStorage.setItem('barcodePrefix', barcodePrefix);
    }
    
    toast({
      title: "Settings Saved",
      description: `Your ${settingType} settings have been updated.`,
    });
  };
  
  // Handle logout
  const handleLogout = () => {
    logoutMutation.mutate();
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-medium">Settings</h2>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="md:col-span-1 h-fit">
          <CardHeader>
            <CardTitle className="text-lg">Options</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-start w-full">
              <div className="w-full border-b mb-4">
                <div
                  className={`px-0 py-2 mb-2 cursor-pointer ${activeTab === "account" ? "border-l-2 border-primary pl-2 font-medium" : ""}`}
                  onClick={() => setActiveTab("account")}
                >
                  Account
                </div>
                <div
                  className={`px-0 py-2 mb-2 cursor-pointer ${activeTab === "notifications" ? "border-l-2 border-primary pl-2 font-medium" : ""}`}
                  onClick={() => setActiveTab("notifications")}
                >
                  Notifications
                </div>
                <div
                  className={`px-0 py-2 mb-2 cursor-pointer ${activeTab === "appearance" ? "border-l-2 border-primary pl-2 font-medium" : ""}`}
                  onClick={() => setActiveTab("appearance")}
                >
                  Appearance
                </div>
                <div
                  className={`px-0 py-2 mb-2 cursor-pointer ${activeTab === "scheduling" ? "border-l-2 border-primary pl-2 font-medium" : ""}`}
                  onClick={() => setActiveTab("scheduling")}
                >
                  Scheduling
                </div>
                <div
                  className={`px-0 py-2 mb-2 cursor-pointer ${activeTab === "organization" ? "border-l-2 border-primary pl-2 font-medium" : ""}`}
                  onClick={() => setActiveTab("organization")}
                >
                  Organization
                </div>
                <div
                  className={`px-0 py-2 cursor-pointer ${activeTab === "integrations" ? "border-l-2 border-primary pl-2 font-medium" : ""}`}
                  onClick={() => setActiveTab("integrations")}
                >
                  Integrations
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="md:col-span-3">
          {/* Account Tab */}
          <div className={activeTab !== "account" ? "hidden" : ""}>
            <CardHeader>
              <CardTitle>Account Settings</CardTitle>
              <CardDescription>
                Manage your account information and preferences.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Personal Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First name</Label>
                    <Input id="firstName" defaultValue={user?.firstName} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last name</Label>
                    <Input id="lastName" defaultValue={user?.lastName} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" defaultValue={user?.email} />
                </div>
              </div>
              
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Password</h3>
                <div className="space-y-2">
                  <Label htmlFor="currentPassword">Current password</Label>
                  <Input id="currentPassword" type="password" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="newPassword">New password</Label>
                    <Input id="newPassword" type="password" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm password</Label>
                    <Input id="confirmPassword" type="password" />
                  </div>
                </div>
              </div>
              
              <div className="flex justify-between items-center pt-4 border-t">
                <Button variant="destructive" onClick={handleLogout}>
                  <LogOut className="h-4 w-4 mr-2" />
                  Log out
                </Button>
                <Button onClick={() => handleSaveSettings("account")}>
                  <Save className="h-4 w-4 mr-2" />
                  Save changes
                </Button>
              </div>
            </CardContent>
          </div>
          
          {/* Notifications Tab */}
          <div className={activeTab !== "notifications" ? "hidden" : ""}>
            <CardHeader>
              <CardTitle>Notification Settings</CardTitle>
              <CardDescription>
                Configure how you receive notifications from the system.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {isLoadingPreferences ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Email Notifications</h3>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="email-notifications">Receive email notifications</Label>
                      <p className="text-sm text-neutral-500">
                        Get updates about schedules and dock status via email
                      </p>
                    </div>
                    <Switch
                      id="email-notifications"
                      checked={emailNotificationsEnabled}
                      onCheckedChange={setEmailNotificationsEnabled}
                    />
                  </div>
                  
                  {emailNotificationsEnabled && (
                    <div className="ml-6 space-y-2 pt-2">
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="email-schedule-changes" 
                          checked={emailScheduleChanges}
                          onCheckedChange={(checked) => setEmailScheduleChanges(checked === true)}
                        />
                        <label
                          htmlFor="email-schedule-changes"
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          Schedule changes
                        </label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="email-truck-arrivals" 
                          checked={emailTruckArrivals}
                          onCheckedChange={(checked) => setEmailTruckArrivals(checked === true)}
                        />
                        <label
                          htmlFor="email-truck-arrivals"
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          Truck arrival alerts
                        </label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="email-dock-assignments" 
                          checked={emailDockAssignments}
                          onCheckedChange={(checked) => setEmailDockAssignments(checked === true)}
                        />
                        <label
                          htmlFor="email-dock-assignments"
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          Dock assignments
                        </label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="email-weekly-reports" 
                          checked={emailWeeklyReports}
                          onCheckedChange={(checked) => setEmailWeeklyReports(checked === true)}
                        />
                        <label
                          htmlFor="email-weekly-reports"
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          Weekly performance reports
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Push Notifications</h3>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="push-notifications">Enable push notifications</Label>
                    <p className="text-sm text-neutral-500">
                      Receive real-time updates in your browser
                    </p>
                  </div>
                  <Switch
                    id="push-notifications"
                    checked={pushNotificationsEnabled}
                    onCheckedChange={setPushNotificationsEnabled}
                  />
                </div>
                
                {pushNotificationsEnabled && (
                  <div className="ml-6 space-y-2 pt-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="push-urgent-alerts" 
                        checked={pushUrgentAlertsOnly}
                        onCheckedChange={(checked) => setPushUrgentAlertsOnly(checked === true)}
                      />
                      <label
                        htmlFor="push-urgent-alerts"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        Urgent alerts only
                      </label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="push-all-updates" 
                        checked={pushAllUpdates}
                        onCheckedChange={(checked) => setPushAllUpdates(checked === true)}
                      />
                      <label
                        htmlFor="push-all-updates"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        All updates
                      </label>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="pt-4 border-t">
                {/* Test Email Section */}
                <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-950 rounded-md">
                  <h4 className="font-medium text-blue-700 dark:text-blue-300 mb-2">
                    Test Email Notifications
                  </h4>
                  <p className="text-sm text-blue-600 dark:text-blue-400 mb-3">
                    Send a test email to verify your notification settings are configured correctly.
                  </p>
                  
                  {/* Test Email Button */}
                  <div className="flex items-center">
                    <Button 
                      variant="outline"
                      className="bg-white dark:bg-transparent border-blue-200 text-blue-600 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900"
                      onClick={async () => {
                        try {
                          toast({
                            title: "Sending test email...",
                            description: "Please wait while we send a test email to your account."
                          });
                          
                          const res = await fetch('/api/test-notification-email');
                          const data = await res.json();
                          
                          if (res.ok) {
                            toast({
                              title: "Test Email Sent",
                              description: `A test email has been sent to ${user?.email}. Please check your inbox (and spam folder).`,
                            });
                          } else {
                            toast({
                              title: "Failed to Send Test Email",
                              description: data.message || "There was an error sending the test email.",
                              variant: "destructive"
                            });
                          }
                        } catch (error) {
                          console.error('Error sending test email:', error);
                          toast({
                            title: "Error",
                            description: "Failed to send test email. Please try again later.",
                            variant: "destructive"
                          });
                        }
                      }}
                    >
                      <Mail className="h-4 w-4 mr-2" />
                      Send Test Email
                    </Button>
                    
                    <p className="text-xs text-neutral-500 ml-4">
                      This will send a test email to: {user?.email}
                    </p>
                  </div>
                </div>
                
                {/* Save Button */}
                <div className="flex justify-end">
                  <Button 
                    onClick={() => saveNotificationPreferencesMutation.mutate({})}
                    disabled={saveNotificationPreferencesMutation.isPending}
                  >
                    {saveNotificationPreferencesMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    Save changes
                  </Button>
                </div>
              </div>
            </CardContent>
          </div>
          
          {/* Appearance Tab */}
          <div className={activeTab !== "appearance" ? "hidden" : ""}>
            <CardHeader>
              <CardTitle>Appearance Settings</CardTitle>
              <CardDescription>
                Customize how the application looks and feels.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Theme</h3>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="dark-mode">Dark mode</Label>
                    <p className="text-sm text-neutral-500">
                      Use dark theme for low-light environments
                    </p>
                  </div>
                  <Switch
                    id="dark-mode"
                    checked={darkMode}
                    onCheckedChange={setDarkMode}
                  />
                </div>
              </div>
              
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Dashboard Layout</h3>
                <div className="space-y-2">
                  <Label htmlFor="default-view">Default view</Label>
                  <Select defaultValue="dock-status">
                    <SelectTrigger>
                      <SelectValue placeholder="Select default view" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="overview">Overview</SelectItem>
                      <SelectItem value="dock-status">Dock Status</SelectItem>
                      <SelectItem value="schedule">Schedule</SelectItem>
                      <SelectItem value="analytics">Analytics</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="flex justify-end pt-4 border-t">
                <Button onClick={() => handleSaveSettings("appearance")}>
                  <Save className="h-4 w-4 mr-2" />
                  Save changes
                </Button>
              </div>
            </CardContent>
          </div>
          
          {/* Scheduling Tab */}
          <div className={activeTab !== "scheduling" ? "hidden" : ""}>
            <CardHeader>
              <CardTitle>Scheduling Settings</CardTitle>
              <CardDescription>
                Configure default settings for scheduling and dock assignments.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {isLoadingSettings ? (
                <div className="flex justify-center items-center p-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : settingsError ? (
                <div className="p-4 bg-red-50 rounded-md">
                  <p className="text-red-600">Failed to load appointment settings</p>
                </div>
              ) : (
                <>
                  {facilities && facilities.length > 0 && (
                    <div className="space-y-4">
                      <h3 className="text-lg font-medium">Facility</h3>
                      <div className="space-y-2">
                        <Label htmlFor="facility-selector">Select facility to configure</Label>
                        <Select
                          value={selectedFacility?.toString()}
                          onValueChange={(value) => setSelectedFacility(Number(value))}
                        >
                          <SelectTrigger id="facility-selector" className="w-full">
                            <SelectValue placeholder="Select facility" />
                          </SelectTrigger>
                          <SelectContent>
                            {facilities.map((facility: { id: number; name: string }) => (
                              <SelectItem key={facility.id} value={facility.id.toString()}>
                                {facility.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
              
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Default Dwell Times</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="inbound-dwell">Default inbound dwell time (minutes)</Label>
                        <Input id="inbound-dwell" type="number" defaultValue="60" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="outbound-dwell">Default outbound dwell time (minutes)</Label>
                        <Input id="outbound-dwell" type="number" defaultValue="45" />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="buffer-time">Buffer time between appointments (minutes)</Label>
                      <Input id="buffer-time" type="number" defaultValue="15" />
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Scheduling Rules</h3>
                    <div className="flex items-center space-x-2">
                      <Checkbox id="allow-overlapping" />
                      <label
                        htmlFor="allow-overlapping"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        Allow overlapping schedules (with manual override)
                      </label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox id="auto-assign" defaultChecked />
                      <label
                        htmlFor="auto-assign"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        Automatically assign optimal dock doors
                      </label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox id="prioritize-carriers" defaultChecked />
                      <label
                        htmlFor="prioritize-carriers"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        Prioritize preferred carriers
                      </label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="share-availability" 
                        checked={shareAvailability}
                        onCheckedChange={(checked) => setShareAvailability(checked === true)}
                      />
                      <label
                        htmlFor="share-availability"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        Share availability information in appointment details
                      </label>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Appointment Settings</h3>
                    <div className="space-y-2">
                      <Label htmlFor="time-interval">Time interval for appointments</Label>
                      <Select 
                        value={timeInterval} 
                        onValueChange={setTimeInterval}
                      >
                        <SelectTrigger id="time-interval" className="w-full">
                          <SelectValue placeholder="Select time interval" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="15">15 minutes</SelectItem>
                          <SelectItem value="30">30 minutes</SelectItem>
                          <SelectItem value="60">60 minutes</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-sm text-neutral-500">
                        Controls how appointments are scheduled and displayed on the calendar
                      </p>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="max-inbound">Maximum concurrent inbound appointments</Label>
                        <Input 
                          id="max-inbound" 
                          type="number" 
                          value={maxInbound}
                          onChange={(e) => setMaxInbound(Number(e.target.value))}
                          min="1" 
                          max="10" 
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="max-outbound">Maximum concurrent outbound appointments</Label>
                        <Input 
                          id="max-outbound" 
                          type="number" 
                          value={maxOutbound}
                          onChange={(e) => setMaxOutbound(Number(e.target.value))}
                          min="1" 
                          max="10" 
                        />
                      </div>
                    </div>
                    <p className="text-sm text-neutral-500">
                      Limits the number of concurrent appointments that can be scheduled per type
                    </p>
                  </div>
                  
                  <div className="flex justify-end pt-4 border-t">
                    <Button 
                      onClick={() => {
                        if (selectedFacility) {
                          updateSettingsMutation.mutate({
                            facilityId: selectedFacility,
                            timeInterval: Number(timeInterval),
                            maxConcurrentInbound: maxInbound,
                            maxConcurrentOutbound: maxOutbound,
                            shareAvailabilityInfo: shareAvailability
                          });
                        }
                      }}
                      disabled={updateSettingsMutation.isPending || !selectedFacility}
                    >
                      {updateSettingsMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-2" />
                          Save changes
                        </>
                      )}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </div>
          
          {/* Organization Tab */}
          <div className={activeTab !== "organization" ? "hidden" : ""}>
            <CardHeader>
              <CardTitle>Organization Settings</CardTitle>
              <CardDescription>
                Configure organization-wide settings for time zones and holidays.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Organization Logo</h3>
                <div className="space-y-4 mb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-24 h-24 border rounded-md flex items-center justify-center overflow-hidden bg-white">
                      <img 
                        src={logoPreview || organizationLogo} 
                        alt="Organization Logo" 
                        className="max-w-full max-h-full object-contain"
                      />
                    </div>
                    <div className="space-y-2 flex-1">
                      <Label htmlFor="logo-upload">Logo Image</Label>
                      <Input 
                        id="logo-upload" 
                        type="file" 
                        accept="image/*"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            const file = e.target.files[0];
                            
                            // Check file size - enforce 1MB limit
                            if (file.size > 1024 * 1024) {
                              toast({
                                title: "File too large",
                                description: "Logo image must be smaller than 1MB. Please resize and try again.",
                                variant: "destructive",
                              });
                              return;
                            }
                            
                            const reader = new FileReader();
                            
                            reader.onload = (event) => {
                              if (event.target?.result) {
                                // Check if the result is too large for HTTP request
                                const dataUrl = event.target.result as string;
                                if (dataUrl.length > 1024 * 1024) {
                                  toast({
                                    title: "Image too large",
                                    description: "The encoded image is too large. Please use a smaller or compressed image.",
                                    variant: "destructive",
                                  });
                                  return;
                                }
                                
                                // Set the preview image
                                setLogoPreview(dataUrl);
                                
                                // Upload the logo to the server using the API
                                if (user?.tenantId) {
                                  fetch(`/api/admin/organizations/${user.tenantId}/logo`, {
                                    method: 'POST',
                                    headers: {
                                      'Content-Type': 'application/json',
                                    },
                                    body: JSON.stringify({ 
                                      logoData: event.target.result 
                                    }),
                                  }).then(response => {
                                    if (!response.ok) {
                                      throw new Error('Failed to update organization logo');
                                    }
                                    return response.json();
                                  }).then(() => {
                                    // Invalidate the logo query to refetch with new data
                                    queryClient.invalidateQueries({ 
                                      queryKey: ['/api/admin/organizations', user.tenantId, 'logo'] 
                                    });
                                    
                                    // Also invalidate any endpoint that might use this logo
                                    // This ensures the booking pages logo endpoint will refresh
                                    queryClient.invalidateQueries({
                                      queryKey: ['/api/booking-pages']
                                    });
                                    
                                    // Show success notification only after successful upload
                                    toast({
                                      title: "Logo Updated",
                                      description: "Your organization logo has been updated successfully.",
                                    });
                                    
                                    // Force refresh the sidebar logo by invalidating org details
                                    queryClient.invalidateQueries({
                                      queryKey: ['/api/admin/orgs', user.tenantId]
                                    });
                                    
                                    console.log('Logo updated successfully, queries invalidated for refresh');
                                  }).catch(error => {
                                    console.error('Error uploading logo:', error);
                                    toast({
                                      title: "Logo Update Failed",
                                      description: error.message,
                                      variant: "destructive",
                                    });
                                  });
                                }
                              }
                            };
                            
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                      <p className="text-xs text-neutral-500">
                        Recommended size: 400x400px. Maximum file size: 2MB.
                      </p>
                    </div>
                  </div>
                </div>
                
                <h3 className="text-lg font-medium">Time Zone</h3>
                <div className="space-y-2">
                  <Label htmlFor="org-timezone">Organization default time zone</Label>
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-neutral-500" />
                    <Select value={orgTimeZone} onValueChange={setOrgTimeZone}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select time zone" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="America/New_York">Eastern Time (US & Canada)</SelectItem>
                        <SelectItem value="America/Chicago">Central Time (US & Canada)</SelectItem>
                        <SelectItem value="America/Denver">Mountain Time (US & Canada)</SelectItem>
                        <SelectItem value="America/Los_Angeles">Pacific Time (US & Canada)</SelectItem>
                        <SelectItem value="America/Anchorage">Alaska (US)</SelectItem>
                        <SelectItem value="America/Honolulu">Hawaii (US)</SelectItem>
                        <SelectItem value="Europe/London">London</SelectItem>
                        <SelectItem value="Europe/Paris">Paris</SelectItem>
                        <SelectItem value="Asia/Tokyo">Tokyo</SelectItem>
                        <SelectItem value="Australia/Sydney">Sydney</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <p className="text-sm text-neutral-500 mt-1">
                    This time zone will be used as the default for all locations unless overridden at the facility level.
                  </p>
                </div>
              </div>
              
              <div className="space-y-4 border rounded-lg p-4">
                <h3 className="text-lg font-medium">Organization Default Hours</h3>
                <p className="text-sm text-neutral-500">
                  Configure default operating hours that apply to all facilities in your organization. Individual facilities can override these settings.
                </p>
                <Button 
                  variant="outline" 
                  onClick={() => window.location.href = "/organization-hours"} 
                  className="flex items-center mt-2"
                >
                  <Clock className="mr-2 h-4 w-4" />
                  Manage Default Hours
                </Button>
              </div>
              
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Organization-wide Holidays</h3>
                <p className="text-sm text-neutral-500">
                  Configure holidays that apply to all facilities in your organization. Individual facilities can also have their own specific holidays.
                </p>
                
                <div className="border rounded-lg divide-y">
                  {organizationHolidays.map((holiday, index) => (
                    <div key={index} className="p-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CalendarDays className="h-4 w-4 text-neutral-500" />
                        <div>
                          <div className="font-medium">{holiday.name}</div>
                          <div className="text-sm text-neutral-500">
                            {/* Format date correctly to avoid timezone offsets showing wrong day */}
                            {formatDisplayDate(holiday.date)}
                          </div>
                        </div>
                      </div>
                      <Switch 
                        checked={holiday.enabled} 
                        onCheckedChange={(checked) => {
                          const updatedHolidays = [...organizationHolidays];
                          updatedHolidays[index] = { ...holiday, enabled: checked };
                          // Update local state
                          setOrganizationHolidays(updatedHolidays);
                          
                          // Save to server
                          if (user?.tenantId) {
                            saveHolidaysMutation.mutate(updatedHolidays);
                          }
                        }}
                      />
                    </div>
                  ))}
                </div>
                
                <div className="space-y-4 pt-4 border-t">
                  {/* Holiday Actions: Adding, Importing, etc */}
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium">Holiday Management</h4>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          if (!user?.tenantId) return;
                          
                          try {
                            toast({
                              title: "Syncing Holidays",
                              description: "Auto-syncing current and next year holidays...",
                            });
                            
                            // Use the dedicated sync endpoint that handles date calculation
                            const response = await fetch(`/api/organizations/${user.tenantId}/holidays/sync`, {
                              method: 'POST',
                              headers: {
                                'Content-Type': 'application/json'
                              }
                            });
                            
                            if (!response.ok) {
                              throw new Error('Failed to sync holidays');
                            }
                            
                            const data = await response.json();
                            
                            // Invalidate the holidays query to refetch with new data
                            queryClient.invalidateQueries({ 
                              queryKey: ['/api/organizations', user.tenantId, 'holidays'] 
                            });
                            
                            toast({
                              title: "Holidays Synced",
                              description: `Added ${data.added} new holidays for current and next year.`,
                            });
                          } catch (error) {
                            console.error('Error syncing holidays:', error);
                            toast({
                              title: "Sync Failed",
                              description: "Could not sync holidays. Please try again.",
                              variant: "destructive"
                            });
                          }
                        }}
                      >
                        <Calendar className="h-4 w-4 mr-2" />
                        Sync Annual Holidays
                      </Button>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          // Load full list of standard US holidays
                          const standardHolidays = [
                            // 2025 US Federal Holidays
                            { name: "New Year's Day", date: "2025-01-01", enabled: true },
                            { name: "Martin Luther King Jr. Day", date: "2025-01-20", enabled: true },
                            { name: "Presidents' Day", date: "2025-02-17", enabled: true },
                            { name: "Memorial Day", date: "2025-05-26", enabled: true },
                            { name: "Juneteenth", date: "2025-06-19", enabled: true },
                            { name: "Independence Day", date: "2025-07-04", enabled: true },
                            { name: "Labor Day", date: "2025-09-01", enabled: true },
                            { name: "Columbus Day", date: "2025-10-13", enabled: true },
                            { name: "Veterans Day", date: "2025-11-11", enabled: true },
                            { name: "Thanksgiving Day", date: "2025-11-27", enabled: true },
                            { name: "Christmas Day", date: "2025-12-25", enabled: true },
                            // 2026 US Federal Holidays
                            { name: "New Year's Day", date: "2026-01-01", enabled: true },
                            { name: "Martin Luther King Jr. Day", date: "2026-01-19", enabled: true },
                            { name: "Presidents' Day", date: "2026-02-16", enabled: true },
                            { name: "Memorial Day", date: "2026-05-25", enabled: true },
                            { name: "Juneteenth", date: "2026-06-19", enabled: true },
                            { name: "Independence Day", date: "2026-07-03", enabled: true }, // observed
                            { name: "Labor Day", date: "2026-09-07", enabled: true },
                            { name: "Columbus Day", date: "2026-10-12", enabled: true },
                            { name: "Veterans Day", date: "2026-11-11", enabled: true },
                            { name: "Thanksgiving Day", date: "2026-11-26", enabled: true },
                            { name: "Christmas Day", date: "2026-12-25", enabled: true },
                          ];
                          
                          if (user?.tenantId) {
                            toast({
                              title: "Importing Holidays",
                              description: "Adding full list of US Federal Holidays for 2025-2026",
                            });
                            
                            // Save to server
                            saveHolidaysMutation.mutate(standardHolidays);
                          }
                        }}
                      >
                        <Calendar className="h-4 w-4 mr-2" />
                        Import Standard Holidays
                      </Button>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (organizationHolidays.length === 0) {
                            toast({
                              title: "No holidays to export",
                              description: "Add some holidays first before exporting.",
                              variant: "destructive",
                            });
                            return;
                          }
                          
                          // Create a CSV string of the holidays
                          const csvContent = [
                            "name,date,enabled",
                            ...organizationHolidays.map(h => `"${h.name}",${h.date},${h.enabled}`)
                          ].join("\n");
                          
                          // Create a download link
                          const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                          const url = URL.createObjectURL(blob);
                          const link = document.createElement('a');
                          link.setAttribute('href', url);
                          link.setAttribute('download', `organization-holidays-${new Date().toISOString().split('T')[0]}.csv`);
                          link.click();
                          URL.revokeObjectURL(url);
                        }}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Export Holidays
                      </Button>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="holiday-name">Holiday name</Label>
                      <Input 
                        id="holiday-name" 
                        placeholder="Enter holiday name" 
                        value={customHolidayName}
                        onChange={(e) => setCustomHolidayName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="holiday-date">Date</Label>
                      <Input 
                        id="holiday-date" 
                        type="date" 
                        value={customHolidayDate}
                        onChange={(e) => setCustomHolidayDate(e.target.value)}
                      />
                    </div>
                  </div>
                  
                  <div className="flex justify-end mt-4">
                    <Button
                      onClick={() => {
                        if (customHolidayName && customHolidayDate) {
                          // Create new holidays array with the new holiday
                          const updatedHolidays = [
                            ...organizationHolidays,
                            { 
                              name: customHolidayName, 
                              date: customHolidayDate, 
                              enabled: true 
                            }
                          ];
                          
                          // Update local state
                          setOrganizationHolidays(updatedHolidays);
                          setCustomHolidayName("");
                          setCustomHolidayDate("");
                          
                          // Save to server
                          if (user?.tenantId) {
                            saveHolidaysMutation.mutate(updatedHolidays);
                          }
                          
                          toast({
                            title: "Holiday Added",
                            description: `${customHolidayName} has been added to organization holidays.`,
                          });
                        }
                      }}
                      disabled={!customHolidayName || !customHolidayDate || saveHolidaysMutation.isPending}
                    >
                      {saveHolidaysMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        "Add Holiday"
                      )}
                    </Button>
                  </div>
                  
                  <div className="bg-muted/40 rounded-md p-4 mt-2 border">
                    <h4 className="text-sm font-medium mb-2">About Annual Holiday Sync</h4>
                    <p className="text-xs text-neutral-500">
                      The system will automatically sync US Federal Holidays each year. To add custom holidays, use the form above. 
                      All holidays apply organization-wide and will prevent scheduling on those dates.
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="space-y-4 border-t pt-6">
                <h3 className="text-lg font-medium">Asset Manager Settings</h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="barcode-format">Default Barcode Format</Label>
                      <Select 
                        value={defaultBarcodeFormat} 
                        onValueChange={setDefaultBarcodeFormat}
                      >
                        <SelectTrigger id="barcode-format" className="w-full">
                          <SelectValue placeholder="Select barcode format" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="CODE128">Code 128</SelectItem>
                          <SelectItem value="CODE39">Code 39</SelectItem>
                          <SelectItem value="EAN13">EAN-13</SelectItem>
                          <SelectItem value="UPC">UPC</SelectItem>
                          <SelectItem value="EAN8">EAN-8</SelectItem>
                          <SelectItem value="ITF14">ITF-14</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-sm text-muted-foreground">
                        Default format used when generating barcodes for new assets.
                      </p>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="barcode-prefix">Default Barcode Prefix</Label>
                      <Input 
                        id="barcode-prefix" 
                        value={barcodePrefix}
                        onChange={(e) => setBarcodePrefix(e.target.value)} 
                        placeholder="H" 
                        maxLength={3}
                      />
                      <p className="text-sm text-muted-foreground">
                        Optional prefix to add to automatically generated barcodes (1-3 characters).
                      </p>
                    </div>
                  </div>
                  
                  <div className="p-4 bg-muted/40 rounded-md border">
                    <div className="flex items-center gap-3">
                      <div className="bg-white p-3 border rounded">
                        <svg ref={(ref) => {
                          if (ref) {
                            try {
                              import('jsbarcode').then(({ default: JsBarcode }) => {
                                JsBarcode(ref, `${barcodePrefix}12345`, {
                                  format: defaultBarcodeFormat,
                                  width: 1.5,
                                  height: 50,
                                  displayValue: true,
                                  margin: 5,
                                  background: '#ffffff',
                                });
                              });
                            } catch (error) {
                              console.error('Error generating barcode:', error);
                            }
                          }
                        }} className="h-16"></svg>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        <p>Preview of barcode with current settings.</p>
                        <p>Changes will apply to new barcodes generated after saving.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end pt-4 border-t">
                <Button onClick={() => handleSaveSettings("organization")}>
                  <Save className="h-4 w-4 mr-2" />
                  Save changes
                </Button>
              </div>
            </CardContent>
          </div>
          
          {/* Integrations Tab */}
          <div className={activeTab !== "integrations" ? "hidden" : ""}>
            <CardHeader>
              <CardTitle>Integration Settings</CardTitle>
              <CardDescription>
                Connect with external systems and services.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-lg font-medium">API Configuration</h3>
                <div className="space-y-2">
                  <Label htmlFor="api-key">API Key</Label>
                  <div className="flex">
                    <Input id="api-key" type="password" value="••••••••••••••••" readOnly className="rounded-r-none" />
                    <Button variant="outline" className="rounded-l-none">Copy</Button>
                  </div>
                  <p className="text-sm text-neutral-500">
                    Use this key to authenticate with the Dock Optimizer API
                  </p>
                </div>
                
                <div className="flex justify-end">
                  <Button variant="outline">
                    Regenerate API Key
                  </Button>
                </div>
              </div>
              
              <div className="space-y-4">
                <h3 className="text-lg font-medium">External Services</h3>
                <div className="space-y-4">
                  <div className="border rounded-md p-4">
                    <div className="flex items-center justify-between mb-4">
                      <div className="font-medium">Warehouse Management System</div>
                      <Switch defaultChecked />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="wms-url">WMS API URL</Label>
                        <Input id="wms-url" defaultValue="https://api.example-wms.com/v1" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="wms-key">WMS API Key</Label>
                        <Input id="wms-key" type="password" value="••••••••••••••••" />
                      </div>
                    </div>
                  </div>
                  
                  <div className="border rounded-md p-4">
                    <div className="flex items-center justify-between mb-4">
                      <div className="font-medium">Transportation Management System</div>
                      <Switch />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="tms-url">TMS API URL</Label>
                        <Input id="tms-url" defaultValue="https://api.example-tms.com/v2" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="tms-key">TMS API Key</Label>
                        <Input id="tms-key" type="password" value="" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end pt-4 border-t">
                <Button onClick={() => handleSaveSettings("integrations")}>
                  <Save className="h-4 w-4 mr-2" />
                  Save changes
                </Button>
              </div>
            </CardContent>
          </div>
        </Card>
      </div>
    </div>
  );
}