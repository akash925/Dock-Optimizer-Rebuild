import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  Carrier, 
  Schedule 
} from "@shared/schema";
import UnifiedAppointmentFlow from "@/components/appointment/unified-appointment-flow";

interface DoorAppointmentFormProps {
  isOpen: boolean;
  onClose: () => void;
  dockId: number;
  initialStartTime: Date;
  initialEndTime: Date;
  carriers: Carrier[];
  schedules?: Schedule[];
  onSuccess: () => void;
}

export default function DoorAppointmentForm({
  isOpen,
  onClose,
  dockId,
  initialStartTime,
  initialEndTime,
  carriers,
  schedules = [],
  onSuccess
}: DoorAppointmentFormProps) {
  const { toast } = useToast();
  const [appointmentType, setAppointmentType] = useState<"new" | "existing">("new");
  const [selectedExistingAppointment, setSelectedExistingAppointment] = useState<Schedule | null>(null);
  
  // Get today's appointments for existing appointment selection
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  // Filter schedules for today's appointments that aren't for this dock
  const todaysAppointments = schedules.filter(s => 
    new Date(s.startTime) >= today && 
    new Date(s.startTime) < tomorrow &&
    s.dockId !== dockId
  );
  
  // Get the facility ID for this dock
  const { data: dock } = useQuery({
    queryKey: [`/api/docks/${dockId}`],
    queryFn: async () => {
      const response = await fetch(`/api/docks/${dockId}`);
      if (!response.ok) throw new Error("Failed to fetch dock details");
      return response.json();
    }
  });
  
  const handleExistingAppointmentSelect = (appointmentId: string) => {
    const appointment = todaysAppointments.find(a => a.id.toString() === appointmentId);
    if (appointment) {
      setSelectedExistingAppointment(appointment);
    }
  };
  
  const handleNewAppointmentSuccess = (appointment: any) => {
    console.log('[DoorAppointmentForm] New appointment created:', appointment);
    
    // Automatically assign the appointment to this dock if it wasn't already
    if (appointment.id && (!appointment.dockId || appointment.dockId !== dockId)) {
      // Update the appointment to include the dock assignment
      fetch(`/api/schedules/${appointment.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dockId: dockId,
          lastModifiedAt: new Date().toISOString(),
        }),
      }).then(() => {
        console.log('[DoorAppointmentForm] Appointment assigned to dock:', dockId);
        queryClient.invalidateQueries({ queryKey: ['/api/schedules'] });
        queryClient.invalidateQueries({ queryKey: ['/api/docks'] });
      }).catch(error => {
        console.error('[DoorAppointmentForm] Error assigning dock:', error);
      });
    }
    
    toast({
      title: "Appointment Created & Assigned",
      description: `New appointment created and assigned to Door ${dockId}`,
    });
    
    onSuccess();
    onClose();
  };
  
  const handleExistingAppointmentAssign = async () => {
    if (!selectedExistingAppointment) return;
    
    try {
      const response = await fetch(`/api/schedules/${selectedExistingAppointment.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dockId: dockId,
          lastModifiedAt: new Date().toISOString(),
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to assign appointment to dock');
      }
      
      queryClient.invalidateQueries({ queryKey: ['/api/schedules'] });
      queryClient.invalidateQueries({ queryKey: ['/api/docks'] });
      
      toast({
        title: "Appointment Assigned",
        description: `Appointment assigned to Door ${dockId}`,
      });
      
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error assigning appointment:', error);
      toast({
        title: "Assignment Failed",
        description: error instanceof Error ? error.message : "Failed to assign appointment",
        variant: "destructive",
      });
    }
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Assign Door {dockId}</DialogTitle>
          <DialogDescription>
            Create a new appointment or assign an existing appointment to this door.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid grid-cols-2 gap-4 mb-4">
          <Button
            type="button"
            variant={appointmentType === "new" ? "default" : "outline"}
            onClick={() => setAppointmentType("new")}
            className="w-full"
          >
            Create New Appointment
          </Button>
          <Button
            type="button"
            variant={appointmentType === "existing" ? "default" : "outline"}
            onClick={() => setAppointmentType("existing")}
            className="w-full"
          >
            Use Existing Appointment
          </Button>
        </div>
        
        {appointmentType === "existing" ? (
          <div className="space-y-4">
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">
                Select an existing appointment:
              </label>
              <Select onValueChange={handleExistingAppointmentSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose appointment" />
                </SelectTrigger>
                <SelectContent>
                  {todaysAppointments.length > 0 ? (
                    todaysAppointments.map((appointment) => (
                      <SelectItem key={appointment.id} value={appointment.id.toString()}>
                        {carriers.find(c => c.id === appointment.carrierId)?.name || 'Unknown Carrier'} - 
                        {appointment.truckNumber || 'No Truck #'} 
                        ({new Date(appointment.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})})
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="none" disabled>No appointments available</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            
            {selectedExistingAppointment && (
              <div className="p-4 border rounded-md mb-4 bg-gray-50">
                <h3 className="font-medium mb-2">Selected Appointment Details:</h3>
                <p className="text-sm mb-1">
                  <span className="font-medium">Carrier:</span> {carriers.find(c => c.id === selectedExistingAppointment.carrierId)?.name || "N/A"}
                </p>
                <p className="text-sm mb-1">
                  <span className="font-medium">Customer:</span> {selectedExistingAppointment.customerName || "N/A"}
                </p>
                <p className="text-sm mb-1">
                  <span className="font-medium">Truck #:</span> {selectedExistingAppointment.truckNumber || "N/A"}
                </p>
                <p className="text-sm mb-1">
                  <span className="font-medium">Type:</span> {selectedExistingAppointment.type}
                </p>
                <p className="text-sm">
                  <span className="font-medium">Time:</span> {new Date(selectedExistingAppointment.startTime).toLocaleString()} - {new Date(selectedExistingAppointment.endTime).toLocaleString()}
                </p>
                
                <div className="mt-4 flex gap-2">
                  <Button onClick={handleExistingAppointmentAssign} className="flex-1">
                    Assign to Door {dockId}
                  </Button>
                  <Button variant="outline" onClick={onClose}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div>
            {/* Use the unified appointment flow for creating new appointments */}
            <UnifiedAppointmentFlow
              mode="internal"
              isOpen={true}
              onClose={onClose}
              onSuccess={handleNewAppointmentSuccess}
              facilityId={dock?.facilityId}
              selectedDockId={dockId}
              selectedDate={initialStartTime}
              initialData={{
                appointmentDate: initialStartTime,
                startTime: initialStartTime.toTimeString().slice(0, 5),
                endTime: initialEndTime.toTimeString().slice(0, 5),
                dockId: dockId,
              }}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}