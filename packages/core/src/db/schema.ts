import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const companies = sqliteTable('companies', {
  id: text('id').primaryKey(),
  domain: text('domain').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
  config: text('config').notNull(),
  createdAt: integer('created_at').notNull(),
})

export const competitors = sqliteTable('competitors', {
  id: text('id').primaryKey(),
  companyId: text('company_id').notNull(),
  domain: text('domain').notNull(),
  name: text('name'),
  createdAt: integer('created_at').notNull(),
})

export const queries = sqliteTable('queries', {
  id: text('id').primaryKey(),
  companyId: text('company_id').notNull(),
  text: text('text').notNull(),
  version: integer('version').notNull().default(1),
  createdAt: integer('created_at').notNull(),
  deprecatedAt: integer('deprecated_at'),
})

export const runs = sqliteTable('runs', {
  id: text('id').primaryKey(),
  companyId: text('company_id').notNull(),
  status: text('status').notNull(),
  configSnapshot: text('config_snapshot').notNull(),
  queryVersion: integer('query_version').notNull(),
  estimatedCost: real('estimated_cost'),
  actualCost: real('actual_cost'),
  startedAt: integer('started_at').notNull(),
  completedAt: integer('completed_at'),
  error: text('error'),
})

export const providerResponses = sqliteTable('provider_responses', {
  id: text('id').primaryKey(),
  runId: text('run_id').notNull(),
  queryId: text('query_id').notNull(),
  provider: text('provider').notNull(),
  model: text('model').notNull(),
  rawResponse: text('raw_response').notNull(),
  sources: text('sources'),
  inputTokens: integer('input_tokens'),
  outputTokens: integer('output_tokens'),
  costUsd: real('cost_usd'),
  durationMs: integer('duration_ms'),
  createdAt: integer('created_at').notNull(),
})

export const analysisResults = sqliteTable('analysis_results', {
  id: text('id').primaryKey(),
  responseId: text('response_id').notNull(),
  runId: text('run_id').notNull(),
  queryId: text('query_id').notNull(),
  provider: text('provider').notNull(),

  mentioned: integer('mentioned').notNull(),
  mentionType: text('mention_type'),
  totalMentions: integer('total_mentions'),
  firstMentionSentence: integer('first_mention_sentence'),

  prominenceScore: real('prominence_score'),
  mentionContext: text('mention_context'),
  listPosition: integer('list_position'),
  recommendedAsBest: integer('recommended_as_best'),

  domainCitedAsSource: integer('domain_cited_as_source'),
  sourcePosition: integer('source_position'),

  competitorsMentioned: text('competitors_mentioned'),
  ourRankVsCompetitors: integer('our_rank_vs_competitors'),
  rankedAbove: text('ranked_above'),
  rankedBelow: text('ranked_below'),

  sentiment: text('sentiment'),
  sentimentScore: real('sentiment_score'),
  sentimentNote: text('sentiment_note'),

  responseType: text('response_type'),
  relevantExcerpt: text('relevant_excerpt'),

  analysisModel: text('analysis_model').notNull(),
  analysisInputTokens: integer('analysis_input_tokens'),
  analysisOutputTokens: integer('analysis_output_tokens'),
  analysisCostUsd: real('analysis_cost_usd'),
  createdAt: integer('created_at').notNull(),
})

export const audits = sqliteTable('audits', {
  id: text('id').primaryKey(),
  companyId: text('company_id').notNull(),
  overallScore: real('overall_score').notNull(),
  pages: text('pages').notNull(),
  recommendations: text('recommendations').notNull(),
  model: text('model').notNull(),
  costUsd: real('cost_usd'),
  createdAt: integer('created_at').notNull(),
})

export const recommendations = sqliteTable('recommendations', {
  id: text('id').primaryKey(),
  runId: text('run_id').notNull(),
  companyId: text('company_id').notNull(),
  visibilityGaps: text('visibility_gaps').notNull(),
  sourceOpportunities: text('source_opportunities').notNull(),
  competitorInsights: text('competitor_insights').notNull(),
  summary: text('summary').notNull(),
  model: text('model').notNull(),
  costUsd: real('cost_usd'),
  createdAt: integer('created_at').notNull(),
})

export const runMetrics = sqliteTable('run_metrics', {
  id: text('id').primaryKey(),
  runId: text('run_id').notNull(),
  provider: text('provider'),
  metric: text('metric').notNull(),
  value: real('value').notNull(),
  createdAt: integer('created_at').notNull(),
})
