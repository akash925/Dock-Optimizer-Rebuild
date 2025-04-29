import React from 'react';
import { useLocation, Link as WouterLink } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { 
  ArrowLeftIcon,
  HomeIcon,
  LogOut,
  User
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';

export const AdminHeader = () => {
  const { user, logoutMutation } = useAuth();
  const [location, setLocation] = useLocation();

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        setLocation('/auth');
      }
    });
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase();
  };

  const userInitials = user?.firstName && user?.lastName 
    ? getInitials(`${user.firstName} ${user.lastName}`) 
    : 'U';

  return (
    <header className="flex items-center justify-between pb-4 border-b">
      <div className="flex items-center space-x-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setLocation('/')}
          className="mr-2"
        >
          <ArrowLeftIcon className="w-5 h-5" />
        </Button>
        
        <h1 className="text-2xl font-bold">Admin Console</h1>
        
        <div className="hidden ml-4 sm:flex sm:items-center sm:space-x-2">
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-8 gap-1"
            onClick={() => setLocation('/')}
          >
            <HomeIcon className="w-4 h-4" />
            Dashboard
          </Button>
        </div>
      </div>

      <div className="flex items-center space-x-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-8 w-8 rounded-full">
              <Avatar className="h-8 w-8">
                <AvatarFallback>{userInitials}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {user && (
              <div className="px-2 py-1.5">
                <p className="text-sm font-medium">{user.firstName} {user.lastName}</p>
                <p className="text-xs text-muted-foreground">{user.email}</p>
                <p className="mt-1 text-xs text-muted-foreground capitalize">Role: {user.role}</p>
              </div>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <WouterLink href="/profile" className="cursor-pointer">
                <User className="w-4 h-4 mr-2" />
                <span>Profile</span>
              </WouterLink>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-red-600 cursor-pointer">
              <LogOut className="w-4 h-4 mr-2" />
              <span>Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};