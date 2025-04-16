import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Save, Clock, Mail, Bell, LogOut, Building, CalendarDays, Globe } from "lucide-react";

export default function Settings() {
  const { toast } = useToast();
  const { user, logoutMutation } = useAuth();
  const [activeTab, setActiveTab] = useState("account");
  
  // Form states
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [darkMode, setDarkMode] = useState(false);

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
            <Tabs
              defaultValue="account"
              orientation="vertical"
              value={activeTab}
              onValueChange={setActiveTab}
              className="w-full"
            >
              <TabsList className="flex flex-col items-start w-full bg-transparent">
                <TabsTrigger
                  value="account"
                  className="w-full justify-start px-0 py-2 data-[state=active]:border-l-2 data-[state=active]:border-primary data-[state=active]:pl-2"
                >
                  Account
                </TabsTrigger>
                <TabsTrigger
                  value="notifications"
                  className="w-full justify-start px-0 py-2 data-[state=active]:border-l-2 data-[state=active]:border-primary data-[state=active]:pl-2"
                >
                  Notifications
                </TabsTrigger>
                <TabsTrigger
                  value="appearance"
                  className="w-full justify-start px-0 py-2 data-[state=active]:border-l-2 data-[state=active]:border-primary data-[state=active]:pl-2"
                >
                  Appearance
                </TabsTrigger>
                <TabsTrigger
                  value="scheduling"
                  className="w-full justify-start px-0 py-2 data-[state=active]:border-l-2 data-[state=active]:border-primary data-[state=active]:pl-2"
                >
                  Scheduling
                </TabsTrigger>
                <TabsTrigger
                  value="organization"
                  className="w-full justify-start px-0 py-2 data-[state=active]:border-l-2 data-[state=active]:border-primary data-[state=active]:pl-2"
                >
                  Organization
                </TabsTrigger>
                <TabsTrigger
                  value="integrations"
                  className="w-full justify-start px-0 py-2 data-[state=active]:border-l-2 data-[state=active]:border-primary data-[state=active]:pl-2"
                >
                  Integrations
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </CardContent>
        </Card>
        
        <Card className="md:col-span-3">
          <TabsContent value="account" className="m-0" hidden={activeTab !== "account"}>
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
          </TabsContent>
          
          <TabsContent value="notifications" className="m-0" hidden={activeTab !== "notifications"}>
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
          </TabsContent>
          
          <TabsContent value="appearance" className="m-0" hidden={activeTab !== "appearance"}>
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
          </TabsContent>
          
          <TabsContent value="scheduling" className="m-0" hidden={activeTab !== "scheduling"}>
            <CardHeader>
              <CardTitle>Scheduling Settings</CardTitle>
              <CardDescription>
                Configure default settings for scheduling and dock assignments.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
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
              </div>
              
              <div className="flex justify-end pt-4 border-t">
                <Button onClick={() => handleSaveSettings("scheduling")}>
                  <Save className="h-4 w-4 mr-2" />
                  Save changes
                </Button>
              </div>
            </CardContent>
          </TabsContent>
          
          <TabsContent value="integrations" className="m-0" hidden={activeTab !== "integrations"}>
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
          </TabsContent>
        </Card>
      </div>
    </div>
  );
}
