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
import Analytics from "@/pages/analytics";
import Users from "@/pages/users";
import Settings from "@/pages/settings";
import FacilityMaster from "@/pages/facility-master";
import Appointments from "@/pages/appointments";
import AppointmentMaster from "@/pages/appointment-master";
import BookingPages from "@/pages/booking-pages";
import AuthDebugPage from "@/pages/auth-debug-page";
import { ProtectedRoute } from "./lib/protected-route";
import { ThemeProvider } from "@/components/ui/theme-provider";

function App() {
  return (
    <ThemeProvider defaultTheme="light" storageKey="hanzo-dock-theme">
      <Switch>
        <Route path="/auth" component={AuthPage} />
        <Route path="/door-manager-demo" component={BasicDoorManager} />
        <Route path="/external/:slug" component={ExternalBooking} />
        <Route path="/booking-confirmation" component={BookingConfirmation} />
        <Route path="/driver-check-in" component={DriverCheckIn} />
        <Route path="/auth-debug" component={AuthDebugPage} />
        <ProtectedRoute path="/" component={Dashboard} />
        <ProtectedRoute path="/schedules" component={Schedules} />
        <ProtectedRoute path="/schedules/:id" component={Schedules} />
        <ProtectedRoute path="/appointments" component={Appointments} />
        <ProtectedRoute path="/facility-master" component={FacilityMaster} roles={["admin", "manager"]} />
        <ProtectedRoute path="/appointment-master" component={AppointmentMaster} roles={["admin", "manager"]} />
        <ProtectedRoute path="/dock-status" component={DockStatus} />
        <ProtectedRoute path="/door-manager" component={DoorManager} />
        <ProtectedRoute path="/analytics" component={Analytics} />
        <ProtectedRoute path="/users" component={Users} roles={["admin"]} />
        <ProtectedRoute path="/booking-pages" component={BookingPages} roles={["admin", "manager"]} />
        <ProtectedRoute path="/settings" component={Settings} roles={["admin", "manager"]} />
        <Route component={NotFound} />
      </Switch>
      <Toaster />
    </ThemeProvider>
  );
}

export default App;
