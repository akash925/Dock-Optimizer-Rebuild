import { useState } from "react";
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

const defaultMetrics: PerformanceMetric[] = [
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
    value: 50,
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
    value: 60,
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
    value: 50,
    target: 85,
    unit: '%',
    trend: 'up',
    trendValue: 35,
    enabled: true,
    color: 'green',
    description: 'Accuracy of estimated vs actual dwell times'
  }
];

interface PerformanceMetricsProps {
  facilityFilter?: string;
  dateRange?: string;
}

export default function PerformanceMetrics({ facilityFilter = "All Facilities", dateRange = "Last 7 Days" }: PerformanceMetricsProps) {
  const [metrics, setMetrics] = useState<PerformanceMetric[]>(defaultMetrics);
  const [isConfigOpen, setIsConfigOpen] = useState(false);

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
    setMetrics(prev => prev.map(metric => 
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
                  {metrics.map((metric) => (
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
          {metrics.filter(m => m.enabled).map((metric) => {
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