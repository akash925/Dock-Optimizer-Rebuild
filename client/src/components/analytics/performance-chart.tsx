import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine } from "recharts";

interface ChartData {
  date: string;
  value: number;
}

interface PerformanceChartProps {
  data: ChartData[];
  yAxisLabel: string;
  color: string;
  target: number;
  suffix?: string;
  horizontal?: boolean;
  hideTarget?: boolean;
}

export default function PerformanceChart({
  data,
  yAxisLabel,
  color,
  target,
  suffix = "",
  horizontal = false,
  hideTarget = false
}: PerformanceChartProps) {
  // Calculate min and max for better axis scaling
  const values = data.map(item => item.value);
  const maxValue = Math.max(...values);
  const minValue = Math.min(...values);
  
  // Expand axis range a bit
  const axisMin = Math.max(0, Math.floor(minValue * 0.9));
  const axisMax = Math.ceil(maxValue * 1.1);
  
  // For horizontal bars, sort data in descending order by value
  const sortedData = horizontal 
    ? [...data].sort((a, b) => b.value - a.value)
    : data;
  
  // Limit to 10 items for horizontal charts to prevent overcrowding
  const displayData = horizontal && sortedData.length > 10 
    ? sortedData.slice(0, 10) 
    : sortedData;
  
  // Calculate the appropriate height based on number of items for horizontal layout
  const chartHeight = horizontal 
    ? Math.max(400, displayData.length * 40 + 100)
    : 400;
  
  return (
    <div className="w-full" style={{ height: chartHeight }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={displayData}
          layout={horizontal ? "vertical" : "horizontal"}
          margin={{
            top: 20,
            right: 30,
            left: horizontal ? 160 : 20, // More space for labels in horizontal layout
            bottom: horizontal ? 20 : 60,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={!horizontal} vertical={horizontal} />
          
          {horizontal ? (
            <>
              <XAxis 
                type="number"
                domain={[0, axisMax]} 
                label={!horizontal ? undefined : { 
                  value: yAxisLabel, 
                  position: "insideBottom",
                  offset: -10,
                  style: { textAnchor: "middle" }
                }}
                tick={{ fontSize: 12 }}
              />
              <YAxis 
                dataKey="date"
                type="category"
                tick={{ fontSize: 12 }}
                width={150}
              />
            </>
          ) : (
            <>
              <XAxis 
                dataKey="date"
                angle={-45}
                textAnchor="end"
                height={60}
                tick={{ fontSize: 12 }}
              />
              <YAxis 
                domain={[axisMin, axisMax]} 
                label={{ 
                  value: yAxisLabel, 
                  angle: -90, 
                  position: "insideLeft",
                  style: { textAnchor: "middle" }
                }}
                tick={{ fontSize: 12 }}
              />
            </>
          )}
          
          <Tooltip 
            formatter={(value: number) => [`${value}${suffix}`, yAxisLabel]}
            contentStyle={{ 
              backgroundColor: "white", 
              border: "1px solid #e0e0e0",
              borderRadius: "4px",
              boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)"
            }}
          />
          
          {!hideTarget && (
            <ReferenceLine 
              y={horizontal ? undefined : target}
              x={horizontal ? target : undefined}
              stroke="#ff9800" 
              strokeDasharray="3 3"
              label={{ 
                value: `Target: ${target}${suffix}`, 
                position: "right",
                fill: "#ff9800",
                fontSize: 12
              }}
            />
          )}
          
          <Bar 
            dataKey="value" 
            name={yAxisLabel} 
            fill={color} 
            barSize={horizontal ? 30 : 40}
            radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
