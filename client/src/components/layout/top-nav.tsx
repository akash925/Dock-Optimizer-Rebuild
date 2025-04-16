import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { 
  Bell, 
  Search, 
  Menu, 
  LogOut, 
  User as UserIcon, 
  Settings,
  ChevronDown,
  Calendar,
  Copy,
  ExternalLink,
  Share2
} from "lucide-react";
import organizationLogo from "@/assets/organization_logo.jpeg";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
// Avatar import removed as no longer needed
import { Notification } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

export default function TopNav() {
  const { user, logoutMutation } = useAuth();
  const { toast } = useToast();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [orgLogo, setOrgLogo] = useState<string | null>(null);

  // Load organization logo from localStorage
  useEffect(() => {
    const savedLogo = localStorage.getItem('organizationLogo');
    if (savedLogo) {
      setOrgLogo(savedLogo);
    }
  }, []);
  
  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
    enabled: !!user,
  });
  
  // Count unread notifications
  const unreadCount = notifications.filter(n => !n.isRead).length;
  
  if (!user) return null;

  const handleLogout = () => {
    logoutMutation.mutate();
  };
  
  const copyExternalBookingLink = () => {
    const url = `${window.location.origin}/external-booking`;
    navigator.clipboard.writeText(url);
    toast({
      title: "Link Copied",
      description: "External booking link has been copied to clipboard",
    });
  };

  return (
    <header className="bg-white shadow-sm h-16 flex items-center justify-between px-4 sticky top-0 z-40">
      <div className="flex items-center gap-2">
        {/* Logo is now in sidebar only */}
      </div>
      
      <div className="flex-1 max-w-md mx-auto px-4">
        <div className="relative w-full">
          <Input
            type="text"
            placeholder="Search appointments..."
            className="w-full pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <Search className="h-4 w-4 text-neutral-500 absolute left-3 top-1/2 transform -translate-y-1/2" />
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="hidden md:flex">
              <Calendar className="h-5 w-5 text-neutral-500" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <div className="text-sm font-medium px-2 py-1.5 text-neutral-500">
              External Booking
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={copyExternalBookingLink}>
              <Copy className="mr-2 h-4 w-4" />
              <span>Copy Link</span>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/external-booking" className="flex items-center cursor-pointer">
                <ExternalLink className="mr-2 h-4 w-4" />
                <span>Visit Page</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => {
              if (navigator.share) {
                navigator.share({
                  title: "Dock Optimizer External Booking",
                  url: `${window.location.origin}/external-booking`
                });
              } else {
                copyExternalBookingLink();
              }
            }}>
              <Share2 className="mr-2 h-4 w-4" />
              <span>Share</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        
        <Sheet open={notificationsOpen} onOpenChange={setNotificationsOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5 text-neutral-500" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="right">
            <div className="py-4">
              <h2 className="text-lg font-semibold mb-4">Notifications</h2>
              
              {notifications.length === 0 ? (
                <div className="text-neutral-400 text-center py-6">
                  No notifications
                </div>
              ) : (
                <div className="space-y-3">
                  {notifications.map((notification) => (
                    <div 
                      key={notification.id} 
                      className={`p-3 border rounded-md ${notification.isRead ? 'border-neutral-200' : 'border-primary bg-primary/5'}`}
                    >
                      <div className="font-medium">{notification.title}</div>
                      <div className="text-sm text-neutral-600 mt-1">
                        {notification.message}
                      </div>
                      <div className="text-xs text-neutral-400 mt-2">
                        {new Date(notification.createdAt).toLocaleTimeString()} · {new Date(notification.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </SheetContent>
        </Sheet>
        
        {/* Organization logo */}
        <img 
          src={orgLogo || organizationLogo} 
          alt="Organization Logo" 
          className="h-8 w-auto mr-2 hidden md:block" 
        />
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-2">
              <span className="text-sm font-medium">
                {user.firstName} {user.lastName}
              </span>
              <ChevronDown className="h-4 w-4 text-neutral-400" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <div className="px-3 py-2">
              <div className="text-sm font-medium">{user.firstName} {user.lastName}</div>
              <div className="text-xs text-neutral-500">{user.email}</div>
              <div className="text-xs text-neutral-400 mt-1 capitalize">{user.role} role</div>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/profile" className="flex items-center cursor-pointer">
                <UserIcon className="mr-2 h-4 w-4" />
                <span>Profile</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/settings" className="flex items-center cursor-pointer">
                <Settings className="mr-2 h-4 w-4" />
                <span>Settings</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-red-500">
              <LogOut className="mr-2 h-4 w-4" />
              <span>Logout</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
