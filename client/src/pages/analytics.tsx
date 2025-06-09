import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Schedule } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import PerformanceChart from "@/components/analytics/performance-chart";
import MetricBar from "@/components/dashboard/metric-bar";
import AnalyticsHeatMap from "@/components/analytics/heat-map";
import PerformanceMetrics from "@/components/analytics/performance-metrics";
import EnhancedFacilityReport from "@/components/analytics/enhanced-facility-report";
import { Download, Calendar as CalendarIcon, BarChart2, FileText, Clock, BarChart } from "lucide-react";
import { format, subDays, subMonths, startOfWeek, endOfWeek, addDays } from "date-fns";

// Type definitions for the API responses
interface FacilityData {
  id: number;
  name: string;
  address: string;
  appointmentCount: number;
}

interface CarrierData {
  id: number;
  name: string;
  appointmentCount: number;
}

interface CustomerData {
  id: number;
  name: string;
  appointmentCount: number;
}

interface AttendanceData {
  attendanceStatus: string;
  count: number;
}

interface DockUtilizationData {
  dock_id: number;
  dock_name: string;
  facility_name: string;
  used_hours: number;
  total_hours: number;
  utilization_percentage: number;
}

// Separate hooks from components for better reusability
function useFacilityStatsQuery(dateParams: { startDate?: string; endDate?: string }) {
  return useQuery<FacilityData[]>({
    queryKey: ['/api/analytics/facilities', dateParams],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (dateParams.startDate) params.append('startDate', dateParams.startDate);
      if (dateParams.endDate) params.append('endDate', dateParams.endDate);
      
      console.log("Query params:", params.toString());
      const res = await fetch(`/api/analytics/facilities?${params.toString()}`, {
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to fetch facility data');
      const data = await res.json();
      console.log("Facility data:", data);
      return data;
    }
  });
}

// Component for rendering facility stats
function FacilityStatsChart({ data, isLoading, error }: { 
  data?: FacilityData[]; 
  isLoading: boolean; 
  error: any; 
}) {
  if (isLoading) {
    return <div className="flex justify-center p-8">Loading facility data...</div>;
  }

  if (error) {
    console.error("Error loading facility data:", error);
    return (
      <div className="p-4 border border-red-200 rounded-md bg-red-50 text-red-700">
        Error loading facility data. Please try again later.
      </div>
    );
  }

  if (data && data.length > 0) {
    const chartData = data.map(facility => ({
      date: facility.name + (facility.address ? ` (${facility.address})` : ''),
      value: Number(facility.appointmentCount)
    }));

    return (
      <PerformanceChart 
        data={chartData}
        yAxisLabel="Events Count"
        color="#4285F4"
        target={0}
        hideTarget={true}
        horizontal={true}
      />
    );
  }

  return (
    <div className="p-4 border border-blue-200 rounded-md bg-blue-50 text-blue-700">
      No facility data available for the selected period.
    </div>
  );
}

// Hook to get carrier statistics with date parameters
function useCarrierStats(dateParams: { startDate?: string; endDate?: string }) {
  const { data: carrierData, isLoading, error } = useQuery<CarrierData[]>({
    queryKey: ['/api/analytics/carriers', dateParams],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (dateParams.startDate) params.append('startDate', dateParams.startDate);
      if (dateParams.endDate) params.append('endDate', dateParams.endDate);
      
      console.log("Carrier query params:", params.toString());
      const res = await fetch(`/api/analytics/carriers?${params.toString()}`, {
        credentials: 'include' // Include credentials for authentication
      });
      if (!res.ok) throw new Error('Failed to fetch carrier data');
      const data = await res.json();
      console.log("Carrier data:", data);
      return data;
    }
  });

  if (isLoading) {
    return <div className="flex justify-center p-8">Loading carrier data...</div>;
  }

  if (error) {
    console.error("Error loading carrier data:", error);
    return (
      <div className="p-4 border border-red-200 rounded-md bg-red-50 text-red-700">
        Error loading carrier data. Please try again later.
      </div>
    );
  }

  // If we have data, format it for the chart
  if (carrierData && carrierData.length > 0) {
    const chartData = carrierData.map(carrier => ({
      date: carrier.name,
      value: Number(carrier.appointmentCount) // Convert string to number
    }));

    return (
      <PerformanceChart 
        data={chartData}
        yAxisLabel="Events Count"
        color="#34A853"
        target={0}
        hideTarget={true}
        horizontal={true}
      />
    );
  }

  // Fallback for empty data
  return (
    <div className="p-4 border border-blue-200 rounded-md bg-blue-50 text-blue-700">
      No carrier data available for the selected period.
    </div>
  );
}

