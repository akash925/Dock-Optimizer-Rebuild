import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Settings, TrendingUp, TrendingDown, Minus, BarChart } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

interface PerformanceMetric {
  id: string;
  name: string;
  value: number;
  target: number;
  unit: string;
  trend: 'up' | 'down' | 'neutral';
  trendValue: number;
  enabled: boolean;
  color: 'green' | 'red' | 'blue' | 'yellow';
  description: string;
}

interface PerformanceMetricsProps {
  facilityFilter?: string;
  dateRange?: string;
}

export default function PerformanceMetrics({ facilityFilter = "All Facilities", dateRange = "Last 7 Days" }: PerformanceMetricsProps) {
  const [configMetrics, setConfigMetrics] = useState<PerformanceMetric[]>([
    {
      id: 'dock-utilization',
      name: 'Dock Utilization',
      value: 0,
      target: 75,
      unit: '%',
      trend: 'down',
      trendValue: 75,
      enabled: true,
      color: 'red',
      description: 'Percentage of dock time actively used for operations'
    },
    {
      id: 'on-time-arrivals',
      name: 'On-Time Arrivals',
      value: 0,
      target: 90,
      unit: '%',
      trend: 'down',
      trendValue: 40,
      enabled: true,
      color: 'red',
      description: 'Percentage of appointments that arrive within the scheduled time window'
    },
    {
      id: 'turnaround-time',
      name: 'Average Turnaround Time',
      value: 0,
      target: 35,
      unit: 'min',
      trend: 'up',
      trendValue: 25,
      enabled: true,
      color: 'red',
      description: 'Average time from arrival to departure'
    },
    {
      id: 'dwell-accuracy',
      name: 'Dwell Time Accuracy',
      value: 0,
      target: 85,
      unit: '%',
      trend: 'up',
      trendValue: 35,
      enabled: true,
      color: 'green',
      description: 'Accuracy of estimated vs actual dwell times'
    }
  ]);
  const [isConfigOpen, setIsConfigOpen] = useState(false);

  // Fetch dock utilization data
  const { data: dockUtilizationData } = useQuery({
    queryKey: ['/api/analytics/dock-utilization'],
    queryFn: async () => {
      const res = await fetch('/api/analytics/dock-utilization', { credentials: 'include' });
      if (!res.ok) return [];
      return await res.json();
    }
  });

  // Fetch appointment data for on-time and turnaround calculations
  const { data: appointmentData } = useQuery({
    queryKey: ['/api/schedules'],
    queryFn: async () => {
      const res = await fetch('/api/schedules', { credentials: 'include' });
      if (!res.ok) return [];
      return await res.json();
    }
  });

  // Calculate real metric values
  useEffect(() => {
    if (!appointmentData && !dockUtilizationData) return;

    setConfigMetrics(prev => prev.map(metric => {
      switch (metric.id) {
        case 'dock-utilization': {
          if (dockUtilizationData && dockUtilizationData.length > 0) {
            const avgUtilization = dockUtilizationData.reduce((sum: number, dock: any) => 
              sum + (dock.utilization_percentage || 0), 0) / dockUtilizationData.length;
            return { ...metric, value: Math.round(avgUtilization) };
          }
          return metric;
        }
        
        case 'on-time-arrivals': {
          if (appointmentData && appointmentData.length > 0) {
            // Calculate on-time arrivals based on check-in times vs scheduled times
            const appointmentsWithCheckIn = appointmentData.filter((apt: any) => 
              apt.actualStartTime && apt.startTime
            );
            
            if (appointmentsWithCheckIn.length > 0) {
              const onTimeCount = appointmentsWithCheckIn.filter((apt: any) => {
                const scheduled = new Date(apt.startTime);
                const actual = new Date(apt.actualStartTime);
                const gracePeriodMinutes = 15; // 15 minute grace period
                const timeDiffMinutes = (actual.getTime() - scheduled.getTime()) / (1000 * 60);
                return timeDiffMinutes <= gracePeriodMinutes && timeDiffMinutes >= -30; // Allow 30 min early, 15 min late
              }).length;
              
              const onTimePercentage = Math.round((onTimeCount / appointmentsWithCheckIn.length) * 100);
              return { ...metric, value: onTimePercentage };
            }
          }
          return metric;
        }
        
        case 'turnaround-time': {
          if (appointmentData && appointmentData.length > 0) {
            // Calculate average turnaround time from check-in to check-out
            const completedAppointments = appointmentData.filter((apt: any) => 
              apt.actualStartTime && apt.actualEndTime
            );
            
            if (completedAppointments.length > 0) {
              const totalMinutes = completedAppointments.reduce((sum: number, apt: any) => {
                const start = new Date(apt.actualStartTime);
                const end = new Date(apt.actualEndTime);
                const durationMinutes = (end.getTime() - start.getTime()) / (1000 * 60);
                return sum + durationMinutes;
              }, 0);
              
              const avgTurnaround = Math.round(totalMinutes / completedAppointments.length);
              return { ...metric, value: avgTurnaround };
            }
          }
          return metric;
        }
        
        case 'dwell-accuracy': {
          if (appointmentData && appointmentData.length > 0) {
            // Calculate dwell time accuracy by comparing estimated vs actual duration
            const appointmentsWithBothTimes = appointmentData.filter((apt: any) => 
              apt.startTime && apt.endTime && apt.actualStartTime && apt.actualEndTime
            );
            
            if (appointmentsWithBothTimes.length > 0) {
              const accurateCount = appointmentsWithBothTimes.filter((apt: any) => {
                const estimatedStart = new Date(apt.startTime);
                const estimatedEnd = new Date(apt.endTime);
                const actualStart = new Date(apt.actualStartTime);
                const actualEnd = new Date(apt.actualEndTime);
                
                const estimatedDuration = (estimatedEnd.getTime() - estimatedStart.getTime()) / (1000 * 60);
                const actualDuration = (actualEnd.getTime() - actualStart.getTime()) / (1000 * 60);
                
                // Consider accurate if within 20% of estimated duration
                const tolerance = 0.20;
                const difference = Math.abs(actualDuration - estimatedDuration);
                return difference <= (estimatedDuration * tolerance);
              }).length;
              
              const accuracyPercentage = Math.round((accurateCount / appointmentsWithBothTimes.length) * 100);
              return { ...metric, value: accuracyPercentage };
            }
          }
          return metric;
        }
        
        default:
          return metric;
      }
    }));
  }, [appointmentData, dockUtilizationData]);

  const getTrendIcon = (trend: 'up' | 'down' | 'neutral') => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="h-4 w-4" />;
      case 'down':
        return <TrendingDown className="h-4 w-4" />;
      default:
        return <Minus className="h-4 w-4" />;
    }
  };

  const getTrendColor = (metric: PerformanceMetric) => {
    // For metrics where higher is better (utilization, on-time, accuracy)
    if (['dock-utilization', 'on-time-arrivals', 'dwell-accuracy'].includes(metric.id)) {
      return metric.trend === 'up' ? 'text-green-600' : 'text-red-600';
    }
    // For metrics where lower is better (turnaround time)
    return metric.trend === 'down' ? 'text-green-600' : 'text-red-600';
  };

  const getProgressColor = (metric: PerformanceMetric) => {
    const percentage = (metric.value / metric.target) * 100;
    if (metric.id === 'turnaround-time') {
      // For turnaround time, lower is better
      return percentage <= 100 ? 'bg-green-500' : 'bg-red-500';
    }
    // For other metrics, higher is better
    if (percentage >= 90) return 'bg-green-500';
    if (percentage >= 70) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const updateMetric = (id: string, updates: Partial<PerformanceMetric>) => {
    setConfigMetrics(prev => prev.map(metric => 
      metric.id === id ? { ...metric, ...updates } : metric
    ));
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <CardTitle className="text-lg">Performance Metrics</CardTitle>
              <Badge variant="outline" className="text-xs">
                {facilityFilter} • {dateRange}
              </Badge>
            </div>
            <Dialog open={isConfigOpen} onOpenChange={setIsConfigOpen}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm">
                  <Settings className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Configure Performance Metrics</DialogTitle>
                </DialogHeader>
                <div className="space-y-6">
                  {configMetrics.map((metric) => (
                    <div key={metric.id} className="border rounded-lg p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <Label className="font-medium">{metric.name}</Label>
                        <Switch
                          checked={metric.enabled}
                          onCheckedChange={(enabled) => updateMetric(metric.id, { enabled })}
                        />
                      </div>
                      <p className="text-sm text-muted-foreground">{metric.description}</p>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor={`target-${metric.id}`} className="text-sm">Target {metric.unit}</Label>
                          <Input
                            id={`target-${metric.id}`}
                            type="number"
                            value={metric.target}
                            onChange={(e) => updateMetric(metric.id, { target: Number(e.target.value) })}
                          />
                        </div>
                        <div>
                          <Label className="text-sm">Color Theme</Label>
                          <Select
                            value={metric.color}
                            onValueChange={(color: any) => updateMetric(metric.id, { color })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="green">Green</SelectItem>
                              <SelectItem value="red">Red</SelectItem>
                              <SelectItem value="blue">Blue</SelectItem>
                              <SelectItem value="yellow">Yellow</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {configMetrics.filter(m => m.enabled).map((metric) => {
            const progressValue = metric.id === 'turnaround-time' 
              ? Math.max(0, 100 - ((metric.value - metric.target) / metric.target) * 100)
              : (metric.value / metric.target) * 100;

            return (
              <div key={metric.id} className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <h4 className="font-medium text-sm">{metric.name}</h4>
                      <div className={`flex items-center space-x-1 text-xs ${getTrendColor(metric)}`}>
                        {getTrendIcon(metric.trend)}
                        <span>{metric.trendValue}{metric.unit}</span>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">Target: {metric.target}{metric.unit}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold">{metric.value}{metric.unit}</div>
                    <div className="text-xs text-muted-foreground">
                      {metric.id === 'turnaround-time' ? 
                        `${metric.value > metric.target ? '+' : ''}${metric.value - metric.target} min` :
                        `${Math.round(progressValue)}% of target`
                      }
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Progress 
                    value={Math.min(100, progressValue)} 
                    className="h-2"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>0{metric.unit}</span>
                    <span>{metric.target}{metric.unit}</span>
                  </div>
                </div>
              </div>
            );
          })}
          
          <div className="pt-4 border-t">
            <Button variant="ghost" size="sm" className="w-full text-green-600 hover:text-green-700">
              <BarChart className="h-4 w-4 mr-2" />
              View Detailed Analytics
            </Button>
          </div>
        </CardContent>
      </Card>
    </>
  );
}