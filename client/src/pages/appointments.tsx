import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useMemo } from "react";
import {
  Calendar,
  Loader2,
  Plus,
  PenIcon,
  TrashIcon,
  FileText,
  Truck,
  Clock,
  MapPin,
  Copy,
} from "lucide-react";
import { formatDate, formatTime, getDockStatus } from "@/lib/utils";
import { Schedule } from "@shared/schema";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";

export default function AppointmentsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Fetch all schedules
  const { data: schedules, isLoading, error } = useQuery({
    queryKey: ["/api/schedules"],
    queryFn: async () => {
      const response = await fetch("/api/schedules");
      if (!response.ok) {
        throw new Error("Failed to fetch schedules");
      }
      return response.json() as Promise<Schedule[]>;
    },
  });
  
  // Fetch all docks
  const { data: docks } = useQuery({
    queryKey: ["/api/docks"],
    queryFn: async () => {
      const response = await fetch("/api/docks");
      if (!response.ok) {
        throw new Error("Failed to fetch docks");
      }
      return response.json();
    },
  });
  
  // Fetch all carriers
  const { data: carriers } = useQuery({
    queryKey: ["/api/carriers"],
    queryFn: async () => {
      const response = await fetch("/api/carriers");
      if (!response.ok) {
        throw new Error("Failed to fetch carriers");
      }
      return response.json();
    },
  });
  
  // Delete schedule mutation
  const deleteScheduleMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/schedules/${id}`);
      return res.ok;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/schedules"] });
      toast({
        title: "Success",
        description: "Appointment deleted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Failed to delete appointment: ${error.message}`,
        variant: "destructive",
      });
    }
  });
  
  // Duplicate schedule mutation
  const duplicateScheduleMutation = useMutation({
    mutationFn: async (schedule: Schedule) => {
      // Create a new schedule based on the existing one
      const newSchedule = {
        ...schedule,
        // Remove ID so a new one is created
        id: undefined,
        // Update timestamps if needed
        createdAt: new Date(),
        createdBy: user?.id || 1,
        lastModifiedAt: null,
        lastModifiedBy: null,
        // You can customize the new start/end times or leave them as is
        // For example, you might want to schedule it for the next day
        status: "scheduled"
      };
      
      const res = await apiRequest("POST", "/api/schedules", newSchedule);
      if (!res.ok) {
        throw new Error("Failed to duplicate appointment");
      }
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/schedules"] });
      toast({
        title: "Success",
        description: "Appointment duplicated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Failed to duplicate appointment: ${error.message}`,
        variant: "destructive",
      });
    }
  });
  
  const handleEditClick = (schedule: Schedule) => {
    // For now, we'll just redirect to the schedule page with the ID
    window.location.href = `/schedules?edit=${schedule.id}`;
  };
  
  const handleDeleteClick = (schedule: Schedule) => {
    deleteScheduleMutation.mutate(schedule.id);
  };
  
  const handleDuplicateClick = (schedule: Schedule) => {
    duplicateScheduleMutation.mutate(schedule);
  };
  
  // Get appointment type badge
  const getAppointmentTypeBadge = (type: string) => {
    switch (type.toLowerCase()) {
      case "inbound":
        return <Badge className="bg-green-500">Inbound</Badge>;
      case "outbound":
        return <Badge className="bg-blue-500">Outbound</Badge>;
      default:
        return <Badge>{type}</Badge>;
    }
  };
  
  // Get appointment status badge
  const getAppointmentStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case "scheduled":
        return <Badge variant="outline" className="border-blue-500 text-blue-500">Scheduled</Badge>;
      case "in-progress":
        return <Badge variant="outline" className="border-yellow-500 text-yellow-500">In Progress</Badge>;
      case "completed":
        return <Badge variant="outline" className="border-green-500 text-green-500">Completed</Badge>;
      case "cancelled":
        return <Badge variant="outline" className="border-red-500 text-red-500">Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };
  
  // Get dock name from ID
  const getDockName = (dockId: number) => {
    if (!docks) return "Loading...";
    const dock = docks.find((d: any) => d.id === dockId);
    return dock ? dock.name : `Dock #${dockId}`;
  };
  
  // Get carrier name from ID
  const getCarrierName = (carrierId: number) => {
    if (!carriers) return "Loading...";
    const carrier = carriers.find((c: any) => c.id === carrierId);
    return carrier ? carrier.name : `Carrier #${carrierId}`;
  };
  
  // Sort schedules by date (newest first)
  const sortedSchedules = useMemo(() => {
    if (!schedules) return [];
    return [...schedules].sort((a, b) => 
      new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
    );
  }, [schedules]);

  if (isLoading) {
    return (
      <div className="container mx-auto py-6 flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-6">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          Error loading appointments: {error.message}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Appointments</h1>
        <Button onClick={() => window.location.href = "/schedules"}>
          <Plus className="mr-2 h-4 w-4" /> New Appointment
        </Button>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>All Appointments</CardTitle>
          <CardDescription>
            Showing {sortedSchedules.length} total appointments
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date & Time</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Carrier</TableHead>
                <TableHead>Truck #</TableHead>
                <TableHead>Dock</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedSchedules.map((schedule) => (
                <TableRow key={schedule.id}>
                  <TableCell>
                    <div className="font-medium">{formatDate(schedule.startTime)}</div>
                    <div className="text-muted-foreground text-sm">{formatTime(schedule.startTime)} - {formatTime(schedule.endTime)}</div>
                  </TableCell>
                  <TableCell>{getAppointmentTypeBadge(schedule.type)}</TableCell>
                  <TableCell>{getCarrierName(schedule.carrierId)}</TableCell>
                  <TableCell>{schedule.truckNumber}</TableCell>
                  <TableCell>{getDockName(schedule.dockId)}</TableCell>
                  <TableCell>{getAppointmentStatusBadge(schedule.status)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleEditClick(schedule)}>
                        <PenIcon className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleDuplicateClick(schedule)}
                        className="text-blue-500 border-blue-200 hover:bg-blue-50"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" size="sm">
                            <TrashIcon className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This action cannot be undone. This will permanently delete the appointment
                              scheduled for {formatDate(schedule.startTime)} at {formatTime(schedule.startTime)}.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteClick(schedule)}>
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              
              {sortedSchedules.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                      <Calendar className="h-10 w-10 mb-2" />
                      <p>No appointments found</p>
                      <Button variant="link" onClick={() => window.location.href = "/schedules"}>
                        Create your first appointment
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      {/* Additional Cards for Quick Info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center">
              <Truck className="mr-2 h-5 w-5" /> Today's Appointments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {sortedSchedules.filter(s => 
                new Date(s.startTime).toDateString() === new Date().toDateString()
              ).length}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center">
              <Clock className="mr-2 h-5 w-5" /> Upcoming (Next 7 Days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {sortedSchedules.filter(s => {
                const scheduleDate = new Date(s.startTime);
                const today = new Date();
                const nextWeek = new Date();
                nextWeek.setDate(today.getDate() + 7);
                return scheduleDate >= today && scheduleDate <= nextWeek;
              }).length}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center">
              <MapPin className="mr-2 h-5 w-5" /> Available Docks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {docks?.filter((d: any) => d.isActive).length || 0}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}