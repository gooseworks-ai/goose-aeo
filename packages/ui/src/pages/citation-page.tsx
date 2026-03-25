import { useEffect, useState } from 'react'
import { useDashboardData } from '../hooks/use-dashboard-data.js'
import { MetricCard } from '../components/cards/metric-card.js'
import { MetricGrid } from '../components/cards/metric-grid.js'
import { BarChart } from '../components/charts/bar-chart.js'
import { DataTable } from '../components/tables/data-table.js'
import { EmptyState } from '../components/common/empty-state.js'
import { LoadingSkeleton } from '../components/common/loading-skeleton.js'
import type { CitationData, RunRecord, PageId, ResponseFilters } from '../types.js'

const TYPE_STYLES: Record<string, { bg: string; text: string }> = {
  Own: { bg: 'bg-emerald-50', text: 'text-emerald-700' },
  Competitor: { bg: 'bg-amber-50', text: 'text-amber-700' },
  External: { bg: 'bg-stone-100', text: 'text-stone-500' },
}

function TypeBadge({ type }: { type: string }) {
  const style = TYPE_STYLES[type] ?? TYPE_STYLES['External']
  const bg = style?.bg ?? 'bg-stone-100'
  const text = style?.text ?? 'text-stone-500'
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${bg} ${text}`}
    >
      {type}
    </span>
  )
}

function DomainCell({ domain }: { domain: string }) {
  const faviconUrl = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=16`
  return (
    <span className="inline-flex items-center gap-2">
      <img
        src={faviconUrl}
        alt=""
        width={16}
        height={16}
        className="rounded-sm shrink-0"
        loading="lazy"
        onError={(e) => {
          ;(e.target as HTMLImageElement).style.display = 'none'
        }}
      />
      <span>{domain}</span>
    </span>
  )
}

function domainType(d: { isOwnDomain: boolean; isCompetitor: boolean }): string {
  if (d.isOwnDomain) return 'Own'
  if (d.isCompetitor) return 'Competitor'
  return 'External'
}

const domainColumns = [
  { key: 'rank', label: '#', align: 'center' as const },
  {
    key: 'domain',
    label: 'Domain',
    render: (value: unknown) => <DomainCell domain={String(value)} />,
  },
  { key: 'mentions', label: 'Mentions', align: 'right' as const },
  {
    key: 'type',
    label: 'Type',
    align: 'center' as const,
    render: (value: unknown) => <TypeBadge type={String(value)} />,
  },
]

interface CitationPageProps {
  onNavigate?: (page: PageId, filters?: ResponseFilters) => void
}

export function CitationPage({ onNavigate }: CitationPageProps) {
  const { status, runs, loading, dataFetcher } = useDashboardData()

  const [citations, setCitations] = useState<CitationData | null>(null)
  const [prevCitations, setPrevCitations] = useState<CitationData | null>(null)
  const [citationLoading, setCitationLoading] = useState(false)

  const latestRun = status?.latestRun ?? null

  // Find the previous completed run for delta comparison
  const sortedRuns = [...runs]
    .filter((r: RunRecord) => r.status === 'completed' && r.completedAt)
    .sort((a: RunRecord, b: RunRecord) =>
      (b.completedAt ?? '').localeCompare(a.completedAt ?? '')
    )
  const previousRun = sortedRuns.length > 1 ? sortedRuns[1] : null

  useEffect(() => {
    if (!latestRun) return
    let mounted = true
    setCitationLoading(true)

    const fetches: Promise<void>[] = [
      dataFetcher<CitationData>(`/api/runs/${latestRun.id}/citations`)
        .then((data) => {
          if (mounted) setCitations(data)
        })
        .catch(() => {
          if (mounted) setCitations(null)
        }),
    ]

    if (previousRun) {
      fetches.push(
        dataFetcher<CitationData>(`/api/runs/${previousRun.id}/citations`)
          .then((data) => {
            if (mounted) setPrevCitations(data)
          })
          .catch(() => {
            if (mounted) setPrevCitations(null)
          })
      )
    }

    Promise.all(fetches).finally(() => {
      if (mounted) setCitationLoading(false)
    })

    return () => {
      mounted = false
    }
  }, [latestRun, previousRun?.id, dataFetcher])

  if (loading) {
    return <LoadingSkeleton rows={6} />
  }

  if (!status || !latestRun) {
    return <EmptyState title="No runs yet" description="Run an analysis to see citation data." />
  }

  if (citationLoading) {
    return <LoadingSkeleton rows={8} />
  }

  if (!citations) {
    return <EmptyState title="No citation data" description="Citation data could not be loaded." />
  }

  const sortedDomains = [...citations.domains].sort((a, b) => b.mentionCount - a.mentionCount)
  const top10 = sortedDomains.slice(0, 10)

  const chartData = top10.map((d) => ({
    name: d.domain,
    value: d.mentionCount,
  }))

  const tableRows = sortedDomains.map((d, idx) => ({
    rank: idx + 1,
    domain: d.domain,
    mentions: d.mentionCount,
    type: domainType(d),
  }))

  // Compute deltas from previous run
  const totalDelta = prevCitations
    ? { value: citations.totalCitations - prevCitations.totalCitations, label: 'vs prev run' }
    : undefined

  const ownDelta = prevCitations
    ? { value: citations.ownDomainCitations - prevCitations.ownDomainCitations, label: 'vs prev run' }
    : undefined

  const currentShare =
    citations.totalCitations > 0
      ? (citations.ownDomainCitations / citations.totalCitations) * 100
      : 0
  const prevShare =
    prevCitations && prevCitations.totalCitations > 0
      ? (prevCitations.ownDomainCitations / prevCitations.totalCitations) * 100
      : null
  const shareDelta =
    prevShare !== null ? { value: currentShare - prevShare, label: 'vs prev run' } : undefined

  return (
    <div className="space-y-6">
      <MetricGrid>
        <MetricCard
          label="Total Citations"
          value={String(citations.totalCitations)}
          delta={totalDelta}
        />
        <MetricCard
          label="Own Domain Citations"
          value={String(citations.ownDomainCitations)}
          delta={ownDelta}
        />
        <MetricCard
          label="Own Domain Share"
          value={`${currentShare.toFixed(1)}%`}
          delta={shareDelta}
        />
      </MetricGrid>

      {/* Top Cited Domains Chart */}
      <div className="rounded-lg border border-[#e7e5e4] bg-white p-6">
        <h2 className="text-lg font-semibold text-[#0c0a09] mb-1">Top Cited Domains</h2>
        <p className="text-sm text-[#78716c] mb-4">
          Most frequently cited source domains in AI responses
        </p>
        {chartData.length > 0 ? (
          <BarChart data={chartData} height={Math.max(200, top10.length * 40)} />
        ) : (
          <EmptyState title="No citation sources" />
        )}
      </div>

      {/* Full Domain Table */}
      <div>
        <h2 className="text-lg font-semibold text-[#0c0a09] mb-4">All Cited Domains</h2>
        <DataTable
          columns={domainColumns}
          rows={tableRows}
          onRowClick={onNavigate ? (row) => onNavigate('responses', { sourceDomain: String(row.domain) }) : undefined}
        />
      </div>
    </div>
  )
}
