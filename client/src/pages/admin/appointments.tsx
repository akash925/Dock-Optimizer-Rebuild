import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  Calendar, 
  Clock, 
  MapPin, 
  User, 
  Building, 
  Search, 
  Filter,
  Eye,
  ChevronLeft,
  ChevronRight,
  Download,
  RefreshCw
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import AdminLayout from "@/components/layout/admin-layout";
import { format, parseISO } from "date-fns";

// Types
interface Appointment {
  id: number;
  start_time: string;
  end_time: string;
  status: string;
  customer_name: string;
  driver_name: string;
  confirmation_code: string;
  notes: string;
  created_at: string;
  updated_at: string;
  organization_id: number;
  organization_name: string;
  organization_subdomain: string;
  facility_id: number;
  facility_name: string;
  facility_address: string;
  dock_id: number;
  dock_name: string;
  carrier_id: number;
  carrier_name: string;
  appointment_type_id: number;
  appointment_type_name: string;
  appointment_duration: number;
}

interface AppointmentDetails extends Appointment {
  organization_contact: string;
  facility_city: string;
  facility_state: string;
  facility_zip: string;
  carrier_phone: string;
  appointment_type_description: string;
  created_by_first_name: string;
  created_by_last_name: string;
  created_by_email: string;
}

interface CustomField {
  field_key: string;
  field_value: string;
  field_type: string;
}

interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

// Helper function to get status badge variant
const getStatusBadge = (status: string) => {
  const statusConfig = {
    'scheduled': { variant: 'secondary' as const, label: 'Scheduled' },
    'confirmed': { variant: 'default' as const, label: 'Confirmed' },
    'in-progress': { variant: 'secondary' as const, label: 'In Progress' },
    'completed': { variant: 'default' as const, label: 'Completed' },
    'cancelled': { variant: 'destructive' as const, label: 'Cancelled' },
    'no-show': { variant: 'destructive' as const, label: 'No Show' },
  };
  
  const config = statusConfig[status as keyof typeof statusConfig] || { variant: 'secondary' as const, label: status };
  return <Badge variant={config.variant}>{config.label}</Badge>;
};

