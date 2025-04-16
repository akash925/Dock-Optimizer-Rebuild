import { Switch, Route } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import AuthPage from "@/pages/auth-page";
import Schedules from "@/pages/schedules";
import DockStatus from "@/pages/dock-status";
import DoorManager from "@/pages/door-manager";
import BasicDoorManager from "@/pages/basic-door-manager";
import ExternalBooking from "@/pages/external-booking";
import BookingConfirmation from "@/pages/booking-confirmation";
import Analytics from "@/pages/analytics";
import Users from "@/pages/users";
import Settings from "@/pages/settings";
import FacilityMaster from "@/pages/facility-master";
import Appointments from "@/pages/appointments";
import { ProtectedRoute } from "./lib/protected-route";
import { ThemeProvider } from "@/components/ui/theme-provider";

function App() {
  return (
    <ThemeProvider defaultTheme="light" storageKey="hanzo-dock-theme">
      <Switch>
        <Route path="/auth" component={AuthPage} />
        <Route path="/door-manager-demo" component={BasicDoorManager} />
        <Route path="/external-booking" component={ExternalBooking} />
        <Route path="/booking-confirmation" component={BookingConfirmation} />
        <ProtectedRoute path="/" component={Dashboard} />
        <ProtectedRoute path="/schedules" component={Schedules} />
        <ProtectedRoute path="/appointments" component={Appointments} />
        <ProtectedRoute path="/facility-master" component={FacilityMaster} roles={["admin", "manager"]} />
        <ProtectedRoute path="/dock-status" component={DockStatus} />
        <ProtectedRoute path="/door-manager" component={DoorManager} />
        <ProtectedRoute path="/analytics" component={Analytics} />
        <ProtectedRoute path="/users" component={Users} roles={["admin"]} />
        <ProtectedRoute path="/settings" component={Settings} roles={["admin", "manager"]} />
        <Route component={NotFound} />
      </Switch>
      <Toaster />
    </ThemeProvider>
  );
}

export default App;
