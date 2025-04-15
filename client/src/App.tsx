import { Switch, Route } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import AuthPage from "@/pages/auth-page";
import Schedules from "@/pages/schedules";
import DockStatus from "@/pages/dock-status";
import DoorManager from "@/pages/door-manager";
import BasicDoorManager from "@/pages/basic-door-manager";
import Analytics from "@/pages/analytics";
import Users from "@/pages/users";
import Settings from "@/pages/settings";
import { ProtectedRoute } from "./lib/protected-route";
import { ThemeProvider } from "@/components/ui/theme-provider";

function App() {
  return (
    <ThemeProvider defaultTheme="light" storageKey="hanzo-dock-theme">
      <Switch>
        <Route path="/auth" component={AuthPage} />
        <Route path="/door-manager-demo" component={BasicDoorManager} />
        <ProtectedRoute path="/" component={Dashboard} />
        <ProtectedRoute path="/schedules" component={Schedules} />
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
