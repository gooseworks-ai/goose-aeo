import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { useDashboardData } from '../hooks/use-dashboard-data.js'
import { EmptyState } from '../components/common/empty-state.js'
import { LoadingSkeleton } from '../components/common/loading-skeleton.js'
import { ProviderLogo } from '../components/common/provider-logo.js'
import { MarkdownViewer } from '../components/common/markdown-viewer.js'
import { MetricCard } from '../components/cards/metric-card.js'
import { MetricGrid } from '../components/cards/metric-grid.js'
import type { RunResult, ResponseFilters, PageId, CompetitorData } from '../types.js'

function formatRunLabel(run: { id: string; startedAt: string; status: string }): string {
  const date = new Date(run.startedAt)
  const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  return `${dateStr} at ${timeStr} (${run.status})`
}

function providerLabel(provider: string): string {
  const labels: Record<string, string> = {
    openai: 'OpenAI',
    perplexity: 'Perplexity',
    gemini: 'Gemini',
    grok: 'Grok',
    claude: 'Claude',
    deepseek: 'DeepSeek',
  }
  return labels[provider.toLowerCase()] ?? provider
}

/* ------------------------------------------------------------------ */
/*  Multi-select dropdown with checkboxes                              */
/* ------------------------------------------------------------------ */

interface MultiSelectProps {
  label: string
  options: Array<{ value: string; label: string }>
  selected: string[]
  onChange: (selected: string[]) => void
}

