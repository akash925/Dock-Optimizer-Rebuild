import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { InfoIcon } from "lucide-react";

interface SeedAppointmentTypesProps {
  onSeed?: () => void;
}

export default function SeedAppointmentTypes({ onSeed }: SeedAppointmentTypesProps) {
  return (
    <Card className="max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <InfoIcon className="h-5 w-5" />
          Setup Required
        </CardTitle>
        <CardDescription>
          Create default appointment types to get started
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertDescription>
            No appointment types found. Create some appointment types to begin managing your scheduling system.
          </AlertDescription>
        </Alert>
        <Button 
          onClick={onSeed} 
          className="w-full"
        >
          Create Default Appointment Types
        </Button>
      </CardContent>
    </Card>
  );
}