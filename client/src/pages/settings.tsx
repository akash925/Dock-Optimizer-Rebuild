import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import { AlertCircle, Mail, Bell, User, Lock, Palette, Calendar, Building2, Link2 } from 'lucide-react';

interface UserPreferences {
  id?: number;
  userId: number;
  emailNotifications: boolean;
  pushNotifications: boolean;
  scheduleChanges: boolean;
  truckArrivalAlerts: boolean;
  dockAssignments: boolean;
  weeklyReports: boolean;
  urgentAlertsOnly: boolean;
  allUpdates: boolean;
}

interface UserProfile {
  id: number;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
}

export default function Settings() {
  const [activeTab, setActiveTab] = useState('account');
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [profileForm, setProfileForm] = useState({
    firstName: '',
    lastName: '',
    email: ''
  });
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch user profile
  const { data: user, isLoading: userLoading } = useQuery<UserProfile>({
    queryKey: ['/api/user'],
  });

  // Fetch user preferences
  const { data: preferences, isLoading: preferencesLoading } = useQuery<UserPreferences>({
    queryKey: ['/api/user-preferences'],
  });

  // Update profile form when user data loads
  useState(() => {
    if (user) {
      setProfileForm({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        email: user.email || ''
      });
    }
  });

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (data: Partial<UserProfile>) => {
      const response = await apiRequest('PUT', '/api/user/profile', data);
      if (!response.ok) {
        throw new Error('Failed to update profile');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Profile updated',
        description: 'Your profile has been updated successfully.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
    },
    onError: () => {
      toast({
        title: 'Update failed',
        description: 'Failed to update profile. Please try again.',
        variant: 'destructive',
      });
    },
  });

  // Update password mutation
  const updatePasswordMutation = useMutation({
    mutationFn: async (data: { currentPassword: string; newPassword: string }) => {
      const response = await apiRequest('PUT', '/api/user/password', data);
      if (!response.ok) {
        throw new Error('Failed to update password');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Password updated',
        description: 'Your password has been updated successfully.',
      });
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    },
    onError: () => {
      toast({
        title: 'Password update failed',
        description: 'Failed to update password. Please check your current password.',
        variant: 'destructive',
      });
    },
  });

  // Update preferences mutation
  const updatePreferencesMutation = useMutation({
    mutationFn: async (data: Partial<UserPreferences>) => {
      const response = await apiRequest('PUT', '/api/user-preferences', data);
      if (!response.ok) {
        throw new Error('Failed to update preferences');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Settings saved',
        description: 'Your notification preferences have been updated.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/user-preferences'] });
    },
    onError: () => {
      toast({
        title: 'Save failed',
        description: 'Failed to save preferences. Please try again.',
        variant: 'destructive',
      });
    },
  });

  // Send test email mutation
  const sendTestEmailMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/user/test-email');
      if (!response.ok) {
        throw new Error('Failed to send test email');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Test email sent',
        description: `Test email sent to ${user?.email}`,
      });
    },
    onError: () => {
      toast({
        title: 'Test email failed',
        description: 'Failed to send test email. Please check your email settings.',
        variant: 'destructive',
      });
    },
  });

  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfileMutation.mutate(profileForm);
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast({
        title: 'Password mismatch',
        description: 'New password and confirm password do not match.',
        variant: 'destructive',
      });
      return;
    }
    updatePasswordMutation.mutate({
      currentPassword: passwordForm.currentPassword,
      newPassword: passwordForm.newPassword,
    });
  };

  const handlePreferenceChange = (key: keyof UserPreferences, value: boolean) => {
    updatePreferencesMutation.mutate({ [key]: value });
  };

  if (userLoading || preferencesLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your account information and preferences</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="account" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            Account
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="appearance" className="flex items-center gap-2">
            <Palette className="h-4 w-4" />
            Appearance
          </TabsTrigger>
          <TabsTrigger value="scheduling" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Scheduling
          </TabsTrigger>
          <TabsTrigger value="organization" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Organization
          </TabsTrigger>
          <TabsTrigger value="integrations" className="flex items-center gap-2">
            <Link2 className="h-4 w-4" />
            Integrations
          </TabsTrigger>
        </TabsList>

        <TabsContent value="account" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Account Settings</CardTitle>
              <CardDescription>
                Manage your account information and preferences
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="text-lg font-medium mb-4">Personal Information</h3>
                <form onSubmit={handleProfileSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">First name</Label>
                      <Input
                        id="firstName"
                        value={profileForm.firstName}
                        onChange={(e) => setProfileForm(prev => ({
                          ...prev,
                          firstName: e.target.value
                        }))}
                        placeholder="Test"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName">Last name</Label>
                      <Input
                        id="lastName"
                        value={profileForm.lastName}
                        onChange={(e) => setProfileForm(prev => ({
                          ...prev,
                          lastName: e.target.value
                        }))}
                        placeholder="Admin"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={profileForm.email}
                      onChange={(e) => setProfileForm(prev => ({
                        ...prev,
                        email: e.target.value
                      }))}
                      placeholder="testadmin@example.com"
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="bg-green-600 hover:bg-green-700"
                    disabled={updateProfileMutation.isPending}
                  >
                    {updateProfileMutation.isPending ? 'Saving...' : 'Save Changes'}
                  </Button>
                </form>
              </div>

              <Separator />

              <div>
                <h3 className="text-lg font-medium mb-4">Password</h3>
                <form onSubmit={handlePasswordSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="currentPassword">Current password</Label>
                    <Input
                      id="currentPassword"
                      type="password"
                      value={passwordForm.currentPassword}
                      onChange={(e) => setPasswordForm(prev => ({
                        ...prev,
                        currentPassword: e.target.value
                      }))}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="newPassword">New password</Label>
                      <Input
                        id="newPassword"
                        type="password"
                        value={passwordForm.newPassword}
                        onChange={(e) => setPasswordForm(prev => ({
                          ...prev,
                          newPassword: e.target.value
                        }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword">Confirm password</Label>
                      <Input
                        id="confirmPassword"
                        type="password"
                        value={passwordForm.confirmPassword}
                        onChange={(e) => setPasswordForm(prev => ({
                          ...prev,
                          confirmPassword: e.target.value
                        }))}
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" className="text-red-600 border-red-600 hover:bg-red-50">
                      Log out
                    </Button>
                    <Button 
                      type="submit" 
                      className="bg-green-600 hover:bg-green-700"
                      disabled={updatePasswordMutation.isPending}
                    >
                      {updatePasswordMutation.isPending ? 'Saving...' : 'Save Changes'}
                    </Button>
                  </div>
                </form>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Notification Settings</CardTitle>
              <CardDescription>
                Configure how you receive notifications from the system.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="text-lg font-medium mb-4">Email Notifications</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Receive email notifications. Get updates about schedules and dock status via email.
                </p>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Switch 
                        id="scheduleChanges"
                        checked={preferences?.scheduleChanges || false}
                        onCheckedChange={(checked) => handlePreferenceChange('scheduleChanges', checked)}
                      />
                      <Label htmlFor="scheduleChanges">Schedule changes</Label>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Switch 
                        id="truckArrivalAlerts"
                        checked={preferences?.truckArrivalAlerts || false}
                        onCheckedChange={(checked) => handlePreferenceChange('truckArrivalAlerts', checked)}
                      />
                      <Label htmlFor="truckArrivalAlerts">Truck arrival alerts</Label>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Switch 
                        id="dockAssignments"
                        checked={preferences?.dockAssignments || false}
                        onCheckedChange={(checked) => handlePreferenceChange('dockAssignments', checked)}
                      />
                      <Label htmlFor="dockAssignments">Dock assignments</Label>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Switch 
                        id="weeklyReports"
                        checked={preferences?.weeklyReports || false}
                        onCheckedChange={(checked) => handlePreferenceChange('weeklyReports', checked)}
                      />
                      <Label htmlFor="weeklyReports">Weekly performance reports</Label>
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <h3 className="text-lg font-medium mb-4">Push Notifications</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Enable push notifications. Receive real-time updates in your browser.
                </p>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Switch 
                        id="urgentAlertsOnly"
                        checked={preferences?.urgentAlertsOnly || false}
                        onCheckedChange={(checked) => handlePreferenceChange('urgentAlertsOnly', checked)}
                      />
                      <Label htmlFor="urgentAlertsOnly">Urgent alerts only</Label>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Switch 
                        id="allUpdates"
                        checked={preferences?.allUpdates || false}
                        onCheckedChange={(checked) => handlePreferenceChange('allUpdates', checked)}
                      />
                      <Label htmlFor="allUpdates">All updates</Label>
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <h3 className="text-lg font-medium mb-4">Test Email Notifications</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Send a test email to verify your notification settings are configured correctly.
                </p>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    onClick={() => sendTestEmailMutation.mutate()}
                    disabled={sendTestEmailMutation.isPending}
                    className="flex items-center gap-2"
                  >
                    <Mail className="h-4 w-4" />
                    {sendTestEmailMutation.isPending ? 'Sending...' : 'Send Test Email'}
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    This will send a test email to {user?.email}
                  </span>
                </div>
              </div>

              <div className="flex justify-end">
                <Button 
                  className="bg-green-600 hover:bg-green-700"
                  disabled={updatePreferencesMutation.isPending}
                >
                  {updatePreferencesMutation.isPending ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appearance">
          <Card>
            <CardHeader>
              <CardTitle>Appearance</CardTitle>
              <CardDescription>Customize the look and feel of your workspace</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Appearance settings coming soon...</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scheduling">
          <Card>
            <CardHeader>
              <CardTitle>Scheduling</CardTitle>
              <CardDescription>Configure scheduling preferences and defaults</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Scheduling settings coming soon...</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="organization">
          <Card>
            <CardHeader>
              <CardTitle>Organization</CardTitle>
              <CardDescription>Manage organization-wide settings and preferences</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Organization settings coming soon...</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="integrations">
          <Card>
            <CardHeader>
              <CardTitle>Integrations</CardTitle>
              <CardDescription>Connect with external services and tools</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Integration settings coming soon...</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}