import { and, eq } from 'drizzle-orm'
import { analysisResults, providerResponses, runMetrics, runs } from '../../db/schema.js'
import { idWithPrefix, nowEpochMs } from '../../utils/id.js'
import { safeJsonParse } from '../../utils/json.js'
import type { AEOContext } from '../../context.js'
import type { ProviderId } from '../../types/index.js'

export interface AnalysisRow {
  provider: string
  mentioned: number
  prominenceScore: number | null
  mentionContext: string | null
  domainCitedAsSource: number | null
  competitorsMentioned: string | null
  sentimentScore: number | null
  ourRankVsCompetitors: number | null
}

const avg = (values: number[]): number => {
  if (values.length === 0) {
    return 0
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length
}

const median = (values: number[]): number => {
  if (values.length === 0) {
    return 0
  }

  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) {
    const left = sorted[mid - 1] ?? 0
    const right = sorted[mid] ?? 0
    return (left + right) / 2
  }

  return sorted[mid] ?? 0
}

export const buildMetrics = (rows: AnalysisRow[], totalCostUsd: number): Record<string, number> => {
  const total = rows.length
  if (total === 0) {
    return {
      visibility_rate: 0,
      avg_prominence_score: 0,
      citation_rate: 0,
      top_recommendation_rate: 0,
      share_of_voice: 0,
      avg_sentiment_score: 0,
      median_competitive_rank: 0,
      total_cost_usd: totalCostUsd,
    }
  }

  const mentionedRows = rows.filter((row) => row.mentioned === 1)
  const mentions = mentionedRows.length
  const competitorMentions = rows.reduce((sum, row) => {
    const competitors = safeJsonParse<Array<{ domain: string }>>(row.competitorsMentioned ?? '[]', [])
    return sum + competitors.length
  }, 0)

  return {
    visibility_rate: mentions / total,
    avg_prominence_score: avg(mentionedRows.map((row) => row.prominenceScore ?? 0)),
    citation_rate: rows.filter((row) => row.domainCitedAsSource === 1).length / total,
    top_recommendation_rate:
      rows.filter((row) => row.mentionContext === 'primary_recommendation').length / total,
    share_of_voice: mentions / Math.max(1, mentions + competitorMentions),
    avg_sentiment_score: avg(mentionedRows.map((row) => row.sentimentScore ?? 0)),
    median_competitive_rank: median(
      mentionedRows.map((row) => row.ourRankVsCompetitors).filter((value): value is number => value !== null),
    ),
    total_cost_usd: totalCostUsd,
  }
}

const providerIds: ProviderId[] = ['perplexity', 'openai', 'gemini', 'grok', 'claude', 'deepseek']

export const computeAndStoreRunMetrics = async (ctx: AEOContext, runId: string): Promise<void> => {
  const rows = await ctx.sqliteDb.db
    .select({
      provider: analysisResults.provider,
      mentioned: analysisResults.mentioned,
      prominenceScore: analysisResults.prominenceScore,
      mentionContext: analysisResults.mentionContext,
      domainCitedAsSource: analysisResults.domainCitedAsSource,
      competitorsMentioned: analysisResults.competitorsMentioned,
      sentimentScore: analysisResults.sentimentScore,
      ourRankVsCompetitors: analysisResults.ourRankVsCompetitors,
    })
    .from(analysisResults)
    .where(eq(analysisResults.runId, runId))

  const providerCosts = await ctx.sqliteDb.db
    .select({
      provider: providerResponses.provider,
      costUsd: providerResponses.costUsd,
    })
    .from(providerResponses)
    .where(eq(providerResponses.runId, runId))

  const analysisCosts = await ctx.sqliteDb.db
    .select({
      provider: analysisResults.provider,
      costUsd: analysisResults.analysisCostUsd,
    })
    .from(analysisResults)
    .where(eq(analysisResults.runId, runId))

  const overallCost =
    providerCosts.reduce((sum, row) => sum + (row.costUsd ?? 0), 0) +
    analysisCosts.reduce((sum, row) => sum + (row.costUsd ?? 0), 0)

  const overallMetrics = buildMetrics(rows, overallCost)

  await ctx.sqliteDb.db.delete(runMetrics).where(eq(runMetrics.runId, runId))

  const allMetricRows: Array<{
    id: string
    runId: string
    provider: string | null
    metric: string
    value: number
    createdAt: number
  }> = Object.entries(overallMetrics).map(([metric, value]) => ({
    id: idWithPrefix('metric'),
    runId,
    provider: null,
    metric,
    value,
    createdAt: nowEpochMs(),
  }))

  for (const providerId of providerIds) {
    const subset = rows.filter((row) => row.provider === providerId)
    if (subset.length === 0) {
      continue
    }

    const providerCost =
      providerCosts
        .filter((row) => row.provider === providerId)
        .reduce((sum, row) => sum + (row.costUsd ?? 0), 0) +
      analysisCosts
        .filter((row) => row.provider === providerId)
        .reduce((sum, row) => sum + (row.costUsd ?? 0), 0)

    const providerMetrics = buildMetrics(subset, providerCost)
    for (const [metric, value] of Object.entries(providerMetrics)) {
      allMetricRows.push({
        id: idWithPrefix('metric'),
        runId,
        provider: providerId,
        metric,
        value,
        createdAt: nowEpochMs(),
      })
    }
  }

  await ctx.sqliteDb.db.insert(runMetrics).values(allMetricRows)

  await ctx.sqliteDb.db
    .update(runs)
    .set({ actualCost: overallCost })
    .where(and(eq(runs.id, runId), eq(runs.companyId, 'company_default')))
}
