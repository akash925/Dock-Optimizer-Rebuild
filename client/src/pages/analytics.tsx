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
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>
      
      {/* Heatmap - Always displayed first */}
      <div className="mb-8">
        <AnalyticsHeatMap />
      </div>
      
      {/* Performance Charts */}
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
            <CardTitle className="text-lg">Analytics Dashboard Under Development</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="p-4 border rounded-md bg-blue-50 border-blue-200">
              <h3 className="font-medium text-blue-800 mb-1">Real-Time Metrics Coming Soon</h3>
              <p className="text-sm text-blue-700">
                Our engineering team is working on connecting these analytics to real-time data from 
                your warehouse operations. Soon you'll have access to accurate dock utilization metrics,
                turnaround times, and on-time arrival performance.
              </p>
            </div>
            
            <div className="flex items-center justify-center p-6">
              <div className="text-center">
                <BarChart2 className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground">
                  Real-time analytics dashboard will be available in the next release.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Upcoming Analytics Features</CardTitle>
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
      
      {/* Available Reports */}
      <div>
        <h2 className="text-xl font-medium mb-4">Available Reports</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center">
                <FileText className="mr-2 h-5 w-5" /> Daily Operations Summary
              </CardTitle>
              <CardDescription>
                Complete overview of dock operations, schedules, and performance metrics for each day.
              </CardDescription>
            </CardHeader>
            <CardFooter className="pt-2">
              <Button variant="outline" size="sm" className="w-full">
                <Download className="h-4 w-4 mr-2" />
                Export Report
              </Button>
            </CardFooter>
          </Card>
          
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center">
                <BarChart className="mr-2 h-5 w-5" /> Carrier Performance Analysis
              </CardTitle>
              <CardDescription>
                Detailed breakdown of carrier-specific metrics including on-time performance and dwell times.
              </CardDescription>
            </CardHeader>
            <CardFooter className="pt-2">
              <Button variant="outline" size="sm" className="w-full">
                <Download className="h-4 w-4 mr-2" />
                Export Report
              </Button>
            </CardFooter>
          </Card>
          
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center">
                <BarChart2 className="mr-2 h-5 w-5" /> Dock Utilization Report
              </CardTitle>
              <CardDescription>
                Analysis of dock usage patterns, peak times, and opportunities for optimization.
              </CardDescription>
            </CardHeader>
            <CardFooter className="pt-2">
              <Button variant="outline" size="sm" className="w-full">
                <Download className="h-4 w-4 mr-2" />
                Export Report
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}