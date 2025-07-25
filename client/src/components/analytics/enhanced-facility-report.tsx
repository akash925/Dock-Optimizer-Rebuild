import { ResponsiveBar } from '@nivo/bar';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, Building, MapPin } from "lucide-react";

interface FacilityData {
  id: number;
  name: string;
  address: string;
  appointmentCount: number;
}

interface EnhancedFacilityReportProps {
  data: FacilityData[];
  dateRange: string;
}

export default function EnhancedFacilityReport({ data, dateRange }: EnhancedFacilityReportProps) {
  // Transform data for Nivo chart
  const chartData = data.map((facility, index) => ({
    facility: facility.name.length > 15 ? 
      facility.name.substring(0, 15) + '...' : 
      facility.name,
    fullName: facility.name,
    appointments: facility.appointmentCount || 0,
    address: facility.address,
    color: `hsl(${(index * 137.5) % 360}, 70%, 50%)` // Generate distinct colors
  }));

  const maxAppointments = Math.max(...chartData.map(d => d.appointments), 10);
  const tickValues = Array.from({ length: 6 }, (_, i) => Math.round((maxAppointments / 5) * i));

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg flex items-center gap-2">
              <Building className="h-5 w-5" />
              Facility Report
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Appointment counts by facility • {dateRange}
            </p>
          </div>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-96 w-full">
          <ResponsiveBar
            data={chartData}
            keys={['appointments']}
            indexBy="facility"
            margin={{ top: 20, right: 30, bottom: 80, left: 60 }}
            padding={0.4}
            valueScale={{ type: 'linear' }}
            indexScale={{ type: 'band', round: true }}
            colors={(bar: any) => bar.data.color}
            borderRadius={4}
            borderWidth={1}
            borderColor={{ from: 'color', modifiers: [['darker', 0.3]] }}
            axisTop={null}
            axisRight={null}
            axisBottom={{
              tickSize: 5,
              tickPadding: 5,
              tickRotation: -45,
              legend: 'Facilities',
              legendPosition: 'middle',
              legendOffset: 65,
              tickValues: 'every'
            }}
            axisLeft={{
              tickSize: 5,
              tickPadding: 5,
              tickRotation: 0,
              legend: 'Appointment Count',
              legendPosition: 'middle',
              legendOffset: -45,
              tickValues: tickValues
            }}
            labelSkipWidth={12}
            labelSkipHeight={12}
            labelTextColor={{ from: 'color', modifiers: [['darker', 1.6]] }}
            tooltip={({
              data
            }: any) => (
              <div className="bg-white p-3 shadow-lg rounded-lg border max-w-xs">
                <div className="font-medium text-sm">{data.fullName}</div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                  <MapPin className="h-3 w-3" />
                  {data.address}
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xs">Appointments:</span>
                  <Badge variant="secondary">{data.appointments}</Badge>
                </div>
              </div>
            )}
            animate={true}
            motionConfig="gentle"
            theme={{
              background: 'transparent',
              text: {
                fontSize: 11,
                fill: '#64748b'
              },
              axis: {
                domain: {
                  line: {
                    stroke: '#e2e8f0',
                    strokeWidth: 1
                  }
                },
                legend: {
                  text: {
                    fontSize: 12,
                    fill: '#475569',
                    fontWeight: 500
                  }
                },
                ticks: {
                  line: {
                    stroke: '#e2e8f0',
                    strokeWidth: 1
                  },
                  text: {
                    fontSize: 11,
                    fill: '#64748b'
                  }
                }
              },
              grid: {
                line: {
                  stroke: '#f1f5f9',
                  strokeWidth: 1
                }
              }
            }}
            enableGridY={true}
            enableGridX={false}
          />
        </div>
        
        {/* Summary Statistics */}
        <div className="mt-6 grid grid-cols-3 gap-4 pt-4 border-t">
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">{data.length}</div>
            <div className="text-xs text-muted-foreground">Total Facilities</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">
              {data.reduce((sum, facility) => sum + Number(facility.appointmentCount || 0), 0).toLocaleString()}
            </div>
            <div className="text-xs text-muted-foreground">Total Appointments</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">
              {data.length > 0 ? 
                Math.round(data.reduce((sum, facility) => sum + Number(facility.appointmentCount || 0), 0) / data.length).toLocaleString() : 
                0
              }
            </div>
            <div className="text-xs text-muted-foreground">Avg per Facility</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}