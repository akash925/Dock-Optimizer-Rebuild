import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Schedule, EnhancedSchedule } from '@shared/schema';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { format } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { Calendar, Clock, MapPin, Truck, User, Phone, Mail, FileText, QrCode } from 'lucide-react';

interface UnifiedAppointmentDetailsModalProps {
  appointment: EnhancedSchedule | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  facilityTimezone?: string;
  timeFormat?: "12h" | "24h";
  showEditActions?: boolean;
  showCheckInOut?: boolean;
}

// Helper functions for timezone formatting
function getUserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

function formatInUserTimeZone(date: Date, formatStr: string): string {
  return formatInTimeZone(date, getUserTimeZone(), formatStr);
}

function formatInFacilityTimeZone(date: Date, formatStr: string, timezone: string): string {
  return formatInTimeZone(date, timezone, formatStr);
}

function getTimeZoneAbbreviation(timezone: string, date?: Date): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'short',
    });
    const parts = formatter.formatToParts(date || new Date());
    const timeZonePart = parts.find(part => part.type === 'timeZoneName');
    return timeZonePart ? timeZonePart.value : timezone.split('/').pop() || timezone;
  } catch (error) {
    return timezone.split('/').pop() || timezone;
  }
}

export function UnifiedAppointmentDetailsModal({
  appointment,
  open,
  onOpenChange,
  facilityTimezone = "America/New_York",
  timeFormat = "12h",
  showEditActions = true,
  showCheckInOut = true
}: UnifiedAppointmentDetailsModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [formData, setFormData] = useState<Partial<Schedule>>({});

  // Initialize form data when appointment changes
  useEffect(() => {
    if (appointment) {
      setFormData({
        customerName: appointment.customerName || '',
        carrierName: appointment.carrierName || '',
        driverName: appointment.driverName || '',
        driverPhone: appointment.driverPhone || '',
        driverEmail: appointment.driverEmail || '',
        truckNumber: appointment.truckNumber || '',
        trailerNumber: appointment.trailerNumber || '',
        mcNumber: appointment.mcNumber || '',
        bolNumber: appointment.bolNumber || '',
        poNumber: appointment.poNumber || '',
        palletCount: appointment.palletCount || '',
        weight: appointment.weight || '',
        notes: appointment.notes || ''
      });
    }
  }, [appointment]);

  // Update appointment mutation
  const updateAppointmentMutation = useMutation({
    mutationFn: async (data: Partial<Schedule>) => {
      if (!appointment?.id) throw new Error("No appointment ID provided");
      
      const cleanedData: Partial<Schedule> = Object.entries(data)
        .filter(([_, value]) => value !== undefined)
        .reduce((obj, [key, value]) => ({ ...obj, [key]: value }), {} as Partial<Schedule>);
      
      const res = await apiRequest("PATCH", `/api/schedules/${appointment.id}`, cleanedData);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/schedules"] });
      setIsEditing(false);
      toast({
        title: "Appointment updated",
        description: "The appointment has been successfully updated",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error updating appointment",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Check-in mutation
  const checkInMutation = useMutation({
    mutationFn: async () => {
      if (!appointment?.id) throw new Error("No appointment ID provided");
      const res = await apiRequest("PATCH", `/api/schedules/${appointment.id}/check-in`, {
        actualStartTime: new Date().toISOString()
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/schedules"] });
      toast({
        title: "Checked in successfully",
        description: "The appointment has been checked in",
      });
    },
    onError: (error: any) => {
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
      if (!appointment?.id) throw new Error("No appointment ID provided");
      const res = await apiRequest("PATCH", `/api/schedules/${appointment.id}/check-out`, {
        actualEndTime: new Date().toISOString(),
        notes: formData.notes
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/schedules"] });
      toast({
        title: "Checked out successfully",
        description: "The appointment has been completed",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error checking out",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  if (!appointment) return null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'bg-blue-100 text-blue-800';
      case 'in-progress': return 'bg-yellow-100 text-yellow-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const displayFacilityTimezone = appointment.facilityTimezone || facilityTimezone;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              {appointment.customerName || "No customer name"}
              <Badge className={getStatusColor(appointment.status)}>
                {appointment.status}
              </Badge>
              {appointment.type && (
                <Badge variant="outline">
                  {appointment.type}
                </Badge>
              )}
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Basic Info Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Appointment Details */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Appointment Details</h3>
              
              {/* Date and Time */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Scheduled Time</Label>
                <div className="bg-muted/30 rounded-md p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="h-4 w-4" />
                    <span className="font-medium">
                      {format(new Date(appointment.startTime), 'EEEE, MMMM d, yyyy')}
                    </span>
                  </div>
                  
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center gap-2">
                      <Clock className="h-3 w-3" />
                      <span className="font-medium">Your time:</span>
                      <span>
                        {formatInUserTimeZone(new Date(appointment.startTime), 'h:mm a')} - {formatInUserTimeZone(new Date(appointment.endTime), 'h:mm a')} {getTimeZoneAbbreviation(getUserTimeZone())}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Clock className="h-3 w-3" />
                      <span className="font-medium">Facility time:</span>
                      <span>
                        {formatInFacilityTimeZone(new Date(appointment.startTime), timeFormat === "24h" ? 'HH:mm' : 'h:mm a', displayFacilityTimezone)} - {formatInFacilityTimeZone(new Date(appointment.endTime), timeFormat === "24h" ? 'HH:mm' : 'h:mm a', displayFacilityTimezone)} {getTimeZoneAbbreviation(displayFacilityTimezone)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Location */}
              <div>
                <Label className="text-sm font-medium">Location</Label>
                <div className="flex items-center gap-2 mt-1">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span>{appointment.facilityName || "No facility assigned"}</span>
                </div>
                {appointment.dockName && (
                  <div className="text-sm text-muted-foreground ml-6">
                    Dock: {appointment.dockName}
                  </div>
                )}
              </div>

              {/* Service Type */}
              {appointment.appointmentTypeName && (
                <div>
                  <Label className="text-sm font-medium">Service</Label>
                  <div className="mt-1">
                    <Badge variant="secondary">{appointment.appointmentTypeName}</Badge>
                  </div>
                </div>
              )}
            </div>

            {/* Contact Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Contact Information</h3>
              
              {isEditing ? (
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="customerName">Customer Name</Label>
                    <Input
                      id="customerName"
                      value={formData.customerName || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, customerName: e.target.value }))}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="carrierName">Carrier Name</Label>
                    <Input
                      id="carrierName"
                      value={formData.carrierName || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, carrierName: e.target.value }))}
                    />
                  </div>

                  <div>
                    <Label htmlFor="driverName">Driver Name</Label>
                    <Input
                      id="driverName"
                      value={formData.driverName || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, driverName: e.target.value }))}
                    />
                  </div>

                  <div>
                    <Label htmlFor="driverPhone">Driver Phone</Label>
                    <Input
                      id="driverPhone"
                      value={formData.driverPhone || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, driverPhone: e.target.value }))}
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Customer:</span>
                    <span>{appointment.customerName || "Not specified"}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Truck className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Carrier:</span>
                    <span>{appointment.carrierName || "Not specified"}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Driver:</span>
                    <span>{appointment.driverName || "Not specified"}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Phone:</span>
                    <span>{appointment.driverPhone || "Not specified"}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Vehicle & Shipment Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Vehicle & Shipment Information</h3>
            
            {isEditing ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="truckNumber">Truck Number</Label>
                  <Input
                    id="truckNumber"
                    value={formData.truckNumber || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, truckNumber: e.target.value }))}
                  />
                </div>
                
                <div>
                  <Label htmlFor="trailerNumber">Trailer Number</Label>
                  <Input
                    id="trailerNumber"
                    value={formData.trailerNumber || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, trailerNumber: e.target.value }))}
                  />
                </div>

                <div>
                  <Label htmlFor="mcNumber">MC Number</Label>
                  <Input
                    id="mcNumber"
                    value={formData.mcNumber || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, mcNumber: e.target.value }))}
                  />
                </div>

                <div>
                  <Label htmlFor="bolNumber">BOL Number</Label>
                  <Input
                    id="bolNumber"
                    value={formData.bolNumber || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, bolNumber: e.target.value }))}
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Truck Number</Label>
                  <div className="text-sm mt-1">{appointment.truckNumber || "Not specified"}</div>
                </div>
                
                <div>
                  <Label className="text-sm font-medium">Trailer Number</Label>
                  <div className="text-sm mt-1">{appointment.trailerNumber || "Not specified"}</div>
                </div>

                <div>
                  <Label className="text-sm font-medium">MC Number</Label>
                  <div className="text-sm mt-1">{appointment.mcNumber || "Not specified"}</div>
                </div>

                <div>
                  <Label className="text-sm font-medium">BOL Number</Label>
                  <div className="text-sm mt-1">{appointment.bolNumber || "Not specified"}</div>
                </div>
              </div>
            )}
          </div>

          {/* Notes Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Notes</h3>
            
            {isEditing ? (
              <Textarea
                value={formData.notes || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Add notes..."
                rows={3}
              />
            ) : (
              <div className="bg-muted/30 rounded-md p-3 min-h-[60px]">
                {appointment.notes || "No notes"}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2 pt-4 border-t">
            {showEditActions && (
              <>
                {isEditing ? (
                  <>
                    <Button 
                      onClick={() => updateAppointmentMutation.mutate(formData)}
                      disabled={updateAppointmentMutation.isPending}
                    >
                      Save Changes
                    </Button>
                    <Button
                      variant="outline" 
                      onClick={() => setIsEditing(false)}
                    >
                      Cancel
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="outline" 
                    onClick={() => setIsEditing(true)}
                  >
                    Edit Appointment
                  </Button>
                )}
              </>
            )}

            {showCheckInOut && appointment.status === 'scheduled' && (
              <Button 
                onClick={() => checkInMutation.mutate()}
                disabled={checkInMutation.isPending}
              >
                Check In
              </Button>
            )}

            {showCheckInOut && appointment.status === 'in-progress' && (
              <Button 
                onClick={() => checkOutMutation.mutate()}
                disabled={checkOutMutation.isPending}
              >
                Check Out
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
} 