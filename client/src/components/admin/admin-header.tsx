import React from 'react';
import { Link, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { PlusCircle, Home, Settings, Users, Grid, Package } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';

export const AdminHeader = () => {
  const [location] = useLocation();
  const { user } = useAuth();

  if (!user || user.role !== 'super-admin') {
    return null;
  }

  return (
    <div className="border-b pb-4 mb-6">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Admin Console</h1>
          <p className="text-muted-foreground mt-1">
            Manage organizations, users, and system settings
          </p>
        </div>
        <div>
          <Button asChild variant="default">
            <Link href="/admin/orgs/new">
              <PlusCircle className="h-4 w-4 mr-2" />
              New Organization
            </Link>
          </Button>
        </div>
      </div>

      <nav className="flex items-center space-x-6 text-sm font-medium">
        <Link 
          href="/admin" 
          className={`flex items-center transition-colors hover:text-primary ${
            location === '/admin' ? 'text-primary font-semibold' : 'text-muted-foreground'
          }`}
        >
          <Home className="h-4 w-4 mr-1" />
          Dashboard
        </Link>
        <Link 
          href="/admin/orgs" 
          className={`flex items-center transition-colors hover:text-primary ${
            location.startsWith('/admin/orgs') ? 'text-primary font-semibold' : 'text-muted-foreground'
          }`}
        >
          <Grid className="h-4 w-4 mr-1" />
          Organizations
        </Link>
        <Link 
          href="/admin/users" 
          className={`flex items-center transition-colors hover:text-primary ${
            location.startsWith('/admin/users') ? 'text-primary font-semibold' : 'text-muted-foreground'
          }`}
        >
          <Users className="h-4 w-4 mr-1" />
          Users
        </Link>
        <Link 
          href="/admin/modules" 
          className={`flex items-center transition-colors hover:text-primary ${
            location.startsWith('/admin/modules') ? 'text-primary font-semibold' : 'text-muted-foreground'
          }`}
        >
          <Package className="h-4 w-4 mr-1" />
          Modules
        </Link>
        <Link 
          href="/admin/settings" 
          className={`flex items-center transition-colors hover:text-primary ${
            location.startsWith('/admin/settings') ? 'text-primary font-semibold' : 'text-muted-foreground'
          }`}
        >
          <Settings className="h-4 w-4 mr-1" />
          Settings
        </Link>
      </nav>
    </div>
  );
};