import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Schedule, Dock, Carrier } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlusCircle, Calendar as CalendarIcon, ListFilter, Grid, List } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { DataTable } from "@/components/ui/data-table";
import ScheduleCalendar from "@/components/schedules/schedule-calendar";
import ScheduleForm from "@/components/schedules/schedule-form";
import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatTime } from "@/lib/utils";

export default function Schedules() {
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editScheduleId, setEditScheduleId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<"calendar" | "list">("calendar");
  
  // Fetch schedules
  const { data: schedules = [] } = useQuery<Schedule[]>({
    queryKey: ["/api/schedules"],
  });
  
  // Fetch docks
  const { data: docks = [] } = useQuery<Dock[]>({
    queryKey: ["/api/docks"],
  });
  
  // Fetch carriers
  const { data: carriers = [] } = useQuery<Carrier[]>({
    queryKey: ["/api/carriers"],
  });
  
  // Schedule being edited
  const scheduleToEdit = editScheduleId 
    ? schedules.find(s => s.id === editScheduleId) 
    : undefined;
  
  // Handle schedule selection
  const handleScheduleClick = (scheduleId: number) => {
    setEditScheduleId(scheduleId);
    setIsFormOpen(true);
  };
  
  // Columns for the data table
  const columns: ColumnDef<Schedule>[] = [
    {
      accessorKey: "truckNumber",
      header: "Truck #",
    },
    {
      accessorKey: "carrierId",
      header: "Carrier",
      cell: ({ row }) => {
        const carrierId = row.getValue("carrierId") as number;
        const carrier = carriers.find(c => c.id === carrierId);
        return carrier?.name || "Unknown";
      },
    },
    {
      accessorKey: "dockId",
      header: "Dock",
      cell: ({ row }) => {
        const dockId = row.getValue("dockId") as number;
        const dock = docks.find(d => d.id === dockId);
        return dock?.name || "Unknown";
      },
    },
    {
      accessorKey: "startTime",
      header: "Start Time",
      cell: ({ row }) => {
        const startTime = row.getValue("startTime") as string;
        return formatTime(startTime);
      },
    },
    {
      accessorKey: "endTime",
      header: "End Time",
      cell: ({ row }) => {
        const endTime = row.getValue("endTime") as string;
        return formatTime(endTime);
      },
    },
    {
      accessorKey: "type",
      header: "Type",
      cell: ({ row }) => {
        const type = row.getValue("type") as string;
        return (
          <Badge variant={type === "inbound" ? "default" : "secondary"}>
            {type.charAt(0).toUpperCase() + type.slice(1)}
          </Badge>
        );
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = row.getValue("status") as string;
        let variant: "default" | "secondary" | "destructive" | "outline" = "default";
        
        switch(status) {
          case "scheduled":
            variant = "outline";
            break;
          case "in-progress":
            variant = "default";
            break;
          case "completed":
            variant = "secondary";
            break;
          case "cancelled":
            variant = "destructive";
            break;
        }
        
        return (
          <Badge variant={variant}>
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </Badge>
        );
      },
    },
    {
      id: "actions",
      cell: ({ row }) => {
        return (
          <Button 
            variant="ghost" 
            onClick={() => handleScheduleClick(row.original.id)}
            className="p-0 h-8 px-2"
          >
            Edit
          </Button>
        );
      },
    },
  ];
  
  // Filter schedules for the selected date
  const filteredSchedules = schedules.filter(schedule => {
    const scheduleDate = new Date(schedule.startTime);
    return (
      scheduleDate.getDate() === selectedDate.getDate() &&
      scheduleDate.getMonth() === selectedDate.getMonth() &&
      scheduleDate.getFullYear() === selectedDate.getFullYear()
    );
  });

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-medium">Schedules</h2>
        <Button 
          onClick={() => {
            setEditScheduleId(null);
            setIsFormOpen(true);
          }}
          className="bg-primary text-white"
        >
          <PlusCircle className="h-4 w-4 mr-2" />
          New Schedule
        </Button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Date picker card */}
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">Select Date</CardTitle>
          </CardHeader>
          <CardContent>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && setSelectedDate(date)}
              className="rounded-md border w-full"
            />
          </CardContent>
        </Card>
        
        {/* Schedules content */}
        <div className="md:col-span-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">
                Schedules for {format(selectedDate, "MMMM d, yyyy")}
              </CardTitle>
              <div className="flex items-center space-x-2">
                <Button variant="outline" size="sm">
                  <ListFilter className="h-4 w-4 mr-2" />
                  Filter
                </Button>
                <Tabs defaultValue={viewMode} onValueChange={(v) => setViewMode(v as "calendar" | "list")}>
                  <TabsList className="grid w-[120px] grid-cols-2">
                    <TabsTrigger value="calendar">
                      <CalendarIcon className="h-4 w-4" />
                    </TabsTrigger>
                    <TabsTrigger value="list">
                      <List className="h-4 w-4" />
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </CardHeader>
            <CardContent>
              {viewMode === "calendar" ? (
                <ScheduleCalendar 
                  schedules={filteredSchedules}
                  docks={docks}
                  date={selectedDate}
                  onScheduleClick={handleScheduleClick}
                />
              ) : (
                <DataTable 
                  columns={columns} 
                  data={filteredSchedules} 
                  searchKey="truckNumber"
                  searchPlaceholder="Search by truck number..."
                />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      
      <ScheduleForm 
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        initialData={scheduleToEdit}
        mode={editScheduleId ? "edit" : "create"}
      />
    </div>
  );
}
