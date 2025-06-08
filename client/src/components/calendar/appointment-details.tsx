import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, DoorOpen, CheckCircle2, LogOut } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { format } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { useLocation } from 'wouter';
import { Schedule } from '@shared/schema';
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface AppointmentDetailsProps {
  scheduleId: number | null;
  onClose: () => void;
}

export default function AppointmentDetails({ scheduleId, onClose }: AppointmentDetailsProps) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showDockAssignment, setShowDockAssignment] = useState(false);

  const { data: schedule, isLoading } = useQuery<Schedule>({
    queryKey: [`/api/schedules/${scheduleId}`],
    enabled: !!scheduleId,
  });

  // Fetch docks for door assignment
  const { data: docks = [] } = useQuery<any[]>({
    queryKey: ["/api/docks"],
    enabled: showDockAssignment,
  });

  // Check-in mutation
  const checkInMutation = useMutation({
    mutationFn: async () => {
      if (!schedule?.id) throw new Error("No schedule ID");
      const res = await apiRequest("PATCH", `/api/schedules/${schedule.id}/check-in`, {
        actualStartTime: new Date().toISOString()
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/schedules/${scheduleId}`] });
      toast({
        title: "Appointment checked in",
        description: "The appointment has been checked in successfully",
      });
      setShowDockAssignment(true);
    },
    onError: (error) => {
      toast({
        title: "Error checking in",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Check-out mutation
  const checkOutMutation = useMutation({
    mutationFn: async () => {
      if (!schedule?.id) throw new Error("No schedule ID");
      const res = await apiRequest("PATCH", `/api/schedules/${schedule.id}/check-out`, {
        actualEndTime: new Date().toISOString()
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/schedules/${scheduleId}`] });
      toast({
        title: "Appointment checked out",
        description: "The appointment has been completed successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error checking out",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Assign dock mutation
  const assignDockMutation = useMutation({
    mutationFn: async (dockId: number) => {
      if (!schedule?.id) throw new Error("No schedule ID");
      const res = await apiRequest("PATCH", `/api/schedules/${schedule.id}/assign-door`, {
        dockId
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/schedules/${scheduleId}`] });
      setShowDockAssignment(false);
      toast({
        title: "Door assigned",
        description: "The appointment has been assigned to a door successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error assigning door",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  if (isLoading || !schedule) {
    return (
      <Dialog open={!!scheduleId} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle>Appointment Details</DialogTitle>
          </DialogHeader>
          <div className="py-6 flex justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Get facility info, including from customFormData if needed
  const scheduleCasted = schedule as any;
  const facilityName = scheduleCasted.facilityName || 
                     (scheduleCasted.customFormData?.facilityInfo?.facilityName) || 
                     'No facility assigned';

  const startDate = new Date(schedule.startTime);
  const endDate = new Date(schedule.endTime);
  
  const formattedDate = format(startDate, 'MMM d, yyyy');
  const formattedStartTime = format(startDate, 'h:mm a');
  const formattedEndTime = format(endDate, 'h:mm a');
  
  const getStatusBadgeColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'in-progress': return 'bg-yellow-500';
      case 'completed': return 'bg-green-500';
      case 'cancelled': return 'bg-red-500';
      case 'no-show': return 'bg-gray-500';
      case 'scheduled': return 'bg-blue-500';
      default: return 'bg-blue-500';
    }
  };

  const getTypeBadgeColor = (type: string) => {
    return type === 'inbound' ? 'bg-blue-600' : 'bg-green-600';
  };

  return (
    <Dialog open={!!scheduleId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>
            <div className="flex flex-col space-y-1">
              <div className="text-xl">{schedule.customerName || 'No customer name'}</div>
              <div className="text-sm text-muted-foreground">Appointment #{schedule.id}</div>
            </div>
          </DialogTitle>
        </DialogHeader>
        
        <div className="py-4 space-y-4">
          {/* Key information row */}
          <div className="flex flex-wrap gap-2 mb-3">
            <Badge variant="outline" className={getStatusBadgeColor(schedule.status)}>
              {schedule.status?.toUpperCase() || 'SCHEDULED'}
            </Badge>
            <Badge variant="outline" className={getTypeBadgeColor(schedule.type)}>
              {schedule.type?.toUpperCase() || 'APPOINTMENT'}
            </Badge>
            {schedule.appointmentTypeId && (
              <Badge variant="outline" className="bg-purple-500">
                {scheduleCasted.appointmentTypeName || `Type ID: ${schedule.appointmentTypeId}`}
              </Badge>
            )}
          </div>
          
          {/* Facility information in highlighted card */}
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="p-3">
              <div className="text-sm font-semibold text-blue-700">Facility</div>
              <div className="text-lg font-bold">{facilityName}</div>
              {scheduleCasted.facilityTimezone && (
                <div className="text-xs text-muted-foreground mt-1">
                  Timezone: {scheduleCasted.facilityTimezone}
                </div>
              )}
              <div className="mt-2 text-sm">
                {schedule.dockId ? (
                  <div className="flex items-center gap-2">
                    <span className="text-green-600 font-medium">
                      🚪 Dock #{schedule.dockId}
                    </span>
                    <Badge variant="secondary" className="text-xs">Assigned</Badge>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-orange-600">No dock assigned</span>
                    {schedule.status === 'in-progress' && (
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => setShowDockAssignment(true)}
                        className="text-xs"
                      >
                        <DoorOpen className="h-3 w-3 mr-1" />
                        Assign Dock
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
          
          {/* Schedule information */}
          <div className="space-y-2">
            <div className="font-medium">Schedule</div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>Date:</div>
              <div className="font-medium">{formattedDate}</div>
              
              <div>Time:</div>
              <div className="font-medium">{formattedStartTime} - {formattedEndTime}</div>
            </div>
          </div>
          
          {/* Carrier information */}
          <div className="space-y-2">
            <div className="font-medium">Carrier Information</div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>Carrier:</div>
              <div className="font-medium">{schedule.carrierName || 'Not specified'}</div>
              
              <div>MC Number:</div>
              <div className="font-medium">{schedule.mcNumber || 'Not specified'}</div>
              
              <div>Truck Number:</div>
              <div className="font-medium">{schedule.truckNumber || 'Not specified'}</div>
              
              <div>Trailer Number:</div>
              <div className="font-medium">{schedule.trailerNumber || 'Not specified'}</div>
            </div>
          </div>
          
          {/* Driver information */}
          <div className="space-y-2">
            <div className="font-medium">Driver Information</div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>Driver Name:</div>
              <div className="font-medium">{schedule.driverName || 'Not specified'}</div>
              
              <div>Driver Phone:</div>
              <div className="font-medium">{schedule.driverPhone || 'Not specified'}</div>
            </div>
          </div>
          
          {/* Additional info if present */}
          {(schedule.notes || schedule.bolNumber || schedule.poNumber || schedule.weight || scheduleCasted.customFormData?.bolData) && (
            <div className="space-y-2">
              <div className="font-medium">Additional Information</div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {schedule.bolNumber && (
                  <>
                    <div>BOL Number:</div>
                    <div className="font-medium">{schedule.bolNumber}</div>
                  </>
                )}
                
                {schedule.poNumber && (
                  <>
                    <div>PO Number:</div>
                    <div className="font-medium">{schedule.poNumber}</div>
                  </>
                )}
                
                {schedule.weight && (
                  <>
                    <div>Weight:</div>
                    <div className="font-medium">{schedule.weight}</div>
                  </>
                )}
                
                {/* Display any extracted BOL data that might be in customFormData */}
                {scheduleCasted.customFormData?.bolData?.fromAddress && (
                  <>
                    <div>From:</div>
                    <div className="font-medium">{scheduleCasted.customFormData.bolData.fromAddress}</div>
                  </>
                )}
                
                {scheduleCasted.customFormData?.bolData?.toAddress && (
                  <>
                    <div>To:</div>
                    <div className="font-medium">{scheduleCasted.customFormData.bolData.toAddress}</div>
                  </>
                )}
                
                {scheduleCasted.customFormData?.bolData?.pickupOrDropoff && (
                  <>
                    <div>Appointment Type:</div>
                    <div className="font-medium">{scheduleCasted.customFormData.bolData.pickupOrDropoff}</div>
                  </>
                )}
                
                {/* Display file information if available */}
                {scheduleCasted.customFormData?.bolData?.fileName && (
                  <>
                    <div>BOL Document:</div>
                    <div className="font-medium flex items-center gap-2">
                      <span>{scheduleCasted.customFormData.bolData.fileName}</span>
                      {scheduleCasted.customFormData.bolData.fileUrl && (
                        <a 
                          href={scheduleCasted.customFormData.bolData.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="7 10 12 15 17 10"></polyline>
                            <line x1="12" y1="15" x2="12" y2="3"></line>
                          </svg>
                          Download
                        </a>
                      )}
                    </div>
                  </>
                )}
                
                {/* Display any parsed OCR text if available - in collapsed form */}
                {scheduleCasted.customFormData?.bolData?.parsedOcrText && (
                  <>
                    <div className="col-span-2 mt-2">
                      <details className="text-xs">
                        <summary className="cursor-pointer font-medium text-primary">View OCR Extracted Text</summary>
                        <pre className="mt-2 p-2 bg-gray-50 rounded text-xs overflow-auto max-h-40">
                          {scheduleCasted.customFormData.bolData.parsedOcrText}
                        </pre>
                      </details>
                    </div>
                  </>
                )}
                
                {schedule.notes && (
                  <>
                    <div>Notes:</div>
                    <div className="font-medium">{schedule.notes}</div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
        
        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
          >
            Close
          </Button>
          
          {/* Status-based action buttons */}
          {schedule.status === 'scheduled' && (
            <Button
              onClick={() => checkInMutation.mutate()}
              disabled={checkInMutation.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              {checkInMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Check In
            </Button>
          )}
          
          {schedule.status === 'in-progress' && (
            <Button
              onClick={() => checkOutMutation.mutate()}
              disabled={checkOutMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {checkOutMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <LogOut className="h-4 w-4 mr-2" />
              Check Out
            </Button>
          )}
          
          {(schedule.status === 'completed' || schedule.status === 'scheduled' || schedule.status === 'in-progress') && (
            <Button
              variant="secondary"
              onClick={() => {
                if (scheduleId) {
                  // Redirect to schedules page with edit mode flag for this appointment
                  navigate(`/schedules?edit=${scheduleId}`);
                }
              }}
            >
              Edit Appointment
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
      
      {/* Dock Assignment Dialog */}
      <Dialog open={showDockAssignment} onOpenChange={setShowDockAssignment}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Assign Dock</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-4">
              Select an available dock for this checked-in appointment:
            </p>
            <div className="grid grid-cols-2 gap-3">
              {docks
                .filter(dock => dock.isActive)
                .map(dock => (
                  <Button
                    key={dock.id}
                    variant="outline"
                    className="h-auto p-4 flex flex-col items-center gap-2"
                    onClick={() => assignDockMutation.mutate(dock.id)}
                    disabled={assignDockMutation.isPending}
                  >
                    <DoorOpen className="h-6 w-6" />
                    <span className="font-medium">{dock.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {dock.type || 'Standard'}
                    </span>
                  </Button>
                ))}
            </div>
            {docks.filter(dock => dock.isActive).length === 0 && (
              <p className="text-center text-muted-foreground py-8">
                No available docks found for this facility
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDockAssignment(false)}>
              Cancel
            </Button>
            <Button 
              variant="secondary"
              onClick={() => navigate("/door-manager")}
            >
              <DoorOpen className="h-4 w-4 mr-2" />
              Go to Door Manager
            </Button>
                     </DialogFooter>
         </DialogContent>
       </Dialog>
      </Dialog>
    );
}