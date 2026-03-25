import type { ReactNode } from 'react'

interface MetricGridProps {
  children: ReactNode
}

export function MetricGrid({ children }: MetricGridProps) {
  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
      {children}
    </div>
  )
}
