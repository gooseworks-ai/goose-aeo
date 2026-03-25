import { useEffect, useState } from 'react'
import { useDashboardData } from '../hooks/use-dashboard-data.js'
import { EmptyState } from '../components/common/empty-state.js'
import { LoadingSkeleton } from '../components/common/loading-skeleton.js'
import type { AuditData, PageAuditScoreData } from '../types.js'

function scoreColor(score: number): string {
  if (score >= 7) return 'text-[#16a34a]'
  if (score >= 4) return 'text-[#ca8a04]'
  return 'text-[#dc2626]'
}

function scoreBg(score: number): string {
  if (score >= 7) return 'bg-[#dcfce7]'
  if (score >= 4) return 'bg-[#fef9c3]'
  return 'bg-[#fee2e2]'
}

function ScoreCell({ value }: { value: number }) {
  return (
    <td className={`px-3 py-2 text-sm font-medium text-center ${scoreColor(value)}`}>
      {value.toFixed(1)}
    </td>
  )
}

export function AuditPage() {
  const { dataFetcher } = useDashboardData()
  const [audit, setAudit] = useState<AuditData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    setLoading(true)

    dataFetcher<AuditData[]>('/api/audits')
      .then(async (audits) => {
        if (!mounted) return
        if (audits.length === 0) {
          setAudit(null)
          setLoading(false)
          return
        }
        // Fetch the latest audit details
        const latest = audits[0]!
        const detail = await dataFetcher<AuditData>(`/api/audits/${latest.id}`)
        if (mounted) {
          setAudit(detail)
        }
      })
      .catch((err) => {
        if (mounted) setError(err instanceof Error ? err.message : String(err))
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })

    return () => { mounted = false }
  }, [dataFetcher])

  if (loading) {
    return <LoadingSkeleton rows={6} />
  }

  if (error) {
    return (
      <div className="rounded-lg border border-[#dc2626]/30 bg-white p-6">
        <h3 className="text-sm font-medium text-[#dc2626] mb-1">Failed to load audit</h3>
        <p className="text-sm text-[#78716c]">{error}</p>
      </div>
    )
  }

  if (!audit) {
    return (
      <EmptyState
        title="No audits yet"
        description="Run `goose-aeo audit` to score your website for AI search readability."
      />
    )
  }

  return (
    <div className="space-y-6">
      {/* Overall Score */}
      <div className="flex items-start gap-6">
        <div className={`rounded-lg p-6 ${scoreBg(audit.overallScore)}`}>
          <p className="text-xs uppercase tracking-wide text-[#78716c] mb-1">Overall Score</p>
          <p className={`text-4xl font-bold ${scoreColor(audit.overallScore)}`}>
            {audit.overallScore.toFixed(1)}
          </p>
          <p className="text-sm text-[#78716c]">out of 10</p>
        </div>
        <div className="flex-1">
          <p className="text-sm text-[#78716c]">
            Model: {audit.model} | Cost: ${(audit.costUsd ?? 0).toFixed(4)} | Pages: {audit.pages.length}
          </p>
          <p className="text-sm text-[#78716c]">
            {audit.createdAt ? new Date(audit.createdAt).toLocaleString() : ''}
          </p>
        </div>
      </div>

      {/* Per-page scores table */}
      <div className="rounded-lg border border-[#e7e5e4] bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-[#e7e5e4]">
          <h3 className="text-sm font-medium text-[#0c0a09]">Page Scores</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#e7e5e4] bg-[#fafaf9]">
                <th className="px-3 py-2 text-left font-medium text-[#78716c]">URL</th>
                <th className="px-3 py-2 text-center font-medium text-[#78716c]">Overall</th>
                <th className="px-3 py-2 text-center font-medium text-[#78716c]">Positioning</th>
                <th className="px-3 py-2 text-center font-medium text-[#78716c]">Structure</th>
                <th className="px-3 py-2 text-center font-medium text-[#78716c]">Query Align</th>
                <th className="px-3 py-2 text-center font-medium text-[#78716c]">Technical</th>
                <th className="px-3 py-2 text-center font-medium text-[#78716c]">Depth</th>
                <th className="px-3 py-2 text-center font-medium text-[#78716c]">Comparison</th>
                <th className="px-3 py-2 text-left font-medium text-[#78716c]">Top Issue</th>
              </tr>
            </thead>
            <tbody>
              {audit.pages.map((page: PageAuditScoreData, i: number) => (
                <tr key={i} className="border-b border-[#e7e5e4] last:border-0 hover:bg-[#fafaf9]">
                  <td className="px-3 py-2 text-sm text-[#0c0a09] max-w-[200px] truncate" title={page.url}>
                    {page.url}
                  </td>
                  <ScoreCell value={page.overallScore} />
                  <ScoreCell value={page.positioningClarity} />
                  <ScoreCell value={page.structuredContent} />
                  <ScoreCell value={page.queryAlignment} />
                  <ScoreCell value={page.technicalSignals} />
                  <ScoreCell value={page.contentDepth} />
                  <ScoreCell value={page.comparisonContent} />
                  <td className="px-3 py-2 text-sm text-[#78716c] max-w-[200px] truncate">
                    {page.notes[0] ?? '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recommendations */}
      {audit.recommendations.length > 0 && (
        <div className="rounded-lg border border-[#e7e5e4] bg-white">
          <div className="px-4 py-3 border-b border-[#e7e5e4]">
            <h3 className="text-sm font-medium text-[#0c0a09]">Recommendations</h3>
          </div>
          <ul className="px-4 py-3 space-y-2">
            {audit.recommendations.map((rec: string, i: number) => (
              <li key={i} className="flex items-start gap-2 text-sm text-[#44403c]">
                <span className="text-[#78716c] font-medium shrink-0">{i + 1}.</span>
                {rec}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
