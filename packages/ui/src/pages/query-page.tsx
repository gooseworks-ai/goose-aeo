import { useEffect, useState } from 'react'
import { useDashboardData } from '../hooks/use-dashboard-data.js'
import { DataTable } from '../components/tables/data-table.js'
import { EmptyState } from '../components/common/empty-state.js'
import { LoadingSkeleton } from '../components/common/loading-skeleton.js'
import type { QueryVisibility, PageId, ResponseFilters } from '../types.js'

const columns = [
  { key: 'query', label: 'Query' },
  { key: 'version', label: 'Version', align: 'center' as const },
  { key: 'visibilityRate', label: 'Visibility Rate', align: 'right' as const },
  { key: 'status', label: 'Status', align: 'center' as const },
]

interface QueryPageProps {
  onNavigate?: (page: PageId, filters?: ResponseFilters) => void
}

export function QueryPage({ onNavigate }: QueryPageProps) {
  const { status, loading, dataFetcher } = useDashboardData()

  const [queryVis, setQueryVis] = useState<QueryVisibility[]>([])
  const [queryLoading, setQueryLoading] = useState(false)

  useEffect(() => {
    if (!status) return
    let mounted = true
    setQueryLoading(true)

    dataFetcher<QueryVisibility[]>('/api/query-visibility')
      .then((data) => {
        if (mounted) setQueryVis(data)
      })
      .catch(() => {
        if (mounted) setQueryVis([])
      })
      .finally(() => {
        if (mounted) setQueryLoading(false)
      })

    return () => {
      mounted = false
    }
  }, [status, dataFetcher])

  if (loading) {
    return <LoadingSkeleton rows={6} />
  }

  if (!status) {
    return <EmptyState title="No data" description="Run an analysis to see query performance." />
  }

  const sorted = [...queryVis].sort((a, b) => b.visibilityRate - a.visibilityRate)

  const rows = sorted.map((q) => {
    const rate = q.visibilityRate
    const rateStr = `${(rate * 100).toFixed(1)}%`
    let colorClass = 'text-[#0c0a09]'
    if (rate > 0.5) colorClass = 'text-[#16a34a]'
    else if (rate === 0) colorClass = 'text-[#dc2626]'

    return {
      query: q.query,
      version: `v${q.version}`,
      visibilityRate: rateStr,
      status: q.active ? 'Active' : 'Deprecated',
      _rateColor: colorClass,
    }
  })

  const handleRowClick = (row: Record<string, unknown>) => {
    if (onNavigate) {
      onNavigate('responses', { query: String(row.query) })
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-[#0c0a09] mb-1">Query Performance</h2>
        <p className="text-sm text-[#78716c] mb-4">
          Visibility rate for each tracked query across all providers
        </p>
      </div>

      {queryLoading ? (
        <LoadingSkeleton rows={6} />
      ) : rows.length > 0 ? (
        <DataTable columns={columns} rows={rows} onRowClick={handleRowClick} />
      ) : (
        <EmptyState title="No query data" description="No query visibility data available yet." />
      )}
    </div>
  )
}
