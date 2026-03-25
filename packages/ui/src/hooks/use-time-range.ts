import { useCallback, useState } from 'react'
import type { RunRecord } from '../types.js'

export type TimeRange = 'all' | '7d' | '30d'

export interface UseTimeRangeReturn {
  range: TimeRange
  setRange: (range: TimeRange) => void
  filterRuns: (runs: RunRecord[]) => RunRecord[]
}

function daysAgo(days: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - days)
  d.setHours(0, 0, 0, 0)
  return d
}

export function useTimeRange(initial: TimeRange = '30d'): UseTimeRangeReturn {
  const [range, setRange] = useState<TimeRange>(initial)

  const filterRuns = useCallback(
    (runs: RunRecord[]): RunRecord[] => {
      if (range === 'all') return runs

      const days = range === '7d' ? 7 : 30
      const cutoff = daysAgo(days)

      return runs.filter((run) => {
        const started = new Date(run.startedAt)
        return started >= cutoff
      })
    },
    [range],
  )

  return { range, setRange, filterRuns }
}
