import { lazy, Suspense } from "react";
import { Switch, Route } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import AuthPage from "@/pages/auth-page";
import Schedules from "@/pages/schedules";
import DockStatus from "@/pages/dock-status";
import DoorManager from "@/pages/door-manager";
import BasicDoorManager from "@/pages/basic-door-manager";
import ExternalBooking from "@/pages/external-booking-fixed";
import BookingConfirmation from "@/pages/booking-confirmation";
import DriverCheckIn from "@/pages/driver-check-in";
import Reschedule from "@/pages/reschedule";
import Cancel from "@/pages/cancel";
import Analytics from "@/pages/analytics";
import Users from "@/pages/users";
import Settings from "@/pages/settings";
import FacilityMaster from "@/pages/facility-master";
import Facilities from "@/pages/facilities";
import FacilitySettings from "@/pages/facility-settings";
import Appointments from "@/pages/appointments";
import AppointmentMaster from "@/pages/appointment-master";
import BookingPages from "@/pages/booking-pages";
import AssetManagerPage from "@/pages/asset-manager-page";
import AssetEditPage from "@/pages/asset-edit-page";
import CalendarView from "@/pages/calendar-view";
import AuthDebugPage from "@/pages/auth-debug-page";
import TestFixedAppointment from "@/pages/test-fixed-appointment";
import TestFixedAppointmentV2 from "@/pages/test-fixed-appointment-v2";
import TestAppointmentPatchedPage from "@/pages/test-appointment-patched";
import AdminDashboard from "@/pages/admin/index";
import { ProtectedRoute } from "./lib/protected-route";
import { ThemeProvider } from "@/components/ui/theme-provider";
import { Loader2 } from "lucide-react";

// Use lazy loading for admin routes
const AdminOrgsPage = lazy(() => import("@/pages/admin/orgs"));
const AdminNewOrgPage = lazy(() => import("@/pages/admin/orgs/new"));
// Need to handle the special character in filename
const AdminOrgDetailPage = lazy(() => {
  return new Promise((resolve) => {
    // Dynamically import the module with square brackets in the filename
    import("@/pages/admin/orgs/[id]").then((module) => {
      resolve({ default: module.default });
    });
  });
});

function App() {
  return (
    <ThemeProvider defaultTheme="light" storageKey="hanzo-dock-theme">
      <Switch>
        <Route path="/auth" component={AuthPage} />
        <Route path="/door-manager-demo" component={BasicDoorManager} />
        <Route path="/external/:slug" component={ExternalBooking} />
        <Route path="/booking-confirmation" component={BookingConfirmation} />
        <Route path="/driver-check-in" component={DriverCheckIn} />
        <Route path="/reschedule" component={Reschedule} />
        <Route path="/cancel" component={Cancel} />
        <Route path="/auth-debug" component={AuthDebugPage} />
        <Route path="/test-fixed-appointment" component={TestFixedAppointment} />
        <Route path="/test-fixed-appointment-v2" component={TestFixedAppointmentV2} />
        <Route path="/test-appointment-patched" component={TestAppointmentPatchedPage} />
        <ProtectedRoute path="/" component={Dashboard} />
        <ProtectedRoute path="/schedules" component={Schedules} />
        <ProtectedRoute path="/schedules/:id" component={Schedules} />
        <ProtectedRoute path="/appointments" component={Appointments} />
        <ProtectedRoute path="/calendar" component={CalendarView} />
        <ProtectedRoute path="/facility-master" component={FacilityMaster} roles={["admin", "manager"]} />
        <ProtectedRoute path="/facilities" component={Facilities} roles={["admin", "manager"]} />
        <ProtectedRoute path="/facility-settings/:id" component={FacilitySettings} roles={["admin", "manager"]} />
        <ProtectedRoute path="/facility-settings" component={FacilitySettings} roles={["admin", "manager"]} />
        <ProtectedRoute path="/appointment-master" component={AppointmentMaster} roles={["admin", "manager"]} />
        <ProtectedRoute path="/dock-status" component={DockStatus} />
        <ProtectedRoute path="/door-manager" component={DoorManager} />
        <ProtectedRoute path="/analytics" component={Analytics} />
        <ProtectedRoute path="/users" component={Users} roles={["admin"]} />
        <ProtectedRoute path="/booking-pages" component={BookingPages} roles={["admin", "manager"]} />
        <ProtectedRoute path="/asset-manager" component={AssetManagerPage} roles={["admin", "manager"]} />
        <ProtectedRoute path="/asset-manager/assets/:id/edit" component={AssetEditPage} roles={["admin", "manager"]} />
        <ProtectedRoute path="/settings" component={Settings} roles={["admin", "manager"]} />
        <ProtectedRoute path="/admin" component={AdminDashboard} roles={["super-admin"]} />
        <ProtectedRoute 
          path="/admin/orgs" 
          component={() => (
            <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
              <AdminOrgsPage />
            </Suspense>
          )} 
          roles={["super-admin"]}
        />
        <ProtectedRoute 
          path="/admin/orgs/new" 
          component={() => (
            <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
              <AdminNewOrgPage />
            </Suspense>
          )} 
          roles={["super-admin"]}
        />
        <ProtectedRoute 
          path="/admin/orgs/:id" 
          component={() => (
            <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
              <AdminOrgDetailPage />
            </Suspense>
          )} 
          roles={["super-admin"]}
        />
        <Route component={NotFound} />
      </Switch>
      <Toaster />
    </ThemeProvider>
  );
}

export default App;