// Hook to get customer statistics with date parameters
function useCustomerStats(dateParams: { startDate?: string; endDate?: string }) {
  const { data: customerData, isLoading, error } = useQuery<CustomerData[]>({
    queryKey: ['/api/analytics/customers', dateParams],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (dateParams.startDate) params.append('startDate', dateParams.startDate);
      if (dateParams.endDate) params.append('endDate', dateParams.endDate);
      
      const res = await fetch(`/api/analytics/customers?${params.toString()}`, {
        credentials: 'include' // Include credentials for authentication
      });
      if (!res.ok) throw new Error('Failed to fetch customer data');
      return res.json();
    }
  });

  if (isLoading) {
    return <div className="flex justify-center p-8">Loading customer data...</div>;
  }

  if (error) {
    console.error("Error loading customer data:", error);
    return (
      <div className="p-4 border border-red-200 rounded-md bg-red-50 text-red-700">
        Error loading customer data. Please try again later.
      </div>
    );
  }

  // If we have data, format it for the chart
  if (customerData && customerData.length > 0) {
    const chartData = customerData.map(customer => ({
      date: customer.name,
      value: Number(customer.appointmentCount) // Convert string to number
    }));

    return (
      <PerformanceChart 
        data={chartData}
        yAxisLabel="Events Count"
        color="#EA4335"
        target={0}
        hideTarget={true}
        horizontal={true}
      />
    );
  }

  // Fallback for empty data
  return (
    <div className="p-4 border border-blue-200 rounded-md bg-blue-50 text-blue-700">
      No customer data available for the selected period.
    </div>
  );
}

// Hook to get attendance statistics with date parameters
function useAttendanceStats(dateParams: { startDate?: string; endDate?: string }) {
  const { data: attendanceData, isLoading, error } = useQuery<AttendanceData[]>({
    queryKey: ['/api/analytics/attendance', dateParams],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (dateParams.startDate) params.append('startDate', dateParams.startDate);
      if (dateParams.endDate) params.append('endDate', dateParams.endDate);
      
      console.log("Attendance query params:", params.toString());
      const res = await fetch(`/api/analytics/attendance?${params.toString()}`, {
        credentials: 'include' // Include credentials for authentication
      });
      if (!res.ok) throw new Error('Failed to fetch attendance data');
      const data = await res.json();
      console.log("Attendance data:", data);
      return data;
    }
  });

  if (isLoading) {
    return <div className="flex justify-center p-8">Loading attendance data...</div>;
  }

  if (error) {
    console.error("Error loading attendance data:", error);
    return (
      <div className="p-4 border border-red-200 rounded-md bg-red-50 text-red-700">
        Error loading attendance data. Please try again later.
      </div>
    );
  }

  // If we have data, format it for the chart
  if (attendanceData && attendanceData.length > 0) {
    const chartData = attendanceData.map(item => ({
      date: item.attendanceStatus,
      value: Number(item.count) // Convert string to number
    }));

    return (
      <PerformanceChart 
        data={chartData}
        yAxisLabel="Events Count"
        color="#FBBC05"
        target={0}
        hideTarget={true}
        horizontal={true}
      />
    );
  }

  // Fallback for empty data
  return (
    <div className="p-4 border border-blue-200 rounded-md bg-blue-50 text-blue-700">
      No attendance data available for the selected period.
    </div>
  );
}

