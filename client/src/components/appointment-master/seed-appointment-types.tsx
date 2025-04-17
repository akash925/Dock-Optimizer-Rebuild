import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2, CheckCircle } from "lucide-react";
import { Facility, AppointmentType, insertAppointmentTypeSchema } from "@shared/schema";

export default function SeedAppointmentTypes() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [completed, setCompleted] = useState<number[]>([]);

  // Fetch facilities from API
  const { data: facilities = [], isLoading: isLoadingFacilities } = useQuery<Facility[]>({
    queryKey: ["/api/facilities"],
  });

  // Fetch existing appointment types
  const { data: existingTypes = [], isLoading: isLoadingTypes } = useQuery<AppointmentType[]>({
    queryKey: ["/api/appointment-types"],
  });

  // The appointment types from the screenshot
  const appointmentTypesToCreate = [
    {
      name: "Sam Pride - Floor Loaded Container Drop (4 Hour Unloading)",
      description: "For unloading floor loaded containers that require 4 hours",
      duration: 240, // 4 hours in minutes
      type: "inbound",
      color: "#4CAF50"
    },
    {
      name: "450 Airtech Parkway - LTL Pickup or Dropoff",
      description: "For less-than-truckload pickups or dropoffs at 450 Airtech Parkway",
      duration: 60, // 1 hour in minutes
      type: "both",
      color: "#2196F3"
    },
    {
      name: "TBA",
      description: "To be announced appointment type",
      duration: 60,
      type: "both",
      color: "#9E9E9E"
    },
    {
      name: "HANZO Cold-Chain - Hand-Unload Appointment (4 Hour)",
      description: "For hand unloading cold chain shipments that require 4 hours",
      duration: 240, // 4 hours in minutes
      type: "inbound",
      color: "#00BCD4"
    },
    {
      name: "HANZO Cold-Chain - Palletized Load Appointment (1 Hour)",
      description: "For palletized cold chain loads that require 1 hour",
      duration: 60, // 1 hour in minutes
      type: "inbound",
      color: "#00BCD4"
    },
    {
      name: "Camby Rd - Hand-Unload Appointment (4 Hour)",
      description: "For hand unloading at Camby Rd that require 4 hours",
      duration: 240, // 4 hours in minutes
      type: "inbound",
      color: "#FF9800"
    },
    {
      name: "Camby Rd - Palletized Load Appointment (1 Hour)",
      description: "For palletized loads at Camby Rd that require 1 hour",
      duration: 60, // 1 hour in minutes
      type: "inbound",
      color: "#FF9800"
    },
    {
      name: "9915 Lacy Knot Dr (Hanzo Brownsburg) - Palletized Load Appointment (1 Hour)",
      description: "For palletized loads at Brownsburg that require 1 hour",
      duration: 60, // 1 hour in minutes
      type: "inbound",
      color: "#9C27B0"
    },
    {
      name: "4334 Plainfield Road (Hanzo Metro) - MVP (1 Hour)",
      description: "MVP appointments at Metro location",
      duration: 60, // 1 hour in minutes
      type: "both",
      color: "#607D8B"
    },
    {
      name: "4334 Plainfield Road (Hanzo Metro) - Palletized Load Appointment (1 Hour)",
      description: "For palletized loads at Metro location that require 1 hour",
      duration: 60, // 1 hour in minutes
      type: "inbound",
      color: "#607D8B"
    }
  ];

  // Function to create appointment types
  const createAppointmentTypes = async () => {
    setLoading(true);
    setCompleted([]);
    
    try {
      // Make sure we have facilities
      if (facilities.length === 0) {
        toast({
          title: "Error",
          description: "No facilities available. Please add facilities first.",
          variant: "destructive"
        });
        setLoading(false);
        return;
      }
      
      // Filter out any appointment types that already exist by name
      const existingNames = existingTypes.map(type => type.name);
      const typesToCreate = appointmentTypesToCreate.filter(type => !existingNames.includes(type.name));
      
      if (typesToCreate.length === 0) {
        toast({
          title: "Info",
          description: "All appointment types already exist.",
        });
        setLoading(false);
        return;
      }
      
      // Map facility names to IDs for better association
      const facilityMap: Record<string, number> = {};
      facilities.forEach(facility => {
        const name = facility.name.toLowerCase();
        
        // Add mappings by name and partial matches
        facilityMap[name] = facility.id;
        
        if (name.includes("airtech")) facilityMap["airtech"] = facility.id;
        if (name.includes("camby")) facilityMap["camby"] = facility.id;
        if (name.includes("lacy")) facilityMap["lacy"] = facility.id;
        if (name.includes("brownsburg")) facilityMap["brownsburg"] = facility.id;
        if (name.includes("plainfield")) facilityMap["plainfield"] = facility.id;
        if (name.includes("metro")) facilityMap["metro"] = facility.id;
      });
      
      // Default facility - use the first one if no match is found
      const defaultFacilityId = facilities[0].id;
      
      // Create each appointment type
      for (const type of typesToCreate) {
        let facilityId = defaultFacilityId;
        
        // Determine facility based on name
        const typeName = type.name.toLowerCase();
        
        if (typeName.includes("airtech")) {
          facilityId = facilityMap["airtech"] || defaultFacilityId;
        } else if (typeName.includes("camby")) {
          facilityId = facilityMap["camby"] || defaultFacilityId;
        } else if (typeName.includes("lacy") || typeName.includes("brownsburg")) {
          facilityId = facilityMap["brownsburg"] || defaultFacilityId;
        } else if (typeName.includes("plainfield") || typeName.includes("metro")) {
          facilityId = facilityMap["metro"] || defaultFacilityId;
        }
        
        const appointmentTypeData = {
          name: type.name,
          description: type.description,
          facilityId: facilityId,
          duration: type.duration,
          color: type.color,
          type: type.type as "inbound" | "outbound",
          showRemainingSlots: true,
          gracePeriod: 15,
          emailReminderTime: 24
        };
        
        try {
          const response = await apiRequest("POST", "/api/appointment-types", appointmentTypeData);
          const createdType = await response.json();
          setCompleted(prev => [...prev, createdType.id]);
        } catch (error) {
          console.error("Error creating appointment type:", error);
        }
      }
      
      // Invalidate the appointment types query to refresh the data
      queryClient.invalidateQueries({ queryKey: ["/api/appointment-types"] });
      
      toast({
        title: "Success",
        description: `Created ${typesToCreate.length} appointment types`,
      });
    } catch (error) {
      console.error("Error creating appointment types:", error);
      toast({
        title: "Error",
        description: "Failed to create appointment types. See console for details.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Seed Appointment Types</CardTitle>
        <CardDescription>
          Add predefined appointment types from the reference application
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="mb-4">
          This will create {appointmentTypesToCreate.length} appointment types based on the reference 
          application. Each type will be associated with the appropriate facility based on naming patterns.
        </p>
        
        <div className="font-medium mb-2">Appointment Types to Create:</div>
        <ul className="text-sm space-y-1 mb-4">
          {appointmentTypesToCreate.map((type, index) => (
            <li key={index} className="flex items-center">
              {completed.includes(index) && <CheckCircle className="h-4 w-4 mr-2 text-green-500" />}
              <span>{type.name}</span>
              <span className="ml-2 text-xs text-muted-foreground">({type.duration} mins)</span>
            </li>
          ))}
        </ul>
      </CardContent>
      <CardFooter>
        <Button onClick={createAppointmentTypes} disabled={loading || isLoadingFacilities}>
          {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {loading ? "Creating..." : "Create Appointment Types"}
        </Button>
      </CardFooter>
    </Card>
  );
}