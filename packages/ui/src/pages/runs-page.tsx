import { useDashboardData } from '../hooks/use-dashboard-data.js'
import { MetricCard } from '../components/cards/metric-card.js'
import { MetricGrid } from '../components/cards/metric-grid.js'
import { AreaChart } from '../components/charts/area-chart.js'
import { DataTable } from '../components/tables/data-table.js'
import { EmptyState } from '../components/common/empty-state.js'
import { LoadingSkeleton } from '../components/common/loading-skeleton.js'

const runColumns = [
  { key: 'runId', label: 'Run ID' },
  { key: 'date', label: 'Date' },
  { key: 'status', label: 'Status' },
  { key: 'queries', label: 'Queries', align: 'right' as const },
  { key: 'providers', label: 'Providers', align: 'right' as const },
  { key: 'estimated', label: 'Estimated ($)', align: 'right' as const },
  { key: 'actual', label: 'Actual ($)', align: 'right' as const },
]

export function RunsPage() {
  const { status, costs, loading } = useDashboardData()

  if (loading) {
    return <LoadingSkeleton rows={8} />
  }

  if (!status || !costs || costs.runs.length === 0) {
    return <EmptyState title="No runs yet" description="Run your first AEO analysis to see run history and costs." />
  }

  const latestRun = status.latestRun

  // Table rows from costs data
  const rows = costs.runs.map((r) => ({
    runId: r.runId.slice(0, 8),
    date: r.date,
    status: 'completed',
    queries: r.queries,
    providers: r.providers,
    estimated: `$${r.estimated.toFixed(2)}`,
    actual: `$${r.actual.toFixed(2)}`,
  }))

  // Cost trend chart data
  const costChartData = costs.runs.map((r) => ({
    date: r.date,
    value: r.actual,
  }))

  return (
    <div className="space-y-6">
      <MetricGrid>
        <MetricCard label="Total Runs" value={String(costs.totalRuns)} />
        <MetricCard label="All-Time Cost" value={`$${costs.allTimeActual.toFixed(2)}`} />
        <MetricCard
          label="Latest Run Status"
          value={latestRun ? latestRun.status : '-'}
        />
      </MetricGrid>

      {/* Cost Trend */}
      <div className="rounded-lg border border-[#e7e5e4] bg-white p-6">
        <h2 className="text-lg font-semibold text-[#0c0a09] mb-1">Cost Over Time</h2>
        <p className="text-sm text-[#78716c] mb-4">
          Actual cost per run
        </p>
        {costChartData.length > 1 ? (
          <AreaChart data={costChartData} dataKey="value" height={260} />
        ) : (
          <EmptyState title="Not enough data" description="More runs are needed to display a cost trend." />
        )}
      </div>

      {/* Run History Table */}
      <div>
        <h2 className="text-lg font-semibold text-[#0c0a09] mb-4">Run History</h2>
        <DataTable columns={runColumns} rows={rows} />
      </div>
    </div>
  )
}
