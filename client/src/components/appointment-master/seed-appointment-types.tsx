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

  // Updated appointment types as requested - 1 Hour Trailer and 4 Hour Container for each facility
  const appointmentTypesToCreate = [
    // Template for each facility
    {
      name: "1 Hour Trailer Appointment",
      description: "Standard 1 hour appointment for trailers",
      duration: 60, // 1 hour in minutes
      type: "both", // Can be used for both pickups and dropoffs
      color: "#2196F3" // Blue
    },
    {
      name: "4 Hour Container Appointment",
      description: "Extended 4 hour appointment for containers",
      duration: 240, // 4 hours in minutes
      type: "both", // Can be used for both pickups and dropoffs
      color: "#4CAF50" // Green
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
      
      // Get existing appointment types to avoid duplicates
      const existingTypesMap = new Map<string, boolean>();
      existingTypes.forEach(type => {
        const key = `${type.name}-${type.facilityId}`;
        existingTypesMap.set(key, true);
      });
      
      // Create an expanded list of appointment types (one of each type for each facility)
      const allTypesToCreate: Array<{
        name: string;
        description: string;
        facilityId: number;
        duration: number;
        color: string;
        type: string;
      }> = [];
      
      // Add each type for each facility
      facilities.forEach(facility => {
        appointmentTypesToCreate.forEach(typeTemplate => {
          const key = `${typeTemplate.name}-${facility.id}`;
          // Only add if this combination doesn't already exist
          if (!existingTypesMap.has(key)) {
            allTypesToCreate.push({
              ...typeTemplate,
              facilityId: facility.id
            });
          }
        });
      });
      
      if (allTypesToCreate.length === 0) {
        toast({
          title: "Info",
          description: "All appointment types already exist for all facilities.",
        });
        setLoading(false);
        return;
      }
      
      console.log(`Preparing to create ${allTypesToCreate.length} appointment types`);
      
      // Create each appointment type
      let createdCount = 0;
      for (const type of allTypesToCreate) {
        // Generate a display name that includes the facility name
        const facility = facilities.find(f => f.id === type.facilityId);
        const facilityName = facility ? facility.name : "Unknown";
        
        const appointmentTypeData = {
          name: type.name, // Keep the base name
          description: `${type.description} at ${facilityName}`,
          facilityId: type.facilityId,
          duration: type.duration,
          color: type.color,
          type: type.type as "inbound" | "outbound" | "both",
          // Add required fields based on appointmentTypes schema
          showRemainingSlots: true,
          gracePeriod: 15,
          emailReminderTime: 24,
          // Additional required fields from schema
          bufferTime: 0,
          maxConcurrent: 1,
          allowAppointmentsThroughBreaks: false,
          allowAppointmentsPastBusinessHours: false,
          overrideFacilityHours: false,
          timezone: "America/New_York"
        };
        
        console.log(`Creating appointment type for facility ${facilityName}:`, appointmentTypeData);
        
        try {
          const response = await apiRequest("POST", "/api/appointment-types", appointmentTypeData);
          
          if (!response.ok) {
            const errorText = await response.text();
            console.error(`Error creating appointment type (${response.status}):`, errorText);
            throw new Error(`Failed with status ${response.status}: ${errorText}`);
          }
          
          const createdType = await response.json();
          console.log("Successfully created appointment type:", createdType);
          setCompleted(prev => [...prev, createdType.id]);
          createdCount++;
        } catch (error) {
          console.error("Error creating appointment type:", error);
        }
      }
      
      // Invalidate the appointment types query to refresh the data
      queryClient.invalidateQueries({ queryKey: ["/api/appointment-types"] });
      
      if (createdCount > 0) {
        toast({
          title: "Success",
          description: `Created ${createdCount} appointment types for ${facilities.length} facilities`,
        });
      } else {
        toast({
          title: "Warning",
          description: "No appointment types were created. Check console for details.",
          variant: "destructive"
        });
      }
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

  // Calculate potential appointment types to create
  const totalPotentialTypes = facilities.length * appointmentTypesToCreate.length;
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Create Standard Appointment Types</CardTitle>
        <CardDescription>
          Add standard appointment types for each facility
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="mb-4">
          This will create both a 1-hour and 4-hour appointment type for each facility in the system.
          Each type can be used for both pickup and dropoff operations.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <div className="font-medium mb-2">Appointment Types:</div>
            <ul className="text-sm space-y-1 mb-4">
              {appointmentTypesToCreate.map((type, index) => (
                <li key={index} className="flex items-center">
                  <span>{type.name}</span>
                  <span className="ml-2 text-xs text-muted-foreground">({type.duration} mins)</span>
                </li>
              ))}
            </ul>
          </div>
          
          <div>
            <div className="font-medium mb-2">Available Facilities:</div>
            <ul className="text-sm space-y-1 mb-4">
              {facilities.map((facility, index) => (
                <li key={index}>{facility.name}</li>
              ))}
            </ul>
          </div>
        </div>
        
        <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-md mb-4">
          <p className="text-sm text-muted-foreground">
            Each appointment type will be created for every facility, resulting in up 
            to {totalPotentialTypes} total appointment types. Any types that already exist will be skipped.
          </p>
        </div>
        
        {completed.length > 0 && (
          <div className="mt-4">
            <div className="font-medium mb-2">Created Types:</div>
            <p className="text-sm text-green-600">Successfully created {completed.length} appointment types</p>
          </div>
        )}
      </CardContent>
      <CardFooter>
        <Button onClick={createAppointmentTypes} disabled={loading || isLoadingFacilities || facilities.length === 0}>
          {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {loading ? "Creating..." : "Create Appointment Types"}
        </Button>
      </CardFooter>
    </Card>
  );
}