// Appointment details modal component
function AppointmentDetailsModal({ appointmentId, open, onOpenChange }: {
  appointmentId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: details, isLoading, error: detailsError } = useQuery<{
    appointment: AppointmentDetails;
    customFields: CustomField[];
  }>({
    queryKey: [`/api/admin/appointments/${appointmentId}`],
    enabled: !!appointmentId && open,
    retry: 3,
    queryFn: async () => {
      if (!appointmentId) throw new Error('No appointment ID provided');
      const res = await fetch(`/api/admin/appointments/${appointmentId}`, {
        credentials: 'include'
      });
      if (!res.ok) {
        const errorText = await res.text();
        console.error(`Failed to fetch appointment ${appointmentId}:`, res.status, errorText);
        throw new Error(`Failed to fetch appointment details: ${res.status}`);
      }
      return res.json();
    }
  });

  if (!appointmentId) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Appointment Details
          </DialogTitle>
          <DialogDescription>
            Complete information for appointment #{appointmentId}
          </DialogDescription>
        </DialogHeader>
        
        {isLoading ? (
          <div className="flex items-center justify-center p-8">
            <RefreshCw className="h-6 w-6 animate-spin" />
          </div>
        ) : details ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Basic Information */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Basic Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <span className="font-medium">Status:</span>
                  <div className="mt-1">{getStatusBadge(details.appointment.status)}</div>
                </div>
                <div>
                  <span className="font-medium">Confirmation Code:</span>
                  <div className="mt-1 font-mono text-sm bg-gray-100 px-2 py-1 rounded">
                    {details.appointment.confirmation_code}
                  </div>
                </div>
                <div>
                  <span className="font-medium">Customer:</span>
                  <div className="mt-1">{details.appointment.customer_name || 'N/A'}</div>
                </div>
                <div>
                  <span className="font-medium">Driver:</span>
                  <div className="mt-1">{details.appointment.driver_name || 'N/A'}</div>
                </div>
                <div>
                  <span className="font-medium">Carrier:</span>
                  <div className="mt-1">{details.appointment.carrier_name || 'N/A'}</div>
                  {details.appointment.carrier_phone && (
                    <div className="text-sm text-muted-foreground">
                      {details.appointment.carrier_phone}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Timing Information */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Timing & Type
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <span className="font-medium">Start Time:</span>
                  <div className="mt-1">
                    {format(parseISO(details.appointment.start_time), 'PPP p')}
                  </div>
                </div>
                <div>
                  <span className="font-medium">End Time:</span>
                  <div className="mt-1">
                    {format(parseISO(details.appointment.end_time), 'PPP p')}
                  </div>
                </div>
                <div>
                  <span className="font-medium">Duration:</span>
                  <div className="mt-1">{details.appointment.appointment_duration} minutes</div>
                </div>
                <div>
                  <span className="font-medium">Appointment Type:</span>
                  <div className="mt-1">{details.appointment.appointment_type_name}</div>
                  {details.appointment.appointment_type_description && (
                    <div className="text-sm text-muted-foreground">
                      {details.appointment.appointment_type_description}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Location Information */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Location Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <span className="font-medium">Organization:</span>
                  <div className="mt-1 flex items-center gap-2">
                    {details.appointment.organization_name}
                    <Badge variant="outline" className="text-xs">
                      {details.appointment.organization_subdomain}
                    </Badge>
                  </div>
                  {details.appointment.organization_contact && (
                    <div className="text-sm text-muted-foreground">
                      {details.appointment.organization_contact}
                    </div>
                  )}
                </div>
                <div>
                  <span className="font-medium">Facility:</span>
                  <div className="mt-1">{details.appointment.facility_name}</div>
                  <div className="text-sm text-muted-foreground">
                    {details.appointment.facility_address}
                    {details.appointment.facility_city && `, ${details.appointment.facility_city}`}
                    {details.appointment.facility_state && `, ${details.appointment.facility_state}`}
                    {details.appointment.facility_zip && ` ${details.appointment.facility_zip}`}
                  </div>
                </div>
                <div>
                  <span className="font-medium">Dock:</span>
                  <div className="mt-1">{details.appointment.dock_name}</div>
                </div>
              </CardContent>
            </Card>

            {/* System Information */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Building className="h-4 w-4" />
                  System Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <span className="font-medium">Created By:</span>
                  <div className="mt-1">
                    {details.appointment.created_by_first_name && details.appointment.created_by_last_name
                      ? `${details.appointment.created_by_first_name} ${details.appointment.created_by_last_name}`
                      : 'N/A'
                    }
                  </div>
                  {details.appointment.created_by_email && (
                    <div className="text-sm text-muted-foreground">
                      {details.appointment.created_by_email}
                    </div>
                  )}
                </div>
                <div>
                  <span className="font-medium">Created:</span>
                  <div className="mt-1">
                    {format(parseISO(details.appointment.created_at), 'PPP p')}
                  </div>
                </div>
                <div>
                  <span className="font-medium">Last Updated:</span>
                  <div className="mt-1">
                    {format(parseISO(details.appointment.updated_at), 'PPP p')}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Notes */}
            {details.appointment.notes && (
              <div className="md:col-span-2">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Notes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="whitespace-pre-wrap text-sm bg-gray-50 p-3 rounded border">
                      {details.appointment.notes}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Custom Fields */}
            {details.customFields && details.customFields.length > 0 && (
              <div className="md:col-span-2">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Custom Fields</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {details.customFields.map((field: any, index: any) => (
                        <div key={index}>
                          <span className="font-medium">{field.field_key}:</span>
                          <div className="mt-1 text-sm">{field.field_value}</div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center p-8 text-muted-foreground">
            Failed to load appointment details
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function AdminAppointments() {
  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState({
    status: 'all',
    organizationId: 'all',
    search: '',
    startDate: '',
    endDate: ''
  });
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<number | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);

  // Fetch appointments
  const { data, isLoading, error, refetch } = useQuery<{
    appointments: Appointment[];
    pagination: PaginationInfo;
  }>({
    queryKey: ['/api/admin/appointments', currentPage, filters],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '20',
        ...filters
      });
      
      // Remove empty filters
      Object.entries(filters).forEach(([key, value]) => {
        if (!value || value === 'all') {
          params.delete(key);
        }
      });
      
      const res = await fetch(`/api/admin/appointments?${params.toString()}`, {
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to fetch appointments');
      return res.json();
    }
  });

  // Fetch organizations for filter dropdown
  const { data: organizations } = useQuery<Array<{
    id: number;
    name: string;
    subdomain: string;
  }>>({
    queryKey: ['/api/admin/orgs'],
    queryFn: async () => {
      const res = await fetch('/api/admin/orgs', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch organizations');
      return res.json();
    }
  });

  const handleViewDetails = (appointmentId: number) => {
    setSelectedAppointmentId(appointmentId);
    setDetailsModalOpen(true);
  };

  const handleExport = async () => {
    // TODO: Implement CSV export functionality
    console.log('Export functionality to be implemented');
  };

  if (error) {
    return (
      <AdminLayout>
        <div className="p-6">
          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-6">
              <div className="text-red-600">Failed to load appointments: {error.message}</div>
            </CardContent>
          </Card>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">System Appointments</h2>
            <p className="text-muted-foreground">
              View and manage appointments across all organizations
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button variant="outline" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filters & Search
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="md:col-span-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by customer, driver, confirmation code..."
                    value={filters.search}
                    onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <Select 
                value={filters.status} 
                onValueChange={(value: any) => setFilters(prev => ({ ...prev, status: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="in-progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                  <SelectItem value="no-show">No Show</SelectItem>
                </SelectContent>
              </Select>

              <Select 
                value={filters.organizationId} 
                onValueChange={(value: any) => setFilters(prev => ({ ...prev, organizationId: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Organization" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Organizations</SelectItem>
                  {organizations?.map((org: any) => <SelectItem key={org.id} value={org.id.toString()}>
                    {org.name}
                  </SelectItem>)}
                </SelectContent>
              </Select>

              <Button
                variant="outline" 
                onClick={() => {
                  setFilters({
                    status: 'all',
                    organizationId: 'all',
                    search: '',
                    startDate: '',
                    endDate: ''
                  });
                  setCurrentPage(1);
                }}
              >
                Clear Filters
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Results Summary */}
        {data && (
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div>
              Showing {((data.pagination.currentPage - 1) * data.pagination.itemsPerPage) + 1} to{' '}
              {Math.min(data.pagination.currentPage * data.pagination.itemsPerPage, data.pagination.totalItems)} of{' '}
              {data.pagination.totalItems} appointments
            </div>
          </div>
        )}

        {/* Appointments Table */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center p-8">
                <RefreshCw className="h-6 w-6 animate-spin mr-2" />
                Loading appointments...
              </div>
            ) : data?.appointments.length === 0 ? (
              <div className="text-center p-8 text-muted-foreground">
                No appointments found matching your criteria
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Confirmation</TableHead>
                    <TableHead>Date & Time</TableHead>
                    <TableHead>Customer / Driver</TableHead>
                    <TableHead>Organization</TableHead>
                    <TableHead>Facility & Dock</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.appointments.map((appointment: any) => <TableRow key={appointment.id}>
                    <TableCell>
                      <div className="font-mono text-sm">
                        {appointment.confirmation_code}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        #{appointment.id}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {format(parseISO(appointment.start_time), 'MMM d, yyyy')}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {format(parseISO(appointment.start_time), 'h:mm a')} - {format(parseISO(appointment.end_time), 'h:mm a')}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm font-medium">
                        {appointment.customer_name || 'N/A'}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Driver: {appointment.driver_name || 'N/A'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm font-medium">
                        {appointment.organization_name}
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {appointment.organization_subdomain}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm font-medium">
                        {appointment.facility_name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {appointment.dock_name}
                      </div>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(appointment.status)}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewDetails(appointment.id)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                    </TableCell>
                  </TableRow>)}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Pagination */}
        {data && data.pagination.totalPages > 1 && (
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Page {data.pagination.currentPage} of {data.pagination.totalPages}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={!data.pagination.hasPreviousPage}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => prev + 1)}
                disabled={!data.pagination.hasNextPage}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Appointment Details Modal */}
      <AppointmentDetailsModal
        appointmentId={selectedAppointmentId}
        open={detailsModalOpen}
        onOpenChange={setDetailsModalOpen}
      />
    </AdminLayout>
  );
} 