import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Schedule, Dock, Carrier } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatDate, formatTime } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import { PlusCircle, MoreVertical, Search, Calendar as CalendarIcon, Pencil, Trash2 } from "lucide-react";
import AppointmentForm from "@/components/schedules/appointment-form";

export default function AppointmentsPage() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingAppointment, setDeletingAppointment] = useState<Schedule | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editScheduleId, setEditScheduleId] = useState<number | null>(null);

  // Fetch all schedules
  const { data: schedules = [], isLoading: isLoadingSchedules } = useQuery<Schedule[]>({
    queryKey: ["/api/schedules"],
  });

  // Fetch all docks
  const { data: docks = [] } = useQuery<Dock[]>({
    queryKey: ["/api/docks"],
  });

  // Fetch all carriers
  const { data: carriers = [] } = useQuery<Carrier[]>({
    queryKey: ["/api/carriers"],
  });

  // Delete appointment
  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!deletingAppointment) return null;
      
      const res = await apiRequest("DELETE", `/api/schedules/${deletingAppointment.id}`, {});
      if (!res.ok) {
        throw new Error("Failed to delete appointment");
      }
      return true;
    },
    onSuccess: () => {
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: ["/api/schedules"] });
      setIsDeleteModalOpen(false);
      setDeletingAppointment(null);
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
    },
  });

  const handleDelete = () => {
    deleteMutation.mutate();
  };

  // Set up editing appointment
  const handleEditClick = (schedule: Schedule) => {
    setEditScheduleId(schedule.id);
    setIsFormOpen(true);
  };

  // Set up deleting appointment
  const handleDeleteClick = (schedule: Schedule) => {
    setDeletingAppointment(schedule);
    setIsDeleteModalOpen(true);
  };

  // Filter schedules
  const filteredSchedules = schedules.filter((schedule) => {
    const matchesSearch = searchQuery 
      ? schedule.truckNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        carriers.find(c => c.id === schedule.carrierId)?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        docks.find(d => d.id === schedule.dockId)?.name.toLowerCase().includes(searchQuery.toLowerCase())
      : true;
    
    const matchesDate = selectedDate
      ? new Date(schedule.startTime).toDateString() === selectedDate.toDateString()
      : true;
    
    return matchesSearch && matchesDate;
  });

  // Schedule being edited
  const scheduleToEdit = editScheduleId 
    ? schedules.find(s => s.id === editScheduleId) 
    : undefined;

  return (
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Appointments Management</h1>
        <Button onClick={() => {
          setEditScheduleId(null);
          setIsFormOpen(true);
        }}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Create Appointment
        </Button>
      </div>

      {/* Filter controls */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by truck #, carrier, or dock..."
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant={selectedDate ? "default" : "outline"}
              className={`w-full sm:w-auto justify-start text-left font-normal ${
                !selectedDate && "text-muted-foreground"
              }`}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {selectedDate ? formatDate(selectedDate) : "Filter by date"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => setSelectedDate(date)}
              initialFocus
            />
            {selectedDate && (
              <div className="p-3 border-t border-border flex justify-end">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setSelectedDate(undefined)}
                >
                  Clear
                </Button>
              </div>
            )}
          </PopoverContent>
        </Popover>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Appointments</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingSchedules ? (
            <div className="text-center py-4">Loading appointments...</div>
          ) : (
            <Table>
              <TableCaption>List of all scheduled appointments</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Truck #</TableHead>
                  <TableHead>Carrier</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Dock</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSchedules.map((schedule) => {
                  const carrier = carriers.find(c => c.id === schedule.carrierId);
                  const dock = docks.find(d => d.id === schedule.dockId);
                  return (
                    <TableRow key={schedule.id}>
                      <TableCell className="font-medium">{schedule.truckNumber}</TableCell>
                      <TableCell>{carrier?.name || "Unknown"}</TableCell>
                      <TableCell>{formatDate(schedule.startTime)}</TableCell>
                      <TableCell>
                        {formatTime(schedule.startTime)} - {formatTime(schedule.endTime)}
                      </TableCell>
                      <TableCell>{dock?.name || "Unknown"}</TableCell>
                      <TableCell>
                        <Badge variant={schedule.type === "inbound" ? "default" : "secondary"}>
                          {schedule.type.charAt(0).toUpperCase() + schedule.type.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={
                            schedule.status === "scheduled" ? "outline" :
                            schedule.status === "in-progress" ? "default" :
                            schedule.status === "completed" ? "secondary" :
                            "destructive"
                          }
                        >
                          {schedule.status.charAt(0).toUpperCase() + schedule.status.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {schedule.appointmentMode === "trailer" ? "Trailer" : "Container"}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => handleEditClick(schedule)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              className="text-red-500 focus:text-red-500" 
                              onClick={() => handleDeleteClick(schedule)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filteredSchedules.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-4">
                      {searchQuery || selectedDate 
                        ? "No appointments found matching your filters." 
                        : "No appointments found. Create your first appointment to get started."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Modal */}
      <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the appointment for truck #{deletingAppointment?.truckNumber}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => setIsDeleteModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete Appointment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Appointment Form */}
      <AppointmentForm 
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditScheduleId(null);
        }}
        initialData={scheduleToEdit}
        mode={editScheduleId ? "edit" : "create"}
        initialDate={selectedDate}
      />
    </div>
  );
}