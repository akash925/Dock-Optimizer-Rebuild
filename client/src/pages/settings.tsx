import { useState, useEffect } from 'react';
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
import { AlertCircle, Mail, Bell, User, Lock, Palette, Calendar, Building2, Link2, Upload, Image, X } from 'lucide-react';

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
  tenantId?: number;
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
              <OrganizationLogoSettings />
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
              <CardTitle>Organization Settings</CardTitle>
              <CardDescription>Manage organization-wide settings and email templates</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Organization Email Templates */}
              <OrganizationEmailTemplates />
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

// Add new component for organization logo settings
function OrganizationLogoSettings() {
  const [dragActive, setDragActive] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get current user to get tenantId
  const { data: user } = useQuery<UserProfile>({
    queryKey: ['/api/user'],
  });

  // Fetch current organization logo
  const { data: currentLogo, isLoading } = useQuery({
    queryKey: ['/api/admin/organizations', user?.tenantId, 'logo'],
    queryFn: async () => {
      if (!user?.tenantId) return null;
      const response = await fetch(`/api/admin/organizations/${user.tenantId}/logo`);
      if (!response.ok) return null;
      return response.json();
    },
    enabled: !!user?.tenantId,
  });

  // Upload logo mutation
  const uploadLogoMutation = useMutation({
    mutationFn: async (logoData: string) => {
      if (!user?.tenantId) throw new Error('User tenant ID required');
      
      const response = await fetch(`/api/admin/organizations/${user.tenantId}/logo`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ logoData }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to upload logo');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Logo updated',
        description: 'Your organization logo has been updated successfully.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/organizations', user?.tenantId, 'logo'] });
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
      setLogoFile(null);
      setLogoPreview(null);
    },
    onError: () => {
      toast({
        title: 'Upload failed',
        description: 'Failed to upload logo. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (file: File) => {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Invalid file type',
        description: 'Please select an image file (PNG, JPG, etc.)',
        variant: 'destructive',
      });
      return;
    }

    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'Please select an image file smaller than 5MB',
        variant: 'destructive',
      });
      return;
    }

    setLogoFile(file);
    
    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setLogoPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUpload = () => {
    if (logoPreview) {
      uploadLogoMutation.mutate(logoPreview);
    }
  };

  const handleRemovePreview = () => {
    setLogoFile(null);
    setLogoPreview(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-4">Organization Logo</h3>
        <p className="text-sm text-muted-foreground mb-6">
          Upload your organization's logo to personalize your workspace and booking pages. 
          Recommended size: 200x200px or larger. Supported formats: PNG, JPG, WebP.
        </p>

        {/* Current Logo Display */}
        {currentLogo?.logo && (
          <div className="mb-6">
            <Label className="text-sm font-medium mb-2 block">Current Logo</Label>
            <div className="w-32 h-32 border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
              <img 
                src={currentLogo.logo} 
                alt="Current organization logo"
                className="w-full h-full object-contain"
              />
            </div>
          </div>
        )}

        {/* Logo Upload Area */}
        <div className="space-y-4">
          <Label className="text-sm font-medium">Upload New Logo</Label>
          
          {/* Preview Area */}
          {logoPreview && (
            <div className="mb-4">
              <Label className="text-sm font-medium mb-2 block">Preview</Label>
              <div className="relative inline-block">
                <div className="w-32 h-32 border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
                  <img 
                    src={logoPreview} 
                    alt="Logo preview"
                    className="w-full h-full object-contain"
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="absolute -top-2 -right-2 h-6 w-6 p-0 rounded-full"
                  onClick={handleRemovePreview}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>
          )}

          {/* Upload Drop Zone */}
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragActive 
                ? 'border-primary bg-primary/5' 
                : 'border-gray-300 hover:border-gray-400'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <div className="space-y-4">
              <div className="mx-auto w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                {dragActive ? (
                  <Upload className="h-6 w-6 text-primary" />
                ) : (
                  <Image className="h-6 w-6 text-gray-400" />
                )}
              </div>
              
              <div>
                <p className="text-sm font-medium">
                  {dragActive ? 'Drop your logo here' : 'Drag and drop your logo here'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  PNG, JPG, WebP up to 5MB
                </p>
              </div>
              
              <div className="space-y-2">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileInput}
                  className="hidden"
                  id="logo-upload"
                />
                <Label htmlFor="logo-upload">
                  <Button variant="outline" className="cursor-pointer" asChild>
                    <span>Choose File</span>
                  </Button>
                </Label>
              </div>
            </div>
          </div>

          {/* Upload Actions */}
          {logoPreview && (
            <div className="flex gap-2">
              <Button 
                onClick={handleUpload}
                disabled={uploadLogoMutation.isPending}
                className="bg-green-600 hover:bg-green-700"
              >
                {uploadLogoMutation.isPending ? 'Uploading...' : 'Upload Logo'}
              </Button>
              <Button 
                variant="outline" 
                onClick={handleRemovePreview}
                disabled={uploadLogoMutation.isPending}
              >
                Cancel
              </Button>
            </div>
          )}
        </div>

        {/* Info Box */}
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start">
            <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-blue-900 mb-1">Logo Usage</p>
              <p className="text-blue-700">
                Your logo will appear in the top navigation, booking pages, and email communications. 
                For best results, use a square logo with a transparent background.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Add new component for organization email templates
