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
import { Save, Clock, Mail, Bell, LogOut, Building, CalendarDays, Globe, Loader2 } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { TimeInterval } from "@shared/schema";

export default function Settings() {
  const { toast } = useToast();
  const { user, logoutMutation } = useAuth();
  const [activeTab, setActiveTab] = useState("account");
  
  // Form states
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(true);
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
  const [organizationHolidays, setOrganizationHolidays] = useState([
    { name: "New Year's Day", date: "2025-01-01", enabled: true },
    { name: "Memorial Day", date: "2025-05-26", enabled: true },
    { name: "Independence Day", date: "2025-07-04", enabled: true },
    { name: "Labor Day", date: "2025-09-01", enabled: true },
    { name: "Thanksgiving Day", date: "2025-11-27", enabled: true },
    { name: "Christmas Day", date: "2025-12-25", enabled: true },
  ]);
  
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
                    checked={emailNotifications}
                    onCheckedChange={setEmailNotifications}
                  />
                </div>
                
                {emailNotifications && (
                  <div className="ml-6 space-y-2 pt-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox id="email-schedule-changes" defaultChecked />
                      <label
                        htmlFor="email-schedule-changes"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        Schedule changes
                      </label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox id="email-truck-arrivals" defaultChecked />
                      <label
                        htmlFor="email-truck-arrivals"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        Truck arrival alerts
                      </label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox id="email-dock-assignments" defaultChecked />
                      <label
                        htmlFor="email-dock-assignments"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        Dock assignments
                      </label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox id="email-weekly-reports" />
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
                    checked={pushNotifications}
                    onCheckedChange={setPushNotifications}
                  />
                </div>
                
                {pushNotifications && (
                  <div className="ml-6 space-y-2 pt-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox id="push-urgent-alerts" defaultChecked />
                      <label
                        htmlFor="push-urgent-alerts"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        Urgent alerts only
                      </label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox id="push-all-updates" />
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
              
              <div className="flex justify-end pt-4 border-t">
                <Button onClick={() => handleSaveSettings("notification")}>
                  <Save className="h-4 w-4 mr-2" />
                  Save changes
                </Button>
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
                            {new Date(holiday.date).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      <Switch 
                        checked={holiday.enabled} 
                        onCheckedChange={(checked) => {
                          const updatedHolidays = [...organizationHolidays];
                          updatedHolidays[index] = { ...holiday, enabled: checked };
                          setOrganizationHolidays(updatedHolidays);
                        }}
                      />
                    </div>
                  ))}
                </div>
                
                <div className="space-y-4 pt-4 border-t">
                  <h4 className="font-medium">Add Custom Holiday</h4>
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
                          setOrganizationHolidays([
                            ...organizationHolidays,
                            { 
                              name: customHolidayName, 
                              date: customHolidayDate, 
                              enabled: true 
                            }
                          ]);
                          setCustomHolidayName("");
                          setCustomHolidayDate("");
                          toast({
                            title: "Holiday Added",
                            description: `${customHolidayName} has been added to organization holidays.`,
                          });
                        }
                      }}
                      disabled={!customHolidayName || !customHolidayDate}
                    >
                      Add Holiday
                    </Button>
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