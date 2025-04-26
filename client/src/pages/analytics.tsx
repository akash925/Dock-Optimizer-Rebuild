import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Schedule } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import PerformanceChart from "@/components/analytics/performance-chart";
import MetricBar from "@/components/dashboard/metric-bar";
import AnalyticsHeatMap from "@/components/analytics/heat-map";
import { Download, Calendar as CalendarIcon, BarChart2, FileText, Clock, BarChart } from "lucide-react";
import { format, subDays, subMonths, startOfWeek, endOfWeek, addDays } from "date-fns";

export default function Analytics() {
  const [dateRange, setDateRange] = useState<"last7Days" | "last30Days" | "last90Days" | "custom">("last7Days");
  const [metric, setMetric] = useState<"utilization" | "turnaround" | "onTime" | "dwell">("utilization");
  const [period, setPeriod] = useState<"daily" | "weekly" | "monthly">("daily");
  const [startDate, setStartDate] = useState<Date>(subDays(new Date(), 7));
  const [endDate, setEndDate] = useState<Date>(new Date());
  
  // State variables for heatmap
  const [activeView, setActiveView] = useState<"charts" | "heatmap">("charts");
  const [heatmapFilter, setHeatmapFilter] = useState({
    location: "all",
    appointment: "all",
    customer: "all", 
    carrier: "all"
  });
  
  // Fetch schedules
  const { data: schedules = [] } = useQuery<Schedule[]>({
    queryKey: ["/api/schedules"],
  });
  
  // Calculate date range for the query
  const getDateRange = () => {
    const now = new Date();
    
    switch (dateRange) {
      case "last7Days":
        return { start: subDays(now, 7), end: now };
      case "last30Days":
        return { start: subDays(now, 30), end: now };
      case "last90Days":
        return { start: subDays(now, 90), end: now };
      case "custom":
        return { start: startDate, end: endDate };
    }
  };
  
  // Calculate performance metrics 
  const calculateMetrics = () => {
    const { start, end } = getDateRange();
    
    // Filter schedules within date range
    const filteredSchedules = schedules.filter(s => {
      const scheduleDate = new Date(s.startTime);
      return scheduleDate >= start && scheduleDate <= end;
    });
    
    // Utilization calculation
    const utilization = calculateUtilizationData(filteredSchedules, period);
    
    // Average turnaround time
    const turnaround = calculateTurnaroundData(filteredSchedules, period);
    
    // On-time percentage
    const onTime = calculateOnTimeData(filteredSchedules, period);
    
    // Dwell time accuracy
    const dwell = calculateDwellData(filteredSchedules, period);
    
    return {
      utilization,
      turnaround,
      onTime,
      dwell
    };
  };
  
  // Generate sample chart data based on the metric and period
  const calculateUtilizationData = (schedules: Schedule[], period: string) => {
    // In a real app, this would calculate actual utilization based on schedules
    // For this example, generate some sample data
    const { start, end } = getDateRange();
    const data = [];
    
    if (period === "daily") {
      let currentDate = new Date(start);
      while (currentDate <= end) {
        data.push({
          date: format(currentDate, "yyyy-MM-dd"),
          value: Math.floor(65 + Math.random() * 25), // Random value between 65-90%
        });
        currentDate = addDays(currentDate, 1);
      }
    } else if (period === "weekly") {
      let currentWeekStart = startOfWeek(start);
      while (currentWeekStart <= end) {
        const weekEnd = endOfWeek(currentWeekStart);
        data.push({
          date: `${format(currentWeekStart, "MMM d")} - ${format(weekEnd, "MMM d")}`,
          value: Math.floor(70 + Math.random() * 20), // Random value between 70-90%
        });
        currentWeekStart = addDays(currentWeekStart, 7);
      }
    } else {
      // Monthly data
      for (let i = 0; i < 6; i++) {
        const monthDate = subMonths(new Date(), i);
        data.push({
          date: format(monthDate, "MMM yyyy"),
          value: Math.floor(75 + Math.random() * 15), // Random value between 75-90%
        });
      }
      data.reverse();
    }
    
    return data;
  };
  
  const calculateTurnaroundData = (schedules: Schedule[], period: string) => {
    // Similar structure to utilization but with turnaround times
    const { start, end } = getDateRange();
    const data = [];
    
    if (period === "daily") {
      let currentDate = new Date(start);
      while (currentDate <= end) {
        data.push({
          date: format(currentDate, "yyyy-MM-dd"),
          value: Math.floor(35 + Math.random() * 15), // Random minutes between 35-50
        });
        currentDate = addDays(currentDate, 1);
      }
    } else if (period === "weekly") {
      let currentWeekStart = startOfWeek(start);
      while (currentWeekStart <= end) {
        const weekEnd = endOfWeek(currentWeekStart);
        data.push({
          date: `${format(currentWeekStart, "MMM d")} - ${format(weekEnd, "MMM d")}`,
          value: Math.floor(37 + Math.random() * 10), // Random minutes between 37-47
        });
        currentWeekStart = addDays(currentWeekStart, 7);
      }
    } else {
      // Monthly data
      for (let i = 0; i < 6; i++) {
        const monthDate = subMonths(new Date(), i);
        data.push({
          date: format(monthDate, "MMM yyyy"),
          value: Math.floor(38 + Math.random() * 8), // Random minutes between 38-46
        });
      }
      data.reverse();
    }
    
    return data;
  };
  
  const calculateOnTimeData = (schedules: Schedule[], period: string) => {
    // Generate on-time percentage data
    const { start, end } = getDateRange();
    const data = [];
    
    if (period === "daily") {
      let currentDate = new Date(start);
      while (currentDate <= end) {
        data.push({
          date: format(currentDate, "yyyy-MM-dd"),
          value: Math.floor(85 + Math.random() * 15), // Random percentage between 85-100%
        });
        currentDate = addDays(currentDate, 1);
      }
    } else if (period === "weekly") {
      let currentWeekStart = startOfWeek(start);
      while (currentWeekStart <= end) {
        const weekEnd = endOfWeek(currentWeekStart);
        data.push({
          date: `${format(currentWeekStart, "MMM d")} - ${format(weekEnd, "MMM d")}`,
          value: Math.floor(88 + Math.random() * 12), // Random percentage between 88-100%
        });
        currentWeekStart = addDays(currentWeekStart, 7);
      }
    } else {
      // Monthly data
      for (let i = 0; i < 6; i++) {
        const monthDate = subMonths(new Date(), i);
        data.push({
          date: format(monthDate, "MMM yyyy"),
          value: Math.floor(90 + Math.random() * 10), // Random percentage between 90-100%
        });
      }
      data.reverse();
    }
    
    return data;
  };
  
  const calculateDwellData = (schedules: Schedule[], period: string) => {
    // Generate dwell time accuracy data
    const { start, end } = getDateRange();
    const data = [];
    
    if (period === "daily") {
      let currentDate = new Date(start);
      while (currentDate <= end) {
        data.push({
          date: format(currentDate, "yyyy-MM-dd"),
          value: Math.floor(75 + Math.random() * 20), // Random percentage between 75-95%
        });
        currentDate = addDays(currentDate, 1);
      }
    } else if (period === "weekly") {
      let currentWeekStart = startOfWeek(start);
      while (currentWeekStart <= end) {
        const weekEnd = endOfWeek(currentWeekStart);
        data.push({
          date: `${format(currentWeekStart, "MMM d")} - ${format(weekEnd, "MMM d")}`,
          value: Math.floor(78 + Math.random() * 17), // Random percentage between 78-95%
        });
        currentWeekStart = addDays(currentWeekStart, 7);
      }
    } else {
      // Monthly data
      for (let i = 0; i < 6; i++) {
        const monthDate = subMonths(new Date(), i);
        data.push({
          date: format(monthDate, "MMM yyyy"),
          value: Math.floor(80 + Math.random() * 15), // Random percentage between 80-95%
        });
      }
      data.reverse();
    }
    
    return data;
  };
  
  // Get chart data based on selected metric
  const getChartData = () => {
    const metrics = calculateMetrics();
    
    switch (metric) {
      case "utilization":
        return {
          data: metrics.utilization,
          title: "Dock Utilization",
          yAxisLabel: "Utilization (%)",
          target: 75,
          color: "#1976d2", // Primary color
          suffix: "%"
        };
      case "turnaround":
        return {
          data: metrics.turnaround,
          title: "Average Turnaround Time",
          yAxisLabel: "Minutes",
          target: 35,
          color: "#f57c00", // Accent color
          suffix: " min"
        };
      case "onTime":
        return {
          data: metrics.onTime,
          title: "On-Time Arrivals",
          yAxisLabel: "Percentage (%)",
          target: 90,
          color: "#4caf50", // Success color
          suffix: "%"
        };
      case "dwell":
        return {
          data: metrics.dwell,
          title: "Dwell Time Accuracy",
          yAxisLabel: "Accuracy (%)",
          target: 85,
          color: "#2196f3", // Info color
          suffix: "%"
        };
    }
  };
  
  const chartConfig = getChartData();
  
  // Calculate summary metrics
  const calculateSummary = () => {
    const metrics = calculateMetrics();
    
    // Average the values for each metric
    const avgUtilization = Math.round(
      metrics.utilization.reduce((sum, item) => sum + item.value, 0) / metrics.utilization.length
    );
    
    const avgTurnaround = Math.round(
      metrics.turnaround.reduce((sum, item) => sum + item.value, 0) / metrics.turnaround.length
    );
    
    const avgOnTime = Math.round(
      metrics.onTime.reduce((sum, item) => sum + item.value, 0) / metrics.onTime.length
    );
    
    const avgDwell = Math.round(
      metrics.dwell.reduce((sum, item) => sum + item.value, 0) / metrics.dwell.length
    );
    
    return {
      utilization: avgUtilization,
      turnaround: avgTurnaround,
      onTime: avgOnTime,
      dwell: avgDwell
    };
  };
  
  const summary = calculateSummary();

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-medium">Analytics & Reports</h2>
        <div className="flex gap-2">
          <Tabs defaultValue="charts" className="mr-4">
            <TabsList>
              <TabsTrigger 
                value="charts" 
                onClick={() => setActiveView("charts")}
                className={activeView === "charts" ? "bg-primary text-primary-foreground" : ""}
              >
                Charts
              </TabsTrigger>
              <TabsTrigger 
                value="heatmap" 
                onClick={() => setActiveView("heatmap")}
                className={activeView === "heatmap" ? "bg-primary text-primary-foreground" : ""}
              >
                Heatmap
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>
      
      {activeView === "charts" ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
            <Card className="col-span-1">
              <CardHeader>
                <CardTitle className="text-lg">Filters</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Date Range</label>
                  <Select value={dateRange} onValueChange={(value) => setDateRange(value as any)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select date range" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="last7Days">Last 7 Days</SelectItem>
                      <SelectItem value="last30Days">Last 30 Days</SelectItem>
                      <SelectItem value="last90Days">Last 90 Days</SelectItem>
                      <SelectItem value="custom">Custom Range</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {dateRange === "custom" && (
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium mb-1 block">Start Date</label>
                      <div className="border rounded-md p-3">
                        <Calendar
                          mode="single"
                          selected={startDate}
                          onSelect={(date) => date && setStartDate(date)}
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
                        />
                      </div>
                    </div>
                  </div>
                )}
                
                <div>
                  <label className="text-sm font-medium mb-1 block">Metric</label>
                  <Select value={metric} onValueChange={(value) => setMetric(value as any)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select metric" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="utilization">Dock Utilization</SelectItem>
                      <SelectItem value="turnaround">Turnaround Time</SelectItem>
                      <SelectItem value="onTime">On-Time Arrivals</SelectItem>
                      <SelectItem value="dwell">Dwell Time Accuracy</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <label className="text-sm font-medium mb-1 block">Period</label>
                  <Select value={period} onValueChange={(value) => setPeriod(value as any)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select period" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
            
            <Card className="col-span-3">
              <CardHeader>
                <CardTitle className="text-lg">{chartConfig.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <PerformanceChart 
                  data={chartConfig.data}
                  yAxisLabel={chartConfig.yAxisLabel}
                  color={chartConfig.color}
                  target={chartConfig.target}
                  suffix={chartConfig.suffix}
                />
              </CardContent>
            </Card>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Summary Metrics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <MetricBar 
                  label="Dock Utilization" 
                  value={summary.utilization} 
                  target={75}
                  suffix="%"
                />
                <MetricBar 
                  label="Average Turnaround Time" 
                  value={summary.turnaround} 
                  target={35}
                  suffix=" min"
                />
                <MetricBar 
                  label="On-Time Arrivals" 
                  value={summary.onTime} 
                  target={90}
                  suffix="%"
                />
                <MetricBar 
                  label="Dwell Time Accuracy" 
                  value={summary.dwell} 
                  target={85}
                  suffix="%"
                />
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Performance Insights</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-4 border rounded-md bg-blue-50 border-blue-200">
                    <h3 className="font-medium text-blue-800 mb-1">Dock Utilization Trend</h3>
                    <p className="text-sm text-blue-700">
                      Dock utilization is {summary.utilization > 75 ? "above" : "below"} the target of 75%. 
                      {summary.utilization > 75 
                        ? " This indicates efficient use of available dock doors." 
                        : " There may be opportunities to improve scheduling and capacity planning."}
                    </p>
                  </div>
                  
                  <div className="p-4 border rounded-md bg-amber-50 border-amber-200">
                    <h3 className="font-medium text-amber-800 mb-1">Turnaround Time Analysis</h3>
                    <p className="text-sm text-amber-700">
                      The average turnaround time is {summary.turnaround} minutes, 
                      {summary.turnaround <= 35 
                        ? " which meets the target of 35 minutes." 
                        : ` which is ${summary.turnaround - 35} minutes above the target of 35 minutes.`}
                      {summary.turnaround > 35 
                        ? " Consider reviewing loading/unloading procedures to improve efficiency." 
                        : " Great job maintaining efficient operations!"}
                    </p>
                  </div>
                  
                  <div className="p-4 border rounded-md bg-green-50 border-green-200">
                    <h3 className="font-medium text-green-800 mb-1">On-Time Performance</h3>
                    <p className="text-sm text-green-700">
                      On-time arrival rate is currently at {summary.onTime}%, 
                      {summary.onTime >= 90 
                        ? " exceeding the target of 90%. This indicates excellent carrier performance." 
                        : ` which is below the target of 90%. Consider working with carriers to improve punctuality.`}
                    </p>
                  </div>
                  
                  <div className="p-4 border rounded-md bg-purple-50 border-purple-200">
                    <h3 className="font-medium text-purple-800 mb-1">Dwell Time Prediction</h3>
                    <p className="text-sm text-purple-700">
                      Dwell time prediction accuracy is {summary.dwell}%, 
                      {summary.dwell >= 85 
                        ? " meeting the target of 85%. This helps maintain reliable scheduling." 
                        : ` falling short of the 85% target. Consider refining your dwell time estimation algorithm.`}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      ) : (
        <div className="mb-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Appointment Heatmap Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
                <div className="col-span-1 space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Date Range</label>
                    <Select value={dateRange} onValueChange={(value) => setDateRange(value as any)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select date range" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="last7Days">Last 7 Days</SelectItem>
                        <SelectItem value="last30Days">Last 30 Days</SelectItem>
                        <SelectItem value="last90Days">Last 90 Days</SelectItem>
                        <SelectItem value="custom">Custom Range</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium mb-1 block">Location</label>
                    <Select value={heatmapFilter.location} onValueChange={(value) => setHeatmapFilter({...heatmapFilter, location: value})}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select location" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Locations</SelectItem>
                        <SelectItem value="location1">Main Warehouse</SelectItem>
                        <SelectItem value="location2">Distribution Center</SelectItem>
                        <SelectItem value="location3">Cross-Dock Facility</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium mb-1 block">Appointment Type</label>
                    <Select value={heatmapFilter.appointment} onValueChange={(value) => setHeatmapFilter({...heatmapFilter, appointment: value})}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select appointment type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        <SelectItem value="inbound">Inbound</SelectItem>
                        <SelectItem value="outbound">Outbound</SelectItem>
                        <SelectItem value="container">Container</SelectItem>
                        <SelectItem value="trailer">Trailer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium mb-1 block">Customer</label>
                    <Select value={heatmapFilter.customer} onValueChange={(value) => setHeatmapFilter({...heatmapFilter, customer: value})}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select customer" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Customers</SelectItem>
                        <SelectItem value="customer1">Acme Inc</SelectItem>
                        <SelectItem value="customer2">Global Goods</SelectItem>
                        <SelectItem value="customer3">Quick Ship</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium mb-1 block">Carrier</label>
                    <Select value={heatmapFilter.carrier} onValueChange={(value) => setHeatmapFilter({...heatmapFilter, carrier: value})}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select carrier" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Carriers</SelectItem>
                        <SelectItem value="carrier1">FedEx</SelectItem>
                        <SelectItem value="carrier2">XPO Logistics</SelectItem>
                        <SelectItem value="carrier3">Estes Express</SelectItem>
                        <SelectItem value="carrier4">J.B. Hunt</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="mt-8 p-4 border rounded-md bg-blue-50 border-blue-200">
                    <h3 className="font-medium text-blue-800 mb-1">Heatmap Insights</h3>
                    <p className="text-sm text-blue-700">
                      This heatmap visualization helps identify patterns in appointment scheduling and on-time performance across different days and times. Use it to optimize staffing and resource allocation.
                    </p>
                  </div>
                </div>
                
                <div className="col-span-3">
                  <Tabs defaultValue="appointments">
                    <TabsList className="mb-4">
                      <TabsTrigger value="appointments">Appointment Counts</TabsTrigger>
                      <TabsTrigger value="ontime">On-Time Percentage</TabsTrigger>
                    </TabsList>
                    <TabsContent value="appointments">
                      <AnalyticsHeatMap 
                        data={[
                          { day: "Monday", hour: 8, count: 12 },
                          { day: "Monday", hour: 9, count: 18 },
                          { day: "Monday", hour: 10, count: 24 },
                          { day: "Monday", hour: 11, count: 15 },
                          { day: "Monday", hour: 12, count: 10 },
                          { day: "Monday", hour: 13, count: 14 },
                          { day: "Monday", hour: 14, count: 16 },
                          { day: "Monday", hour: 15, count: 22 },
                          { day: "Monday", hour: 16, count: 14 },
                          { day: "Tuesday", hour: 8, count: 8 },
                          { day: "Tuesday", hour: 9, count: 15 },
                          { day: "Tuesday", hour: 10, count: 21 },
                          { day: "Tuesday", hour: 11, count: 25 },
                          { day: "Tuesday", hour: 12, count: 12 },
                          { day: "Tuesday", hour: 13, count: 16 },
                          { day: "Tuesday", hour: 14, count: 20 },
                          { day: "Tuesday", hour: 15, count: 18 },
                          { day: "Tuesday", hour: 16, count: 11 },
                          { day: "Wednesday", hour: 8, count: 10 },
                          { day: "Wednesday", hour: 9, count: 16 },
                          { day: "Wednesday", hour: 10, count: 22 },
                          { day: "Wednesday", hour: 11, count: 28 },
                          { day: "Wednesday", hour: 12, count: 15 },
                          { day: "Wednesday", hour: 13, count: 18 },
                          { day: "Wednesday", hour: 14, count: 26 },
                          { day: "Wednesday", hour: 15, count: 20 },
                          { day: "Wednesday", hour: 16, count: 13 },
                          { day: "Thursday", hour: 8, count: 9 },
                          { day: "Thursday", hour: 9, count: 17 },
                          { day: "Thursday", hour: 10, count: 23 },
                          { day: "Thursday", hour: 11, count: 26 },
                          { day: "Thursday", hour: 12, count: 14 },
                          { day: "Thursday", hour: 13, count: 19 },
                          { day: "Thursday", hour: 14, count: 24 },
                          { day: "Thursday", hour: 15, count: 17 },
                          { day: "Thursday", hour: 16, count: 12 },
                          { day: "Friday", hour: 8, count: 11 },
                          { day: "Friday", hour: 9, count: 19 },
                          { day: "Friday", hour: 10, count: 25 },
                          { day: "Friday", hour: 11, count: 20 },
                          { day: "Friday", hour: 12, count: 13 },
                          { day: "Friday", hour: 13, count: 17 },
                          { day: "Friday", hour: 14, count: 21 },
                          { day: "Friday", hour: 15, count: 15 },
                          { day: "Friday", hour: 16, count: 10 },
                        ]}
                        mode="appointments"
                        filter={heatmapFilter}
                      />
                    </TabsContent>
                    <TabsContent value="ontime">
                      <AnalyticsHeatMap 
                        data={[
                          { day: "Monday", hour: 8, count: 12, onTimePercentage: 92 },
                          { day: "Monday", hour: 9, count: 18, onTimePercentage: 89 },
                          { day: "Monday", hour: 10, count: 24, onTimePercentage: 83 },
                          { day: "Monday", hour: 11, count: 15, onTimePercentage: 87 },
                          { day: "Monday", hour: 12, count: 10, onTimePercentage: 90 },
                          { day: "Monday", hour: 13, count: 14, onTimePercentage: 86 },
                          { day: "Monday", hour: 14, count: 16, onTimePercentage: 88 },
                          { day: "Monday", hour: 15, count: 22, onTimePercentage: 82 },
                          { day: "Monday", hour: 16, count: 14, onTimePercentage: 86 },
                          { day: "Tuesday", hour: 8, count: 8, onTimePercentage: 94 },
                          { day: "Tuesday", hour: 9, count: 15, onTimePercentage: 87 },
                          { day: "Tuesday", hour: 10, count: 21, onTimePercentage: 81 },
                          { day: "Tuesday", hour: 11, count: 25, onTimePercentage: 78 },
                          { day: "Tuesday", hour: 12, count: 12, onTimePercentage: 92 },
                          { day: "Tuesday", hour: 13, count: 16, onTimePercentage: 88 },
                          { day: "Tuesday", hour: 14, count: 20, onTimePercentage: 85 },
                          { day: "Tuesday", hour: 15, count: 18, onTimePercentage: 89 },
                          { day: "Tuesday", hour: 16, count: 11, onTimePercentage: 91 },
                          { day: "Wednesday", hour: 8, count: 10, onTimePercentage: 90 },
                          { day: "Wednesday", hour: 9, count: 16, onTimePercentage: 88 },
                          { day: "Wednesday", hour: 10, count: 22, onTimePercentage: 82 },
                          { day: "Wednesday", hour: 11, count: 28, onTimePercentage: 75 },
                          { day: "Wednesday", hour: 12, count: 15, onTimePercentage: 87 },
                          { day: "Wednesday", hour: 13, count: 18, onTimePercentage: 83 },
                          { day: "Wednesday", hour: 14, count: 26, onTimePercentage: 77 },
                          { day: "Wednesday", hour: 15, count: 20, onTimePercentage: 80 },
                          { day: "Wednesday", hour: 16, count: 13, onTimePercentage: 85 },
                          { day: "Thursday", hour: 8, count: 9, onTimePercentage: 93 },
                          { day: "Thursday", hour: 9, count: 17, onTimePercentage: 88 },
                          { day: "Thursday", hour: 10, count: 23, onTimePercentage: 83 },
                          { day: "Thursday", hour: 11, count: 26, onTimePercentage: 79 },
                          { day: "Thursday", hour: 12, count: 14, onTimePercentage: 86 },
                          { day: "Thursday", hour: 13, count: 19, onTimePercentage: 84 },
                          { day: "Thursday", hour: 14, count: 24, onTimePercentage: 80 },
                          { day: "Thursday", hour: 15, count: 17, onTimePercentage: 82 },
                          { day: "Thursday", hour: 16, count: 12, onTimePercentage: 88 },
                          { day: "Friday", hour: 8, count: 11, onTimePercentage: 91 },
                          { day: "Friday", hour: 9, count: 19, onTimePercentage: 84 },
                          { day: "Friday", hour: 10, count: 25, onTimePercentage: 76 },
                          { day: "Friday", hour: 11, count: 20, onTimePercentage: 80 },
                          { day: "Friday", hour: 12, count: 13, onTimePercentage: 85 },
                          { day: "Friday", hour: 13, count: 17, onTimePercentage: 82 },
                          { day: "Friday", hour: 14, count: 21, onTimePercentage: 79 },
                          { day: "Friday", hour: 15, count: 15, onTimePercentage: 83 },
                          { day: "Friday", hour: 16, count: 10, onTimePercentage: 90 },
                        ]}
                        mode="ontime"
                        filter={heatmapFilter}
                      />
                    </TabsContent>
                  </Tabs>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Available Reports</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="border rounded-md p-4 hover:border-primary cursor-pointer transition-colors">
              <h3 className="font-medium mb-2">Daily Operations Summary</h3>
              <p className="text-sm text-neutral-500 mb-4">
                Complete overview of dock operations, schedules, and performance metrics for each day.
              </p>
              <div className="flex items-center text-primary text-sm">
                <Download className="h-4 w-4 mr-1" />
                Export Report
              </div>
            </div>
            
            <div className="border rounded-md p-4 hover:border-primary cursor-pointer transition-colors">
              <h3 className="font-medium mb-2">Carrier Performance Analysis</h3>
              <p className="text-sm text-neutral-500 mb-4">
                Detailed breakdown of carrier-specific metrics including on-time performance and dwell times.
              </p>
              <div className="flex items-center text-primary text-sm">
                <Download className="h-4 w-4 mr-1" />
                Export Report
              </div>
            </div>
            
            <div className="border rounded-md p-4 hover:border-primary cursor-pointer transition-colors">
              <h3 className="font-medium mb-2">Dock Utilization Report</h3>
              <p className="text-sm text-neutral-500 mb-4">
                Analysis of dock usage patterns, peak times, and opportunities for optimization.
              </p>
              <div className="flex items-center text-primary text-sm">
                <Download className="h-4 w-4 mr-1" />
                Export Report
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
