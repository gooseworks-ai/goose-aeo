export type AEODataFetcher = <T>(path: string) => Promise<T>

export interface AEODashboardProps {
  dataFetcher: AEODataFetcher
  companyName?: string
}

export type PageId =
  | 'overview'
  | 'models'
  | 'queries'
  | 'responses'
  | 'citations'
  | 'competitors'
  | 'runs'
  | 'recommendations'
  | 'audit'

export interface StatusData {
  company: string
  totalQueries: number
  totalRuns: number
  latestRun: {
    id: string
    status: string
    completedAt: string | null
    visibilityRate: number | null
    actualCostUsd: number
  } | null
  dbPath: string
  dbSizeMb: number
}

export interface RunRecord {
  id: string
  status: string
  startedAt: string
  completedAt: string | null
  estimatedCostUsd: number | null
  actualCostUsd: number | null
  queryVersion: number
  error: string | null
}

export interface QueryRecord {
  id: string
  text: string
  version: number
  companyId: string
  createdAt: number
  deprecatedAt: number | null
}

export interface CostsData {
  runs: Array<{
    runId: string
    date: string
    estimated: number
    actual: number
    queries: number
    providers: number
  }>
  allTimeActual: number
  totalRuns: number
}

export interface TrendPoint {
  runId: string
  date: string
  value: number
}

export interface TrendData {
  metric: string
  provider: string | null
  points: TrendPoint[]
}

export interface QueryVisibility {
  queryId: string
  query: string
  version: number
  active: boolean
  visibilityRate: number
}

export interface MetricGroup {
  provider: string | null
  metrics: Record<string, number>
}

export interface RunResult {
  responseId: string
  queryId: string
  query: string
  provider: string
  model: string
  rawResponse: string
  sources: Array<{
    url: string
    title?: string
  }>
  mentioned: boolean | null
  prominenceScore: number | null
  sentiment: string | null
  sentimentScore: number | null
  relevantExcerpt: string | null
  competitorsMentioned: Array<{
    domain: string
    name: string
    mentioned: boolean
    prominence_score: number
    mention_context: string
    sentiment: string
    relevant_excerpt: string
  }> | null
  costUsd: number | null
  createdAt: string
}

export interface CompetitorData {
  competitors: Array<{
    domain: string
    name: string | null
    mentionCount: number
    visibilityRate: number
  }>
  ourRank: number | null
  totalResponses: number
}

export interface CitationData {
  domains: Array<{
    domain: string
    mentionCount: number
    isOwnDomain: boolean
    isCompetitor: boolean
  }>
  totalCitations: number
  ownDomainCitations: number
}

export interface RecommendationData {
  id: string
  runId: string
  visibilityGaps: Array<{
    topic: string
    queries: string[]
    citedSources: string[]
    mentionedCompetitors: string[]
    recommendation: string
  }>
  sourceOpportunities: Array<{
    domain: string
    citationCount: number
    queryContexts: string[]
    recommendation: string
  }>
  competitorInsights: Array<{
    competitor: string
    domain: string
    queriesWhereTheyAppear: string[]
    excerpts: string[]
    recommendation: string
  }>
  summary: string
  model: string
  costUsd: number | null
  createdAt: string
}

export interface PageAuditScoreData {
  url: string
  positioningClarity: number
  structuredContent: number
  queryAlignment: number
  technicalSignals: number
  contentDepth: number
  comparisonContent: number
  overallScore: number
  notes: string[]
}

export interface AuditData {
  id: string
  companyId: string
  overallScore: number
  pages: PageAuditScoreData[]
  recommendations: string[]
  model: string
  costUsd: number | null
  createdAt: string
}

export interface ResponseFilters {
  competitor?: string
  mentioned?: boolean
  query?: string
  queries?: string[]
  model?: string
  models?: string[]
  sourceDomain?: string
}

export interface DashboardData {
  status: StatusData | null
  runs: RunRecord[]
  queries: QueryRecord[]
  costs: CostsData | null
  loading: boolean
  error: string | null
}
