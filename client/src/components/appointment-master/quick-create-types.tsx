import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2, PlusCircle } from "lucide-react";
import { Facility, AppointmentType } from "@shared/schema";

export default function QuickCreateTypes() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [selectedFacility, setSelectedFacility] = useState<number | null>(null);
  const [appointmentType, setAppointmentType] = useState<string>("1hour");

  // Fetch facilities from API
  const { data: facilities = [], isLoading: isLoadingFacilities } = useQuery<Facility[]>({
    queryKey: ["/api/facilities"],
  });

  // Fetch existing appointment types
  const { data: existingTypes = [], isLoading: isLoadingTypes } = useQuery<AppointmentType[]>({
    queryKey: ["/api/appointment-types"],
  });

  // Appointment type templates
  const appointmentTypeTemplates = {
    "1hour": {
      name: "1 Hour Trailer Appointment",
      description: "Standard 1 hour appointment for trailers",
      duration: 60,
      color: "#2196F3" 
    },
    "4hour": {
      name: "4 Hour Container Appointment",
      description: "Extended 4 hour appointment for containers",
      duration: 240,
      color: "#4CAF50"
    }
  };

  const createAppointmentType = async () => {
    if (!selectedFacility) {
      toast({
        title: "Error",
        description: "Please select a facility first",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    
    try {
      const facility = facilities.find((f: any) => f.id === selectedFacility);
      if (!facility) {
        throw new Error("Selected facility not found");
      }
      
      const template = appointmentTypeTemplates[appointmentType as keyof typeof appointmentTypeTemplates];
      
      // Check if this appointment type already exists for this facility
      const existingType = existingTypes.find(
        (type: any) => type.name === template.name && type.facilityId === selectedFacility
      );
      
      if (existingType) {
        toast({
          title: "Already Exists",
          description: `"${template.name}" already exists for ${facility.name}`,
        });
        setLoading(false);
        return;
      }
      
      const appointmentTypeData = {
        name: template.name,
        description: `${template.description} at ${facility.name}`,
        facilityId: selectedFacility,
        duration: template.duration,
        color: template.color,
        type: "both", // Always use "both" for inbound/outbound
        showRemainingSlots: true,
        gracePeriod: 15,
        emailReminderTime: 24
      };
      
      const response = await apiRequest("POST", "/api/appointment-types", appointmentTypeData);
      const createdType = await response.json();
      
      // Invalidate the appointment types query to refresh the data
      queryClient.invalidateQueries({ queryKey: ["/api/appointment-types"] });
      
      toast({
        title: "Success",
        description: `Created "${template.name}" for ${facility.name}`,
      });
    } catch (error) {
      console.error("Error creating appointment type:", error);
      toast({
        title: "Error",
        description: "Failed to create appointment type. See console for details.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick Create Appointment Type</CardTitle>
        <CardDescription>
          Create a standard appointment type for a facility
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="facility">Facility</Label>
            <Select
              value={selectedFacility?.toString() || ""}
              onValueChange={(value: any) => setSelectedFacility(parseInt(value))}
              disabled={isLoadingFacilities || loading}
            >
              <SelectTrigger id="facility">
                <SelectValue placeholder="Select a facility" />
              </SelectTrigger>
              <SelectContent>
                {facilities.map((facility: any) => <SelectItem key={facility.id} value={facility.id.toString()}>
                  {facility.name}
                </SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="appointmentType">Appointment Type</Label>
            <Select
              value={appointmentType}
              onValueChange={setAppointmentType}
              disabled={loading}
            >
              <SelectTrigger id="appointmentType">
                <SelectValue placeholder="Select appointment type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1hour">
                  1 Hour Trailer Appointment
                </SelectItem>
                <SelectItem value="4hour">
                  4 Hour Container Appointment
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="pt-2">
            <p className="text-sm text-muted-foreground">
              This will create a standard appointment type for the selected facility.
              Both appointment types support inbound and outbound operations.
            </p>
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <Button 
          onClick={createAppointmentType} 
          disabled={!selectedFacility || loading || isLoadingFacilities}
        >
          {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {loading ? "Creating..." : "Create Appointment Type"}
        </Button>
      </CardFooter>
    </Card>
  );
}