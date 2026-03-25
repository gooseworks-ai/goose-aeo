import {
  AreaChart as RechartsAreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { colors } from '../../theme.js'

interface AreaChartProps {
  data: Array<{ date: string; value: number; [key: string]: unknown }>
  dataKey?: string
  height?: number
}

export function AreaChart({ data, dataKey = 'value', height = 300 }: AreaChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsAreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="areaGreenGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={colors.success} stopOpacity={0.3} />
            <stop offset="100%" stopColor={colors.success} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke={colors.border}
          vertical={false}
        />
        <XAxis
          dataKey="date"
          tick={{ fill: colors.muted, fontSize: 12 }}
          axisLine={{ stroke: colors.border }}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: colors.muted, fontSize: 12 }}
          axisLine={false}
          tickLine={false}
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
        />
        <Area
          type="monotone"
          dataKey={dataKey}
          stroke={colors.success}
          strokeWidth={2}
          fill="url(#areaGreenGradient)"
        />
      </RechartsAreaChart>
    </ResponsiveContainer>
  )
}