function OrganizationEmailTemplates() {
  const [settings, setSettings] = useState<any>(null);
  const [activeTemplate, setActiveTemplate] = useState('confirmation');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch organization settings
  const { data: orgSettings, isLoading: settingsLoading } = useQuery({
    queryKey: ['/api/organizations/settings'],
  });

  // Update organization settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('PUT', '/api/organizations/settings', data);
      if (!response.ok) {
        throw new Error('Failed to update organization settings');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Settings updated',
        description: 'Organization email templates have been updated successfully.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/organizations/settings'] });
    },
    onError: () => {
      toast({
        title: 'Update failed',
        description: 'Failed to update organization settings. Please try again.',
        variant: 'destructive',
      });
    },
  });

  // Initialize settings when data loads
  useEffect(() => {
    if (orgSettings && !settings) {
      setSettings(orgSettings);
    }
  }, [orgSettings, settings]);

  const handleTemplateUpdate = (templateType: string, field: string, value: any) => {
    setSettings((prev: any) => ({
      ...prev,
      emailTemplates: {
        ...prev.emailTemplates,
        [templateType]: {
          ...prev.emailTemplates[templateType],
          [field]: value
        }
      }
    }));
  };

  const handleSaveSettings = () => {
    if (settings) {
      updateSettingsMutation.mutate(settings);
    }
  };

  if (settingsLoading || !settings) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
          <div className="h-20 bg-gray-200 rounded mb-4"></div>
        </div>
      </div>
    );
  }

  const templateTypes = [
    { key: 'confirmation', label: 'Confirmation Emails', description: 'Sent when appointments are confirmed' },
    { key: 'reminder', label: 'Reminder Emails', description: 'Sent before appointments' },
    { key: 'reschedule', label: 'Reschedule Emails', description: 'Sent when appointments are rescheduled' },
    { key: 'cancellation', label: 'Cancellation Emails', description: 'Sent when appointments are cancelled' },
    { key: 'checkout', label: 'Checkout Emails', description: 'Sent when appointments are completed' }
  ];

  const currentTemplate = settings.emailTemplates[activeTemplate] || {};

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-4">Email Template Customization</h3>
        <p className="text-sm text-muted-foreground mb-6">
          Customize the email templates sent to drivers and customers. You can use variables like {`{{confirmationCode}}`}, {`{{facilityName}}`}, and {`{{customerName}}`} in your templates.
        </p>
        
        {/* Template Type Selector */}
        <div className="mb-6">
          <Label className="text-sm font-medium">Select Template Type</Label>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 mt-2">
            {templateTypes.map((type) => (
              <Button
                key={type.key}
                variant={activeTemplate === type.key ? "default" : "outline"}
                onClick={() => setActiveTemplate(type.key)}
                className="h-auto p-3 text-left justify-start"
              >
                <div>
                  <div className="font-medium">{type.label}</div>
                  <div className="text-xs text-muted-foreground">{type.description}</div>
                </div>
              </Button>
            ))}
          </div>
        </div>

        {/* Template Editor */}
        <div className="space-y-4 border rounded-lg p-4">
          <h4 className="font-medium">{templateTypes.find(t => t.key === activeTemplate)?.label} Template</h4>
          
          {/* Subject Line */}
          <div className="space-y-2">
            <Label htmlFor={`${activeTemplate}-subject`}>Email Subject</Label>
            <Input
              id={`${activeTemplate}-subject`}
              value={currentTemplate.subject || ''}
              onChange={(e) => handleTemplateUpdate(activeTemplate, 'subject', e.target.value)}
              placeholder="Enter email subject line..."
              className="w-full"
            />
                         <p className="text-xs text-muted-foreground">
               Use {`{{confirmationCode}}`} for confirmation codes, {`{{facilityName}}`} for facility names
             </p>
          </div>

          {/* Header Text */}
          <div className="space-y-2">
            <Label htmlFor={`${activeTemplate}-header`}>Header Message</Label>
            <textarea
              id={`${activeTemplate}-header`}
              value={currentTemplate.headerText || ''}
              onChange={(e) => handleTemplateUpdate(activeTemplate, 'headerText', e.target.value)}
              placeholder="Enter the main message that appears at the top of the email..."
              className="w-full h-20 px-3 py-2 border border-input bg-background text-sm ring-offset-background resize-none rounded-md"
            />
          </div>

          {/* Footer Text */}
          <div className="space-y-2">
            <Label htmlFor={`${activeTemplate}-footer`}>Footer Message</Label>
            <textarea
              id={`${activeTemplate}-footer`}
              value={currentTemplate.footerText || ''}
              onChange={(e) => handleTemplateUpdate(activeTemplate, 'footerText', e.target.value)}
              placeholder="Enter text that appears at the bottom of the email..."
              className="w-full h-16 px-3 py-2 border border-input bg-background text-sm ring-offset-background resize-none rounded-md"
            />
          </div>

          {/* Template-specific options */}
          {activeTemplate === 'confirmation' && (
            <div className="space-y-3 pt-2 border-t">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="includeQrCode"
                    checked={currentTemplate.includeQrCode !== false}
                    onCheckedChange={(checked) => handleTemplateUpdate(activeTemplate, 'includeQrCode', checked)}
                  />
                  <Label htmlFor="includeQrCode">Include QR Code for check-in</Label>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="includeCalendarAttachment"
                    checked={currentTemplate.includeCalendarAttachment !== false}
                    onCheckedChange={(checked) => handleTemplateUpdate(activeTemplate, 'includeCalendarAttachment', checked)}
                  />
                  <Label htmlFor="includeCalendarAttachment">Include calendar attachment (.ics file)</Label>
                </div>
              </div>
            </div>
          )}

          {activeTemplate === 'reminder' && (
            <div className="space-y-3 pt-2 border-t">
              <div className="space-y-2">
                <Label htmlFor="hoursBeforeReminder">Send reminder (hours before appointment)</Label>
                <Input
                  id="hoursBeforeReminder"
                  type="number"
                  min="1"
                  max="168"
                  value={currentTemplate.hoursBeforeReminder || 24}
                  onChange={(e) => handleTemplateUpdate(activeTemplate, 'hoursBeforeReminder', parseInt(e.target.value))}
                  className="w-32"
                />
              </div>
            </div>
          )}

          {activeTemplate === 'checkout' && (
            <div className="space-y-3 pt-2 border-t">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="includeReleaseNotes"
                    checked={currentTemplate.includeReleaseNotes !== false}
                    onCheckedChange={(checked) => handleTemplateUpdate(activeTemplate, 'includeReleaseNotes', checked)}
                  />
                  <Label htmlFor="includeReleaseNotes">Include release notes in email</Label>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="includeReleaseImages"
                    checked={currentTemplate.includeReleaseImages !== false}
                    onCheckedChange={(checked) => handleTemplateUpdate(activeTemplate, 'includeReleaseImages', checked)}
                  />
                  <Label htmlFor="includeReleaseImages">Include release images in email</Label>
                </div>
              </div>
            </div>
          )}
        </div>

                 {/* Available Variables Reference */}
         <div className="mt-6 p-4 bg-gray-50 rounded-lg">
           <h5 className="font-medium mb-2">Available Template Variables</h5>
           <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
             <code>{`{{confirmationCode}}`}</code>
             <code>{`{{facilityName}}`}</code>
             <code>{`{{customerName}}`}</code>
             <code>{`{{driverName}}`}</code>
             <code>{`{{appointmentDate}}`}</code>
             <code>{`{{appointmentTime}}`}</code>
             <code>{`{{dockName}}`}</code>
             <code>{`{{carrierName}}`}</code>
             <code>{`{{truckNumber}}`}</code>
           </div>
         </div>

        {/* Save Button */}
        <div className="flex justify-end pt-4">
          <Button 
            onClick={handleSaveSettings}
            disabled={updateSettingsMutation.isPending}
            className="bg-green-600 hover:bg-green-700"
          >
            {updateSettingsMutation.isPending ? 'Saving...' : 'Save Email Templates'}
          </Button>
        </div>
      </div>
    </div>
  );
}