// Hook to get dock utilization statistics with date parameters
function useDockUtilizationStats(dateParams: { startDate?: string; endDate?: string }) {
  const { data: utilizationData, isLoading, error } = useQuery<DockUtilizationData[]>({
    queryKey: ['/api/analytics/dock-utilization', dateParams],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (dateParams.startDate) params.append('startDate', dateParams.startDate);
      if (dateParams.endDate) params.append('endDate', dateParams.endDate);
      
      console.log("Dock utilization query params:", params.toString());
      const res = await fetch(`/api/analytics/dock-utilization?${params.toString()}`, {
        credentials: 'include' // Include credentials for authentication
      });
      if (!res.ok) throw new Error('Failed to fetch dock utilization data');
      const data = await res.json();
      console.log("Dock utilization data:", data);
      return data;
    }
  });

  if (isLoading) {
    return <div className="flex justify-center p-8">Loading dock utilization data...</div>;
  }

  if (error) {
    console.error("Error loading dock utilization data:", error);
    return (
      <div className="p-4 border border-red-200 rounded-md bg-red-50 text-red-700">
        Error loading dock utilization data. Please try again later.
      </div>
    );
  }

  // If we have data, format it for the chart
  if (utilizationData && utilizationData.length > 0) {
    const chartData = utilizationData.map(dock => ({
      date: `${dock.dock_name} (${dock.facility_name})`,
      value: Number(dock.utilization_percentage) // Convert string to number
    }));

    return (
      <PerformanceChart 
        data={chartData}
        yAxisLabel="Utilization %"
        color="#673AB7"
        target={75}
        hideTarget={false}
        horizontal={true}
        suffix="%"
      />
    );
  }

  // Fallback for empty data
  return (
    <div className="p-4 border border-blue-200 rounded-md bg-blue-50 text-blue-700">
      No dock utilization data available for the selected period.
    </div>
  );
}

// Function to export data to CSV
function exportToCSV(dataType: 'facilities' | 'carriers' | 'customers' | 'attendance' | 'dock-utilization', dateParams?: any) {
  const endpoint = `/api/analytics/${dataType}`;
  const params = new URLSearchParams();
  if (dateParams?.startDate) params.append('startDate', dateParams.startDate);
  if (dateParams?.endDate) params.append('endDate', dateParams.endDate);
  
  fetch(`${endpoint}?${params.toString()}`, {
      credentials: 'include' // Include credentials for authentication
    })
    .then(response => response.json())
    .then(data => {
      // Convert data to CSV
      let csvContent = '';
      
      // Add headers based on data type
      if (dataType === 'facilities') {
        csvContent = 'ID,Facility Name,Address,Appointment Count\n';
        data.forEach((item: FacilityData) => {
          csvContent += `${item.id},"${item.name}","${item.address || ''}",${item.appointmentCount}\n`;
        });
      } else if (dataType === 'carriers') {
        csvContent = 'ID,Carrier Name,Appointment Count\n';
        data.forEach((item: CarrierData) => {
          csvContent += `${item.id},"${item.name}",${item.appointmentCount}\n`;
        });
      } else if (dataType === 'customers') {
        csvContent = 'ID,Customer Name,Appointment Count\n';
        data.forEach((item: CustomerData) => {
          csvContent += `${item.id},"${item.name}",${item.appointmentCount}\n`;
        });
      } else if (dataType === 'attendance') {
        csvContent = 'Attendance Status,Count\n';
        data.forEach((item: AttendanceData) => {
          csvContent += `"${item.attendanceStatus}",${item.count}\n`;
        });
      } else if (dataType === 'dock-utilization') {
        csvContent = 'Dock ID,Dock Name,Facility Name,Used Hours,Total Hours,Utilization Percentage\n';
        data.forEach((item: DockUtilizationData) => {
          csvContent += `${item.dock_id},"${item.dock_name}","${item.facility_name}",${item.used_hours},${item.total_hours},${item.utilization_percentage}\n`;
        });
      }
      
      // Create a blob and download it
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      
      link.setAttribute('href', url);
      link.setAttribute('download', `${dataType}_report_${format(new Date(), 'yyyy-MM-dd')}.csv`);
      link.style.visibility = 'hidden';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    })
    .catch(error => {
      console.error(`Error exporting ${dataType} data:`, error);
      alert(`Failed to export ${dataType} data. Please try again later.`);
    });
}

