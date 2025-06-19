import { 
  BarChart3, 
  Calendar, 
  PackageOpen, 
  Building2, 
  DoorOpen, 
  Users, 
  Globe, 
  CalendarClock,
  Settings,
  Boxes
} from 'lucide-react';

export interface NavItem {
  key: string;
  label: string;
  path: string;
  icon: React.ElementType;
  roles?: string[];
  isAdmin?: boolean;
}

// Regular dashboard nav items
export const navItems: NavItem[] = [
  { 
    key: 'dashboard', 
    label: 'Dashboard', 
    path: '/', 
    icon: BarChart3,
  },
  { 
    key: 'calendar', 
    label: 'Calendar', 
    path: '/schedules', 
    icon: Calendar, 
  },
  { 
    key: 'appointments', 
    label: 'Appointments', 
    path: '/appointments', 
    icon: CalendarClock, 
  },
  { 
    key: 'doorManager', 
    label: 'Door Manager', 
    path: '/door-manager', 
    icon: DoorOpen, 
  },

  { 
    key: 'analytics', 
    label: 'Analytics', 
    path: '/analytics', 
    icon: BarChart3, 
  },
];

// Management nav items - typically require higher permissions
export const managementItems: NavItem[] = [
  { 
    key: 'facilityManagement', 
    label: 'Facility Management', 
    path: '/facility-master', 
    icon: Building2, 
    roles: ['admin', 'manager']
  },
  { 
    key: 'userManagement', 
    label: 'User Management', 
    path: '/users', 
    icon: Users, 
    roles: ['admin']
  },
  { 
    key: 'appointments', 
    label: 'Appointment Master', 
    path: '/appointment-master', 
    icon: CalendarClock, 
    roles: ['admin', 'manager']
  },
  { 
    key: 'bookingPages', 
    label: 'Booking Pages', 
    path: '/booking-pages', 
    icon: Globe, 
    roles: ['admin', 'manager']
  },
  { 
    key: 'companyAssets', 
    label: 'Assets', 
    path: '/company-assets', 
    icon: Boxes, 
    roles: ['admin', 'manager']
  },
  { 
    key: 'settings', 
    label: 'Settings', 
    path: '/settings', 
    icon: Settings,
    roles: ['admin', 'manager']
  }
];

// Admin console nav items
export const adminItems: NavItem[] = [
  { 
    key: 'adminDashboard', 
    label: 'Admin Dashboard', 
    path: '/admin', 
    icon: BarChart3, 
    isAdmin: true 
  },
  { 
    key: 'adminOrgs', 
    label: 'Organizations', 
    path: '/admin/organizations', 
    icon: Building2, 
    isAdmin: true 
  },
  { 
    key: 'adminUsers', 
    label: 'Users', 
    path: '/admin/users', 
    icon: Users, 
    isAdmin: true 
  },
  { 
    key: 'adminSettings', 
    label: 'Admin Settings', 
    path: '/admin/settings', 
    icon: Settings, 
    isAdmin: true 
  }
];