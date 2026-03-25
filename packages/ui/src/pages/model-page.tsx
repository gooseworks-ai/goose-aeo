import { useEffect, useState } from 'react'
import { useDashboardData } from '../hooks/use-dashboard-data.js'
import { DataTable } from '../components/tables/data-table.js'
import { EmptyState } from '../components/common/empty-state.js'
import { LoadingSkeleton } from '../components/common/loading-skeleton.js'
import type { MetricGroup, PageId, ResponseFilters } from '../types.js'

const columns = [
  { key: 'provider', label: 'Provider' },
  { key: 'visibility', label: 'Visibility', align: 'right' as const },
  { key: 'prominence', label: 'Prominence', align: 'right' as const },
  { key: 'citationRate', label: 'Citation Rate', align: 'right' as const },
  { key: 'sentiment', label: 'Sentiment', align: 'right' as const },
  { key: 'cost', label: 'Cost', align: 'right' as const },
]

function fmtPct(v: number | undefined): string {
  if (v === undefined) return '-'
  return `${(v * 100).toFixed(1)}%`
}

function fmtDec(v: number | undefined): string {
  if (v === undefined) return '-'
  return v.toFixed(2)
}

function fmtCost(v: number | undefined): string {
  if (v === undefined) return '-'
  return `$${v.toFixed(2)}`
}

interface ModelPageProps {
  onNavigate?: (page: PageId, filters?: ResponseFilters) => void
}

export function ModelPage({ onNavigate }: ModelPageProps) {
  const { status, loading, dataFetcher } = useDashboardData()

  const [metrics, setMetrics] = useState<MetricGroup[]>([])
  const [metricsLoading, setMetricsLoading] = useState(false)

  const latestRun = status?.latestRun ?? null

  useEffect(() => {
    if (!latestRun) return
    let mounted = true
    setMetricsLoading(true)

    dataFetcher<MetricGroup[]>(`/api/runs/${latestRun.id}/metrics`)
      .then((data) => {
        if (mounted) setMetrics(data)
      })
      .catch(() => {
        if (mounted) setMetrics([])
      })
      .finally(() => {
        if (mounted) setMetricsLoading(false)
      })

    return () => {
      mounted = false
    }
  }, [latestRun, dataFetcher])

  if (loading) {
    return <LoadingSkeleton rows={6} />
  }

  if (!status || !latestRun) {
    return <EmptyState title="No runs yet" description="Run an analysis to see provider/model breakdowns." />
  }

  const providerMetrics = metrics.filter((m) => m.provider !== null)

  const rows = providerMetrics.map((m) => ({
    provider: m.provider ?? 'Unknown',
    visibility: fmtPct(m.metrics['visibility_rate']),
    prominence: fmtDec(m.metrics['avg_prominence']),
    citationRate: fmtPct(m.metrics['citation_rate']),
    sentiment: fmtDec(m.metrics['avg_sentiment']),
    cost: fmtCost(m.metrics['total_cost']),
  }))

  const handleRowClick = (row: Record<string, unknown>) => {
    if (onNavigate) {
      onNavigate('responses', { model: String(row.provider).toLowerCase() })
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-[#0c0a09] mb-1">Provider Comparison</h2>
        <p className="text-sm text-[#78716c] mb-4">
          Metrics broken down by AI provider for the latest run
        </p>
      </div>

      {metricsLoading ? (
        <LoadingSkeleton rows={5} />
      ) : rows.length > 0 ? (
        <DataTable columns={columns} rows={rows} onRowClick={handleRowClick} />
      ) : (
        <EmptyState title="No provider data" description="No per-provider metrics found for the latest run." />
      )}

      <div className="rounded-lg border border-[#e7e5e4] bg-white p-6">
        <h3 className="text-sm font-medium text-[#78716c] mb-2">Tracked Providers</h3>
        <div className="flex flex-wrap gap-2">
          {providerMetrics.length > 0 ? (
            providerMetrics.map((m) => (
              <span
                key={m.provider}
                className="inline-block rounded-full border border-[#e7e5e4] bg-[#f5f5f4] px-3 py-1 text-xs text-[#0c0a09]"
              >
                {m.provider}
              </span>
            ))
          ) : (
            <span className="text-sm text-[#78716c]">No providers detected yet</span>
          )}
        </div>
      </div>
    </div>
  )
}
