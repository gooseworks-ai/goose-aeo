import { useEffect, useState } from 'react'
import { useDashboardData } from '../hooks/use-dashboard-data.js'
import { MetricCard } from '../components/cards/metric-card.js'
import { MetricGrid } from '../components/cards/metric-grid.js'
import { RankingRow } from '../components/tables/ranking-row.js'
import { EmptyState } from '../components/common/empty-state.js'
import { LoadingSkeleton } from '../components/common/loading-skeleton.js'
import type { CompetitorData, PageId, ResponseFilters } from '../types.js'

interface CompetitorsPageProps {
  onNavigate?: (page: PageId, filters?: ResponseFilters) => void
}

export function CompetitorsPage({ onNavigate }: CompetitorsPageProps) {
  const { status, loading, dataFetcher } = useDashboardData()

  const [competitors, setCompetitors] = useState<CompetitorData | null>(null)
  const [compLoading, setCompLoading] = useState(false)

  const latestRun = status?.latestRun ?? null

  useEffect(() => {
    if (!latestRun) return
    let mounted = true
    setCompLoading(true)

    dataFetcher<CompetitorData>(`/api/runs/${latestRun.id}/competitors`)
      .then((data) => {
        if (mounted) setCompetitors(data)
      })
      .catch(() => {
        if (mounted) setCompetitors(null)
      })
      .finally(() => {
        if (mounted) setCompLoading(false)
      })

    return () => {
      mounted = false
    }
  }, [latestRun, dataFetcher])

  if (loading) {
    return <LoadingSkeleton rows={6} />
  }

  if (!status || !latestRun) {
    return <EmptyState title="No runs yet" description="Run an analysis to see competitive rankings." />
  }

  if (compLoading) {
    return <LoadingSkeleton rows={8} />
  }

  if (!competitors) {
    return <EmptyState title="No competitor data" description="Competitor data could not be loaded." />
  }

  // Build ranking: company + competitors, sorted by visibilityRate
  const entries: Array<{ domain: string; name: string; visibilityRate: number; isCompany: boolean }> = [
    {
      domain: status.company,
      name: status.company,
      visibilityRate: latestRun.visibilityRate ?? 0,
      isCompany: true,
    },
    ...competitors.competitors.map((c) => ({
      domain: c.domain,
      name: c.name ?? c.domain,
      visibilityRate: c.visibilityRate,
      isCompany: false,
    })),
  ]

  entries.sort((a, b) => b.visibilityRate - a.visibilityRate)

  // Calculate share of voice (company mentions / total responses)
  const companyEntry = entries.find((e) => e.domain === status.company)
  const shareOfVoice = companyEntry
    ? `${(companyEntry.visibilityRate * 100).toFixed(1)}%`
    : '0%'

  return (
    <div className="space-y-6">
      <MetricGrid>
        <MetricCard
          label="Your Rank"
          value={competitors.ourRank !== null ? `#${competitors.ourRank}` : '-'}
        />
        <MetricCard label="Share of Voice" value={shareOfVoice} />
        <MetricCard label="Total Responses" value={String(competitors.totalResponses)} />
        <MetricCard label="Competitors Tracked" value={String(competitors.competitors.length)} />
      </MetricGrid>

      <div className="rounded-lg border border-[#e7e5e4] bg-white p-6">
        <h2 className="text-lg font-semibold text-[#0c0a09] mb-4">Competitive Ranking</h2>
        <div>
          {entries.map((entry, idx) => (
            <RankingRow
              key={entry.domain}
              rank={idx + 1}
              domain={entry.domain}
              name={entry.name}
              value={entry.visibilityRate}
              onClick={!entry.isCompany && onNavigate ? () => onNavigate('responses', { competitor: entry.domain }) : undefined}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
