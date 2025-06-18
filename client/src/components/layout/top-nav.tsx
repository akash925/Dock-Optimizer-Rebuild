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
import { BarcodeScanButton } from "@/components/company-assets/barcode-scan-button";
import { WebSocketStatus } from "@/components/shared/websocket-status";
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

// Enhanced notification type for UI
interface EnhancedNotification {
  id: string | number;
  userId?: number;
  title: string;
  message: string;
  isRead: boolean;
  type: string;
  urgency?: 'critical' | 'urgent' | 'warning' | 'info' | 'normal';
  appointmentId?: number;
  startTime?: Date;
  status?: string;
  facilityId?: number;
  createdAt: Date;
  relatedScheduleId?: number | null;
  metadata?: {
    confirmationCode?: string;
    truckNumber?: string;
    customerName?: string;
    driverName?: string;
    driverPhone?: string;
    timeUntil?: string;
    urgency?: string;
    backgroundColor?: string;
  };
}

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
  
  // Enhanced notifications with live updates
  const { data: notifications = [] } = useQuery<EnhancedNotification[]>({
    queryKey: ["/api/notifications"],
    enabled: !!user,
    refetchInterval: 30000, // Refetch every 30 seconds for live updates
    refetchOnWindowFocus: true,
  });
  
  // Count urgent notifications (critical and urgent priority)
  const urgentCount = notifications.filter((n: EnhancedNotification) => 
    (n.urgency === 'critical' || n.urgency === 'urgent') && !n.isRead
  ).length;
  
  // Count total unread notifications
  const unreadCount = notifications.filter((n: EnhancedNotification) => !n.isRead).length;
  
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
          {/* WebSocket status indicator */}
          <div className="mr-2 hidden md:block">
            <WebSocketStatus />
          </div>
          
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
                <DropdownMenuRadioGroup value={selectedBookingPage || undefined} onValueChange={setSelectedBookingPage}>
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
              {urgentCount > 0 && (
                <span className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full animate-pulse" />
              )}
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-96">
            <div className="py-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Notifications</h2>
                {unreadCount > 0 && (
                  <span className="text-xs text-neutral-500">
                    {unreadCount} unread
                  </span>
                )}
              </div>
              
              {notifications.length === 0 ? (
                <div className="text-neutral-400 text-center py-6">
                  <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No notifications</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[calc(100vh-120px)] overflow-y-auto">
                  {notifications.map((notification: EnhancedNotification) => {
                    const isAppointment = notification.type === 'appointment';
                    const urgencyColors = {
                      critical: 'border-red-500 bg-red-50',
                      urgent: 'border-orange-500 bg-orange-50',
                      warning: 'border-yellow-500 bg-yellow-50',
                      info: 'border-blue-500 bg-blue-50',
                      normal: 'border-neutral-200 bg-white'
                    };
                    
                    const urgencyColor = urgencyColors[notification.urgency || 'normal'];
                    
                    return (
                      <div 
                        key={notification.id} 
                        className={`p-3 border rounded-md transition-all hover:shadow-sm ${
                          notification.isRead ? 'border-neutral-200 bg-neutral-50' : urgencyColor
                        }`}
                        style={notification.metadata?.backgroundColor ? {
                          backgroundColor: notification.metadata.backgroundColor
                        } : {}}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <div className="font-medium text-sm">{notification.title}</div>
                              {notification.urgency === 'critical' && (
                                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                              )}
                              {notification.urgency === 'urgent' && (
                                <span className="w-2 h-2 bg-orange-500 rounded-full" />
                              )}
                            </div>
                            
                            <div className="text-sm text-neutral-600 mt-1">
                              {notification.message}
                            </div>
                            
                            {isAppointment && notification.metadata && (
                              <div className="mt-2 space-y-1">
                                {notification.metadata.confirmationCode && (
                                  <div className="text-xs font-mono text-neutral-500">
                                    #{notification.metadata.confirmationCode}
                                  </div>
                                )}
                                {notification.metadata.driverName && (
                                  <div className="text-xs text-neutral-500">
                                    Driver: {notification.metadata.driverName}
                                  </div>
                                )}
                                {notification.metadata.driverPhone && (
                                  <div className="text-xs text-neutral-500">
                                    📞 {notification.metadata.driverPhone}
                                  </div>
                                )}
                              </div>
                            )}
                            
                            <div className="flex items-center justify-between mt-2">
                              <div className="text-xs text-neutral-400">
                                {new Date(notification.createdAt).toLocaleTimeString('en-US', {
                                  hour: 'numeric',
                                  minute: '2-digit',
                                  hour12: true
                                })} · {new Date(notification.createdAt).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric'
                                })}
                              </div>
                              
                              {isAppointment && notification.metadata?.timeUntil && (
                                <div className={`text-xs px-2 py-1 rounded-full ${
                                  notification.urgency === 'critical' ? 'bg-red-100 text-red-700' :
                                  notification.urgency === 'urgent' ? 'bg-orange-100 text-orange-700' :
                                  notification.urgency === 'warning' ? 'bg-yellow-100 text-yellow-700' :
                                  'bg-blue-100 text-blue-700'
                                }`}>
                                  {notification.metadata.timeUntil}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
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
