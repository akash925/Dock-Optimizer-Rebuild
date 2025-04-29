import React from 'react';
import { Link, useLocation } from 'wouter';
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Building2, 
  ChevronDown, 
  Users, 
  Settings, 
  Layers, 
  Package, 
  LogOut,
  BarChart4,
  MoveRight
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

export const AdminHeader = () => {
  const [location] = useLocation();
  const { user, logoutMutation } = useAuth();
  
  const handleLogout = () => {
    logoutMutation.mutate();
  };
  
  // Get user initials for avatar
  const getInitials = (): string => {
    if (!user) return '?';
    const firstName = user.firstName || '';
    const lastName = user.lastName || '';
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <div className="mr-4 flex">
          <Link 
            href="/admin" 
            className="mr-8 flex items-center space-x-2 font-bold"
          >
            <Layers className="h-5 w-5" />
            <span className="hidden sm:inline-block">Admin Console</span>
          </Link>
          
          <NavigationMenu>
            <NavigationMenuList>
              <NavigationMenuItem>
                <Link href="/admin">
                  <NavigationMenuLink
                    className={navigationMenuTriggerStyle()}
                    active={location === "/admin"}
                  >
                    Dashboard
                  </NavigationMenuLink>
                </Link>
              </NavigationMenuItem>
              
              <NavigationMenuItem>
                <NavigationMenuTrigger>
                  <div className="flex items-center">
                    <Building2 className="mr-2 h-4 w-4" />
                    Organizations
                  </div>
                </NavigationMenuTrigger>
                <NavigationMenuContent>
                  <ul className="grid w-[400px] gap-3 p-4 md:w-[500px] md:grid-cols-2 lg:w-[600px]">
                    <li className="row-span-3">
                      <Link href="/admin/orgs">
                        <NavigationMenuLink
                          className="flex h-full w-full select-none flex-col justify-end rounded-md bg-gradient-to-b from-muted/50 to-muted p-6 no-underline outline-none focus:shadow-md"
                        >
                          <Building2 className="h-6 w-6" />
                          <div className="mb-2 mt-4 text-lg font-medium">
                            Organizations
                          </div>
                          <p className="text-sm leading-tight text-muted-foreground">
                            Manage tenant organizations, their users, and enabled modules
                          </p>
                          <div className="mt-3 flex items-center text-sm text-primary">
                            View all organizations
                            <MoveRight className="ml-1 h-4 w-4" />
                          </div>
                        </NavigationMenuLink>
                      </Link>
                    </li>
                    <li>
                      <Link href="/admin/orgs/new">
                        <NavigationMenuLink className="group block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground">
                          <div className="text-sm font-medium leading-none">Create Organization</div>
                          <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">
                            Add a new tenant organization to the platform
                          </p>
                        </NavigationMenuLink>
                      </Link>
                    </li>
                    <li>
                      <Link href="/admin/modules">
                        <NavigationMenuLink className="group block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground">
                          <div className="text-sm font-medium leading-none">Module Management</div>
                          <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">
                            Configure which modules are available to organizations
                          </p>
                        </NavigationMenuLink>
                      </Link>
                    </li>
                    <li>
                      <Link href="/admin/users">
                        <NavigationMenuLink className="group block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground">
                          <div className="text-sm font-medium leading-none">User Management</div>
                          <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">
                            Manage user accounts across all organizations
                          </p>
                        </NavigationMenuLink>
                      </Link>
                    </li>
                  </ul>
                </NavigationMenuContent>
              </NavigationMenuItem>
              
              <NavigationMenuItem>
                <Link href="/admin/users">
                  <NavigationMenuLink 
                    className={navigationMenuTriggerStyle()}
                    active={location.startsWith("/admin/users")}
                  >
                    <div className="flex items-center">
                      <Users className="mr-2 h-4 w-4" />
                      Users
                    </div>
                  </NavigationMenuLink>
                </Link>
              </NavigationMenuItem>
              
              <NavigationMenuItem>
                <Link href="/admin/modules">
                  <NavigationMenuLink 
                    className={navigationMenuTriggerStyle()}
                    active={location.startsWith("/admin/modules")}
                  >
                    <div className="flex items-center">
                      <Package className="mr-2 h-4 w-4" />
                      Modules
                    </div>
                  </NavigationMenuLink>
                </Link>
              </NavigationMenuItem>
              
              <NavigationMenuItem>
                <Link href="/admin/analytics">
                  <NavigationMenuLink 
                    className={navigationMenuTriggerStyle()}
                    active={location.startsWith("/admin/analytics")}
                  >
                    <div className="flex items-center">
                      <BarChart4 className="mr-2 h-4 w-4" />
                      Analytics
                    </div>
                  </NavigationMenuLink>
                </Link>
              </NavigationMenuItem>
            </NavigationMenuList>
          </NavigationMenu>
        </div>
        
        <div className="ml-auto flex items-center">
          <Button 
            variant="ghost" 
            size="sm" 
            asChild 
            className="mr-2"
          >
            <Link href="/">
              Exit Admin
            </Link>
          </Button>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                <Avatar className="h-8 w-8">
                  <AvatarFallback>{getInitials()}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {user && (
                <div className="px-2 py-1.5 text-sm">
                  <div className="font-medium">{user.firstName} {user.lastName}</div>
                  <div className="text-xs text-muted-foreground">{user.email}</div>
                  <div className="mt-1 text-xs font-medium text-primary">{user.role || 'Super Admin'}</div>
                </div>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/admin/settings">
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
};