import { useEffect, useState } from 'react'
import { useDashboardData } from '../hooks/use-dashboard-data.js'
import { MetricCard } from '../components/cards/metric-card.js'
import { MetricGrid } from '../components/cards/metric-grid.js'
import { AreaChart } from '../components/charts/area-chart.js'
import { RankingRow } from '../components/tables/ranking-row.js'
import { EmptyState } from '../components/common/empty-state.js'
import { LoadingSkeleton } from '../components/common/loading-skeleton.js'
import type { TrendData, CompetitorData, MetricGroup, PageId, ResponseFilters } from '../types.js'

interface OverviewPageProps {
  onNavigate?: (page: PageId, filters?: ResponseFilters) => void
}

export function OverviewPage({ onNavigate }: OverviewPageProps) {
  const { status, runs, loading, dataFetcher } = useDashboardData()

  const [trendData, setTrendData] = useState<Array<{ date: string; value: number }>>([])
  const [trendLoading, setTrendLoading] = useState(false)
  const [competitors, setCompetitors] = useState<CompetitorData | null>(null)
  const [competitorsLoading, setCompetitorsLoading] = useState(false)
  const [runMetrics, setRunMetrics] = useState<MetricGroup[]>([])


  const latestRun = status?.latestRun ?? null

  // Fetch visibility trend data
  useEffect(() => {
    if (!latestRun) return
    let mounted = true
    setTrendLoading(true)

    dataFetcher<TrendData>('/api/trends?metric=visibility_rate&last=10')
      .then((data) => {
        if (!mounted) return
        setTrendData(
          data.points.map((p) => ({
            date: p.date,
            value: Math.round(p.value * 1000) / 10,
          }))
        )
      })
      .catch(() => {
        if (mounted) setTrendData([])
      })
      .finally(() => {
        if (mounted) setTrendLoading(false)
      })

    return () => {
      mounted = false
    }
  }, [latestRun, dataFetcher])

  // Fetch run metrics (prominence, sentiment, etc.)
  useEffect(() => {
    if (!latestRun) return
    let mounted = true

    dataFetcher<MetricGroup[]>(`/api/runs/${latestRun.id}/metrics`)
      .then((data) => { if (mounted) setRunMetrics(data) })
      .catch(() => { if (mounted) setRunMetrics([]) })

    return () => { mounted = false }
  }, [latestRun, dataFetcher])

  // Fetch competitor data
  useEffect(() => {
    if (!latestRun) return
    let mounted = true
    setCompetitorsLoading(true)

    dataFetcher<CompetitorData>(`/api/runs/${latestRun.id}/competitors`)
      .then((data) => {
        if (mounted) setCompetitors(data)
      })
      .catch(() => {
        if (mounted) setCompetitors(null)
      })
      .finally(() => {
        if (mounted) setCompetitorsLoading(false)
      })

    return () => {
      mounted = false
    }
  }, [latestRun, dataFetcher])

  if (loading) {
    return (
      <div className="space-y-6">
        <LoadingSkeleton rows={4} />
      </div>
    )
  }

  if (!status || !latestRun) {
    return <EmptyState title="No runs yet" description="Run your first AEO analysis to see the overview dashboard." />
  }

  // Compute visibility delta from the latest two runs
  const sortedRuns = [...runs].sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
  )
  const visibilityDelta =
    sortedRuns.length >= 2 && trendData.length >= 2
      ? (trendData[trendData.length - 1]?.value ?? 0) - (trendData[trendData.length - 2]?.value ?? 0)
      : undefined

  // Build ranking entries
  const rankingEntries: Array<{
    domain: string
    name: string
    visibilityRate: number
    isCompany: boolean
  }> = []

  if (competitors) {
    // Add company itself
    rankingEntries.push({
      domain: status.company,
      name: status.company,
      visibilityRate: latestRun.visibilityRate ?? 0,
      isCompany: true,
    })
    // Add competitors
    for (const c of competitors.competitors) {
      rankingEntries.push({
        domain: c.domain,
        name: c.name ?? c.domain,
        visibilityRate: c.visibilityRate,
        isCompany: false,
      })
    }
    rankingEntries.sort((a, b) => b.visibilityRate - a.visibilityRate)
  }

  const overallMetrics = runMetrics.find((g) => g.provider === null)?.metrics ?? {}
  const mentionedCount = Math.round((latestRun.visibilityRate ?? 0) * (competitors?.totalResponses ?? 0))
  const totalResponses = competitors?.totalResponses ?? 0
  const avgProminence = overallMetrics['avg_prominence_score'] ?? 0
  const avgSentiment = overallMetrics['avg_sentiment_score'] ?? 0
  const providerCount = runMetrics.filter((g) => g.provider !== null).length

  return (
    <div className="space-y-6">
      <MetricGrid>
        <MetricCard
          label="Visibility Rate"
          value={`${((latestRun.visibilityRate ?? 0) * 100).toFixed(1)}%`}
          subtitle={`Mentioned in ${mentionedCount} of ${totalResponses} responses`}
          delta={visibilityDelta !== undefined ? { value: visibilityDelta, label: 'vs prev run' } : undefined}
        />
        <MetricCard
          label="Avg Prominence"
          value={mentionedCount > 0 ? `${(avgProminence * 10).toFixed(0)}%` : '—'}
          subtitle={mentionedCount > 0 ? `Across ${mentionedCount} mentioned responses` : 'No mentions yet'}
        />
        <MetricCard
          label="Avg Sentiment"
          value={mentionedCount > 0 ? avgSentiment.toFixed(2) : '—'}
          subtitle={mentionedCount > 0 ? `Scale: -1 (negative) to 1 (positive)` : 'No mentions yet'}
        />
        <MetricCard
          label="Latest Cost"
          value={`$${latestRun.actualCostUsd.toFixed(2)}`}
          subtitle={`${status.totalQueries} queries across ${providerCount} providers`}
        />
      </MetricGrid>

      {/* Visibility Over Time */}
      <div className="rounded-lg border border-[#e7e5e4] bg-white p-6">
        <h2 className="text-lg font-semibold text-[#0c0a09] mb-1">Brand Visibility</h2>
        <p className="text-sm text-[#78716c] mb-4">
          Visibility rate across AI providers over time
        </p>
        {trendLoading ? (
          <LoadingSkeleton rows={3} />
        ) : trendData.length > 0 ? (
          <AreaChart data={trendData} dataKey="value" height={280} />
        ) : (
          <EmptyState title="No trend data" description="More runs are needed to display a trend." />
        )}
      </div>

      {/* Brand Ranking */}
      {competitorsLoading ? (
        <div className="rounded-lg border border-[#e7e5e4] bg-white p-6">
          <LoadingSkeleton rows={5} />
        </div>
      ) : rankingEntries.length > 0 ? (
        <div className="rounded-lg border border-[#e7e5e4] bg-white p-6">
          <h2 className="text-lg font-semibold text-[#0c0a09] mb-4">Brand Ranking</h2>
          <div>
            {rankingEntries.map((entry, idx) => (
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
      ) : null}
    </div>
  )
}
