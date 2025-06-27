import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Bell, Check, CheckCheck, X, Filter, Archive, Trash2, Clock, AlertTriangle, Info, Calendar, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';

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
    actionRequired?: boolean;
    category?: string;
  };
}

interface NotificationGroup {
  type: string;
  label: string;
  icon: React.ReactNode;
  count: number;
  urgentCount: number;
  notifications: EnhancedNotification[];
  color: string;
}

interface NotificationFilters {
  urgency: string[];
  type: string[];
  read: 'all' | 'read' | 'unread';
  dateRange: 'today' | 'week' | 'month' | 'all';
}

export default function EnhancedNotificationBell() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());
  const [activeTab, setActiveTab] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<NotificationFilters>({
    urgency: [],
    type: [],
    read: 'all',
    dateRange: 'all',
  });

  // Fetch notifications with enhanced data
  const { data: notifications = [], isLoading, error } = useQuery<EnhancedNotification[]>({
    queryKey: ['/api/notifications/enhanced'],
    queryFn: async () => {
      const response = await fetch('/api/notifications/enhanced');
      if (!response.ok) throw new Error('Failed to fetch notifications');
      return response.json();
    },
    refetchInterval: 15000, // Refetch every 15 seconds for real-time updates
    refetchOnWindowFocus: true,
  });

  // Mark notification as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: async (notificationIds: (string | number)[]) => {
      const response = await apiRequest('PUT', '/api/notifications/mark-read', {
        notificationIds,
      });
      if (!response.ok) throw new Error('Failed to mark notifications as read');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/enhanced'] });
      setSelectedIds(new Set());
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mark all as read mutation
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('PUT', '/api/notifications/mark-all-read');
      if (!response.ok) throw new Error('Failed to mark all notifications as read');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/enhanced'] });
      toast({
        title: "Success",
        description: "All notifications marked as read",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete notifications mutation
  const deleteNotificationsMutation = useMutation({
    mutationFn: async (notificationIds: (string | number)[]) => {
      const response = await apiRequest('DELETE', '/api/notifications', {
        notificationIds,
      });
      if (!response.ok) throw new Error('Failed to delete notifications');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/enhanced'] });
      setSelectedIds(new Set());
      toast({
        title: "Success",
        description: "Notifications deleted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Filter and group notifications
  const { filteredNotifications, notificationGroups, totalUnread, urgentCount } = useMemo(() => {
    let filtered = [...notifications];

    // Apply filters
    if (filters.urgency.length > 0) {
      filtered = filtered.filter(n => n.urgency && filters.urgency.includes(n.urgency));
    }

    if (filters.type.length > 0) {
      filtered = filtered.filter(n => filters.type.includes(n.type));
    }

    if (filters.read !== 'all') {
      filtered = filtered.filter(n => filters.read === 'read' ? n.isRead : !n.isRead);
    }

    if (filters.dateRange !== 'all') {
      const now = new Date();
      const cutoff = new Date();
      
      switch (filters.dateRange) {
        case 'today':
          cutoff.setHours(0, 0, 0, 0);
          break;
        case 'week':
          cutoff.setDate(now.getDate() - 7);
          break;
        case 'month':
          cutoff.setMonth(now.getMonth() - 1);
          break;
      }
      
      filtered = filtered.filter(n => new Date(n.createdAt) >= cutoff);
    }

    // Group notifications by type
    const groups: Record<string, NotificationGroup> = {};
    
    filtered.forEach(notification => {
      const type = notification.type;
      
      if (!groups[type]) {
        let label = type.charAt(0).toUpperCase() + type.slice(1).replace(/[_-]/g, ' ');
        let icon = <Info className="h-4 w-4" />;
        let color = 'blue';

        switch (type) {
          case 'appointment':
          case 'schedule-change':
            label = 'Appointments';
            icon = <Calendar className="h-4 w-4" />;
            color = 'green';
            break;
          case 'delay':
          case 'urgent':
            label = 'Urgent Updates';
            icon = <AlertTriangle className="h-4 w-4" />;
            color = 'red';
            break;
          case 'upcoming-arrival':
            label = 'Arrivals';
            icon = <Clock className="h-4 w-4" />;
            color = 'yellow';
            break;
          case 'system':
            label = 'System';
            icon = <Info className="h-4 w-4" />;
            color = 'gray';
            break;
        }

        groups[type] = {
          type,
          label,
          icon,
          count: 0,
          urgentCount: 0,
          notifications: [],
          color,
        };
      }

      groups[type].notifications.push(notification);
      groups[type].count++;
      
      if (['critical', 'urgent'].includes(notification.urgency || '')) {
        groups[type].urgentCount++;
      }
    });

    const groupArray = Object.values(groups).sort((a, b) => {
      // Sort by urgency first, then by count
      if (a.urgentCount !== b.urgentCount) {
        return b.urgentCount - a.urgentCount;
      }
      return b.count - a.count;
    });

    const totalUnread = filtered.filter(n => !n.isRead).length;
    const urgentCount = filtered.filter(n => ['critical', 'urgent'].includes(n.urgency || '') && !n.isRead).length;

    return {
      filteredNotifications: filtered,
      notificationGroups: groupArray,
      totalUnread,
      urgentCount,
    };
  }, [notifications, filters]);

  // Get urgency styling
  const getUrgencyStyle = useCallback((urgency?: string) => {
    switch (urgency) {
      case 'critical':
        return 'border-red-500 bg-red-50 shadow-red-100';
      case 'urgent':
        return 'border-orange-500 bg-orange-50 shadow-orange-100';
      case 'warning':
        return 'border-yellow-500 bg-yellow-50 shadow-yellow-100';
      case 'info':
        return 'border-blue-500 bg-blue-50 shadow-blue-100';
      default:
        return 'border-gray-200 bg-white';
    }
  }, []);

  // Get urgency icon
  const getUrgencyIcon = useCallback((urgency?: string) => {
    switch (urgency) {
      case 'critical':
        return <AlertTriangle className="h-3 w-3 text-red-600" />;
      case 'urgent':
        return <AlertTriangle className="h-3 w-3 text-orange-600" />;
      case 'warning':
        return <AlertTriangle className="h-3 w-3 text-yellow-600" />;
      case 'info':
        return <Info className="h-3 w-3 text-blue-600" />;
      default:
        return null;
    }
  }, []);

  // Handle notification selection
  const handleNotificationSelect = useCallback((id: string | number, checked: boolean) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(id);
      } else {
        newSet.delete(id);
      }
      return newSet;
    });
  }, []);

  // Handle select all in current view
  const handleSelectAll = useCallback(() => {
    const visibleNotifications = activeTab === 'all' 
      ? filteredNotifications 
      : notificationGroups.find(g => g.type === activeTab)?.notifications || [];
    
    setSelectedIds(new Set(visibleNotifications.map(n => n.id)));
  }, [activeTab, filteredNotifications, notificationGroups]);

  // Handle batch actions
  const handleBatchMarkAsRead = useCallback(() => {
    if (selectedIds.size > 0) {
      markAsReadMutation.mutate(Array.from(selectedIds));
    }
  }, [selectedIds, markAsReadMutation]);

  const handleBatchDelete = useCallback(() => {
    if (selectedIds.size > 0) {
      deleteNotificationsMutation.mutate(Array.from(selectedIds));
    }
  }, [selectedIds, deleteNotificationsMutation]);

  // Render notification item
  const renderNotification = useCallback((notification: EnhancedNotification) => {
    const timeAgo = formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true });
    const isSelected = selectedIds.has(notification.id);
    
    return (
      <div
        key={notification.id}
        className={`p-3 border rounded-lg transition-all hover:shadow-md ${
          notification.isRead ? 'bg-gray-50 opacity-80' : getUrgencyStyle(notification.urgency)
        } ${isSelected ? 'ring-2 ring-blue-500' : ''}`}
      >
        <div className="flex items-start gap-3">
          <Checkbox
            checked={isSelected}
            onCheckedChange={(checked) => handleNotificationSelect(notification.id, !!checked)}
          />
          
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                {getUrgencyIcon(notification.urgency)}
                <span className={`font-medium text-sm ${notification.isRead ? 'text-gray-600' : 'text-gray-900'}`}>
                  {notification.title}
                </span>
                {!notification.isRead && (
                  <div className="w-2 h-2 bg-blue-500 rounded-full" />
                )}
              </div>
              <span className="text-xs text-gray-500 whitespace-nowrap ml-2">
                {timeAgo}
              </span>
            </div>
            
            <p className={`text-sm mt-1 ${notification.isRead ? 'text-gray-500' : 'text-gray-700'}`}>
              {notification.message}
            </p>
            
            {notification.metadata && (
              <div className="mt-2 space-y-1">
                {notification.metadata.confirmationCode && (
                  <div className="text-xs font-mono text-gray-500">
                    #{notification.metadata.confirmationCode}
                  </div>
                )}
                
                {notification.metadata.customerName && (
                  <div className="text-xs text-gray-500">
                    Customer: {notification.metadata.customerName}
                  </div>
                )}
                
                {notification.metadata.timeUntil && (
                  <Badge variant="outline" className="text-xs">
                    {notification.metadata.timeUntil}
                  </Badge>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }, [selectedIds, getUrgencyStyle, getUrgencyIcon, handleNotificationSelect]);

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5 text-gray-600" />
          {urgentCount > 0 && (
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse" />
          )}
          {totalUnread > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-2 -right-2 h-5 w-5 p-0 text-xs flex items-center justify-center"
            >
              {totalUnread > 99 ? '99+' : totalUnread}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      
      <SheetContent side="right" className="w-96 sm:w-[540px] p-0">
        <SheetHeader className="p-4 border-b">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notifications
              {totalUnread > 0 && (
                <Badge variant="secondary">{totalUnread} unread</Badge>
              )}
            </SheetTitle>
            
            <div className="flex items-center gap-2">
              {/* Filters Toggle */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                className={showFilters ? 'bg-gray-100' : ''}
              >
                <Filter className="h-4 w-4" />
              </Button>
              
              {/* Batch Actions */}
              {selectedIds.size > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      Actions ({selectedIds.size})
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={handleBatchMarkAsRead}>
                      <Check className="h-4 w-4 mr-2" />
                      Mark as Read
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={handleBatchDelete}
                      className="text-red-600"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              
              {/* Mark All Read */}
              {totalUnread > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => markAllAsReadMutation.mutate()}
                  disabled={markAllAsReadMutation.isPending}
                >
                  {markAllAsReadMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCheck className="h-4 w-4" />
                  )}
                </Button>
              )}
            </div>
          </div>
          
          {/* Filters Panel */}
          {showFilters && (
            <div className="pt-4 space-y-3 border-t">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-700">Urgency</label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {['critical', 'urgent', 'warning', 'info', 'normal'].map(urgency => (
                      <Button
                        key={urgency}
                        variant={filters.urgency.includes(urgency) ? 'default' : 'outline'}
                        size="sm"
                        className="text-xs h-6"
                        onClick={() => {
                          setFilters(prev => ({
                            ...prev,
                            urgency: prev.urgency.includes(urgency)
                              ? prev.urgency.filter(u => u !== urgency)
                              : [...prev.urgency, urgency]
                          }));
                        }}
                      >
                        {urgency}
                      </Button>
                    ))}
                  </div>
                </div>
                
                <div>
                  <label className="text-xs font-medium text-gray-700">Status</label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {['all', 'unread', 'read'].map(status => (
                      <Button
                        key={status}
                        variant={filters.read === status ? 'default' : 'outline'}
                        size="sm"
                        className="text-xs h-6"
                        onClick={() => setFilters(prev => ({ ...prev, read: status as any }))}
                      >
                        {status}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </SheetHeader>
        
        <div className="flex-1 flex flex-col">
          {/* Tabs for notification groups */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
            <TabsList className="grid grid-cols-auto w-full p-1 m-2">
              <TabsTrigger value="all" className="flex items-center gap-2">
                All
                {totalUnread > 0 && (
                  <Badge variant="secondary" className="h-4 text-xs">
                    {totalUnread}
                  </Badge>
                )}
              </TabsTrigger>
              
              {notificationGroups.slice(0, 3).map(group => (
                <TabsTrigger 
                  key={group.type} 
                  value={group.type}
                  className="flex items-center gap-2"
                >
                  {group.icon}
                  <span className="hidden sm:inline">{group.label}</span>
                  {group.count > 0 && (
                    <Badge 
                      variant={group.urgentCount > 0 ? 'destructive' : 'secondary'}
                      className="h-4 text-xs"
                    >
                      {group.count}
                    </Badge>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>
            
            <div className="flex-1 overflow-hidden">
              <ScrollArea className="h-full">
                <TabsContent value="all" className="p-4 space-y-3 mt-0">
                  {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  ) : filteredNotifications.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No notifications found</p>
                    </div>
                  ) : (
                    <>
                      {filteredNotifications.length > 0 && (
                        <div className="flex items-center justify-between mb-4">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleSelectAll}
                          >
                            Select All ({filteredNotifications.length})
                          </Button>
                        </div>
                      )}
                      {filteredNotifications.map(renderNotification)}
                    </>
                  )}
                </TabsContent>
                
                {notificationGroups.map(group => (
                  <TabsContent 
                    key={group.type} 
                    value={group.type} 
                    className="p-4 space-y-3 mt-0"
                  >
                    {group.notifications.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        {group.icon}
                        <p className="mt-2">No {group.label.toLowerCase()} notifications</p>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between mb-4">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedIds(new Set(group.notifications.map(n => n.id)))}
                          >
                            Select All ({group.notifications.length})
                          </Button>
                        </div>
                        {group.notifications.map(renderNotification)}
                      </>
                    )}
                  </TabsContent>
                ))}
              </ScrollArea>
            </div>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
} 