export default function Analytics() {
  const [dateRange, setDateRange] = useState<"last7Days" | "last30Days" | "last90Days" | "allTime" | "custom">("last90Days");
  const [startDate, setStartDate] = useState<Date>(subDays(new Date(), 90));
  const [endDate, setEndDate] = useState<Date>(addDays(new Date(), 365)); // Include future dates for test data
  const [showDatePickerDialog, setShowDatePickerDialog] = useState(false);
  
  // Calculate date range for the query
  const getDateRange = () => {
    const now = new Date();
    
    switch (dateRange) {
      case "last7Days":
        return { start: subDays(now, 7), end: now };
      case "last30Days":
        return { start: subDays(now, 30), end: now };
      case "last90Days":
        return { start: subDays(now, 90), end: addDays(now, 365) }; // Include future data for testing
      case "allTime":
        return { 
          start: new Date('2020-01-01'), // Very wide range to capture all test data
          end: new Date('2030-12-31') 
        };
      case "custom":
        return { start: startDate, end: endDate };
    }
  };
  
  // Calculate date range for API params
  const apiDateRange = () => {
    const { start, end } = getDateRange();
    const startDateStr = format(start, 'yyyy-MM-dd');
    const endDateStr = format(end, 'yyyy-MM-dd');
    
    // Add debugging to help identify date range issues
    console.log(`[Analytics] Date range: ${startDateStr} to ${endDateStr}`);
    
    return {
      startDate: startDateStr,
      endDate: endDateStr
    };
  };

  // Date params for API calls
  const dateParams = apiDateRange();

  // Formatted date range display
  const dateRangeDisplay = () => {
    const { start, end } = getDateRange();
    return `${format(start, 'MMM d, yyyy')} - ${format(end, 'MMM d, yyyy')}`;
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-medium">Analytics & Reports</h2>
        <div className="flex gap-2">
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export All Reports
          </Button>
        </div>
      </div>
      
      {/* Main date filter at the top */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Report Date Range</CardTitle>
          <CardDescription>All analytics data will be filtered to this date range</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-end">
            <div className="w-full md:w-64">
              <label className="text-sm font-medium mb-1 block">Date Range</label>
              <Select value={dateRange} onValueChange={(value) => setDateRange(value as any)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select date range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="last7Days">Last 7 Days</SelectItem>
                  <SelectItem value="last30Days">Last 30 Days</SelectItem>
                  <SelectItem value="last90Days">Last 90 Days</SelectItem>
                  <SelectItem value="allTime">All Time</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {dateRange === "custom" && (
              <>
                <div className="w-full md:w-auto">
                  <label className="text-sm font-medium mb-1 block">Start Date</label>
                  <Button 
                    variant="outline" 
                    className="w-full justify-start text-left font-normal"
                    onClick={() => setShowDatePickerDialog(true)}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(startDate, "MMMM d, yyyy")}
                  </Button>
                </div>
                <div className="w-full md:w-auto">
                  <label className="text-sm font-medium mb-1 block">End Date</label>
                  <Button 
                    variant="outline" 
                    className="w-full justify-start text-left font-normal"
                    onClick={() => setShowDatePickerDialog(true)}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(endDate, "MMMM d, yyyy")}
                  </Button>
                </div>
              </>
            )}
            
            <div className="flex-1 md:text-right">
              <div className="text-sm text-muted-foreground mb-1 md:mb-2">Current Range</div>
              <div className="font-medium">{dateRangeDisplay()}</div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Performance Metrics Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2">
          {(() => {
            const facilityStatsQuery = useFacilityStatsQuery(dateParams);
            return facilityStatsQuery.isLoading ? (
              <div className="h-96 flex items-center justify-center">Loading facility data...</div>
            ) : (
              <EnhancedFacilityReport 
                data={facilityStatsQuery.data || []} 
                dateRange={dateRangeDisplay()} 
              />
            );
          })()}
        </div>
        <div>
          <PerformanceMetrics 
            facilityFilter="All Facilities"
            dateRange={dateRangeDisplay()}
          />
        </div>
      </div>
      
      {/* Heatmap */}
      <div className="mb-6">
        <AnalyticsHeatMap dateRange={dateParams} />
      </div>
      
      {/* Two-column charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Customer Stats */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-lg">Customer Report</CardTitle>
                <CardDescription>Appointment counts by customer</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => exportToCSV('customers', dateParams)}>
                <Download className="h-4 w-4 mr-2" /> Export
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {useCustomerStats(dateParams)}
          </CardContent>
        </Card>
        
        {/* Carrier Stats */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-lg">Carrier Report</CardTitle>
                <CardDescription>Appointment counts by carrier</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => exportToCSV('carriers', dateParams)}>
                <Download className="h-4 w-4 mr-2" /> Export
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {useCarrierStats(dateParams)}
          </CardContent>
        </Card>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Attendance Stats */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-lg">Attendance Report</CardTitle>
                <CardDescription>Counts by attendance status</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => exportToCSV('attendance', dateParams)}>
                <Download className="h-4 w-4 mr-2" /> Export
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {useAttendanceStats(dateParams)}
          </CardContent>
        </Card>
        
        {/* Dock Utilization */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-lg">Dock Utilization</CardTitle>
                <CardDescription>Utilization percentage by dock</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => exportToCSV('dock-utilization', dateParams)}>
                <Download className="h-4 w-4 mr-2" /> Export
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {useDockUtilizationStats(dateParams)}
          </CardContent>
        </Card>
      </div>
      
      {/* Available Reports */}
      <div>
        <h3 className="text-lg font-medium mb-4">Available Reports</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-md flex items-center">
                <FileText className="mr-2 h-5 w-5 text-blue-600" />
                Daily Activity Report
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-2">
              <p className="text-sm text-muted-foreground">
                Summary of all daily appointments and activity. Includes check-ins, check-outs, and dwell times.
              </p>
            </CardContent>
            <CardFooter>
              <Button variant="outline" size="sm" className="w-full">
                <Download className="h-4 w-4 mr-2" /> Generate
              </Button>
            </CardFooter>
          </Card>
          
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-md flex items-center">
                <BarChart2 className="mr-2 h-5 w-5 text-green-600" />
                Performance Metrics
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-2">
              <p className="text-sm text-muted-foreground">
                Detailed facility performance metrics including utilization, throughput, and efficiency rates.
              </p>
            </CardContent>
            <CardFooter>
              <Button variant="outline" size="sm" className="w-full">
                <Download className="h-4 w-4 mr-2" /> Generate
              </Button>
            </CardFooter>
          </Card>
          
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-md flex items-center">
                <Clock className="mr-2 h-5 w-5 text-amber-600" />
                Dwell Time Analysis
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-2">
              <p className="text-sm text-muted-foreground">
                Detailed analysis of carrier dwell times, tardiness, and efficiency by appointment type.
              </p>
            </CardContent>
            <CardFooter>
              <Button variant="outline" size="sm" className="w-full">
                <Download className="h-4 w-4 mr-2" /> Generate
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
      
      {/* Date Picker Dialog */}
      <Dialog open={showDatePickerDialog} onOpenChange={setShowDatePickerDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Select Date Range</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Start Date</label>
              <div className="border rounded-md p-3">
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={(date) => date && setStartDate(date)}
                  initialFocus
                  classNames={{
                    months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
                    month: "space-y-4",
                    caption: "flex justify-center pt-1 relative items-center",
                    caption_label: "text-sm font-medium",
                    nav: "space-x-1 flex items-center",
                    table: "w-full border-collapse space-y-1",
                    head_row: "flex",
                    head_cell: "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",
                    row: "flex w-full mt-2",
                    cell: "h-9 w-9 text-center text-sm p-0 relative",
                    day: "h-9 w-9 p-0 font-normal"
                  }}
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">End Date</label>
              <div className="border rounded-md p-3">
                <Calendar
                  mode="single"
                  selected={endDate}
                  onSelect={(date) => date && setEndDate(date)}
                  disabled={(date) => date < startDate}
                  classNames={{
                    months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
                    month: "space-y-4",
                    caption: "flex justify-center pt-1 relative items-center",
                    caption_label: "text-sm font-medium",
                    nav: "space-x-1 flex items-center",
                    table: "w-full border-collapse space-y-1",
                    head_row: "flex",
                    head_cell: "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",
                    row: "flex w-full mt-2",
                    cell: "h-9 w-9 text-center text-sm p-0 relative",
                    day: "h-9 w-9 p-0 font-normal"
                  }}
                />
              </div>
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={() => setShowDatePickerDialog(false)}>Apply</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}