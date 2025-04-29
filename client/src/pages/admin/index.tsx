import React from 'react';
import { Link } from 'wouter';
import { 
  Building2, 
  Users, 
  Package, 
  Settings, 
  PlusCircle,
  RefreshCw,
  BarChart3,
  Globe,
  ListChecks
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { OrganizationsList } from '@/components/admin/organizations-list';
import { AdminHeader } from '@/components/admin/admin-header';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';

export default function AdminDashboardPage() {
  const { user } = useAuth();
  
  // Define stats type
  interface AdminStats {
    organizationsCount: number;
    usersCount: number;
    modulesCount: number;
    lastUpdated: Date;
  }
  
  // Fetch summary statistics
  const { data: stats, isLoading } = useQuery<AdminStats>({
    queryKey: ['/api/admin/stats'],
    retry: 1,
    refetchOnWindowFocus: false,
  });
  
  return (
    <div className="min-h-screen bg-muted/30">
      <AdminHeader />
      
      <main className="container py-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            {user ? `Welcome back, ${user.firstName}` : 'Welcome to the admin dashboard'}
          </p>
        </div>
        
        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Organizations
              </CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isLoading ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  stats?.organizationsCount || '0'
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Active tenant organizations
              </p>
            </CardContent>
            <CardFooter className="p-2">
              <Button variant="ghost" size="sm" className="w-full" asChild>
                <Link href="/admin/orgs">
                  <Building2 className="mr-2 h-4 w-4" />
                  View All
                </Link>
              </Button>
            </CardFooter>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Users
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isLoading ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  stats?.usersCount || '0'
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Across all tenant organizations
              </p>
            </CardContent>
            <CardFooter className="p-2">
              <Button variant="ghost" size="sm" className="w-full" asChild>
                <Link href="/admin/users">
                  <Users className="mr-2 h-4 w-4" />
                  View All
                </Link>
              </Button>
            </CardFooter>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Active Modules
              </CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isLoading ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  stats?.modulesCount || '0'
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Deployed platform modules
              </p>
            </CardContent>
            <CardFooter className="p-2">
              <Button variant="ghost" size="sm" className="w-full" asChild>
                <Link href="/admin/modules">
                  <Package className="mr-2 h-4 w-4" />
                  Configure
                </Link>
              </Button>
            </CardFooter>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                System Status
              </CardTitle>
              <Settings className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center">
                <div className="mr-2 h-3 w-3 rounded-full bg-green-500"></div>
                <div className="text-sm font-medium">Operational</div>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                All systems running normally
              </p>
            </CardContent>
            <CardFooter className="p-2">
              <Button variant="ghost" size="sm" className="w-full" asChild>
                <Link href="/admin/settings">
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </Link>
              </Button>
            </CardFooter>
          </Card>
        </div>
        
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8">
          <Card className="md:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Quick Actions</CardTitle>
                <CardDescription>Common administrative tasks</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Button variant="outline" className="h-auto p-4 justify-start" asChild>
                  <Link href="/admin/orgs/new">
                    <div className="flex flex-col items-start gap-1 text-left">
                      <div className="flex items-center text-primary">
                        <PlusCircle className="mr-2 h-5 w-5" />
                        <span className="font-semibold">New Organization</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        Create a new tenant organization
                      </span>
                    </div>
                  </Link>
                </Button>
                
                <Button variant="outline" className="h-auto p-4 justify-start" asChild>
                  <Link href="/admin/users/new">
                    <div className="flex flex-col items-start gap-1 text-left">
                      <div className="flex items-center text-primary">
                        <Users className="mr-2 h-5 w-5" />
                        <span className="font-semibold">Add User</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        Create a new user account
                      </span>
                    </div>
                  </Link>
                </Button>
                
                <Button variant="outline" className="h-auto p-4 justify-start" asChild>
                  <Link href="/admin/modules">
                    <div className="flex flex-col items-start gap-1 text-left">
                      <div className="flex items-center text-primary">
                        <Package className="mr-2 h-5 w-5" />
                        <span className="font-semibold">Manage Modules</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        Configure available modules
                      </span>
                    </div>
                  </Link>
                </Button>
                
                <Button variant="outline" className="h-auto p-4 justify-start" asChild>
                  <Link href="/admin/analytics">
                    <div className="flex flex-col items-start gap-1 text-left">
                      <div className="flex items-center text-primary">
                        <BarChart3 className="mr-2 h-5 w-5" />
                        <span className="font-semibold">Analytics</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        View platform usage metrics
                      </span>
                    </div>
                  </Link>
                </Button>
                
                <Button variant="outline" className="h-auto p-4 justify-start" asChild>
                  <Link href="/admin/settings">
                    <div className="flex flex-col items-start gap-1 text-left">
                      <div className="flex items-center text-primary">
                        <Globe className="mr-2 h-5 w-5" />
                        <span className="font-semibold">Global Settings</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        Configure platform settings
                      </span>
                    </div>
                  </Link>
                </Button>
                
                <Button variant="outline" className="h-auto p-4 justify-start" asChild>
                  <Link href="/admin/feature-flags">
                    <div className="flex flex-col items-start gap-1 text-left">
                      <div className="flex items-center text-primary">
                        <ListChecks className="mr-2 h-5 w-5" />
                        <span className="font-semibold">Feature Flags</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        Manage feature availability
                      </span>
                    </div>
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
          
          <Card className="col-span-1">
            <CardHeader>
              <CardTitle>System Information</CardTitle>
              <CardDescription>Platform details and version</CardDescription>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Platform Version:</span>
                <span className="font-medium">1.0.0</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Environment:</span>
                <span className="font-medium">Production</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">API Version:</span>
                <span className="font-medium">v1</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Last Update:</span>
                <span className="font-medium">Apr 29, 2025</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Database:</span>
                <span className="font-medium">PostgreSQL</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Storage:</span>
                <span className="font-medium">Cloud Storage</span>
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Organizations List */}
        <div className="mb-6">
          <OrganizationsList />
        </div>
      </main>
    </div>
  );
}