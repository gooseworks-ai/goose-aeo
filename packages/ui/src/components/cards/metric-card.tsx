import { DeltaBadge } from '../common/delta-badge.js'

interface MetricCardProps {
  label: string
  value: string
  subtitle?: string
  delta?: { value: number; label?: string }
}

export function MetricCard({ label, value, subtitle, delta }: MetricCardProps) {
  return (
    <div className="rounded-lg border border-[#e7e5e4] bg-white p-6">
      <div className="text-xs font-medium uppercase tracking-wider text-[#78716c] mb-2">
        {label}
      </div>
      <div className="text-2xl font-bold text-[#0c0a09]">{value}</div>
      {subtitle && (
        <div className="text-xs text-[#a8a29e] mt-1">{subtitle}</div>
      )}
      {delta !== undefined && (
        <div className="mt-2">
          <DeltaBadge value={delta.value} label={delta.label} />
        </div>
      )}
    </div>
  )
}
