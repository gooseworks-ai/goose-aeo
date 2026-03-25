import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { colors } from '../../theme.js'

interface BarChartProps {
  data: Array<{ name: string; value: number }>
  height?: number
}

export function BarChart({ data, height = 300 }: BarChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsBarChart
        data={data}
        layout="vertical"
        margin={{ top: 8, right: 8, bottom: 0, left: 80 }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke={colors.border}
          horizontal={false}
        />
        <XAxis
          type="number"
          tick={{ fill: colors.muted, fontSize: 12 }}
          axisLine={{ stroke: colors.border }}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fill: colors.muted, fontSize: 12 }}
          axisLine={false}
          tickLine={false}
          width={70}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: colors.card,
            border: `1px solid ${colors.border}`,
            borderRadius: 8,
            color: colors.foreground,
            fontSize: 13,
          }}
          labelStyle={{ color: colors.muted }}
          cursor={{ fill: 'rgba(0, 0, 0, 0.04)' }}
        />
        <Bar
          dataKey="value"
          radius={[0, 4, 4, 0]}
          barSize={20}
        >
          {data.map((_, index) => (
            <Cell
              key={index}
              fill={colors.chart[index % colors.chart.length]}
            />
          ))}
        </Bar>
      </RechartsBarChart>
    </ResponsiveContainer>
  )
}
