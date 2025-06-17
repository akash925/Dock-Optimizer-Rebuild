import { lazy, Suspense, useMemo } from "react";
import { Switch, Route, Redirect } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import AuthPage from "@/pages/auth-page";
import Schedules from "@/pages/schedules";
import DockStatus from "@/pages/dock-status";
import DoorManager from "@/pages/door-manager";
import BasicDoorManager from "@/pages/basic-door-manager";
import BookingRouter from "@/pages/booking-router";
import BookingConfirmation from "@/pages/booking-confirmation";
import DriverCheckIn from "@/pages/driver-check-in";
import Reschedule from "@/pages/reschedule";
import Cancel from "@/pages/cancel";
import Analytics from "@/pages/analytics";
import Users from "@/pages/users";
import Settings from "@/pages/settings";
import OrganizationSettings from "@/pages/organization-settings";
import FacilityMaster from "@/pages/facility-master";
import Facilities from "@/pages/facilities";
import FacilitySettings from "@/pages/facility-settings";
import Appointments from "@/pages/appointments";
import AppointmentMaster from "@/pages/appointment-master";
import BookingPages from "@/pages/booking-pages";
import AssetManagerPage from "@/pages/asset-manager-page";
import AssetEditPage from "@/pages/asset-edit-page";
import CalendarView from "@/pages/calendar-view";
import WebSocketTestPage from "@/pages/websocket-test";
import SeedQuestionsPage from "@/pages/seed-questions";
import DebugAPI from "@/pages/debug-api";
import AdminDashboard from "@/pages/admin";
import AdminOrganizations from "@/pages/admin/orgs";
import AdminUsers from "@/pages/admin/users";
import AdminSettings from "@/pages/admin/settings";
import AdminAppointments from "@/pages/admin/appointments";
import { ProtectedRoute } from "./lib/protected-route";
import { AdminProtectedRoute } from "./lib/admin-protected-route";
import { ThemeProvider } from "@/components/ui/theme-provider";
import { Loader2 } from "lucide-react";
import { ModuleProvider, useModules } from "@/contexts/ModuleContext";
import { OrgProvider } from "@/contexts/OrgContext";
import { AuthProvider } from "@/hooks/use-auth";

// Define route config with module dependencies
export interface RouteConfig {
  path: string;
  component: React.ComponentType<any>;
  module?: string | null;
  roles?: string[];
  isAdmin?: boolean;
}

// Use lazy loading for admin routes
const AdminOrgsPage = lazy(() => import("@/pages/admin/orgs"));
const AdminNewOrgPage = lazy(() => import("@/pages/admin/orgs/new"));
const AdminOrganizationsPage = lazy(() => import("@/pages/admin/organizations"));
const AdminUsersPage = lazy(() => import("@/pages/admin/users"));
const AdminUserDetailPage = lazy(() => import("@/pages/admin/users/[id]"));
const AdminSettingsPage = lazy(() => import("@/pages/admin/settings"));
// Need to handle the special character in filename
const AdminOrgDetailPage = lazy(() => {
  return new Promise((resolve) => {
    // Dynamically import the module with square brackets in the filename
    import("@/pages/admin/orgs/[id]").then((module) => {
      resolve({ default: module.default });
    });
  });
});

// Define all routes with their module dependencies
const protectedRoutes: RouteConfig[] = [
  { path: "/", component: Dashboard, module: null },
  { path: "/schedules", component: Schedules, module: "appointments" },
  { path: "/schedules/:id", component: Schedules, module: "appointments" },
  { path: "/appointments", component: Appointments, module: "appointments" },
  // Calendar view now redirects to schedules
  { path: "/calendar", component: () => <Redirect to="/schedules" />, module: "calendar" },
  { path: "/facility-master", component: FacilityMaster, roles: ["admin", "manager"], module: "facilityManagement" },
  { path: "/facilities", component: Facilities, roles: ["admin", "manager"], module: "facilityManagement" },
  { path: "/facility-settings/:id", component: FacilitySettings, roles: ["admin", "manager"], module: "facilityManagement" },
  { path: "/facility-settings", component: FacilitySettings, roles: ["admin", "manager"], module: "facilityManagement" },
  { path: "/appointment-master", component: AppointmentMaster, roles: ["admin", "manager"], module: "appointments" },
  { path: "/seed-questions", component: SeedQuestionsPage, roles: ["admin", "manager"], module: "appointments" },
  { path: "/dock-status", component: DockStatus, module: "doorManager" },
  { path: "/door-manager", component: DoorManager, module: "doorManager" },
  { path: "/analytics", component: Analytics, module: "analytics" },
  { path: "/users", component: Users, roles: ["admin"], module: "userManagement" },
  { path: "/booking-pages", component: BookingPages, roles: ["admin", "manager"], module: "bookingPages" },
  { path: "/asset-manager", component: AssetManagerPage, roles: ["admin", "manager"], module: "assetManager" },
  { path: "/asset-manager/assets/:id/edit", component: AssetEditPage, roles: ["admin", "manager"], module: "assetManager" },
  { path: "/websocket-test", component: WebSocketTestPage, roles: ["admin", "manager"], module: null },
  { path: "/debug-api", component: DebugAPI, roles: ["admin"], module: null },
  { path: "/settings", component: Settings, roles: ["admin", "manager"], module: null },
  { path: "/organization-settings", component: OrganizationSettings, roles: ["admin", "manager"], module: null },
  { 
    path: "/organization-hours", 
    component: () => {
      const LazyOrganizationHours = lazy(() => import("@/pages/organization-hours"));
      return (
        <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div></div>}>
          <LazyOrganizationHours />
        </Suspense>
      );
    }, 
    roles: ["admin", "manager"], 
    module: null 
  }
];

