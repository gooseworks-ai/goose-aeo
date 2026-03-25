export type RunStatus = 'pending' | 'running' | 'complete' | 'failed' | 'aborted'

export type ProviderId =
  | 'perplexity'
  | 'openai'
  | 'gemini'
  | 'grok'
  | 'claude'
  | 'deepseek'

export interface Source {
  url: string
  domain: string
  title: string
  snippet?: string
}

export interface ProviderConfig {
  model: string
  apiKey: string
  temperature?: number
  maxTokens?: number
}

export interface ProviderResponse {
  provider: ProviderId
  model: string
  query: string
  responseText: string
  sources: Source[] | null
  inputTokens: number
  outputTokens: number
  costUsd: number
  durationMs: number
  raw: unknown
}

export interface Provider {
  id: ProviderId
  name: string
  model: string
  supportsWebSearch: boolean
  supportsSourceCitations: boolean
  call: (query: string, config: ProviderConfig) => Promise<ProviderResponse>
}

export interface CompetitorConfig {
  domain: string
  name?: string
}

export interface ConfigProvider {
  id: ProviderId
  model: string
}

export interface GooseAEOConfig {
  domain: string
  name: string
  description?: string
  competitors: CompetitorConfig[]
  providers: ConfigProvider[]
  analysis: {
    provider: ProviderId
    model: string
  }
  queryLimit: number
  dbPath: string
  queriesBackup?: string
  budgetLimitUsd?: number | null
  schedule?: string | null
  alerts?: {
    visibilityRateDrop?: number
    prominenceScoreDrop?: number
    shareOfVoiceDrop?: number
  }
}

export interface PricingModelEntry {
  model: string
  costPer1kInputTokens: number
  costPer1kOutputTokens: number
  avgInputTokens: number
  avgOutputTokens: number
}

export interface AnalysisPricing {
  model: string
  costPer1kInputTokens: number
  costPer1kOutputTokens: number
  avgInputTokens: number
  avgOutputTokens: number
}

export interface PricingConfig {
  providers: Record<ProviderId, PricingModelEntry>
  analysis: AnalysisPricing
}

export interface RunEstimate {
  queries: number
  providers: ProviderId[]
  totalApiCalls: number
  providerBreakdown: Record<ProviderId, number>
  analysisCostUsd: number
  totalUsd: number
}

export interface RunCreateOptions {
  providers?: ProviderId[]
  queryIds?: string[]
  queryLimit?: number
  noEstimate?: boolean
  confirm?: boolean
  budgetLimitUsd?: number
  concurrency?: number
  dryRun?: boolean
}

export interface RunSummary {
  runId: string
  status: RunStatus
  queriesRun: number
  providers: ProviderId[]
  totalApiCalls: number
  estimatedCostUsd: number
  actualCostUsd: number
  durationSeconds: number
  errors: string[]
}

export interface AlertEvent {
  metric: 'visibility_rate' | 'avg_prominence_score' | 'share_of_voice'
  previous: number
  current: number
  drop: number
  threshold: number
  runId: string
  previousRunId: string
}

export interface AnalysisInput {
  runId?: string
  model?: string
  reanalyze?: boolean
  emitAlerts?: boolean
}

export interface AnalyzeSummary {
  runId: string
  responsesAnalyzed: number
  inserted: number
  skipped: number
  failed: number
  analysisCostUsd: number
  alerts: AlertEvent[]
  alertDispatch: {
    sentToSlack: boolean
    sentToEmail: boolean
    previousRunId: string | null
  }
}

export interface MetricDelta {
  metric: string
  provider: ProviderId | null
  run1: number | null
  run2: number | null
  delta: number | null
}

export interface DiffResult {
  run1: string
  run2: string
  deltas: MetricDelta[]
}

export interface CostsResult {
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

export interface StatusResult {
  company: string
  totalQueries: number
  totalRuns: number
  latestRun: {
    id: string
    status: RunStatus
    completedAt: string | null
    visibilityRate: number | null
    actualCostUsd: number | null
  } | null
  dbPath: string
  dbSizeMb: number
}

export interface ScheduleStatus {
  schedule: string | null
  cron: string | null
  suggestedCronCommand: string | null
}

export interface ReportResult {
  runId: string
  company: string
  domain: string
  generatedAt: string
  metrics: Record<string, number>
  providerMetrics: Array<{
    provider: ProviderId
    metrics: Record<string, number>
  }>
  topQueries: Array<{
    queryId: string
    query: string
    visibilityRate: number
  }>
  bottomQueries: Array<{
    queryId: string
    query: string
    visibilityRate: number
  }>
  compareTo?: {
    runId: string
    deltas: Array<{
      metric: string
      current: number
      previous: number
      delta: number
    }>
  }
}

export interface PageAuditScore {
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

export interface AuditInput {
  maxPages?: number
  model?: string
}

export interface AuditResult {
  id: string
  companyId: string
  overallScore: number
  pages: PageAuditScore[]
  recommendations: string[]
  model: string
  costUsd: number
  createdAt: string
}

export interface RecommendationResult {
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
  costUsd: number
  createdAt: string
}

export interface DashboardRunRecord {
  id: string
  status: RunStatus
  startedAt: string
  completedAt: string | null
  estimatedCostUsd: number | null
  actualCostUsd: number | null
  queryVersion: number
  error: string | null
}

export interface DashboardResultRecord {
  responseId: string
  queryId: string
  query: string
  provider: ProviderId
  model: string
  rawResponse: string
  sources: Source[]
  mentioned: boolean | null
  prominenceScore: number | null
  sentiment: string | null
  sentimentScore: number | null
  relevantExcerpt: string | null
  costUsd: number | null
  createdAt: string
}
