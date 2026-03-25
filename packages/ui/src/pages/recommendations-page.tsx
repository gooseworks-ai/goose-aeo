import { useEffect, useState } from 'react'
import { useDashboardData } from '../hooks/use-dashboard-data.js'
import { EmptyState } from '../components/common/empty-state.js'
import { LoadingSkeleton } from '../components/common/loading-skeleton.js'
import type { RecommendationData } from '../types.js'

export function RecommendationsPage() {
  const { status, loading, dataFetcher } = useDashboardData()
  const [recommendations, setRecommendations] = useState<RecommendationData | null>(null)
  const [recLoading, setRecLoading] = useState(false)
  const [recError, setRecError] = useState<string | null>(null)

  const latestRun = status?.latestRun ?? null

  useEffect(() => {
    if (!latestRun) return
    let mounted = true
    setRecLoading(true)
    setRecError(null)

    dataFetcher<RecommendationData & { error?: string }>(`/api/runs/${latestRun.id}/recommendations`)
      .then((data) => {
        if (!mounted) return
        if (data.error) {
          setRecommendations(null)
        } else {
          setRecommendations(data)
        }
      })
      .catch((err) => {
        if (mounted) setRecError(err instanceof Error ? err.message : String(err))
      })
      .finally(() => {
        if (mounted) setRecLoading(false)
      })

    return () => {
      mounted = false
    }
  }, [latestRun, dataFetcher])

  if (loading) {
    return (
      <div className="space-y-6">
        <LoadingSkeleton rows={5} />
      </div>
    )
  }

  if (!latestRun) {
    return (
      <EmptyState
        title="No runs yet"
        description="Run an AEO analysis first, then generate recommendations."
      />
    )
  }

  if (recLoading) {
    return (
      <div className="space-y-6">
        <LoadingSkeleton rows={6} />
      </div>
    )
  }

  if (recError) {
    return (
      <div className="rounded-lg border border-[#dc2626]/30 bg-white p-6">
        <h3 className="text-sm font-medium text-[#dc2626] mb-1">Failed to load recommendations</h3>
        <p className="text-sm text-[#78716c]">{recError}</p>
      </div>
    )
  }

  if (!recommendations) {
    return (
      <EmptyState
        title="No recommendations yet"
        description="Run `goose-aeo recommend` to generate actionable recommendations from your latest analysis."
      />
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="rounded-lg border border-[#e7e5e4] bg-white p-6">
        <h2 className="text-lg font-semibold text-[#0c0a09] mb-2">Summary</h2>
        <p className="text-sm text-[#78716c] leading-relaxed">{recommendations.summary}</p>
        <div className="flex gap-4 mt-3 text-xs text-[#78716c]">
          <span>Model: {recommendations.model}</span>
          {recommendations.costUsd !== null && <span>Cost: ${recommendations.costUsd.toFixed(4)}</span>}
          <span>Generated: {new Date(recommendations.createdAt).toLocaleDateString()}</span>
        </div>
      </div>

      {/* Visibility Gaps */}
      {recommendations.visibilityGaps.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-[#0c0a09]">Visibility Gaps</h2>
          {recommendations.visibilityGaps.map((gap, i) => (
            <div key={i} className="rounded-lg border border-[#e7e5e4] bg-white p-5">
              <h3 className="text-sm font-semibold text-[#0c0a09] mb-2">{gap.topic}</h3>
              <div className="space-y-2">
                <div>
                  <span className="text-xs font-medium text-[#78716c] uppercase tracking-wide">Queries</span>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {gap.queries.map((q, qi) => (
                      <span key={qi} className="inline-block text-xs bg-[#f5f5f4] text-[#0c0a09] rounded px-2 py-0.5 border border-[#e7e5e4]">
                        {q}
                      </span>
                    ))}
                  </div>
                </div>
                {gap.mentionedCompetitors.length > 0 && (
                  <div>
                    <span className="text-xs font-medium text-[#78716c] uppercase tracking-wide">Competitors mentioned instead</span>
                    <p className="text-sm text-[#0c0a09] mt-0.5">{gap.mentionedCompetitors.join(', ')}</p>
                  </div>
                )}
                <div>
                  <span className="text-xs font-medium text-[#78716c] uppercase tracking-wide">Recommendation</span>
                  <p className="text-sm text-[#0c0a09] mt-0.5 leading-relaxed">{gap.recommendation}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Source Opportunities */}
      {recommendations.sourceOpportunities.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-[#0c0a09]">Source Opportunities</h2>
          <div className="rounded-lg border border-[#e7e5e4] bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#e7e5e4]">
                  <th className="text-left px-4 py-3 text-xs font-medium text-[#78716c] uppercase tracking-wide">Domain</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-[#78716c] uppercase tracking-wide">Citations</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-[#78716c] uppercase tracking-wide">Recommendation</th>
                </tr>
              </thead>
              <tbody>
                {recommendations.sourceOpportunities.map((source, i) => (
                  <tr key={i} className="border-b border-[#e7e5e4] last:border-b-0">
                    <td className="px-4 py-3 font-medium text-[#0c0a09]">{source.domain}</td>
                    <td className="px-4 py-3 text-[#78716c]">{source.citationCount}</td>
                    <td className="px-4 py-3 text-[#0c0a09] leading-relaxed">{source.recommendation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Competitor Insights */}
      {recommendations.competitorInsights.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-[#0c0a09]">Competitor Insights</h2>
          {recommendations.competitorInsights.map((insight, i) => (
            <div key={i} className="rounded-lg border border-[#e7e5e4] bg-white p-5">
              <h3 className="text-sm font-semibold text-[#0c0a09] mb-1">
                {insight.competitor}
                <span className="ml-2 text-xs font-normal text-[#78716c]">{insight.domain}</span>
              </h3>
              <div className="space-y-2">
                <div>
                  <span className="text-xs font-medium text-[#78716c] uppercase tracking-wide">Appears in queries</span>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {insight.queriesWhereTheyAppear.map((q, qi) => (
                      <span key={qi} className="inline-block text-xs bg-[#f5f5f4] text-[#0c0a09] rounded px-2 py-0.5 border border-[#e7e5e4]">
                        {q}
                      </span>
                    ))}
                  </div>
                </div>
                {insight.excerpts.length > 0 && (
                  <div>
                    <span className="text-xs font-medium text-[#78716c] uppercase tracking-wide">Excerpts</span>
                    {insight.excerpts.map((excerpt, ei) => (
                      <p key={ei} className="text-sm text-[#78716c] italic mt-0.5">"{excerpt}"</p>
                    ))}
                  </div>
                )}
                <div>
                  <span className="text-xs font-medium text-[#78716c] uppercase tracking-wide">Recommendation</span>
                  <p className="text-sm text-[#0c0a09] mt-0.5 leading-relaxed">{insight.recommendation}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