// Define admin routes
const adminRoutes: RouteConfig[] = [
  { path: "/admin", component: AdminDashboard, isAdmin: true },
  { 
    path: "/admin/orgs", 
    component: () => (
      <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
        <AdminOrgsPage />
      </Suspense>
    ),
    isAdmin: true
  },
  { 
    path: "/admin/orgs/new", 
    component: () => (
      <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
        <AdminNewOrgPage />
      </Suspense>
    ),
    isAdmin: true
  },
  { 
    path: "/admin/orgs/:id", 
    component: () => (
      <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
        <AdminOrgDetailPage />
      </Suspense>
    ),
    isAdmin: true
  },
  { 
    path: "/admin/organizations", 
    component: () => (
      <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
        <AdminOrganizationsPage />
      </Suspense>
    ),
    isAdmin: true
  },
  { 
    path: "/admin/users", 
    component: () => (
      <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
        <AdminUsersPage />
      </Suspense>
    ),
    isAdmin: true
  },
  { 
    path: "/admin/users/:id", 
    component: () => (
      <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
        <AdminUserDetailPage />
      </Suspense>
    ),
    isAdmin: true
  },
  { 
    path: "/admin/settings", 
    component: () => (
      <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
        <AdminSettings />
      </Suspense>
    ),
    isAdmin: true
  },
  { 
    path: "/admin/appointments", 
    component: () => (
      <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
        <AdminAppointments />
      </Suspense>
    ),
    isAdmin: true
  }
];

// Define public routes that don't require authentication or modules
const publicRoutes: RouteConfig[] = [
  { path: "/auth", component: AuthPage },
  { path: "/door-manager-demo", component: BasicDoorManager },
  { path: "/external/:slug", component: BookingRouter }, // Both routes handled by our unified router
  { path: "/booking/:slug", component: BookingRouter }, // Both routes handled by our unified router
  { path: "/booking-confirmation", component: BookingConfirmation },
  { path: "/driver-check-in", component: DriverCheckIn },
  { path: "/reschedule", component: Reschedule },
  { path: "/cancel", component: Cancel },
  // Email management routes - these need to be public for email links to work
  { path: "/email/view/:confirmationCode", component: Appointments },
  { path: "/email/edit/:confirmationCode", component: Appointments },
  { path: "/email/reschedule/:confirmationCode", component: Reschedule },
  { path: "/email/cancel/:confirmationCode", component: Cancel }
];

// Router component that filters routes based on modules
function AppRouter() {
  const { modules, isModuleEnabled } = useModules();
  
  // Memoize the filtered routes to prevent unnecessary re-renders
  const filteredProtectedRoutes = useMemo(() => {
    return protectedRoutes.filter(route => 
      !route.module || isModuleEnabled(route.module)
    );
  }, [modules, isModuleEnabled]);
  
  return (
    <Switch>
      {/* Public routes that don't require authentication */}
      {publicRoutes.map(route => (
        <Route key={route.path} path={route.path} component={route.component} />
      ))}
      

      {/* Protected routes filtered by module availability */}
      {filteredProtectedRoutes.map(route => (
        <ProtectedRoute 
          key={route.path} 
          path={route.path} 
          component={route.component} 
          roles={route.roles} 
        />
      ))}
      
      {/* Admin routes that don't depend on modules */}
      {adminRoutes.map(route => (
        <AdminProtectedRoute 
          key={route.path} 
          path={route.path} 
          component={route.component} 
        />
      ))}
      
      {/* Not found route */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ThemeProvider defaultTheme="light" storageKey="hanzo-dock-theme">
      <AuthProvider>
        <ModuleProvider>
          <OrgProvider>
            {/* Order of providers is critical - ModuleProvider must be before OrgProvider which must be before AppRouter */}
            <AppRouter />
            <Toaster />
          </OrgProvider>
        </ModuleProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