function MultiSelect({ label, options, selected, onChange }: MultiSelectProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const toggle = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value))
    } else {
      onChange([...selected, value])
    }
  }

  const displayLabel = selected.length === 0
    ? label
    : selected.length === 1
      ? options.find((o) => o.value === selected[0])?.label ?? selected[0]
      : `${selected.length} selected`

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`rounded-lg border px-3 py-1.5 pr-7 text-sm outline-none transition-colors text-left min-w-[140px] ${
          selected.length > 0
            ? 'border-[#0284c7] bg-sky-50/60 text-[#0c0a09]'
            : 'border-[#e7e5e4] bg-white text-[#78716c]'
        }`}
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M3 4.5L6 7.5L9 4.5' stroke='%2378716c' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round' fill='none'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 8px center',
        }}
      >
        {displayLabel}
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-max min-w-full max-h-64 overflow-y-auto rounded-lg border border-[#e7e5e4] bg-white shadow-lg">
          {options.map((opt) => (
            <label
              key={opt.value}
              className="flex items-center gap-2 px-3 py-2 text-sm text-[#0c0a09] hover:bg-stone-50 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={selected.includes(opt.value)}
                onChange={() => toggle(opt.value)}
                className="rounded border-[#e7e5e4] text-[#0284c7] focus:ring-[#0284c7] h-3.5 w-3.5"
              />
              <span className="truncate max-w-[300px]">{opt.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Competitor dropdown with favicons                                  */
/* ------------------------------------------------------------------ */

interface CompetitorSelectProps {
  competitors: CompetitorData
  selected: string | undefined
  onChange: (domain: string | undefined) => void
  companyLabel: string
}

function CompetitorSelect({ competitors, selected, onChange, companyLabel }: CompetitorSelectProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const selectedComp = selected
    ? competitors.competitors.find((c) => c.domain === selected)
    : null

  const displayLabel = selectedComp
    ? (selectedComp.name ?? selectedComp.domain)
    : companyLabel

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`rounded-lg border px-3 py-1.5 pr-7 text-sm outline-none transition-colors text-left min-w-[160px] flex items-center gap-2 ${
          selected
            ? 'border-[#0284c7] bg-sky-50/60 text-[#0c0a09]'
            : 'border-[#e7e5e4] bg-white text-[#0c0a09]'
        }`}
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M3 4.5L6 7.5L9 4.5' stroke='%2378716c' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round' fill='none'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 8px center',
        }}
      >
        <img
          src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(selectedComp?.domain ?? companyLabel)}&sz=32`}
          alt=""
          width={14}
          height={14}
          className="rounded-sm shrink-0"
        />
        {displayLabel}
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-max min-w-full max-h-64 overflow-y-auto rounded-lg border border-[#e7e5e4] bg-white shadow-lg">
          {/* My company option */}
          <button
            type="button"
            onClick={() => { onChange(undefined); setOpen(false) }}
            className={`flex items-center gap-2 w-full px-3 py-2 text-sm text-left hover:bg-stone-50 ${
              !selected ? 'bg-stone-50 font-medium text-[#0c0a09]' : 'text-[#0c0a09]'
            }`}
          >
            <img
              src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(companyLabel)}&sz=32`}
              alt=""
              width={14}
              height={14}
              className="rounded-sm shrink-0"
            />
            {companyLabel}
          </button>
          {competitors.competitors.map((c) => (
            <button
              key={c.domain}
              type="button"
              onClick={() => { onChange(c.domain); setOpen(false) }}
              className={`flex items-center gap-2 w-full px-3 py-2 text-sm text-left hover:bg-stone-50 ${
                selected === c.domain ? 'bg-stone-50 font-medium text-[#0c0a09]' : 'text-[#0c0a09]'
              }`}
            >
              <img
                src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(c.domain)}&sz=32`}
                alt=""
                width={14}
                height={14}
                className="rounded-sm shrink-0"
              />
              {c.name ?? c.domain}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Helper: check if a competitor is mentioned in a response           */
/* ------------------------------------------------------------------ */

function isCompetitorMentioned(
  result: RunResult,
  comp: { domain: string; name: string | null },
): boolean {
  // Use structured analysis data when available
  const competitors = (result as any).competitorsMentioned as Array<{ domain: string; mentioned: boolean }> | null
  if (competitors && competitors.length > 0) {
    const domain = comp.domain.toLowerCase()
    const entry = competitors.find((c) => c.domain.toLowerCase() === domain)
    return entry?.mentioned ?? false
  }
  // Fallback to text search for legacy data without enriched competitor analysis
  const text = result.rawResponse.toLowerCase()
  if (text.includes(comp.domain.toLowerCase())) return true
  if (comp.name && text.includes(comp.name.toLowerCase())) return true
  return false
}

/* ------------------------------------------------------------------ */
/*  Responses Page                                                     */
/* ------------------------------------------------------------------ */

interface ResponsesPageProps {
  initialFilters?: ResponseFilters
  onNavigate?: (page: PageId, filters?: ResponseFilters) => void
}

export function ResponsesPage({ initialFilters, onNavigate }: ResponsesPageProps) {
  const { status, runs, loading, dataFetcher } = useDashboardData()

  const [results, setResults] = useState<RunResult[]>([])
  const [resultsLoading, setResultsLoading] = useState(false)
  const [selectedResult, setSelectedResult] = useState<RunResult | null>(null)
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)
  const [competitors, setCompetitors] = useState<CompetitorData | null>(null)

  // Filter state
  const [filterMentioned, setFilterMentioned] = useState<boolean | undefined>(initialFilters?.mentioned)
  const [filterQueries, setFilterQueries] = useState<string[]>(
    initialFilters?.queries ?? (initialFilters?.query ? [initialFilters.query] : [])
  )
  const [filterModels, setFilterModels] = useState<string[]>(
    initialFilters?.models ?? (initialFilters?.model ? [initialFilters.model] : [])
  )
  const [filterCompetitor, setFilterCompetitor] = useState<string | undefined>(initialFilters?.competitor)
  const [filterSourceDomain, setFilterSourceDomain] = useState<string | undefined>(initialFilters?.sourceDomain)

  // Apply initial filters when they change (from cross-page navigation)
  useEffect(() => {
    if (initialFilters) {
      setFilterMentioned(initialFilters.mentioned)
      setFilterQueries(initialFilters.queries ?? (initialFilters.query ? [initialFilters.query] : []))
      setFilterModels(initialFilters.models ?? (initialFilters.model ? [initialFilters.model] : []))
      setFilterCompetitor(initialFilters.competitor)
      setFilterSourceDomain(initialFilters.sourceDomain)
    }
  }, [initialFilters])

  const sortedRuns = [...runs].sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
  )

  useEffect(() => {
    if (sortedRuns.length > 0 && !selectedRunId) {
      setSelectedRunId(sortedRuns[0]?.id ?? null)
    }
  }, [sortedRuns, selectedRunId])

  useEffect(() => {
    if (!selectedRunId) return
    let mounted = true
    setResultsLoading(true)
    setSelectedResult(null)

    dataFetcher<RunResult[]>(`/api/runs/${selectedRunId}/results?limit=500`)
      .then((data) => {
        if (mounted) setResults(data)
      })
      .catch(() => {
        if (mounted) setResults([])
      })
      .finally(() => {
        if (mounted) setResultsLoading(false)
      })

    return () => { mounted = false }
  }, [selectedRunId, dataFetcher])

  // Fetch competitors
  useEffect(() => {
    if (!selectedRunId) return
    let mounted = true

    dataFetcher<CompetitorData>(`/api/runs/${selectedRunId}/competitors`)
      .then((data) => { if (mounted) setCompetitors(data) })
      .catch(() => { if (mounted) setCompetitors(null) })

    return () => { mounted = false }
  }, [selectedRunId, dataFetcher])

  // The selected competitor object (for perspective switch)
  const selectedComp = useMemo(() => {
    if (!filterCompetitor || !competitors) return null
    return competitors.competitors.find((c) => c.domain === filterCompetitor) ?? null
  }, [filterCompetitor, competitors])

  // Determine "mentioned" for a result based on perspective
  const isMentioned = useCallback((result: RunResult): boolean | null => {
    if (selectedComp) {
      // Competitor perspective: check if competitor appears in the response
      return isCompetitorMentioned(result, selectedComp)
    }
    // Default: my company's analysis
    return result.mentioned
  }, [selectedComp])

  // Derive unique queries and providers from results
  const uniqueQueries = useMemo(() => {
    const qs = new Set<string>()
    for (const r of results) qs.add(r.query)
    return Array.from(qs).sort()
  }, [results])

  const uniqueProviders = useMemo(() => {
    const ps = new Set<string>()
    for (const r of results) ps.add(r.provider)
    return Array.from(ps).sort()
  }, [results])

  // Apply filters
  const filteredResults = useMemo(() => {
    let filtered = results

    if (filterQueries.length > 0) {
      const qSet = new Set(filterQueries)
      filtered = filtered.filter((r) => qSet.has(r.query))
    }

    if (filterModels.length > 0) {
      const mSet = new Set(filterModels)
      filtered = filtered.filter((r) => mSet.has(r.provider))
    }

    if (filterMentioned !== undefined) {
      filtered = filtered.filter((r) => isMentioned(r) === filterMentioned)
    }

    if (filterSourceDomain) {
      const domain = filterSourceDomain.toLowerCase()
      filtered = filtered.filter((r) =>
        r.sources.some((s) => {
          try {
            return new URL(s.url).hostname.replace(/^www\./, '').toLowerCase() === domain
          } catch {
            return false
          }
        })
      )
    }

    return filtered
  }, [results, filterMentioned, filterQueries, filterModels, filterSourceDomain, isMentioned])

  // Compute metrics from filtered results using the active perspective
  const metrics = useMemo(() => {
    const total = filteredResults.length
    if (total === 0) return { visibilityRate: 0, totalResponses: 0, mentionedCount: 0, avgProminence: 0, avgSentiment: 0 }

    const mentionedCount = filteredResults.filter((r) => isMentioned(r) === true).length

    if (selectedComp) {
      // Competitor perspective — extract prominence from enriched competitor data
      const compDomain = selectedComp.domain.toLowerCase()
      const prominenceValues: number[] = []
      for (const r of filteredResults) {
        const comps = (r as any).competitorsMentioned as Array<{ domain: string; prominence_score: number }> | null
        const entry = comps?.find((c) => c.domain.toLowerCase() === compDomain)
        if (entry && entry.prominence_score > 0) prominenceValues.push(entry.prominence_score)
      }
      return {
        visibilityRate: mentionedCount / total,
        totalResponses: total,
        mentionedCount,
        avgProminence: prominenceValues.length > 0 ? prominenceValues.reduce((a, b) => a + b, 0) / prominenceValues.length : 0,
        avgSentiment: -999, // sentiment score not tracked per-competitor
      }
    }

    const mentionedResults = filteredResults.filter((r) => isMentioned(r) === true)
    const prominenceValues = mentionedResults.filter((r) => r.prominenceScore !== null && r.prominenceScore > 0).map((r) => r.prominenceScore!)
    const sentimentValues = mentionedResults.filter((r) => r.sentimentScore !== null).map((r) => r.sentimentScore!)

    return {
      visibilityRate: mentionedCount / total,
      totalResponses: total,
      mentionedCount,
      avgProminence: prominenceValues.length > 0 ? prominenceValues.reduce((a, b) => a + b, 0) / prominenceValues.length : 0,
      avgSentiment: sentimentValues.length > 0 ? sentimentValues.reduce((a, b) => a + b, 0) / sentimentValues.length : 0,
    }
  }, [filteredResults, isMentioned, selectedComp])

  const hasActiveFilters = filterMentioned !== undefined || filterQueries.length > 0 || filterModels.length > 0 || !!filterCompetitor || !!filterSourceDomain

  const clearFilters = () => {
    setFilterMentioned(undefined)
    setFilterQueries([])
    setFilterModels([])
    setFilterCompetitor(undefined)
    setFilterSourceDomain(undefined)
  }

  if (loading) {
    return <LoadingSkeleton rows={6} />
  }

  if (!status || sortedRuns.length === 0) {
    return <EmptyState title="No runs yet" description="Run an analysis to see AI responses." />
  }

  return (
    <div className="space-y-4">
      {/* Run selector */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-[#78716c]">Run:</span>
        <select
          value={selectedRunId ?? ''}
          onChange={(e) => setSelectedRunId(e.target.value)}
          className="rounded-xl border border-[#e7e5e4] bg-white px-3 py-1.5 pr-8 text-sm text-[#0c0a09] outline-none focus:border-[#0284c7] appearance-none"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M3 4.5L6 7.5L9 4.5' stroke='%2378716c' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round' fill='none'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 10px center',
          }}
        >
          {sortedRuns.map((run) => (
            <option key={run.id} value={run.id}>
              {formatRunLabel(run)}
            </option>
          ))}
        </select>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs font-medium uppercase tracking-wider text-[#78716c]">Viewing as</span>

        {/* Competitor perspective switcher */}
        {competitors && competitors.competitors.length > 0 && (
          <CompetitorSelect
            competitors={competitors}
            selected={filterCompetitor}
            onChange={setFilterCompetitor}
            companyLabel={status?.company ?? 'My company'}
          />
        )}

        <div className="w-px h-5 bg-[#e7e5e4]" />

        {/* Mentioned filter */}
        <div className="flex items-center gap-1">
          {([undefined, true, false] as const).map((val) => {
            const label = val === undefined ? 'All' : val ? 'Mentioned' : 'Not mentioned'
            const isActive = filterMentioned === val
            return (
              <button
                key={String(val)}
                type="button"
                onClick={() => setFilterMentioned(val)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-[#1c1917] text-white'
                    : 'bg-white border border-[#e7e5e4] text-[#78716c] hover:bg-stone-50'
                }`}
              >
                {label}
              </button>
            )
          })}
        </div>

        {/* Query multi-select */}
        <MultiSelect
          label="All queries"
          options={uniqueQueries.map((q) => ({
            value: q,
            label: q.length > 60 ? q.slice(0, 60) + '...' : q,
          }))}
          selected={filterQueries}
          onChange={setFilterQueries}
        />

        {/* Model multi-select */}
        <MultiSelect
          label="All models"
          options={uniqueProviders.map((p) => ({ value: p, label: providerLabel(p) }))}
          selected={filterModels}
          onChange={setFilterModels}
        />

        {/* Source domain filter pill */}
        {filterSourceDomain && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#0284c7] bg-sky-50/60 px-3 py-1 text-xs font-medium text-[#0c0a09]">
            <img
              src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(filterSourceDomain)}&sz=16`}
              alt=""
              width={12}
              height={12}
              className="rounded-sm"
            />
            Source: {filterSourceDomain}
            <button
              type="button"
              onClick={() => setFilterSourceDomain(undefined)}
              className="ml-0.5 text-[#78716c] hover:text-[#0c0a09]"
            >
              ✕
            </button>
          </span>
        )}

        {/* Clear filters */}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="px-3 py-1 rounded-full text-xs font-medium text-[#dc2626] bg-red-50 hover:bg-red-100 transition-colors"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Metrics */}
      <MetricGrid>
        <MetricCard
          label="Visibility Rate"
          value={`${(metrics.visibilityRate * 100).toFixed(1)}%`}
          subtitle={`Mentioned in ${metrics.mentionedCount} of ${metrics.totalResponses} responses`}
        />
        <MetricCard
          label="Total Responses"
          value={String(metrics.totalResponses)}
          subtitle={`${metrics.totalResponses - metrics.mentionedCount} not mentioned`}
        />
        {metrics.avgProminence !== -1 && (
          <MetricCard
            label="Avg Prominence"
            value={`${(metrics.avgProminence * 10).toFixed(0)}%`}
            subtitle={`Across ${metrics.mentionedCount} mentioned responses`}
          />
        )}
        {metrics.avgSentiment !== -999 && (
          <MetricCard
            label="Avg Sentiment"
            value={metrics.avgSentiment.toFixed(2)}
            subtitle={`Across ${metrics.mentionedCount} mentioned responses`}
          />
        )}
      </MetricGrid>

      {resultsLoading ? (
        <LoadingSkeleton rows={6} />
      ) : filteredResults.length === 0 ? (
        <EmptyState
          title={hasActiveFilters ? 'No matching results' : 'No results'}
          description={hasActiveFilters ? 'Try adjusting your filters.' : 'No responses found for this run.'}
        />
      ) : (
        <div className="flex gap-4" style={{ height: 'calc(100vh - 380px)' }}>
          {/* Response list — compact cards */}
          <div className="w-[380px] shrink-0 overflow-y-auto space-y-1 pr-1">
            {filteredResults.map((result) => {
              const isSelected = selectedResult?.responseId === result.responseId
              const isEmpty = !result.rawResponse
              const mentioned = isEmpty ? null : isMentioned(result)
              return (
                <button
                  key={result.responseId}
                  type="button"
                  onClick={() => setSelectedResult(result)}
                  className={`w-full text-left rounded-lg border px-3 py-2.5 transition-colors ${
                    isSelected
                      ? 'border-[#0284c7] bg-sky-50/60'
                      : isEmpty
                        ? 'border-[#fecaca] bg-red-50/40 hover:bg-red-50/60'
                        : 'border-[#e7e5e4] bg-white hover:bg-stone-50/50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <ProviderLogo provider={result.provider} size={16} />
                      <span className="text-xs font-medium text-[#78716c]">
                        {providerLabel(result.provider)}
                      </span>
                    </div>
                    <span className={`text-xs font-medium ${
                      isEmpty ? 'text-[#a8a29e]' : mentioned === true ? 'text-[#16a34a]' : mentioned === false ? 'text-[#dc2626]' : 'text-[#78716c]'
                    }`}>
                      {isEmpty ? 'Empty response' : mentioned === true ? 'Mentioned' : mentioned === false ? 'Not mentioned' : 'Pending'}
                    </span>
                  </div>
                  <div className="text-sm text-[#0c0a09] truncate">{result.query}</div>
                </button>
              )
            })}
          </div>

          {/* Response detail panel */}
          <div className="flex-1 overflow-y-auto min-w-0">
            {selectedResult ? (
              <div className="space-y-5">
                {/* Provider + model header */}
                <div className="flex items-center gap-3">
                  <ProviderLogo provider={selectedResult.provider} size={24} />
                  <div>
                    <div className="text-sm font-medium text-[#0c0a09]">
                      {providerLabel(selectedResult.provider)}
                    </div>
                    <div className="text-xs text-[#78716c]">{selectedResult.model}</div>
                  </div>
                </div>

                {/* Query */}
                <div>
                  <h3 className="text-xs font-medium uppercase tracking-wider text-[#78716c] mb-1">Query</h3>
                  <p className="text-sm text-[#0c0a09]">{selectedResult.query}</p>
                </div>

                {/* Metadata grid */}
                <div className="rounded-lg border border-[#e7e5e4] bg-white overflow-hidden">
                  <div className={`grid grid-cols-3 divide-x divide-[#e7e5e4]`}>
                    <div className="px-4 py-3">
                      <span className="text-xs font-medium uppercase tracking-wider text-[#78716c] block mb-0.5">
                        {selectedComp ? `${selectedComp.name ?? selectedComp.domain} Mentioned` : 'Mentioned'}
                      </span>
                      {(() => {
                        const mentioned = isMentioned(selectedResult)
                        return (
                          <span className={`text-sm font-medium ${
                            mentioned === true ? 'text-[#16a34a]' : mentioned === false ? 'text-[#dc2626]' : 'text-[#78716c]'
                          }`}>
                            {mentioned === true ? 'Yes' : mentioned === false ? 'No' : 'Pending'}
                          </span>
                        )
                      })()}
                    </div>
                    {(() => {
                      // Get competitor-specific or company analysis data
                      const compAnalysis = selectedComp
                        ? ((selectedResult as any).competitorsMentioned as Array<{ domain: string; prominence_score: number; mention_context: string; sentiment: string }> | null)
                            ?.find((c) => c.domain.toLowerCase() === selectedComp.domain.toLowerCase())
                        : null
                      const prominence = compAnalysis ? compAnalysis.prominence_score : selectedResult.prominenceScore
                      const sentiment = compAnalysis
                        ? (compAnalysis.sentiment !== 'not_mentioned' ? compAnalysis.sentiment : null)
                        : (selectedResult.sentiment && selectedResult.sentiment !== 'not_mentioned' ? selectedResult.sentiment : null)
                      return (
                        <>
                          <div className="px-4 py-3">
                            <span className="text-xs font-medium uppercase tracking-wider text-[#78716c] block mb-0.5">Prominence</span>
                            <span className="text-sm font-medium text-[#0c0a09]">
                              {prominence !== null && prominence !== undefined ? `${(prominence * 10).toFixed(0)}%` : '—'}
                            </span>
                          </div>
                          <div className="px-4 py-3">
                            <span className="text-xs font-medium uppercase tracking-wider text-[#78716c] block mb-0.5">Sentiment</span>
                            <span className="text-sm font-medium text-[#0c0a09]">
                              {sentiment ?? '—'}
                            </span>
                          </div>
                        </>
                      )
                    })()}
                  </div>
                </div>

                {/* Relevant Excerpt */}
                {(() => {
                  const compExcerpt = selectedComp
                    ? ((selectedResult as any).competitorsMentioned as Array<{ domain: string; relevant_excerpt: string }> | null)
                        ?.find((c) => c.domain.toLowerCase() === selectedComp.domain.toLowerCase())?.relevant_excerpt
                    : null
                  const excerpt = compExcerpt || (!selectedComp ? selectedResult.relevantExcerpt : null)
                  if (!excerpt) return null
                  return (
                    <div>
                      <h3 className="text-xs font-medium uppercase tracking-wider text-[#78716c] mb-1.5">Relevant Excerpt</h3>
                      <p className="text-sm text-[#78716c] italic leading-relaxed">{excerpt}</p>
                    </div>
                  )
                })()}
                {/* Sources */}
                {selectedResult.sources.length > 0 && (
                  <div>
                    <h3 className="text-xs font-medium uppercase tracking-wider text-[#78716c] mb-1.5">Sources</h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedResult.sources.map((source, i) => (
                        <a
                          key={i}
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-full border border-[#e7e5e4] bg-white px-2.5 py-1 text-xs text-[#0c0a09] hover:bg-stone-50 transition-colors"
                        >
                          <img
                            src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(new URL(source.url).hostname)}&sz=16`}
                            alt=""
                            width={12}
                            height={12}
                            className="rounded-sm"
                            loading="lazy"
                          />
                          {new URL(source.url).hostname.replace(/^www\./, '')}
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Full Response — markdown rendered */}
                <div>
                  <h3 className="text-xs font-medium uppercase tracking-wider text-[#78716c] mb-2">Full Response</h3>
                  <div className="rounded-lg border border-[#e7e5e4] bg-white p-5 overflow-hidden">
                    <MarkdownViewer content={selectedResult.rawResponse} />
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-[#e7e5e4] bg-white flex items-center justify-center" style={{ height: 'calc(100vh - 380px)' }}>
                <p className="text-sm text-[#78716c]">Select a response to view details</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
