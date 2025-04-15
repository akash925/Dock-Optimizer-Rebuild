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
}

export default function PerformanceChart({
  data,
  yAxisLabel,
  color,
  target,
  suffix = ""
}: PerformanceChartProps) {
  // Calculate min and max for better Y axis scaling
  const values = data.map(item => item.value);
  const maxValue = Math.max(...values);
  const minValue = Math.min(...values);
  
  // Expand Y axis range a bit
  const yAxisMin = Math.max(0, Math.floor(minValue * 0.9));
  const yAxisMax = Math.ceil(maxValue * 1.1);
  
  return (
    <div className="w-full h-[400px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{
            top: 20,
            right: 30,
            left: 20,
            bottom: 60,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis 
            dataKey="date"
            angle={-45}
            textAnchor="end"
            height={60}
            tick={{ fontSize: 12 }}
          />
          <YAxis 
            domain={[yAxisMin, yAxisMax]} 
            label={{ 
              value: yAxisLabel, 
              angle: -90, 
              position: "insideLeft",
              style: { textAnchor: "middle" }
            }}
            tick={{ fontSize: 12 }}
          />
          <Tooltip 
            formatter={(value: number) => [`${value}${suffix}`, yAxisLabel]}
            contentStyle={{ 
              backgroundColor: "white", 
              border: "1px solid #e0e0e0",
              borderRadius: "4px",
              boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)"
            }}
          />
          <Legend />
          <ReferenceLine 
            y={target} 
            stroke="#ff9800" 
            strokeDasharray="3 3"
            label={{ 
              value: `Target: ${target}${suffix}`, 
              position: "right",
              fill: "#ff9800",
              fontSize: 12
            }}
          />
          <Bar 
            dataKey="value" 
            name={yAxisLabel} 
            fill={color} 
            barSize={40}
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
