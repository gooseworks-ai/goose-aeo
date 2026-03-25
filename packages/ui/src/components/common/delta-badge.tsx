interface DeltaBadgeProps {
  value: number
  label?: string
}

export function DeltaBadge({ value, label }: DeltaBadgeProps) {
  if (value === 0 || value === undefined) return null

  const isPositive = value > 0
  const arrow = isPositive ? '\u2191' : '\u2193'
  const colorClass = isPositive ? 'text-[#16a34a]' : 'text-[#dc2626]'
  const displayValue = Math.abs(value).toFixed(1)

  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${colorClass}`}>
      <span>{arrow}</span>
      <span>{displayValue}%</span>
      {label && <span className="text-[#78716c] ml-0.5">{label}</span>}
    </span>
  )
}
