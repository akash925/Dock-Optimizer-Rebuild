import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { 
  Bell, 
  LogOut, 
  User as UserIcon, 
  Settings,
  ChevronDown,
  Calendar,
  Copy,
  ExternalLink,
  Share2,
  Globe,
  BookOpen,
  Scan
} from "lucide-react";
import { BarcodeScanButton } from "@/components/asset-manager/barcode-scan-button";
import organizationLogo from "@/assets/organization_logo.jpeg";
import { Button } from "@/components/ui/button";
import SearchBar from "@/components/search/search-bar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
// Avatar import removed as no longer needed
import { Notification, BookingPage } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

export default function TopNav() {
  const { user, logoutMutation } = useAuth();
  const { toast } = useToast();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [orgLogo, setOrgLogo] = useState<string | null>(null);
  const [selectedBookingPage, setSelectedBookingPage] = useState<string | null>(null);

  // Load organization logo from API
  const { data: logoData } = useQuery({
    queryKey: ['/api/admin/organizations', user?.tenantId, 'logo'],
    queryFn: async () => {
      if (!user?.tenantId) return null;
      console.log(`Fetching logo for tenant: ${user.tenantId}`);
      try {
        const res = await fetch(`/api/admin/organizations/${user.tenantId}/logo`);
        if (!res.ok) {
          console.error(`Failed to fetch organization logo: ${res.status}`);
          return null;
        }
        const data = await res.json();
        console.log(`Logo data received:`, data);
        return data;
      } catch (error) {
        console.error("Error loading logo:", error);
        return null;
      }
    },
    enabled: !!user?.tenantId,
    staleTime: 60000, // Cache logo for 1 minute
    refetchOnWindowFocus: false
  });
  
  // Update logo when data is fetched
  useEffect(() => {
    if (logoData?.logo) {
      console.log(`Setting org logo to: ${logoData.logo}`);
      setOrgLogo(logoData.logo);
    } else {
      console.log("No logo found in data, using default");
    }
  }, [logoData]);
  
  // Fetch booking pages
  const { data: bookingPages = [], isLoading: isLoadingBookingPages } = useQuery<BookingPage[]>({
    queryKey: ["/api/booking-pages"],
    enabled: !!user,
  });
  
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
  
  const copyBookingPageLink = (slug: string) => {
    const url = `${window.location.origin}/external/${slug}`;
    navigator.clipboard.writeText(url);
    toast({
      title: "Link Copied",
      description: "Booking page link has been copied to clipboard",
    });
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
        <SearchBar />
      </div>
      
      <div className="flex items-center gap-2">
        <div className="flex items-center">
          {/* Direct "Test Booking Page" link */}
          {bookingPages.length > 0 && (
            <Link href={`/external/${bookingPages[0].slug}`} className="hidden md:flex mr-2">
              <Button variant="outline" size="sm" className="flex items-center gap-1">
                <ExternalLink className="h-4 w-4" />
                <span>Test Booking Page</span>
              </Button>
            </Link>
          )}
          
          {/* Booking Pages dropdown for management */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="hidden md:flex">
                <Globe className="h-5 w-5 text-neutral-500" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Booking Pages</DropdownMenuLabel>
              <DropdownMenuSeparator />
              
              {bookingPages.length === 0 ? (
                <div className="px-2 py-1.5 text-sm text-neutral-500">
                  No booking pages found
                </div>
              ) : (
                <DropdownMenuRadioGroup value={selectedBookingPage} onValueChange={setSelectedBookingPage}>
                  {bookingPages.map(page => (
                    <DropdownMenuRadioItem key={page.id} value={page.slug}>
                      <div className="flex items-center justify-between w-full">
                        <span className="truncate">{page.name}</span>
                        {page.isActive ? (
                          <span className="ml-2 h-2 w-2 rounded-full bg-green-500" title="Active" />
                        ) : (
                          <span className="ml-2 h-2 w-2 rounded-full bg-gray-300" title="Inactive" />
                        )}
                      </div>
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              )}
              
              <DropdownMenuSeparator />
              
              {selectedBookingPage && (
                <>
                  <DropdownMenuItem onClick={() => copyBookingPageLink(selectedBookingPage)}>
                    <Copy className="mr-2 h-4 w-4" />
                    <span>Copy Link</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <a 
                      href={`/external/${selectedBookingPage}`} 
                      className="flex items-center cursor-pointer"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="mr-2 h-4 w-4" />
                      <span>Visit Page</span>
                    </a>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => {
                    if (navigator.share) {
                      navigator.share({
                        title: "Dock Optimizer Booking Page",
                        url: `${window.location.origin}/external/${selectedBookingPage}`
                      });
                    } else {
                      copyBookingPageLink(selectedBookingPage);
                    }
                  }}>
                    <Share2 className="mr-2 h-4 w-4" />
                    <span>Share</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              
              <DropdownMenuItem asChild>
                <Link href="/booking-pages" className="flex items-center cursor-pointer">
                  <BookOpen className="mr-2 h-4 w-4" />
                  <span>Manage Booking Pages</span>
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        
        {/* Barcode scanner button */}
        <BarcodeScanButton variant="ghost" size="icon" />

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
        {orgLogo ? (
          <img 
            src={orgLogo} 
            alt={user?.tenantId === 5 ? "Fresh Connect Logo" : "Hanzo Logistics Logo"} 
            className="h-8 w-auto mr-2 hidden md:block" 
            onError={(e) => {
              console.error("Failed to load logo:", e);
              e.currentTarget.style.display = 'none';
            }}
          />
        ) : (
          <div className="h-8 w-auto mr-2 hidden md:flex items-center">
            <span className="font-semibold text-lg text-primary">
              {user?.tenantId === 5 ? "Fresh Connect" : user?.tenantId === 2 ? "Hanzo Logistics" : "Dock Optimizer"}
            </span>
          </div>
        )}
        
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
